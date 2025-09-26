"""
API 요청/응답 스키마 정의

FastAPI 엔드포인트에서 사용하는 Pydantic 모델들을 정의합니다.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    """TTS(음성합성) 요청 스키마"""
    text: str = Field(..., description="음성으로 변환할 텍스트")
    auto_detect_gender: bool = Field(True, description="텍스트에서 성별을 자동 감지하여 음성을 선택할지 여부")
    default_voice: str = Field("alloy", description="기본 음성 설정 (alloy, echo, fable 등)")


class ChatMessage(BaseModel):
    """채팅 메시지 스키마"""
    role: str = Field(..., description="메시지 역할 (user, assistant, system)")
    content: str = Field(..., description="메시지 내용")


class AgentChatRequest(BaseModel):
    """AI 에이전트 채팅 요청 스키마"""
    agent: Optional[str] = Field("tutor", description="사용할 에이전트 이름")
    messages: List[Dict[str, Any]] = Field(..., description="채팅 기록")
    context: Optional[Dict[str, Any]] = Field(None, description="추가 컨텍스트 정보")
    input: Optional[str] = Field(None, description="사용자 입력 텍스트")
    temperature: Optional[float] = Field(0.2, description="응답 창의성 수준 (0.0-1.0)")


class QuestionOption(BaseModel):
    """문제 선택지 스키마"""
    id: str = Field(..., description="선택지 ID")
    text: str = Field(..., description="선택지 텍스트")


class Question(BaseModel):
    """문제 스키마"""
    id: str = Field(..., description="문제 ID")
    year: Optional[int] = Field(None, description="출제 연도")
    month: Optional[int] = Field(None, description="출제 월")
    intent: str = Field(..., description="문제 의도")
    topic: str = Field(..., description="문제 주제")
    questionText: str = Field(..., description="문제 텍스트")
    passage: str = Field(..., description="지문")
    options: List[QuestionOption] = Field(..., description="선택지 목록")
    correctOptionId: str = Field(..., description="정답 선택지 ID")
    explanation: str = Field(..., description="해설")
    difficulty: str = Field(..., pattern=r"^(Easy|Medium|Hard)$", description="난이도")
    listeningScript: Optional[str] = Field(None, description="듣기 스크립트")
    generationReason: Optional[str] = Field(None, description="생성 이유")


class MistakeAnalysis(BaseModel):
    """오답 분석 결과 스키마"""
    weaknessAnalysis: str = Field(..., description="약점 분석")
    generatedQuestion: Question = Field(..., description="생성된 문제")


class GenerationRequest(BaseModel):
    """문제 생성 요청 스키마"""
    input: Dict[str, Any] = Field(..., description="생성 요청 입력 데이터")


class ChatHistoryExtractionRequest(BaseModel):
    """대화 내역에서 오답 이유 추출 요청 스키마"""
    chatHistory: List[Dict[str, Any]] = Field(..., description="사용자와 AI 간의 대화 내역")
    selectedOptionText: str = Field(..., description="사용자가 선택한 오답 텍스트")
    correctOptionText: str = Field(..., description="정답 선택지 텍스트")
    questionText: str = Field(..., description="문제 텍스트")