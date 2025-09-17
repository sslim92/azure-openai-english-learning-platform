"""
맞춤 해설 생성 API 엔드포인트

문제의 오답에 대한 개인화된 해설을 생성하는 API를 제공합니다.
"""

from fastapi import APIRouter, HTTPException
from ai_server.core.schemas import ExplanationRequest, ExplanationResponse
from ai_server.services.explanation_service import ExplanationService
from ai_server.services.azure_client import AzureOpenAIClient

router = APIRouter()

# 전역 서비스 인스턴스
azure_client = AzureOpenAIClient()
explanation_service = ExplanationService(azure_client)


@router.post("/custom-explanation", response_model=ExplanationResponse)
async def generate_custom_explanation(request: ExplanationRequest):
    """
    문제의 오답에 대한 맞춤 해설을 생성합니다.
    
    Args:
        request: 맞춤 해설 생성 요청 데이터
        
    Returns:
        AI가 생성한 맞춤 해설
    """
    try:
        custom_explanation = await explanation_service.generate_custom_explanation(
            question_text=request.questionText,
            passage=request.passage,
            options=request.options,
            correct_option_id=request.correctOptionId,
            selected_option_id=request.selectedOptionId,
            explanation=request.explanation
        )
        
        return ExplanationResponse(customExplanation=custom_explanation)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"맞춤 해설 생성 중 오류 발생: {str(e)}")