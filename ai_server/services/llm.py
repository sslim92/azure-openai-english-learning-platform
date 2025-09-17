"""
LangChain Azure OpenAI 서비스

LangChain을 사용한 Azure OpenAI 클라이언트와 에이전트 유틸리티를 제공합니다.
대화형 AI 에이전트 구현을 위한 핵심 기능들을 포함합니다.
"""

from typing import Dict, List, Optional
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableSerializable

from .config import AZURE_DEPLOYMENT, AZURE_ENDPOINT, AZURE_KEY, AZURE_API_VERSION


# JSON 전용 응답을 위한 시스템 지시문
JSON_ONLY_INSTRUCTIONS = (
    "You are a JSON generator. Return ONLY a single valid JSON object. "
    "Do not include markdown, code fences, comments, or any extra text. "
    "The JSON must strictly follow the specified schema and required keys."
)


def make_azure_llm() -> AzureChatOpenAI:
    """
    Azure OpenAI 클라이언트 생성
    
    Returns:
        설정된 AzureChatOpenAI 인스턴스
    """
    return AzureChatOpenAI(
        azure_deployment=AZURE_DEPLOYMENT,
        azure_endpoint=AZURE_ENDPOINT,
        api_key=AZURE_KEY,
        api_version=AZURE_API_VERSION,
        temperature=0.2,
    )


class Agent:
    """대화형 AI 에이전트 클래스"""
    
    def __init__(self, name: str, system_prompt: str):
        """
        에이전트 초기화
        
        Args:
            name: 에이전트 이름
            system_prompt: 시스템 프롬프트 (에이전트의 역할과 성격 정의)
        """
        self.name = name
        self.system_prompt = system_prompt
        self.llm = make_azure_llm()
        
        # 대화 체인 구성 (시스템 프롬프트 + 히스토리 + 사용자 입력)
        self.chain: RunnableSerializable = (
            ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder("history"),
                ("human", "{input}"),
            ])
            | self.llm
        )

    async def ainvoke(self, *, input: str, history: List[BaseMessage]) -> str:
        """
        에이전트 응답 생성 (비동기)
        
        Args:
            input: 사용자 입력 텍스트
            history: 이전 대화 기록
            
        Returns:
            에이전트 응답 텍스트
        """
        result = await self.chain.ainvoke({"input": input, "history": history})
        return getattr(result, "content", str(result))


def build_history(messages: List[dict], system_prefix: Optional[str] = None) -> List[BaseMessage]:
    """
    메시지 딕셔너리 목록을 LangChain BaseMessage 객체로 변환
    
    Args:
        messages: 메시지 딕셔너리 목록 (role, content 포함)
        system_prefix: 추가할 시스템 메시지 (컨텍스트 정보 등)
        
    Returns:
        BaseMessage 객체 목록
    """
    history: List[BaseMessage] = []
    
    # 시스템 접두사 추가 (문제 컨텍스트, 약점 분석 등)
    if system_prefix:
        history.append(SystemMessage(content=system_prefix))
    
    # 메시지 변환
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        
        if role in ("assistant", "model"):
            history.append(AIMessage(content=content))
        elif role == "system":
            history.append(SystemMessage(content=content))
        else:  # user, human 또는 기타
            history.append(HumanMessage(content=content))
    
    return history
