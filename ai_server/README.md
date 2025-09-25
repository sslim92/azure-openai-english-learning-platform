AI server (FastAPI) to proxy AI-related flows and call Azure OpenAI GPT models via LangChain.

## Setup

1) Create a Python 3.10+ virtualenv and install dependencies (PowerShell):

```
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
```

2) Create a `.env` file in `ai_server/` with the following variables (update with your values):

```
# Azure OpenAI (Chat)
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
AZURE_OPENAI_API_KEY=YOUR_AZURE_OPENAI_KEY
AZURE_OPENAI_DEPLOYMENT_NAME_4O_MINI=YOUR_CHAT_DEPLOYMENT_NAME
AZURE_OPENAI_API_VERSION=2024-06-01

# Azure Speech / TTS (optional unless you call /v1/generate-audio)
AZURE_SPEECH_ENDPOINT=https://YOUR-SPEECH-RESOURCE.openai.azure.com
AZURE_SPEECH_KEY=YOUR_AZURE_SPEECH_KEY
AZURE_OPENAI_TTS_DEPLOYMENT_NAME=YOUR_TTS_DEPLOYMENT_NAME
AZURE_OPENAI_TTS_API_VERSION=2025-03-01-preview
AZURE_OPENAI_TTS_VOICE=alloy
```

Note: Variable names above match `ai_server/services/config.py`.

## Run (from repo root)

Run uvicorn from the project root so that `ai_server` is imported as a package:

```
uvicorn ai_server.app:app --reload --port 8001
```

Swagger UI: http://localhost:8001/docs

## Endpoints

- POST /v1/generate-audio
- POST /v1/generate-similar
- POST /v1/analyze-mistake
- POST /v1/conversational-tutor (backward-compatible; proxies to agent)
- POST /v1/agent-chat (LangChain agent multi-turn chat)

## Agent chat request shape

```
{
  "agent": "tutor",              // optional, defaults to "tutor"
  "messages": [ { "role": "user"|"assistant"|"system", "content": "..." }, ... ],
  "context": {
    "questionContext": "optional string",
    "weaknessAnalysis": "optional string"
  },
  "input": "current user input (optional)",
  "temperature": 0.2
}
```

Response: `{ "message": "assistant text" }`

