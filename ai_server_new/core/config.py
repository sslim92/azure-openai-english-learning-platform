"""
환경설정 모듈

Azure OpenAI 및 TTS 서비스 연결에 필요한 설정값들을 관리합니다.
환경변수를 로드하고 필수값 검증을 수행합니다.
"""

import os
from dotenv import load_dotenv

# 환경변수 파일(.env) 로드
load_dotenv()

# Azure OpenAI 채팅 서비스 설정
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY") 
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")

# Azure TTS(음성합성) 서비스 설정
AZURE_TTS_ENDPOINT = os.getenv("AZURE_SPEECH_ENDPOINT")
AZURE_TTS_API_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_TTS_DEPLOYMENT = os.getenv("AZURE_OPENAI_TTS_DEPLOYMENT_NAME")
AZURE_TTS_API_VERSION = os.getenv("AZURE_OPENAI_TTS_API_VERSION", "2025-03-01-preview")
AZURE_TTS_VOICE = os.getenv("AZURE_OPENAI_TTS_VOICE", "alloy")

# 필수 설정값 검증
def validate_config():
    """필수 환경변수가 설정되어 있는지 확인합니다."""
    missing_vars = []
    
    if not AZURE_OPENAI_ENDPOINT:
        missing_vars.append("AZURE_OPENAI_ENDPOINT")
    if not AZURE_OPENAI_API_KEY:
        missing_vars.append("AZURE_OPENAI_API_KEY") 
    if not AZURE_OPENAI_DEPLOYMENT:
        missing_vars.append("AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI")
        
    if missing_vars:
        raise RuntimeError(
            f"필수 환경변수가 누락되었습니다: {', '.join(missing_vars)}"
        )

# 초기화 시 설정값 검증 수행
validate_config()