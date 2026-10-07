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
- On `feature/recording-tracking-v2`, capture controls use `expo-audio`; native audio milliseconds drive the timer and initial/forward/backward slide events. Stop freezes duration before native finalization and a capture error clears the attempt by releasing its recorder; an explicit retry creates a fresh native instance. Local playback is restored; persistent attempt metadata, cancellation, and background/interruption policy remain unfinished.
- Results play a newly captured local recording without substituting the TTS transcript. The synthetic transcript/player remains a separate labelled preview. Deck-backed metadata can be passed to the existing upload client, but the backend still returns 501 and live results remain unimplemented.
- The [mobile transcription client](mobile-transcription.md) now implements requests and cancellable polling with mocked tests on `feature/transcription-client-and-playback`. The recorder/result-screen handoff is restored in this branch; native upload and live backend integration remain unverified.
- Feature API routes return HTTP 501. Implement real storage/processing instead of fake success responses.
- The Celery task, PDF, and feedback adapters still raise `NotImplementedError`. The [Whisper adapter](whisper-transcription.md) is implemented with mocked-provider tests; a live synthetic TTS check passed; human-recorded speech verification is pending. The standalone [word alignment function](word-alignment.md) is implemented and tested on `feature/whisper-alignment`; its proposed output needs integration review before worker wiring.

## Shared rules

Follow `api-contract.md`: zero-based slide indexes, integer milliseconds relative to actual captured audio, and a new attempt ID for every new recording. Processing retries preserve the ID/audio. Keep every repeated/backward slide visit. The PDF owner supplies images/text for feedback. The recording and Whisper owners agree on the capture-start signal and time base before integration.

Coordinate shared model/migration changes. Keep provider credentials on the backend. Evaluate real recordings before claiming filler/repetition/false-start detection. Saved-attempt browsing, selected-slide retries, and comparisons belong to later iteration UI; this scaffold retains the data identities needed for them.

Start new work from updated, post-revert `main`; review feature branches separately before any merge. Follow the team's review/testing agreement before pushing. Include commands, device evidence and limitations in each PR. Integrate on an Android device; the submitted plan names Galaxy S22/S23.

## PDF and recording integration after separate review

Both recovery branches start independently at `f6f6e76`. This recording branch uses the sample viewer and has no native PDF dependency. When the separately reviewed PDF work is combined later, reconcile `ViewerScreen.tsx` and `RehearsalScreen.tsx` explicitly: preserve PDF URI/title/current-page handoff and actual page count; feed native `onPageChanged(page - 1)` into the recording screen's `acceptSlide`; capture when the page becomes visible rather than when a navigation button is pressed; disable native swipe/buttons while capture is starting or stopping. Retain the recording branch's stop/error guards and local-result handoff. PR #5 commit `c609514` contains the original joint implementation for comparison. Review and test repeated/backward PDF visits and transition boundaries together before claiming integrated behavior. This task does not merge these branches or change main.
