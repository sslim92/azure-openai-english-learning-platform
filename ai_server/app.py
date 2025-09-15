from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import requests
from typing import List, Literal, Optional, Dict, Any

# LangChain / Azure OpenAI
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableSerializable

load_dotenv()

AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI")
AZURE_API_VERSION = os.getenv('AZURE_OPENAI_API_VERSION')

# Azure Speech (TTS) settings
AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION")

if not AZURE_ENDPOINT or not AZURE_KEY or not AZURE_DEPLOYMENT:
    raise RuntimeError("Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, and an Azure chat deployment (AZURE_OPENAI_CHAT_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT) in .env")

app = FastAPI()

headers = {
    'api-key': AZURE_KEY,
    'Content-Type': 'application/json'
}


def _extract_model_content(response_json: dict):
    """Extract the assistant text from Azure chat/completions response and try to parse JSON.

    Returns (raw_text, parsed_json_or_None)
    """
    # Azure chat completion shape: { choices: [ { message: { role, content } }, ... ] }
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
    # Use Azure Speech REST TTS to generate audio (wav) and return as data URI
    if not AZURE_SPEECH_KEY or not AZURE_SPEECH_REGION:
        raise HTTPException(status_code=500, detail='Azure Speech credentials not set (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)')
    try:
        tts_url = f"https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
        tts_headers = {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm'
        }
        # Simple SSML with default voice; in production allow config
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
# LangChain Agent machinery
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
    """Simple chat agent wrapper around AzureChatOpenAI with pluggable system prompts."""

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
        # result is a ChatMessage
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


# Agent registry
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

    # Apply temperature if provided
    if req.temperature is not None and hasattr(agent.llm, "temperature"):
        agent.llm.temperature = float(req.temperature)

    try:
        content = await agent.ainvoke(input=user_input, history=history)
        return {"message": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/v1/generate-similar')
async def generate_similar(req: GenericRequest):
    # proxy example to completions - replace with chat completions if needed
    try:
        prompt = req.input.get('prompt')
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
        body = {"messages": [{"role":"user","content": prompt}], "max_tokens": 512}
        resp = requests.post(url, headers=headers, json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        raw, parsed = _extract_model_content(data)
        return parsed if parsed is not None else { 'raw': raw }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/v1/conversational-tutor')
async def conversational_tutor(req: GenericRequest):
    """Backward-compatible endpoint that proxies to the tutor agent using LangChain."""
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
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
        body = {"messages": [{"role":"user","content": prompt}], "max_tokens": 1000}
        resp = requests.post(url, headers=headers, json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        raw, parsed = _extract_model_content(data)
        return parsed if parsed is not None else { 'raw': raw }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
