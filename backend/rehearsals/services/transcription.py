"""Hosted Whisper adapter; raw_response is backend-only evidence."""
import os
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from openai import APIConnectionError, APIError, APIStatusError, APITimeoutError, OpenAI
from openai.types.audio import TranscriptionVerbose

MAX_AUDIO_BYTES = 25_000_000
SUPPORTED_SUFFIXES = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"}


class TranscriptionError(Exception):
    """Safe code/message, without provider bodies or credentials."""

    def __init__(self, code: str, message: str):
        self.code = code
        super().__init__(message)


def _invalid():
    return TranscriptionError("invalid_response", "Invalid transcription text or word timestamps.")


def _seconds(value):
    if type(value) not in (int, float):
        raise _invalid()
    result = Decimal(str(value))
    if not result.is_finite() or result < 0:
        raise _invalid()
    return result


def _normalize(raw):
    if not isinstance(raw, dict) or not isinstance(raw.get("text"), str):
        raise _invalid()
    words = raw.get("words")
    if not isinstance(words, list) or (raw["text"].strip() and not words):
        raise _invalid()
    normalized = []
    for item in words:
        if not isinstance(item, dict) or not isinstance(item.get("word"), str):
            raise _invalid()
        start, end = _seconds(item.get("start")), _seconds(item.get("end"))
        if end < start:
            raise _invalid()
        normalized.append({
            "text": item["word"],
            "start_ms": int((start * 1000).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
            "end_ms": int((end * 1000).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
        })
    return {"text": raw["text"], "words": normalized, "raw_response": raw}


def transcribe(audio_path: Path) -> dict:
    """Return text, words in milliseconds, and raw_response without editing audio.

    Django settings load backend/.env; standalone callers must load it themselves.
    Caller owns raw-response persistence and reuse of successful transcriptions.
    Automatic retries are disabled; orchestration controls duplicate processing.
    """
    if os.getenv("ALLOW_HOSTED_TRANSCRIPTION", "0") != "1":
        raise TranscriptionError("hosted_disabled", "Hosted transcription is disabled. Use the local worker.")
    path = Path(audio_path)
    if path.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise TranscriptionError("unsupported_audio", "Unsupported audio file extension.")
    try:
        audio = path.open("rb")
    except OSError:
        raise TranscriptionError("audio_unavailable", "Audio file could not be opened.") from None
    with audio:
        if not 0 < os.fstat(audio.fileno()).st_size <= MAX_AUDIO_BYTES:
            raise TranscriptionError("invalid_audio_size", "Audio must contain 1 to 25,000,000 bytes.")
        key = os.getenv("OPENAI_API_KEY", "").strip()
        if not key:
            raise TranscriptionError("missing_api_key", "OPENAI_API_KEY is not configured on the backend.")
        try:
            with OpenAI(api_key=key, base_url="https://api.openai.com/v1",
                        timeout=120.0, max_retries=0) as client:
                response = client.audio.transcriptions.create(
                    file=audio, model="whisper-1", response_format="verbose_json",
                    timestamp_granularities=["word"],
                )
                if not isinstance(response, TranscriptionVerbose):
                    raise _invalid()
                raw = response.model_dump(mode="json")
        except APITimeoutError:
            raise TranscriptionError("provider_timeout", "Transcription timed out.") from None
        except APIConnectionError:
            raise TranscriptionError("provider_connection", "Could not reach the transcription provider.") from None
        except APIStatusError as error:
            code = {401: "provider_auth", 403: "provider_auth", 429: "provider_rate_limit"}.get(
                error.status_code, "provider_error")
            raise TranscriptionError(code, "The transcription provider rejected the request.") from None
        except (APIError, ValueError):
            raise TranscriptionError("provider_error", "Transcription response could not be read.") from None
    return _normalize(raw)
