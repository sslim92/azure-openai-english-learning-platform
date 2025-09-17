"""
TTS(텍스트 음성 변환) 서비스

Azure TTS API를 사용하여 텍스트를 음성으로 변환하는 기능을 제공합니다.
"""

from ai_server.services.azure_client import AzureTTSClient


class TTSService:
    """TTS 서비스 클래스"""
    
    def __init__(self):
        """서비스 초기화"""
        self.client = AzureTTSClient()
    
    def text_to_speech(self, text: str) -> str:
        """
        텍스트를 음성으로 변환
        
        Args:
            text: 변환할 텍스트
            
        Returns:
            WAV 오디오 데이터 URI 문자열
        """
        try:
            return self.client.synthesize_speech(text)
        except Exception as e:
            raise Exception(f"음성 변환 중 오류 발생: {str(e)}")


# 전역 서비스 인스턴스
tts_service = TTSService()