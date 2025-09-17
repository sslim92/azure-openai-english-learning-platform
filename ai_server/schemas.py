"""
API 요청/응답 스키마 정의

FastAPI 엔드포인트에서 사용하는 Pydantic 모델들을 정의합니다.
요청 및 응답 데이터의 구조와 검증 규칙을 포함합니다.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    """TTS(음성합성) 요청 스키마"""
    text: str = Field(..., description="음성으로 변환할 텍스트")


class OptionOut(BaseModel):
    """문제 선택지 스키마"""
    id: str = Field(..., description="선택지 ID")
    text: str = Field(..., description="선택지 텍스트")


class QuestionOut(BaseModel):
    """영어 문제 스키마"""
    id: str = Field(..., description="문제 고유 ID")
    year: Optional[int] = Field(None, description="출제 연도")
    month: Optional[int] = Field(None, description="출제 월")
    intent: str = Field(..., description="문제 출제 의도")
    topic: str = Field(..., description="문제 주제/영역")
    questionText: str = Field(..., description="문제 텍스트")
    passage: str = Field(..., description="지문 내용")
    options: List[OptionOut] = Field(..., description="선택지 목록")
    correctOptionId: str = Field(..., description="정답 선택지 ID")
    explanation: str = Field(..., description="문제 해설")
    difficulty: str = Field(..., pattern=r"^(Easy|Medium|Hard)$", description="난이도 (Easy/Medium/Hard)")
    listeningScript: Optional[str] = Field(None, description="듣기 문제 스크립트 (선택사항)")
    generationReason: Optional[str] = Field(None, description="문제 생성 이유 (선택사항)")


class AnalyzeMistakeResult(BaseModel):
    """오답 분석 결과 스키마"""
    weaknessAnalysis: str = Field(..., description="학습자 약점 분석 결과")
    generatedQuestion: QuestionOut = Field(..., description="약점 보완용 생성된 문제")


class AgentChatRequest(BaseModel):
    """AI 에이전트 채팅 요청 스키마"""
    agent: Optional[str] = Field("tutor", description="사용할 에이전트 이름 (기본값: tutor)")
    messages: List[dict] = Field(..., description="이전 대화 기록 (role, content 포함)")
    context: Optional[dict] = Field(None, description="추가 컨텍스트 정보 (문제 정보, 약점 분석 등)")
    input: Optional[str] = Field(None, description="현재 사용자 입력 텍스트")
    temperature: Optional[float] = Field(0.2, description="응답 창의성 수준 (0.0~1.0)")


class GenericRequest(BaseModel):
    """일반적인 요청 스키마"""
    input: dict = Field(..., description="요청 입력 데이터 (다양한 형태의 데이터 포함)")
