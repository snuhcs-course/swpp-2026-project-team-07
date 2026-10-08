# Initial API contract

Base path `/api/`. JSON uses `snake_case`, UUID strings and integer milliseconds. Mobile types: `src/contracts/index.ts`. Health/readiness, deck upload/retrieval/history, attempt upload/retrieval, and explicit hosted processing are implemented. Upload alone leaves a recording awaiting analysis.

| Route | Input | Current response |
| --- | --- | --- |
| `POST /decks/` | Multipart `file` (PDF), `title` | 201: `{deck: {id, title, page_count}, slides: [{deck_id, slide_index, image_url, extracted_text}]}` |
| `GET /decks/{id}/` | None | 200: deck metadata, original `pdf_url`, and ordered `slides` |
| `GET /decks/{id}/attempts/` | None | 200: newest-first saved attempt results |
| `POST /attempts/` | Multipart `audio`, `metadata` JSON string | 201: `{attempt_id}` after durable storage |
| `POST /attempts/{id}/process/` | Strict JSON process request below | 202: accepted/active `AttemptResult`; 200: completed `AttemptResult`; 409: retry conflict |
| `GET /attempts/{id}/` | None | 200: `AttemptResult` |

Current flow: save locally → upload PDF if needed → upload audio with the same attempt UUID → awaiting analysis. The user then chooses Analyze; upload itself never calls processing. Upload handlers validate the known deck, slide bounds, UUID uniqueness, supported audio/container, duration/size limits and metadata. Reject conflicting uploads for an existing ID. New recording means new ID; upload retries retain the ID, audio and normalized metadata. Identical retries return the existing attempt; conflicting valid content returns 409. Processing retries retain the ID/audio and avoid duplicate provider work.

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

## Processing admission and recovery

Initial Analyze sends `{}`. A failed retry sends `{"processing_revision": 1}` using the current GET revision. For `needs_confirmation`, also send `"acknowledge_uncertain": true`. Unknown fields, non-object JSON, coerced/string/boolean/negative revisions, and non-boolean acknowledgement return 400. Missing/stale revisions, missing uncertainty acknowledgement, or an unexpired retry time return 409 with safe `{error: {code, message}}`. Missing attempts return 404.

Admission atomically consumes revision 0 → 1 for initial work, then N → N+1 for each accepted failed retry. The consumed revision cannot authorize another generation even after an intervening failure. Active/completed requests report the current state without new work; supplied stale revisions still return 409. Duplicate delivery is fenced by revision and claim token. Retry retains attempt UUID, audio and partial data.

Stages: `awaiting_analysis` → `queued` → `checking_audio` → `transcribing` → `aligning` → `completed`. Top-level status remains `pending` before Analyze, `processing` for active stages, `completed`, or `failed`. A terminal failure uses `processing_state=failed` or `needs_confirmation` and preserves `failed_stage` plus partial results. No-speech detection saves an empty transcript and goes from checking to aligning to completed, skipping provider transcription.

The database commits queued intent before best-effort Celery publication. Beat invokes recovery every 30 seconds: republish queued rows; recover unsubmitted claims older than 360 seconds; resume saved raw/transcripts. Each state write checks the current generation/token and live claim. Submitted requests without a durable outcome become `needs_confirmation`, with no automatic provider recall. SDK timeout=120 seconds, task limit=300 seconds, stale claim=360 seconds. CPU and network work hold no transaction.

Local file/key validation and SDK preparation precede the committed submitted marker, which immediately precedes the outbound call. If marker persistence fails, do not call. Private `ProviderRequest` records retain original-audio SHA-256, provider/model, generation/token, timestamps, outcome, available usage and raw output. Raw output is saved before normalization; successful transcripts before alignment. Raw/usage/hash records never appear in public APIs, served media, or logs. A submitted marker is conservative evidence of possible outbound work, not exactly-once execution or a monetary cap.

Authentication (`provider_auth`), rate limits (`provider_rate_limit`, `retry_at` from Retry-After), missing keys and local audio/VAD validation fail explicitly. All initial provider failures require manual retry. Timeout, connection loss, HTTP 408/5xx and unknown post-submission crashes require acknowledgement; SDK retries are disabled. `retry_available` means the current retry time has passed; it does not waive revision/acknowledgement requirements.

## Results

POST process, GET attempt and deck history use the same serializer. All responses include:

| Field | Meaning |
| --- | --- |
| `attempt_id`, `deck_id`, `duration_ms`, `slide_events`, `audience`, `created_at`, `audio_url` | Stored recording identity, authoritative timeline and source |
| `status`, `processing_state`, `processing_revision` | Top-level status, detailed stage and authorized generation |
| `failed_stage` | Active stage at failure, otherwise null (legacy failures may be null) |
| `retry_available`, `retry_at`, `requires_confirmation` | Boolean availability, nullable ISO time and uncertain-charge acknowledgement requirement |
| `partial_available` | `{transcript: boolean, alignment: boolean}`; availability includes empty completed results |
| `transcript` | Null, or `{text, words: [{text, start_ms, end_ms}]}` |
| `visits` | Null, or chronological `{slide_index, start_ms, end_ms, words}` visits, including empty/zero-duration visits |
| `metrics` | Null, or timing metrics below; the same shape for speech and no speech |
| `analysis_outcome` | Null, `speech`, `no_speech`, or `legacy` |
| `feedback`, `feedback_state` | Newly completed analysis always `[]`, `disabled`, regardless of Gemini credentials |
| `error` | Null, or safe `{code, message}` |
| `provenance` | `{provider, model, generation, outcome, speech_gate}`; values nullable; provider/model `openai`/`whisper-1`, request outcome `submitted`/`received`/`rejected`/`uncertain`, gate `silero-vad` |

Provenance identifies the received transcript's generation when one is available, otherwise the latest request. No raw provider response or input hash is public. Legacy rows retain stored results/media; migration never automatically queues them and labels existing results `legacy` rather than claiming they passed this pipeline. Legacy feedback remains untouched and is labeled `feedback_state=legacy`.

Hosted transcription uses exactly `whisper-1`, `verbose_json`, and `timestamp_granularities=["word"]`; seconds normalize to integer milliseconds with half-up rounding. Missing, malformed, nonfinite or unsafe numeric timestamps fail normalization without replacing the raw evidence. Words outside the authoritative recording duration fail alignment with `alignment_failed`, retaining raw/transcript as actionable partial results. Retry reuses saved raw/transcript; it cannot repair an invalid original timeline by re-transcribing or extending/clamping duration.

`metrics` contains `duration_ms`, `time_per_slide: [{slide_index, duration_ms}]` summed across all visits, `detected_language`, `speaking_rates: [{language, unit, count, per_minute}]`, and `rate_note`. Rates are separate `en` English word-pattern counts and `ko` contiguous Hangul-run counts, divided by **total rehearsal minutes including silence**. Korean's label is `Korean Hangul runs/min`; it is an estimate, not a linguistic word count or speaking-only rate. No filler/other detector is claimed.

The packaged Silero CPU gate checks a temporary PyAV-decoded waveform only. It never cuts, concatenates or rewrites provider input. Detection failure fails closed (`audio_check_failed`); no provider request occurs. Detected no-speech saves transcript `{text: "", words: []}` and `analysis_outcome=no_speech` before running `align_words([], slide_events, duration_ms)` and timing metrics. Completion retains every chronological visit with `words: []`, including simultaneous/zero-duration, repeated and backward visits. Metrics retain the authoritative recording duration and summed slide times, with `detected_language=und` and `speaking_rates=[]`. Original audio and slide events are unchanged and provider requests remain zero. Alignment failure retains the empty transcript and gate outcome as partial results; retry or stale-claim recovery reuses them without another gate/provider call.

Mobile Analyze requires a recording known to the current API, established by its upload or validated server history. First-use disclosure has Continue/Cancel and locally persisted consent. Retry refreshes first and supplies the displayed current revision; uncertain requests require a separate charge acknowledgement. A client timeout is not server failure. Polling stops on navigation/background; stale callbacks and API-address changes cannot update another cache. SQLite result records are keyed by normalized API address and attempt UUID, separately from upload metadata. Offline refresh preserves cache and audio. Synchronized review is described below; feedback remains disabled.

## Mobile rehearsal review

This stage reuses the GET deck/history/attempt and explicit process endpoints above, without backend schema or provider changes. `/results?attemptId=<UUID>` opens a real rehearsal; a malformed ID cannot open the sample preview. `DeckDetail` and `ReviewAttempt` are validated mobile read models, not new wire response schemas. Deck/attempt identities, page bounds and authoritative recording duration gate usable capabilities. Missing legacy fields can leave text available while timing, downloads or processing are unavailable. Review parsing cannot authorize a process request without the existing strict `AttemptResult` validation and fresh revision check.

Library merges local captures with `GET /decks/{id}/attempts/` only for known presentation mappings at the normalized API address. It deduplicates attempt UUIDs within that API, displays cache first and preserves entries on refresh failure with a stale notice. History/detail reconciliation cannot roll back a newer analysis revision or replace a terminal result with an older active snapshot. A server-only review copy is never persisted as a `SavedAttempt` or an imported PDF. Local recovery/upload retry keeps the existing UUID and source recording.

Saved-review **Refresh** retries both attempt and deck metadata GETs, so a transient deck lookup failure can recover PDF download availability without leaving the screen. Deck refresh preserves cache on failure, supersedes older requests, and cancels on blur, background or identity changes. It cannot process an attempt.

SQLite KV additions use `review:v1:<encoded normalized API>:<kind>:<UUID>`: `deck`, `history` (attempt IDs), `attempt`, `media-audio` and `media-pdf`. Audio media keys use attempt UUID; PDF media keys use deck UUID. Existing `analysis:v1` records, upload mappings and capture/import catalogs remain separate; no destructive migration or automatic eviction is added. API identity changes cancel in-flight reads/downloads and detach the old native player. Switching API does not reuse another API's downloaded media or processing permission; original local captures remain available locally.

When an upgraded installation has only an `analysis:v1` result, review derives its available transcript/timing/media metadata from that API-scoped result without requiring network access or a migration write. Incomplete/legacy refreshes render the reconciled cache result; a failed cache write retains the current validated in-memory review and shows the cache failure notice. Late responses after navigation, backgrounding or an API change cannot replace it.

Media recovery is an explicit GET from validated `audio_url`/`pdf_url`. Only same-origin HTTP(S) URLs without credentials, fragments or redirects are accepted, retaining development HTTP support. Local absolute paths normalize to `file://`; local `file://`/`content://` sources are checked before use. Interrupted-capture recovery compares canonical original URIs and persists that URI for upload; a downloaded review copy cannot replace the original capture. Downloads stream into unique owned temporary files, enforce actual bytes as well as declared size (audio **25,000,000**, PDF **20 MiB**), and time out after 120 seconds. Native validation must complete before the unique durable file and cache record are published: audio must load with finite positive duration within 1,000 ms of saved duration; PDF must load with **1–10** pages matching the deck. Native error, cancellation or 15-second validation timeout rejects publication. Reopening a download verifies file size/hash and native usability. Concurrent consumers share a download; if the validating consumer leaves, a remaining consumer validates the same temporary file before publication, without another GET. The last cancellation stops it. Audio and PDF failures are independent. Cleanup targets only the failed operation's owned files and never replaces/deletes previously good or original media; cleanup failure can leave an unreferenced file.

The native player's position is the only playback clock. Visits use zero-based slides and integer milliseconds; half-open intervals and last-simultaneous-event-wins policy apply. Repeated/backward and zero-duration visits remain distinct in the list; previous/next transport skips instantaneous intervals, and selecting one seeks its exact timestamp without inventing duration. Hold the final page at EOF. Valid recorded events provide labeled **Recorded navigation** when alignment is absent. Transcript punctuation/whitespace are preserved; token mismatch falls back to plain text. Out-of-duration, invalid or zero-length word timings cannot highlight or seek; neither transcript nor native codec tails extend the recording duration.

EOF notifications pass through the seek controller: queued/running newer seeks retain playing intent, and delayed completion checks the fresh native position. An unsuperseded seek to the recording's end settles paused; normal EOF and explicit Pause still stop playback. Native media-error callbacks belong to the rendered source and focus session; detached or cancelled callbacks cannot clear replacement or retained media.

An ordinary native pause (such as audio-focus loss) clears playing intent, so later word/visit seeks remain paused until Play is chosen. This reconciliation requires a loaded, non-buffering native snapshot outside pending/running seeks; delayed pause notifications cannot override a fresh playing snapshot. EOF keeps the separate seek/position policy above.

Seeks serialize native operations and replace older queued targets with the newest. After this native player first loads, buffering does not disable word, visit or ±5-second seek requests. Initial loading and playback errors still disable seeking; readiness does not carry over to a replacement player. Pause remains available during a pending seek; blur/background/source changes invalidate stale resume callbacks. Returning never automatically resumes. Player status subscribes to the current native player identity and reads its snapshot after subscription and lifecycle changes; cached status from a replaced player cannot disable newly recovered audio. Existing validated media stays attached during foreground revalidation to retain position. Review displays saved per-slide durations and explicit English words/min and Korean Hangul runs/min over total rehearsal time, including silence; no new metrics/detectors are computed. Review/refresh/download/replay make no process POST; only explicit Analyze/Retry can do so.

## Historical Stage 1 local capture boundary

The imported PDF's `localDeckId` is a catalog key, not a server UUID. Native viewer callbacks supply the actual `pageCount` and zero-based selected page. Rehearsal timestamps page changes when the native page callback confirms the visible page, not when a navigation button is pressed. Capture starts only after PDF load/page confirmation; repeated callbacks of the same page add no new visit.

Stage 1 used a Results route carrying session-only `audioUri`, `slideEvents`, `durationMs`, `localDeckId`, `pageCount`, `title` and `pdfUri`. That was a local preview handoff, not upload metadata or a durable attempt. Stage 2 below supersedes it for imported PDFs; sample captures still use a local preview. Do not put a local catalog key in `LocalRecording.deck_id`; the current storage flow resolves a server deck UUID and creates one attempt UUID per recording before upload. Stage 1 changed no backend endpoints.


## Stage 2 durable storage boundary

`feature/recording-storage-upload` restores local SQLite attempt records while leaving the imported PDF catalog and files intact. A local attempt has its own UUID plus `local_deck_id`, title, PDF URI, page count, audio URI, audience and slide-event checkpoints. It acquires a server `deck_id` only after deck upload. Local keys never masquerade as server UUIDs. The Results route now takes only `attemptId` for durable real recordings; sample previews remain separate.

The prepared audio URI and initial visible slide are stored in one SQLite write before capture starts. Startup recovery must succeed before a new capture is allowed, and native audio time/events are saved at page changes and about every second. On restart, unfinished capture requires explicit recovery against playable media duration; interrupted uploads can be retried with the same ID. Unplayable or oversized files remain local. Audio exceeding 25,000,000 bytes is rejected before any upload request with an explanation to make a shorter new recording; local playback remains available. Recovery cannot reconstruct audio that Android failed to finalize.

Limits: 10 slides, 20 MiB PDF, 600,000 ms recording, and exactly 25,000,000 audio bytes. Deck content/preparation hashes deduplicate PDFs. Attempt hashes include the audio and normalized metadata: identical retries return the original attempt; conflicting IDs return HTTP 409, including concurrent submissions. Added model fields are migrated without replacing old media. Audio is decoded locally to validate the audio duration against metadata (up to a 1,000 ms codec tail); container headers alone do not establish playable audio. Each submission writes to unique media paths. Failure cleanup protects the committed winner, and uncertain database outcomes retain media for later reconciliation; cleanup failures may leave unreferenced files. No automatic orphan deletion is implemented.

Attempt GET/history add `deck_id`, `duration_ms`, `slide_events`, `audience`, `created_at`, `audio_url` and `processing_state`. An uploaded unprocessed recording has status `pending`, processing_state `awaiting_analysis`, transcript `null` and no feedback. The mobile upload function does not call processing. Explicit hosted analysis is described above.

Deck mappings are keyed by API address and local deck ID. Before reuse, the client checks server UUID identity and page count via deck GET; only HTTP 404 or an invalid local mapping permits PDF replacement. Transient lookup failures retain the mapping. An uncertain audio response, 409, or failed local acknowledgement save never allocates a new attempt UUID. A submitted recording can be uploaded to another configured API address with that same attempt UUID.

Verification boundary: automated SQLite/native mocks and Django tests are distinct from real Android restart/replay/offline retry, PostgreSQL races, and persistent server restart/media retrieval. Storage and hosted-processing coordinator evidence is recorded in [AI-use](ai-use.md#2026-10-08--hosted-processing-coordinator-verification-and-publication): real PostgreSQL/Redis/Celery, Android emulator and a controlled synthetic hosted pilot were checked. Physical-phone/human-speech quality and human code review remain pending.
