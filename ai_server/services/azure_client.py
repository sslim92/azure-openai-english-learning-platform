"""
Azure OpenAI 서비스 클라이언트

Azure OpenAI API와의 통신을 담당하는 클래스들을 정의합니다.
채팅 완성과 음성합성 기능을 제공합니다.
"""

import json
import base64
import re
import os
from typing import Dict, List, Any, Optional, Tuple

import requests
from fastapi import HTTPException

from ai_server.core.config import (
    AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION,
    AZURE_TTS_ENDPOINT, AZURE_TTS_API_KEY, AZURE_TTS_DEPLOYMENT, AZURE_TTS_API_VERSION, AZURE_TTS_VOICE,
    AZURE_QUESTION_MODEL_DEPLOYMENT, AZURE_QUESTION_MODEL_VERSION, AZURE_QUESTION_MODEL_ENDPOINT
)


class BaseAzureClient:
    """Azure OpenAI 클라이언트 기본 클래스"""
    
    def __init__(self, endpoint: str, api_key: str, deployment: str, api_version: str):
        """기본 클라이언트 초기화"""
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.deployment = deployment
        self.api_version = api_version
    
    def _get_headers(self) -> Dict[str, str]:
        """API 호출용 헤더 생성"""
        return {
            "api-key": self.api_key,
            "Content-Type": "application/json"
        }
    
    def _build_chat_url(self) -> str:
        """채팅 완성 API URL 생성"""
        return f"{self.endpoint}/openai/deployments/{self.deployment}/chat/completions?api-version={self.api_version}"
    
    def _extract_content(self, response_data: Dict[str, Any]) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        API 응답에서 콘텐츠 추출 및 JSON 파싱 시도
        
        Args:
            response_data: API 응답 데이터
            
        Returns:
            (원본 텍스트, 파싱된 JSON 또는 None)
        """
        try:
            choices = response_data.get("choices", [])
            if not choices:
                return "", None
            
            message = choices[0].get("message", {})
            content = message.get("content", "")
            
            # JSON 파싱 시도
            try:
                parsed_json = json.loads(content)
                return content, parsed_json
            except json.JSONDecodeError:
                return content, None
                
        except Exception:
            return "", None


class AzureOpenAIClient(BaseAzureClient):
    """Azure OpenAI 채팅 완성 클라이언트 (멀티턴 대화용)"""
    
    def __init__(self):
        """클라이언트 초기화"""
        super().__init__(
            AZURE_OPENAI_ENDPOINT, 
            AZURE_OPENAI_API_KEY, 
            AZURE_OPENAI_DEPLOYMENT, 
            AZURE_OPENAI_API_VERSION
        )
    
    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        max_tokens: int = 512,
        temperature: float = 0.2
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        채팅 완성 API 호출 (랭체인 기반 멀티턴 대화용)
        
        Args:
            messages: 대화 메시지 목록
            max_tokens: 최대 토큰 수
            temperature: 창의성 수준
            
        Returns:
            (원본 응답 텍스트, 파싱된 JSON 객체)
        """
        try:
            url = self._build_chat_url()
            payload = {
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
            
            response = requests.post(
                url, 
                headers=self._get_headers(), 
                json=payload, 
                timeout=120
            )
            response.raise_for_status()
            
            return self._extract_content(response.json())
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Azure OpenAI API 호출 실패: {str(e)}")


class AzureQuestionGenerationClient(BaseAzureClient):
    """Azure OpenAI 문제 생성 전용 클라이언트 (단일 요청용)"""
    
    def __init__(self):
        """클라이언트 초기화"""
        super().__init__(
            AZURE_QUESTION_MODEL_ENDPOINT, 
            AZURE_TTS_API_KEY, 
            AZURE_QUESTION_MODEL_DEPLOYMENT,  # 문제 생성 전용 배포 또는 기본값
            AZURE_QUESTION_MODEL_VERSION
        )
    
    async def generate_question(
        self, 
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1024,
        temperature: float = 0.3
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        문제 생성 API 호출 (단일 1회성 응답)
        
        Args:
            system_prompt: 시스템 프롬프트 (문제 생성 지시사항)
            user_prompt: 사용자 프롬프트 (문제 생성 요구사항)
            max_tokens: 최대 토큰 수
            temperature: 창의성 수준
            
        Returns:
            (원본 응답 텍스트, 파싱된 JSON 객체)
        """
        try:
            url = self._build_chat_url()
            
            # 단일 요청용 메시지 구성
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            payload = {
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
            
            response = requests.post(
                url, 
                headers=self._get_headers(), 
                json=payload, 
                timeout=120
            )
            response.raise_for_status()
            
            return self._extract_content(response.json())
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Azure OpenAI 문제 생성 API 호출 실패: {str(e)}")


class AzureTTSClient:
    """Azure TTS(음성합성) 클라이언트"""
    
    def __init__(self):
        """클라이언트 초기화"""
        self.endpoint = AZURE_TTS_ENDPOINT
        self.api_key = AZURE_TTS_API_KEY
        self.deployment = AZURE_TTS_DEPLOYMENT
        self.api_version = AZURE_TTS_API_VERSION
        self.voice = AZURE_TTS_VOICE
    
    def _validate_config(self):
        """TTS 설정값 검증"""
        if not self.endpoint:
            raise HTTPException(status_code=500, detail="TTS 엔드포인트가 설정되지 않았습니다.")
        if not self.api_key:
            raise HTTPException(status_code=500, detail="TTS API 키가 설정되지 않았습니다.")
    
    def _build_url_and_model(self) -> Tuple[str, str]:
        """
        TTS API URL 및 모델명 생성
        
        Returns:
            (API URL, 모델명)
        """
        endpoint = self.endpoint.strip()
        
        # 전체 URL이 이미 제공된 경우 (예: .env에서 완전한 URL 설정)
        if "/openai/deployments/" in endpoint and "/audio/speech" in endpoint:
            url = endpoint
            if "api-version=" not in url:
                separator = "&" if "?" in url else "?"
                url = f"{url}{separator}api-version={self.api_version}"
            
            # URL에서 모델명 추출
            match = re.search(r"/deployments/([^/]+)/audio/speech", url)
            model_name = match.group(1) if match else self.deployment
            
            return url, model_name
        else:
            # URL 조립 필요 (기본 엔드포인트만 제공된 경우)
            if not self.deployment:
                raise HTTPException(status_code=500, detail="TTS 배포명이 설정되지 않았습니다.")
            
            base_url = endpoint.rstrip("/")
            url = f"{base_url}/openai/deployments/{self.deployment}/audio/speech?api-version={self.api_version}"
            model_name = self.deployment
            
            return url, model_name
    
    def synthesize_speech(self, text: str) -> str:
        """
        텍스트를 음성으로 변환하여 데이터 URI 반환
        
        Args:
            text: 변환할 텍스트
            
        Returns:
            WAV 오디오 데이터 URI
        """
        self._validate_config()
        
        try:
            url, model_name = self._build_url_and_model()
            
            headers = {
                "api-key": self.api_key,
                "Content-Type": "application/json",
                "Accept": "audio/wav"
            }
            
            payload = {
                "model": model_name,
                "voice": self.voice,
                "input": text
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=120)
            
            if not response.ok:
                error_detail = response.text[:500] if response.text else "알 수 없는 오류"
                raise HTTPException(
                    status_code=500, 
                    detail=f"TTS API 호출 실패 (상태코드: {response.status_code}): {error_detail}"
                )
            
            # 응답 내용 검증
            if len(response.content) == 0:
                raise HTTPException(status_code=500, detail="TTS API가 빈 응답을 반환했습니다.")
            
            # 오디오 데이터를 Base64로 인코딩하여 데이터 URI 생성
            audio_bytes = response.content
            audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
            return f"data:audio/wav;base64,{audio_base64}"
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"TTS 변환 중 오류 발생: {str(e)}")