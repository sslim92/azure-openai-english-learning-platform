"""
Azure TTS(텍스트 음성 변환) 서비스

Azure OpenAI Audio API를 사용하여 텍스트를 음성으로 변환하는 기능을 제공합니다.
WAV 형식의 오디오 데이터 URI를 생성합니다.
"""

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
    """
    TTS API URL과 모델명 구성
    
    엔드포인트 설정에 따라 전체 URL을 구성하거나 모델명을 추출합니다.
    
    Returns:
        (완성된 API URL, 모델명)
    """
    endpoint = (AZURE_TTS_ENDPOINT or "").strip()
    model_name: Optional[str] = AZURE_TTS_DEPLOYMENT
    
    # 전체 URL이 이미 제공된 경우 (deployments와 audio/speech 포함)
    is_full_url = ("/openai/deployments/" in endpoint) and ("/audio/speech" in endpoint)

    if is_full_url:
        url = endpoint
        # API 버전 파라미터 추가 (없는 경우)
        if "api-version=" not in url:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}api-version={AZURE_TTS_API_VERSION}"
        
        # URL에서 모델명 추출 (배포명이 없는 경우)
        if not model_name:
            match = re.search(r"/deployments/([^/]+)/audio/speech", url)
            if match:
                model_name = match.group(1)
    else:
        # URL 조립 필요
        if not model_name:
            raise HTTPException(
                status_code=500, 
                detail="TTS 배포명이 누락되었습니다. AZURE_OPENAI_TTS_DEPLOYMENT_NAME를 설정하세요."
            )
        
        base_url = endpoint.rstrip("/")
        url = f"{base_url}/openai/deployments/{model_name}/audio/speech?api-version={AZURE_TTS_API_VERSION}"

    return url, model_name


def synthesize_to_wav_data_uri(text: str) -> str:
    """
    텍스트를 WAV 오디오 데이터 URI로 변환
    
    Azure OpenAI TTS API를 사용하여 텍스트를 음성으로 변환하고,
    결과를 Base64로 인코딩된 데이터 URI로 반환합니다.
    
    Args:
        text: 음성으로 변환할 텍스트
        
    Returns:
        WAV 오디오 데이터 URI (data:audio/wav;base64,...)
        
    Raises:
        HTTPException: API 호출 실패 또는 설정 오류시
    """
    # 필수 설정값 검증
    if not AZURE_TTS_ENDPOINT:
        raise HTTPException(
            status_code=500, 
            detail="TTS 엔드포인트가 누락되었습니다. AZURE_SPEECH_ENDPOINT를 설정하세요."
        )
    if not AZURE_TTS_KEY:
        raise HTTPException(
            status_code=500, 
            detail="TTS API 키가 누락되었습니다. AZURE_SPEECH_KEY를 설정하세요."
        )

    try:
        # API URL과 모델명 구성
        url, model_name = _build_tts_url_and_model()
        
        # 요청 헤더 구성
        headers = {
            "Authorization": f"Bearer {AZURE_TTS_KEY}",
            "Content-Type": "application/json",
            "Accept": "audio/wav",
        }
        
        # 요청 본문 구성
        body = {
            "model": model_name or "",
            "voice": AZURE_TTS_VOICE,
            "input": text
        }

        # API 호출
        response = requests.post(url, headers=headers, json=body, timeout=120)
        
        if not response.ok:
            error_snippet = response.text[:500] if hasattr(response, "text") else "<응답 본문 없음>"
            raise HTTPException(
                status_code=500, 
                detail=f"Azure OpenAI TTS API 호출 실패: "
                       f"상태코드={response.status_code}, URL={url}, 오류={error_snippet}"
            )

        # 오디오 데이터를 Base64로 인코딩하여 데이터 URI 생성
        audio_bytes = response.content
        audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
        return f"data:audio/wav;base64,{audio_base64}"

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS 변환 중 예상치 못한 오류: {str(e)}")
