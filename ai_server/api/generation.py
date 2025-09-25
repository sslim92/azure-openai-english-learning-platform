"""
문제 생성 API 라우터

영어 문제 생성 기능을 제공하는 엔드포인트들을 정의합니다.
Azure OpenAI 문제 생성 전용 클라이언트를 직접 사용하여 처리합니다.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from ai_server.core.schemas import GenerationRequest, ChatHistoryExtractionRequest
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
        생성된 문제 데이터 (JSON 형식)
    """
    try:
        # 시스템 프롬프트 - 데이터베이스 필수 필드 강조
        system_prompt = """당신은 영어 문제를 생성하는 AI입니다.
응답은 반드시 다음 JSON 형식으로만 해주세요.

{
    "id": "ai-[타임스탬프(유닉스형식)]-[3자리 숫자 난수]",
    "year": null,
    "month": null,
    "intent": "문제 유형 (예: Reading Comprehension, Listening, Grammar 등)",
    "topic": "주제 (예: Daily Life, Science, History 등)",
    "questionText": "문제 지시문 (반드시 포함)",
    "passage": "영어 지문 (듣기 문제가 아닌 경우 반드시 포함, 듣기 문제면 빈 문자열)",
    "options": [
        {"id": "a", "text": "선택지 1"},
        {"id": "b", "text": "선택지 2"}, 
        {"id": "c", "text": "선택지 3"},
        {"id": "d", "text": "선택지 4"},
        {"id": "e", "text": "선택지 5"}
    ],
    "correctOptionId": "정답 번호 (a-e)",
    "explanation": "정답 해설 (반드시 포함)",
    "difficulty": "난이도 (Easy, Medium, Hard 중 하나)",
    "listeningScript": "",
    "generationReason": "두 문장만 작성하세요. {{weakness}}을 겨냥해 {{design_features}}로 보완하도록 설계했습니다. 이를 통해 {{target_skill}}이 강화되고 {{expected_outcome}}이/가 향상됩니다."
}

다른 설명 없이 JSON만 응답하세요."""
        
        # 입력 데이터를 구조화된 프롬프트로 변환
        input_data = request.input
        if isinstance(input_data, dict):
            # prompt 키가 있는 경우 (기존 방식)
            if "prompt" in input_data:
                prompt_data = input_data["prompt"]
            else:
                prompt_data = input_data
            
            # 원본 문제 정보 추출
            topic = prompt_data.get('topic', 'N/A')
            difficulty = prompt_data.get('difficulty', 'Medium')
            question_text = prompt_data.get('questionText', 'N/A')
            correct_option = prompt_data.get('correctOptionId', 'N/A')
            explanation = prompt_data.get('explanation', 'N/A')
            
            # 오답 분석 기반 생성인지 확인 (explanation에 "약점 분석"이 포함된 경우)
            is_weakness_based = "약점 분석" in explanation
            
            # 사용자 프롬프트 간소화
            user_prompt = f"""원본 문제: {topic} 주제, {difficulty} 난이도
문제 유형: {question_text}

유사한 새로운 영어 문제를 JSON 형식으로 생성해주세요."""
        else:
            user_prompt = str(input_data)
        
        # Azure OpenAI 문제 생성 API 직접 호출
        content, parsed_json = await question_client.generate_question(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=5000,  # 토큰 수 증가
            temperature=1     # Azure OpenAI gpt-5-test는 temperature=1만 지원
        )
        
        # JSON 파싱이 성공한 경우 구조화된 데이터 반환
        if parsed_json:
            return parsed_json
        else:
            # JSON 파싱 실패시 원본 텍스트 반환
            return {"generated_text": content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"유사 문제 생성 중 오류: {str(e)}")


@router.post("/extract-mistake-reason")
async def extract_mistake_reason(request: ChatHistoryExtractionRequest):
    """
    대화 내역에서 오답 이유 추출
    
    사용자와 AI 간의 대화 내역을 분석하여 사용자가 오답을 선택한 이유를
    한두 문장으로 요약해서 추출합니다.
    
    Args:
        request: 대화 내역 추출 요청 데이터
        
    Returns:
        추출된 오답 이유 문장
    """
    try:
        # 대화 내역을 문자열로 변환
        chat_content = ""
        for message in request.chatHistory:
            role = message.get('role', '')
            content = message.get('content', '')
            if role and content:
                speaker = "사용자" if role in ['user', 'human'] else "AI 멘토"
                chat_content += f"{speaker}: {content}\n"
        
        # 오답 이유 추출을 위한 시스템 프롬프트
        system_prompt = """당신은 학습자의 대화 내역을 분석하여 오답 선택 이유를 추출하는 AI입니다.

## 분석 목표:
사용자와 AI 멘토 간의 대화에서 사용자가 특정 오답을 선택한 이유나 사고 과정을 파악하고, 
이를 1-2문장으로 간결하게 요약해주세요.

## 추출 기준:
1. 사용자가 직접 언급한 선택 이유나 사고 과정
2. 사용자의 질문이나 응답에서 드러나는 오개념이나 혼동
3. 문제 해석 과정에서 나타난 이해 부족 부분
4. 특정 어휘나 문법에 대한 잘못된 이해

## 응답 형식:
간결하고 명확한 1-2문장으로 작성하되, 교육적 관점에서 학습자의 약점을 정확히 지적해주세요.
만약 대화에서 명확한 이유를 찾을 수 없다면 "대화 내용으로는 구체적인 오답 이유를 파악하기 어려움"이라고 응답하세요."""

        # 사용자 프롬프트 구성
        user_prompt = f"""
## 문제 정보:
- 문제: {request.questionText}
- 사용자가 선택한 오답: {request.selectedOptionText}
- 정답: {request.correctOptionText}

## 대화 내역:
{chat_content}

위 대화 내역을 분석하여 사용자가 "{request.selectedOptionText}"를 선택한 이유를 1-2문장으로 요약해주세요.
"""

        # Azure OpenAI API 호출
        content, parsed_json = await question_client.generate_question(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=1000,  # 토큰 제한을 늘려서 응답이 잘리지 않도록 함
            temperature=1  # 해당 모델에서 기본값 1만 지원
        )
        
        # 응답 정리 (JSON이 아닌 텍스트 응답 예상)
        print(f"DEBUG - Raw content: {repr(content)}")  # 디버깅용 로깅
        print(f"DEBUG - Parsed JSON: {repr(parsed_json)}")  # 디버깅용 로깅
        
        extracted_reason = content.strip() if content else "응답을 받지 못했습니다."
        
        # 불필요한 따옴표나 마크다운 제거
        if extracted_reason.startswith('"') and extracted_reason.endswith('"'):
            extracted_reason = extracted_reason[1:-1]
        
        return {
            "success": True,
            "extractedReason": extracted_reason
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"오답 이유 추출 중 오류: {str(e)}")