# Initial API contract

Base path `/api/`. JSON uses `snake_case`, UUID strings and integer milliseconds. Mobile types: `src/contracts/index.ts`. Only health/readiness are implemented; feature routes currently return HTTP 501.

| Route | Input | Intended success |
| --- | --- | --- |
| `POST /decks/` | Multipart `file` (PDF), `title` | 201: `{deck: {id, title, page_count}, slides: [{deck_id, slide_index, image_url, extracted_text}]}` |
| `POST /attempts/` | Multipart `audio`, `metadata` JSON string | 201: `{attempt_id}` after durable storage |
| `POST /attempts/{id}/process/` | Existing attempt | 202: `{attempt_id}` when queued |
| `GET /attempts/{id}/` | None | 200: `AttemptResult` |

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

`tasks.process_attempt` will coordinate stored audio → transcription → alignment → feedback → saved result. PDF preparation belongs to the deck workstream. Whisper uses hosted `whisper-1`, `verbose_json`, word timestamps normalized from seconds to milliseconds. Preserve raw output for evaluation and enforce the current provider upload limit. Gemini receives slide images/text, matching speech, bounded context and optional audience; choose its precise model during implementation. Credentials and provider calls remain server-side.


## Stage 1 local capture boundary

The imported PDF's `localDeckId` is a catalog key, not a server UUID. Native viewer callbacks supply the actual `pageCount` and zero-based selected page. Rehearsal timestamps page changes when the native page callback confirms the visible page, not when a navigation button is pressed. Capture starts only after PDF load/page confirmation; repeated callbacks of the same page add no new visit.

Until stage 2, the Results route carries session-only `audioUri`, `slideEvents`, `durationMs`, `localDeckId`, `pageCount`, `title` and `pdfUri`. This is a local preview handoff, not upload metadata or a durable attempt. Do not put a local catalog key in `LocalRecording.deck_id`; stage 2 must resolve a server deck UUID and create one attempt UUID per recording before upload. No wire contract or backend endpoint changes in stage 1.
