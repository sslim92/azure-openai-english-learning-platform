"""ai_server/services/config.py

환경 변수와 공통 설정을 한 곳에서 관리합니다.
이 모듈이 임포트되는 시점에 .env를 로드하고 필수 값 유효성 검사를 수행합니다.
"""

from __future__ import annotations

import os
from dotenv import load_dotenv


# .env 로드
load_dotenv()


# Azure OpenAI (Chat)
AZURE_ENDPOINT: str | None = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_KEY: str | None = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_DEPLOYMENT: str | None = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI")
AZURE_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION") or "2024-06-01"

# Azure Speech / TTS
AZURE_TTS_DEPLOYMENT: str | None = os.getenv("AZURE_OPENAI_TTS_DEPLOYMENT_NAME")
AZURE_TTS_API_VERSION: str = os.getenv("AZURE_OPENAI_TTS_API_VERSION") or "2025-03-01-preview"
AZURE_TTS_VOICE: str = os.getenv("AZURE_OPENAI_TTS_VOICE") or "alloy"
AZURE_TTS_KEY: str | None = os.getenv("AZURE_SPEECH_KEY")
AZURE_TTS_ENDPOINT: str | None = os.getenv("AZURE_SPEECH_ENDPOINT")


if not AZURE_ENDPOINT or not AZURE_KEY or not AZURE_DEPLOYMENT:
    raise RuntimeError(
        "Azure OpenAI 설정이 누락되었습니다. 필수 환경변수: "
        "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI"
    )
