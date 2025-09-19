"""
TTS(텍스트 음성 변환) API 라우터

텍스트를 음성으로 변환하는 기능을 제공하는 엔드포인트를 정의합니다.
Azure TTS 클라이언트를 직접 사용하여 처리합니다.
"""

from fastapi import APIRouter, HTTPException

from ai_server.core.schemas import TTSRequest
from ai_server.services.azure_client import AzureTTSClient


router = APIRouter(prefix="/v1", tags=["tts"])

# TTS 클라이언트 인스턴스
tts_client = AzureTTSClient()


@router.post("/generate-audio")
async def generate_audio(request: TTSRequest):
    """
    텍스트 음성 변환
    
    주어진 텍스트를 음성으로 변환하여 WAV 오디오 데이터 URI를 반환합니다.
    Azure TTS 클라이언트를 직접 사용하여 처리합니다.
    
    Args:
        request: TTS 요청 데이터 (변환할 텍스트 포함)
        
    Returns:
        WAV 오디오 데이터 URI
    """
    try:
        # 텍스트가 비어있는지 확인
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="변환할 텍스트가 비어있습니다.")
        
        # Azure TTS 클라이언트를 통해 직접 음성 변환
        audio_data_uri = tts_client.synthesize_speech(request.text)
        
        return {"audioDataUri": audio_data_uri}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"음성 생성 중 오류: {str(e)}")