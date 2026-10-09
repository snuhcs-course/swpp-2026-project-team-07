# AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
# Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
# Human review: Injoon; final staged inspection recorded in PR #3's AI-use log.
from bisect import bisect_right


def align_words(
    words: list[dict], slide_events: list[dict], duration_ms: int
) -> list[dict]:
    """Return chronological visits with slide_index, start_ms, end_ms, and words.

    Preserve repeat/backward visits. An exact-boundary word belongs to the new
    slide. If events share a timestamp, the final event at that time wins.
    Empty visits are retained. Inputs use integer milliseconds and are not changed.
    Invalid timing raises ValueError; deck bounds are checked by the upload layer.
    """
    if type(duration_ms) is not int or duration_ms <= 0:
        raise ValueError("duration_ms must be a positive integer.")
    if not slide_events:
        raise ValueError("The initial slide event is required at 0 ms.")

    times = []
    for event in slide_events:
        at_ms = event.get("at_ms")
        slide_index = event.get("slide_index")
        if type(slide_index) is not int or slide_index < 0:
            raise ValueError("slide_index must be a nonnegative integer.")
        if type(at_ms) is not int or not 0 <= at_ms < duration_ms:
            raise ValueError("Event times must be integer milliseconds within the audio.")
        if (not times and at_ms != 0) or (times and at_ms < times[-1]):
            raise ValueError("Events must start at 0 ms and be in chronological order.")
        times.append(at_ms)

    visits = [
        {
            "slide_index": event["slide_index"],
            "start_ms": times[index],
            "end_ms": times[index + 1] if index + 1 < len(times) else duration_ms,
            "words": [],
        }
        for index, event in enumerate(slide_events)
    ]
    for word in words:
        start_ms, end_ms = word.get("start_ms"), word.get("end_ms")
        if (
            type(start_ms) is not int
            or type(end_ms) is not int
            or not 0 <= start_ms < duration_ms
            or not start_ms <= end_ms <= duration_ms
        ):
            raise ValueError("Words must satisfy 0 <= start_ms <= end_ms <= duration_ms, "
                             "with start_ms before the audio ends, in integer milliseconds.")
        if not isinstance(word.get("text"), str):
            raise ValueError("Each word must have string text.")
        visits[bisect_right(times, start_ms) - 1]["words"].append(dict(word))
    return visits
