"""
문제 생성 라우터

영어 문제 생성 및 오답 분석 기능을 제공하는 엔드포인트들을 정의합니다.
"""

import json
from fastapi import APIRouter, HTTPException
import requests
from pydantic import ValidationError

from ..schemas import GenericRequest, AnalyzeMistakeResult, QuestionOut, AgentChatRequest
from ..services.azure_helpers import azure_base, azure_headers, extract_model_content
from ..services.llm import JSON_ONLY_INSTRUCTIONS
from .agent import agent_chat  # 대화형 튜터를 위한 재사용


router = APIRouter()


def _format_prompt_data(data):
    """
    프롬프트 데이터를 텍스트로 변환하는 공통 함수
    
    Args:
        data: 변환할 데이터
        
    Returns:
        포맷된 텍스트 문자열
    """
    if isinstance(data, str):
        return data
    
    if isinstance(data, dict):
        # 우선순위가 높은 키들 먼저 처리
        priority_keys = [
            "questionContext", "questionText", "topic", 
            "userAnswerText", "userReason", "explanation", "difficulty"
        ]
        
        parts = []
        # 우선순위 키 처리
        for key in priority_keys:
            if key in data and data.get(key) is not None:
                parts.append(f"{key}: {data.get(key)}")
        
        # 나머지 키들 처리
        for key in sorted(data.keys()):
            if key not in priority_keys and data.get(key) is not None:
                parts.append(f"{key}: {data.get(key)}")
        
        return "\n".join(parts)
    
    # 기타 타입은 JSON 문자열로 변환 시도
    try:
        return json.dumps(data, ensure_ascii=False)
    except Exception:
        return str(data)


async def _call_azure_openai(messages, max_tokens=512):
    """
    Azure OpenAI API 호출 공통 함수
    
    Args:
        messages: 대화 메시지 목록
        max_tokens: 최대 토큰 수
        
    Returns:
        (원본 응답, 파싱된 JSON 또는 None)
    """
    try:
        base = azure_base()
        from ..services.config import AZURE_DEPLOYMENT, AZURE_API_VERSION
        url = f"{base}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"
        
        body = {
            "messages": messages,
            "max_tokens": max_tokens
        }
        
        resp = requests.post(url, headers=azure_headers(), json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        
        return extract_model_content(data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Azure OpenAI API 호출 실패: {str(e)}")


@router.post('/v1/generate-similar')
async def generate_similar(req: GenericRequest):
    """
    유사 문제 생성 엔드포인트
    
    Args:
        req: 문제 생성 요청 데이터
        
    Returns:
        생성된 문제 데이터 또는 원본 응답
    """
    try:
        # 프롬프트 데이터 포맷팅
        prompt = _format_prompt_data(req.input.get('prompt'))
        
        # 시스템 메시지 구성
        system_message = (
            JSON_ONLY_INSTRUCTIONS + 
            " Output must conform to the Question schema with fields: "
            "id, year, month, intent, topic, questionText, passage, "
            "options[{id,text}], correctOptionId, explanation, "
            "difficulty(=Easy|Medium|Hard), listeningScript(optional), "
            "generationReason(optional)."
        )
        
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ]
        
        # API 호출
        raw, parsed = await _call_azure_openai(messages, max_tokens=512)
        
        # 스키마 검증 시도
        if parsed is not None:
            try:
                question = QuestionOut.model_validate(parsed)
                return question.model_dump()
            except ValidationError:
                pass
        
        return {"raw": raw}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"문제 생성 중 오류: {str(e)}")


@router.post('/v1/analyze-mistake')
async def analyze_mistake(req: GenericRequest):
    """
    오답 분석 및 맞춤 문제 생성 엔드포인트
    
    Args:
        req: 오답 분석 요청 데이터
        
    Returns:
        약점 분석 결과 및 생성된 문제 데이터
    """
    try:
        # 프롬프트 데이터 포맷팅
        prompt = _format_prompt_data(req.input.get('prompt'))
        
        # 시스템 메시지 구성
        system_message = (
            JSON_ONLY_INSTRUCTIONS + 
            " Output must conform to the AnalyzeMistakeResult schema with fields: "
            "weaknessAnalysis, generatedQuestion (Question schema: "
            "id, year, month, intent, topic, questionText, passage, "
            "options[{id,text}], correctOptionId, explanation, "
            "difficulty=Easy|Medium|Hard, listeningScript(optional), "
            "generationReason(optional))."
        )
        
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ]
        
        # API 호출
        raw, parsed = await _call_azure_openai(messages, max_tokens=1000)
        
        # 스키마 검증 시도
        if parsed is not None:
            try:
                result = AnalyzeMistakeResult.model_validate(parsed)
                return result.model_dump()
            except ValidationError:
                pass
        
        return {"raw": raw}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"오답 분석 중 오류: {str(e)}")


@router.post('/v1/conversational-tutor')
async def conversational_tutor(req: GenericRequest):
    """
    대화형 튜터 엔드포인트 (레거시 호환성)
    
    Args:
        req: 대화 요청 데이터
        
    Returns:
        튜터 응답 메시지
    """
    try:
        # 메시지 추출
        messages = req.input.get('messages', [])
        
        # AgentChatRequest로 변환하여 기존 로직 재사용
        agent_req = AgentChatRequest(agent="tutor", messages=messages)
        result = await agent_chat(agent_req)
        
        # 메시지 내용만 반환 (레거시 호환성)
        return result.get("message", "")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"대화형 튜터 처리 중 오류: {str(e)}")
