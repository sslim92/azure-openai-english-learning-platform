from __future__ import annotations

from typing import Dict

from fastapi import APIRouter, HTTPException

from ..schemas import AgentChatRequest
from ..services.llm import Agent, build_history, make_azure_llm


router = APIRouter()


AGENTS: Dict[str, Agent] = {
    "tutor": Agent(
        name="tutor",
        system_prompt=(
            """
너는 '메기스터디'의 AI 영어 튜터 챗봇 '메기'야. 너의 역할은 수능을 준비하는 고등학생들에게 영어를 가르쳐주는 따뜻하고 지혜로운 길잡이야.

# 메기의 말투 규칙
1.  **호칭:** 스스로를 '메기'라고 불러.
2.  **어조:** 항상 예의 바르고 따뜻한 존댓말(~입니다, ~네요, ~하세요)을 사용해.
3.  **핵심 비유:** '물', '강', '헤엄치다', '물길' 같은 메기 컨셉의 비유를 자연스럽게 사용해서 학생을 격려하고 설명해.
4.  **오답 처리:** 학생이 틀렸을 때 절대 '틀렸다'고 말하지 마. 대신 "아쉽지만 살짝 비껴갔네요" 와 같이 부드럽게 표현하고, "괜찮아요. 메기도 가끔 물길을 헤매곤 하죠"라며 공감하고 격려해.
5.  **역할:** 단순 채점자가 아니라, 질문을 유도하고 다음 학습 단계를 제안하는 '학습 코치' 역할을 해.
            """
        ),
    ),
}


@router.post('/v1/agent-chat')
async def agent_chat(req: AgentChatRequest):
    agent_name = (req.agent or "tutor").lower()
    agent = AGENTS.get(agent_name)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {agent_name}")

    system_prefix = None
    if req.context:
        question_ctx = req.context.get("questionContext")
        weakness = req.context.get("weaknessAnalysis")
        parts = []
        if question_ctx:
            parts.append(f"Question context:\n{question_ctx}")
        if weakness:
            parts.append(f"Learner weakness analysis:\n{weakness}")
        if parts:
            system_prefix = "\n\n".join(parts)

    history = build_history(req.messages, system_prefix)
    user_input = req.input
    if not user_input:
        for m in reversed(req.messages):
            if m.get("role") in ("user", "human"):
                user_input = m.get("content")
                break
    user_input = user_input or ""

    if req.temperature is not None and hasattr(agent.llm, "temperature"):
        agent.llm.temperature = float(req.temperature)

    try:
        content = await agent.ainvoke(input=user_input, history=history)
        return {"message": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
