"""
ai_server/app.py

프로젝트에서 사용하는 FastAPI 백엔드. 아래의 핵심 기능을 제공합니다.
- /v1/agent-chat: LangChain 기반 튜터 대화
- /v1/conversational-tutor: 이전 호환용(내부적으로 /v1/agent-chat 위임)
- /v1/generate-similar: 유사 문제 생성(REST 프록시)
- /v1/analyze-mistake: 오답 분석(REST 프록시)
- /v1/generate-audio: Azure Speech TTS

주의 사항
- 현재 구조는 import 시점에 필수 Azure OpenAI 환경변수가 없으면 예외를 던집니다.
    (이미 환경이 준비된 운영/개발 환경을 가정합니다.)
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import requests
from typing import List, Optional, Dict, Any

# LangChain / Azure OpenAI
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableSerializable

load_dotenv()  # .env 파일 로드(있을 경우)

# Azure OpenAI 설정(필수)
AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI")
# API 버전이 지정되지 않았다면, 프록시 호출에서 사용하는 기본값을 그대로 활용합니다.
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION") or "2024-06-01"

# Azure Speech (TTS) 설정(선택)
AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION")

if not AZURE_ENDPOINT or not AZURE_KEY or not AZURE_DEPLOYMENT:
    # 실행 환경을 명확히 안내하는 에러 메시지
    raise RuntimeError(
        "Azure OpenAI 설정이 누락되었습니다. 필수 환경변수: "
        "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY(또는 AZURE_OPENAI_KEY), AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI"
    )

app = FastAPI()

# 공통 HTTP 헤더 생성 함수(REST 프록시 엔드포인트에서 사용)
def _azure_headers() -> Dict[str, str]:
    return {
        "api-key": AZURE_KEY,
        "Content-Type": "application/json",
    }


def _extract_model_content(response_json: dict):
    """
    Azure Chat Completions 응답에서 모델 텍스트를 추출하고, 가능하면 JSON으로 파싱합니다.
    반환값: (원문 텍스트, 파싱된 JSON 또는 None)
    """
    # Azure chat completion 응답 형태: { choices: [ { message: { role, content } }, ... ] }
    try:
        choices = response_json.get('choices') or []
        if len(choices) > 0:
            first = choices[0]
            # Support both message.content and text
            msg = None
            if isinstance(first, dict):
                if 'message' in first and isinstance(first['message'], dict):
                    msg = first['message'].get('content')
                elif 'text' in first:
                    msg = first.get('text')
            if msg is None:
                # fallback: try to stringify the whole choice
                msg = str(first)
            raw = msg
            # try to parse JSON from the model output
            import json
            try:
                parsed = json.loads(raw)
                return raw, parsed
            except Exception:
                return raw, None
    except Exception:
        pass
    return '', None

class TTSRequest(BaseModel):
    text: str

@app.post('/v1/generate-audio')
async def generate_audio(req: TTSRequest):
    # Azure Speech REST TTS를 사용해 오디오(WAV)를 생성하고 data URI로 반환합니다.
    if not AZURE_SPEECH_KEY or not AZURE_SPEECH_REGION:
        raise HTTPException(status_code=500, detail='Azure Speech credentials not set (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)')
    try:
        tts_url = f"https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
        tts_headers = {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm'
        }
        # 단순 SSML(기본 음성). 필요 시 환경변수/요청 파라미터로 음성 선택을 확장할 수 있습니다.
        ssml = f"""<speak version='1.0' xml:lang='en-US'>
  <voice xml:lang='en-US' xml:gender='Female' name='en-US-AriaNeural'>
    {req.text}
  </voice>
</speak>"""
        resp = requests.post(tts_url, headers=tts_headers, data=ssml.encode('utf-8'), timeout=60)
        resp.raise_for_status()
        audio_bytes = resp.content
        import base64
        wav_b64 = base64.b64encode(audio_bytes).decode('ascii')
        data_uri = f"data:audio/wav;base64,{wav_b64}"
        return {"audioDataUri": data_uri}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GenericRequest(BaseModel):
    input: dict


# =========================
# LangChain 튜터 에이전트 구성
# =========================

def make_azure_llm() -> AzureChatOpenAI:
    """Azure OpenAI Chat LLM 인스턴스 생성(튜터 에이전트에서 사용)."""
    return AzureChatOpenAI(
        azure_deployment=AZURE_DEPLOYMENT,
        azure_endpoint=AZURE_ENDPOINT,
        api_key=AZURE_KEY,
        api_version=AZURE_API_VERSION,
        temperature=0.2,
    )


class Agent:
    """AzureChatOpenAI 위에 얹은 간단한 대화용 에이전트 래퍼.

    - system 프롬프트를 주입하여 역할/톤을 고정
    - 대화 이력(history) + 현재 입력을 LangChain 체인에 전달
    """

    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.system_prompt = system_prompt
        self.llm = make_azure_llm()
        self.chain: RunnableSerializable = (
            ChatPromptTemplate.from_messages(
                [
                    ("system", system_prompt),
                    MessagesPlaceholder("history"),
                    ("human", "{input}"),
                ]
            )
            | self.llm
        )

    async def ainvoke(self, *, input: str, history: List[BaseMessage]) -> str:
            result = await self.chain.ainvoke({"input": input, "history": history})
            # result는 LangChain ChatMessage로, content 속성에 문자열이 담깁니다.
            return getattr(result, "content", str(result))


def build_history(messages: List[dict], system_prefix: Optional[str] = None) -> List[BaseMessage]:
    """프론트에서 전달한 메시지 배열을 LangChain 메시지 객체 목록으로 변환.

    - system_prefix가 존재하면 첫 system 메시지로 주입(컨텍스트/약점 등)
    - role 매핑: user/human -> HumanMessage, assistant/model -> AIMessage, system -> SystemMessage
    """
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


# 에이전트 레지스트리(필요 시 다중 에이전트로 확장 가능)
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
    input: Optional[str] = None  # Optional new user input; if omitted, last messages[-1] is used
    temperature: Optional[float] = 0.2


@app.post('/v1/agent-chat')
async def agent_chat(req: AgentChatRequest):
    agent_name = (req.agent or "tutor").lower()
    agent = AGENTS.get(agent_name)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_name}")

    # optional contextual system prefix
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
    # Determine current user input
    user_input = req.input
    if not user_input:
        # try to infer from last human message
        for m in reversed(req.messages):
            if m.get("role") in ("user", "human"):
                user_input = m.get("content")
                break
    user_input = user_input or ""

    # 요청 시 temperature를 조정할 수 있습니다(기본 0.2)
    if req.temperature is not None and hasattr(agent.llm, "temperature"):
        agent.llm.temperature = float(req.temperature)

    try:
        content = await agent.ainvoke(input=user_input, history=history)
        return {"message": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/v1/generate-similar')
async def generate_similar(req: GenericRequest):
    # Azure OpenAI Chat Completions 프록시(간단한 프롬프트 → 답변/문항 JSON)
    try:
        prompt = req.input.get('prompt')
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"
        body = {"messages": [{"role":"user","content": prompt}], "max_tokens": 512}
        resp = requests.post(url, headers=_azure_headers(), json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        raw, parsed = _extract_model_content(data)
        return parsed if parsed is not None else { 'raw': raw }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/v1/conversational-tutor')
async def conversational_tutor(req: GenericRequest):
    """이전 호환용 엔드포인트: 내부적으로 /v1/agent-chat을 호출합니다."""
    try:
        messages = req.input.get('messages') or []
        # direct call to agent-chat
        agent_req = AgentChatRequest(agent="tutor", messages=messages)
        result = await agent_chat(agent_req)  # type: ignore
        # return plain text for existing frontend expectations
        return result.get("message", "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Removed PDF-related endpoints (/v1/extract-questions, /v1/match-scripts)

@app.post('/v1/analyze-mistake')
async def analyze_mistake(req: GenericRequest):
    try:
        prompt = req.input.get('prompt')
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"
        body = {"messages": [{"role":"user","content": prompt}], "max_tokens": 1000}
        resp = requests.post(url, headers=_azure_headers(), json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        raw, parsed = _extract_model_content(data)
        return parsed if parsed is not None else { 'raw': raw }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
