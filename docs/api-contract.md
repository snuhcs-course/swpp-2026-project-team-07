# Initial API contract

> Provider update, October 16, 2026: new transcription requests use ElevenLabs Scribe v2. Older phase descriptions mentioning Whisper describe the previous provider; saved Whisper responses and results are still supported. See [current adapter](scribe-transcription.md).


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
| `POST /attempts/{id}/feedback/generate/` | Strict JSON feedback request below | 202: active; 200: current completed; 409: selection/revision/confirmation/cooldown conflict |
| `POST /decks/{id}/qa/questions/` | Strict JSON Audience Q&A question request below | 200: `{questions, provider, model}`; 404 `deck_not_found`; 503 configuration; 429 cooldown; 502 provider |
| `POST /decks/{id}/qa/answers/` | Multipart `audio`, `metadata` JSON string (below) | 200: answer transcript and review; same errors |

Current mobile flow: finish capture → save locally → open saved result → upload PDF if needed → upload audio with the same attempt UUID → request initial processing automatically after first-use OpenAI disclosure. The upload endpoint/helper still only stores audio; the saved screen coordinates the separate process request. Cancelled/older recordings retain manual Analyze. Upload handlers validate the known deck, slide bounds, UUID uniqueness, supported audio/container, duration/size limits and metadata. Reject conflicting uploads for an existing ID. New recording means new ID; upload retries retain the ID, audio and normalized metadata. Identical retries return the existing attempt; conflicting valid content returns 409. Processing retries retain the ID/audio and avoid duplicate provider work.

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

## Iteration 2 Phase 1: presentation requirements

`PresentationContext` is independent of deduplicated decks, original attempt audiences,
and JJ's local selected-run record. Multiple contexts may reference the same deck.
No context operation admits provider/worker work, modifies a transcript/run, or changes
the current recording limit. See [the full phased contract](iteration-2-ai-feedback.md).

| Route | Exact JSON input | Response |
| --- | --- | --- |
| `POST /presentation-contexts/` | `{id, deck_id}` canonical lowercase UUIDs | 201 new; 200 identical identity retry, returning current requirements; 409 context ID bound to another deck |
| `GET /presentation-contexts/{id}/` | None; no query fields | 200 current context; 404 missing |
| `PATCH /presentation-contexts/{id}/` | `{expected_revision, required_duration_seconds, audience}` | 200 current/updated; 409 stale or exhausted revision; 404 missing |

All success responses are `{id, deck_id, required_duration_seconds, audience, revision}`.
Creation starts at `{required_duration_seconds:null, audience:"", revision:0}`. Duration,
when supplied, is an integer 60–1,800 seconds; audience is a string of at most 500 Unicode
code points without U+0000 or unpaired surrogates; valid emoji are accepted. Duration `null` and audience `""` clear requirements. Blank
audience is still missing for readiness. Legacy target times and "Faculty panel" never
backfill these fields. Partial requirements are valid persisted data, not a ready AI input.

POST and PATCH require `application/json`, a body of at most 8,192 bytes, exact fields,
no duplicate keys, and strictly typed values. Revisions are integers 0–2,147,483,647;
booleans/string numbers are invalid. PATCH locks the context and requires the current
revision even for an identical-value request. Unchanged values leave the revision intact;
changed values advance it once. An exhausted revision cannot advance. Creation retries
must retain the context ID and deck ID and cannot reset current requirements.

Invalid requests return 400; missing identities 404; conflicts 409; unexpected database
failures 503. Errors are fixed `{error:{code,message}}`, without source data or raw
exceptions. These endpoints retain the existing local unauthenticated pilot boundary.

Mobile helper records are separate from JJ's existing presentation/run stores and are
scoped by API address and local presentation identity. They preserve reserved context
IDs across failed POSTs, validate server identity, ignore older revisions, and reject
conflicting values at the same revision. No new UI is wired in Phase 1.

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
| `feedback`, `feedback_state` | Legacy shape retained. Transcription completion still saves `[]`, `disabled`; independent coaching is in `feedback_analysis` |
| `transcript_id`, `feedback_analysis` | Additive transcript evidence digest (nullable) and the safe coaching state below. Older mobile caches may omit both |
| `error` | Null, or safe `{code, message}` |
| `provenance` | `{provider, model, generation, outcome, speech_gate}`; values nullable; provider/model `elevenlabs`/`scribe_v2` for new requests or `openai`/`whisper-1` for historical requests, request outcome `submitted`/`received`/`rejected`/`uncertain`, gate `silero-vad` |

Provenance identifies the received transcript's generation when one is available, otherwise the latest request. No raw provider response or input hash is public. Legacy rows retain stored results/media; migration never automatically queues them and labels existing results `legacy` rather than claiming they passed this pipeline. Legacy feedback remains untouched and is labeled `feedback_state=legacy`.

Hosted transcription uses ElevenLabs `scribe_v2`, `timestamps_granularity=word`, `no_verbatim=false`, `tag_audio_events=false`, `diarize=false` and `use_multi_channel=false`; only `type=word` entries become timed words. Saved Whisper raw responses are normalized according to their persisted provider. For both formats, seconds normalize to integer milliseconds with half-up rounding. Missing, malformed, nonfinite or unsafe numeric timestamps fail normalization without replacing the raw evidence. Words outside the authoritative recording duration fail alignment with `alignment_failed`, retaining raw/transcript as actionable partial results. Retry reuses saved raw/transcript; it cannot repair an invalid original timeline by re-transcribing or extending/clamping duration.

`metrics` contains `duration_ms`, `time_per_slide: [{slide_index, duration_ms}]` summed across all visits, `detected_language`, `speaking_rates: [{language, unit, count, per_minute}]`, and `rate_note`. Rates are separate `en` English word-pattern counts and `ko` contiguous Hangul-run counts, divided by **total rehearsal minutes including silence**. Korean's label is `Korean Hangul runs/min`; it is an estimate, not a linguistic word count or speaking-only rate. No filler/other detector is claimed.

The packaged Silero CPU gate checks a temporary PyAV-decoded waveform only. It never cuts, concatenates or rewrites provider input. Detection failure fails closed (`audio_check_failed`); no provider request occurs. Detected no-speech saves transcript `{text: "", words: []}` and `analysis_outcome=no_speech` before running `align_words([], slide_events, duration_ms)` and timing metrics. Completion retains every chronological visit with `words: []`, including simultaneous/zero-duration, repeated and backward visits. Metrics retain the authoritative recording duration and summed slide times, with `detected_language=und` and `speaking_rates=[]`. Original audio and slide events are unchanged and provider requests remain zero. Alignment failure retains the empty transcript and gate outcome as partial results; retry or stale-claim recovery reuses them without another gate/provider call.

Mobile Analyze requires a recording known to the current API, established by its upload or validated server history. First-use ElevenLabs disclosure has Continue/Cancel and locally persisted provider-specific consent. Previous OpenAI consent does not authorize ElevenLabs submissions. Retry refreshes first and supplies the displayed current revision; uncertain requests require a separate charge acknowledgement. A client timeout is not server failure. Polling stops on navigation/background; stale callbacks and API-address changes cannot update another cache. SQLite result records are keyed by normalized API address and attempt UUID, separately from upload metadata. Offline refresh preserves cache and audio. Synchronized review is described below; coaching is independently generated through the explicit API below and remains disabled by default.

## Iteration 2 Phase 3: required timing and thirty-minute audio

There is no new wire endpoint, allocation job or migration. Existing presentation
contexts retain their Phase 1 shape/revision contract. The mobile read model uses
an explicitly supplied duration only when the local PDF/API/server-deck binding
matches; it never converts a legacy suggested target into a requirement. Audience
may remain missing for time allocation alone. Allocation reuses JJ's bounded
text-weighted largest-remainder algorithm: nonnegative whole seconds, exact total,
stable slide-order ties. Empty/image-only slides use base weight. Budgets can be
zero when slide count exceeds available seconds. This is a heuristic budget,
not an AI quality judgment. Changing duration recomputes current targets and
selected-run Review totals without changing saved attempts, selected segments,
Compare snapshots, profiles or transcripts. Clearing duration restores suggestions.
Reopen, refresh and playback do not admit allocation/provider work.

The attempt API now accepts 1–1,800,000 integer milliseconds, retaining the exact
25,000,000-byte cap and existing audio/metadata identity/retry policy. New Android
capture uses mono AAC/MPEG-4 at 64 kbps and requests normal native finalization
at 1,799,000 ms, preserving the existing one-second stop margin. Metadata never
extends past the authoritative cap; decoding permits only the existing one-second
codec tail. Recovery, result/review and verified feedback playback accept the same
timeline. Original files remain unchanged; no trimming, recompression or chunking.
Provider prompt/schema scopes and existing timeout/receipt/recovery rules remain
unchanged. [Phase 3 verification and remaining UI/device limits](phase-3-verification.md).

## Durable slide descriptions (checkpoint 2)

### Iteration 2 Phase 2 — immutable slide profiles

`GET /decks/{deck_id}/profiles/` returns the same bounded `DescriptionState`
envelope as descriptions, but in the independent current profile scope. Optional
`description_set_id` selects a saved profile belonging to that deck; selecting an
ordinary description set returns 400. GET never admits work. `POST
/decks/{deck_id}/profiles/generate/` accepts the existing strict generation/retry
body and returns 200 completed or 202 retained/active state. Failed or uncertain
initial lookup retains its existing state without retrying. Explicit retries
require the saved set ID and processing revision; uncertain work also requires
`acknowledge_uncertain: true`. Stale retry revisions conflict. Quotas, receipts,
lease fencing and broker/Beat recovery are shared with descriptions.

Successful PDF upload automatically admits the current profile scope when provider
configuration and source preparation are valid. AI admission failure does not fail
PDF import. Repeated uploads reuse exact source/provider/project/model/prompt/schema
scopes, including failed and uncertain jobs; no blind resubmission. Existing decks
without profiles can use explicit generation. Requirements, recordings, selected
takes, playback and reads neither invalidate profiles nor create jobs.

Current profile prompt version is `slide-profile-v5`; schema versions are
`slide-profile-v5` (OpenAI) and `slide-profile-gemini-v5` (Gemini). v5 targets
8–16 words with a hard maximum of 25 whitespace-separated words per cue in both
categories. Each cue has one useful speaking objective; avoid repetitive clauses,
near-duplicate objectives and padded instructions. Supporting reasoning stays in
expandable details. This is a generation policy, not silent truncation.
Historical v1–v4 payloads, validation limits and prompt digests remain unchanged;
v4 retains its 15-word limit for receipt recovery and explicit retries. Successful
v4 profiles for the same source/provider/project/model remain reusable and current,
including for review and audience Q&A; running or uncertain v4 jobs also retain
their scope to avoid duplicate provider work. Reads do not admit replacement jobs. Failed
or absent v4 profiles use v5 for new admission. An already admitted v5 scope takes
precedence and repeated admissions reuse that scope.
Profiles use
the existing JSON persistence, with no migration. PATCH through the description
endpoint rejects profile scopes with 409 `immutable_profile`.

Each profile has the ordinary `deck_id`, `slide_index`, `source_id`, `summary`,
`key_ideas` and `visual_facts`, plus `slide_kind` (`title`, `content`, `closing`,
`unknown`). Historical v1 profiles retain `cues` (zero to four, ordered); current
v2 profiles instead require `must_cover` and `go_deeper`, each zero to three ordered
items. Must Cover expresses essential speaking objectives rather than scripts or
bullet summaries. Each Must Cover item is
`{text, evidence_refs}`: nonblank text up to 400 Unicode codepoints and one to
five distinct references to existing **certain** facts (`summary`,
`key_ideas/0..4`, `visual_facts/0..4`). Duplicate cue text, unsupported references,
uncertain evidence, missing fields, invalid Unicode or extra model fields fail
the entire generated profile. Existing source, fact, slide completeness and 64 KiB
output limits apply. Gemini omits wire array bounds while local validation retains
them. Graph axes, units, numerical values and trends are retained as visual facts;
ambiguous readings carry uncertainty and cannot ground cues.

Each Go Deeper item is `{text, kind, evidence_refs, information_needed}`. Text is
nonblank and at most 400 codepoints; `kind` is `connection` or `question`.
References are one to five distinct objects `{slide_index, source_id, fact_ref,
quote}` identifying certain facts on any slide in this same complete profile
response. `quote` must be a contiguous, verifiable excerpt of the referenced fact after safe
quotation normalization (see the evidence-validation policy below). Unknown slide,
source, fact, uncertain fact or unsupported quote rejects the whole response.
`information_needed` is empty for supported connections; questions require a
nonblank description of the missing evidence, at most 400 codepoints. Questions
must frame unsupported answers as investigations, not established causes/results.
Canonical exact duplicates across categories and verbatim fact restatements are
rejected. These structural checks do not prove semantic entailment or detect all
paraphrased redundancy; prompt rules, live evaluation and human judgment remain
necessary. Optional suggestions never become mandatory coverage findings.

Source or selection changes select a new scope and mark saved profiles stale.
Old snapshots remain available by set ID. Mobile uses a separate
`slide-profiles:v1:<encoded API>:<deck UUID>` cache, validates identities/evidence,
retains successful cached cues offline and prevents reversed refreshes from
restoring an older scope. JJ's existing cue panel shows distinct unavailable,
pending, failed, confirmation-required, stale, insufficient-evidence and successful
states. A compact essential/optional selector reuses the existing Rehearse area;
empty categories remain empty. Historical v1 cues remain parseable in cache but
are never relabeled Must Cover: the panel offers explicit updated generation.
Reading/reopening never admits replacement jobs. No keyword heuristic is presented
as an AI cue or confirmed omission. Server unavailable responses without a
replacement set expose their current state while retaining the last complete
offline payload. Confirmed absent/source-unavailable scopes or changed selection
identity persist its stale marker. Historical v2 pilot caches also show outdated
status under newer prompts, even offline; replacements always require explicit admission.
Current cue text expresses one concise speaking objective; no linking rationale
is appended. Evidence quotes and missing-information details remain stored and
are collapsed behind an in-panel Details control, including during recording.
Details reset on slide/category/profile changes. Content slides are encouraged
to have meaningful central-message or contrast objectives before returning an
empty collection; sparse or unreadable slides may still be empty without padding.

### Existing description contract

These separate routes preserve existing deck responses, Whisper requests, upload
and transcription. Current attempt processing still saves legacy `feedback=[]`,
`feedback_state=disabled`; checkpoint 3 adds independent `AttemptResult.feedback_analysis`
metadata, explicit coaching and revision-aware dependency invalidation. Mobile
types, parsers, clients, cache reconciliation and checkpoint-4 feedback
UI/disclosure are implemented.
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

New slide-unbounded schemas use `description-gemini-v4` / `coaching-gemini-v3`
for Gemini and `description-v2` / `coaching-v2` for OpenAI. The fixed prompt
versions remain `description-v2` / `coaching-v1`. Local validation requires
one or more slides, complete unique source coverage and at most five facts in
each fact array. Existing context, output and provider limits still apply.
Saved older selections retain their 10-slide wire schema and retry identity. Effective schemas enter
prompt digests, request hashes, selection tokens and description cache scopes.
Saved Gemini description v1/v2/v3 jobs/retries/receipts reconstruct their exact
historical schemas, request hashes and digests, including coaching waiting for
descriptions before an input hash exists. Coaching v1/v2 stay unchanged. Unknown
versions fail locally. Existing rows/results/provenance are not rewritten or
automatically upgraded; retrying rejected legacy work retains its old wire schema.
A new Gemini description scope requires explicit initial admission; an existing
feedback analysis remains bound to its captured set/schema. No migration, fallback
or retranscription is involved. See [compatibility details](ai-feedback.md#checkpoint-5-gemini-schema-compatibility).

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
| `selection` | Null or the effective new/saved generation descriptor below, even before data exists |
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
30-second Beat recovery handles lost publication, eligible OpenAI local quota waits and
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
new-generation retry; only OpenAI local quota waiting resumes automatically.
Gemini local RPM/TPM/daily exhaustion or shared cooldown ends the generation as
`failed` with fixed safe `quota_stopped` guidance and the calculated `retry_at`.
Current-generation legacy Gemini `waiting_quota` jobs (including queued jobs with
a retained wait marker) stop on task claim or Beat recovery, even after expiry.
Saved provider identity governs this policy, never the current environment.
Saved receipts normalize first; submitted-without-outcome uncertainty, live claims,
edits and revision fences retain precedence. GET never performs this transition.
Explicit retry before the effective cooldown returns 409; after it expires, the
current revision permits one new generation with the saved selection. Replayed
revisions return 409. No provider switching or fallback occurs.

Provider/project/model buckets share rolling RPM/TPM reservations across stages
(including coaching). Required positive backend allowances
have no tier defaults. Reservation units are serialized UTF-8 bytes plus maximum
output tokens, separately recorded from actual reported usage. Unknown usage is
null, not zero; submitted reservations count through their windows. Requests
larger than the configured per-request allowance fail locally. Gemini daily
ceilings reset at America/Los_Angeles midnight; OpenAI's optional daily ceiling
is an application UTC policy. A 429 Retry-After blocks the shared model scope.
Actual provider 429 responses remain terminal `provider_rate_limit` failures for
both providers and require an explicit retry after cooldown.
This is neither exact provider token accounting nor a money cap. See the
[configuration and validation details](ai-feedback.md#checkpoint-2-persistence-and-quota-policy).

## Durable rehearsal coaching (checkpoint 3)

Explicit `POST /attempts/{id}/feedback/generate/` admits `{}` once for a validated
saved transcript/alignment. The backend selects provider/project/model, description
and coaching prompt/schema versions, deck/source identity, saved language (or
`und`), audience (up to 500 characters), original transcript indexes and recording
chronology. An omitted `FEEDBACK_PROVIDER` selects OpenAI for new work; explicit
Gemini is supported, and saved selections/model defaults are unchanged. Feedback stays
disabled until configured. Missing OpenAI credentials never fall back to Gemini.
No client provider/model selection or fallback is accepted. Initial
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
`feedback_revision`, `acknowledge_uncertain`, `expected_selection`. Revisions are actual integers in
0..2^31−1; booleans/strings/extras/duplicate JSON keys are rejected. An
acknowledgement without the required retry revision returns 409; the mobile client
rejects that incomplete action locally. Initial admission accepts `{}` or assertion-only `{"expected_selection":"<token>"}`. GET accepts
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
| `selection` | Null or the effective new/saved generation descriptor below; independent of result provenance |
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
`completed_at`, `stale`, `description_origin`, and `evidence`. The captured origin is
`generated`, `edited` (the complete set has edits), or `unavailable` for legacy
snapshots; later edits never relabel an older result. Valid empty has zero counts/cards and
`message="No supported suggestions."`; other statuses have null message.
`all_invalid` is a **failed** generation (`unsupported_feedback`), never successful
empty output. Malformed envelopes/refusal/truncation/NUL output fail explicitly
and retain private raw evidence. Unsupported or malformed cards are discarded independently within a valid bounded
envelope; partial results report both counts. Malformed envelopes still fail. A failed/new generation can
coexist with earlier suggestions, labeled stale with their original provenance.

Each suggestion has `category` (`consistency`, `clarity`, `audience`), `slide_index`,
`source_id`, `transcript_id`, `visit_id`, `segment_id`, inclusive `word_start`/
`word_end`, `speech_quote`, `description_ref`, `slide_quote`, `observation`,
`suggestion`, and server-derived `start_ms`/`end_ms`. Observation/suggestion are
bounded to 600/700 characters, speech quote to 1,000, slide quote to 400. All are
plain strings. An audience card requires saved audience context. Evidence is one
contiguous run of original transcript indexes within one slide visit. The segment
ID anchors the first word; the span may cross internal 40-word chunk boundaries,
but never the original visit boundary. A cited description must be certain; a
contiguous safely normalized excerpt is accepted, then the full authoritative fact
is returned to preserve qualifications and negations. Repeated
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
Beat recovery uses the existing schedule. OpenAI local quota waiting and successful
dependencies can resume; Gemini local quota waits stop as `failed` / `quota_stopped`
under the same policy as descriptions. Provider failures/invalid output never
trigger automatic paid repair calls.

Checkpoint-4 mobile review uses the validated contracts/clients in the existing saved screen. Attempt parsing allowlists and
quarantines optional feedback independently, preserving legacy caches and partial/
no-speech replay. Reconciliation compares coaching revision and update time separately
from Whisper revision; malformed or older feedback cannot erase newer valid cached
feedback. The client derives `result.evidence_verified` on every parse; it is never
trusted from wire/cache. Complete transcript, chronology, source/fact and derived-time
validation (and page-count agreement at use) gates `feedbackSeekTarget`; missing
context yields no seek target. Legacy top-level cards grant no evidence capability.
API-address isolation/cancellation remains in place. The checkpoint-4 workflow below
adds provider disclosure and revision-checked editing; model-quality evaluation is checkpoint 5.

## Generation selection assertion and mobile feedback review (checkpoint 4)

Feedback and description reads expose `selection` independently of stored
`provenance`. It is null only when the configured selection cannot be described;
legacy responses/caches may omit it. The descriptor includes `provider`, nonsecret
`project_id`, `model`, description `prompt_version`, `schema_version`,
`prompt_digest`, `stage` (`descriptions` or `coaching`), `disclosure_version`
(currently `feedback-v1`) and a lowercase 64-hex `token`. Coaching adds
`coaching_prompt_version`, `coaching_schema_version`, `coaching_prompt_digest`.
The token is SHA-256 over canonical UTF-8 JSON of these fixed-order descriptor
fields (before adding `token`); clients treat it as opaque. Prompt digests identify
fixed rules/schema/output bounds. No key, input/source/audience hash, private
receipt or claim data participates. Keys may rotate without changing it.

New analyses describe current backend selection. Existing feedback and explicit
saved-description reads describe their saved selection, even after the default
changes. Both generation POST routes accept optional `expected_selection` (the
64-hex token). Assertion-only initial requests are valid. Supplied malformed tokens
return 400; a different effective selection returns safe **409
`selection_mismatch` before queue intent/publication, reservation or provider work**.
Admission rechecks a concurrent initial winner against its saved selection. The
assertion compares; it cannot select a provider/model, authenticate or replace the
existing revision/uncertainty checks. Explicit legacy callers omitting it remain
compatible and do not receive disclosure-race protection. PATCH accepts no assertion
and retains its exact existing complete-set/revision payload.

Mobile always includes the assertion in feedback generation and description retry,
using fresh read metadata. Legacy caches remain readable but cannot authorize a
request without refreshed selection metadata. First-use consent is keyed by
normalized API address, provider and disclosure version, separately from Whisper.
Continue/Cancel callbacks capture a unique prompt; refreshing, navigation,
backgrounding and API/attempt/source changes invalidate them. The disclosure names
the provider/model and slide images/text, descriptions, saved transcript and optional
audience context; feedback sends no audio. A mismatch refreshes without resubmitting
and requires another explicit generation action.

Feedback KV keys are `feedback:v1:<encoded normalized API>:attempt:<attempt UUID>`;
description keys are `...:descriptions:<deck UUID>:<set UUID>` with a `...:deck:<deck
UUID>` last-read pointer. Consent uses `...:consent:<provider>:<disclosure version>`.
An unresolved submission marker (`...:pending:<attempt UUID>`) is durably written
before POST and retained through timeout/navigation/restart until reconciliation or
an acknowledged explicit retry. It stores only action kind, revision, set ID and
selection token. Existing `analysis:v1` and `review:v1` records remain readable;
feedback never manufactures a local capture. Revisions/timestamps reconcile
independently of Whisper; operation/session fencing rejects late reads/mutations.
Validated description responses also advance the matching dependency metadata, so
an older feedback GET cannot restore its consumed confirmation/retry revision.
Completed dependencies continue polling while waiting for coaching to attach them.

Refresh occurs before every mutation. Unknown submitted requests require a separate
charge acknowledgement if fresh reads cannot establish admission. Repeated taps are
locked synchronously. Polling is focus/foreground-only; return does not generate or
play. Cache/network/malformed feedback failures preserve valid feedback, descriptions,
transcript and media with safe notices. Feedback errors use local fixed copy rather
than arbitrary HTTP/provider messages. Active, quota, failed, confirmation, stale,
partial, supported-empty and all-invalid states remain distinct.

Descriptions expose collapsible slides from their validated slide/source identities
and a local full-set draft, independently of deck metadata availability. Unknown
actual page count still disables evidence seeking. Edits
change only existing fact text/uncertainty, preserve all IDs/other slides, enforce
400-code-point fields, NUL/uncertainty rules and 64 KiB UTF-8 JSON bounds. Save uses
the draft's captured `description_revision`; preflight conflict, PATCH conflict or
timeout retains that draft and offers explicit Reload/Cancel. Reload releases its
lock and resumes lifecycle-fenced active-job polling on success or failure.
Keystrokes/Cancel do
not PATCH. Generation is disabled until Save/Cancel. Successful edits immediately
mark matching feedback stale even when feedback refresh is unavailable. Regeneration
is explicit and reuses the saved transcript with no Whisper call.

At most three plain-Text suggestions preserve returned languages. Expandable quotes
are labeled Slide description (captured set origin, not necessarily verbatim PDF)
and Transcript excerpt. Source validity does not establish truth or transcription
accuracy. No model URL/link/HTML/Markdown is executed or fetched. `feedbackSeekTarget`
rejects both analysis/result staleness and revalidates actual source/word/visit/range
context; UI additionally requires known actual pages and available audio. The existing
playback controller preserves playing/paused intent, rapid seek/Pause ordering,
backward/simultaneous visits and native-clock PDF synchronization.

## Mobile rehearsal review

This stage reuses the GET deck/history/attempt and explicit process endpoints above, without backend schema or provider changes. `/results?attemptId=<UUID>` opens a real rehearsal; a malformed ID cannot open the sample preview. `DeckDetail` and `ReviewAttempt` are validated mobile read models, not new wire response schemas. Deck/attempt identities, page bounds and authoritative recording duration gate usable capabilities. Missing legacy fields can leave text available while timing, downloads or processing are unavailable. Review parsing cannot authorize a process request without the existing strict `AttemptResult` validation and fresh revision check.

Library merges local captures with `GET /decks/{id}/attempts/` only for known presentation mappings at the normalized API address. It deduplicates attempt UUIDs within that API, displays cache first and preserves entries on refresh failure with a stale notice. History/detail reconciliation cannot roll back a newer analysis revision or replace a terminal result with an older active snapshot. A server-only review copy is never persisted as a `SavedAttempt` or an imported PDF. Local recovery/upload retry keeps the existing UUID and source recording.

Saved-review **Refresh** retries both attempt and deck metadata GETs, so a transient deck lookup failure can recover PDF download availability without leaving the screen. Deck refresh preserves cache on failure, supersedes older requests, and cancels on blur, background or identity changes. It cannot process an attempt.

SQLite KV additions use `review:v1:<encoded normalized API>:<kind>:<UUID>`: `deck`, `history` (attempt IDs), `attempt`, `media-audio` and `media-pdf`. Audio media keys use attempt UUID; PDF media keys use deck UUID. Existing `analysis:v1` records, upload mappings and capture/import catalogs remain separate; no destructive migration or automatic eviction is added. API identity changes cancel in-flight reads/downloads and detach the old native player. Switching API does not reuse another API's downloaded media or processing permission; original local captures remain available locally.

When an upgraded installation has only an `analysis:v1` result, review derives its available transcript/timing/media metadata from that API-scoped result without requiring network access or a migration write. Incomplete/legacy refreshes render the reconciled cache result; a failed cache write retains the current validated in-memory review and shows the cache failure notice. Late responses after navigation, backgrounding or an API change cannot replace it.

Media recovery is an explicit GET from validated `audio_url`/`pdf_url`. Only same-origin HTTP(S) URLs without credentials, fragments or redirects are accepted, retaining development HTTP support. Local absolute paths normalize to `file://`; local `file://`/`content://` sources are checked before use. Interrupted-capture recovery compares canonical original URIs and persists that URI for upload; a downloaded review copy cannot replace the original capture. Downloads stream into unique owned temporary files, enforce actual bytes as well as declared size (audio **25,000,000**, PDF **50 MiB**), and time out after 120 seconds for audio or 300 seconds for PDF. Native validation must complete before the unique durable file and cache record are published: audio must load with finite positive duration within 1,000 ms of saved duration; PDF must load with **one or more** pages matching the deck. Native error, cancellation or a 15-second audio / 45-second PDF validation timeout rejects publication. Reopening a download verifies file size/hash and native usability. Concurrent consumers share a download; if the validating consumer leaves, a remaining consumer validates the same temporary file before publication, without another GET. The last cancellation stops it. Audio and PDF failures are independent. Cleanup targets only the failed operation's owned files and never replaces/deletes previously good or original media; cleanup failure can leave an unreferenced file.

The native player's position is the only playback clock. Visits use zero-based slides and integer milliseconds; half-open intervals and last-simultaneous-event-wins policy apply. Repeated/backward and zero-duration visits remain distinct in the list; previous/next transport skips instantaneous intervals, and selecting one seeks its exact timestamp without inventing duration. Hold the final page at EOF. Valid recorded events provide labeled **Recorded navigation** when alignment is absent. Transcript punctuation/whitespace are preserved; token mismatch falls back to plain text. Out-of-duration, invalid or zero-length word timings cannot highlight or seek; neither transcript nor native codec tails extend the recording duration.

EOF notifications pass through the seek controller: queued/running newer seeks retain playing intent, and delayed completion checks the fresh native position. An unsuperseded seek to the recording's end settles paused; normal EOF and explicit Pause still stop playback. Native media-error callbacks belong to the rendered source and focus session; detached or cancelled callbacks cannot clear replacement or retained media.

An ordinary native pause (such as audio-focus loss) clears playing intent, so later word/visit seeks remain paused until Play is chosen. This reconciliation requires a loaded, non-buffering native snapshot outside pending/running seeks; delayed pause notifications cannot override a fresh playing snapshot. EOF keeps the separate seek/position policy above.

Seeks serialize native operations and replace older queued targets with the newest. After this native player first loads, buffering does not disable word, visit or ±5-second seek requests. Initial loading and playback errors still disable seeking; readiness does not carry over to a replacement player. Pause remains available during a pending seek; blur/background/source changes invalidate stale resume callbacks. Returning never automatically resumes. Player status subscribes to the current native player identity and reads its snapshot after subscription and lifecycle changes; cached status from a replaced player cannot disable newly recovered audio. Existing validated media stays attached during foreground revalidation to retain position. Review displays saved per-slide durations and explicit English words/min and Korean Hangul runs/min over total rehearsal time, including silence; no new metrics/detectors are computed. Ordinary review/refresh/download/replay make no process POST. Explicit Analyze/Retry and the single-use new-capture handoff below are the only processing entry points.

Mobile analysis requires a recording known to the current API, established by its upload or validated server history. Finalizing a real capture saves a local `auto_process_api` intent alongside the audio checkpoint; it is pinned to the configured API address. The saved screen consumes that intent before I/O and, while focused/foreground, uploads and requests initial analysis once. Background capture stops open the result on foreground return. First-use disclosure has Continue/Cancel and locally persisted consent, explicitly covering automatic transcription after future recordings. Cancellation, reopening and Refresh do not create another automatic request. A failed upload remains manually retryable; retrying it within the same result screen continues the initial automatic flow. Returning to that still-mounted screen can continue initial work that has not yet been submitted. After screen unmount or app restart, manual Upload/Analyze can resume stopped work. Legacy, interrupted and sample captures do not acquire this intent.

The initial request refreshes server state first and only starts `awaiting_analysis`; active/completed/failed/uncertain results are never automatically resubmitted. Retry refreshes first and supplies the displayed current revision; uncertain requests require a separate charge acknowledgement. A client timeout is not server failure. Polling stops on navigation/background; stale callbacks and API-address changes cannot update another cache. SQLite result records are keyed by normalized API address and attempt UUID, separately from upload metadata. Offline refresh preserves cache and audio. The synchronized review UI retains readable partial transcripts and existing playback; coaching remains a separately generated, explicit action.

## Redesigned mobile app and Audience Q&A (October 14, 2026)

The mobile UI was rebuilt from the design prototype (see `REDESIGN.md`). The upload, processing, feedback and deck endpoints above are unchanged and are used as before. The mobile flow changed as follows.

- **Import:** the app renders page images on the device and calls `POST /decks/` at import time to read `extracted_text`. It stores the result under the same `server-deck:<API>:<local id>` mapping that attempt uploads use. Offline imports fetch the text later.
- **Takes:** every recording is a normal attempt with the existing `auto_process_api` handoff. A background worker per take replaces the former saved-result screen: it consumes the intent once, uploads, and requests initial processing after the first-use disclosure. A presentation's run (which take supplies each slide), moved-sentence placement and suggestion dismissals remain client-side SQLite records (`pres:v1:`, `deck:v1:`). Phase 4 synchronizes confirmed text corrections independently, as described below; the original legacy records are retained.
- **Coaching:** `POST /attempts/{id}/feedback/generate/` is still requested only after an explicit tap, with the existing disclosure and charge acknowledgement.

The section "Mobile rehearsal review" above describes the pre-redesign review screens. Its cache and media rules remain in the mobile services; the new screens use the cached results, transcripts and local audio.

### Audience Q&A

Audience Q&A has two synchronous endpoints. Each POST is one explicit user action. They use the same provider selection and gates as descriptions and coaching: `FEEDBACK_ENABLED=true`, the selected provider, model, key and project id, and positive RPM/TPM settings. They return 503 with `disabled`, `missing_api_key`, `invalid_configuration` or `quota_configuration` otherwise.

Each call makes one provider request with no retries or fallback. Answers also make one hosted Whisper request. The server stores neither questions nor answer audio. The audio is written to a temporary file for Whisper and deleted afterwards; the phone keeps its own copy and the results.

**Quota limit:** these requests are not recorded as `FeedbackReservation` rows, which belong to description and coaching jobs, so they do not count against the RPM/TPM windows. They do refuse to run during an active provider cooldown on the shared quota bucket (429 `waiting_quota` with `retry_at`), and a provider 429 sets that cooldown.

Question request (`Content-Type: application/json`, at most 80,000 bytes, no extra fields):

```json
{
  "audience": "Faculty panel",
  "slides": [{"slide_index": 0, "title": "Problem", "transcript": "Feedback arrives after the talk..."}]
}
```

- `slides` has one or more items within the deck's page count.
- `title` is at most 200 characters; `transcript` is at most 6,000.
- The server adds each slide's `extracted_text`, up to 2,000 characters.

The response keeps at most three questions, and only those whose `slide_index` was supplied:

```json
{"questions": [{"panelist": "P1", "role": "Methods reviewer", "slide_index": 0, "topic": "Survey size",
  "question": "How many people answered?", "follow_up": "Was the sample random?"}], "provider": "openai", "model": "gpt-6-luna"}
```

Answer `metadata`:

```json
{"question": "Was the sample random?", "main_question": "How many people answered?", "part": 1, "slide_index": 0, "duration_ms": 42000}
```

- `part` is 0 for the main question and 1 for the follow-up.
- `duration_ms` is 1–300,000.
- Audio follows the attempt audio rules: a supported extension and 1 to 25,000,000 bytes.

The response is:

```json
{"transcript": {"text": "...", "words": [{"text": "We", "start_ms": 0, "end_ms": 210}]}, "duration_ms": 42000,
 "verdict": "partly", "did": "...", "evidence": "...", "clarify": "..."}
```

- `verdict` is `answered`, `partly` or `too_short`.
- `too_short` (under 8 seconds or fewer than 15 transcribed words) makes no feedback request and returns empty `did`, `evidence` and `clarify`.

**Errors** use `{error: {code, message, retry_at?}}`:
- 404 `deck_not_found`. The app then uploads the PDF again once through `POST /decks/` and retries.
- 400 `invalid_request`, `unsupported_audio` or `invalid_audio_size`.
- 502 provider or Whisper failure; when the outcome is uncertain, the message says the request may have been charged.
- An older server without these routes returns Django's plain 404, which the app reports as "update the backend".

## Historical Stage 1 local capture boundary

The imported PDF's `localDeckId` is a catalog key, not a server UUID. Native viewer callbacks supply the actual `pageCount` and zero-based selected page. Rehearsal timestamps page changes when the native page callback confirms the visible page, not when a navigation button is pressed. Capture starts only after PDF load/page confirmation; repeated callbacks of the same page add no new visit.

Stage 1 used a Results route carrying session-only `audioUri`, `slideEvents`, `durationMs`, `localDeckId`, `pageCount`, `title` and `pdfUri`. That was a local preview handoff, not upload metadata or a durable attempt. Stage 2 below supersedes it for imported PDFs; sample captures still use a local preview. Do not put a local catalog key in `LocalRecording.deck_id`; the current storage flow resolves a server deck UUID and creates one attempt UUID per recording before upload. Stage 1 changed no backend endpoints.


## Stage 2 durable storage boundary

`feature/recording-storage-upload` restores local SQLite attempt records while leaving the imported PDF catalog and files intact. A local attempt has its own UUID plus `local_deck_id`, title, PDF URI, page count, audio URI, audience and slide-event checkpoints. It acquires a server `deck_id` only after deck upload. Local keys never masquerade as server UUIDs. The Results route now takes only `attemptId` for durable real recordings; sample previews remain separate.

The prepared audio URI and initial visible slide are stored in one SQLite write before capture starts. Startup recovery must succeed before a new capture is allowed, and native audio time/events are saved at page changes and about every second. On restart, unfinished capture requires explicit recovery against playable media duration; interrupted uploads can be retried with the same ID. Unplayable or oversized files remain local. Audio exceeding 25,000,000 bytes is rejected before any upload request with an explanation to make a shorter new recording; local playback remains available. Recovery cannot reconstruct audio that Android failed to finalize.

Limits: at least one slide, 50 MiB PDF, 1,800,000 ms recording, and exactly 25,000,000 audio bytes. Deck content/preparation hashes deduplicate PDFs. Attempt hashes include the audio and normalized metadata: identical retries return the original attempt; conflicting IDs return HTTP 409, including concurrent submissions. Added model fields are migrated without replacing old media. Audio is decoded locally to validate the audio duration against metadata (up to a 1,000 ms codec tail); container headers alone do not establish playable audio. Each submission writes to unique media paths. Failure cleanup protects the committed winner, and uncertain database outcomes retain media for later reconciliation; cleanup failures may leave unreferenced files. No automatic orphan deletion is implemented.

Attempt GET/history add `deck_id`, `duration_ms`, `slide_events`, `audience`, `created_at`, `audio_url` and `processing_state`. An uploaded unprocessed recording has status `pending`, processing_state `awaiting_analysis`, transcript `null` and no feedback. The mobile upload function does not call processing. Explicit hosted analysis is described above.

Deck mappings are keyed by API address and local deck ID. Before reuse, the client checks server UUID identity and page count via deck GET; only HTTP 404 or an invalid local mapping permits PDF replacement. Transient lookup failures retain the mapping. An uncertain audio response, 409, or failed local acknowledgement save never allocates a new attempt UUID. A submitted recording can be uploaded to another configured API address with that same attempt UUID.

Verification boundary: automated SQLite/native mocks and Django tests are distinct from real Android restart/replay/offline retry, PostgreSQL races, and persistent server restart/media retrieval. Storage and hosted-processing coordinator evidence is recorded in [AI-use](history/ai-use-before-stack-consolidation-2026-10-11.md#2026-10-08--hosted-processing-coordinator-verification-and-publication): real PostgreSQL/Redis/Celery, Android emulator and a controlled synthetic hosted pilot were checked. Physical-phone/human-speech quality and human code review remain pending.


### Saved render preparation for feedback

Feedback admission accepts stored PDF renders up to 8 MiB per image and creates
bounded provider copies when needed (1 MiB per image, 8 MiB total, existing
1600-pixel dimension checks). Uploaded PDF and slide media are unchanged.
Compatible image bytes/source IDs remain unchanged; converted evidence identities
use the bytes actually sent to the provider. Invalid or missing saved media still
rejects admission without provider work. The mobile rejection message identifies
the PDF/slide source issue instead of suggesting a revision refresh will repair it.

## Iteration 2 Phase 4 — confirmed transcript overlays

Correction persistence, feedback invalidation and explicit regeneration are separate
operations. No correction GET/PATCH, screen opening, navigation or audio playback
admits AI work. Original Whisper text/words, audio, slide events/visits and attempt
processing generation remain immutable inputs to the correction layer.

| Route | Request | Behavior |
| --- | --- | --- |
| `GET /attempts/{id}/corrections/` | No query/body | Read source identity, current revision and confirmed overlays; no row created |
| `PATCH /attempts/{id}/corrections/` | `{base_transcript_id, expected_revision, edits}` | Save only; 200 current snapshot, 409 stale revision/source, 400 invalid input |
| `GET /attempts/{id}/correction-suggestions/` | No query/body | Read the independent STT-suggestion analysis; never queue |
| `POST /attempts/{id}/correction-suggestions/` | Existing feedback admission/retry fields, plus optional `transcript_revision` | Explicitly generate/retry STT suggestions, 202 pending or 200 completed cache |

Correction snapshots are `{attempt_id, base_transcript_id, revision, edits,
effective_text, source_changed}`. `base_transcript_id` is the existing original
transcript evidence digest. Revision starts at zero. Each edit is exactly
`{word_start, word_end, text}` with inclusive original word indexes, nonempty
replacement text (at most 4000 characters), no NUL, and nonoverlapping ranges.
The complete sorted set has at most 2000 edits; PATCH is bounded to 262144 bytes
and rejects duplicate/extra fields, noninteger/boolean revisions and ranges.
Whitespace is normalized in replacement text. No-op effective text retains its
revision and canonical edit representation; stale expected revisions still conflict.
Original punctuation is preserved where source text/words map exactly; otherwise
effective text falls back to indexed source words plus confirmed replacements.

If the original transcript digest changes beneath existing corrections, reads
retain the old database record, return `source_changed=true`, and do not apply its
old ranges to the new source. Writes/analysis reject the stale source rather than
silently rebasing it. Automatic source rebasing is not implemented. Normal
processing retries retain the attempt/audio and do not rewrite successful STT.

Coaching retains original indexed words/quotes for validated playback evidence.
Its private snapshot additionally captures the synchronized correction revision,
overlays, effective text and `recognition-v2` analysis augmentation. The provider
is instructed to analyze the corrected text, not report confirmed STT errors as
presentation problems. It must still quote original timed evidence; corrections
never manufacture word timings. A whole-attempt analysis depends on its whole
transcript, so boundary edits invalidate that attempt, including all relevant
visits. Other attempts and immutable slide-only profiles/cues are unaffected.
Stored original STT metrics remain original-source data; JJ's current text-based
display estimates derive from the corrected selected-run lines.

Feedback state/results add `transcript_revision`, `analysis_type` and
`analysis_version`; older cached coaching defaults to original revision zero.
Completed historical output is retained with `stale=true` after changed input.
An old running job cannot publish as current after a correction; its receipt and
usage still finalize safely. Explicit coaching POST may include
`transcript_revision`; a mismatch returns 409. Client regeneration first refreshes
and synchronizes pending corrections, rejects conflicts/offline failures, and
checks again immediately before POST. Saving a correction never calls that POST.

STT suggestions use a separate `FeedbackAnalysis` type
`transcription_suggestions`, unique alongside `coaching` per attempt. They reuse
description context and the existing durable jobs/quotas/receipts/recovery;
transport/request stage remains `coaching` internally, but the prompt, output
validator, result namespace and analysis identity are distinct. Suggestion output
has at most 30 entries `{word_start, word_end, original, error_type, replacements, reason}`,
with one to three replacements. Validation requires exact original indexed text,
no overlapping suggestions/confirmed edits, and bounded nonempty strings. None
is automatically applied. Failed description prerequisites retain their own
revisioned retry and uncertainty acknowledgement. Failure is not an empty success.

Repeated admissions reuse active/completed matching attempt/revision/type/version
and description/provider scope. Failed/uncertain calls retain explicit revisioned
retry; retry generations are not new input revisions. STT suggestions become
unusable when their source revision changes or local edits are pending/conflicted.
Accepting one saves a correction only, never presentation feedback.

Mobile state uses separate API/attempt-scoped `transcript-corrections:v2:` and
`transcription-suggestions:v2:` records. Old v1 correction caches and `deck:v1`
free-text edits are archived in place, never imported or displayed as corrections. Pending saves survive reload/offline failures;
later edits cannot be cleared by earlier responses. Server conflicts require
Use server/Keep mine; repeated refresh does not resolve them implicitly. A
successful no-op save accepts canonical server ranges if no newer local edit
intervened. Dismissal is source-revision/range-specific and does not advance the
transcript revision. Accepted replacements retain sentence playback. Display-only highlight spans
reuse original source-range start/end timestamps (a replacement phrase is one
range, with no invented internal timing); source words/audio/visits remain intact.
Boundary-spanning replacements fall back to safe original mappings.

Migration 0008 preserves existing rows and admits multiple analysis types. Upgrade
the isolated API/workers together before admitting the new type; old process
queries do not filter it. Downgrade is verified for legacy-only data, and explicitly
refused once new correction/type records would be lost. Keep 0008 installed until
new data is deliberately archived/reconciled; do not delete it to force rollback.


### Phase 4 recognition-only product amendment

This amendment supersedes Phase 4's earlier manual/custom editing scope. Users
may accept an offered recognition replacement, keep the original, play its source
audio, or restore an accepted correction. No sentence editor, arbitrary replacement,
custom option or slide-spelling heuristic can rewrite the transcript. Substance,
grammar, fillers, repetitions and inaccurate explanations require rerecording.

The provider must identify likely malformed/unrecognized words, technical terms,
proper nouns, acronyms or mixed-language recognition errors. `error_type` is one of
`malformed_word`, `technical_term`, `proper_noun`, `acronym`, `mixed_language`.
No grammar/style category is accepted. Slide disagreement alone is not recognition
evidence. The prompt explicitly preserves grammar, fillers, repetitions and factual
claims; uncertainty should produce no suggestion. Human audio confirmation remains
necessary: model classification is not acoustic verification.

PATCH still receives the complete three-field edit list. Unchanged accepted edits
and removals/restores are allowed. Every new replacement must exactly match a
current completed recognition-v2 suggestion for the same attempt/source/revision,
with current description/analysis evidence; otherwise the request is rejected (400).
A stale expected correction revision still returns 409. No AI call is admitted.
The server alone persists `suggestion_job_id` and a stable `recognition_policy`
inside overlay JSON on explicit acceptance. Clients cannot submit that metadata.
Reads expose only three-field edits and apply only explicitly accepted, validated
provenance. A future matching offer cannot activate an archived manual edit.
Accepted provenance survives analysis-version changes; newer outputs still require
current analysis-version evidence. Existing unsupported overlay rows remain stored
but are not applied; their policy change invalidates old feedback via its analysis
version without changing original STT or silently advancing transcript revisions.

Historical STT result schemas are unusable as new candidates but do not block
metadata refresh, explicit retry or polling. Old coaching remains retained/outdated
locally, including offline. Accepted corrections and restore continue to invalidate
feedback without automatic regeneration. Cues/audio-only metrics remain reusable.

## Iteration 2 Phase 5 — selected-slide review

`GET /api/attempts/{id}/slide-review/?scope=<JSON>` is read-only. POST to the same
route explicitly generates/retries, using `scope` plus the existing feedback fields
`feedback_revision`, `transcript_revision`, `expected_selection`, and
`acknowledge_uncertain`. Initial completed/running identical scopes reuse results.
Retries require the current feedback revision; uncertain submissions require the
existing acknowledgement. Description dependency recovery retains its own endpoint.

Scope: `{context_id: UUID|null, slides: [{slide_index, segments: [{start_ms,end_ms}]}]}`.
Indexes are zero-based and times integer audio-relative milliseconds. A selected
slide must include exactly all its positive-duration visits in that attempt, in
chronological order. Invented/clipped/omitted visits, duplicate slides and contexts
from another deck are rejected. Normal mobile calls scope one selected slide.
Source attempt is the route identity; run labels are not analysis identity.

FeedbackAnalysis uses `review_` plus 24 hexadecimal SHA256 scope characters, within
its existing 32-character type field and existing attempt/type uniqueness constraint.
No migration. Jobs snapshot `slide-review-v3`, explicit requirements and revision,
original STT identity, confirmed correction revision, selected intervals, provider
selection, image-aware profile and description revision. The review profile reuses
cached cue work; it does not mutate cues. Legacy coaching/STT output stays separate.

The response extends feedback metadata with `scope`, `review_version`, `requirements`
and result `slides: [{slide_index,status,evaluation_mode,findings,enrichments}]`. Each slide has zero to four
prioritized findings. Status is `successful`, `insufficient_evidence`, `partial`,
`invalid_evidence`, or `model_error`; job pending, failure and outdated states remain
independent. Insufficient speech/model-declined assessment is distinguished from
rejected references and malformed AI output. Valid findings survive invalid peers.
Invalid/omitted evidence never becomes a zero-problem successful result. Findings
carry original word/visit/segment identity, authoritative speech/fact quotes and
derived playback ranges. Speech-only findings
may omit slide-fact quotes. Timing findings are deterministic, have no word range
(`word_start/end=-1`), and navigate to the first selected visit.

Context or effective transcript changes retain but invalidate dependent feedback.
Scope changes select another durable analysis. Corrections near boundaries invalidate
all scopes consuming that source transcript conservatively. Late receipts retain usage
but cannot publish current output. Reopening/refresh/playback never submit jobs;
explicit generation synchronizes accepted corrections first. Missing requirements
are null/blank, never inferred from legacy attempt audience or suggested targets.


Phase 5 automatic-first follow-up: completed recording/transcription marks initial
selected-slide work eligible. The app-level host admits it once with a durable
initial marker; completed results have no Analyze action. The POST API remains
revision/dedup protected and reusable by explicit Update/retry. Corrections do not
trigger that initial workflow, and no historical-deck backfill is implied.

October 16 purpose-aware amendment: the shared evaluator automatically selects
`informative_descriptive`, `analytical_persuasive`, or `mixed_or_uncertain` from
full-deck evidence. A chart alone does not imply an analytical purpose. It applies
only relevant criteria, checks supplied effective speech before recommending
additions, and does not demand hypotheses or unrelated topics for an introduction.
Each slide may include zero to two optional `enrichments: [{kind:"illustrative",idea}]`
(maximum 500 characters each), separate from the zero-to-four problem findings.
These are explicitly hypothetical examples/analogies or invitations to recall an
authentic anecdote; no external factual claims or search calls are implemented.
Opening Go deeper only expands cached content. Purpose and enrichment are in the
same durable versioned result; no additional job or automatic retry is introduced.
Version-1 results remain retained and display as outdated, with explicit Update
feedback required. The mobile parser accepts a historical v1 result only if the result is marked stale (including a retained v1 result while
a newer v2 owner is pending). Reusable cues are unaffected.


## Phase 6 — durable selected-run audience Q&A

The synchronous legacy `/decks/{id}/qa/questions/` and `/qa/answers/` endpoints remain
compatible for older clients. The JJ Q&A screen now uses these additional routes:

- `GET /attempts/{anchor}/audience-qa/?scope=<JSON>` inspects only; no provider work.
- `POST /attempts/{anchor}/audience-qa/` admits one durable question job or explicitly
  retries/updates an existing generation. Return 202 while pending, 200 when complete.
- `GET /attempts/{answer}/qa-answer/` reads the original recording's processing and
  evaluation state; 404 `answer_not_found` when not yet bound.
- `POST /attempts/{answer}/qa-answer/` binds an uploaded answer to a question and
  optionally requests recording processing or explicit evaluation recovery.

Question `scope` is `{context_id: UUID|null, slides:[{slide_index,attempt_id,
segments:[{start_ms,end_ms}]}]}`. Indexes are zero-based; every positive-duration
original visit for each selected slide must be supplied in chronological order,
including backward/repeated visits. Different slides may use different source takes;
all sources/context must belong to one deck. The anchor is the lexicographically
smallest normalized source UUID. Client-selected run identity lives in this manifest;
no claim is made that the server owns JJ's local Keep/Overwrite decision.

POST includes `scope`, `source_revisions:{attemptUUID: transcriptRevision}`, and the
existing feedback control fields `expected_selection`, optional `feedback_revision`
and `acknowledge_uncertain`. The server also accepts omitted source_revisions for
compatible direct callers, capturing current server revisions. Supplied maps must
exactly match all selected sources, otherwise 409 `correction_conflict`. Admission
uses deck then source locks. Analysis type `qa_<24 hex scope hash>` separates source
selections. Each generation captures `audience-qa-v2`, saved context requirements,
source identities/corrections and selected effective speech. Missing audience is
400 `missing_audience`, never the legacy Faculty panel default. Cached profiles carry
full-deck purpose/context; unselected transcript text is excluded from the AI payload.

Question responses use existing durable feedback states, dependencies, receipts,
retry/uncertainty/selection controls, plus `scope`, `qa_version`, `requirements` and
`source_revisions`. `result` adds `job_id`, `qa_version`, and one to three `questions`:
`{id,panelist,role,slide_index,topic,question,follow_up}`. IDs are stable within the
immutable job result. Panelist names are bounded to 64 characters. New captures
freeze `question_schema=names-v1`; older captures reconstruct the original
eight-character schema for receipt/hash compatibility. Old output is retained and marked stale; current active work
must not be hidden by its historical result. Revisions, audience or profile changes
never automatically enqueue updates. New selected recording workflows admit their
first eligible set once, independently of screen navigation; historical sets require
an explicit existing-screen action. Failed/uncertain calls use explicit recovery.

Answer audio first uses existing `POST /attempts/` with a new client UUID, deck,
capture duration (1–300,000 ms), and a single question-slide event at 0. Binding POST
uses `{question_job_id:integer,question_id:string,part:0|1,processing?:ProcessSerializer,
feedback?:existingFeedbackControls}`. The question job must be completed, on the same
deck and contain that ID/slide. A bound UUID cannot be rebound; conflicting question,
part or generation is 409 `source_changed`. A rerecord has a new UUID. Binding
persists before asynchronous processing. Repeated uploads retain existing content
hash conflict handling; repeated processing/evaluation requests reuse saved work.

Answer GET/POST responses contain `{attempt_id,question_job_id,question_id,part,
processing:{status,processing_revision,requires_confirmation,retry_available,error},
feedback:existingFeedbackState,result:null|{transcript,duration_ms,verdict,did,evidence,
clarify}}`. Recording status and feedback status are distinct. Saved successful STT
is reused after evaluation failure. Under eight seconds or fifteen words is
`too_short`, with original transcript/audio retained and no evaluation request.
Explicit retry retains existing cooldown/revision/charge-confirmation rules, including
failed profile dependencies. Follow-up evaluation receives its active question,
original main question and `is_follow_up` explicitly. Answer evaluations retain their
original question/audience after presentation requirements change.

New migration `0009_qaanswer` adds only an answer-to-Attempt/question-job binding
and a part 0/1 constraint. It does not rewrite existing media, attempts, transcripts,
contexts or feedback. Reversing it removes bindings, while original Attempt/media
and question jobs remain. Rehearsal history excludes bound answer attempts.

Before running this client against the development server: apply `python manage.py
migrate`, then restart the API, worker and recovery scheduler using the existing
development setup. No credential/env changes are required by Phase 6.


### October 16 — Q&A startup/navigation and expression feedback

Initial Q&A continues to start at app level alongside initial selected-slide feedback
once the selected source transcripts and saved audience are ready. Its durable
initial marker is consumed at the POST boundary, after synchronization/preflight.
Preflight failures can retry safely after a five-second backoff through background
GET polling (four seconds) or app foregrounding; failed/uncertain submitted provider
work retains explicit recovery. Consumed initial markers remain authoritative even
when a server later reports absent. This is not automatic stale-feedback regeneration.
Questions plus follow-ups are returned as one completed one-to-three-item batch.
The screen adopts that entire validated batch, retains answers within its job,
bounds navigation to actual available items and labels the last question. Pending
states offer no Next action; swipes/reopening/playback do not submit question jobs.

`slide-review-v3` retains the existing output schema and finding cap. Delivery findings
may critique transcript-supported ordering, articulation, ambiguous references and
connections between ideas. Their existing `suggestion` may include a concise
"Clearer way to express this" example preserving the original meaning, qualifications
and facts. It is optional future-rehearsal advice, never a persisted transcript edit
or STT suggestion. Natural fragments/mixed language are not automatically faults;
no unsupported claims or stronger conclusions may be added. Original indexed speech
remains the evidence and playback anchor. V2 prompt bytes remain available for saved
request reconstruction; retained v1/v2 results are outdated and require explicit
Update feedback. No migration, incremental audio, new screen or requirements sheet.


### Evidence-validation policy (October 16 follow-up)

Server normalization revision `evidence-v1` is separate from the unchanged
`slide-review-v3` generation prompt/schema. Python and TypeScript share a regression
corpus. Normalize NFC, explicit Unicode whitespace, ordinary prose capitalization,
in-word typographic apostrophes, and a single sentence-ending period only where
unambiguous. Token count/order and meaningful punctuation remain exact. Decimal
points, C++, negations, mathematical/programming operators, identifiers, acronyms,
and case-sensitive quantities/units must survive. `!` and `?` remain exact because
they may be operators. Never use fuzzy matching, word deletion, reordering, NFKC,
or punctuation stripping. Match against the indexed original transcript, then
return its authoritative text and original timings. Confirmed correction revisions
remain separate input/provenance; this does not rewrite transcripts.

Distinct findings may overlap evidence. Redundant normalized observation/advice
pairs on the same slide (and same visit for legacy coaching) are deduplicated;
shared quotes or word bags alone are not duplicates. This deliberately conservative
comparison does not attempt general paraphrase clustering. Scope/provenance object
comparison is structural; arrays retain order.

Each new review result includes `validation_revision`; each slide adds bounded
`validation: {rejected_count,reasons,duplicates_removed,speech_word_count,
model_insufficient}`. Fixed diagnostic reason codes appear in server warnings and
responses without private quotes. Invalid findings are isolated, optional malformed
enrichment cannot erase findings, and envelope/source-selection failures remain
strict. Raw provider receipts remain private.

GET, playback and navigation do not revalidate or regenerate saved reviews. An
explicit administrative command can revalidate one completed current receipt
without AI work; stale source/revision/generation/hash checks remain mandatory.
It defaults to dry run and applies idempotently only with `--apply`. See
[evidence verification](evidence-validation-verification.md) for commands and limits.
