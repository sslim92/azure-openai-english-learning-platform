"""ai_server/app.py

FastAPI 엔트리포인트: 라우터를 조립하고 앱을 생성합니다.
"""

from fastapi import FastAPI

from .routers.tts import router as tts_router
from .routers.agent import router as agent_router
from .routers.generation import router as generation_router


app = FastAPI()

# 라우터 마운트
app.include_router(tts_router)
app.include_router(agent_router)
app.include_router(generation_router)
