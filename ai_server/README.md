AI server (FastAPI) to proxy AI-related flows and call Azure OpenAI GPT models.

Setup

1. Create a Python 3.10+ virtualenv and install dependencies:

   python -m venv .venv; .\.venv\Scripts\Activate; pip install -r requirements.txt

2. Create a `.env` file in `ai_server/` with the following variables:

   AZURE_OPENAI_ENDPOINT=<your_azure_openai_endpoint>
   AZURE_OPENAI_KEY=<your_api_key>
   AZURE_OPENAI_DEPLOYMENT=<deployment_or_model_name>
   AZURE_SPEECH_KEY=<your_azure_speech_key>
   AZURE_SPEECH_REGION=<your_azure_speech_region>

Run

uvicorn ai_server.app:app --reload --port 8001

Endpoints

- POST /v1/generate-audio
- POST /v1/extract-questions
- POST /v1/match-scripts
- POST /v1/generate-similar
- POST /v1/analyze-mistake
- POST /v1/conversational-tutor

