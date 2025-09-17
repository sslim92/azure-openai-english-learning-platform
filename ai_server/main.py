"""
AI 서버 메인 애플리케이션

FastAPI 애플리케이션을 생성하고 모든 라우터를 등록합니다.
메기스터디 AI 영어 학습 서비스의 백엔드 API 서버입니다.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.agent import router as agent_router
from api.generation import router as generation_router
from api.tts import router as tts_router


def create_app() -> FastAPI:
    """
    FastAPI 애플리케이션 생성 및 설정
    
    Returns:
        설정된 FastAPI 애플리케이션 인스턴스
    """
    # FastAPI 앱 생성
    app = FastAPI(
        title="메기스터디 AI 서버",
        description="영어 학습을 위한 AI 튜터, 문제 생성, TTS 서비스를 제공합니다.",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    # CORS 미들웨어 설정 (필요시)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 프로덕션에서는 구체적인 도메인으로 제한
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 라우터 등록 (기존 클라이언트와 호환성을 위해 prefix 제거)
    app.include_router(agent_router)
    app.include_router(generation_router)
    app.include_router(tts_router)
    
    # 헬스 체크 엔드포인트
    @app.get("/health")
    async def health_check():
        """서버 상태 확인 엔드포인트"""
        return {"status": "healthy", "message": "메기스터디 AI 서버가 정상 동작 중입니다."}
    
    return app


# 애플리케이션 인스턴스 생성
app = create_app()