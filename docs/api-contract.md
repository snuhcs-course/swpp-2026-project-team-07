# Initial API contract

Base path `/api/`. JSON uses `snake_case`, UUID strings and integer milliseconds. Mobile types: `src/contracts/index.ts`. Deck and attempt uploads are durable and idempotent. The process route schedules local-only transcription, with recovery through Celery beat.

| Route | Input | Intended success |
| --- | --- | --- |
| `POST /decks/` | Multipart `file` (PDF), `title` | 201: `{deck: {id, title, page_count}, slides: [{deck_id, slide_index, image_url, extracted_text}]}` |
| `POST /attempts/` | Multipart `audio`, `metadata` JSON string | 201: `{attempt_id}` after durable storage |
| `POST /attempts/{id}/process/` | Existing attempt | 202: `{attempt_id}` when queued |
| `GET /attempts/{id}/` | None | 200: `AttemptResult` |

Additional read routes: `GET /decks/{id}/` returns deck fields plus slides; `GET /decks/{id}/attempts/` lists saved attempts newest first. Upload limits: 10 slides, 20 MiB PDF, 25 MiB audio, 600,000 ms capture (up to 1 second of codec padding). Identical PDF bytes reuse a prepared deck. Conflicting attempt IDs return 409; identical uploads return 201 without changing existing results.

Submit → request processing → poll status. Upload handlers must validate the known deck, slide bounds, UUID uniqueness, supported audio/container, duration/size limits and metadata. Reject conflicting uploads for an existing ID. New recording means new ID; retry processing keeps its ID. Duplicate processing requests must not repeat provider work.

Example metadata:

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "deck_id": "11111111-1111-4111-8111-111111111111",
  "duration_ms": 12000,
  "audience": "Students new to this topic",
  "slide_events": [
    {"slide_index": 0, "at_ms": 0},
    {"slide_index": 1, "at_ms": 4000},
    {"slide_index": 0, "at_ms": 9000}
  ]
}
```

## Timeline

The first event is the visible slide at actual audio start (`0` ms). Preserve chronological event order, including repeated/backward visits. Each visit is `[event.at_ms, next_event.at_ms)`; the last ends at `duration_ms`. Initially assign words by their start timestamp. An exact-boundary word belongs to the new slide; for simultaneous events, the last event wins. Validate word timestamps against duration. Keep the raw events/words for evaluation and refinement.

This is an implementation policy, not an evaluated accuracy claim. Pause/resume is omitted until a single policy is defined for both audio and slide-event time.

## Results

```json
{
  "attempt_id": "33333333-3333-4333-8333-333333333333",
  "status": "completed",
  "transcript": {
    "text": "Example",
    "words": [{"text": "Example", "start_ms": 120, "end_ms": 550}]
  },
  "feedback": [{
    "slide_index": 0,
    "start_ms": 120,
    "end_ms": 550,
    "observation": "A possible unclear reference",
    "slide_evidence": "The named element on this slide",
    "suggestion": "Name that element explicitly."
  }],
  "error": null
}
```

These are schematic examples, not provider outputs. Statuses: `pending`, `processing`, `completed`, `failed`. Unavailable transcripts are `null`. Failed attempts retain audio and return a safe `{code, message}` error. Validate slide/audio evidence ranges; keep summaries separate from verbatim transcripts.

`tasks.process_attempt` runs local faster-whisper `small`, CPU INT8, word timestamps, without VAD/silence removal or hosted fallback. One worker plus a PostgreSQL advisory lock serializes transcription. Model snapshot revision/engine version and raw transcription stay in backend storage; API exposes safe model metadata only. Celery beat recovers pending or abandoned work after the 1,900-second lease (task hard limit 1,800 seconds). Successful transcripts are retained independently of feedback.

Results additionally include `visits`, `metrics`, `stages: {transcription, feedback}`, `transcription_model`, `audio_url`, `slide_events`, `duration_ms`, and `audience`. Transcription stages: pending/running/complete/failed. Feedback is `disabled` until milestone 3. `completed` describes the enabled pipeline; disabled feedback is never represented as generated. Speaking rates are language-labelled orthographic estimates over total duration including silence, with separate English/Korean counts for mixed speech. No overall score.

A codec tail up to 1,000 ms may extend the last aligned visit/metric duration beyond the capture duration. Word timestamps are preserved rather than shifted or clipped. Larger timestamp excursions produce an alignment failure while retaining the successful transcript for inspection/retry.
