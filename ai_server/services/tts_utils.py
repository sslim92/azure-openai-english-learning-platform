"""
TTS 관련 유틸리티 함수들

텍스트 분석 및 성별 감지, 음성 선택 등 TTS 처리에 필요한 보조 함수들을 제공합니다.
"""

import re
import base64
import io
import wave
import struct
from typing import List, Tuple, Literal

GenderType = Literal["male", "female", "neutral"]


def detect_gender_and_voice(text: str) -> Tuple[GenderType, str]:
    """
    텍스트에서 성별을 감지하고 적절한 음성을 반환합니다.
    
    지원하는 패턴:
    - M: 또는 Man: 으로 시작하는 경우 -> 남성 (echo)
    - W: 또는 Woman: 으로 시작하는 경우 -> 여성 (nova)
    - 기본값: 중성/나레이션 (alloy)
    
    Args:
        text: 분석할 텍스트
        
    Returns:
        (성별, 음성명) 튜플
    """
    # 텍스트 앞부분의 공백 제거 후 소문자로 변환
    text_lower = text.strip().lower()
    print(f"[TTS DEBUG] 텍스트 분석 중: '{text_lower[:50]}...'")
    
    # 남성 패턴 검사 (M:, Man:, Male:)
    male_patterns = [
        r'^m\s*:',      # M: 또는 M :
        r'^man\s*:',    # Man: 또는 Man :
        r'^male\s*:',   # Male: 또는 Male :
        r'^남자\s*:',    # 남자:
        r'^남성\s*:',    # 남성:
    ]
    
    for pattern in male_patterns:
        if re.match(pattern, text_lower):
            print(f"[TTS DEBUG] 남성 패턴 감지됨: '{pattern}' -> echo 음성 선택")
            return "male", "echo"
    
    # 여성 패턴 검사 (W:, Woman:, Female:)
    female_patterns = [
        r'^w\s*:',      # W: 또는 W :
        r'^woman\s*:',  # Woman: 또는 Woman :
        r'^female\s*:', # Female: 또는 Female :
        r'^여자\s*:',    # 여자:
        r'^여성\s*:',    # 여성:
    ]
    
    for pattern in female_patterns:
        if re.match(pattern, text_lower):
            print(f"[TTS DEBUG] 여성 패턴 감지됨: '{pattern}' -> nova 음성 선택")
            return "female", "nova"
    
    # 기본값은 중성/나레이션 음성
    print(f"[TTS DEBUG] 성별 패턴 감지되지 않음 -> alloy 음성 선택")
    return "neutral", "alloy"


def clean_dialogue_text(text: str) -> str:
    """
    대화 텍스트에서 성별 표시 부분을 제거합니다.
    
    Args:
        text: 정리할 텍스트
        
    Returns:
        성별 표시가 제거된 텍스트
    """
    # 성별 표시 패턴들을 제거
    patterns = [
        r'^(m|w|man|woman|male|female)\s*:\s*',  # 영어 패턴
        r'^(남자|여자|남성|여성)\s*:\s*',            # 한국어 패턴
    ]
    
    cleaned_text = text.strip()
    for pattern in patterns:
        cleaned_text = re.sub(pattern, '', cleaned_text, flags=re.IGNORECASE)
    
    return cleaned_text.strip()


def split_dialogue_by_speaker(text: str) -> List[Tuple[str, str]]:
    """
    대화 텍스트를 화자별로 분할합니다.
    
    Args:
        text: 분할할 대화 텍스트
        
    Returns:
        (정리된 텍스트, 음성명) 튜플의 리스트
    """
    # 줄바꿈으로 분할
    lines = text.split('\n')
    result = []
    
    for line in lines:
        line = line.strip()
        if not line:  # 빈 줄은 건너뛰기
            continue
            
        gender, voice = detect_gender_and_voice(line)
        cleaned_text = clean_dialogue_text(line)
        
        if cleaned_text:  # 정리된 텍스트가 있는 경우만 추가
            result.append((cleaned_text, voice))
    
    # 결과가 없으면 원본 텍스트를 기본 음성으로 처리
    if not result:
        result.append((text, "alloy"))
    
    return result


def should_use_dialogue_processing(text: str) -> bool:
    """
    텍스트가 대화형 처리가 필요한지 판단합니다.
    
    Args:
        text: 판단할 텍스트
        
    Returns:
        대화형 처리가 필요한지 여부
    """
    print(f"[TTS DEBUG] 대화형 처리 필요성 검사: '{text[:50]}...'")
    
    # 줄바꿈이 있는 경우
    if '\n' in text:
        print("[TTS DEBUG] 줄바꿈 감지됨 -> 대화형 처리 필요")
        return True
    
    # 성별 패턴 검사 - 더 정확한 패턴 사용
    patterns = [
        r'(^|\s)(m|w|man|woman|male|female)\s*:',
        r'(^|\s)(남자|여자|남성|여성)\s*:',
        r'^(m|w|man|woman|male|female)\s*:',  # 문장 시작 패턴 추가
        r'^(남자|여자|남성|여성)\s*:',          # 한국어 문장 시작 패턴
    ]
    
    text_lower = text.lower()
    for pattern in patterns:
        if re.search(pattern, text_lower):
            print(f"[TTS DEBUG] 성별 패턴 감지됨: '{pattern}' -> 대화형 처리 필요")
            return True
    
    print("[TTS DEBUG] 대화형 처리 불필요 -> 단일 텍스트 처리")
    return False


def combine_audio_segments(audio_data_uris: List[str]) -> str:
    """
    여러 오디오 데이터 URI를 하나로 합칩니다.
    WAV 헤더 정보가 신뢰할 수 없는 경우 바이트 단위로 직접 합칩니다.
    
    Args:
        audio_data_uris: Base64 인코딩된 오디오 데이터 URI 리스트
        
    Returns:
        합쳐진 오디오의 데이터 URI
    """
    if not audio_data_uris:
        raise ValueError("합칠 오디오가 없습니다.")
    
    if len(audio_data_uris) == 1:
        return audio_data_uris[0]
    
    print(f"[TTS DEBUG] {len(audio_data_uris)}개의 오디오 세그먼트 합치기 시작")
    
    try:
        return _combine_wav_segments_safe(audio_data_uris)
    except Exception as e:
        print(f"[TTS DEBUG] 안전한 WAV 합치기 실패: {str(e)} - 첫 번째 파일만 반환")
        return audio_data_uris[0]


def _combine_wav_segments_safe(audio_data_uris: List[str]) -> str:
    """
    WAV 세그먼트들을 안전하게 합칩니다.
    wave 모듈의 getnframes()가 비정상적인 값을 반환하는 경우를 대비하여
    실제 데이터 크기를 기반으로 처리합니다.
    """
    audio_data_list = []
    wav_header = None
    
    for i, data_uri in enumerate(audio_data_uris):
        try:
            # 데이터 URI에서 Base64 부분 추출
            if "," in data_uri:
                base64_data = data_uri.split(",", 1)[1]
            else:
                base64_data = data_uri
            
            # Base64 디코딩
            audio_bytes = base64.b64decode(base64_data)
            print(f"[TTS DEBUG] 세그먼트 {i+1} 크기: {len(audio_bytes)} bytes")
            
            # 첫 번째 파일에서 WAV 헤더 정보 추출
            if i == 0 and len(audio_bytes) >= 44:  # WAV 헤더는 최소 44바이트
                wav_header = audio_bytes[:44]  # WAV 헤더 부분
                print(f"[TTS DEBUG] WAV 헤더 추출 완료 (44 bytes)")
            
            # WAV 데이터 부분만 추출 (헤더 44바이트 제외)
            if len(audio_bytes) > 44:
                audio_data = audio_bytes[44:]
                audio_data_list.append(audio_data)
                print(f"[TTS DEBUG] 세그먼트 {i+1} 오디오 데이터: {len(audio_data)} bytes")
                
                # 마지막 세그먼트가 아닌 경우 간격 추가 (500ms 무음)
                if i < len(audio_data_uris) - 1:
                    silence_data = _create_silence_data(wav_header, 0.5)  # 0.5초 무음
                    audio_data_list.append(silence_data)
                    print(f"[TTS DEBUG] 세그먼트 {i+1} 후 무음 추가: {len(silence_data)} bytes")
            
        except Exception as e:
            print(f"[TTS DEBUG] 세그먼트 {i+1} 처리 오류: {str(e)}")
            continue
    
    if not audio_data_list or wav_header is None:
        raise ValueError("유효한 오디오 세그먼트가 없습니다.")
    
    # 모든 오디오 데이터를 하나로 합치기
    combined_audio_data = b''.join(audio_data_list)
    
    # 새로운 WAV 파일 크기 계산
    total_size = 36 + len(combined_audio_data)  # 전체 파일 크기 - 8
    data_size = len(combined_audio_data)        # 오디오 데이터 크기
    
    # WAV 헤더의 크기 정보 업데이트
    updated_header = bytearray(wav_header)
    
    # 파일 크기 업데이트 (4-7 바이트)
    updated_header[4:8] = total_size.to_bytes(4, 'little')
    
    # 데이터 크기 업데이트 (40-43 바이트)
    updated_header[40:44] = data_size.to_bytes(4, 'little')
    
    # 최종 WAV 파일 생성
    final_wav_bytes = bytes(updated_header) + combined_audio_data
    
    # Base64 인코딩하여 데이터 URI 생성
    audio_base64 = base64.b64encode(final_wav_bytes).decode("ascii")
    final_data_uri = f"data:audio/wav;base64,{audio_base64}"
    
    print(f"[TTS DEBUG] 오디오 합치기 완료 - 총 크기: {len(final_wav_bytes)} bytes")
    
    return final_data_uri


def _create_silence_data(wav_header: bytes, duration_seconds: float) -> bytes:
    """
    WAV 헤더 정보를 기반으로 무음 데이터를 생성합니다.
    
    Args:
        wav_header: WAV 헤더 데이터 (44바이트)
        duration_seconds: 무음 지속 시간 (초)
        
    Returns:
        무음 오디오 데이터
    """
    try:
        # WAV 헤더에서 필요한 정보 추출
        # 22-23: 채널 수, 24-27: 샘플레이트, 34-35: 비트 깊이
        channels = int.from_bytes(wav_header[22:24], 'little')
        sample_rate = int.from_bytes(wav_header[24:28], 'little')
        bits_per_sample = int.from_bytes(wav_header[34:36], 'little')
        
        # 무음 데이터 크기 계산
        bytes_per_sample = bits_per_sample // 8
        total_samples = int(sample_rate * duration_seconds)
        silence_size = total_samples * channels * bytes_per_sample
        
        # 무음 데이터 생성 (모든 바이트를 0으로)
        silence_data = b'\x00' * silence_size
        
        print(f"[TTS DEBUG] 무음 생성: {duration_seconds}초, {silence_size} bytes")
        return silence_data
        
    except Exception as e:
        print(f"[TTS DEBUG] 무음 생성 오류: {str(e)} - 기본 무음 반환")
        # 기본값: 44.1kHz, 스테레오, 16비트로 가정
        default_size = int(44100 * duration_seconds * 2 * 2)  # 2채널, 2바이트
        return b'\x00' * default_size


def _combine_non_wav_segments(audio_data_uris: List[str]) -> str:
    """
    WAV가 아닌 오디오 세그먼트들을 단순 연결하여 합칩니다.
    실제로는 제대로 된 오디오 합성이 되지 않을 수 있지만, 
    적어도 첫 번째 세그먼트는 재생 가능합니다.
    
    Args:
        audio_data_uris: Base64 인코딩된 오디오 데이터 URI 리스트
        
    Returns:
        첫 번째 오디오의 데이터 URI (임시 방편)
    """
    print("[TTS DEBUG] WAV가 아닌 형식 - 첫 번째 세그먼트만 반환 (임시 방편)")
    return audio_data_uris[0]