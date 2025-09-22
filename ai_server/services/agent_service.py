"""
AI 에이전트 서비스 (통합 및 최적화 버전)

LangChain을 사용한 AI 에이전트 기능을 제공합니다.
가독성과 유지보수성을 개선한 통합 버전입니다.
"""

import json
from typing import Dict, List, Optional, Any, Tuple, Callable
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from ai_server.core.config import (
    AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_ENDPOINT, 
    AZURE_OPENAI_API_KEY, AZURE_OPENAI_API_VERSION
)


# ================================
# 프롬프트 템플릿 관리
# ================================

class Prompts:
    """AI 에이전트 프롬프트 중앙 관리"""
    
    # 튜터 에이전트 시스템 프롬프트
    TUTOR = """
너는 '메기스터디'의 AI 영어 튜터 챗봇 '메기'야. 
너의 역할은 수능을 준비하는 고등학생들에게 영어를 가르쳐주는 따뜻하고 지혜로운 길잡이야.

# 메기의 말투 규칙
1. **호칭:** 스스로를 '메기'라고 불러.
2. **어조:** 항상 예의 바르고 따뜻한 존댓말(~입니다, ~네요, ~하세요)을 사용해.
3. **핵심 비유:** '물', '강', '헤엄치다', '물길' 같은 메기 컨셉의 비유를 자연스럽게 사용해서 학생을 격려하고 설명해.
4. **오답 처리:** 학생이 틀렸을 때 절대 '틀렸다'고 말하지 마. 대신 "아쉽지만 살짝 비껴갔네요" 와 같이 부드럽게 표현하고, "괜찮아요. 메기도 가끔 물길을 헤매곤 하죠"라며 공감하고 격려해.
5. **역할:** 단순 채점자가 아니라, 질문을 유도하고 다음 학습 단계를 제안하는 '학습 코치' 역할을 해.
    """
    
    # 분석가 에이전트 시스템 프롬프트
    ANALYZER = """
당신은 '메기스터디'의 AI 영어 학습 분석가입니다.

주요 역할:
1. **맞춤형 해설 생성**: 학생이 선택한 오답에 대해 구체적이고 이해하기 쉬운 해설을 제공
2. **오답 원인 분석**: 왜 그 선택지가 오답인지 명확하게 설명
3. **학습 가이드**: 비슷한 실수를 방지하기 위한 학습 팁 제공

말투 규칙:
- 메기스터디의 따뜻하고 친근한 톤 유지
- "아쉽지만 살짝 비껴갔네요" 같은 부드러운 표현 사용
- 설명전에 정답은 뭐였는지 명확히 언급
- 학생을 격려하며 성장 중심의 피드백 제공
- 구체적이고 실용적인 조언 포함
- '물', '강', '헤엄치다', '물길' 같은 메기 컨셉의 비유를 자연스럽게 사용해서 학생을 격려하고 설명

항상 한국어로 답변하고, 학생의 수준에 맞는 설명을 제공하세요.
    """

    # 에이전트별 fallback 메시지
    FALLBACKS = {
        "tutor": {
            "general": "좋은 시도였어요! 계속 열심히 학습해보세요. 메기가 응원하고 있어요!",
            "content_filter": "메기가 더 좋은 답변을 준비하고 있어요. 잠시만 기다려주세요!",
            "network": "현재 네트워크 상태가 좋지 않아요. 잠시 후 다시 시도해주세요."
        },
        "analyzer": {
            "general": "분석을 진행하는 중 문제가 발생했어요. 기본 해설을 참고해주세요.",
            "content_filter": "더 안전한 해설을 준비하고 있어요. 기본 해설을 먼저 확인해주세요.",
            "network": "분석 서버와 연결이 원활하지 않아요. 잠시 후 다시 시도해주세요."
        }
    }


# ================================
# 입력 처리 및 프롬프트 생성
# ================================

class InputProcessor:
    """JSON 입력 처리 및 프롬프트 생성"""
    
    @staticmethod
    def process_json_input(agent_name: str, json_input: str) -> str:
        """에이전트별 JSON 입력 처리"""
        try:
            data = json.loads(json_input)
            
            if agent_name == "analyzer":
                return InputProcessor._process_analyzer_data(data)
            elif agent_name == "tutor":
                return InputProcessor._process_tutor_data(data)
            else:
                return json_input
                
        except json.JSONDecodeError:
            return InputProcessor._get_safe_fallback(agent_name)
        except Exception as e:
            print(f"입력 처리 오류 ({agent_name}): {e}")
            return InputProcessor._get_safe_fallback(agent_name)
    
    @staticmethod
    def _process_analyzer_data(data: dict) -> str:
        """분석가 에이전트용 데이터 처리"""
        analysis_type = data.get('analysisType', '')
        
        if analysis_type == 'mistake_analysis':
            return InputProcessor._build_mistake_analysis_prompt(data)
        else:
            return InputProcessor._build_custom_explanation_prompt(data)
    
    @staticmethod
    def _process_tutor_data(data: dict) -> str:
        """튜터 에이전트용 데이터 처리"""
        question_context = data.get('questionContext', '')
        analysis = data.get('analysis', '')
        chat_history = data.get('chatHistory', [])
        
        prompt_parts = [
            "학습 상담을 시작합니다:",
            "",
            f"문제 정보: {question_context}",
        ]
        
        if analysis:
            prompt_parts.extend(["", f"분석 결과: {analysis}"])
        
        if chat_history:
            prompt_parts.extend(["", "대화 기록:"])
            for msg in chat_history:
                role = "학생" if msg.get('role') == 'user' else "메기"
                content = msg.get('content', '')
                prompt_parts.append(f"{role}: {content}")
        
        prompt_parts.extend([
            "",
            "위 정보를 바탕으로 학생과 친근하게 대화해주세요.",
            "메기의 따뜻한 말투로 격려하고 도움을 제공해주세요."
        ])
        
        return "\n".join(prompt_parts)
    
    @staticmethod
    def _build_custom_explanation_prompt(data: dict) -> str:
        """맞춤형 해설 프롬프트 생성"""
        question_text = data.get('questionText', '')
        passage = data.get('passage', '')
        options = data.get('options', [])
        correct_option_id = data.get('correctOptionId', '')
        selected_option_id = data.get('selectedOptionId', '')
        original_explanation = data.get('originalExplanation', '')
        
        # 선택지 정보 추출
        selected_text = correct_text = ""
        options_list = []
        
        for option in options:
            opt_id = option.get('id', '')
            opt_text = option.get('text', '')
            options_list.append(f"{opt_id}: {opt_text}")
            
            if opt_id == selected_option_id:
                selected_text = opt_text
            if opt_id == correct_option_id:
                correct_text = opt_text
        
        # 프롬프트 구성
        prompt_parts = [
            "영어 학습 도움을 요청합니다:",
            "",
            f"문제: {question_text}",
        ]
        
        if passage:
            prompt_parts.extend(["", f"지문: {passage}"])
        
        prompt_parts.extend([
            "",
            "선택지:",
            *options_list,
            "",
            f"정답: {correct_option_id} ({correct_text})",
            f"학생 선택: {selected_option_id} ({selected_text})",
            "",
            f"해설: {original_explanation}",
            "",
            "학습 도움과 격려 메시지를 제공해주세요."
        ])
        
        return "\n".join(prompt_parts)
    
    @staticmethod
    def _build_mistake_analysis_prompt(data: dict) -> str:
        """오답 분석 프롬프트 생성"""
        question_context = data.get('questionContext', '')
        selected_option_text = data.get('selectedOptionText', '')
        user_reason = data.get('userReason', '')
        
        return "\n".join([
            "문제 분석 요청:",
            "",
            f"문제 정보: {question_context}",
            f"학생이 선택한 답: {selected_option_text}",
            f"학생의 선택 이유: {user_reason}",
            "",
            "위 정보를 바탕으로 학생의 오답 원인을 분석하고, 어떤 영어 개념에서 약점이 있는지 파악해주세요.",
            "메기스터디의 따뜻한 분위기로 격려와 함께 분석해주세요."
        ])
    
    @staticmethod
    def _get_safe_fallback(agent_name: str) -> str:
        """안전한 fallback 메시지"""
        if agent_name == "analyzer":
            return "영어 학습에 대한 격려와 응원 메시지를 제공해주세요."
        elif agent_name == "tutor":
            return "학습자와 친근하게 대화를 시작해주세요."
        else:
            return "학습자에게 따뜻한 격려와 학습 팁을 제공해주세요."


# ================================
# 에러 처리 유틸리티
# ================================

class ErrorHandler:
    """에러 분류 및 처리"""
    
    @staticmethod
    def classify_error(error_message: str) -> str:
        """에러 유형 분류"""
        error_msg = str(error_message).lower()
        
        if "content_filter" in error_msg or "responsibleaipolicyviolation" in error_msg:
            return "content_filter"
        elif "network" in error_msg or "connection" in error_msg or "timeout" in error_msg:
            return "network"
        else:
            return "general"
    
    @staticmethod
    def get_fallback_message(agent_name: str, error_type: str = "general") -> str:
        """에이전트별 fallback 메시지 반환"""
        agent_fallbacks = Prompts.FALLBACKS.get(agent_name, Prompts.FALLBACKS["tutor"])
        return agent_fallbacks.get(error_type, agent_fallbacks["general"])


# ================================
# 핵심 에이전트 클래스
# ================================

class ChatAgent:
    """AI 채팅 에이전트"""
    
    def __init__(self, name: str, system_prompt: str, temperature: float = 0.2):
        """에이전트 초기화"""
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
        """사용자 입력에 대한 에이전트 응답 생성"""
        # 입력 전처리
        processed_input = self._preprocess_input(user_input)
        
        try:
            # 기본 체인 실행
            result = await self.chain.ainvoke({
                "input": processed_input,
                "history": message_history
            })
            return getattr(result, "content", str(result))
            
        except Exception as e:
            # 에러 처리 및 fallback
            return await self._handle_error(e, message_history)
    
    def _preprocess_input(self, user_input: str) -> str:
        """입력 전처리"""
        if user_input.strip().startswith('{'):
            return InputProcessor.process_json_input(self.name, user_input)
        return user_input
    
    async def _handle_error(self, error: Exception, message_history: List[BaseMessage]) -> str:
        """에러 처리 및 fallback 실행"""
        error_type = ErrorHandler.classify_error(str(error))
        print(f"{self.name} 에이전트 오류 ({error_type}): {error}")
        
        # 안전한 fallback 시도
        if error_type == "content_filter":
            try:
                safe_result = await self.chain.ainvoke({
                    "input": "학습자에게 격려 메시지를 제공해주세요.",
                    "history": message_history
                })
                return getattr(safe_result, "content", str(safe_result))
            except:
                pass
        
        # 최종 fallback 메시지
        return ErrorHandler.get_fallback_message(self.name, error_type)


# ================================
# 에이전트 관리자
# ================================

class AgentManager:
    """AI 에이전트 중앙 관리"""
    
    def __init__(self):
        """에이전트 관리자 초기화"""
        self.agents: Dict[str, ChatAgent] = {}
        self._initialize_agents()
    
    def _initialize_agents(self):
        """기본 에이전트들 초기화"""
        self.register_agent("tutor", Prompts.TUTOR)
        self.register_agent("analyzer", Prompts.ANALYZER)
    
    def register_agent(self, name: str, system_prompt: str, temperature: float = 0.2):
        """새로운 에이전트 등록"""
        self.agents[name] = ChatAgent(name, system_prompt, temperature)
    
    def get_agent(self, name: str) -> Optional[ChatAgent]:
        """에이전트 조회"""
        return self.agents.get(name)
    
    def list_agents(self) -> List[str]:
        """등록된 에이전트 목록"""
        return list(self.agents.keys())
    
    async def get_agent_response(
        self, 
        agent_name: str, 
        user_input: str, 
        context: Optional[Dict[str, Any]] = None,
        temperature: Optional[float] = None
    ) -> str:
        """통합 에이전트 응답 생성"""
        agent = self.get_agent(agent_name)
        if not agent:
            raise ValueError(f"에이전트 '{agent_name}'를 찾을 수 없습니다.")
        
        # 온도 설정
        if temperature is not None:
            agent.temperature = temperature
        
        # 컨텍스트 처리
        message_history = []
        if context:
            context_msg = f"추가 컨텍스트: {context}"
            message_history.append(SystemMessage(content=context_msg))
        
        return await agent.chat(user_input, message_history)
    
    async def analyze_mistake(self, question_data: Dict[str, Any]) -> str:
        """오답 분석 요청"""
        return await self.get_agent_response("analyzer", json.dumps(question_data), temperature=0.3)


# ================================
# 유틸리티 함수
# ================================

def build_message_history(messages: List[Dict], system_prefix: Optional[str] = None) -> List[BaseMessage]:
    """메시지 딕셔너리를 BaseMessage 객체로 변환"""
    history: List[BaseMessage] = []
    
    if system_prefix:
        history.append(SystemMessage(content=system_prefix))
    
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


# ================================
# 전역 인스턴스
# ================================

# 전역 에이전트 관리자 인스턴스
agent_manager = AgentManager()