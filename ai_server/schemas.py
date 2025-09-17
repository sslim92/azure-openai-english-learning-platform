"""ai_server/schemas.py

엔드포인트에서 사용하는 Pydantic 모델 정의.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    text: str


class OptionOut(BaseModel):
    id: str
    text: str


class QuestionOut(BaseModel):
    id: str
    year: Optional[int] = None
    month: Optional[int] = None
    intent: str
    topic: str
    questionText: str
    passage: str
    options: List[OptionOut]
    correctOptionId: str
    explanation: str
    difficulty: str = Field(..., pattern=r"^(Easy|Medium|Hard)$")
    listeningScript: Optional[str] = None
    generationReason: Optional[str] = None


class AnalyzeMistakeResult(BaseModel):
    weaknessAnalysis: str
    generatedQuestion: QuestionOut


class AgentChatRequest(BaseModel):
    agent: Optional[str] = "tutor"
    messages: List[dict]
    context: Optional[dict] = None
    input: Optional[str] = None
    temperature: Optional[float] = 0.2


class GenericRequest(BaseModel):
    input: dict
