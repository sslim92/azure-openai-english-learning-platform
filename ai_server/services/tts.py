"""ai_server/services/tts.py

Azure Audio(Speech) API를 호출하여 텍스트를 WAV 오디오로 변환.
"""
from __future__ import annotations

import base64
import re
from typing import Optional, Tuple

import requests
from fastapi import HTTPException

from .config import (
    AZURE_TTS_ENDPOINT,
    AZURE_TTS_KEY,
    AZURE_TTS_API_VERSION,
    AZURE_TTS_DEPLOYMENT,
    AZURE_TTS_VOICE,
)


def _build_tts_url_and_model() -> Tuple[str, Optional[str]]:
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


def synthesize_to_wav_data_uri(text: str) -> str:
    if not AZURE_TTS_ENDPOINT:
        raise HTTPException(status_code=500, detail="TTS 엔드포인트가 누락되었습니다. AZURE_SPEECH_ENDPOINT를 설정하세요.")
    if not AZURE_TTS_KEY:
        raise HTTPException(status_code=500, detail="TTS API 키가 누락되었습니다. AZURE_SPEECH_KEY를 설정하세요.")

    url, model_name = _build_tts_url_and_model()
    headers = {
        "Authorization": f"Bearer {AZURE_TTS_KEY}",
        "Content-Type": "application/json",
        "Accept": "audio/wav",
    }
    body = {"model": model_name or "", "voice": AZURE_TTS_VOICE, "input": text}

    resp = requests.post(url, headers=headers, json=body, timeout=120)
    if not resp.ok:
        snippet = resp.text[:500] if hasattr(resp, "text") else "<no-text-body>"
        raise HTTPException(status_code=500, detail=f"Azure OpenAI TTS 실패: status={resp.status_code}, url={url}, body={snippet}")

    audio_bytes = resp.content
    wav_b64 = base64.b64encode(audio_bytes).decode("ascii")
    return f"data:audio/wav;base64,{wav_b64}"
