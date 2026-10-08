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
| `GET /attempts/{id}/feedback/` | None | 200: independent feedback state; read-only |
| `POST /attempts/{id}/feedback/generate/` | Strict JSON feedback request below | 202: active; 200: current completed; 409: revision/confirmation/cooldown conflict |

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
| `feedback`, `feedback_state` | Legacy shape retained. Whisper completion still saves `[]`, `disabled`; independent coaching is in `feedback_analysis` |
| `transcript_id`, `feedback_analysis` | Additive transcript evidence digest (nullable) and the safe coaching state below. Older mobile caches may omit both |
| `error` | Null, or safe `{code, message}` |
| `provenance` | `{provider, model, generation, outcome, speech_gate}`; values nullable; provider/model `openai`/`whisper-1`, request outcome `submitted`/`received`/`rejected`/`uncertain`, gate `silero-vad` |

Provenance identifies the received transcript's generation when one is available, otherwise the latest request. No raw provider response or input hash is public. Legacy rows retain stored results/media; migration never automatically queues them and labels existing results `legacy` rather than claiming they passed this pipeline. Legacy feedback remains untouched and is labeled `feedback_state=legacy`.

Hosted transcription uses exactly `whisper-1`, `verbose_json`, and `timestamp_granularities=["word"]`; seconds normalize to integer milliseconds with half-up rounding. Missing, malformed, nonfinite or unsafe numeric timestamps fail normalization without replacing the raw evidence. Words outside the authoritative recording duration fail alignment with `alignment_failed`, retaining raw/transcript as actionable partial results. Retry reuses saved raw/transcript; it cannot repair an invalid original timeline by re-transcribing or extending/clamping duration.

`metrics` contains `duration_ms`, `time_per_slide: [{slide_index, duration_ms}]` summed across all visits, `detected_language`, `speaking_rates: [{language, unit, count, per_minute}]`, and `rate_note`. Rates are separate `en` English word-pattern counts and `ko` contiguous Hangul-run counts, divided by **total rehearsal minutes including silence**. Korean's label is `Korean Hangul runs/min`; it is an estimate, not a linguistic word count or speaking-only rate. No filler/other detector is claimed.

The packaged Silero CPU gate checks a temporary PyAV-decoded waveform only. It never cuts, concatenates or rewrites provider input. Detection failure fails closed (`audio_check_failed`); no provider request occurs. Detected no-speech saves transcript `{text: "", words: []}` and `analysis_outcome=no_speech` before running `align_words([], slide_events, duration_ms)` and timing metrics. Completion retains every chronological visit with `words: []`, including simultaneous/zero-duration, repeated and backward visits. Metrics retain the authoritative recording duration and summed slide times, with `detected_language=und` and `speaking_rates=[]`. Original audio and slide events are unchanged and provider requests remain zero. Alignment failure retains the empty transcript and gate outcome as partial results; retry or stale-claim recovery reuses them without another gate/provider call.

Mobile Analyze requires a recording known to the current API, established by its upload or validated server history. First-use disclosure has Continue/Cancel and locally persisted consent. Retry refreshes first and supplies the displayed current revision; uncertain requests require a separate charge acknowledgement. A client timeout is not server failure. Polling stops on navigation/background; stale callbacks and API-address changes cannot update another cache. SQLite result records are keyed by normalized API address and attempt UUID, separately from upload metadata. Offline refresh preserves cache and audio. Synchronized review is described below; coaching is independently generated through the explicit API below and remains disabled by default.

## Durable slide descriptions (checkpoint 2)

These separate routes preserve existing deck responses, Whisper requests, upload
and transcription. Current attempt processing still saves legacy `feedback=[]`,
`feedback_state=disabled`; checkpoint 3 adds independent `AttemptResult.feedback_analysis`
metadata, explicit coaching and revision-aware dependency invalidation. Mobile
types, parsers, clients and cache reconciliation are implemented; feedback
UI/disclosure remains checkpoint 4.
Private preparation/evidence contracts are in [ai-feedback.md](ai-feedback.md).

| Route | Input | Response |
| --- | --- | --- |
| `GET /decks/{deck_id}/descriptions/` | Optional `description_set_id` UUID query | 200 state below; 404 for a missing deck or set belonging to another deck |
| `POST /decks/{deck_id}/descriptions/generate/` | Initial `{}`; retry shape below | 202 active state; 200 completed generated/edited cache; 409 revision/confirmation/cooldown conflict; safe 503 unavailable generation configuration |
| `PATCH /decks/{deck_id}/descriptions/` | Complete edit shape below | 200 state; 409 stale revision/source; 404 deck/set mismatch |

GET never mutates or publishes work. Without an explicit set, it resolves the
current nonsecret provider/project/model/prompt/schema and current source scope.
An explicit set remains readable with disabled feedback, missing keys or missing
media; unavailable/changed source or different current configuration sets `stale`.
Cached current-scope reads do not require a key. No implicit selection of another
provider's or earlier source's generated/edited data occurs.

Initial POST selects backend configuration only. Same-scope concurrent requests
share one generation. Active repeats return 202, completed repeats return 200,
without new work. A failed set requires:

```json
{"description_set_id":"11111111-1111-4111-8111-111111111111","processing_revision":1}
```

`needs_confirmation` additionally requires `"acknowledge_uncertain":true`.
The supplied revision must be current, even on active/completed replay; a missing
revision on failed work, stale revision, missing acknowledgement or future
`retry_at` returns 409. An accepted failed retry consumes N → N+1 atomically, so
concurrent replay wins once. It keeps the original saved scope, resolving the
original provider's key only for its configured project; it cannot select a new
model/provider via the request. A changed configuration/source creates a separate
scope via initial POST. Completed/edited sets cannot be paid-regenerated by POST.

PATCH requires exactly:

```json
{
  "description_set_id":"11111111-1111-4111-8111-111111111111",
  "description_revision":1,
  "descriptions":{"slides":[{
    "deck_id":"22222222-2222-4222-8222-222222222222",
    "slide_index":0,
    "source_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "summary":{"text":"Synthetic example only","uncertain":false,"uncertainty":""},
    "key_ideas":[],
    "visual_facts":[]
  }]}
}
```

The example is a fixture, not a usable source identity. Include every actual slide
exactly once; copy its current set's `provenance.sources` identity. Fact text must
be nonblank and at most 400 characters, uncertainty at most 400 characters, and
`uncertain` must exactly match whether its explanation is nonblank. At most five
key ideas and five visual facts per slide; no extras/coercion. Both fact `text` and
`uncertainty` reject U+0000 with `invalid_descriptions`; other Unicode is unchanged.
The full descriptions envelope is bounded to 64 KiB UTF-8 JSON. Edits validate current deck/source and
compare revision atomically; concurrent edits have one winner. An edit increments
`description_revision` and `processing_revision`, marks origin `edited`, and
fences a running generation. Its receipt/usage evidence is still retained privately.
No key/provider call is needed for edits. Feedback referencing this set's previous
revision becomes stale through revision-aware public derivation under the same
set lock. Queued/running coaching cannot submit or publish current results from
the superseded revision; late receipts/usage remain private evidence. Existing
suggestions remain readable with `stale=true`. Explicit feedback reanalysis uses
the newest descriptions without retranscribing. Other description scopes and
their feedback are unaffected.

POST/PATCH require `application/json`, an object, no duplicate/extra fields, and
at most 70 KiB request bytes before parsing/preparation. UUIDs are canonical lower
case. Revisions are integers 0..2147483647 (not booleans/strings). Optional
acknowledgement is boolean. Retry fields without `description_set_id`, client
provider/model/project/key/URL overrides and malformed JSON return safe 400.
Errors use `{error:{code,message}}`; they never echo provider or source content.
PATCH invalid descriptions/media return 400; generation's unavailable configuration
(including quotas or unavailable historical prompt/schema) returns 503. Source
reconstruction can also fail locally in the queued job before any submission.

Every successful GET/POST/PATCH uses this **explicit allowlist**:

| Field | Meaning |
| --- | --- |
| `deck_id`, `description_set_id` | Deck UUID; set UUID or null when absent |
| `state` | `absent`, `disabled`, `configuration_unavailable`, `source_unavailable`, `queued`, `preparing`, `submitted`, `normalizing`, `waiting_quota`, `completed`, `failed`, `needs_confirmation` |
| `stage` | `descriptions` for a set, otherwise null; coaching has its own state below |
| `processing_revision`, `description_revision` | Independent nonnegative integers; 0 for an absent set. Processing revisions advance on admission/retry and edit fencing; description revisions advance only on complete generated/edited saves |
| `descriptions`, `edited` | Null or complete `{slides:[...]}` as above; boolean user-edit origin |
| `provenance` | Null or `{provider,project_id,model,prompt_version,schema_version,origin,sources:[{slide_index,source_id}]}`. `origin` is null before a result, then `generated` or `edited`; project ID is nonsecret |
| `created_at`, `updated_at` | Nullable ISO times for scope creation and latest current-generation state/receipt or revision/result update. Superseded receipts do not advance current freshness |
| `queued_at`, `claimed_at`, `submitted_at`, `received_at`, `completed_at` | Nullable ISO times from latest job/request; completion is the latest description save when data exists |
| `error` | Null or fixed safe `{code,message}`; no errors manufactured into descriptions |
| `retry_at`, `retry_available` | Nullable ISO time including shared 429 cooldown; boolean true only for failed/uncertain work whose time has passed. Configuration, revision and acknowledgement still apply |
| `requires_confirmation` | True only for `needs_confirmation` |
| `stale`, `available_data` | Changed/unavailable current source or configuration; whether a complete set remains available (including edited data) |

Absent states have null data/provenance/timestamps/set ID/stage, zero revisions,
false booleans, and a safe error except for plain `absent`. Internal `superseded`
jobs are hidden behind completed edited data. Raw receipts, payloads, input hashes,
source snapshots, claim tokens, credentials and internal quota records are never
public. Source reference hashes in descriptions/provenance are the permitted
slide evidence references, not private request input hashes.

Database queue intent precedes best-effort broker publication. The existing
30-second Beat recovery handles lost publication, eligible local quota waits and
expired unsubmitted claims (360-second lease, 300-second task limit). Duplicate
workers are fenced. Submission commits the application quota reservation and
submitted marker before the sole provider call, outside transactions. Disabled
feedback/project mismatch/unreconstructible source or prompt prevents submission.
HTTP receipts, including rejected, malformed, oversized or incomplete bodies, are
saved privately before normalization. Crash recovery uses that receipt without a
new call. Receipt-save acknowledgement loss defers to lease recovery: normalize
the saved sanitized receipt if present, otherwise require uncertainty confirmation;
never normalize unpersisted output. A failed completion write/commit leaves the
same receipt eligible for recovery; it does not classify the output as invalid
or permit paid regeneration.
After retry or PATCH advances the revision, receipt-only recovery still discovers
unfinished late receipts, including jobs already marked `needs_confirmation`.
It finalizes only the original private request outcome without changing newer
jobs, generated/edited descriptions or their revisions.
Submitted-without-outcome work becomes `needs_confirmation`; it never
automatically resubmits. Known provider failures/invalid output require explicit
new-generation retry; only local quota waiting resumes automatically.

Provider/project/model buckets share rolling RPM/TPM reservations across stages
(including coaching). Required positive backend allowances
have no tier defaults. Reservation units are serialized UTF-8 bytes plus maximum
output tokens, separately recorded from actual reported usage. Unknown usage is
null, not zero; submitted reservations count through their windows. Requests
larger than the configured per-request allowance fail locally. Gemini daily
ceilings reset at America/Los_Angeles midnight; OpenAI's optional daily ceiling
is an application UTC policy. A 429 Retry-After blocks the shared model scope.
This is neither exact provider token accounting nor a money cap. See the
[configuration and validation details](ai-feedback.md#checkpoint-2-persistence-and-quota-policy).

## Durable rehearsal coaching (checkpoint 3)

Explicit `POST /attempts/{id}/feedback/generate/` admits `{}` once for a validated
saved transcript/alignment. The backend selects provider/project/model, description
and coaching prompt/schema versions, deck/source identity, saved language (or
`und`), audience (up to 500 characters), original transcript indexes and recording
chronology. No client provider/model selection or fallback is accepted. Initial
configuration and speech validation precede admission of either paid stage.
No-speech, missing/inconsistent transcript, invalid alignment and U+0000 in sources
fail locally; source text/audio/duration are never rewritten or clamped. Whisper's
processing state/revision/retries remain independent. Upload, Analyze, GET/history,
refresh and replay never generate feedback.

An existing exact-scope description set, including its edited revision, is reused.
Otherwise the same selected scope is queued/reused through checkpoint 2. The
feedback job remains `waiting_descriptions`; Beat safely attaches a naturally
completed dependency and continues coaching, even if broker publication is lost.
Failed/uncertain description work is never automatically paid-retried. Its
`dependency` identifies the exact set and independent revisions/action. Explicit
retry of that description generation advances unfulfilled feedback dependencies;
PATCH is an edit and instead fences them as stale.

Actions and their independent revisions:

| Situation | Explicit action |
| --- | --- |
| First feedback analysis | `POST /attempts/{id}/feedback/generate/` with `{}` |
| Failed or stale coaching | Same route with `{"feedback_revision": N}` from a fresh feedback GET |
| Uncertain coaching, including uncertainty alongside staleness | Same retry plus `"acknowledge_uncertain": true` |
| Failed description dependency | `POST /decks/{deck_id}/descriptions/generate/` with `description_set_id` and **`processing_revision`** from `dependency` |
| Uncertain description dependency | That description request plus its own `"acknowledge_uncertain": true`; acknowledging feedback cannot retry descriptions |
| Correct descriptions | `PATCH /decks/{deck_id}/descriptions/` with its set ID, **`description_revision`** and complete descriptions; then explicit feedback reanalysis |

Feedback requests are bounded to 1,024 bytes and exactly the optional keys
`feedback_revision`, `acknowledge_uncertain`. Revisions are actual integers in
0..2^31−1; booleans/strings/extras/duplicate JSON keys are rejected. An
acknowledgement without the required retry revision returns 409; the mobile client
rejects that incomplete action locally. Initial admission requires `{}`. GET accepts
no query parameters; neither route accepts client scope selection. Unsupported
methods are rejected by the route. Missing attempts return 404; malformed bodies
or invalid saved sources return 400; generation unavailable due to configuration
returns safe 503. The endpoints are trusted-local development APIs, without an
authentication claim.

Active requests return 202 and current completed requests return 200 without new
paid work. Supplied stale/replayed revisions return 409 even on active/completed
work. Failed/stale retry requires the current feedback revision; missing revision,
required uncertainty acknowledgement or an unexpired cooldown returns 409. Accepted
retry consumes N → N+1 exactly once. Retries retain the original provider/project/
model and source snapshot. Same-project key rotation is supported with late key
resolution; project mismatch blocks a call. Current backend selection affects new
analyses only. Cached results remain readable when generation is disabled or keys
are absent. A changed saved recording/source identity is an explicit `source_changed`
conflict; it cannot authorize retranscription or silent snapshot substitution.

Staleness does not waive uncertainty acknowledgement while a saved receipt awaits
normalization: HTTP 408/5xx and incomplete HTTP 200 bodies already require it from
their durable transport metadata. Complete HTTP 200 and known HTTP rejections
(including auth/rate/validation errors with incomplete bodies) do not become
ambiguous merely because normalization is pending. Reads/admission do not normalize
or alter the receipt; recovery finalizes that original request without another call,
even if an acknowledged retry has already advanced the feedback revision.

Every feedback GET, successful generation response and nested
`AttemptResult.feedback_analysis` uses this allowlist:

| Field | Meaning |
| --- | --- |
| `attempt_id`, `feedback_revision` | Recording UUID and independent coaching generation (0 before initial admission) |
| `state` | `absent`, `disabled`, `unavailable`, `waiting_descriptions`, `queued`, `preparing`, `submitted`, `normalizing`, `waiting_quota`, `needs_confirmation`, `failed`, `completed`, `stale` |
| `stage` | `descriptions` while dependency is unfulfilled, `coaching` afterward, null before admission |
| `availability` | `{state: available\|disabled\|unavailable, error}`; independent of stored work/result state |
| `provenance` | Null or `{provider, project_id, model, prompt_version, schema_version, coaching_prompt_version, coaching_schema_version}`. Description and coaching versions are explicit; project ID is nonsecret |
| `description_set_id`, `description_revision` | Captured set; fulfilled revision or null while waiting |
| `dependency` | Null or `{deck_id, description_set_id, state, processing_revision, description_revision, updated_at, error, retry_at, retry_available, requires_confirmation, retry_action}`; `retry_action` is `generate_descriptions` or null. `updated_at` tracks current dependency transitions, including failure, uncertainty and receipt recovery |
| `created_at`, `updated_at`, `queued_at`, `claimed_at`, `submitted_at`, `received_at`, `completed_at` | Nullable ISO times. `updated_at` is the latest coaching-job update, description-set update, or current coaching request's receipt/finalization time, including dependency transitions and description-edit invalidation. Late current-generation receipts advance freshness even while stale; older feedback generations' receipts do not advance the current snapshot |
| `retry_at`, `retry_available`, `requires_confirmation`, `error` | Coaching action metadata and fixed safe error. Confirmation can remain true while `state=stale`; dependency confirmation is separate |
| `stale` | Current generation's description/recording snapshot no longer matches; never silently replaced |
| `last_output` | Null or current generation's `{status, accepted_count, discarded_count}`; includes `all_invalid` while a previous result may still be available |
| `result` | Null or latest usable result (including valid empty); when no earlier usable result exists, may expose the failed `all_invalid` output. Its stale flag is independent of current work/error |

`result` contains `status` (`accepted`, `partial`, `empty`, `all_invalid`),
`accepted_count`, `discarded_count` (total ≤3), `suggestions`, `message`,
`feedback_revision`, `description_set_id`, `description_revision`, `provenance`,
`completed_at`, `stale`, and `evidence`. Valid empty has zero counts/cards and
`message="No supported suggestions."`; other statuses have null message.
`all_invalid` is a **failed** generation (`unsupported_feedback`), never successful
empty output. Malformed envelopes/refusal/truncation/NUL output fail explicitly
and retain private raw evidence. Unsupported well-formed cards are discarded
individually; partial results report both counts. A failed/new generation can
coexist with earlier suggestions, labeled stale with their original provenance.

Each suggestion has `category` (`consistency`, `clarity`, `audience`), `slide_index`,
`source_id`, `transcript_id`, `visit_id`, `segment_id`, inclusive `word_start`/
`word_end`, `speech_quote`, `description_ref`, `slide_quote`, `observation`,
`suggestion`, and server-derived `start_ms`/`end_ms`. Observation/suggestion are
bounded to 600/700 characters, speech quote to 1,000, slide quote to 400. All are
plain strings. An audience card requires saved audience context. Evidence is one
contiguous run of original transcript indexes in a ≤40-word segment of one visit.
The entire cited description fact must match exactly and be certain. Repeated
phrases do not establish word identity. Word starts select visits; last simultaneous
event wins. Crossing word ends are valid within authoritative audio duration; ranges
use min(start)/max(end) without clipping. Structural evidence validity does not
establish semantic correctness or coaching usefulness.

The safe `evidence` context is exactly `{attempt_id, deck_id, transcript_id,
chronology_id, duration_ms, page_count, audience_supplied, visits, sources,
descriptions}`. Visits contain `slide_index`, `start_ms`, `end_ms`, `word_indexes`;
sources contain `slide_index`, `source_id`; descriptions are the result's captured
revision, never substituted current edits. Actual transcript words come from the
attempt result, bound by `transcript_id`. Raw receipts, payloads/source snapshots,
input/recording/audience hashes, tokens, keys and request/quota internals stay private.
Public slide/transcript/chronology digests are evidence identities, not provider
request hashes. No code, HTML, markdown links or URLs from feedback are executed.

Migration 0006 creates an analysis/generation queue, adds nullable coaching ownership
to `FeedbackRequest`, makes description ownership nullable, and constrains exactly
one owner with the correct stage. Existing rows, Whisper request uniqueness and
media remain untouched. Submission commits its reservation and marker before one
outbound call. Receipt persistence precedes normalization. Missing submitted
outcomes after claim expiry require confirmation; saved receipts recover without
keys/media or another call, even after retry/edit supersession or lost persistence
acknowledgement. Completion-write failures leave received evidence recoverable,
not invalid. Old receipts/usage finalize independently and cannot publish current
results. Description PATCH and coaching submission/completion serialize on the same
set lock; captured revisions fence both. Claims last 360 seconds, tasks 300, and
Beat recovery uses the existing schedule. Local quota/dependency waiting can resume;
provider failures/invalid output never trigger automatic paid repair calls.

Mobile contracts/clients exist without new screens. Attempt parsing allowlists and
quarantines optional feedback independently, preserving legacy caches and partial/
no-speech replay. Reconciliation compares coaching revision and update time separately
from Whisper revision; malformed or older feedback cannot erase newer valid cached
feedback. The client derives `result.evidence_verified` on every parse; it is never
trusted from wire/cache. Complete transcript, chronology, source/fact and derived-time
validation (and page-count agreement at use) gates `feedbackSeekTarget`; missing
context yields no seek target. Legacy top-level cards grant no evidence capability.
API-address isolation/cancellation remain unchanged. UI/disclosure is checkpoint 4;
controlled model-quality evaluation is checkpoint 5.

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
