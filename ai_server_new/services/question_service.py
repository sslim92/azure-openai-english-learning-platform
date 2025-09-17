"""
문제 생성 서비스

Azure OpenAI를 사용하여 영어 문제 생성 및 오답 분석 기능을 제공합니다.
"""

from typing import Dict, Any, Optional
from pydantic import ValidationError

from ..core.schemas import Question, MistakeAnalysis
from .azure_client import AzureOpenAIClient


# JSON 전용 응답을 위한 시스템 지시문
JSON_INSTRUCTION = (
    "You are a JSON generator. Return ONLY a single valid JSON object. "
    "Do not include markdown, code fences, comments, or any extra text. "
    "The JSON must strictly follow the specified schema and required keys."
)


class QuestionGenerationService:
    """문제 생성 서비스 클래스"""
    
    def __init__(self):
        """서비스 초기화"""
        self.client = AzureOpenAIClient()
    
    def _format_input_data(self, data: Any) -> str:
        """
        입력 데이터를 텍스트로 변환
        
        Args:
            data: 변환할 데이터
            
        Returns:
            포맷된 텍스트 문자열
        """
        if isinstance(data, str):
            return data
        
        if isinstance(data, dict):
            # 특정 키들을 우선적으로 처리
            priority_keys = [
                "questionContext", "questionText", "topic", 
                "userAnswerText", "userReason", "explanation", "difficulty"
            ]
            
            parts = []
            # 우선순위 키 먼저 처리
            for key in priority_keys:
                if key in data and data[key] is not None:
                    parts.append(f"{key}: {data[key]}")
            
            # 나머지 키들 처리
            for key in sorted(data.keys()):
                if key not in priority_keys and data[key] is not None:
                    parts.append(f"{key}: {data[key]}")
            
            return "\n".join(parts)
        
        # 기타 타입은 JSON 문자열로 변환 시도
        try:
            import json
            return json.dumps(data, ensure_ascii=False)
        except Exception:
            return str(data)
    
    async def generate_similar_question(self, prompt_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        유사 문제 생성
        
        Args:
            prompt_data: 문제 생성을 위한 입력 데이터
            
        Returns:
            생성된 문제 데이터 또는 원본 응답
        """
        try:
            # 입력 데이터 포맷팅
            formatted_prompt = self._format_input_data(prompt_data.get('prompt'))
            
            # 시스템 메시지 구성
            system_message = (
                JSON_INSTRUCTION + 
                " Output must conform to the Question schema with fields: "
                "id, year, month, intent, topic, questionText, passage, "
                "options[{id,text}], correctOptionId, explanation, "
                "difficulty(=Easy|Medium|Hard), listeningScript(optional), "
                "generationReason(optional)."
            )
            
            # API 호출
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": formatted_prompt}
            ]
            
            raw_response, parsed_data = await self.client.chat_completion(
                messages=messages,
                max_tokens=512,
                temperature=0.2
            )
            
            # 파싱된 데이터가 있으면 스키마 검증 시도
            if parsed_data:
                try:
                    question = Question.model_validate(parsed_data)
                    return question.model_dump()
                except ValidationError:
                    # 검증 실패시 원본 데이터 반환
                    pass
            
            # 파싱 실패 또는 검증 실패시 원본 응답 반환
            return {"raw": raw_response}
            
        except Exception as e:
            raise Exception(f"문제 생성 중 오류 발생: {str(e)}")
    
    async def analyze_mistake(self, prompt_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        오답 분석 및 문제 생성
        
        Args:
            prompt_data: 오답 분석을 위한 입력 데이터
            
        Returns:
            오답 분석 결과 및 생성된 문제 데이터
        """
        try:
            # 입력 데이터 포맷팅
            formatted_prompt = self._format_input_data(prompt_data.get('prompt'))
            
            # 시스템 메시지 구성
            system_message = (
                JSON_INSTRUCTION + 
                " Output must conform to the AnalyzeMistakeResult schema with fields: "
                "weaknessAnalysis, generatedQuestion (Question schema: "
                "id, year, month, intent, topic, questionText, passage, "
                "options[{id,text}], correctOptionId, explanation, "
                "difficulty=Easy|Medium|Hard, listeningScript(optional), "
                "generationReason(optional))."
            )
            
            # API 호출
            messages = [
                {"role": "system", "content": system_message},
                {"role": "user", "content": formatted_prompt}
            ]
            
            raw_response, parsed_data = await self.client.chat_completion(
                messages=messages,
                max_tokens=1000,
                temperature=0.2
            )
            
            # 파싱된 데이터가 있으면 스키마 검증 시도
            if parsed_data:
                try:
                    analysis = MistakeAnalysis.model_validate(parsed_data)
                    return analysis.model_dump()
                except ValidationError:
                    # 검증 실패시 원본 데이터 반환
                    pass
            
            # 파싱 실패 또는 검증 실패시 원본 응답 반환
            return {"raw": raw_response}
            
        except Exception as e:
            raise Exception(f"오답 분석 중 오류 발생: {str(e)}")


# 전역 서비스 인스턴스
question_service = QuestionGenerationService()