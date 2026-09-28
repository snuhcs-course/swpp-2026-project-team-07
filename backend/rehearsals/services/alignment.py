def align_words(
    words: list[dict], slide_events: list[dict], duration_ms: int
) -> list[dict]:
    """Whisper/integration owner: align by word start time to half-open slide visits.

    Preserve repeat/backward visits. An exact-boundary word belongs to the new
    slide. If events share a timestamp, the final event at that time wins.
    """
    raise NotImplementedError("Implement and test timestamp-based slide matching.")
