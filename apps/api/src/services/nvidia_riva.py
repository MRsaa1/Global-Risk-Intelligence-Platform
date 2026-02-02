"""
NVIDIA Riva Speech AI — TTS (text-to-speech) and STT (speech-to-text).

Used for:
- Voice alerts for critical SENTINEL events
- TTS narration of stress test reports
- Optional voice interface for Command Center

When enable_riva=False or Riva is unavailable, methods return None or raise RivaUnavailable.

Supports:
1. gRPC (nvidia-riva-client) — primary when installed; connect to riva_url host:port (e.g. localhost:50051).
2. HTTP fallback — for NIM Riva REST or custom endpoints (optional).
"""
import base64
import io
import logging
import struct
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

# Optional gRPC client (pip install nvidia-riva-client or pip install .[nvidia])
try:
    import riva.client
    from riva.client import Auth, ASRService, SpeechSynthesisService
    from riva.client.proto.riva_asr_pb2 import RecognitionConfig
    from riva.client.proto.riva_audio_pb2 import AudioEncoding

    RIVA_GRPC_AVAILABLE = True
except ImportError:
    RIVA_GRPC_AVAILABLE = False
    Auth = ASRService = SpeechSynthesisService = RecognitionConfig = AudioEncoding = None  # type: ignore


@dataclass
class TTSResult:
    """Result of text-to-speech."""
    audio_base64: str
    sample_rate_hz: int
    format: str  # e.g. "wav", "pcm"


@dataclass
class STTResult:
    """Result of speech-to-text."""
    text: str
    confidence: float
    language: str


class RivaUnavailableError(Exception):
    """Riva is disabled or service unavailable."""
    pass


def _grpc_uri() -> str:
    """Parse riva_url to gRPC host:port (e.g. http://localhost:50051 -> localhost:50051)."""
    url = (getattr(settings, "riva_url", "http://localhost:50051") or "").strip()
    if not url:
        return "localhost:50051"
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 50051
    return f"{host}:{port}"


def _lang_to_riva(language: str) -> str:
    """Map short language code to Riva language_code (e.g. en -> en-US)."""
    lang = (language or "en").strip().lower()
    mapping = {"en": "en-US", "ru": "ru-RU", "de": "de-DE", "fr": "fr-FR", "es": "es-ES", "zh": "zh-CN"}
    return mapping.get(lang, "en-US")


def _wav_header(sample_rate: int, nchannels: int, sampwidth: int, nframes: int) -> bytes:
    """Build minimal 44-byte WAV header for PCM."""
    nbytes = nframes * nchannels * sampwidth
    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + nbytes))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<HH", 1, nchannels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * nchannels * sampwidth))
    buf.write(struct.pack("<HH", nchannels * sampwidth, sampwidth * 8))
    buf.write(b"data")
    buf.write(struct.pack("<I", nbytes))
    return buf.getvalue()


def _tts_grpc_sync(text: str, language: str) -> Optional[TTSResult]:
    """Synchronous gRPC TTS (run in thread)."""
    if not RIVA_GRPC_AVAILABLE:
        return None
    try:
        uri = _grpc_uri()
        auth = Auth(uri=uri)
        service = SpeechSynthesisService(auth)
        lang_code = _lang_to_riva(language)
        sample_rate_hz = 22050
        resp = service.synthesize(
            text=text,
            voice_name=None,
            language_code=lang_code,
            encoding=AudioEncoding.LINEAR_PCM,
            sample_rate_hz=sample_rate_hz,
        )
        if not resp or not resp.audio:
            return None
        pcm = resp.audio
        nframes = len(pcm) // 2
        header = _wav_header(sample_rate_hz, 1, 2, nframes)
        wav_bytes = header + pcm
        return TTSResult(
            audio_base64=base64.b64encode(wav_bytes).decode("ascii"),
            sample_rate_hz=sample_rate_hz,
            format="wav",
        )
    except Exception as e:
        logger.warning("Riva gRPC TTS failed: %s", e)
        return None


def _stt_grpc_sync(audio_base64: str, language: str) -> Optional[STTResult]:
    """Synchronous gRPC STT (run in thread)."""
    if not RIVA_GRPC_AVAILABLE:
        return None
    try:
        raw = base64.b64decode(audio_base64)
        if len(raw) < 44:
            return None
        # Support raw PCM or WAV (strip 44-byte header)
        if raw[:4] == b"RIFF" and raw[8:12] == b"WAVE":
            # WAV: fmt at 12, sample rate at 24, then data chunk
            sample_rate = struct.unpack("<I", raw[24:28])[0]
            # Find "data" chunk (after "fmt " chunk which is 24 bytes)
            data_pos = raw.find(b"data", 12)
            if data_pos >= 0:
                data_size = struct.unpack("<I", raw[data_pos + 4 : data_pos + 8])[0]
                audio_bytes = raw[data_pos + 8 : data_pos + 8 + data_size]
            else:
                audio_bytes = raw[44:]
                sample_rate = 16000
        else:
            audio_bytes = raw
            sample_rate = 16000
        uri = _grpc_uri()
        auth = Auth(uri=uri)
        service = ASRService(auth)
        config = RecognitionConfig(
            sample_rate_hertz=sample_rate,
            language_code=_lang_to_riva(language),
            enable_automatic_punctuation=True,
        )
        response = service.offline_recognize(audio_bytes, config)
        if not response.results or not response.results[0].alternatives:
            return STTResult(text="", confidence=0.0, language=language)
        alt = response.results[0].alternatives[0]
        return STTResult(
            text=alt.transcript or "",
            confidence=getattr(alt, "confidence", 0.0) or 0.0,
            language=language,
        )
    except Exception as e:
        logger.warning("Riva gRPC STT failed: %s", e)
        return None


def _health_grpc_sync() -> bool:
    """Synchronous gRPC health check (run in thread)."""
    if not RIVA_GRPC_AVAILABLE:
        return False
    try:
        uri = _grpc_uri()
        auth = Auth(uri=uri)
        service = SpeechSynthesisService(auth)
        # Lightweight config request to verify server is up
        from riva.client.proto.riva_tts_pb2 import RivaSynthesisConfigRequest

        service.stub.GetRivaSynthesisConfig(RivaSynthesisConfigRequest(), metadata=auth.get_auth_metadata())
        return True
    except Exception as e:
        logger.debug("Riva gRPC health check failed: %s", e)
        return False


class NVIDIARivaService:
    """
    Service for NVIDIA Riva Speech AI (TTS/STT).

    Uses gRPC (nvidia-riva-client) when available; falls back to HTTP for NIM Riva REST.
    """

    def __init__(self):
        self.enabled = getattr(settings, "enable_riva", False)
        self.base_url = (getattr(settings, "riva_url", "http://localhost:50051") or "").rstrip("/")
        self.tts_model = getattr(settings, "riva_tts_model", "ljspeech")
        self.stt_model = getattr(settings, "riva_stt_model", "nvidia/parakeet-rnnt-1.1b")

    def is_available(self) -> bool:
        """Return True if Riva is enabled and endpoint is configured."""
        return bool(self.enabled and (self.base_url or _grpc_uri()))

    async def tts(self, text: str, language: str = "en") -> Optional[TTSResult]:
        """
        Convert text to speech (for report narration, voice alerts).
        Prefers gRPC when nvidia-riva-client is installed; else tries HTTP.
        """
        if not self.is_available():
            logger.debug("Riva TTS skipped: disabled or no URL")
            return None
        import asyncio

        if RIVA_GRPC_AVAILABLE:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, _tts_grpc_sync, text, language)
            if result is not None:
                return result
        return await self._tts_http(text, language)

    async def _tts_http(self, text: str, language: str) -> Optional[TTSResult]:
        """HTTP fallback for TTS (NIM Riva or custom REST)."""
        try:
            url = f"{self.base_url}/v1/synthesize" if "50051" not in self.base_url else self.base_url.replace("50051", "8009") + "/v1/synthesize"
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    url,
                    json={"text": text, "model": self.tts_model, "language": language},
                )
                if r.status_code != 200:
                    logger.warning("Riva TTS HTTP returned %s: %s", r.status_code, (r.text or "")[:200])
                    return None
                data = r.json()
                audio_b64 = data.get("audio_base64") or data.get("audio")
                if not audio_b64:
                    return None
                return TTSResult(
                    audio_base64=audio_b64,
                    sample_rate_hz=data.get("sample_rate_hz", 22050),
                    format=data.get("format", "wav"),
                )
        except Exception as e:
            logger.warning("Riva TTS HTTP failed: %s", e)
            return None

    async def stt(self, audio_base64: str, language: str = "en") -> Optional[STTResult]:
        """
        Convert speech to text (for voice interface).
        Prefers gRPC when nvidia-riva-client is installed; else tries HTTP.
        """
        if not self.is_available():
            logger.debug("Riva STT skipped: disabled or no URL")
            return None
        import asyncio

        if RIVA_GRPC_AVAILABLE:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, _stt_grpc_sync, audio_base64, language)
            if result is not None:
                return result
        return await self._stt_http(audio_base64, language)

    async def _stt_http(self, audio_base64: str, language: str) -> Optional[STTResult]:
        """HTTP fallback for STT."""
        try:
            url = f"{self.base_url}/v1/recognize" if "50051" not in self.base_url else self.base_url.replace("50051", "8009") + "/v1/recognize"
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    url,
                    json={"audio_base64": audio_base64, "model": self.stt_model, "language": language},
                )
                if r.status_code != 200:
                    logger.warning("Riva STT HTTP returned %s: %s", r.status_code, (r.text or "")[:200])
                    return None
                data = r.json()
                return STTResult(
                    text=data.get("text", ""),
                    confidence=float(data.get("confidence", 0.0)),
                    language=data.get("language", language),
                )
        except Exception as e:
            logger.warning("Riva STT HTTP failed: %s", e)
            return None

    async def health(self) -> bool:
        """Check if Riva service is reachable (gRPC or HTTP)."""
        if not self.is_available():
            return False
        import asyncio

        if RIVA_GRPC_AVAILABLE:
            loop = asyncio.get_running_loop()
            if await loop.run_in_executor(None, _health_grpc_sync):
                return True
        try:
            health_url = self.base_url.replace("50051", "8009") + "/health" if "50051" in self.base_url else self.base_url + "/health"
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(health_url)
                return r.status_code == 200
        except Exception:
            return False


riva_service = NVIDIARivaService()
