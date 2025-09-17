"""
TTS(텍스트 음성 변환) API 라우터

텍스트를 음성으로 변환하는 기능을 제공하는 엔드포인트를 정의합니다.
"""

from fastapi import APIRouter, HTTPException

from core.schemas import TTSRequest
from services.tts_service import tts_service


router = APIRouter(prefix="/v1", tags=["tts"])


@router.post("/generate-audio")
async def generate_audio(request: TTSRequest):
    """
    텍스트 음성 변환
    
    주어진 텍스트를 음성으로 변환하여 WAV 오디오 데이터 URI를 반환합니다.
    
    Args:
        request: TTS 요청 데이터 (변환할 텍스트 포함)
        
    Returns:
        WAV 오디오 데이터 URI
    """
    try:
        # 텍스트가 비어있는지 확인
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="변환할 텍스트가 비어있습니다.")
        
        # TTS 서비스를 통해 음성 변환
        audio_data_uri = tts_service.text_to_speech(request.text)
        
        return {"audioDataUri": audio_data_uri}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"음성 생성 중 오류: {str(e)}")