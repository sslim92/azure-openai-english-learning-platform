from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import requests

load_dotenv()

AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_OPENAI_KEY")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")

# Azure Speech (TTS) settings
AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION")

if not AZURE_ENDPOINT or not AZURE_KEY or not AZURE_DEPLOYMENT:
    raise RuntimeError("Please set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT in .env")

app = FastAPI()

headers = {
    'api-key': AZURE_KEY,
    'Content-Type': 'application/json'
}

class TTSRequest(BaseModel):
    text: str

@app.post('/v1/generate-audio')
async def generate_audio(req: TTSRequest):
    # Use Azure Speech REST TTS to generate audio (wav) and return as data URI
    if not AZURE_SPEECH_KEY or not AZURE_SPEECH_REGION:
        raise HTTPException(status_code=500, detail='Azure Speech credentials not set (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)')
    try:
        tts_url = f"https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
        tts_headers = {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm'
        }
        # Simple SSML with default voice; in production allow config
        ssml = f"""<speak version='1.0' xml:lang='en-US'>
  <voice xml:lang='en-US' xml:gender='Female' name='en-US-AriaNeural'>
    {req.text}
  </voice>
</speak>"""
        resp = requests.post(tts_url, headers=tts_headers, data=ssml.encode('utf-8'), timeout=60)
        resp.raise_for_status()
        audio_bytes = resp.content
        import base64
        wav_b64 = base64.b64encode(audio_bytes).decode('ascii')
        data_uri = f"data:audio/wav;base64,{wav_b64}"
        return {"audioDataUri": data_uri}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GenericRequest(BaseModel):
    input: dict

@app.post('/v1/generate-similar')
async def generate_similar(req: GenericRequest):
    # proxy example to completions - replace with chat completions if needed
    try:
        prompt = req.input.get('prompt')
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
        body = {"messages": [{"role":"user","content": prompt}], "max_tokens": 512}
        resp = requests.post(url, headers=headers, json=body, timeout=120)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/v1/conversational-tutor')
async def conversational_tutor(req: GenericRequest):
    try:
        messages = req.input.get('messages')
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
        body = {
            "messages": messages,
            "max_tokens": 512,
            "temperature": 0.2
        }
        resp = requests.post(url, headers=headers, json=body, timeout=120)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/v1/extract-questions')
async def extract_questions(req: GenericRequest):
    # pass-through to model; real impl should craft a strong prompt
    try:
        prompt = req.input.get('prompt')
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
        body = {"messages": [{"role":"user","content": prompt}], "max_tokens": 1500}
        resp = requests.post(url, headers=headers, json=body, timeout=180)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/v1/match-scripts')
async def match_scripts(req: GenericRequest):
    try:
        prompt = req.input.get('prompt')
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
        body = {"messages": [{"role":"user","content": prompt}], "max_tokens": 1500}
        resp = requests.post(url, headers=headers, json=body, timeout=180)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/v1/analyze-mistake')
async def analyze_mistake(req: GenericRequest):
    try:
        prompt = req.input.get('prompt')
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-06-01"
        body = {"messages": [{"role":"user","content": prompt}], "max_tokens": 1000}
        resp = requests.post(url, headers=headers, json=body, timeout=120)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
