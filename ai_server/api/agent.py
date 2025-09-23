"""
AI 에이전트 채팅 API 라우터

AI 튜터와의 대화 기능을 제공하는 엔드포인트들을 정의합니다.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from ai_server.core.schemas import AgentChatRequest
from ai_server.services.agent_service import agent_manager, build_message_history


router = APIRouter(prefix="/v1", tags=["agent"])


@router.post("/agent-chat")
async def agent_chat(request: AgentChatRequest):
    """
    AI 에이전트와 채팅
    
    Args:
        request: 에이전트 채팅 요청 데이터
        
    Returns:
        에이전트 응답 메시지
    """
    try:
        # 에이전트 이름 정규화
        agent_name = (request.agent or "tutor").lower()
        
        # 에이전트 조회
        agent = agent_manager.get_agent(agent_name)
        if not agent:
            raise HTTPException(
                status_code=404, 
                detail=f"에이전트를 찾을 수 없습니다: {agent_name}"
            )
        
        # 컨텍스트 정보 처리
        system_prefix = None
        if request.context:
            context_parts = []
            
            # 문제 컨텍스트 추가
            if question_context := request.context.get("questionContext"):
                context_parts.append(f"문제 컨텍스트:\n{question_context}")
            
            # 약점 분석 추가
            if weakness_analysis := request.context.get("weaknessAnalysis"):
                context_parts.append(f"학습자 약점 분석:\n{weakness_analysis}")
            
            # analyzer 에이전트를 위한 오답 분석 컨텍스트 추가
            if analysis_type := request.context.get("analysisType"):
                if analysis_type == "mistake_analysis":
                    selected_text = request.context.get("selectedOptionText", "N/A")
                    user_reason = request.context.get("userReason", "")
                    context_parts.append(f"선택한 답: {selected_text}")
                    context_parts.append(f"학생의 선택 이유: {user_reason}")
                elif analysis_type == "custom_explanation":
                    # 맞춤 해설 생성을 위한 컨텍스트 구성
                    question_text = request.context.get("questionText", "")
                    passage = request.context.get("passage", "")
                    listening_script = request.context.get("listeningScript", "")
                    options = request.context.get("options", [])
                    correct_option_id = request.context.get("correctOptionId", "")
                    selected_option_id = request.context.get("selectedOptionId", "")
                    selected_option_text = request.context.get("selectedOptionText", "")
                    original_explanation = request.context.get("originalExplanation", "")
                    
                    # 선택지 텍스트 구성
                    options_text = "\n".join([f"{opt.get('id', '')}: {opt.get('text', '')}" for opt in options])
                    
                    context_parts.append(f"문제: {question_text}")
                    if passage:
                        context_parts.append(f"지문: {passage}")
                    if listening_script:
                        context_parts.append(f"듣기 대본: {listening_script}")
                    context_parts.append(f"선택지:\n{options_text}")
                    context_parts.append(f"정답: {correct_option_id}")
                    context_parts.append(f"학생이 선택한 답: {selected_option_id} ({selected_option_text})")
                    context_parts.append(f"기존 해설: {original_explanation}")
                    context_parts.append("위 정보를 바탕으로 학생이 선택한 오답에 대한 맞춤형 해설을 생성해주세요.")
            
            if context_parts:
                system_prefix = "\n\n".join(context_parts)
        
        # 메시지 히스토리 구성
        message_history = build_message_history(request.messages, system_prefix)
        
        # 사용자 입력 결정
        user_input = request.input
        if not user_input:
            # 마지막 사용자 메시지에서 입력 추출
            for message in reversed(request.messages):
                if message.get("role") in ("user", "human"):
                    user_input = message.get("content")
                    break
        
        user_input = user_input or ""
        
        # 에이전트 온도 설정 (요청된 경우)
        if request.temperature is not None:
            agent.temperature = float(request.temperature)
        
        # 에이전트 응답 생성
        response_content = await agent.chat(user_input, message_history)
        
        return {"message": response_content}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"에이전트 채팅 처리 중 오류: {str(e)}")


@router.get("/agents")
async def list_agents():
    """
    등록된 에이전트 목록 조회
    
    Returns:
        에이전트 이름 목록
    """
    try:
        agents = agent_manager.list_agents()
        return {"agents": agents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"에이전트 목록 조회 중 오류: {str(e)}")


@router.post("/multi-turn-chat")
async def multi_turn_chat(request: dict):
    """
    멀티턴 대화 지원 엔드포인트
    
    Args:
        request: {
            "agent_name": "tutor|analyzer",
            "user_message": "사용자 메시지",
            "conversation_history": [{"role": "user|assistant", "content": "..."}],
            "system_context": "시스템 컨텍스트 (선택사항)",
            "temperature": 0.2 (선택사항)
        }
    
    Returns:
        {
            "agent_response": "에이전트 응답",
            "updated_history": [...],
            "conversation_id": "대화 ID (선택사항)"
        }
    """
    try:
        agent_name = request.get("agent_name", "tutor").lower()
        user_message = request.get("user_message", "")
        conversation_history = request.get("conversation_history", [])
        system_context = request.get("system_context")
        temperature = request.get("temperature")
        
        if not user_message:
            raise HTTPException(status_code=400, detail="사용자 메시지가 필요합니다.")
        
        # 에이전트 조회
        if not agent_manager.get_agent(agent_name):
            raise HTTPException(status_code=404, detail=f"에이전트를 찾을 수 없습니다: {agent_name}")
        
        # 온도 설정
        if temperature is not None:
            agent = agent_manager.get_agent(agent_name)
            agent.temperature = float(temperature)
        
        # 멀티턴 대화 진행
        agent_response, updated_history = await agent_manager.continue_conversation(
            agent_name=agent_name,
            user_message=user_message,
            conversation_history=conversation_history,
            system_context=system_context
        )
        
        return {
            "agent_response": agent_response,
            "updated_history": updated_history,
            "agent_name": agent_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"멀티턴 대화 처리 중 오류: {str(e)}")


@router.post("/switch-agent")
async def switch_agent_conversation(request: dict):
    """
    에이전트 간 대화 전환 엔드포인트
    
    Args:
        request: {
            "from_agent": "현재 에이전트",
            "to_agent": "전환할 에이전트",
            "conversation_history": [...],
            "transition_context": "전환 컨텍스트 (선택사항)"
        }
    
    Returns:
        {
            "agent_response": "새 에이전트 응답",
            "updated_history": [...],
            "switched_to": "전환된 에이전트"
        }
    """
    try:
        from_agent = request.get("from_agent", "").lower()
        to_agent = request.get("to_agent", "").lower()
        conversation_history = request.get("conversation_history", [])
        transition_context = request.get("transition_context")
        
        if not to_agent:
            raise HTTPException(status_code=400, detail="전환할 에이전트를 지정해주세요.")
        
        # 에이전트 유효성 검사
        if not agent_manager.get_agent(to_agent):
            raise HTTPException(status_code=404, detail=f"에이전트를 찾을 수 없습니다: {to_agent}")
        
        # 에이전트 전환 실행
        agent_response, updated_history = await agent_manager.switch_agent_conversation(
            from_agent=from_agent,
            to_agent=to_agent,
            conversation_history=conversation_history,
            transition_context=transition_context
        )
        
        return {
            "agent_response": agent_response,
            "updated_history": updated_history,
            "switched_to": to_agent,
            "switched_from": from_agent
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"에이전트 전환 처리 중 오류: {str(e)}")