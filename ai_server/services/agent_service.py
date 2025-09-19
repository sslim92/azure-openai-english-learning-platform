"""
AI 에이전트 서비스

LangChain을 사용한 AI 에이전트 기능을 제공합니다.
대화형 튜터 역할을 수행하는 에이전트들을 관리합니다.
"""

from typing import Dict, List, Optional, Any
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
            user_input: 사용자 입력 텍스트 (JSON 형태일 수 있음)
            message_history: 이전 대화 기록
            
        Returns:
            에이전트 응답 텍스트
        """
        try:
            # 온도 설정 업데이트 (필요시)
            if hasattr(self.llm, 'temperature'):
                self.llm.temperature = self.temperature
            
            # JSON 입력인 경우 에이전트별 특별 처리
            if user_input.strip().startswith('{'):
                try:
                    if self.name == "analyzer":
                        processed_input = self._process_analyzer_input(user_input)
                        print(f"Processed analyzer input: {processed_input[:100]}...")  # 디버그 로그 단축
                    elif self.name == "tutor":
                        processed_input = self._process_tutor_input(user_input)
                        print(f"Processed tutor input: {processed_input[:100]}...")  # 디버그 로그 단축
                    else:
                        processed_input = user_input
                except Exception as e:
                    print(f"JSON 처리 오류: {e}")
                    if self.name == "analyzer":
                        processed_input = "영어 학습에 대한 격려와 응원을 부탁합니다."
                    elif self.name == "tutor":
                        processed_input = "학습자와 친근하게 대화를 시작해주세요."
                    else:
                        processed_input = user_input
            else:
                # 일반적인 입력 처리
                processed_input = user_input
            
            # 대화 체인 실행
            result = await self.chain.ainvoke({
                "input": processed_input,
                "history": message_history
            })
            
            return getattr(result, "content", str(result))
            
        except Exception as e:
            error_msg = str(e)
            print(f"Chat 메서드 오류: {error_msg}")
            
            # 콘텐츠 필터 오류인 경우 특별 처리
            if "content_filter" in error_msg or "ResponsibleAIPolicyViolation" in error_msg:
                # 매우 안전한 fallback 시도
                try:
                    safe_result = await self.chain.ainvoke({
                        "input": "학습자에게 격려 메시지를 제공해주세요.",
                        "history": message_history
                    })
                    return getattr(safe_result, "content", str(safe_result))
                except:
                    # 그래도 실패하면 하드코딩된 메시지 반환
                    return "좋은 시도였어요! 계속 열심히 학습해보세요. 메기가 응원하고 있어요!"
            
            raise Exception(f"에이전트 채팅 처리 중 오류: {error_msg}")
    
    def _process_analyzer_input(self, json_input: str) -> str:
        """
        analyzer 에이전트용 JSON 입력 처리
        
        Args:
            json_input: JSON 형태의 문제 데이터
            
        Returns:
            구조화된 프롬프트 텍스트
        """
        import json
        
        try:
            data = json.loads(json_input)
            
            # analysisType이 있는 경우 (saveUserAnswer에서 호출)
            analysis_type = data.get('analysisType', '')
            if analysis_type == 'mistake_analysis':
                return self._process_mistake_analysis(data)
            
            # 기존 generateCustomExplanation 형태 처리
            question_text = data.get('questionText', '')
            passage = data.get('passage', '')
            options = data.get('options', [])
            correct_option_id = data.get('correctOptionId', '')
            selected_option_id = data.get('selectedOptionId', '')
            original_explanation = data.get('originalExplanation', '')
            
            # 선택지에서 텍스트 찾기
            selected_option_text = ""
            correct_option_text = ""
            for option in options:
                if option.get('id') == selected_option_id:
                    selected_option_text = option.get('text', '')
                if option.get('id') == correct_option_id:
                    correct_option_text = option.get('text', '')
            
            # 선택지 목록 생성
            options_text = []
            for opt in options:
                option_id = opt.get('id', '')
                option_text = opt.get('text', '')
                options_text.append(f"{option_id}: {option_text}")
            options_list = "\n".join(options_text)
            
            # 구조화된 프롬프트 생성 (중괄호 없이)
            prompt_parts = [
                "영어 학습 도움을 요청합니다:",
                "",
                f"문제: {question_text}",
            ]
            
            if passage:
                prompt_parts.append(f"지문: {passage}")
                prompt_parts.append("")
            
            prompt_parts.extend([
                "선택지:",
                options_list,
                "",
                f"정답: {correct_option_id} ({correct_option_text})",
                f"학생 선택: {selected_option_id} ({selected_option_text})",
                "",
                f"해설: {original_explanation}",
                "",
                "학습 도움과 격려 메시지를 제공해주세요."
            ])
            
            return "\n".join(prompt_parts)
            
        except json.JSONDecodeError as e:
            print(f"JSON 파싱 오류: {e}")
            return "영어 학습에 대한 격려와 응원 메시지를 제공해주세요."
        except Exception as e:
            print(f"프롬프트 생성 오류: {e}")
            return "학습자에게 따뜻한 격려와 학습 팁을 제공해주세요."

    def _process_tutor_input(self, json_input: str) -> str:
        """
        tutor 에이전트용 JSON 입력 처리
        
        Args:
            json_input: JSON 형태의 튜터 데이터
            
        Returns:
            구조화된 프롬프트 텍스트
        """
        import json
        
        try:
            data = json.loads(json_input)
            
            # JSON 데이터에서 필요한 정보 추출
            question_context = data.get('questionContext', '')
            analysis = data.get('analysis', '')
            chat_history = data.get('chatHistory', [])
            
            # 프롬프트 구성
            prompt_parts = [
                "학습 상담을 시작합니다:",
                "",
                "문제 정보:",
                question_context,
                "",
            ]
            
            if analysis:
                prompt_parts.extend([
                    "분석 결과:",
                    analysis,
                    "",
                ])
            
            if chat_history:
                prompt_parts.extend([
                    "대화 기록:",
                ])
                for msg in chat_history:
                    role = msg.get('role', 'user')
                    content = msg.get('content', '')
                    role_name = "학생" if role == "user" else "메기"
                    prompt_parts.append(f"{role_name}: {content}")
                prompt_parts.append("")
            
            prompt_parts.extend([
                "위 정보를 바탕으로 학생과 친근하게 대화해주세요.",
                "메기의 따뜻한 말투로 격려하고 도움을 제공해주세요."
            ])
            
            return "\n".join(prompt_parts)
            
        except json.JSONDecodeError as e:
            print(f"JSON 파싱 오류: {e}")
            return "학습자와 친근하게 대화를 시작해주세요."
        except Exception as e:
            print(f"프롬프트 생성 오류: {e}")
            return "학습자에게 따뜻한 격려와 학습 팁을 제공해주세요."

    def _process_mistake_analysis(self, data: dict) -> str:
        """
        오답 분석용 JSON 입력 처리 (saveUserAnswer에서 호출)
        
        Args:
            data: JSON 데이터 딕셔너리
            
        Returns:
            구조화된 프롬프트 텍스트
        """
        try:
            question_context = data.get('questionContext', '')
            selected_option_text = data.get('selectedOptionText', '')
            user_reason = data.get('userReason', '')
            
            # 프롬프트 구성
            prompt_parts = [
                "문제 분석 요청:",
                "",
                "문제 정보:",
                question_context,
                "",
                f"학생이 선택한 답: {selected_option_text}",
                f"학생의 선택 이유: {user_reason}",
                "",
                "위 정보를 바탕으로 학생의 오답 원인을 분석하고, 어떤 영어 개념에서 약점이 있는지 파악해주세요.",
                "메기스터디의 따뜻한 분위기로 격려와 함께 분석해주세요."
            ]
            
            return "\n".join(prompt_parts)
            
        except Exception as e:
            print(f"오답 분석 프롬프트 생성 오류: {e}")
            return "학습자의 오답을 분석하고 격려해주세요."


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
        
        # 학습 도우미 에이전트
        analyzer_prompt = """
당신은 영어 학습을 돕는 친근한 도우미입니다.

학생들이 영어 문제를 풀 때 다음과 같이 도움을 제공합니다:
1. 학습에 도움이 되는 이해가 쉽게 자세한 설명
2. 다음 학습을 위한 조언

항상 긍정적이고 건설적인 톤으로 응답하세요.
메기스터디의 따뜻한 분위기로 한국어로 답변해주세요.
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
    
    async def get_agent_response(
        self, 
        agent_name: str, 
        user_input: str, 
        context: Optional[Dict[str, Any]] = None,
        temperature: Optional[float] = None
    ) -> str:
        """
        통합 에이전트 응답 생성
        
        Args:
            agent_name: 사용할 에이전트 이름
            user_input: 사용자 입력 또는 요청
            context: 추가 컨텍스트 정보
            temperature: 응답 창의성 수준
            
        Returns:
            에이전트 응답
        """
        agent = self.get_agent(agent_name)
        if not agent:
            raise ValueError(f"에이전트 '{agent_name}'를 찾을 수 없습니다.")
        
        # 온도 설정이 있으면 적용
        if temperature is not None:
            agent.temperature = temperature
        
        # 컨텍스트가 있으면 메시지 히스토리에 추가
        message_history = []
        if context:
            from langchain_core.messages import SystemMessage
            context_msg = f"추가 컨텍스트: {context}"
            message_history.append(SystemMessage(content=context_msg))
        
        return await agent.chat(user_input, message_history)
    
    async def analyze_mistake(self, question_data: Dict[str, Any]) -> str:
        """
        오답 분석 요청
        
        Args:
            question_data: 문제 및 오답 정보
            
        Returns:
            분석 결과 및 맞춤 해설
        """
        import json
        return await self.get_agent_response("analyzer", json.dumps(question_data), temperature=0.3)


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