"""
맞춤 해설 생성 서비스

문제, 정답, 오답, 기본 해설을 바탕으로 AI가 개인화된 해설을 생성합니다.
"""

from typing import List
from ai_server.core.schemas import QuestionOption
from ai_server.services.azure_client import AzureOpenAIClient


class ExplanationService:
    """맞춤 해설 생성 서비스"""
    
    def __init__(self, azure_client: AzureOpenAIClient):
        self.azure_client = azure_client
    
    async def generate_custom_explanation(
        self,
        question_text: str,
        passage: str,
        options: List[QuestionOption],
        correct_option_id: str,
        selected_option_id: str,
        explanation: str
    ) -> str:
        """
        사용자가 선택한 오답에 대한 맞춤 해설을 생성합니다.
        
        Args:
            question_text: 문제 텍스트
            passage: 지문
            options: 선택지 목록
            correct_option_id: 정답 선택지 ID
            selected_option_id: 사용자가 선택한 오답 선택지 ID
            explanation: 기본 해설
            
        Returns:
            AI가 생성한 맞춤 해설
        """
        # 선택지 정보 정리
        options_text = "\n".join([f"{opt.id}: {opt.text}" for opt in options])
        correct_option = next((opt for opt in options if opt.id == correct_option_id), None)
        selected_option = next((opt for opt in options if opt.id == selected_option_id), None)
        
        if not correct_option or not selected_option:
            raise ValueError("정답 또는 선택한 답을 찾을 수 없습니다.")
        
        # 맞춤 해설 생성 프롬프트
        prompt = f"""다음 국어 문제에서 학생이 틀린 답을 선택했습니다. 
학생이 왜 그 답을 선택했는지 이해하고, 정답으로 가는 사고 과정을 친근하고 이해하기 쉽게 설명해주세요.

**문제:**
{question_text}

**지문:**
{passage}

**선택지:**
{options_text}

**정답:** {correct_option_id} - {correct_option.text}
**학생이 선택한 답:** {selected_option_id} - {selected_option.text}

**기본 해설:**
{explanation}

**요구사항:**
1. 학생이 선택한 오답이 왜 틀렸는지 구체적으로 설명
2. 정답을 찾는 올바른 사고 과정을 단계별로 제시
3. 비슷한 실수를 피하는 방법 제안
4. 친근하고 격려하는 톤으로 작성
5. 메기 멘토의 특성을 살려 물고기나 물의 비유를 자연스럽게 포함

응답은 해설 내용만 작성하고, 다른 인사말이나 부가 설명은 제외해주세요."""

        try:
            response = await self.azure_client.generate_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            return response
        except Exception as e:
            raise Exception(f"맞춤 해설 생성 실패: {str(e)}")