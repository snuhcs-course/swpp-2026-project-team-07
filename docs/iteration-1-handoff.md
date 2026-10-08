# Iteration 1 team handoff

The initial scaffold/branch and hosted-processing sections below are historical. The rehearsal-review section at the end describes the current patch and its verification boundary.

This is a shared starting scaffold based on the submitted Expo/React Native/TypeScript Android + Django REST architecture. Hours are outside this task. The schedule does not establish individual feature owners; assign names as a team.

Use [team-work-division.md](team-work-division.md) for the recommended owner split, detailed completion checks, shared-file coordination, and branch commands.

| Branch | Main files | Implement | Acceptance evidence |
| --- | --- | --- | --- |
| `feature/pdf-viewer` | `mobile/src/features/pdf/`, backend `services/pdf.py` | Pick/persist/upload PDF; ordered slide images/text; real viewer | 3–5-page PDF, page boundaries, cancellation/invalid-file handling |
| `feature/recording-tracking` | `mobile/src/features/recording/` | Permission, real audio, durable file, slide events on audio timeline | Playback and checked forward/backward transition timestamps |
| `feature/whisper-alignment` | `mobile/src/features/transcription/`, backend `services/transcription.py`, `services/alignment.py` | Upload, hosted Whisper, word timestamps, slide matching, transcript UI | Real words and human-checked boundaries; failure retains audio |
| `feature/prototype-integration` | Backend `services/feedback.py`, `tasks.py`, API handlers, shared types | Storage/worker integration, initial Gemini image feedback, evidence validation | PDF → recording → transcript → matching → feedback |

The last row is an integration responsibility, not necessarily a fourth person. Initial Gemini feedback is included in the submitted Iteration 1 scope.

## Historical scaffold: already wired

- Four screen frames with back navigation and explicit sample-data notices.
- Sample slide navigation, audience input, and sample/processing/failure result previews.
- A real app-to-Django HTTP health check.
- Deck/slide/attempt models, initial migration, metadata validation.
- PostgreSQL, Redis, shared media and Celery development configuration.
- Feature interfaces, backend adapter entry points, setup docs and CI checks.

## Historical scaffold implementation entry points

- `pdfService.importPdf()` raises a not-implemented error. Implement picker cancellation as `null`; never substitute demo data for a real import.
- `SlidePreview` renders designed sample slides. Replace it with real slide images, or agree on a native PDF renderer before adding a dependency.
- Recording controls are disabled. Implement `RecordingService` before enabling them; a timer alone does not establish audio capture.
- Results combine the saved Whisper transcript of synthetic speech with local audio playback, synchronized word highlighting and tap-to-seek; other states remain explicit previews. Live `AttemptResult` wiring remains pending; no app upload is claimed.
- The [mobile transcription client](mobile-transcription.md) now implements requests and cancellable polling with mocked tests on `feature/transcription-client-and-playback`. Native upload and recorder/result-screen integration are not yet verified.
- Feature API routes return HTTP 501. Implement real storage/processing instead of fake success responses.
- The Celery task, PDF, and feedback adapters still raise `NotImplementedError`. The [Whisper adapter](whisper-transcription.md) is implemented with mocked-provider tests; a live synthetic TTS check passed; human-recorded speech verification is pending. The standalone [word alignment function](word-alignment.md) is implemented and tested on `feature/whisper-alignment`; its proposed output needs integration review before worker wiring.

## Shared rules

Follow `api-contract.md`: zero-based slide indexes, integer milliseconds relative to actual captured audio, and a new attempt ID for every new recording. Processing retries preserve the ID/audio. Keep every repeated/backward slide visit. The PDF owner supplies images/text for feedback. The recording and Whisper owners agree on the capture-start signal and time base before integration.

Coordinate shared model/migration changes. Keep provider credentials on the backend. Evaluate real recordings before claiming filler/repetition/false-start detection. Saved-attempt browsing, selected-slide retries, and comparisons belong to later iteration UI; this scaffold retains the data identities needed for them.

Start branches from the reviewed scaffold commit. Follow the team's review/testing agreement before pushing. Include commands, device evidence and limitations in each PR. Integrate on an Android device; the submitted plan names Galaxy S22/S23.


## Initial stage 1 restoration branch plan (historical, 2026-10-08)

Real local PDF identity, native page count (up to 10), confirmed selected starting page, and audio-timed page-change callbacks are connected to capture. Actual saved audio plays in Results without a sample transcript. Capture failures/navigation use the reviewed lifecycle behavior.

Stage 1 is being prepared on isolated `codex/recording-review-fixes`, `codex/pdf-import`, and `codex/pdf-recording-restore` branches. Recording fixes are based on PR #13 head `040880f8`; PDF/integration snapshots start from main `f6f6e766`. Integration currently includes its prerequisites so it can be tested before commits. After human review, merge the recording/PDF prerequisites first and refresh the integration PR base. Updated user direction (2026-10-08): publish the review branches and continue all remaining stages while teammate review is pending. Later stages stack on the preceding implementation branch; maintainers merge in dependency order. No agent merge is authorized.

The local prototype and earlier worktrees are reference sources, not merge bases. Reused code/tests originate in local recording `b28de880`, PDF `260dcbae`, and the preserved unfinished integration worktree. The original worktrees remain unchanged.


## Hosted-processing base handoff (2026-10-08)

This stage builds on committed storage base `06fe340`. The current user explicitly authorized `feature/whisper-api-processing`, superseding the historical stop-after-storage instruction. No named owner approval is inferred. The local pipeline supplied implementation and independent staged review; the coordinator handles authorized publication. Human review and merging remain with the team.

Implemented scope: explicit saved-recording Analyze with OpenAI disclosure; PostgreSQL durable queue and 30-second Beat recovery; generation/token claims; packaged Silero CPU presence gate; hosted `whisper-1` only; private raw/usage records; persisted normalized transcript; authoritative-duration alignment and EN/KO timing/rate estimates; stage/Refresh/revision-aware Retry/uncertain-charge confirmation; API-scoped SQLite cache; plain real transcript and retained local replay. Upload never automatically processes. Feedback stays disabled regardless of configured credentials. Full synchronized review UI, themes, auth, deployment and new detectors are excluded.

Read [api-contract.md](api-contract.md) before changing the pipeline. Additive migration preserves existing results/media and does not queue legacy rows. A request marked submitted without a durable outcome cannot be automatically called again. Raw/transcript resume avoids provider work. The prototype `33907d3` supplied only the no-speech presence policy and metrics approach; its local Whisper inference, automatic retries and duration extension were not incorporated.

Coordinator repair: no-speech now follows shared alignment/metrics with a saved empty transcript, empty-word visits (including repeated/backward/zero-duration visits), unchanged recording duration and zero provider requests. Torch/Torchaudio are pinned to 2.10.0; the regenerated lock preserves all other pins. Two residual advisories and the packaged ONNX source-path assessment are recorded in [whisper-transcription.md](whisper-transcription.md#packaged-gate-dependency-assessment-2026-10-08). Final coordinator verification repeated affected checks against the repaired source; detailed evidence and remaining human/device boundaries are linked below.

Verification separates mocked/SQLite checks, real infrastructure, synthetic hosted speech, emulator behavior and human review. The final outcomes and outstanding checks follow.

Base-stage handoff: independent staged review passed. Mobile checks (115 tests), Android export, backend checks (74 tests; five skips on SQLite, all 74 passing on PostgreSQL), populated/interrupted upgrades, real worker crash recovery and Linux packaged VAD passed. A controlled hosted English TTS pilot produced 41 timestamped words and slide visits 3 → 4 → 3; completed retries reused its saved result. Android emulator checks covered consent, Analyze, silence metadata, restart/offline cache and local replay. Physical-phone/human-speech and Korean VAD evaluation, native API-switch/background stress checks and human code review remained pending. See [AI-use evidence](ai-use.md#2026-10-08--hosted-processing-coordinator-verification-and-publication). That stage was stacked on `feature/recording-storage-upload`. The later explicit rehearsal-review authorization supersedes its historical stop instruction.

## Current rehearsal-review handoff (2026-10-08)

The authorized `feature/rehearsal-review` patch builds on Whisper PR #19, `c7733d8288833b010948d2c5737929088547aa1e`. One writer continued the existing patch. The coordinator owns staging, independent review and eventual publication as one stacked PR; no writer commit/push/merge or named owner's approval is claimed.

Implemented: API-scoped cached-first per-presentation history; UUID server-only review records distinct from captures; validated audio/PDF recovery into separate durable media records; native-position PDF/transcript/visit synchronization; serial latest-target seeks with pause during seek; saved timing and explicit EN/KO total-rehearsal rates. Existing native dependencies, visual style, recovery/upload retry, Analyze/disclosure/Refresh/revision retry and uncertain-charge confirmation remain. Review operations never analyze. Contract and failure policies are in [api-contract.md](api-contract.md#mobile-rehearsal-review).

Prototype `33907d3` was inspected read-only: `PlaybackSlide.tsx`, `PlaybackTranscript.tsx`, `playback.ts`, `transcriptLayout.ts` and `ResultsScreen.tsx`. Reuse is limited to native PDF presentation, chronological visit lookup and verbatim transcript span/highlight/seek concepts, adapted to current capture, analysis and SQLite foundations. Prototype theme, Feedback/Playback tabs, feedback providers, local transcription and layout-follow scrolling were not incorporated. No backend/provider/schema/dependency changes are part of this stage.

Continuation repair: installed Expo 57 recreates the native player on source change while `useAudioPlayerStatus`/`useEvent` retains the old snapshot until an event. A regression fixture reproduced disabled Play after first download. Review now subscribes/reads status per player identity, retains a validated source/position on return, and reasserts pause on foreground; delayed old-player callbacks cannot clear good media. Strict result validation was extracted unchanged to break `client.ts → reviewValidation.ts → client.ts`.

Round-1 review reproduced three issues, now repaired: seek controls disabled during Android buffering, shared PDF validation cancelled by its first consumer's unmount, and absolute-path original audio blocked from recovery. Seek readiness now tracks initial load per player; native validation transfers to a remaining consumer over the same downloaded file; recovery saves the canonical original URI. Tests reproduced all three failures before the fixes and cover replacement/error/lifecycle callbacks, shared-download validation failure and recovery followed by upload.

Round-2 review reproduced three further issues, now repaired: an older seek's EOF cleared newer playing intent, detached PDF errors cleared validated replacement media, and failed deck metadata had no explicit retry. EOF now passes through the seek controller with a fresh native-position check; media errors are fenced by source and focus session; Refresh retries cancellable deck and attempt GETs. Synthetic regressions failed before these fixes and now pass, including normal EOF/replay/Pause, background/navigation callbacks and stale/API-switched deck refreshes.

Round-3 review reproduced three issues, now repaired: offline upgrades without an additive review cache hid saved analysis; incomplete refreshes rendered unreconciled snapshots; ordinary native pauses retained playing intent. Review now derives from the existing API-scoped analysis cache, renders storage's reconciled result and preserves validated in-memory content on cache failure. Native pauses clear intent outside seek/buffering transitions, with fresh native status and separate EOF handling. Twelve new regressions include nine failing-before/passing-after cases plus late refresh rejection after background/navigation/API changes.

Final verification: independent staged review passed after the documented repair rounds. Mobile TypeScript/lint, **209 tests** and Android export passed. Final application/test bytes match the reviewed snapshot; coordinator-only documentation records publication evidence. Backend source/dependencies are unchanged, with system/migration checks, 74 PostgreSQL tests and API restart/media retrieval verified separately. Android emulator checks covered real PDF/transcript/audio review, server-only audio/PDF recovery, offline restart, word/visit seeks, pause/foreground behavior and EOF/replay. No new provider request occurred.

Physical-phone/audible synchronization, native audio-focus fault injection, API-switch and exhaustive callback/download-cancellation stress remain pending; automated regressions cover their modeled cases. Human review remains pending. See [final evidence](ai-use.md#2026-10-08--rehearsal-review-final-verification-and-publication). Publish one PR against `feature/whisper-api-processing`; do not merge. The proposed next implementation is `feature/ai-feedback`, and it requires user confirmation after this handoff.
