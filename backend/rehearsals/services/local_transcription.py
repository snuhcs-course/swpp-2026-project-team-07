"""Local-only multilingual Whisper. No hosted-provider fallback."""
from functools import lru_cache
from importlib.metadata import version
from pathlib import Path
from django.conf import settings
from .transcription import _normalize


@lru_cache(maxsize=1)
def load_model():
    from faster_whisper import WhisperModel
    from faster_whisper.utils import download_model
    path = download_model(settings.WHISPER_MODEL, cache_dir=settings.WHISPER_CACHE_DIR)
    model = WhisperModel(path, device="cpu", compute_type="int8", num_workers=1,
                         cpu_threads=settings.WHISPER_CPU_THREADS)
    return model, {"engine": "faster-whisper", "engine_version": version("faster-whisper"),
                   "model": settings.WHISPER_MODEL, "revision": Path(path).name,
                   "device": "cpu", "compute_type": "int8", "chunk_length_seconds": 10}


def transcribe_local(audio_path: Path):
    model, metadata = load_model()
    segments, info = model.transcribe(str(audio_path), word_timestamps=True, vad_filter=False,
                                      language=None, multilingual=True, chunk_length=10, beam_size=5, condition_on_previous_text=False)
    segments = list(segments)
    raw = {"text": "".join(segment.text for segment in segments).strip(),
           "words": [{"word": word.word, "start": float(word.start), "end": float(word.end)}
                     for segment in segments for word in (segment.words or [])]}
    result = _normalize(raw)
    result["metadata"] = {**metadata, "language": info.language,
                          "language_probability": float(info.language_probability)}
    return result
