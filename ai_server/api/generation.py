"""
문제 생성 API 라우터

영어 문제 생성 기능을 제공하는 엔드포인트들을 정의합니다.
Azure OpenAI 문제 생성 전용 클라이언트를 직접 사용하여 처리합니다.
"""

from fastapi import APIRouter, HTTPException

from ai_server.core.schemas import GenerationRequest
from ai_server.services.azure_client import AzureQuestionGenerationClient


router = APIRouter(prefix="/v1", tags=["generation"])

# 문제 생성 전용 클라이언트 인스턴스
question_client = AzureQuestionGenerationClient()


@router.post("/generate-similar")
async def generate_similar_question(request: GenerationRequest):
    """
    유사 문제 생성
    
    주어진 문제 정보를 바탕으로 유사한 난이도와 주제의 새로운 문제를 생성합니다.
    문제 생성 전용 Azure OpenAI 클라이언트를 직접 사용하여 처리합니다.
    
    Args:
        request: 문제 생성 요청 데이터
        
    Returns:
        생성된 문제 데이터 또는 원본 응답
    """
    try:
        # 시스템 프롬프트 정의
        system_prompt = """당신은 영어 학습 문제를 생성하는 AI입니다. 
주어진 문제와 유사한 난이도와 주제의 새로운 문제를 생성해주세요.
JSON 형태로 응답해주세요."""
        
        # Azure OpenAI 문제 생성 API 직접 호출
        content, parsed_json = await question_client.generate_question(
            system_prompt=system_prompt,
            user_prompt=request.input,
            max_tokens=1024,
            temperature=0.3
        )
        
        # JSON 파싱이 성공한 경우 구조화된 데이터 반환
        if parsed_json:
            return parsed_json
        else:
            # JSON 파싱 실패시 원본 텍스트 반환
            return {"generated_text": content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"유사 문제 생성 중 오류: {str(e)}")