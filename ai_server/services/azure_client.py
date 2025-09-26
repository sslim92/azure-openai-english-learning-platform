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
from openai import OpenAI
from fastapi import HTTPException

from ai_server.core.config import (
    AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION,
    AZURE_TTS_ENDPOINT, AZURE_TTS_API_KEY, AZURE_TTS_DEPLOYMENT, AZURE_TTS_API_VERSION, AZURE_TTS_VOICE,
    AZURE_QUESTION_MODEL_DEPLOYMENT, AZURE_QUESTION_MODEL_VERSION, AZURE_QUESTION_MODEL_ENDPOINT
)
from ai_server.services.tts_utils import (
    detect_gender_and_voice, split_dialogue_by_speaker, should_use_dialogue_processing, combine_audio_segments
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


class AzureQuestionGenerationClient:
    """Azure OpenAI 문제 생성 전용 클라이언트 (OpenAI SDK 사용)"""
    
    def __init__(self):
        """클라이언트 초기화"""
        self.client = OpenAI(
            api_key=AZURE_TTS_API_KEY,  # 문제 생성용 API 키
            base_url=AZURE_QUESTION_MODEL_ENDPOINT
        )
        self.deployment = AZURE_QUESTION_MODEL_DEPLOYMENT
    
    async def generate_question(
        self, 
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 1024,
        temperature: float = 1
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        문제 생성 API 호출 (OpenAI SDK 사용)
        
        Args:
            system_prompt: 시스템 프롬프트 (문제 생성 지시사항)
            user_prompt: 사용자 프롬프트 (문제 생성 요구사항)
            max_tokens: 최대 토큰 수
            temperature: 창의성 수준
            
        Returns:
            (원본 응답 텍스트, 파싱된 JSON 객체)
        """
        try:
            # 메시지 구성
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # OpenAI SDK를 사용한 채팅 완성 호출 (동기 방식)
            response = self.client.chat.completions.create(
                model=self.deployment,  # gpt-5-test
                messages=messages,
                max_completion_tokens=max_tokens,  # max_tokens 대신 max_completion_tokens 사용
                temperature=temperature  # 전달받은 temperature 사용
            )
            
            # 응답에서 콘텐츠 추출
            if not response.choices:
                return "응답에 선택지가 없습니다.", None
                
            choice = response.choices[0]
            message = choice.message
            content = message.content if message else ""
            
            # JSON 파싱 시도
            parsed_json = None
            if content:
                try:
                    parsed_json = json.loads(content)
                except (json.JSONDecodeError, TypeError):
                    # JSON 파싱 실패시 원본 텍스트만 반환
                    pass
            
            return content or "빈 응답을 받았습니다.", parsed_json
            
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
    
    def synthesize_speech(
        self, 
        text: str, 
        auto_detect_gender: bool = True, 
        default_voice: str = "alloy"
    ) -> str:
        """
        텍스트를 음성으로 변환하여 데이터 URI 반환
        
        Args:
            text: 변환할 텍스트
            auto_detect_gender: 텍스트에서 성별을 자동 감지할지 여부
            default_voice: 기본 음성 설정
            
        Returns:
            WAV 오디오 데이터 URI
        """
        self._validate_config()
        
        print(f"[TTS DEBUG] 음성 합성 시작 - 자동감지: {auto_detect_gender}, 기본음성: {default_voice}")
        print(f"[TTS DEBUG] 입력 텍스트: '{text[:100]}...'")
        
        try:
            # 성별 자동 감지가 활성화된 경우
            if auto_detect_gender:
                # 대화형 처리가 필요한지 확인
                if should_use_dialogue_processing(text):
                    print("[TTS DEBUG] 대화형 처리 모드로 전환")
                    return self._synthesize_dialogue(text, default_voice)
                else:
                    # 단일 텍스트에서 성별 감지 시도
                    print("[TTS DEBUG] 단일 텍스트 성별 감지 모드")
                    _, detected_voice = detect_gender_and_voice(text)
                    voice_to_use = detected_voice
                    print(f"[TTS DEBUG] 최종 선택된 음성: {voice_to_use}")
                    return self._synthesize_single_text(text, voice_to_use)
            else:
                # 자동 감지 비활성화 - 기본 음성 사용
                print(f"[TTS DEBUG] 자동 감지 비활성화 - 기본 음성 사용: {default_voice}")
                return self._synthesize_single_text(text, default_voice)
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"[TTS DEBUG] 음성 합성 오류: {str(e)}")
            raise HTTPException(status_code=500, detail=f"TTS 변환 중 오류 발생: {str(e)}")
    
    def _synthesize_dialogue(self, text: str, default_voice: str) -> str:
        """
        대화 텍스트를 성별별로 분할하여 음성 합성 후 합치기
        
        Args:
            text: 대화 텍스트
            default_voice: 기본 음성
            
        Returns:
            합성된 오디오 데이터 URI
        """
        dialogue_parts = split_dialogue_by_speaker(text)
        
        if len(dialogue_parts) == 1:
            # 단일 발화자인 경우
            text_part, voice = dialogue_parts[0]
            print(f"[TTS DEBUG] 단일 발화자 - 음성: {voice}")
            return self._synthesize_single_text(text_part, voice)
        else:
            # 여러 발화자가 있는 경우 - 각각 따로 합성하여 합치기
            print(f"[TTS DEBUG] 다중 발화자 ({len(dialogue_parts)}명) - 각각 합성 후 합치기")
            audio_segments = []
            
            for i, (text_part, voice) in enumerate(dialogue_parts, 1):
                print(f"[TTS DEBUG] 발화자 {i} 처리 중 - 음성: {voice}, 텍스트: '{text_part[:30]}...'")
                try:
                    audio_data_uri = self._synthesize_single_text(text_part, voice)
                    audio_segments.append(audio_data_uri)
                    print(f"[TTS DEBUG] 발화자 {i} 음성 생성 완료")
                except Exception as e:
                    print(f"[TTS DEBUG] 발화자 {i} 음성 생성 실패: {str(e)}")
                    # 실패한 경우 기본 음성으로 재시도
                    try:
                        audio_data_uri = self._synthesize_single_text(text_part, default_voice)
                        audio_segments.append(audio_data_uri)
                        print(f"[TTS DEBUG] 발화자 {i} 기본 음성으로 재생성 완료")
                    except Exception as e2:
                        print(f"[TTS DEBUG] 발화자 {i} 기본 음성 재시도도 실패: {str(e2)}")
                        continue
            
            if not audio_segments:
                # 모든 세그먼트 생성 실패 시 전체 텍스트를 기본 음성으로 처리
                print("[TTS DEBUG] 모든 세그먼트 실패 - 전체 텍스트를 기본 음성으로 처리")
                return self._synthesize_single_text(text, default_voice)
            
            # 오디오 세그먼트들을 합치기
            return combine_audio_segments(audio_segments)
    
    def _synthesize_single_text(self, text: str, voice: str) -> str:
        """
        단일 텍스트를 지정된 음성으로 합성
        
        Args:
            text: 합성할 텍스트
            voice: 사용할 음성 이름
            
        Returns:
            WAV 오디오 데이터 URI
        """
        print(f"[TTS DEBUG] API 호출 준비 - 음성: {voice}, 텍스트 길이: {len(text)}")
        
        url, model_name = self._build_url_and_model()
        
        headers = {
            "api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "audio/wav"
        }
        
        print(f"[TTS DEBUG] 요청 헤더: {headers}")
        
        payload = {
            "model": model_name,
            "voice": voice,
            "input": text,
            "response_format": "wav"
        }
        
        print(f"[TTS DEBUG] API 요청 - URL: {url}, 모델: {model_name}, 음성: {voice}")
        
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        
        if not response.ok:
            error_detail = response.text[:500] if response.text else "알 수 없는 오류"
            print(f"[TTS DEBUG] API 호출 실패 - 상태코드: {response.status_code}, 오류: {error_detail}")
            raise HTTPException(
                status_code=500, 
                detail=f"TTS API 호출 실패 (상태코드: {response.status_code}): {error_detail}"
            )
        
        # 응답 내용 검증
        if len(response.content) == 0:
            print("[TTS DEBUG] API가 빈 응답을 반환함")
            raise HTTPException(status_code=500, detail="TTS API가 빈 응답을 반환했습니다.")
        
        print(f"[TTS DEBUG] API 호출 성공 - 응답 크기: {len(response.content)} bytes")
        
        # 오디오 데이터 형식 확인
        audio_bytes = response.content
        if len(audio_bytes) >= 4:
            header = audio_bytes[:4]
            print(f"[TTS DEBUG] 오디오 헤더: {header} (hex: {header.hex()})")
            if header == b'RIFF':
                print("[TTS DEBUG] WAV 형식 확인됨")
            elif header.startswith(b'\xff\xfb') or header.startswith(b'\xff\xf3') or header.startswith(b'\xff\xf2'):
                print("[TTS DEBUG] MP3 형식으로 추정됨")
            else:
                print(f"[TTS DEBUG] 알 수 없는 오디오 형식 - 첫 16바이트: {audio_bytes[:16].hex()}")
        
        # 오디오 데이터를 Base64로 인코딩하여 데이터 URI 생성
        audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
        return f"data:audio/wav;base64,{audio_base64}"