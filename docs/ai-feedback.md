# AI feedback — checkpoint 1

Standalone backend adapters describe slides and validate at most three suggestions
for one rehearsal. They are **disconnected** from views, tasks, processing, models,
public result schemas and mobile. Current app analysis still saves `feedback=[]`
and `feedback_state=disabled`, even when these adapters are enabled or misconfigured.
Whisper credentials, attempt identity, retries, saved transcripts and playback are
unchanged. There is no endpoint for these internal objects.

## Five-checkpoint ledger

| Checkpoint | State |
| --- | --- |
| 1 — provider adapters and evidence validation | Implemented and independently reviewed; human inspection and confirmation are pending. |
| 2 — durable slide descriptions | Pending confirmation: storage/cache, revision-checked edits, durable request ledger, queue recovery and provider-specific quota reservations. |
| 3 — durable rehearsal feedback | Not implemented: explicit generation endpoint, feedback revision/retry/staleness and shared response contracts. |
| 4 — feedback review UI | Not implemented: disclosure, suggestion cards, editable descriptions, evidence playback and offline caching. |
| 5 — controlled provider evaluation | Not implemented: compare both providers separately on saved non-confidential pilot inputs and document quality/recovery evidence. |

The pending checkpoints summarize the approved plan; no named owner assignments are inferred.
The five checkpoints are intended for **one eventual PR**. This checkpoint adds no
DB records/migrations, queue/quota persistence, automatic retries, endpoints, UI,
new detectors, local Whisper, authentication or public deployment. No live calls
are part of its tests. See [team boundaries](team-work-division.md) and the
[existing public API](api-contract.md).

## Internal preparation and evidence contracts

`rehearsals/services/feedback.py` owns strict frozen models, image validation,
preflight and evidence normalization. `feedback_provider.py` owns fixed prompts,
selected-provider configuration, request construction and bounded transport.
No configuration is validated at Django startup or on the Whisper path.

1. `prepare_analysis(value, images)` accepts a strict JSON-shaped input and a tuple
   of already prepared PNG/JPEG **bytes**, never paths or URLs. It returns an
   immutable `PreparedAnalysis`. Invalid data fails before network access.
2. Construct one `FeedbackAdapter()` from configuration for both calls. Its
   `prepare_descriptions(analysis)` returns a private `PreparedRequest` with the
   fully prepared payload, snapshot and request hash. It performs no network I/O.
3. `request_raw(prepared)` makes exactly one POST. It returns a private bounded
   `RawReceipt`, including HTTP status, raw bytes, completeness/issue, parsed
   Retry-After and available allowlisted integer usage counts. A future durable
   caller must mark submission before this call and save this receipt **before**
   `normalize(prepared, receipt)`. This checkpoint has no such persistence.
4. Normalization returns a `DescriptionResult`. Optional edited descriptions use
   `adapter.edited_descriptions(analysis, value)` and pass the same validation.
   `prepare_coaching(analysis, descriptions)` requires matching provider/model and
   snapshot identity. Both generated and edited descriptions stay untrusted data.
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
| `FEEDBACK_ENABLED` | `false`; exact `true` enables standalone use only |
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

These are operational input/output bounds, **not** a spending cap, a token-count
estimate or exactly-once guarantee. The per-I/O timeout plus between-chunk elapsed
checks is not a hard wall-clock cancellation guarantee. A call interrupted after
submission may have incurred charges. Durable deduplication, reservations, recovery,
editing revisions and user retry/consent flows remain later orchestration work.

Raw-wire response reading is capped **before** the SDK can eagerly read an HTTP
error body. It checks actual bytes even with a missing/misleading Content-Length,
closes the response on the cap, and retains only the bounded prefix with an
incomplete marker. Oversized declared lengths and non-identity Content-Encoding
are rejected without reading/decompression. Partial stream timeouts/connections
retain the bounded received prefix; failures before response headers raise a safe
uncertain error without a receipt. Raw receipts must never enter public APIs or
served media. Their repr and the repr of prepared/source/output objects omit
private content; serialize explicitly only at the future private persistence seam.

Errors contain fixed safe codes, never provider bodies/credentials/source text.
Configuration/input errors occur locally. Caught SDK request-preparation failures
before entry into the outbound transport raise `invalid_request` with
`uncertain=false`. Once that boundary is crossed, connection or serialization
failures remain conservative uncertain outcomes. This in-memory distinction is
not a durable submission record. HTTP auth and rate rejection are
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
quotation matching, locks, persistence, countTokens and free-tier assumptions were
not incorporated. The current `transcription.py` supplied the prepare/raw/normalize
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
the runner owns staging/review. PostgreSQL/Redis/Celery recovery, Android/physical
device flows, live-provider compatibility, Korean/mixed-language quality and
human inspection remain pending. Stop before checkpoint 2 until the user confirms.
