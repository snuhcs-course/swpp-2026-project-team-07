# ElevenLabs Scribe v2 transcription

Confirmed direction received from Injoon on October 16, 2026: create a visible GitHub branch from the latest branch to replace transcription with ElevenLabs Scribe v2. The explicit model request governs despite the opening phrase “use whisper instead.” This is branch-scoped implementation, not a merge or deployment decision.

Base: `it2/feature/ai_feedback` at `ff8472c`, the newest live remote branch by commit time when fetched on October 16. Branch: `codex/scribe-v2-transcription`. The original working checkout and unrelated edits are preserved.

## Configuration and behavior

Set `ELEVENLABS_API_KEY` in ignored `backend/.env` for the API and worker. Never configure it in the mobile bundle. OpenAI/Gemini feedback configuration remains separate.

The existing `transcribe(Path)` adapter posts the original audio as multipart to `https://api.elevenlabs.io/v1/speech-to-text` using the backend `xi-api-key` header. HTTPX is already a locked direct dependency; no new SDK or package is added. Request options are:

| Parameter | Value | Purpose |
| --- | --- | --- |
| `model_id` | `scribe_v2` | Batch Scribe v2 |
| `timestamps_granularity` | `word` | Playback and slide alignment |
| `no_verbatim` | `false` | Preserve recognized fillers and false starts |
| `tag_audio_events` | `false` | Avoid non-speech event tags in the transcript |
| `diarize` | `false` | Single-presenter workflow |
| `use_multi_channel` | `false` | One combined transcript |

Language is automatically detected. There is no post-edit instruction, keyterm bias or model fallback. The [official API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), checked October 16, 2026, documents these parameters. Preserving fillers does not guarantee perfect recognition or constitute a filler classifier or pause detector; those features are separate work.

## Compatibility and recovery

The public transcript stays `{text, words: [{text, start_ms, end_ms}]}`. Only Scribe `type=word` items become timed words; spacing/audio-event entries remain in private raw evidence. Seconds use half-up integer-millisecond rounding on the original audio timeline. Detected language uses Scribe `language_code`; old Whisper results retain `language`. File limits (25,000,000 bytes and accepted extensions), Silero no-speech gating, alignment checks and recording retention remain unchanged.

New durable requests explicitly store `elevenlabs` / `scribe_v2`. The database's historical request defaults remain `openai` / `whisper-1`; existing rows are not relabeled. Saved raw responses are decoded using their stored provider; completed transcripts are reused without new provider calls. Both provider/model pairs are accepted by the mobile parser and offline cache. Q&A audio uses the same transcription adapter.

The app discloses ElevenLabs before new submissions, including Q&A answers and transcription retries; declining keeps the saved recording and sends no new audio. Its consent key is separate from prior OpenAI consent. Read-only playback of old results requires no new consent. Existing server-side queued jobs retain the established admission behavior; consent is a mobile gate, not a new server-enforced consent protocol. Coordinate API/worker/mobile rollout and drain old queued work before changing providers on a shared server. An old mobile build rejects Scribe provenance, so this branch requires the updated client.

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
