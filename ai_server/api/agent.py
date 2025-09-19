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