"""
문제 생성 API 라우터

영어 문제 생성 기능을 제공하는 엔드포인트들을 정의합니다.
유사 문제 생성은 별도의 AI 모델을 사용하여 처리합니다.
"""

from fastapi import APIRouter, HTTPException

from ai_server.core.schemas import GenerationRequest
from ai_server.services.agent_service import agent_manager


router = APIRouter(prefix="/v1", tags=["generation"])


@router.post("/generate-similar")
async def generate_similar_question(request: GenerationRequest):
    """
    유사 문제 생성
    
    주어진 문제 정보를 바탕으로 유사한 난이도와 주제의 새로운 문제를 생성합니다.
    이 기능은 일반 챗봇과는 다른 전용 모델을 사용합니다.
    
    Args:
        request: 문제 생성 요청 데이터
        
    Returns:
        생성된 문제 데이터 또는 원본 응답
    """
    try:
        # 통합된 agent_service를 통한 문제 생성
        result = await agent_manager.generate_question({
            "type": "similar_question",
            "input": request.input
        })
        return {"message": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"유사 문제 생성 중 오류: {str(e)}")