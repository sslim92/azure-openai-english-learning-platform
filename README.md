ublic# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Local AI server (Python) — Azure OpenAI / Speech proxy

1. Create and activate a virtualenv, then install dependencies:

```powershell
python -m venv .venv; .\.venv\Scripts\Activate; pip install -r ai_server/requirements.txt
```

2. Copy `ai_server/.env.example` to `ai_server/.env` and fill your Azure credentials.

3. Run the server:

```powershell
uvicorn ai_server.app:app --reload --port 8001
```

The Next.js app expects the AI server at http://localhost:8001 by default. You can change this by setting the `AI_SERVER_BASE` env var in your Next.js environment.
