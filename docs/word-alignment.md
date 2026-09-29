# Word-to-slide alignment: first implementation

`rehearsals.services.alignment.align_words` implements the timestamp policy in
[api-contract.md](api-contract.md). It runs without Django, a provider key, or audio.
Its inputs are normalized word dictionaries, chronological slide events, and
the positive recording duration, all in integer milliseconds.

## Internal result (proposed for integration review)

The function returns one item per slide visit, in event order:

```json
[
  {"slide_index": 0, "start_ms": 0, "end_ms": 4000,
   "words": [{"text": "Hello", "start_ms": 100, "end_ms": 500}]},
  {"slide_index": 1, "start_ms": 4000, "end_ms": 9000, "words": []},
  {"slide_index": 0, "start_ms": 9000, "end_ms": 12000, "words": []}
]
```

The first and third visits stay separate even though both refer to slide 0.
Each word is assigned once by its start time. A word spanning a slide change
keeps its full timing and belongs to the slide where it started. A word starting
exactly at a change belongs to the new slide. If events share a timestamp, the
last event wins; preceding zero-duration visits remain present with no words.
Silent visits are retained, and empty word input returns visits with empty lists.

Input dictionaries are not modified. Word order within each visit follows input
order, even for unsorted words. Invalid event order or timestamps raise
`ValueError`; nothing is silently sorted, clamped, or dropped. Word intervals
must satisfy `0 <= start_ms <= end_ms <= duration_ms`, with starts strictly before
the audio ends. Equal start/end times are allowed for millisecond rounding.
The caller supplies dictionaries and validates slide indexes against the deck;
this function checks only that indexes are nonnegative integers.

This return shape is a local proposal, not a new public API or agreed worker
contract. Review it with the integration owner before wiring `tasks.py` or
adding persistence. No transcript strings are reconstructed by joining words;
the original transcription text remains the transcription adapter's responsibility.

## Run the synthetic checks

From `backend/`:

```sh
python -m unittest rehearsals.test_alignment -v
```

For a small inspectable example, also from `backend/`:

```sh
python - <<'PY'
from pprint import pprint
from rehearsals.services.alignment import align_words

pprint(align_words(
    words=[
        {"text": "before", "start_ms": 3999, "end_ms": 4200},
        {"text": "boundary", "start_ms": 4000, "end_ms": 4500},
        {"text": "return", "start_ms": 9000, "end_ms": 9500},
    ],
    slide_events=[
        {"slide_index": 0, "at_ms": 0},
        {"slide_index": 1, "at_ms": 4000},
        {"slide_index": 0, "at_ms": 9000},
    ],
    duration_ms=12000,
))
PY
```

Expect `before` in the first visit (slide 0), `boundary` in the second (slide 1),
and `return` in the third (slide 0). This is synthetic test evidence, not a
Whisper accuracy measurement. The [hosted transcription adapter](whisper-transcription.md) is implemented with mocked tests. Human-recorded speech verification, worker/API wiring, and the real transcript UI remain pending.
