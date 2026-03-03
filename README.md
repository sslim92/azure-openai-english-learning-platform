# 메기스터디 — AI 기반 수능 영어 학습 서비스

> **3인 팀 프로젝트** | 개발 기간: 약 1개월

## 프로젝트 개요

Azure OpenAI를 활용하여 수능 영어 문제에 대한 **개인화된 해설과 맞춤형 문제 생성**을 제공하는 영어 학습 플랫폼입니다.  
학습자의 풀이 데이터를 누적·분석하여 약점을 파악하고, 그에 맞는 유사 문제를 AI가 자동으로 생성합니다.  
또한 실제 수능 듣기 평가 환경에 가까운 다화자(Multi-speaker) 음성 콘텐츠도 제공합니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **웹 프론트엔드** | Next.js (App Router), TypeScript, Tailwind CSS |
| **AI 추론 서버** | FastAPI, LangChain, Azure OpenAI (GPT-4o / GPT-4o-mini) |
| **음성 합성** | Azure TTS-HD (다화자 파이프라인) |
| **데이터베이스** | Firebase Firestore |
| **인증** | Firebase Authentication |
| **배포** | Firebase App Hosting |

---

## 아키텍처

웹 서버와 AI 추론 서버를 **분리**하여 각 서버의 독립적인 확장과 유지보수가 가능하도록 설계했습니다.

```
┌─────────────────────┐        ┌────────────────────────┐
│   Next.js (포트3000) │──API──▶│   FastAPI (포트8001)   │
│   웹 서버 / UI 렌더링  │        │   AI 추론 서버           │
└─────────────────────┘        │   - 문제 해설 에이전트    │
           │                   │   - 문제 생성 엔드포인트  │
           ▼                   │   - TTS 파이프라인        │
┌─────────────────────┐        └────────────────────────┘
│  Firebase Firestore  │                  │
│  (문제, 학습 기록)     │        ┌─────────▼──────────────┐
└─────────────────────┘        │  Azure OpenAI / TTS-HD  │
                               └────────────────────────┘
```

---

## 주요 기능 및 본인 담당 파트

> **본인 담당:** FastAPI AI 추론 서버 전담 (서버 아키텍처 설계, 프롬프트 엔지니어링, 데이터 파이프라인)

### 1. 기능별 모델 이원화 전략

한정된 비용 안에서 최적의 성능을 내기 위해 기능의 특성에 따라 AI 모델을 다르게 배정했습니다.

| 기능 | 모델 | 선택 이유 |
|------|------|-----------|
| 문제 해설 / 질의응답 (`/v1/agent-chat`) | **GPT-4o-mini** | 빠른 응답 속도 및 비용 효율성 우선 |
| 맞춤형 문제 생성 (`/v1/generate`) | **GPT-4o** | 지문·주제·난이도 등 복잡한 메타데이터의 정교한 처리 필요 |

관련 코드: [ai_server/api/agent.py](ai_server/api/agent.py), [ai_server/api/generation.py](ai_server/api/generation.py)

### 2. 정규식 전처리를 활용한 다화자(Multi-speaker) TTS 파이프라인

단일 화자만 지원하는 기본 TTS의 한계를 극복하고, 실제 수능 영어 듣기 평가와 유사한 음성 환경을 구현했습니다.

**처리 흐름:**

```
대본 텍스트 입력
       │
       ▼
정규표현식 전처리
(M: / W: / Man: / Woman: 패턴으로 화자 식별 및 분리)
       │
       ▼
Azure TTS-HD 다중 음성 합성
  ├─ 나레이션 : alloy
  ├─ 남성 대화 : echo
  └─ 여성 대화 : fable
       │
       ▼
음성 세그먼트 병합 → WAV 데이터 URI 반환
```

관련 코드: [ai_server/api/tts.py](ai_server/api/tts.py), [ai_server/services/azure_client.py](ai_server/services/azure_client.py), [ai_server/services/tts_utils.py](ai_server/services/tts_utils.py)

### 3. AI 추론 서버 구조 설계

```
ai_server/
├── main.py              # FastAPI 앱 생성 및 라우터 등록
├── api/
│   ├── agent.py         # 해설·질의응답 에이전트 엔드포인트
│   ├── generation.py    # 맞춤형 문제 생성 엔드포인트
│   └── tts.py           # 다화자 TTS 엔드포인트
├── core/
│   ├── config.py        # 환경 변수 및 Azure 설정
│   └── schemas.py       # Pydantic 요청/응답 스키마
└── services/
    ├── agent_service.py  # LangChain 에이전트 관리
    ├── azure_client.py   # Azure OpenAI / TTS 클라이언트
    └── tts_utils.py      # 정규식 전처리 및 오디오 병합 유틸
```

---

## 로컬 실행 방법

### 1. AI 추론 서버 (FastAPI)

```powershell
# 가상환경 생성 및 패키지 설치
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r ai_server/requirements.txt

# 환경 변수 설정
# ai_server/.env 파일을 생성하고 Azure 자격증명 입력
# (필요한 변수 목록은 ai_server/core/config.py 참고)

# 서버 실행 (포트 8001)
uvicorn ai_server.main:app --reload --port 8001
```

서버 실행 후 http://localhost:8001/docs 에서 Swagger API 문서를 확인할 수 있습니다.

### 2. 웹 서버 (Next.js)

```powershell
npm install
npm run dev
```

Next.js 앱은 기본적으로 `http://localhost:8001`에서 AI 서버를 참조합니다.  
변경이 필요한 경우 Next.js 환경 변수에서 `AI_SERVER_BASE`를 수정하세요.
