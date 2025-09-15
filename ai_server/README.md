AI server (FastAPI) to proxy AI-related flows and call Azure OpenAI GPT models via LangChain.

Setup

1. Create a Python 3.10+ virtualenv and install dependencies:

   python -m venv .venv; .\.venv\Scripts\Activate; pip install -r requirements.txt

2. Create a `.env` file in `ai_server/` with the following variables:

   AZURE_OPENAI_ENDPOINT=<your_azure_openai_endpoint>
   AZURE_OPENAI_KEY=<your_api_key>
   AZURE_OPENAI_CHAT_DEPLOYMENT=<your_azure_chat_deployment_name>
   AZURE_OPENAI_API_VERSION=2024-06-01
   AZURE_SPEECH_KEY=<your_azure_speech_key>
   AZURE_SPEECH_REGION=<your_azure_speech_region>

Run

uvicorn ai_server.app:app --reload --port 8001

Endpoints

- POST /v1/generate-audio
- POST /v1/generate-similar
- POST /v1/analyze-mistake
- POST /v1/conversational-tutor (backward-compatible; proxies to agent)
- POST /v1/agent-chat (LangChain agent multi-turn chat)

Agent chat request shape

{
   "agent": "tutor",              // optional, defaults to "tutor"
   "messages": [ {"role":"user"|"assistant"|"system", "content":"..."}, ... ],
   "context": {
      "questionContext": "optional string",
      "weaknessAnalysis": "optional string"
   },
   "input": "current user input (optional)",
   "temperature": 0.2
}

Response: { "message": "assistant text" }

