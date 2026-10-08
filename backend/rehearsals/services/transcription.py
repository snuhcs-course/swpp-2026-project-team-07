"""Hosted Whisper adapter; raw_response is backend-only evidence."""
import os
import json
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from email.utils import parsedate_to_datetime
import hashlib
from pathlib import Path

from openai import APIConnectionError, APIError, APIStatusError, APITimeoutError, OpenAI

MAX_AUDIO_BYTES = 25_000_000
SUPPORTED_SUFFIXES = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"}


class TranscriptionError(Exception):
    """Safe code/message, without provider bodies or credentials."""

    def __init__(self, code: str, message: str, *, uncertain=False, retry_at=None):
        self.code, self.uncertain, self.retry_at = code, uncertain, retry_at
        super().__init__(message)


def _invalid():
    return TranscriptionError("invalid_response", "Invalid transcription text or word timestamps.")


def _seconds(value):
    if type(value) not in (int, float):
        raise _invalid()
    result = Decimal(str(value))
    if not result.is_finite() or result < 0 or result > Decimal(2**53 - 1) / 1000:
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


@dataclass
class PreparedRequest:
    audio: object
    client: object
    input_hash: str


@contextmanager
def prepare_request(audio_path):
    """All local validation/configuration before the durable submitted marker."""
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
        digest = hashlib.file_digest(audio, 'sha256').hexdigest()
        audio.seek(0)
        with OpenAI(api_key=key, base_url="https://api.openai.com/v1", timeout=120.0, max_retries=0) as client:
            yield PreparedRequest(audio, client, digest)


def retry_time(headers):
    value = headers.get('retry-after')
    if not value:
        return None
    try:
        if value.strip().isdigit():
            return datetime.now(timezone.utc) + timedelta(seconds=int(value))
        parsed = parsedate_to_datetime(value)
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed
    except (ValueError, TypeError, OverflowError):
        return None


def request_raw(prepared):
    """One outbound request, no SDK retries. Caller persists raw before normalizing."""
    try:
        response = prepared.client.audio.transcriptions.with_raw_response.create(
            file=prepared.audio, model="whisper-1", response_format="verbose_json",
            timestamp_granularities=["word"],
        )
        try:
            raw = response.http_response.json()
            json.dumps(raw, allow_nan=False)  # Invalid JSON numbers must remain persistable evidence.
            return raw
        except ValueError:
            # Preserve a malformed received body privately too; normalization fails closed.
            return response.http_response.text
    except APITimeoutError:
        raise TranscriptionError("provider_timeout", "Transcription timed out. The request may have been charged.", uncertain=True) from None
    except APIConnectionError:
        raise TranscriptionError("provider_connection", "The provider connection ended without a confirmed outcome. The request may have been charged.", uncertain=True) from None
    except APIStatusError as error:
        code = {401: "provider_auth", 403: "provider_auth", 429: "provider_rate_limit"}.get(
            error.status_code, "provider_error" if error.status_code >= 500 else "provider_rejected")
        raise TranscriptionError(code, "The transcription provider rejected the request.",
            uncertain=error.status_code >= 500 or error.status_code == 408,
            retry_at=retry_time(error.response.headers)) from None
    except (APIError, ValueError):
        raise TranscriptionError("provider_error", "Transcription response could not be read. The request may have been charged.", uncertain=True) from None


def transcribe(audio_path: Path) -> dict:
    """Compatible standalone adapter. Worker uses prepare/request/normalize for durability."""
    with prepare_request(audio_path) as prepared:
        raw = request_raw(prepared)
    return _normalize(raw)
