"""ai_server/services/azure_helpers.py

Azure REST 호출 공통 유틸과 응답 파싱.
"""
from __future__ import annotations

import json
from typing import Dict, Tuple

from .config import AZURE_KEY, AZURE_ENDPOINT


def azure_headers() -> Dict[str, str]:
    return {"api-key": AZURE_KEY or "", "Content-Type": "application/json"}


def azure_base() -> str:
    return (AZURE_ENDPOINT or "").rstrip("/")


def extract_model_content(response_json: dict) -> Tuple[str, dict | None]:
    """Chat Completions 응답에서 텍스트를 추출하고 JSON 파싱을 시도한다."""
    try:
        choices = response_json.get("choices") or []
        if len(choices) > 0:
            first = choices[0]
            msg = None
            if isinstance(first, dict):
                if "message" in first and isinstance(first["message"], dict):
                    msg = first["message"].get("content")
                elif "text" in first:
                    msg = first.get("text")
            if msg is None:
                msg = str(first)
            raw = msg
            try:
                parsed = json.loads(raw)
                return raw, parsed
            except Exception:
                return raw, None
    except Exception:
        pass
    return "", None
