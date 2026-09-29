# Mobile transcription client

This increment implements mobile requests independently of microphone capture.
The app's result screen displays the saved Whisper TTS transcript with explicit preview controls. The server feature
routes still return HTTP 501, and no real mobile upload is claimed yet.

## Entry point

`mobile/src/features/transcription/service.ts` exports `transcriptionService`.
It uses the existing `EXPO_PUBLIC_API_URL` setting, Expo File, and Expo fetch.
The provider key stays on the backend. No new library dependency is added.
The pure request logic is in `client.ts`, tested with injected files and HTTP responses.

- `submit(recording, {signal?})`: accepts the existing `LocalRecording` contract;
  uploads multipart `audio` and a JSON `metadata` string, then requests processing.
  It expects HTTP 201 and 202 with the same attempt ID. It does not return a transcript.
- `getResult(attemptId, {signal?})`: fetches and validates one `AttemptResult`.
- `retry(attemptId, {signal?})`: requests processing again for an already uploaded
  attempt. It does not re-upload the file or allocate another ID.
- `waitForResult(attemptId, {signal?, intervalMs?, maxAttempts?})`: polls sequentially
  until completed or failed. Defaults: 2-second interval, at most 60 requests.
  Each HTTP request has a 60-second timeout, including response-body parsing.
  This is an attempt bound, not a strict two-minute total deadline.

Use an AbortController when integrating the screen and abort on navigation/unmount.
A local cancellation or poll limit stops observation only; it does not cancel a
server job or mark the server attempt failed. Failed server attempts are returned
as data so the screen can show the error and offer an explicit retry.

## Failure and ownership rules

`TranscriptionClientError` includes `code`, `attemptId`, and optional HTTP `status`.
It distinguishes invalid local input/audio, invalid server data, HTTP failures
(including `not_implemented` for 501), connection failures, timeouts, cancellation,
and a polling limit. It never turns a network/HTTP failure into sample success.

The client never changes or deletes audio or recording metadata and performs no
automatic upload/processing retries. After a connection failure, the server might
already have accepted the request. Retain the same attempt ID; reconcile via
`getResult` before deciding whether upload or processing needs retry. If upload
succeeded but processing failed, use `retry` on that same ID.

The recorder supplies a durable local `file://` or `content://` URI and a filename
with a supported container suffix (mp3/mp4/mpeg/mpga/m4a/wav/webm). The client
preserves that name rather than assuming every recording is M4A. It checks nonempty
size up to 25,000,000 bytes and the basic metadata timeline. Actual codec validity,
known deck/page bounds, persistence and duplicate-request protection are server duties.

## Validation

From `mobile/`:

```sh
npm test
npm run check
npm run bundle:android
```

`npm run check` now includes the Node built-in test runner, so existing CI runs
these tests as well. Use the repository's Node 24 version. Tests use synthetic
File objects and mocked HTTP, not microphone files, native device IO or provider calls.
Covered behavior includes multipart data, upload/process order, backward slide
visits, matching IDs, 501, failed processing/retry, polling termination/limit,
malformed results, network failure, cancellation, timeout and invalid inputs.

Expo integration references: [Expo SDK 57 fetch](https://docs.expo.dev/versions/v57.0.0/sdk/expo/)
and the installed SDK's `expo-file-system` File types. The versioned filesystem
web page was unavailable during this task; local installed API/type checks passed.

## Next integration steps

1. The recorder hands off `LocalRecording` when implemented; this service can be
   tested independently in the meantime.
2. Connect the result screen to the service with explicit loading/error/retry state.
3. Align the result contract for slide-specific display: current AttemptResult has
   words but neither aligned visits nor slide_events/duration. Do not invent a new
   server response or treat hand-written demo content as real alignment output.
4. When the server endpoints are implemented, verify native multipart file transfer
   on Android, then the complete real recording → upload → result flow.

## Audio-follow transcript screen (2026-09-29)

ResultsScreen combines a fixed audio player with a flowing transcript. Highlighting
uses the native player's actual position and Whisper word intervals; tapping a word
seeks to its start. Pause, replay and Back 5s share that position. Gaps and zero-length
intervals are not artificially stretched. Original punctuation/spacing is preserved.

The saved fixture contains only text and 38 word timestamps from the previously
verified synthetic Korean TTS result. Select its matching local `whisper-test.m4a`
through the Android picker. Filename and approximate duration checks reject obvious
mismatches; they do not establish file identity. Audio/script/raw JSON remain ignored,
and teammates need their own copy of this test audio. Nothing is uploaded.

Processing/failure/retry previews remain under the collapsed Preview other states
control. They simulate states locally and make no server/provider call. Leaving the
screen pauses playback. Pending replay seeks cannot restart after navigation or a
new source selection. Live recording, server-result wiring and slide-specific display
remain pending. Automatic transcript scrolling is not implemented.

To inspect on Android, use Open sample slides → Preview rehearsal → Preview
transcript and feedback:

1. Choose test audio → Downloads → whisper-test.m4a.
2. Press Play: the position and highlighted word follow native playback.
3. Press Pause: position and highlight stop. Press Play to continue.
4. Tap a transcript word: the audio position jumps to that word's start.
5. Use Back 5s or Replay after the end to revisit the recording.
6. Expand Preview other states to inspect simulated waiting/failure/retry.

Codex verified local file selection, native position progression, pause and tapping
안녕하세요 to seek back to 0:00 on Android 36 with the existing development APK and
current Metro bundle. At about 0:05, 소개하겠습니다 was highlighted. The emulator
was launched without audio output, so audible timing accuracy was not measured.
This is agent-operated emulator evidence, not human approval or native upload evidence.
Typecheck, 21 unit tests and Android JS export passed; lint reported no errors and
one ref-cleanup warning. Independent AI review's replay race finding was fixed and
re-reviewed without additional material findings.

References: [Expo SDK 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
and [document picker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/).

## Human review and deferred UI refinement (2026-09-29)

Source: direct user feedback received 2026-09-29. The user inspected the staged
changes and reported no apparent functional issue, but considers the current
transcript UI unsatisfactory. Visual refinement is confirmed follow-up work;
this screen is a functional preview, not an approved final design. Preserve
playback-synchronized highlighting and word seeking during that later redesign.
The local branch is now `feature/transcription-client-and-playback`, reflecting
both request-client code and the playback UI. No live server integration is implied.
