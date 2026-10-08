# AI feedback — checkpoints 1–5

Standalone adapters describe slides and validate at most three suggestions for
one rehearsal. Checkpoint 2 added durable saved-deck descriptions; checkpoint 3
adds explicit durable saved-rehearsal coaching and compatible mobile contracts,
parsers, clients and cache reconciliation. Upload and transcription never generate
feedback. Whisper still saves legacy `feedback=[]`, `feedback_state=disabled`;
independent coaching is exposed as `feedback_analysis`. Default configuration is
disabled. Attempt identity, transcription retries and local replay are preserved.
Checkpoint 4 adds feedback review/disclosure and description editing within the existing saved-rehearsal screen. No tabs, theme, navigation redesign or provider picker is added.

## Five-checkpoint ledger

| Checkpoint | State |
| --- | --- |
| 1 — provider adapters and evidence validation | Reviewed/tested local base `f07e55395d2e38eabec7c39ea766f643b2e5c7c1`; user authorized continuation to checkpoint 2. This does not claim human code review. |
| 2 — durable slide descriptions | Implemented and independently reviewed. Scoped cache, revision-checked edits, durable request/recovery evidence and provider-specific quota reservations; 172 tests passed on PostgreSQL, plus synthetic worker and API/database restart checks. Human inspection remains pending; continuation is now authorized. |
| 3 — durable rehearsal feedback | Committed base `e31937b`; coordinator evidence records 219 PostgreSQL tests, 233 mobile tests, worker/API restart and saved-pilot emulator review. These are checkpoint-3 results, not verification of the new UI. |
| 4 — feedback review UI | Independently reviewed and coordinator-verified at `64ec596`: 270 mobile tests, TypeScript/lint, Android export, Django checks, 229 SQLite tests (18 skips), 229/229 real PostgreSQL tests and synthetic emulator disclosure/edit/stale/regenerate/offline/evidence-seek flows. Human/physical-phone checks remain pending. |
| 5 — controlled provider evaluation | Complete as an agent-operated check: independent review, 247 SQLite tests (18 skips), 247/247 PostgreSQL tests, real-worker v2/v3 receipt recovery and successful full Gemini/OpenAI flows on identical synthetic inputs. Gemini adversarial output was partial (1 accepted / 1 discarded); OpenAI returned 3 accepted. Quality limitations and human/device checks are documented in the evaluation. |

All five checkpoints share one `feature/ai-feedback` PR, stacked on `feature/rehearsal-review` while unmerged. Each checkpoint used the configured-model local pipeline and checks; the coordinator verified and transferred reviewed snapshots before publication. No merge or human approval is implied. New detectors, local Whisper, themes, authentication and public deployment remain excluded. See the [controlled evaluation](feedback-evaluation.md), [AI-use evidence](ai-use.md), [team boundaries](team-work-division.md) and [API contract](api-contract.md).

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
   description and coaching callers mark submission before this call and save the receipt
   **before** `normalize(prepared, receipt)`.
4. Normalization returns a `DescriptionResult`. Optional edited descriptions use
   `adapter.edited_descriptions(analysis, value)` and pass the same validation.
   `prepare_coaching(analysis, descriptions)` requires matching provider/model and
   deck snapshot identity. Coaching orchestration also selects the exact persisted
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

Saved PDF renders are read with an 8 MiB per-file bound before the provider limits
are applied. A valid render exceeding the 1 MiB image or 8 MiB aggregate budget
gets a deterministic JPEG copy for feedback, with bounded downscaling only when
needed. Original PDF/slide files are never rewritten. Already-compatible decks
retain their exact image bytes and source IDs; converted source IDs describe the
actual image sent to the provider. Dimensions, frame count and full decoding stay
validated. This is local preparation and never starts provider work.

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
| `FEEDBACK_ENABLED` | `false`; exact `true` permits explicit description/coaching generation |
| `FEEDBACK_PROVIDER` | `openai` when omitted; `gemini` or `openai` |
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
deduplication, reservations, recovery and editing revisions. User-facing disclosure and consent are implemented in checkpoint 4; backend
rehearsal-feedback retry flows are implemented in checkpoint 3.

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
Independent review covered new files and exact staged snapshots. Checkpoints 2–4 have coordinator infrastructure evidence below and in AI-use; checkpoint 4 also has synthetic-provider emulator evidence. Checkpoint 5 adds 247/247 PostgreSQL tests, saved-v2/new-v3 real-worker receipt recovery and full controlled Gemini/OpenAI results. Korean/mixed-language quality, human usefulness/code inspection and physical-phone/accessibility checks remain pending. Structural checks and agent-operated live tests do not imply human approval.


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

Checkpoint 2 originally dispatched only descriptions. Checkpoint 3 coaching shares the
same provider/project/model identity (stage is recorded but not part of the bucket).
No `Attempt`, existing Whisper constraint, audio, transcript, result or media path
is migrated/replaced. Migration 0005 only creates five tables and their constraints;
legacy rows are not auto-enqueued. The additive migration test compares populated
Deck/Slide/Attempt/Whisper rows, including all media/result fields.

Admission commits intent before best-effort `transaction.on_commit` publication;
the publication wrapper logs a fixed safe message on failure. Existing Beat runs
transcription, description and coaching recovery every 30 seconds. Claims last 360 seconds,
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
OpenAI local waits resume only once safe in the same generation. Gemini local
RPM/TPM/daily exhaustion and shared cooldown stop as terminal `quota_stopped`
failures, preserving `retry_at`. Refresh after that time and explicitly retry
with the current revision to start one new generation. Shared 429 Retry-After
cooldown applies to the provider/project/model scope and is included in public
`retry_at`. Actual 429 errors remain `provider_rate_limit` and require explicit
retry for both providers, never automatic paid repair loops.

Legacy Gemini quota waits, including queued jobs retaining a wait marker, stop
under the existing claim/recovery locks before any submission, even if their
retry time has expired or the environment now selects OpenAI. Saved receipts
still normalize without a call; live claims, submitted uncertainty and newer
revisions/edits retain precedence. No GET mutation, scheduler or migration is
added. Saved jobs and explicit retries always retain their original provider/model.
New work with no `FEEDBACK_PROVIDER` selects OpenAI; feedback stays disabled until
configured, and a missing OpenAI key never falls back to an available Gemini key.

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

Independent review and coordinator infrastructure checks passed; see the [checkpoint-2 handoff evidence](ai-use.md#2026-10-08--ai-feedback-checkpoint-2-coordinator-handoff). Human inspection remains pending. The historical checkpoint-3 patch built on reviewed/tested base `ce16ae1`.
The checkpoint ledger and checkpoint-5 section give current status;
checkpoint 5 is complete with the bounded evidence and limitations in the evaluation record. The runner stages
changes for checks and review; it does not commit, push, create PRs or merge.


## Checkpoint 3 persistence, evidence and recovery

`services/coaching.py` owns explicit admission, captured-description dependencies,
coaching claims/submissions/receipts/completion, Beat recovery and safe reads.
`FeedbackAnalysis` is unique per attempt; `FeedbackJob` is unique per analysis and
feedback generation. Generations retain frozen source/description/prompt context
independently of request evidence. Migration 0006 extends `FeedbackRequest` with
an optional coaching owner and a database constraint for exactly one owner and the
matching stage. No fabricated description job represents coaching; Whisper's
`ProviderRequest` remains separate. Description/coaching quotas share the existing
provider/project/model bucket, with stage-specific output reservations.

Admission enumerates the original saved transcript words before `align_words` and
uses the copied original indexes. The derived plain alignment must equal the saved
alignment, then the adapter verifies the complete partition, contiguous segments,
boundaries/backward/simultaneous visits and original authoritative duration. Saved
language or `und` controls coaching language, with explicit `und` inference in
`coaching-v1`; optional audience remains bounded to 500. Source strings and generated
observation/suggestion text reject U+0000 before JSONB persistence. No text rewriting,
word matching, duration repair or transcription retry occurs.

Initial admission prepares the saved deck and description payload outside locks.
The narrow internal description helper accepts that captured selection/preparation,
then both intents commit atomically. Cache reuse includes exact provider/project/
model/source/description prompt/schema and edited revision. Description failure or
uncertainty exposes the dependency's own retry identifiers; no recovery pass calls
public generation to retry it. Explicit description retry advances unfulfilled
coaching dependencies. Editing instead changes the captured revision and requires
explicit coaching reanalysis. Public APIs preserve prior result provenance/suggestions
as stale alongside current work/error/uncertainty. `last_output` describes the latest
output separately, including failed `all_invalid`; valid zero-card output says
“No supported suggestions.”

Current description transitions and receipt saves advance the set's public
`updated_at` under its existing lock; superseded receipt recovery preserves current
freshness. Feedback includes this time both in `dependency.updated_at` and aggregate
`updated_at`. Mobile reconciliation preserves microseconds and independent dependency
revisions, so delayed submitted snapshots cannot hide confirmation/retry actions.
Older cached metadata without a dependency timestamp still parses, with revision
and terminal-state tie breaks. Feedback aggregate freshness also includes receipt
and finalization times from its current generation's request. A complete late
receipt can clear confirmation while the job remains stale after a description
edit; a delayed pre-receipt response cannot restore that obsolete confirmation.
Older feedback generations' receipts never advance the current snapshot. This
derivation preserves edited descriptions and requires no new timestamp writes.
Reads do not update timestamps or queue work.

Lock order is deck/attempt for admission, description set, feedback analysis/job,
quota bucket, request/reservation. Description edits lock that same set; freshness
checks before submission and completion fence outdated descriptions. The service
never acquires a description set after an analysis lock. Provider I/O, media reads,
preparation and normalization run outside transactions. Captured source/description
snapshots reconstruct coaching requests and normalize old receipts without media or
credentials; changed prompt digests fail explicitly. Submission rechecks enabled
configuration, original project, key, quotas, source and live generation/token.
Reservation and submitted marker must commit before outbound work. Same-project
key rotation is supported; current selection cannot swap an existing analysis.

300-second coaching tasks and 360-second claims use the existing 30-second Beat
recovery. An unfinished receipt is discoverable even after its generation was
superseded by retry or edit. Persistence failures at submission, receipt save or
completion never authorize an automatic second charge. Recovery normalizes durable
sanitized receipts only; an expired submitted request without one requires explicit
acknowledgement and retains its reservation. Late receipts finalize old private
outcome/usage without changing newer results/edits. Known failures require explicit
retry; OpenAI quota waits and successful dependencies can resume. Gemini local
quota waits stop terminally and require explicit revision-aware retry. Auth/rate rejection,
uncertain timeout/5xx and invalid/refused/truncated output remain distinct. Retry-After
cooldown spans both stages. No live provider or additional token-count call is made
by tests or quota estimation.

The receipt/admission race repair shares a pure transport-uncertainty classifier
with adapter normalization. A saved 408/5xx or incomplete 200 receipt still requires
acknowledgement if an edit makes coaching stale before normalization. Complete 200
and known rejected statuses retain their existing handling, including incomplete
rejection bodies and rate cooldowns. This classification reads only persisted
status/completeness; it neither normalizes under locks nor changes private evidence.
Original-generation recovery and single-use revision/acknowledgement remain intact.

See the [wire contract](api-contract.md#durable-rehearsal-coaching-checkpoint-3) for
allowlisted fields and separate retry actions. Mobile parsing quarantines feedback
without invalidating transcript/audio; strict clients perform explicit actions only.
Cache reconciliation orders feedback separately from Whisper. Safe evidence context
contains captured facts/source references/visit indexes, not private request/source
payloads. A derived seek capability requires the saved transcript ID, exact quotes,
original index partition, actual pages and derived times. Strings remain inert;
no link/HTML/code execution or package resolution is introduced. Source validity
still does not prove semantic correctness, language fidelity or useful coaching.

Attribution: read-only prototype `33907d3` (`services/feedback.py`, `gemini.py`,
`models.py`, `test_feedback.py`) informed bounded suggestions, cache/revision and
private usage-ledger concepts. Existing checkpoint-1 validation/transport and
checkpoint-2 durable description/quota seams were reused. The durable coaching
state machine, indexed snapshot reconstruction and compatible public/mobile
contracts are new work. Prototype substring matching, countTokens, automatic
orchestration and cross-provider/source edited reuse were not incorporated.

## Checkpoint 3 coordinator verification handoff

Writer automated results are recorded in [AI-use](ai-use.md); human review remains
pending. The runner owns staging/independent review and the coordinator owns:

1. Full PostgreSQL suite, especially `ConcurrentCoachingTests` and populated
   `test_coaching_migration`, plus all checkpoint-2 preservation/recovery tests.
   New races cover initial/dependency dedup, duplicate workers, single-use retry,
   cross-stage quota, edit versus response, and duplicate old-receipt normalization.
2. Temporary external fake-provider worker with synthetic sources only, prohibiting
   actual outbound transport. Assert zero Whisper calls throughout. Cached descriptions
   need exactly one coaching call; absent descriptions need one description plus one
   coaching call, including lost dependency publication and Beat redispatch.
3. Worker termination before submission, after committed submission, after receipt,
   and after a receipt commit with lost acknowledgement. Inject completion-write/
   commit failure. Verify receipt-only recovery has zero additional calls; missing
   submitted outcomes require acknowledgement and retain reservations.
4. Description edit while coaching is in flight, plus uncertainty followed by retry
   or edit before an old receipt arrives. Recover old successful/invalid/rejected/
   incomplete receipts after restart; verify raw/usage finalization, unchanged newer
   jobs/results/edits and no duplicate calls. Repeat disabled/project-changed queued
   work (zero calls), same-project synthetic key rotation, shared 429 cooldown and
   real-time local quota waiting across stages.
5. API/database restart and repeated feedback/attempt/history GET, including cached
   results with generation disabled/keys absent, retained stale result plus current
   failure, independent retry revision conflicts and unchanged synthetic media hashes.
   Verify malicious metadata cannot expose private snapshots/raw/keys.

Android device regression is separate from JavaScript export. Historical
checkpoint-3 and checkpoint-4 coordinator infrastructure/emulator evidence is
recorded in AI-use. Final checkpoint-5 provider runs, new schema acceptance and agent quality assessment are recorded separately in [the evaluation](feedback-evaluation.md); earlier mocked recovery checks alone do not establish them.


## Checkpoint 4 review and disclosure

The existing SavedAttemptScreen embeds `features/feedback/FeedbackPanel.tsx` and
`useFeedbackReview.ts`. Validated explicit clients, original-index evidence and the
existing saved-player controller remain the boundaries. `storage.ts` adds API/attempt
feedback, API/deck/set descriptions, API/provider/version consent and unresolved
submission markers in SQLite KV; Whisper revisions/caches and local capture catalogs
are unchanged. Cache is available immediately; read failures preserve it with a
notice. Focus/foreground/session identities cancel reads, polling and obsolete
prompts. Synchronous locks prevent repeated Generate/Retry/Save taps. Every mutation
refreshes first; timeout and 409 never automatically resubmit. A missing submitted
outcome requires separate charge acknowledgement. Failed description dependencies
use their exact set/processing revision, independently of coaching.

The provider/model is visible before generation. First use explains slide images/
text, descriptions, saved transcript and optional audience context, explicitly
excluding audio. Continue/Cancel is separate from Whisper consent. A backend
comparison token covers nonsecret provider/project/model, fixed prompt/schema
identity and disclosure version; it contains no private input or credentials. Reads
expose new/saved selection even without results. Mobile includes it on generation;
configuration mismatch returns 409 before either queue can admit work. Legacy
explicit callers may omit the optional assertion, without race protection. Saved
retries retain the original provider/project/model/prompt/schema. See the
[wire contract](api-contract.md#generation-selection-assertion-and-mobile-feedback-review-checkpoint-4).

Cards retain source/speaker languages, category, cautious observation, action,
slide/visit/time and expandable quotes. All returned text is inert React Native Text.
Slide description labels carry captured generated/edited-set origin; historical
snapshots honestly say unavailable. Origin is stored alongside the captured coaching
source snapshot, without a schema migration or new provider field. Current set edits
cannot relabel old quotes. Stale/invalid evidence, absent audio or unknown actual
pages cannot seek. Valid actions reuse native-clock playback, preserving paused/
playing intent, backward/simultaneous visits and rapid seek/Pause behavior.

Description controls use validated slide/source identities even when deck metadata
is unavailable, for both fresh and cached sets. Unknown-page evidence stays disabled.
The editor preserves the complete set, all IDs and untouched slides; it edits only
existing fact text and uncertainty. Validation enforces 400-character facts, NUL
rejection, explained uncertainty and the 64 KiB UTF-8 set bound. Save uses the
captured revision after refresh. Conflict/timeout retains the draft with Reload/
Cancel; Reload resumes active-job polling after success or failure only in the current
focused/foreground session. Keystrokes and Cancel issue no PATCH. An open draft disables generation.
Saving marks affected feedback stale immediately; explicit regeneration reuses the
saved transcript. No provider call is needed for editing.

Checkpoint-4 independent review and coordinator checks passed: 270 mobile tests,
TypeScript/lint, Android export, Django checks, 229 SQLite tests (18 skips) and
229/229 real PostgreSQL tests. Agent-operated emulator checks covered disclosure,
editing, staleness, regeneration, offline restart and evidence seeking with synthetic
providers. See [AI-use](ai-use.md#2026-10-08--checkpoint-4-coordinator-verification).
Human TalkBack, extended text/keyboard, physical-phone listening/synchronization and
code inspection remain pending. Checkpoint 5 completed controlled live evaluation with [documented quality limitations](feedback-evaluation.md). Prior prototype attribution is unchanged; this repair does not touch
prototype, mobile or other-worktree source.

## Illustrative feedback experience

These are small **hand-authored illustrations**, not measured provider outputs or
playable fixtures. Each quoted description is an assumed certain captured fact,
not necessarily verbatim PDF text. Transcript quotes represent the complete chosen
word span; real cards must also match the saved source, transcript, visit and word
indexes. No timestamps or alignment success are invented here.

| Category / context | Exact description evidence | Exact transcript evidence | Observation | Suggested action |
| --- | --- | --- | --- | --- |
| Consistency | “Conversion increased from 10% to 12%” | “Conversion doubled” | The cited figures and the spoken change may be inconsistent. | Say conversion increased by two percentage points. |
| Clarity | “Latency is the time from request to response” | “This is low, so it is better” | The cited sentence leaves the quantity unnamed. | Name latency and explain that lower latency means a shorter wait for the response. |
| Audience, only with saved context “Students new to classification” | “Precision is the share of positive predictions that are correct” | “Our precision is 0.9” | The cited sentence gives a value without explaining the metric for this audience. | Explain that nine out of ten flagged positive predictions are correct. |

The card separates observation from action and expands the exact captured
**Slide description** and **Transcript excerpt**. Text is plaintext only; embedded
markup/URLs supply no executable controls. The explicit evidence action revalidates
source/quotes/indexes/times and seeks the existing player to `start_ms`, preserving
playing/paused intent. It neither starts a paused player nor stops at `end_ms`.
Unavailable audio, unknown actual pages, invalid evidence or stale feedback disables
that action while retaining readable text.

Partial output shows only supported cards with accepted/discarded counts. A valid
empty list says **No supported suggestions.** It is not a grade or proof of a perfect
rehearsal. All-invalid output is failed `unsupported_feedback`, not successful empty
output. An edit or newer generation can leave earlier cards readable and explicitly
stale alongside current failure/uncertainty. Disabled/unavailable generation is
separate from saved results; it never substitutes examples for real output.
Generate, Retry, description Save and evidence seeking remain explicit actions.

## Checkpoint 5 Gemini schema compatibility

Coordinator-supplied evidence: both the baseline and corrected
`description-gemini-v2` full description requests returned HTTP 400
`INVALID_ARGUMENT`. Five small probes used the same configured model/transport,
each once with 16/64 maximum output tokens: text-only passed 200; text plus the
exact `description-gemini-v2` schema failed 400; a minimal object schema passed 200;
description v2 with only recursively removed `minItems`/`maxItems` passed 200;
unchanged `coaching-gemini-v2` passed 200. Gemini transport attempts before the final run: **7**
(two full rejections plus five probes), without automatic retries, new transcript/
audio input or new Whisper calls. This reproduces a schema-specific rejection;
small-probe acceptance alone did not establish full application success. The later reviewed `f89383f` full run completed both cases with four more requests, eleven Gemini transport attempts total. OpenAI completed both cases with four requests. The [evaluation](feedback-evaluation.md) separates structural acceptance, rejected evidence, semantic limitations and usage.

The prior v2 projection removed string keywords and translated integer bounds. The
[Gemini GenerationConfig reference](https://ai.google.dev/api/generate-content#GenerationConfig)
documents array bounds as supported; the [structured-output limitations](https://ai.google.dev/gemini-api/docs/structured-output#limitations)
warn that large or deeply nested schemas may be rejected. Description v3 reduces
this schema's complexity according to the supplied reproduction; it does not
treat array keywords as universally unsupported. No dependency, endpoint or model
substitution is introduced.

| Contract | Description prompt / schema | Coaching prompt / schema |
| --- | --- | --- |
| New Gemini selections | `description-v2` / `description-gemini-v3` | `coaching-v1` / `coaching-gemini-v2` |
| Saved Gemini v2 selections | `description-v2` / `description-gemini-v2` | `coaching-v1` / `coaching-gemini-v2` |
| Saved Gemini selections from checkpoints 1–4 | `description-v2` / `description-v1` | `coaching-v1` / `coaching-v1` |
| OpenAI, unchanged | `description-v2` / `description-v1` | `coaching-v1` / `coaching-v1` |

Description v3 equals the v2 wire schema with only schema-node `minItems` and
`maxItems` removed. Schema traversal preserves property/definition names (even
names literally `minItems`/`maxItems`), references, required fields, strict objects,
types, enums and all other v2 constraints. Coaching v2 retains array bounds and
equivalent inclusive maxima (`visit_id ≤ 999`, `word_start/word_end ≤ 5999`).
Local Pydantic/source validation still enforces 1–10 slides, complete unique source
coverage and at most five key ideas and five visual facts per slide. Invalid
outputs fail without repair calls. Fixed prompts, image/request/response bounds,
OpenAI's strict schemas and coaching-v2/OpenAI serialized payloads are unchanged.

Effective schemas participate in prompt digests, request hashes, selection tokens
and description cache scope. Saved description-v1 and description-gemini-v2 work,
explicit retries and receipts reconstruct their exact old schemas, payloads, hashes
and digests; coaching uses its saved version even while
waiting for descriptions with no request hash yet. Unknown versions fail locally.
No stored rows/results/provenance are rewritten. Explicit retries of legacy Gemini
rejections retain their historical contract; they do not adopt the
repair. New description initial admission creates a separate v3 scope; an existing
feedback analysis remains bound to its saved set and versions. Coordinator live verification used a new disposable selection/analysis with identical saved transcription, preserving both earlier failed scopes instead of silently converting an old generation.

Defaults stay `gemini-3.1-flash-lite` / `gpt-6-luna`, configurable and disabled until
configured. There is no fallback, tool/URL fetching or automatic provider retry.
The optional `expected_selection` assertion covers the new schema identity;
legacy callers omitting it do not get mobile's disclosure-race comparison guard.

Local synthetic regressions cover v3 projection, frozen v1/v2 schema/payload/digest
anchors, local cardinality boundaries, selection/cache identity and saved v1/v2
queue/retry/waiting/receipt recovery after edit/retry supersession without duplicate
calls. The new description array-bound regression failed before this fix. Actual
check results and passed independent review are recorded in
[AI-use](ai-use.md#2026-10-08--checkpoint-5-description-v3-schema-repair).
Coordinator PostgreSQL/worker verification and the full live Gemini evaluation also passed their integration assertions. The evaluation records semantic weaknesses; no general accuracy, safety or human-review claim follows.
