# Scribe-only integration: OpenAI Codex, October 17, 2026; docs/testing/evidence/scribe-only-integration-verification-2026-10-17.md.
# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
# Historical review: Injoon reviewed the PR #3 version; later integrated changes are not covered.
# Scribe v2 migration: OpenAI Codex, Iteration 2 (2026-10-16).
# See docs/ai-collaboration/prompt-logs/injoon/iteration-2.md#i2-scribe-v2-transcription--october-16-2026
"""Hosted Scribe v2 only; normalized output preserves the existing transcript contract."""
import os
import json
import wave
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from email.utils import parsedate_to_datetime
import hashlib
from pathlib import Path
from tempfile import TemporaryFile

import av
import httpx
from public_billing import budget as public_budget
from rehearsals.limits import AUDIO_DURATION_TOLERANCE_MS, MAX_DURATION_MS
from .keyterms import MAX_KEYTERMS, valid_keyterm

PROVIDER = "elevenlabs"
MODEL = "scribe_v2"
SCRIBE_OPTIONS = {"model_id": MODEL, "timestamps_granularity": "word", "no_verbatim": "false",
                 "tag_audio_events": "false", "diarize": "false", "use_multi_channel": "false"}

MAX_AUDIO_BYTES = 25_000_000
SUPPORTED_SUFFIXES = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"}
CERTAIN_REJECTIONS = {'provider_auth', 'provider_rate_limit', 'provider_rejected', *public_budget.MESSAGES}


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
        if not isinstance(item, dict):
            raise _invalid()
        if item.get("type") in {"spacing", "audio_event"}:
            continue
        if item.get("type") != "word":
            raise _invalid()
        if not isinstance(item.get("text"), str) or not item["text"].strip():
            raise _invalid()
        start, end = _seconds(item.get("start")), _seconds(item.get("end"))
        if end < start:
            raise _invalid()
        normalized.append({
            "text": item["text"],
            "start_ms": int((start * 1000).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
            "end_ms": int((end * 1000).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
        })
    if raw["text"].strip() and not normalized:
        raise _invalid()
    return {"text": raw["text"], "words": normalized, "raw_response": raw}


@dataclass
class PreparedRequest:
    audio: object
    client: object
    input_hash: str
    options: dict
    public_pcm_frames: int | None = None


def _public_pcm(source, destination):
    """Send precisely the duration reserved, even for a misleading media container."""
    count = 0
    maximum = (MAX_DURATION_MS + AUDIO_DURATION_TOLERANCE_MS) * 16
    try:
        with av.open(source, options={'format_whitelist': 'wav,mp3,mov,matroska,webm,mpeg'}) as container, \
                wave.open(destination, 'wb') as wav:
            wav.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            resampler = av.AudioResampler(format='s16', layout='mono', rate=16000)

            def write(frames):
                nonlocal count
                for frame in frames:
                    count += frame.samples
                    if count > maximum:
                        raise ValueError()
                    wav.writeframesraw(bytes(frame.planes[0])[:frame.samples * 2])

            for frame in container.decode(audio=0):
                if frame.is_corrupt:
                    raise ValueError()
                write(resampler.resample(frame))
            write(resampler.resample(None))
        if not count:
            raise ValueError()
    except (ValueError, OSError, IndexError, EOFError, av.FFmpegError, wave.Error):
        raise TranscriptionError('unsupported_audio', 'This recording could not be prepared for transcription.') from None
    destination.seek(0)
    return count


@contextmanager
def prepare_request(audio_path, *, keyterms=()):
    """All local validation/configuration before the durable submitted marker."""
    path = Path(audio_path)
    if (not isinstance(keyterms, (list, tuple)) or len(keyterms) > MAX_KEYTERMS or
            any(not valid_keyterm(term) for term in keyterms)):
        raise TranscriptionError('invalid_keyterms', 'Invalid transcription vocabulary hints.')
    options = SCRIBE_OPTIONS.copy()
    if keyterms:
        options['keyterms'] = list(keyterms)
    if path.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise TranscriptionError("unsupported_audio", "Unsupported audio file extension.")
    try:
        audio = path.open("rb")
    except OSError:
        raise TranscriptionError("audio_unavailable", "Audio file could not be opened.") from None
    with audio, ExitStack() as resources:
        if not 0 < os.fstat(audio.fileno()).st_size <= MAX_AUDIO_BYTES:
            raise TranscriptionError("invalid_audio_size", "Audio must contain 1 to 25,000,000 bytes.")
        key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        if not key:
            raise TranscriptionError("missing_api_key", "ELEVENLABS_API_KEY is not configured on the backend.")
        digest = hashlib.file_digest(audio, 'sha256').hexdigest()
        audio.seek(0)
        upload, frames = audio, None
        if public_budget.enabled():
            upload = resources.enter_context(TemporaryFile())
            frames = _public_pcm(audio, upload)
        with httpx.Client(headers={"xi-api-key": key}, timeout=120.0, follow_redirects=False) as client:
            yield PreparedRequest(upload, client, digest, options, frames)


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
    if public_budget.enabled():
        try:
            options = {field: value for field, value in prepared.options.items() if field != 'keyterms'}
            terms = prepared.options.get('keyterms', [])
            if (options.get('model_id') != 'scribe_v2' or options != SCRIBE_OPTIONS or
                    not isinstance(terms, (list, tuple)) or len(terms) > MAX_KEYTERMS):
                raise public_budget.BudgetError()
            public_budget.authorize_scribe(prepared.client.headers.get('xi-api-key'), prepared.public_pcm_frames)
        except public_budget.BudgetError as failure:
            raise TranscriptionError(failure.code, str(failure)) from None
        filename = 'recording.wav'
    else:
        filename = Path(prepared.audio.name).name
    try:
        response = prepared.client.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            files={"file": (filename, prepared.audio)},
            data=prepared.options,
        )
        response.raise_for_status()
        try:
            raw = response.json()
            json.dumps(raw, allow_nan=False)  # Invalid JSON numbers must remain persistable evidence.
            return raw
        except ValueError:
            # Preserve a malformed received body privately too; normalization fails closed.
            return response.text
    except httpx.TimeoutException:
        raise TranscriptionError("provider_timeout", "Transcription timed out. The request may have been charged.", uncertain=True) from None
    except httpx.RequestError:
        raise TranscriptionError("provider_connection", "The provider connection ended without a confirmed outcome. The request may have been charged.", uncertain=True) from None
    except httpx.HTTPStatusError as error:
        code = {401: "provider_auth", 403: "provider_auth", 429: "provider_rate_limit"}.get(
            error.response.status_code, "provider_error" if error.response.status_code >= 500 else "provider_rejected")
        raise TranscriptionError(code, "The transcription provider rejected the request.",
            uncertain=error.response.status_code >= 500 or error.response.status_code == 408,
            retry_at=retry_time(error.response.headers)) from None
    except ValueError:
        raise TranscriptionError("provider_error", "Transcription response could not be read. The request may have been charged.", uncertain=True) from None


def transcribe(audio_path: Path, *, keyterms=()) -> dict:
    """Compatible standalone adapter. Worker uses prepare/request/normalize for durability."""
    with prepare_request(audio_path, keyterms=keyterms) as prepared:
        raw = request_raw(prepared)
    return _normalize(raw)
