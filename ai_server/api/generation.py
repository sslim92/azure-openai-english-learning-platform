"""
문제 생성 API 라우터

영어 문제 생성 기능을 제공하는 엔드포인트들을 정의합니다.
문제 생성 전용 서비스를 사용하여 처리합니다.
"""

from fastapi import APIRouter, HTTPException

from ai_server.core.schemas import GenerationRequest
from ai_server.services.question_service import question_service


router = APIRouter(prefix="/v1", tags=["generation"])


@router.post("/generate-similar")
async def generate_similar_question(request: GenerationRequest):
    """
    유사 문제 생성
    
    주어진 문제 정보를 바탕으로 유사한 난이도와 주제의 새로운 문제를 생성합니다.
    문제 생성 전용 서비스를 사용하여 처리합니다.
    
    Args:
        request: 문제 생성 요청 데이터
        
    Returns:
        생성된 문제 데이터 또는 원본 응답
    """
    try:
        # 문제 생성 전용 서비스 사용
        result = await question_service.generate_similar_question({
            "prompt": request.input
        })
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"유사 문제 생성 중 오류: {str(e)}")