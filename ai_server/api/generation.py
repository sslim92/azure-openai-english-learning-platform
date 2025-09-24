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
        생성된 문제 데이터 또는 원본 응답
    """
    try:
        # 시스템 프롬프트 정의 - 영어 문제 생성에 특화
        system_prompt = """당신은 한국 수능 영어 문제를 생성하는 전문 AI입니다. 
메기스터디 플랫폼을 위해 고품질의 영어 학습 문제를 생성합니다.

## 생성 원칙:
1. 원본 문제와 유사한 난이도와 주제를 유지하되, 완전히 새로운 내용으로 구성
2. 수능 영어 출제 스타일과 패턴을 엄격히 준수  
3. 문법적으로 정확하고 자연스러운 영어 사용
4. 한국 고등학생 수준에 적합한 어휘와 표현 사용
5. 선택지는 정답 1개, 오답 4개로 구성하며 오답은 그럴듯하되 명확히 틀린 내용

## 문제 유형별 가이드:
- **빈칸추론**: 논리적 흐름과 문맥을 고려한 적절한 어휘/구문
- **빈칸추론(문장)**: 전체 글의 논리적 구조에 맞는 연결 문장
- **글의순서**: 시간순/논리순으로 자연스러운 배열
- **문장삽입**: 글의 흐름을 해치지 않는 적절한 위치
- **제목추론**: 글의 핵심 주제를 포괄하는 제목
- **요약문**: 글의 핵심 내용을 압축한 요약

## 필수 JSON 응답 형식:
{
    "id": "ai-generated-[현재타임스탬프]-[랜덤ID]",
    "year": null,
    "month": null,  
    "intent": "[문제 의도 - 예: 빈칸추론, 글의순서, 제목추론 등]",
    "topic": "[구체적 주제 - 예: 환경보호, 기술발전, 인간관계 등]",
    "questionText": "[문제 지시문]",
    "passage": "[영어 지문 - 100-200단어 내외]",
    "options": [
        {"id": "1", "text": "[선택지 1]"},
        {"id": "2", "text": "[선택지 2]"}, 
        {"id": "3", "text": "[선택지 3]"},
        {"id": "4", "text": "[선택지 4]"},
        {"id": "5", "text": "[선택지 5]"}
    ],
    "correctOptionId": "[정답 선택지 ID]",
    "explanation": "[상세 해설 - 정답 근거와 오답 분석 포함]",
    "difficulty": "[Easy|Medium|Hard]",
    "listeningScript": null,
    "generationReason": "[생성 목적과 학습 효과 설명]"
}

반드시 완전한 JSON 형태로만 응답하세요."""
        
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
            
            # 문제 유형별 특화 프롬프트 생성
            user_prompt = f"""
## 원본 문제 분석:
- **문제 유도/주제**: {topic}
- **난이도**: {difficulty}  
- **문제 지시문**: {question_text}
- **정답**: {correct_option}번
- **원본 해설**: {explanation}

## 생성 요구사항:
{f"이 문제는 학습자의 약점을 보완하기 위한 맞춤형 문제입니다. " if is_weakness_based else ""}
위 원본 문제와 **동일한 문제 유형과 난이도**로 **완전히 새로운 영어 문제**를 생성해주세요.

### 세부 지침:
1. **문제 유형**: 원본과 동일한 유형 (빈칸추론, 글의순서, 제목추론 등)
2. **난이도**: {difficulty} 수준 유지
3. **주제**: {topic}와 관련되되 새로운 소재 사용
4. **지문**: 원본과 다른 완전히 새로운 영어 텍스트 (100-200단어)
5. **선택지**: 정답 1개, 그럴듯한 오답 4개
6. **해설**: 정답 근거와 각 오답이 틀린 이유 명시

원본 문제의 내용을 직접 복사하지 말고, 유형과 패턴만 참고하여 독창적인 문제를 만들어주세요.
"""
        else:
            user_prompt = str(input_data)
        
        # Azure OpenAI 문제 생성 API 직접 호출
        content, parsed_json = await question_client.generate_question(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
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
            max_tokens=500,  # 토큰 제한을 늘려서 응답이 잘리지 않도록 함
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