# ElevenLabs Scribe v2 transcription

Confirmed direction received from Injoon on October 16, 2026: create a visible GitHub branch from the latest branch to replace transcription with ElevenLabs Scribe v2. The explicit model request governs despite the opening phrase “use whisper instead.” This is branch-scoped implementation, not a merge or deployment decision.

Base: `it2/feature/ai_feedback` at `ff8472c`, the newest live remote branch by commit time when fetched on October 16. Branch: `codex/scribe-v2-transcription`. The original working checkout and unrelated edits are preserved.

## Configuration and behavior

Set `ELEVENLABS_API_KEY` in ignored `backend/.env` for the API and worker. Never configure it in the mobile bundle. OpenAI/Gemini feedback configuration remains separate.

The existing `transcribe(Path)` adapter posts the original audio as multipart to `https://api.elevenlabs.io/v1/speech-to-text` using the backend `xi-api-key` header. HTTPX is already a locked direct dependency; no new SDK or package is added. Request options are:

| Parameter | Value | Purpose |
| --- | --- | --- |
| `model_id` | `scribe_v2` | Batch Scribe v2 |
| `keyterms` | Up to 100 extracted terms, omitted when empty | Bias recognition toward recorded-slide vocabulary |
| `timestamps_granularity` | `word` | Playback and slide alignment |
| `no_verbatim` | `false` | Preserve recognized fillers and false starts |
| `tag_audio_events` | `false` | Avoid non-speech event tags in the transcript |
| `diarize` | `false` | Single-presenter workflow |
| `use_multi_channel` | `false` | One combined transcript |
| `keyterms` | Up to 100 extracted words/phrases | Vocabulary hints from visited slides; omitted when empty |

Language is automatically detected. Keyterms are selected from extracted text on slides visited in this recording; there is no post-edit instruction or model fallback. The [official API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), checked October 16, 2026, documents these parameters. Preserving fillers does not guarantee perfect recognition or constitute a filler classifier or pause detector; those features are separate work.

## Compatibility and recovery

The public transcript stays `{text, words: [{text, start_ms, end_ms}]}`. Only Scribe `type=word` items become timed words; spacing/audio-event entries remain in private raw evidence. Seconds use half-up integer-millisecond rounding on the original audio timeline. Detected language uses Scribe `language_code`; old Whisper results retain `language`. File limits (25,000,000 bytes and accepted extensions), Silero no-speech gating, alignment checks and recording retention remain unchanged.

New durable requests explicitly store `elevenlabs` / `scribe_v2`. The database's historical request defaults remain `openai` / `whisper-1`; existing rows are not relabeled. Saved raw responses are decoded using their stored provider; completed transcripts are reused without new provider calls. Both provider/model pairs are accepted by the mobile parser and offline cache. Q&A audio uses the same transcription adapter.

The app discloses ElevenLabs and slide-derived vocabulary hints before new submissions, including Q&A answers and transcription retries; declining keeps the saved recording and sends no new audio. Its current consent key (`analysis-consent:elevenlabs:scribe-v2:keyterms:v2`) is separate from prior OpenAI and audio-only Scribe consent; existing users must acknowledge the updated disclosure. Read-only playback of old results requires no new consent. Existing server-side queued jobs retain the established admission behavior; consent is a mobile gate, not a new server-enforced consent protocol. Coordinate API/worker/mobile rollout and drain old queued work before changing providers on a shared server. An old mobile build rejects Scribe provenance, so this branch requires the updated client.

Each submission makes one HTTP request, with no automatic retries or redirect following and a 120-second timeout. Durable markers precede submission; raw responses precede normalization. Timeout, network loss, HTTP 408/5xx and unknown post-submission failures retain uncertain-charge confirmation. Known rejections and Retry-After remain recoverable. Provider bodies/keys stay out of public errors and APIs.

## Verification

Agent-operated checks on October 16:

- Django system check and migration-drift check passed; no migration is needed because new requests explicitly set provider/model while historical defaults stay intact.
- Full SQLite suite: 391 tests, OK, 25 skips (24 PostgreSQL-specific checks and one packaged-VAD test without the optional model dependencies in the temporary environment). Final affected backend rerun after adding provenance assertions: 41 tests, OK, three PostgreSQL skips.
- Mobile `npm run check`: TypeScript, lint and 298 tests passed. Android JavaScript export passed. Tests cover new Scribe/old Whisper parsing, mismatched identities, provider-specific consent, Q&A cancel/no-submission, historical raw recovery and uncertain-charge behavior.
- One live call through the new adapter using a 20-second excerpt of the already evaluated EdUHK presentation 10 returned 62 timed words, language `eng`, first start 160 ms, last end 19,720 ms, in 1.50 seconds. This is API/normalization evidence, not an acoustic accuracy or timestamp listening audit. Source audio and raw response remain private and uncommitted.
- Independent Codex review found a missing Q&A consent gate. The client and dialog were corrected and the reviewer found no further actionable issues on the second pass.

At initial publication, no PostgreSQL/Redis/Celery live-worker or new packaged-VAD run had been performed; device interaction was unverified. The dated follow-up below records subsequent runtime checks. End-to-end device transcription acceptance remains pending. The speech gate and queue/recovery architecture are retained. Existing model-comparison results motivated this change but do not establish Korean quality, pause detection or device readiness. No Wiki, main-branch merge or deployment is part of this change.


## Android runtime follow-up — October 16, 2026

The debug APK built successfully and was installed/launched on the connected Samsung SM-S931N and API 36 arm64 emulator. Agent-inspected screens showed the phone rehearsal UI and emulator Home. This development session uses Metro and USB forwarding; leave the Mac and phone connection active. Existing app data was preserved. These checks establish installation/launch, not full end-to-end rehearsal or human acceptance.

The complete locked backend runtime is now installed locally: all three speech-gate tests passed, including the real packaged model. While the phone was in use, actual PDF upload failed because extracted text contained U+0000, which PostgreSQL rejects. The parser now removes that character from extracted text while preserving source PDF bytes and rendered images. A synthetic real-PDF regression failed before the fix and passed afterward on PostgreSQL; independent AI review found no actionable issues. Final backend suite: 392 tests OK (24 PostgreSQL-only skips), plus system/migration checks. The API was restarted with the fix; failed uploads can be retried without discarding local media. Initial verification limits above describe the earlier publication state.


## Recording-flow follow-up — October 16, 2026

[Detailed emulator and backend evidence](evidence/scribe-full-flow-20261016/README.md): one real backend HTTP/worker request verified `elevenlabs / scribe_v2` and preserved six `um`/`uh` tokens through the mobile parser. Native recording/save/upload and consent were exercised, but emulator audio injection did not yield a usable speech capture. Full native speech-to-transcript acceptance remains unverified. The app's existing keyword filler counter also counts contextual uses such as “I would like to share”; preserving Scribe's words does not resolve classification accuracy. The user explicitly kept further testing on the emulator; the phone was not used in this follow-up.


### Later phone result — October 16

The user switched to a real Samsung phone. After restoring its intermittent USB
forwarding, the agent retried an existing 16.83-second native recording and
completed the disclosed Scribe v2 transcription flow. One actual provider request
returned 26 timed words across three slide visits, retaining `Uh,` and `Um,`. The
phone's cached transcript matches the server result and the app displays the
transcript. [Detailed evidence](evidence/scribe-full-flow-20261016/README.md#physical-phone-recovery-and-completed-flow--later-october-16).
This supersedes the earlier pending status for the phone flow; emulator microphone
injection remains blocked. No listening-based accuracy or filler-recall audit
was performed, and no code change was needed for this connection recovery.

## Vocabulary-hint investigation — October 16, 2026

Status at investigation: verified provider capability and implementation feasibility;
the user subsequently approved implementation in the follow-up below. Source publication date is not stated;
[API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert) and
[keyterm guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/batch/keyterm-prompting)
were checked October 16, 2026.

Scribe v2 batch supports `keyterms`: at most 1,000 terms, each strictly fewer than
50 characters and at most five words after normalization. The API disallows
`<`, `>`, `{`, `}`, `[`, `]` and backslash. Providing keyterms incurs a 20% surcharge
on the base transcription cost; more than 100 terms imposes a 20-second minimum
billable duration. Follow the stricter API reference's character limit rather
than the guide's rounded “50 characters” wording.

The backend already extracts and stores `Slide.extracted_text`, but the current
Scribe adapter sends no keyterms and receives only the audio path. A scoped
implementation could select and deduplicate relevant names, acronyms and short
technical phrases from the recorded presentation's slides, validate/cap them,
and pass them into the same Scribe request. This does not inherently require a
second AI model. Text embedded in images may be absent from the PDF extraction;
OCR would be separate work. Do not pass the entire deck as a single hint.

Recommendation: compare identical audio with/without a small curated term list
before adopting automatic extraction. Retain `no_verbatim=false`, original audio
and timestamps; measure intended-term recognition, spurious term substitutions
and filler preservation. Hints bias recognition and do not establish what was
spoken when audio is ambiguous. Any implementation must snapshot the actual
term list with durable request evidence so retries remain traceable. No source
code or provider call was changed/made by this investigation.

The API also now documents optional `transcript_edit`, returning edited text
alongside the original transcript (additional 30% surcharge). Therefore a
separate external AI is not strictly required for every post-editing approach;
that discovery corrects the earlier conversational assumption. This feature was
not implemented or evaluated here, and is distinct from keyterm prompting.

## Automatic slide keyterms — implemented October 16, 2026

Confirmed direction: Injoon requests automatic extraction and submission as Scribe
keyterms. The backend uses deterministic Unicode word/short-phrase extraction,
common-word filtering, case-insensitive deduplication and bounded ranking. It
selects text only from slides visited in that recording (the question slide for
the legacy synchronous Q&A endpoint), up to 100 terms, each 2–49 characters and
at most five words. Empty text sends no keyterms. There is no additional AI call
or new dependency. This heuristic can still include ordinary words and miss
useful terms; image-only text requires separate OCR. No recognition gain is
guaranteed. `no_verbatim=false` remains explicit.

Apply migration `0010_provider_request_options` before starting the updated
API/worker. New durable provider requests privately snapshot the exact submitted
options, including keyterms, before the outbound call. Historical requests get
an empty options object; they are not assigned invented hints or retranscribed.
Saved receipts/transcripts remain reusable without new requests. The audio hash
still identifies original audio bytes. This backend change requires the updated
mobile disclosure; old clients do not enforce the new keyterms consent namespace.
The mobile gate is not a new server-side consent protocol.

Checks: 398 backend SQLite tests OK (24 PostgreSQL-only skips); migration applied
successfully on actual local PostgreSQL; Django system/migration-drift checks pass.
Mobile typecheck and 298 tests pass; lint has zero errors and one pre-existing
`useSegmentPlayer.ts` effect-cleanup warning. Separate AI review found an obsolete
consent-test key, corrected and verified in the passing suite; no production
correctness finding was reported.

A real PDF/audio HTTP upload through the actual worker/Silero/Scribe pipeline sent
15 automatically extracted terms from a synthetic two-slide text PDF. The same
45-second public EdUHK presentation 5 clip returned 91 timed words and retained
all six baseline `um`/`uh` tokens. The durable receipt confirms Scribe v2, one
request, the exact hint list, `no_verbatim=false` setting and matching original audio
hash. This validates plumbing and sample filler preservation, not a measured
recognition improvement. [Safe integration metrics](evidence/scribe-keyterms-20261016/results.json).
Full provider text/audio remains private.

### Other available Scribe parameters

The [official API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert),
checked October 16, documents the following useful controls. Only keyterms are
newly enabled here; do not interpret the recommendations as approved features.

| Parameter | Current behavior / relevance |
| --- | --- |
| `language_code` | Omitted: automatic detection. Explicit English/Korean could be evaluated when the spoken language is known. |
| `no_verbatim` | Explicit false: retain recognized fillers and false starts. |
| `timestamps_granularity` | Word: required by current alignment/playback. Character timing is also available. |
| `temperature`, `seed` | Provider defaults; seed can help comparisons, without guaranteed determinism. More randomness is not an accuracy fix. |
| `tag_audio_events` | False; enabling adds event labels such as laughter, separate from filler detection. |
| `diarize`, `num_speakers`, `diarization_threshold` | Speaker separation controls; current single-presenter transcription does not enable diarization. |
| `transcript_edit` | Optional edited text alongside original; extra 30%, currently unused and requires separate result handling. |
| `use_multi_channel` | False; separate channels have separate full-duration billing. |
| `entity_detection`, `entity_redaction` | Detect/redact named entities; unused for recognition accuracy. |
| `webhook`, `additional_formats`, `file_format` | Delivery, exports and input encoding; current pipeline uses synchronous encoded audio upload. |

There is no dedicated pause-detection parameter in this endpoint. Word timing
gaps can support a separate pause analysis, with acoustic verification needed to
distinguish pauses from missed speech.

## Automatic slide keyterms — confirmed and implemented October 16, 2026

Injoon explicitly requested extracting keywords and sending them as Scribe
keyterms. The implementation uses a deterministic content-word/short-phrase
extractor on stored PDF text from slides present in the recording's slide events.
It removes common function words and hesitation words, deduplicates case-insensitively,
prioritizes repeated terms/acronyms/short phrases and caps the list at 100 terms.
Each term is under 50 characters and conservatively limited to five words after
punctuation splitting. There is no second AI call or new package. This is a
heuristic, not semantic keyword understanding; ordinary content words can remain.
Image-only slide text needs separate OCR, which is not added here.

The terms are sent as repeated multipart `keyterms` fields in the same Scribe
request. Empty lists omit the parameter and keep ordinary transcription.
`no_verbatim=false`, word timestamps, original media, silence gating and durable
raw-response recovery remain intact. Existing completed results are not
retranscribed. The current durable Q&A path uses the same recording worker; the
legacy synchronous answer route uses its question slide's terms.

Migration `0010_provider_request_options` adds a private JSON snapshot of actual
submitted options to each ProviderRequest before the network call. Historical
requests default to `{}` without relabeling or invented terms. Apply the migration
before starting new API/workers. Coordinate updated mobile/backend rollout; the
existing consent model remains a client gate, not server-enforced authorization.
The updated disclosure requests consent again because slide-derived terms now
leave the server along with audio. Provider surcharge is 20% when hints are sent;
the 100-term cap avoids the provider's >100-term 20-second billing minimum.

Verification: 398 backend SQLite tests OK (24 PostgreSQL-specific skips), 298
mobile tests plus TypeScript/lint OK (one existing unrelated hook warning), Android
JS export passed, no migration drift. The additive migration was applied to the
isolated real PostgreSQL database and live request-options persistence checked.
Migration-preservation expectations now explicitly check historical options `{}`.
Independent AI review found the consent test still reset the obsolete key; this
was fixed to verify both old providers/audio-only consent do not authorize new
slide hints. Final review found no remaining actionable issues.

A guarded live HTTP/PDF/worker test with a synthetic two-slide text PDF and the
previous public 45-second recording completed with 15 actual extracted hints,
91 timed words and all six `um`/`uh` tokens retained. Stored request options match
extracted terms and the stored audio hash matches the request input hash. This
proves payload acceptance and filler preservation for this sample, not improved
recognition accuracy. The existing guarded test identity was reverified instead
of issuing another charged request. [Safe live metrics](evidence/scribe-keyterms-20261016/results.json).
The changed keyword path has not been exercised in a new phone recording; earlier
phone flow evidence predates keyterms.
