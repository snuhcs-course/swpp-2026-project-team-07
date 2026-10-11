# Initial API contract

Base path `/api/`. JSON uses `snake_case`, UUID strings and integer milliseconds. Mobile types: `src/contracts/index.ts`. Health/readiness, deck upload/retrieval/history, and attempt upload/retrieval are implemented on the storage restoration branch. Processing still returns HTTP 501; uploaded attempts explicitly await analysis.

| Route | Input | Current response |
| --- | --- | --- |
| `POST /decks/` | Multipart `file` (PDF), `title` | 201: `{deck: {id, title, page_count}, slides: [{deck_id, slide_index, image_url, extracted_text}]}` |
| `GET /decks/{id}/` | None | 200: deck metadata, original `pdf_url`, and ordered `slides` |
| `GET /decks/{id}/attempts/` | None | 200: newest-first saved attempt results |
| `POST /attempts/` | Multipart `audio`, `metadata` JSON string | 201: `{attempt_id}` after durable storage |
| `POST /attempts/{id}/process/` | Existing attempt | 501: `not_implemented`; no job queued |
| `GET /attempts/{id}/` | None | 200: `AttemptResult` |

Current flow: save locally → upload PDF if needed → upload audio with the same attempt UUID → awaiting analysis. Processing/polling helpers exist for later integration, but this flow never calls them. Upload handlers validate the known deck, slide bounds, UUID uniqueness, supported audio/container, duration/size limits and metadata. Reject conflicting uploads for an existing ID. New recording means new ID; upload retries retain the ID, audio and normalized metadata. Identical retries return the existing attempt; conflicting valid content returns 409. Future processing retries must retain the ID/audio and avoid duplicate provider work.

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

Future integration (not connected): `tasks.process_attempt` will coordinate stored audio → transcription → alignment → feedback → saved result. PDF preparation belongs to the deck workstream. Whisper uses hosted `whisper-1`, `verbose_json`, word timestamps normalized from seconds to milliseconds. Preserve raw output for evaluation and enforce the current provider upload limit. Gemini receives slide images/text, matching speech, bounded context and optional audience; choose its precise model during implementation. Credentials and provider calls remain server-side.


## Historical Stage 1 local capture boundary

The imported PDF's `localDeckId` is a catalog key, not a server UUID. Native viewer callbacks supply the actual `pageCount` and zero-based selected page. Rehearsal timestamps page changes when the native page callback confirms the visible page, not when a navigation button is pressed. Capture starts only after PDF load/page confirmation; repeated callbacks of the same page add no new visit.

Stage 1 used a Results route carrying session-only `audioUri`, `slideEvents`, `durationMs`, `localDeckId`, `pageCount`, `title` and `pdfUri`. That was a local preview handoff, not upload metadata or a durable attempt. Stage 2 below supersedes it for imported PDFs; sample captures still use a local preview. Do not put a local catalog key in `LocalRecording.deck_id`; the current storage flow resolves a server deck UUID and creates one attempt UUID per recording before upload. Stage 1 changed no backend endpoints.


## Stage 2 durable storage boundary

`feature/recording-storage-upload` restores local SQLite attempt records while leaving the imported PDF catalog and files intact. A local attempt has its own UUID plus `local_deck_id`, title, PDF URI, page count, audio URI, audience and slide-event checkpoints. It acquires a server `deck_id` only after deck upload. Local keys never masquerade as server UUIDs. The Results route now takes only `attemptId` for durable real recordings; sample previews remain separate.

The prepared audio URI and initial visible slide are stored in one SQLite write before capture starts. Startup recovery must succeed before a new capture is allowed, and native audio time/events are saved at page changes and about every second. On restart, unfinished capture requires explicit recovery against playable media duration; interrupted uploads can be retried with the same ID. Unplayable or oversized files remain local. Audio exceeding 25,000,000 bytes is rejected before any upload request with an explanation to make a shorter new recording; local playback remains available. Recovery cannot reconstruct audio that Android failed to finalize.

Limits: 10 slides, 20 MiB PDF, 600,000 ms recording, and exactly 25,000,000 audio bytes. Deck content/preparation hashes deduplicate PDFs. Attempt hashes include the audio and normalized metadata: identical retries return the original attempt; conflicting IDs return HTTP 409, including concurrent submissions. Added model fields are migrated without replacing old media. Audio is decoded locally to validate the audio duration against metadata (up to a 1,000 ms codec tail); container headers alone do not establish playable audio. Each submission writes to unique media paths. Failure cleanup protects the committed winner, and uncertain database outcomes retain media for later reconciliation; cleanup failures may leave unreferenced files. No automatic orphan deletion is implemented.

Attempt GET/history add `deck_id`, `duration_ms`, `slide_events`, `audience`, `created_at`, `audio_url` and `processing_state`. An uploaded unprocessed recording has status `pending`, processing_state `awaiting_analysis`, transcript `null` and no feedback. The mobile upload function does not call processing. Hosted Whisper orchestration is the next separately confirmed implementation.

Deck mappings are keyed by API address and local deck ID. Before reuse, the client checks server UUID identity and page count via deck GET; only HTTP 404 or an invalid local mapping permits PDF replacement. Transient lookup failures retain the mapping. An uncertain audio response, 409, or failed local acknowledgement save never allocates a new attempt UUID. A submitted recording can be uploaded to another configured API address with that same attempt UUID.

Verification boundary: automated SQLite/native mocks and Django tests are distinct from real Android restart/replay/offline retry, PostgreSQL races, and persistent server restart/media retrieval. Those coordinator validations and final staged-content/human review remain pending. Whisper is a separately confirmed next implementation.
