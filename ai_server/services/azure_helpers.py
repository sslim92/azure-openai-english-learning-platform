"""
Azure OpenAI API 헬퍼 유틸리티

Azure OpenAI REST API 호출을 위한 공통 유틸리티 함수들을 제공합니다.
API 인증 헤더 생성, 응답 파싱 등의 기능을 포함합니다.
"""

import json
from typing import Dict, Tuple

from .config import AZURE_KEY, AZURE_ENDPOINT


def azure_headers() -> Dict[str, str]:
    """
    Azure OpenAI API 호출용 헤더 생성
    
    Returns:
        API 키와 콘텐츠 타입이 포함된 헤더 딕셔너리
    """
    return {
        "api-key": AZURE_KEY or "", 
        "Content-Type": "application/json"
    }


def azure_base() -> str:
    """
    Azure OpenAI 기본 엔드포인트 URL 반환
    
    Returns:
        슬래시가 제거된 기본 엔드포인트 URL
    """
    return (AZURE_ENDPOINT or "").rstrip("/")


def extract_model_content(response_json: dict) -> Tuple[str, dict | None]:
    """
    Azure OpenAI API 응답에서 콘텐츠 추출 및 JSON 파싱 시도
    
    Chat Completions API 응답에서 텍스트를 추출하고,
    가능한 경우 JSON으로 파싱을 시도합니다.
    
    Args:
        response_json: Azure OpenAI API 응답 JSON
        
    Returns:
        (원본 텍스트, 파싱된 JSON 또는 None)
    """
    try:
        choices = response_json.get("choices") or []
        if not choices:
            return "", None
            
        first_choice = choices[0]
        content = None
        
        # 응답 구조에 따라 콘텐츠 추출
        if isinstance(first_choice, dict):
            if "message" in first_choice and isinstance(first_choice["message"], dict):
                content = first_choice["message"].get("content")
            elif "text" in first_choice:
                content = first_choice.get("text")
        
        if content is None:
            content = str(first_choice)
        
        raw_text = content
        
        # JSON 파싱 시도
        try:
            parsed_json = json.loads(raw_text)
            return raw_text, parsed_json
        except json.JSONDecodeError:
            return raw_text, None
            
    except Exception:
        return "", None
