from __future__ import annotations

from fastapi import APIRouter, HTTPException
import requests
from pydantic import ValidationError

from ..schemas import GenericRequest, AnalyzeMistakeResult, QuestionOut, AgentChatRequest
from ..services.azure_helpers import azure_base, azure_headers, extract_model_content
from ..services.llm import JSON_ONLY_INSTRUCTIONS
from .agent import agent_chat  # reuse for conversational_tutor


router = APIRouter()


@router.post('/v1/generate-similar')
async def generate_similar(req: GenericRequest):
    try:
        def _prompt_to_text(p):
            if isinstance(p, str):
                return p
            try:
                if isinstance(p, dict):
                    parts = []
                    for key in ("questionContext", "questionText", "topic", "userAnswerText", "userReason", "explanation", "difficulty"):
                        if key in p and p.get(key) is not None:
                            parts.append(f"{key}: {p.get(key)}")
                    if not parts:
                        for k in sorted(p.keys()):
                            parts.append(f"{k}: {p.get(k)}")
                    return "\n".join(parts)
                import json
                return json.dumps(p, ensure_ascii=False)
            except Exception:
                return str(p)

        prompt = _prompt_to_text(req.input.get('prompt'))
        base = azure_base()
        from ..services.config import AZURE_DEPLOYMENT, AZURE_API_VERSION
        url = f"{base}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"
        body = {
            "messages": [
                {"role": "system", "content": JSON_ONLY_INSTRUCTIONS + " Output must conform to the Question schema with fields: id, year, month, intent, topic, questionText, passage, options[{id,text}], correctOptionId, explanation, difficulty(=Easy|Medium|Hard), listeningScript(optional), generationReason(optional)."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 512
        }
        resp = requests.post(url, headers=azure_headers(), json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        raw, parsed = extract_model_content(data)
        if parsed is not None:
            try:
                q = QuestionOut.model_validate(parsed)
                return q.model_dump()
            except ValidationError:
                pass
        return {"raw": raw}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/v1/analyze-mistake')
async def analyze_mistake(req: GenericRequest):
    try:
        def _prompt_to_text(p):
            if isinstance(p, str):
                return p
            try:
                if isinstance(p, dict):
                    parts = []
                    for key in ("questionContext", "questionText", "topic", "userAnswerText", "userReason", "explanation", "difficulty"):
                        if key in p and p.get(key) is not None:
                            parts.append(f"{key}: {p.get(key)}")
                    if not parts:
                        for k in sorted(p.keys()):
                            parts.append(f"{k}: {p.get(k)}")
                    return "\n".join(parts)
                import json
                return json.dumps(p, ensure_ascii=False)
            except Exception:
                return str(p)

        prompt = _prompt_to_text(req.input.get('prompt'))
        base = azure_base()
        from ..services.config import AZURE_DEPLOYMENT, AZURE_API_VERSION
        url = f"{base}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"
        body = {
            "messages": [
                {"role": "system", "content": JSON_ONLY_INSTRUCTIONS + " Output must conform to the AnalyzeMistakeResult schema with fields: weaknessAnalysis, generatedQuestion (Question schema: id, year, month, intent, topic, questionText, passage, options[{id,text}], correctOptionId, explanation, difficulty=Easy|Medium|Hard, listeningScript(optional), generationReason(optional))."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 1000
        }
        resp = requests.post(url, headers=azure_headers(), json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        raw, parsed = extract_model_content(data)
        if parsed is not None:
            try:
                res = AnalyzeMistakeResult.model_validate(parsed)
                return res.model_dump()
            except ValidationError:
                pass
        return {"raw": raw}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/v1/conversational-tutor')
async def conversational_tutor(req: GenericRequest):
    try:
        messages = req.input.get('messages') or []
        agent_req = AgentChatRequest(agent="tutor", messages=messages)
        result = await agent_chat(agent_req)  # reuse agent router logic
        return result.get("message", "")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
