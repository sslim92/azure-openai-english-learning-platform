"""ai_server/app.py

FastAPI 백엔드 엔트리포인트입니다.

목표:
- Next.js 프론트엔드(또는 다른 클라이언트)에 노출되는 엔드포인트를 한 영역에 모아 가독성을 높입니다.
- Azure/OpenAI와 통신하는 헬퍼(HTTP 프록시, TTS, LangChain 래퍼)는 별도 영역으로 분리합니다.

구현 원칙:
- 기존 동작을 변경하지 않음(주요 로직은 그대로 유지).
- 파일 내에서 "Next.js-facing endpoints"(프론트엔드와 통신)와
  "OpenAI/Azure internals"(직접 API 호출, LLM 래퍼)를 주석으로 명확히 구분.
"""

from typing import Any, Dict, List, Optional
import base64
import json
import os
import re
import requests

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# LangChain / Azure OpenAI (LLM wrapper)
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableSerializable


load_dotenv()  # .env 파일 로드


# =========================
# Configuration
# =========================
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI")
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION") or "2024-06-01"

# TTS 별도 설정 (Speech 리소스)
AZURE_TTS_DEPLOYMENT = os.getenv("AZURE_OPENAI_TTS_DEPLOYMENT_NAME")
AZURE_TTS_API_VERSION = os.getenv("AZURE_OPENAI_TTS_API_VERSION") or "2025-03-01-preview"
AZURE_TTS_VOICE = os.getenv("AZURE_OPENAI_TTS_VOICE") or "alloy"
AZURE_TTS_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_TTS_ENDPOINT = os.getenv("AZURE_SPEECH_ENDPOINT")


if not AZURE_ENDPOINT or not AZURE_KEY or not AZURE_DEPLOYMENT:
    raise RuntimeError(
        "Azure OpenAI 설정이 누락되었습니다. 필수 환경변수: "
        "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI"
    )


app = FastAPI()


# =========================
# Azure/OpenAI helper functions (internals)
# - 이 섹션은 외부(Next.js)와 직접 통신하지 않고, 내부에서만 사용되는 함수들을 모아둡니다.
# - 프록시 요청 헤더/URL 생성, 모델 응답 파싱, 등.
# =========================


def _azure_headers() -> Dict[str, str]:
    """Azure REST 호출용 공통 헤더 생성"""
    return {"api-key": AZURE_KEY, "Content-Type": "application/json"}


def _azure_base() -> str:
    """AZURE_ENDPOINT의 후행 슬래시를 제거한 베이스 URL 반환"""
    return (AZURE_ENDPOINT or "").rstrip("/")


def _extract_model_content(response_json: dict):
    """Azure Chat Completions 응답에서 모델 텍스트를 추출하고, 가능하면 JSON으로 파싱합니다.

    반환: (raw_text, parsed_json_or_None)
    """
    try:
        choices = response_json.get("choices") or []
        if len(choices) > 0:
            first = choices[0]
            msg = None
            if isinstance(first, dict):
                if "message" in first and isinstance(first["message"], dict):
                    msg = first["message"].get("content")
                elif "text" in first:
                    msg = first.get("text")
            if msg is None:
                msg = str(first)
            raw = msg
            try:
                parsed = json.loads(raw)
                return raw, parsed
            except Exception:
                return raw, None
    except Exception:
        pass
    return "", None


# =========================
# TTS (Text-to-Speech) helpers
# - Azure speech/audio endpoint와 통신합니다.
# - Next.js 클라이언트는 /v1/generate-audio 엔드포인트를 호출합니다 (아래 Next.js-facing 섹션).
# =========================


class TTSRequest(BaseModel):
    text: str


def _build_tts_url_and_model():
    """TTS 엔드포인트 URL과 사용 모델(배포명)을 결정합니다."""
    endpoint = (AZURE_TTS_ENDPOINT or "").strip()
    is_full = ("/openai/deployments/" in endpoint) and ("/audio/speech" in endpoint)
    model_name: Optional[str] = AZURE_TTS_DEPLOYMENT

    if is_full:
        url = endpoint
        if "api-version=" not in url:
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}api-version={AZURE_TTS_API_VERSION}"
        if not model_name:
            m = re.search(r"/deployments/([^/]+)/audio/speech", url)
            if m:
                model_name = m.group(1)
    else:
        if not model_name:
            raise HTTPException(status_code=500, detail="TTS 배포명이 누락되었습니다. AZURE_OPENAI_TTS_DEPLOYMENT_NAME를 설정하세요.")
        base = endpoint.rstrip("/")
        url = f"{base}/openai/deployments/{model_name}/audio/speech?api-version={AZURE_TTS_API_VERSION}"

    return url, model_name


def _call_tts_api(text: str) -> str:
    """Azure TTS를 호출하고 WAV를 base64 data URI로 반환합니다."""
    if not AZURE_TTS_ENDPOINT:
        raise HTTPException(status_code=500, detail="TTS 엔드포인트가 누락되었습니다. AZURE_SPEECH_ENDPOINT를 설정하세요.")
    if not AZURE_TTS_KEY:
        raise HTTPException(status_code=500, detail="TTS API 키가 누락되었습니다. AZURE_SPEECH_KEY를 설정하세요.")

    url, model_name = _build_tts_url_and_model()
    headers = {"Authorization": f"Bearer {AZURE_TTS_KEY}", "Content-Type": "application/json", "Accept": "audio/wav"}
    body = {"model": model_name or "", "voice": AZURE_TTS_VOICE, "input": text}

    resp = requests.post(url, headers=headers, json=body, timeout=120)
    if not resp.ok:
        snippet = ""
        try:
            snippet = resp.text[:500]
        except Exception:
            snippet = "<no-text-body>"
        raise HTTPException(status_code=500, detail=f"Azure OpenAI TTS 실패: status={resp.status_code}, url={url}, body={snippet}")

    audio_bytes = resp.content
    wav_b64 = base64.b64encode(audio_bytes).decode("ascii")
    return f"data:audio/wav;base64,{wav_b64}"


# =========================
# LangChain-based Agent (LLM 래퍼)
# - LangChain의 AzureChatOpenAI 래퍼를 초기화하고, Agent 클래스로 대화 흐름을 관리합니다.
# - Next.js-facing endpoint는 /v1/agent-chat을 사용합니다 (아래).
# =========================


def make_azure_llm() -> AzureChatOpenAI:
    return AzureChatOpenAI(
        azure_deployment=AZURE_DEPLOYMENT,
        azure_endpoint=AZURE_ENDPOINT,
        api_key=AZURE_KEY,
        api_version=AZURE_API_VERSION,
        temperature=0.2,
    )


class Agent:
    """간단한 대화용 에이전트 래퍼

    - system prompt 고정
    - history + current input을 LangChain 체인에 전달
    """

    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.system_prompt = system_prompt
        self.llm = make_azure_llm()
        self.chain: RunnableSerializable = (
            ChatPromptTemplate.from_messages([("system", system_prompt), MessagesPlaceholder("history"), ("human", "{input}")])
            | self.llm
        )

    async def ainvoke(self, *, input: str, history: List[BaseMessage]) -> str:
        result = await self.chain.ainvoke({"input": input, "history": history})
        return getattr(result, "content", str(result))


def build_history(messages: List[dict], system_prefix: Optional[str] = None) -> List[BaseMessage]:
    history: List[BaseMessage] = []
    if system_prefix:
        history.append(SystemMessage(content=system_prefix))
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        if role in ("assistant", "model"):
            history.append(AIMessage(content=content))
        elif role == "system":
            history.append(SystemMessage(content=content))
        else:
            history.append(HumanMessage(content=content))
    return history


AGENTS: Dict[str, Agent] = {
    "tutor": Agent(
        name="tutor",
        system_prompt=(
            "You are a helpful, encouraging tutoring assistant for Korean high school English exams. "
            "Explain step by step in Korean, show key reasoning clearly, and ask guiding questions when helpful."
        ),
    ),
}


class AgentChatRequest(BaseModel):
    agent: Optional[str] = "tutor"
    messages: List[dict]
    context: Optional[Dict[str, Any]] = None
    input: Optional[str] = None
    temperature: Optional[float] = 0.2


class GenericRequest(BaseModel):
    input: dict


# =========================
# Next.js-facing endpoints (public API)
# - 이 영역은 Next.js 프론트엔드에서 호출하는 엔드포인트들을 한데 모아둡니다.
# - 내부적으로 위의 Azure/OpenAI 헬퍼들을 사용합니다.
# =========================


@app.post('/v1/generate-audio')
async def generate_audio(req: TTSRequest):
    """프론트엔드가 호출하는 TTS 엔드포인트

    내부적으로는 _call_tts_api를 호출하여 base64 data-uri 형태의 WAV를 반환합니다.
    """
    try:
        data_uri = _call_tts_api(req.text)
        return {"audioDataUri": data_uri}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS 생성 중 오류: {str(e)}")


@app.post('/v1/agent-chat')
async def agent_chat(req: AgentChatRequest):
    """LangChain 기반 튜터 대화 엔드포인트 (프론트엔드 사용)"""
    agent_name = (req.agent or "tutor").lower()
    agent = AGENTS.get(agent_name)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_name}")

    # context가 주어지면 system 프롬프트 앞에 추가
    system_prefix = None
    if req.context:
        question_ctx = req.context.get("questionContext")
        weakness = req.context.get("weaknessAnalysis")
        parts = []
        if question_ctx:
            parts.append(f"Question context:\n{question_ctx}")
        if weakness:
            parts.append(f"Learner weakness analysis:\n{weakness}")
        if parts:
            system_prefix = "\n\n".join(parts)

    history = build_history(req.messages, system_prefix)
    user_input = req.input
    if not user_input:
        for m in reversed(req.messages):
            if m.get("role") in ("user", "human"):
                user_input = m.get("content")
                break
    user_input = user_input or ""

    if req.temperature is not None and hasattr(agent.llm, "temperature"):
        agent.llm.temperature = float(req.temperature)

    try:
        content = await agent.ainvoke(input=user_input, history=history)
        return {"message": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/v1/generate-similar')
async def generate_similar(req: GenericRequest):
    """간단한 프롬프트를 Azure Chat Completions에 프록시하여 JSON 응답을 반환합니다."""
    try:
        prompt = req.input.get('prompt')
        base = _azure_base()
        url = f"{base}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"
        body = {"messages": [{"role": "user", "content": prompt}], "max_tokens": 512}
        resp = requests.post(url, headers=_azure_headers(), json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        raw, parsed = _extract_model_content(data)
        return parsed if parsed is not None else {"raw": raw}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/v1/conversational-tutor')
async def conversational_tutor(req: GenericRequest):
    """이전 호환용 엔드포인트: 내부적으로 /v1/agent-chat을 호출합니다."""
    try:
        messages = req.input.get('messages') or []
        agent_req = AgentChatRequest(agent="tutor", messages=messages)
        result = await agent_chat(agent_req)  # type: ignore
        return result.get("message", "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/v1/analyze-mistake')
async def analyze_mistake(req: GenericRequest):
    """오답 분석 프록시: 간단히 Azure Chat Completions를 호출합니다."""
    try:
        prompt = req.input.get('prompt')
        base = _azure_base()
        url = f"{base}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"
        body = {"messages": [{"role": "user", "content": prompt}], "max_tokens": 1000}
        resp = requests.post(url, headers=_azure_headers(), json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        raw, parsed = _extract_model_content(data)
        return parsed if parsed is not None else {"raw": raw}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/health')
async def health():
    """간단한 환경 헬스 체크(민감정보 일부 마스킹)"""
    try:
        base = _azure_base()
        return {
            "ok": True,
            "azureEndpoint": base,
            "apiVersion": AZURE_API_VERSION,
            "tts": {
                "deployment": AZURE_TTS_DEPLOYMENT or None,
                "apiVersion": AZURE_TTS_API_VERSION,
                "voice": AZURE_TTS_VOICE,
                "endpoint": (AZURE_TTS_ENDPOINT or "")[:80],
                "keySuffix": (AZURE_TTS_KEY[-4:] if AZURE_TTS_KEY else None),
            },
            "keySuffix": (AZURE_KEY[-4:] if AZURE_KEY else None),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
