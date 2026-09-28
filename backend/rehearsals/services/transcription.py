from pathlib import Path


def transcribe(audio_path: Path) -> dict:
    """Whisper owner: hosted whisper-1, verbose_json, word timestamps.

    Keep OPENAI_API_KEY server-side. Normalize seconds to integer milliseconds.
    Preserve original output for evaluation. Enforce the provider upload limit.
    Return {text, words: [{text, start_ms, end_ms}]}.
    """
    raise NotImplementedError("Implement the hosted Whisper adapter.")
