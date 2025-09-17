"""
TTS(텍스트 음성 변환) 라우터

텍스트를 음성으로 변환하는 기능을 제공하는 엔드포인트를 정의합니다.
"""

from fastapi import APIRouter, HTTPException

from ..schemas import TTSRequest
from ..services.tts import synthesize_to_wav_data_uri


router = APIRouter()


@router.post('/v1/generate-audio')
async def generate_audio(req: TTSRequest):
    """
    텍스트를 음성으로 변환하는 엔드포인트
    
    Args:
        req: TTS 요청 데이터 (변환할 텍스트 포함)
        
    Returns:
        WAV 오디오 데이터 URI
    """
    try:
        # 입력 텍스트 검증
        if not req.text.strip():
            raise HTTPException(status_code=400, detail="변환할 텍스트가 비어있습니다.")
        
        # TTS 서비스를 통해 음성 변환
        data_uri = synthesize_to_wav_data_uri(req.text)
        return {"audioDataUri": data_uri}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS 생성 중 오류: {str(e)}")
