# PR #5 historical AI-use records

Preserved on 2026-10-07 from merge commit `c6095141d182e4d5aa30b0d2e1c7d1eb5d311696` before reverting PR #5. These are the original records added by that PR, not claims about the restored baseline or new verification.

## 2026-10-04 — On-device PDF import and slide viewer

- Contributor: Teammate A (requester); OpenAI Codex assisted with implementation.
- Tool: OpenAI Codex, using the Expo SDK 57 docs and project instructions.
- Task and scope: Implement an offline-first Android PDF import flow that stores
  selected PDFs on the device and displays their pages one at a time, on a local
  feature branch based on `origin/main`.
- Representative request (summarized): Keep the PDF on the device rather than
  server-side; implement import and slide-by-slide viewing before uploading the
  branch.
- Generated work and incorporation: Updated the mobile PDF service, library and
  viewer screens, Android app config and dependency lock for `react-native-pdf`,
  `react-native-blob-util` and Expo config plugins. PDFs are copied into app-private
  storage with a local catalog; they are not uploaded. Updated README scope notes.
- Verification by Codex: TypeScript check and Expo lint passed; all 21 existing
  mobile tests passed; Android JavaScript export passed; Expo Android prebuild
  passed and the generated manifest removes the renderer plugin's unnecessary
  legacy external-storage/download permissions. No Android Gradle build or device
  test was possible because this machine has no Android SDK/ADB and is using Java
  21 instead of the JDK 17 required by the project setup.
- Human review/corrections: Pending. No independent code review, commit, push, or
  PR is claimed.
- Limitations: The viewer renders pages from the original local PDF; the API
  contract's server-generated slide images and extracted text are not implemented
  by this local-only step. Native Android rendering requires a rebuilt development
  app; Expo Go cannot load the native module.
- Related branch: `feature/pdf-viewer`, based on `origin/main`.

### Physical Android and final-check follow-up — 2026-10-04

- Codex subsequently ran `npm run check`: TypeScript passed, lint had zero errors
  and one existing transcription-screen warning, and all 21 existing tests passed.
  `git diff --check` passed.
- Codex built and opened the Documents `feature/pdf-viewer` app on the connected
  Samsung SM-S901N using `npx expo run:android --port 8082`; Gradle reported
  `BUILD SUCCESSFUL`. The alternate port kept the Desktop integration clone's
  Metro server from serving the wrong source tree.
- Device check: reimported a 14-page PDF from the phone's Downloads folder, saw
  its rendered first page and 1/14 counter, swiped to page 2, and used the PDF
  viewer's Next control to advance. **Preview rehearsal** opened the same PDF at
  page 1 and showed the practice page counter/navigation controls. The practice
  Next control itself, recording, cancellation, invalid-file handling, backend
  preparation, and AI flow were not verified on device.
- During coordinate-based screen testing, Codex accidentally tapped Remove
  instead of Open once. This removed only the app-private copy; the source PDF
  remained in Downloads and was reimported successfully. No original file was
  lost. This is recorded as an agent-operated mistake and recovery.
- Human review remains pending. No commit or push had been made at the time of
  this entry. Backend-generated slide images/text and real recording remain
  outside this local-only PDF step.


## 2026-09-30 — Mobile recording timeline and local preview

- Contributor: Injoon (requester); OpenAI Codex implemented the scoped mobile
  recording, timeline, local-preview, and existing-client handoff changes.
- Tool: OpenAI Codex, using the Expo SDK 57 `expo-audio` documentation and a
  separate Codex reviewer before commit.
- Representative request (summary): Implement recording with the recorder's
  audio-relative slide-change timestamps; save the local recording for preview;
  then pass a deck-backed recording to the existing transcription client while
  keeping fixture/debug UI clearly labelled.
- Generated work and incorporation: Updated `features/recording/service.ts`
  and `RehearsalScreen.tsx` to request microphone permission, configure audio,
  capture with `RecordingPresets.HIGH_QUALITY` in the document directory, drive
  the timer from native recorder state, preserve the final duration and slide
  events, and form `LocalRecording` when a real deck ID is available. Updated
  `features/pdf/ViewerScreen.tsx` to forward that optional deck ID and
  `features/transcription/ResultsScreen.tsx` to preview local audio/timeline,
  submit through the existing client, and label fixture/debug-only portions.
  No backend, API contract, dependencies, app configuration, generated Android
  files, or navigation route definitions were changed.
- Verification by Codex: `npm run check` passed (TypeScript, Expo lint, and 21
  Node tests); `npm run bundle:android` passed; and `git diff --check` passed.
  These are local automated checks. Earlier user testing confirmed recording and
  slide-timeline capture; no new device capture/upload run was performed for the
  final committed snapshot.
- Human review/corrections: The requester iteratively tested and reported the
  initial permission/timer/stop issues, then confirmed that recording and the
  slide timeline work. An independent Codex reviewer found three staged
  lifecycle defects: a stale duration poll could leak an earlier recording's
  duration, Preview could navigate away during capture, and a failed stop could
  leave a non-functional Stop control. Codex fixed them, reran the mobile checks,
  and the reviewer rechecked the final staged diff with no new actionable finding.
- Limitations: A sample deck has no persisted deck ID, so its recordings remain
  local and make no HTTP request. The current backend attempt endpoints still
  determine live upload/processing availability. Route-serialized recording and
  timeline data and the raw timeline card are explicitly temporary debugging
  handoffs; durable attempt storage and real transcript/feedback rendering are
  follow-up work. Native Android permission, capture, upload, and result display
  are not established by the static checks.
- Related commit: local commit on `feature/recording-tracking`; PR pending.

## 2026-10-04 — Existing feature branch integration

- Tool: Codex, with an independent reviewer agent; no human review is claimed.
- Request: review and merge the teammates' `feature/` branches; leave missing portions for subsequent implementation.
- Inputs: `main` at `7af66ab` already included Whisper/alignment (`e71c3e0`) and transcription/playback (`92e542e`). Combined PDF viewer (`9547f1d`) and recording (`04857fb`) on `feature/prototype-integration`.
- Incorporated changes: reconciled the shared viewer/rehearsal screens; real PDF page callbacks capture slide visits, actual page count replaces the sample limit, current page passes into rehearsal, and navigation is disabled during recording start/stop. Preserved separate local-recording playback and synthetic-transcript preview. Fixed Android duration reset on stop by freezing/capturing native audio duration before stop; added two regression tests. Updated README scope.
- Verification: `npm run check` passed (TypeScript, lint, 23 mobile tests); `npm run bundle:android` passed. Backend tests passed (23), system check passed, migration drift check found no changes. Provider calls were mocked. No connected Android device was available, so native PDF/microphone behavior and APK compatibility remain unverified in this integration session.
- Independent review identified the overlapping PDF timeline and local playback handoff; final staged changes were reviewed again after resolution. Review also identified unfinished interruption/back-navigation handling and concurrent PDF catalog mutations. Those remain follow-ups under the user's explicit merge-existing-work scope.
- Remaining implementation: backend deck/attempt endpoints and PDF preparation, worker orchestration, Gemini feedback, live result rendering, durable recording metadata, cancellation/interruption policy, and device validation. No end-to-end AI completion is claimed.
