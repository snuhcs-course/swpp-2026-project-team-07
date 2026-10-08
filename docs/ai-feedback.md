# AI feedback — checkpoints 1–2

Standalone adapters describe slides and validate at most three suggestions for
one rehearsal. Checkpoint 2 adds durable **saved-deck descriptions only**, with
separate read/generate/edit endpoints, database jobs/requests and application
quota reservations. Upload and transcription never call them. Current app
analysis still saves `feedback=[]`, `feedback_state=disabled`, even when description
configuration is enabled or misconfigured. Whisper credentials, request uniqueness,
attempt identity, retries, saved transcripts and playback are unchanged. There is
no rehearsal coaching orchestration or mobile consumer yet.

## Five-checkpoint ledger

| Checkpoint | State |
| --- | --- |
| 1 — provider adapters and evidence validation | Reviewed/tested local base `f07e55395d2e38eabec7c39ea766f643b2e5c7c1`; user authorized continuation to checkpoint 2. This does not claim human code review. |
| 2 — durable slide descriptions | Implemented and independently reviewed. Scoped cache, revision-checked edits, durable request/recovery evidence and provider-specific quota reservations; 172 tests passed on PostgreSQL, plus synthetic worker and API/database restart checks. Human inspection and confirmation remain pending. |
| 3 — durable rehearsal feedback | Not implemented: explicit generation endpoint, feedback revision/retry/staleness and shared response contracts. |
| 4 — feedback review UI | Not implemented: disclosure, suggestion cards, editable descriptions, evidence playback and offline caching. |
| 5 — controlled provider evaluation | Not implemented: compare both providers separately on saved non-confidential pilot inputs and document quality/recovery evidence. |

The pending checkpoints summarize the approved plan; no named owner assignments are inferred.
The five checkpoints are intended for **one eventual PR**. Checkpoint 2 stops before
rehearsal coaching, UI/disclosure, new detectors, local Whisper, authentication or
public deployment. The writer does not stage, commit, push or publish. No live
calls are part of its tests. See [team boundaries](team-work-division.md) and the
[existing public API](api-contract.md).

## Internal preparation and evidence contracts

`rehearsals/services/feedback.py` owns strict frozen models, image validation,
preflight and evidence normalization. `feedback_provider.py` owns fixed prompts,
selected-provider configuration, request construction and bounded transport.
No configuration is validated at Django startup or on the Whisper path.

1. `prepare_analysis(value, images)` accepts a strict JSON-shaped input and a tuple
   of already prepared PNG/JPEG **bytes**, never paths or URLs. It returns an
   immutable `PreparedAnalysis`. Invalid data fails before network access.
2. `prepare_deck(value, images)` returns immutable `PreparedDeck` from deck UUID,
   PDF content hash, preparation version and ordered slide text/language/images.
   No recording/transcript/audience is required. `prepare_analysis` retains its
   preflight and optionally takes `prepared_deck=` to share that exact saved source;
   legacy standalone calls derive a separate slide-only preparation identity.
   Description identity is independent of attempt, transcript and audience.
   `FeedbackAdapter.prepare_descriptions(deck)` returns a private `PreparedRequest`
   without network I/O. Nonsecret `Selection` allows preparation and editing without
   credentials; submission separately resolves the saved provider/project key.
3. `request_raw(prepared)` makes exactly one POST. It returns a private bounded
   `RawReceipt`, including HTTP status, raw bytes, completeness/issue, parsed
   Retry-After and available allowlisted integer usage counts. The durable
   description caller marks submission before this call and saves the receipt
   **before** `normalize(prepared, receipt)`. Coaching remains standalone.
4. Normalization returns a `DescriptionResult`. Optional edited descriptions use
   `adapter.edited_descriptions(analysis, value)` and pass the same validation.
   `prepare_coaching(analysis, descriptions)` requires matching provider/model and
   deck snapshot identity. Future orchestration must also select the exact persisted
   provider/project/prompt/schema scope and description revision. Both generated and edited descriptions stay untrusted data.
5. Persist the second raw receipt, then normalize into `FeedbackResult`. There is
   no convenience loop, provider fallback, repair request, token-count request,
   tool execution or automatic retry.

`value` has exactly `attempt_id`, `deck_id` (canonical lowercase UUID strings),
`duration_ms`, `speaker_language`, `audience`, `slides`, `transcript`, and `visits`.
Each ordered slide has `deck_id`, zero-based `slide_index`, `extracted_text`, and
`source_language` (use `und` when unknown). Images match slide order. The adapter
fully verifies/decodes each image and checks dimensions before pixel decoding.
A slide `source_id` hashes its identity/text/language and image bytes.

The transcript is null or `{text, words: [{text, start_ms, end_ms}]}`. Words retain
original order, including overlapping/unsorted timings and zero-duration words.
Their stable IDs are **original zero-based indexes scoped to `transcript_id`**,
which hashes attempt identity and immutable transcript contents. No word identity
is reconstructed by matching text/timestamps. A changed transcript/attempt gets a
new scope. Every new recording still requires its own attempt UUID; these adapters
do not create or replace attempt IDs.

Each chronological visit has `slide_index`, `start_ms`, `end_ms`, and
`word_indexes`. A later caller must carry indexes from the original transcript
through alignment (the existing `align_words` preserves added fields when copying
words). Preparation verifies the complete partition against assignment by start
and last-simultaneous-event-wins; every source word appears exactly once in its
correct visit and original order. Empty, repeated, backward and simultaneous
zero-duration visits remain distinct. Visit IDs are their chronological ordinals.
Segments are contiguous original-index runs within a visit, split after 40 words,
with deterministic `v{visit_id}s{ordinal}` IDs. No sorting or renumbering occurs.
No speech (`text` blank, words empty) returns preflight error `no_speech`; a null
transcript returns `missing_transcript`. Neither case requires **either** paid
stage. Contradictory empty text/words fails validation instead of generating data.

Description output is exactly `{slides: [...]}` with every source slide once.
Each entry copies `deck_id`, `slide_index`, `source_id` and supplies `summary`,
`key_ideas`, `visual_facts`. Each fact has `text`, boolean `uncertain`, and
`uncertainty`; uncertain facts must explain why, and certain facts have an empty
explanation. Prompts require source-language descriptions and uncertainty for
unreadable visual content, including summaries depending on it. Local validation
cannot determine whether a model has failed to flag an uncertain reading.
Fact `text` and `uncertainty` reject U+0000 before JSONB result persistence, without
stripping or rewriting other Unicode. Generated NUL facts produce safe
`invalid_descriptions` and a terminal `invalid` request with its raw receipt kept
privately; another provider call requires an explicit new-generation retry.
PATCH rejects the same malformed facts without changing descriptions or revisions.

Coaching output is exactly `{suggestions: [...]}`, with at most three cards for
the entire attempt. All fields are required; all objects forbid extra fields and
scalar coercion. Each card supplies:

- `category`: `consistency`, `clarity` or `audience`; audience needs nonblank supplied context.
- `slide_index`, `source_id`, `transcript_id`, `visit_id`, `segment_id`.
- Inclusive `word_start`, `word_end`, and `speech_quote` for that exact segment.
- `description_ref`: `summary`, `key_ideas/0`–`key_ideas/4` or
  `visual_facts/0`–`visual_facts/4`; `slide_quote` must equal the **entire** referenced
  fact text exactly. Missing and uncertain facts cannot support a card.
- Nonblank bounded `observation` and actionable `suggestion` strings. Prompts ask
  for speaker-language output and original-language quotes.

For speech comparison only, join the complete chosen contiguous word texts with
spaces, then collapse each Unicode whitespace run to one space and trim both
ends. Apply that same operation to `speech_quote`. Preserve punctuation, case,
Korean and all non-whitespace Unicode codepoints; no normalization, stemming,
substring matching or omitted-token repair. This token-join representation can
insert spaces around punctuation tokens; it does not rewrite stored transcript
text. Repeated identical phrases are distinguished by their explicit indexes.

Verified cards add `start_ms=min(selected word starts)` and
`end_ms=max(selected word ends)`. A word assigned by start may cross its visit end;
its end must still be within authoritative recording duration. Never clamp,
extend, round or accept model-supplied timestamps. Overlapping evidence indexes
are conservatively treated as duplicate even if another description fact is cited.

Malformed envelopes/types/extras fail the whole response. Structurally valid
cards with unsupported references, mismatched quotations, uncertain facts, absent
audience or duplicate evidence are discarded individually. `FeedbackResult`
reports `accepted_count`, `discarded_count`, and `accepted`, `partial`, `empty`
(valid zero-card response) or `all_invalid`. An invalid response never becomes a
successful empty result. No silent repairs or additional calls occur.

## Provider configuration and operational bounds

| Setting | Default / accepted values |
| --- | --- |
| `FEEDBACK_ENABLED` | `false`; exact `true` permits explicit description generation |
| `FEEDBACK_PROVIDER` | `gemini`; `gemini` or `openai` |
| `FEEDBACK_GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `FEEDBACK_OPENAI_MODEL` | `gpt-6-luna` |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Backend only; only the selected key is required |

Model identifiers are bounded to 100 ASCII letters/digits/dot/underscore/hyphen,
starting with a letter/digit. No endpoint configuration is accepted. OpenAI uses
SDK Responses at `https://api.openai.com/v1/responses`, `store=false`, strict
`text.format` JSON schema, no tools and `max_retries=0`. Gemini uses HTTPX REST at
`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`,
with a key header, JSON MIME/schema and one candidate. A description result from
another selected provider/model or snapshot is rejected for coaching.

The adapter owns the HTTP client/transport: no redirects, retries, environment
proxies, cookies, caller HTTP clients or caller URLs. A final destination guard
and header allowlist restrict outbound headers. Before request construction, the
adapter clears the private SDK client's environment-derived custom headers, so
they cannot affect JSON serialization or header encoding. It does not mutate the
process environment or other clients; this uses a pinned SDK private attribute
and must be rechecked on upgrades. System instructions
and output schemas are fixed, separate from all user JSON/images. The only image
URLs are adapter-built inline data URLs; neither source nor model URLs are fetched,
rendered or executed. No provider audio is sent.

| Bound | Value |
| --- | --- |
| Deck / authoritative recording | 1–10 slides / 1–600,000 integer ms |
| Audience / language label | 500 / 40 characters |
| Slide extracted text / transcript text / word text | 8,000 / 60,000 / 200 characters |
| Original transcript words / chronological visits | 6,000 / 1,000 (excess fails; no truncation) |
| Input context validation | 1,000,000 UTF-8 JSON bytes |
| Image / aggregate images | 1 MiB / 8 MiB; PNG/JPEG, one frame |
| Image dimensions / pixels | Each edge ≤1,600 / ≤2,560,000 pixels |
| Prepared and actual serialized request | 12 MiB |
| Per-stage output tokens | Descriptions 6,000; coaching 2,500 |
| Response body / extracted JSON text | 256 KiB / 64 KiB |
| Description fact text / uncertainty | 400 / 400 characters; ≤5 ideas and ≤5 visual facts per slide |
| Speech quote / observation / suggestion | 1,000 / 600 / 700 characters |
| Network timeouts | Connect 10 s, write 30 s, pool 5 s, read 120 s; elapsed checks between response chunks at 120 s |

These are operational input/output bounds, **not** a spending cap or exactly-once
guarantee. Checkpoint-2 application reservation units are documented below. The per-I/O timeout plus between-chunk elapsed
checks is not a hard wall-clock cancellation guarantee. A call interrupted after
submission may have incurred charges. Checkpoint 2 adds durable description
deduplication, reservations, recovery and editing revisions. User-facing disclosure,
consent and rehearsal-feedback retry flows remain checkpoints 3–4.

Raw-wire response reading is capped **before** the SDK can eagerly read an HTTP
error body. It checks actual bytes even with a missing/misleading Content-Length,
closes the response on the cap, and retains only the bounded prefix with an
incomplete marker. Oversized declared lengths and non-identity Content-Encoding
are rejected without reading/decompression. Partial stream timeouts/connections
retain the bounded received prefix; failures before response headers raise a safe
uncertain error without a receipt. Raw receipts must never enter public APIs or
served media. Their repr and the repr of prepared/source/output objects omit
private content; the description service serializes only at its private database
persistence seam, outside served media.

Errors contain fixed safe codes, never provider bodies/credentials/source text.
Configuration/input errors occur locally. Caught SDK request-preparation failures
before entry into the outbound transport raise `invalid_request` with
`uncertain=false`. Once that boundary is crossed, connection or serialization
failures remain conservative uncertain outcomes. The durable caller additionally retains a submitted marker and reservation,
including when the adapter classifies a local failure after that marker. HTTP auth and rate rejection are
separate from other rejection; Retry-After accepts seconds or an HTTP date.
HTTP 408/5xx, timeout, connection loss and unreadable/incomplete transport outcomes
are uncertain. Complete refusal, token truncation, empty output, invalid JSON
(including duplicate keys/nonfinite numbers), tool outputs and invalid evidence
fail explicitly. HTTP rejection classification is preserved even if its body is
oversized/compressed. Refusal and truncation do not trigger retries.

Pinned SDK/HTTPX/HTTPCore producer loggers filter this adapter's synchronous call
via a context variable, including SDK debug request-options/exception logging.
Image preparation separately filters the pinned Pillow PNG/JPEG producer loggers
across open, verify, decode and close, so source metadata such as PNG profile names
cannot enter their debug logs. Decoding is restricted to PNG/JPEG before format
probing; producer loggers are registered before lazy imports. The context resets
on success or failure. Other threads and unrelated application loggers retain
their configured logging, as do other calls (including Whisper). This is not a
promise about caller logging, external APM instrumentation or future SDK changes.
Never log/serve explicit raw serialization. Recheck the safeguards, including
Pillow's producer loggers and decode paths, on upgrades.

## References, attribution and validation limits

Small strict-schema, every-slide-once, bounded-fact and fixed untrusted-source
prompt ideas came from read-only prototype `33907d3`,
`services/feedback.py`, `services/gemini.py` and `test_feedback.py`. Its substring
quotation matching, countTokens, free-tier assumptions, automatic attempt
orchestration and cross-scope edited-description reuse were not incorporated.
Checkpoint 2 also attributes deck cache/revision, private usage-ledger and Pacific
reset concepts from the same prototype's `feedback.py`, `gemini.py`, `models.py`
and `test_feedback.py`; these were inspected read-only. Queue/claim/reservation
code is newly adapted to the current separate description scope and request ledger. The current `transcription.py` supplied the prepare/raw/normalize
boundary and safe error/Retry-After pattern; its public workflow is unchanged.

Official references checked for this implementation:
[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[OpenAI Python SDK](https://github.com/openai/openai-python),
[Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[Gemini REST generateContent](https://ai.google.dev/api/generate-content),
[Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite).
The installed OpenAI 2.54.0 source was also inspected. HTTPX 0.28.1 and Pydantic
2.13.5 are now declared direct dependencies; the existing lock versions are
unchanged. The coordinator installed the same 61 pinned versions into an isolated test environment and checked all 61 versions against public PyPI advisory metadata on 2026-10-08. No new versions were added or upgraded. OpenAI, HTTPX and Pydantic registry metadata links to their official repositories and lists no advisories for these pins. The
[inherited Torch advisory assessment](whisper-transcription.md#packaged-gate-dependency-assessment-2026-10-08)
remains applicable: Torch 2.10.0 has PYSEC-2026-139 and GHSA-rrmf-rvhw-rf47 (alias PYSEC-2025-194). Registry advisory absence is not proof of safety; the dependency set is not audit-clean.

Provenance/advisory sources: [OpenAI 2.54.0](https://pypi.org/pypi/openai/2.54.0/json), [HTTPX 0.28.1](https://pypi.org/pypi/httpx/0.28.1/json), [Pydantic 2.13.5](https://pypi.org/pypi/pydantic/2.13.5/json), [Torch 2.10.0](https://pypi.org/pypi/torch/2.10.0/json).

Tests use generated synthetic images and text, HTTPX MockTransport and the actual
installed OpenAI SDK. They establish local schema, evidence, serialization,
transport-bound and isolation behavior. Injection fixtures establish that source
strings cannot change locally fixed instructions/schema/endpoints/tools, **not**
model immunity. Structural validation proves source identity and exact quotation,
not factual consistency, quality, language fidelity, actionable advice or visual
accuracy. Prompt-only content restrictions need human evaluation. No grades,
external fact checking, emotion/pronunciation/personality assessments or new
speaking-habit detectors are implemented.

Run the README's Django check, full suite and migration-drift check with
`config.test_settings`. Exact local outcomes are in [AI-use evidence](ai-use.md).
Independent review must include all new files and the final staged snapshot;
the runner owns staging/review. PostgreSQL/Redis/Celery recovery, live-provider
compatibility, Korean/mixed-language quality and human inspection remain pending.
No changed Android flow exists in checkpoint 2; UI/device work belongs to checkpoint
4. User authorization to continue after checkpoint 1 is recorded separately from
human code review. **Stop before checkpoint 3 for inspection and confirmation.**


## Checkpoint 2 persistence and quota policy

`DescriptionSet` is unique on deck UUID, source fingerprint, selected provider,
nonsecret project ID, model and description prompt/schema versions. The fingerprint
includes actual bounded PDF bytes, preparation version and every ordered slide's
text/language/image identity. Current versions are `description-v2` (prompt, including
`und` source-language inference) and `description-v1` (schema). A saved private
snapshot stores bounded source metadata/slide references/storage identity, prompt
and schema digest, and prepared payload hash. It stores no key. Submission rebuilds
the payload from the original saved media, verifies identities/hash/version, and
fails locally if reconstruction is unavailable. Receipt normalization needs only
the saved source metadata, never media or credentials.

`DescriptionJob` has its own generation, base description revision, token, queued/
claimed/completed times and safe state/error/cooldown. `FeedbackRequest` is separate
from Whisper `ProviderRequest`: one per job, with provider/project/model/stage,
input hash, generation/token, queued/claimed/submitted/received/completed times,
private bounded raw bytes/status/completeness/issue, reported usage and outcome.
Outcomes distinguish `local`, `submitted`, `received`, `completed`, `invalid`,
`rejected`, and `uncertain`. Unknown usage remains null, not zero. Raw bytes are
persisted even on HTTP rejection or malformed/incomplete/oversized response.
If a provider echoes the exact submitted key, that byte sequence is removed before
persistence and the receipt is marked incomplete with `credential_redacted`; a
successful body containing it cannot become descriptions. Other raw receipt bytes
remain bounded private evidence. Description database operations also suppress
Django's producing SQL-debug logger within a context variable, since bound JSON
and binary values otherwise enter DEBUG logs. The context resets after the call
and does not silence unrelated threads/requests. This does not promise protection
from caller logging or external instrumentation.
Previous valid descriptions are never erased by a failed/new scope.

Only descriptions dispatch. Coaching's future model quota bucket will share the
same provider/project/model identity (stage is recorded but not part of the bucket).
No `Attempt`, existing Whisper constraint, audio, transcript, result or media path
is migrated/replaced. Migration 0005 only creates five tables and their constraints;
legacy rows are not auto-enqueued. The additive migration test compares populated
Deck/Slide/Attempt/Whisper rows, including all media/result fields.

Admission commits intent before best-effort `transaction.on_commit` publication;
the publication wrapper logs a fixed safe message on failure. Existing Beat runs
both processing recovery functions every 30 seconds. Claims last 360 seconds,
longer than the existing 300-second task limit. Short transactions acquire locks
in consistent order: deck where needed, set, job, quota bucket, request/reservation.
No transaction spans media preparation or provider I/O. Last configuration/freshness
checks and the reservation/submitted marker must commit before `request_raw`.
A failed write or commit cannot trigger a call. Duplicate or stale tasks cannot
submit or replace an edited set.

Edits increment separate `description_revision` and fence processing by advancing
`processing_revision`. In-flight receipts belong to the original request and may
still save after editing; they cannot overwrite the correction. Expired unsubmitted
work may reclaim; submitted work without durable outcome becomes uncertain and
requires explicit new-generation acknowledgement. A saved receipt resumes only
normalization, including after media removal or configuration disable. A late
receipt resolving expiry is requeued for normalization under a fresh token, with
no second submission. Terminal invalid receipts do not loop: an explicit retry
creates a new generation rather than reusing the invalid receipt.
Completion writes/commits run outside provider-error classification: a persistence
failure retains the received, unfinished request for same-generation recovery.
Receipt-save failures also bypass output classification, including a committed
save whose acknowledgement was lost. The worker neither normalizes unconfirmed
in-memory output nor marks it invalid. After lease expiry, recovery normalizes the
saved, sanitized receipt if present; if the save rolled back, the submitted job
requires uncertainty confirmation. Neither path automatically calls the provider.
Recovery discovers unfinished saved receipts independently of job state/revision,
including a terminal `needs_confirmation` generation followed by retry or PATCH.
For a generation superseded by retry/edit, recovery republishes only unfinished saved receipts.
The worker claims receipt-only normalization with a fresh lease/token, retaining
the old job state. It finalizes private outcome/error/completion evidence and
releases that claim without changing newer jobs, generated/edited descriptions,
revisions or completion time. Duplicate/expired normalizers and the original
submitter cannot consume the current claim's evidence.

Generation requires positive `FEEDBACK_GEMINI_RPM`/`FEEDBACK_GEMINI_TPM` or
`FEEDBACK_OPENAI_RPM`/`FEEDBACK_OPENAI_TPM`, plus the selected nonsecret
`FEEDBACK_*_PROJECT_ID`, enabled flag and provider key. These fail safely at use,
not Django startup or Whisper processing. Optional `FEEDBACK_*_DAILY_REQUEST_LIMIT`
is blank (off) or positive. No tier allowances/defaults are invented. Saved retries
keep original provider/model even if the current selection changes; the original
provider's currently configured project must match before its key is used.
Same-project key rotation does not change scope. Configured project matching does
not independently prove a key's provider-side membership; that needs operator
verification outside this checkpoint.

Atomic reservations count serialized payload UTF-8 bytes **plus maximum output
tokens** (6,000 for descriptions). This deliberately loose application policy can
reject inputs that a provider might accept. It makes no extra token-count call,
is not a provider-perfect count and is not a monetary cap. Provider-reported usage
is recorded separately and does not retroactively free reservations. Submitted
and uncertain requests count for their windows; only fenced never-submitted
reservations may be released. A per-request reservation larger than TPM fails
locally, rather than waiting indefinitely. RPM/TPM use rolling 60-second windows;
local waits resume only once safe. Shared 429 Retry-After cooldown applies to the
provider/project/model scope and is included in public `retry_at`. Provider errors
remain explicit retries, never automatic paid repair loops.

Gemini's optional daily request ceiling resets at midnight America/Los_Angeles,
including DST. OpenAI's optional ceiling is an **application UTC-midnight policy**,
not a universal provider daily quota. Account limits, shared model pools and other
applications may be stricter than these local buckets; configure headroom.
Official references reopened 2026-10-08:
[Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) documents
project-scoped limits and Pacific daily reset;
[OpenAI rate limits](https://developers.openai.com/api/docs/guides/rate-limits)
documents project/organization and model/shared limits. No real-provider evaluation
or money-cap claim is made.

## Checkpoint 2 coordinator validation

The writer's SQLite/mocked results are recorded in [AI-use](ai-use.md). The
coordinator owns real infrastructure/process checks and the final staged review:

1. With the exact pinned environment, run the full Django suite on real PostgreSQL
   (`manage.py test --settings=config.settings`, isolated test DB privileges).
   `rehearsals.test_descriptions.ConcurrentDescriptionTests` exercises concurrent
   initial dedup/duplicate workers, single-use retries, competing quota reservations,
   concurrent editable revisions, editing while generation returns and duplicate
   receipt-only recovery after editing and after an uncertain generation is
   superseded by retry/PATCH. These seven
   races explicitly skip on SQLite. `test_description_migration` proves additive
   preservation and no enqueue. Do not use real/private media in these checks.
2. Start a temporary validation worker outside tracked product code, using the
   normal tasks and PostgreSQL/Redis/Beat setup. Replace only the existing Python
   `feedback_provider.request_raw` seam with a synthetic fake that records a call
   counter durably outside product media, returns an adapter-shaped `RawReceipt`,
   and can pause at controlled points. Configure synthetic keys/project/allowances
   in that temporary process. Do not add a product fake URL, fake-provider setting,
   alternate endpoint or bypass to tracked code; prohibit actual outbound transport.
3. Create a synthetic saved PDF/deck. Lose initial broker publication: verify one
   queued row survives and Beat republishes. Deliver duplicates: verify one submitted
   request/reservation and one fake call. Stop the worker after claim but before
   submission: after 360 seconds, recovery may call once. Stop after the committed
   submitted marker without receipt: recovery must require confirmation and keep
   the reservation, with no automatic second call.
4. Stop after `save_receipt` commits, before `normalize`: restart/Beat must complete
   using that same receipt with an unchanged call count. Repeat with malformed and
   rejected receipts; normalization fails once, then waits for explicit retry.
   Inject a one-shot completion row-write or transaction-commit failure after a
   valid receipt is saved: it must remain unfinished/received, then complete on
   recovery with the same request/generation/reservation and exactly one fake call.
   Also call the real `save_receipt`, then raise a one-shot database error after
   its commit; recovery must normalize that same sanitized receipt. Separately
   fail its commit before success: no in-memory normalization is allowed, and
   expiry must require confirmation with the reservation retained and one call.
   Repeat generated responses with U+0000 in fact `text` and `uncertainty`:
   retain the private raw receipt, finish once as `invalid_descriptions`/`invalid`,
   and make no automatic additional call. The same edits must return 400 and
   preserve existing descriptions/revisions. Include a saved NUL receipt awaiting
   normalization to verify recovery reaches that terminal outcome as well.
   Use synthetic fault injection around `submit`/`save_receipt` in the temporary
   worker process, not modifications to product functions or live provider calls.
5. While a fake response is paused, PATCH a complete current set. Let the response
   finish: its raw receipt/usage must persist, with unchanged edited descriptions.
   Repeat, terminating after the edited job's `save_receipt` commits but before
   normalization/finish. Restart/Beat must finalize only the original request's
   outcome/completion time with exactly one fake call and unchanged edit revisions.
   Repeat with invalid/rejected/partial receipts and duplicate recovery delivery;
   each receipt must reach its classified outcome once, without paid retry.
   Also expire a submitted generation to `needs_confirmation`, then explicitly
   retry or PATCH before the late receipt arrives. Terminate after saving that old
   receipt. Beat must discover and finalize it despite its terminal job state and
   older revision, preserving the newer job/set exactly. Check both a queued and
   a completed retry, duplicate/expired receipt claims, and unchanged fake-call
   counts during receipt-only recovery.
   Change enabled/project configuration before submission, restart relevant workers,
   and verify no call; rotate a synthetic key within the same project and verify
   the saved provider/model scope is unchanged. Contend two decks for one configured
   bucket; verify local waiting and recovery after its real cooldown/window.
6. Reopen rows after database/API/worker restart; compare original deck/slide/media,
   attempt/Whisper result references and hashes, private receipt/outcome/reservation
   evidence and exact fake-call counts. Inspect public responses for the contract's
   allowlist. Record this separately from SQLite mocks; no process/service changes
   or real infrastructure validation were performed by the writer.

Independent review and coordinator infrastructure checks passed; see the [checkpoint-2 handoff evidence](ai-use.md#2026-10-08--ai-feedback-checkpoint-2-coordinator-handoff). Human inspection remains pending. Checkpoints 3–5 are not
implemented. The coordinator transfers only reviewed checkpoint-2 work back to
`feature/ai-feedback`, then stops for confirmation before part 3. The runner stages
changes for checks and review; it does not commit, push, create PRs or merge.
