"""ai_server/services/llm.py

LangChain AzureChatOpenAI 래퍼와 Agent 유틸.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableSerializable

from .config import AZURE_DEPLOYMENT, AZURE_ENDPOINT, AZURE_KEY, AZURE_API_VERSION


JSON_ONLY_INSTRUCTIONS = (
    "You are a JSON generator. Return ONLY a single valid JSON object. "
    "Do not include markdown, code fences, comments, or any extra text. "
    "The JSON must strictly follow the specified schema and required keys."
)


def make_azure_llm() -> AzureChatOpenAI:
    return AzureChatOpenAI(
        azure_deployment=AZURE_DEPLOYMENT,
        azure_endpoint=AZURE_ENDPOINT,
        api_key=AZURE_KEY,
        api_version=AZURE_API_VERSION,
        temperature=0.2,
    )


class Agent:
    def __init__(self, name: str, system_prompt: str):
        self.name = name
        self.system_prompt = system_prompt
        self.llm = make_azure_llm()
        self.chain: RunnableSerializable = (
            ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder("history"),
                ("human", "{input}"),
            ])
            | self.llm
        )

    async def ainvoke(self, *, input: str, history: List[BaseMessage]) -> str:
        result = await self.chain.ainvoke({"input": input, "history": history})
        return getattr(result, "content", str(result))


def build_history(messages: List[dict], system_prefix: Optional[str] = None) -> List[BaseMessage]:
    history: List[BaseMessage] = []
    if system_prefix:
        history.append(SystemMessage(content=system_prefix))
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        if role in ("assistant", "model"):
            history.append(AIMessage(content=content))
        elif role == "system":
            history.append(SystemMessage(content=content))
        else:
            history.append(HumanMessage(content=content))
    return history
