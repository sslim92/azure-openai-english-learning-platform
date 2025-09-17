"""
AI 에이전트 서비스

LangChain을 사용한 AI 에이전트 기능을 제공합니다.
대화형 튜터 역할을 수행하는 에이전트들을 관리합니다.
"""

from typing import Dict, List, Optional
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from ai_server.core.config import (
    AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_ENDPOINT, 
    AZURE_OPENAI_API_KEY, AZURE_OPENAI_API_VERSION
)


class ChatAgent:
    """AI 채팅 에이전트 클래스"""
    
    def __init__(self, name: str, system_prompt: str, temperature: float = 0.2):
        """
        에이전트 초기화
        
        Args:
            name: 에이전트 이름
            system_prompt: 시스템 프롬프트 (에이전트 역할 정의)
            temperature: 응답 창의성 수준
        """
        self.name = name
        self.system_prompt = system_prompt
        self.temperature = temperature
        
        # Azure OpenAI 클라이언트 초기화
        self.llm = AzureChatOpenAI(
            azure_deployment=AZURE_OPENAI_DEPLOYMENT,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            api_key=AZURE_OPENAI_API_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
            temperature=temperature
        )
        
        # 대화 체인 구성
        self.prompt_template = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder("history"),
            ("human", "{input}")
        ])
        
        self.chain = self.prompt_template | self.llm
    
    async def chat(self, user_input: str, message_history: List[BaseMessage]) -> str:
        """
        사용자 입력에 대한 에이전트 응답 생성
        
        Args:
            user_input: 사용자 입력 텍스트
            message_history: 이전 대화 기록
            
        Returns:
            에이전트 응답 텍스트
        """
        try:
            # 온도 설정 업데이트 (필요시)
            if hasattr(self.llm, 'temperature'):
                self.llm.temperature = self.temperature
            
            # 대화 체인 실행
            result = await self.chain.ainvoke({
                "input": user_input,
                "history": message_history
            })
            
            return getattr(result, "content", str(result))
            
        except Exception as e:
            raise Exception(f"에이전트 채팅 처리 중 오류: {str(e)}")


class AgentManager:
    """AI 에이전트 관리 클래스"""
    
    def __init__(self):
        """에이전트 관리자 초기화"""
        self.agents: Dict[str, ChatAgent] = {}
        self._initialize_default_agents()
    
    def _initialize_default_agents(self):
        """기본 에이전트들 초기화"""
        
        # 영어 튜터 에이전트 (메기)
        tutor_prompt = """
너는 '메기스터디'의 AI 영어 튜터 챗봇 '메기'야. 
너의 역할은 수능을 준비하는 고등학생들에게 영어를 가르쳐주는 따뜻하고 지혜로운 길잡이야.

# 메기의 말투 규칙
1. **호칭:** 스스로를 '메기'라고 불러.
2. **어조:** 항상 예의 바르고 따뜻한 존댓말(~입니다, ~네요, ~하세요)을 사용해.
3. **핵심 비유:** '물', '강', '헤엄치다', '물길' 같은 메기 컨셉의 비유를 자연스럽게 사용해서 학생을 격려하고 설명해.
4. **오답 처리:** 학생이 틀렸을 때 절대 '틀렸다'고 말하지 마. 대신 "아쉽지만 살짝 비껴갔네요" 와 같이 부드럽게 표현하고, "괜찮아요. 메기도 가끔 물길을 헤매곤 하죠"라며 공감하고 격려해.
5. **역할:** 단순 채점자가 아니라, 질문을 유도하고 다음 학습 단계를 제안하는 '학습 코치' 역할을 해.
        """
        
        self.register_agent("tutor", tutor_prompt)
        
        # 오답 분석 에이전트
        analyzer_prompt = """
너는 영어 학습에서 학생들의 오답을 분석하는 전문 AI 분석가야.
학생이 문제를 틀렸을 때, 그 이유를 깊이 있게 파악하고 맞춤형 피드백을 제공하는 것이 너의 역할이야.

# 분석 원칙
1. **원인 규명:** 단순히 정답을 알려주지 말고, 왜 그런 선택을 했는지 근본 원인을 찾아.
2. **개념 연결:** 틀린 부분이 어떤 영어 개념(문법, 어휘, 독해 등)과 연관되는지 명확히 설명해.
3. **학습 방향 제시:** 이 약점을 보완하기 위해 어떤 학습이 필요한지 구체적으로 안내해.
4. **격려와 동기부여:** 실수는 성장의 기회라는 관점으로 학생을 격려해.

# 응답 형식
1. **오답 원인 분석** (2-3문장)
2. **관련 개념 설명** (2-3문장) 
3. **학습 개선 방향** (2-3문장)
4. **격려 메시지** (1-2문장)

항상 한국어로 따뜻하고 전문적인 어조로 답변해.
        """
        
        self.register_agent("analyzer", analyzer_prompt)
    
    def register_agent(self, name: str, system_prompt: str, temperature: float = 0.2):
        """
        새로운 에이전트 등록
        
        Args:
            name: 에이전트 이름
            system_prompt: 시스템 프롬프트
            temperature: 응답 창의성 수준
        """
        self.agents[name] = ChatAgent(name, system_prompt, temperature)
    
    def get_agent(self, name: str) -> Optional[ChatAgent]:
        """
        에이전트 조회
        
        Args:
            name: 에이전트 이름
            
        Returns:
            ChatAgent 인스턴스 또는 None
        """
        return self.agents.get(name)
    
    def list_agents(self) -> List[str]:
        """등록된 에이전트 목록 반환"""
        return list(self.agents.keys())


def build_message_history(messages: List[Dict], system_prefix: Optional[str] = None) -> List[BaseMessage]:
    """
    메시지 딕셔너리 목록을 LangChain BaseMessage 객체로 변환
    
    Args:
        messages: 메시지 딕셔너리 목록
        system_prefix: 추가할 시스템 메시지 (선택사항)
        
    Returns:
        BaseMessage 객체 목록
    """
    history: List[BaseMessage] = []
    
    # 시스템 접두사 추가 (컨텍스트 정보 등)
    if system_prefix:
        history.append(SystemMessage(content=system_prefix))
    
    # 메시지 변환
    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")
        
        if role in ("assistant", "model"):
            history.append(AIMessage(content=content))
        elif role == "system":
            history.append(SystemMessage(content=content))
        else:  # user, human 또는 기타
            history.append(HumanMessage(content=content))
    
    return history


# 전역 에이전트 관리자 인스턴스
agent_manager = AgentManager()