"""
문제 생성 API 라우터

영어 문제 생성 및 오답 분석 기능을 제공하는 엔드포인트들을 정의합니다.
"""

from fastapi import APIRouter, HTTPException

from ..core.schemas import GenerationRequest
from ..services.question_service import question_service


router = APIRouter(prefix="/v1", tags=["generation"])


@router.post("/generate-similar")
async def generate_similar_question(request: GenerationRequest):
    """
    유사 문제 생성
    
    주어진 문제 정보를 바탕으로 유사한 난이도와 주제의 새로운 문제를 생성합니다.
    
    Args:
        request: 문제 생성 요청 데이터
        
    Returns:
        생성된 문제 데이터 또는 원본 응답
    """
    try:
        result = await question_service.generate_similar_question(request.input)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"유사 문제 생성 중 오류: {str(e)}")


@router.post("/analyze-mistake")
async def analyze_mistake(request: GenerationRequest):
    """
    오답 분석 및 맞춤 문제 생성
    
    학습자의 오답을 분석하여 약점을 파악하고, 
    해당 약점을 보완할 수 있는 맞춤형 문제를 생성합니다.
    
    Args:
        request: 오답 분석 요청 데이터
        
    Returns:
        약점 분석 결과 및 생성된 문제 데이터
    """
    try:
        result = await question_service.analyze_mistake(request.input)
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"오답 분석 중 오류: {str(e)}")