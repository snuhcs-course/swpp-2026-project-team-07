# Iteration 1 team handoff

This is a shared starting scaffold based on the submitted Expo/React Native/TypeScript Android + Django REST architecture. Hours are outside this task. The schedule does not establish individual feature owners; assign names as a team.

Use [team-work-division.md](team-work-division.md) for the recommended owner split, detailed completion checks, shared-file coordination, and branch commands.

| Branch | Main files | Implement | Acceptance evidence |
| --- | --- | --- | --- |
| `feature/pdf-viewer` | `mobile/src/features/pdf/`, backend `services/pdf.py` | Pick/persist/upload PDF; ordered slide images/text; real viewer | 3–5-page PDF, page boundaries, cancellation/invalid-file handling |
| `feature/recording-tracking` | `mobile/src/features/recording/` | Permission, real audio, durable file, slide events on audio timeline | Playback and checked forward/backward transition timestamps |
| `feature/whisper-alignment` | `mobile/src/features/transcription/`, backend `services/transcription.py`, `services/alignment.py` | Upload, hosted Whisper, word timestamps, slide matching, transcript UI | Real words and human-checked boundaries; failure retains audio |
| `feature/prototype-integration` | Backend `services/feedback.py`, `tasks.py`, API handlers, shared types | Storage/worker integration, initial Gemini image feedback, evidence validation | PDF → recording → transcript → matching → feedback |

The last row is an integration responsibility, not necessarily a fourth person. Initial Gemini feedback is included in the submitted Iteration 1 scope.

## Already wired

- Four screen frames with back navigation and explicit sample-data notices.
- Sample slide navigation, audience input, and sample/processing/failure result previews.
- A real app-to-Django HTTP health check.
- Deck/slide/attempt models, initial migration, metadata validation.
- PostgreSQL, Redis, shared media and Celery development configuration.
- Feature interfaces, backend adapter entry points, setup docs and CI checks.

## Implementation entry points

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


## Current restoration handoff (2026-10-08)

Stage 1 is consolidated into PR #17 (`feature/pdf-recording`); PRs #14–#16 are closed as superseded. Stage 2 uses `feature/recording-storage-upload`, stacked on that integration branch while #17 remains unmerged. It saves local attempts/checkpoints and uploads durable PDF/audio with duplicate protection; uploaded attempts explicitly await analysis. The process endpoint remains 501.

The local multi-agent pipeline implemented and independently reviewed storage repairs. Automated, PostgreSQL/Redis/Celery media-access and Android emulator evidence is recorded in [AI-use](ai-use.md). Physical-device audio quality and human review remain pending. The user authorized PR publication, not merging. Stop after this storage implementation and receive explicit confirmation before starting `feature/whisper-api-processing`; that next stage uses hosted `whisper-1`, never local Whisper inference.
