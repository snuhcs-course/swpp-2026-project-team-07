# Rehearsal recording and review

**Status: Current technical reference with dated historical notes.** Verify behavior
against the current branch and API contract; dates and merged-PR statements describe
the recorded snapshot, not new acceptance evidence.

- Product and recovery details relocated from README on October 13, 2026; this documentation move adds no verification results.
- See the [main walkthrough](../../README.md#main-rehearsal-flow), [API contract](../architecture/api-contract.md), and [verification guide](../development/verification.md).

## Integrated behavior

**Current status: Iteration 1 features merged into `main` on October 11, 2026 (#17–#21).** The Library merges local captures and server history for known presentations. Saved rehearsals open by attempt UUID with actual PDF pages, audio, synchronized transcript and chronological slide visits. Missing audio/PDF can be downloaded explicitly for offline review. Ordinary browsing, refreshing, downloading and replaying never start analysis; the durable new-capture handoff is the explicit exception. Existing **Analyze recording**, OpenAI disclosure, stage/Refresh/Retry and uncertain-charge confirmation remain in place; sample previews stay separate.

**Recording-to-transcription flow.** Finishing a real recording opens its saved result and uploads the PDF and audio to the configured server. Transcription starts after the first-use ElevenLabs disclosure is accepted; the disclosure also covers bounded vocabulary hints derived from visited-slide text. Cancelling leaves the server upload saved without starting transcription. The saved-attempt screen retains processing and retry controls for cancelled or older recordings. SQLite caches results by API address and attempt UUID. Local replay remains available through network/provider/analysis failures; sample previews stay separate.

The backend coordinates a durable PostgreSQL queue, packaged Silero speech-presence check, ElevenLabs `scribe_v2`, private raw-response persistence, normalized transcript, chronological slide visits and timing/rate estimates. Deterministic extraction supplies at most 100 provider-valid keyterms from visited slides without an extra AI request. Rehearsal coaching and Audience Q&A use the configured feedback provider and remain disabled when feedback is not configured; their APIs are described in the [feedback guide](ai-feedback/reference.md). See the [Scribe v2 reference](transcription/scribe-v2.md) and [API contract](../architecture/api-contract.md) for provider identity, recovery and uncertain outbound requests.

[AI feedback checkpoints 1–5](ai-feedback/reference.md) were implemented in PR #21 and merged after their dependencies on October 11, 2026. Gemini/OpenAI adapters provide durable editable slide descriptions, explicit rehearsal coaching, separate provider disclosure, revision-aware retries and API-scoped offline review. Up to three suggestions show exact evidence and seek the existing player; edits make affected feedback stale, and explicit regeneration reuses the saved transcript. Provider selection remains backend configuration and feedback defaults to disabled. Independent review and controlled live flows passed for both providers; [the evaluation](../evidence/iteration-1/ai-feedback/controlled-evaluation.md) records weak advice and description overstatement separately from structural validity. Human review and physical-phone checks remain pending.

Detected no-speech saves an empty transcript, chronological visits with empty word lists, and timing metrics over the original recording duration, with zero provider requests. Repeated, backward and zero-duration visits remain visible in the result data.

## Local capture and limits

Local PDF import, capture and saved-audio playback run without backend services or provider keys. SQLite stores one UUID, the prepared audio URI and audio-relative slide checkpoints per real recording. On restart, interrupted capture requires playable-audio recovery; an unfinalized/missing native file cannot be reconstructed. Upload retries retain the UUID, source audio and slide visits. Native PDF rendering and SQLite require a rebuilt Android development client, not Expo Go.

Limits are **at least one slide, 50 MiB PDF, twenty minutes (1,200,000 ms), and 25,000,000 audio bytes**. Legacy audio above the byte limit stays local and can still be played; make a shorter new recording to upload. New captures automatically continue from upload to analysis; first-use cancellation leaves them awaiting analysis. Deck mappings are scoped to the configured API address, and confirmed missing mappings are repaired before audio upload.

## Review a saved rehearsal

In JJ's Rehearse transcript panel, each source visit starts with **First visit** or
**Return visit N** and its start time in the original recording. Return counts
include silent positive-duration visits; visits without transcript words have no
sentence group to label. A separate retake starts its own visit count. Correcting
or moving a sentence preserves its original visit; moved sentences also identify
their source slide. These dividers do not alter playback or saved run selection.

Tap the transcript heading or its triangle to play/pause the selected slide's
visits. Tap a sentence or its timestamp to play that sentence; tap it again to
stop. The current word is highlighted from native audio time during slide or
sentence playback. Pauses between words have no word highlight. If a correction
changes the text so it no longer maps to the original timed words, the active
sentence remains indicated without inventing replacement-word timing. Flagged
words retain their correction action. Playback failure shows a retry hint.

Open a presentation's rehearsal history in Library, then **Open saved rehearsal**. Cached entries appear before online refresh; a failed refresh retains them with a stale notice. History covers only locally known presentation mappings for the current API, not an account-wide archive. Entries distinguish local captures from server review copies and show date, duration, upload/processing state and media availability.

Review prefers existing local audio/PDF. Use **Download audio for offline review** or **Download PDF for offline review** when needed; each succeeds independently. **Refresh** retries both rehearsal and presentation metadata, including a failed lookup that prevented PDF recovery. Downloads are bounded and validated with the native player/renderer before durable cache publication. They never create a local capture or PDF import, and failed downloads preserve original and previously valid files. Switching API addresses separates history, analysis and downloaded media.

The native audio position drives PDF pages and timed word highlighting. Tap a timed word or visit, use previous/next visit or ±5 seconds; seeks preserve playing/paused intent. Backgrounding or leaving the screen pauses playback, and returning requires Play. Repeated/backward and instantaneous visits remain listed; simultaneous events use the last event. Missing alignment falls back to **Recorded navigation**. Partial/untimed text remains readable, and saved EN/KO rates explicitly use total rehearsal time including silence. See the [review contract](../architecture/api-contract.md#mobile-rehearsal-review).

## App connection and transcription disclosure

- Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api` in `mobile/.env`.
- USB phone: run `adb reverse tcp:8000 tcp:8000`, use `http://127.0.0.1:8000/api`, and restart Metro.
- Tap **Check connection** in the Library screen.

Provider keys belong only in ignored `backend/.env`. Never use `EXPO_PUBLIC_*` for secrets. Storage/upload endpoints call no providers. After a new capture uploads, the mobile flow calls `/attempts/{id}/process/` following first-use disclosure; older/cancelled recordings retain Analyze and failures retain explicit Retry. Missing keys and provider rejection fail safely while retaining source audio.
