from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import TTSRequest
from ..services.tts import synthesize_to_wav_data_uri


router = APIRouter()


@router.post('/v1/generate-audio')
async def generate_audio(req: TTSRequest):
    try:
        data_uri = synthesize_to_wav_data_uri(req.text)
        return {"audioDataUri": data_uri}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS 생성 중 오류: {str(e)}")
