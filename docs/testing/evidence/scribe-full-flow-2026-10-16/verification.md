# Recording-flow verification — October 16, 2026

Agent-operated checks on `codex/scribe-v2-transcription`, implementation commit
`2740d7c`. User follow-up explicitly requires continued emulator testing; the phone
was not used during those emulator attempts. The user later chose the phone.
**Phone recording → upload → Scribe v2 → on-phone transcript now passes for one
16.83-second take**, as recorded below. Emulator speech capture remains blocked.
No app behavior was changed to force a passing result.

## Confirmed live backend path

A real HTTP upload of the first 45 seconds of the previously evaluated
[EdUHK classroom presentation 5](https://corpus.eduhk.hk/english_speaking/index.php/classroom-presentation-5/)
completed through the actual local PostgreSQL/Redis/Celery/Silero/Scribe pipeline.
This was a backend-only precheck, not microphone capture by the mobile app.

Attempt `d777ca36-ee91-42f6-a36b-f98558e4d025` has exactly one durable provider
request: `elevenlabs / scribe_v2`, received successfully, with a private Scribe
transcription ID. The input hash matches the uploaded audio. It returned 91 timed
words. All six `um`/`uh` tokens survive raw response, normalization, slide alignment
and the actual mobile `parseResult` function:

| Token | Start (ms) | End (ms) |
| --- | ---: | ---: |
| Um, | 10760 | 10960 |
| uh-- | 23020 | 23120 |
| uh, | 25260 | 25380 |
| uh, | 28560 | 28620 |
| Uh, | 32020 | 32159 |
| um, | 40240 | 40580 |

This is a preservation check, not reference-based filler recall or transcription
accuracy measurement. An initial punctuation filter missed `uh--`; the count was
corrected from five to six and verified against the raw receipt and mobile parser.
The app's existing keyword counter returns `um: 2, uh: 4, like: 1`. The `like` is
in “I would like to share,” demonstrating a contextual false positive. Scribe
recognition and the app's filler classifier are separate limitations.

## Native Android emulator attempts

A synthetic blank two-slide PDF was imported with the actual Android picker.
The agent used native record, slide change, stop/save, comparison and disclosure
controls. Host microphone access stayed disabled. The public speech excerpt was
fed through the installed emulator's authenticated `injectAudio` interface; no
recording file, server result or provider response was substituted.

- Premature injection before the native microphone stream opened crashed the
  emulator. Later attempts confirmed an active AudioFlinger recorder first.
  Private crash evidence was preserved; no external crash upload was performed.
- Attempt `3ffbb94b-3d1b-4956-99f0-2d58791c56d6`: native recording was saved, but
  metadata duration 75,620 ms differed from decoded audio 73,839 ms. HTTP upload
  correctly returned 400. Local media was retained; no provider call occurred.
- Attempt `d74947ac-8b03-4235-bb28-29696081fb25`: native recording/upload and the
  explicit ElevenLabs consent flow completed. Metadata duration 26,223 ms and
  decoded audio 26,053 ms agreed within the contract. Despite a successful
  20-second injection RPC, saved audio RMS was only 0.00000525 versus source RMS
  0.04465. The real speech gate correctly completed with `no_speech`, no transcript
  and zero provider requests. The app displayed that no speech was detected.
- Disabling `VirtioSndCard` tested legacy routing without wiping app data. Attempt
  `3572cd6d-9114-4872-99af-4dfa8caf5212` produced a strong non-speech signal,
  injection timed out after 90 seconds, and upload correctly failed the duration
  check (101,847 ms metadata versus 90,372 ms decoded). No provider request occurred.
  Default emulator audio configuration was restored afterward.

No duration validation, no-speech gate or provider identity check was bypassed.
Reliable emulator microphone injection remains blocked. The backend-only result
above is distinct from the later successful phone check below.

Safe structured metrics are in [results.json](results.json). Source recordings,
raw provider responses, app databases and screenshots remain private and
uncommitted. These checks do not establish human acceptance, Korean accuracy,
pause detection or production deployment readiness.

## Physical phone recovery and completed flow — later October 16

The user changed direction to their Samsung SM-S931N and made real recordings.
Recent takes failed because localhost:8000 was unreachable after the USB link
dropped. The agent inspected the saved failure metadata, restored USB forwarding
for 8081/8000 when the phone reconnected, and retried the latest take using the
actual app recovery control. The recording was preserved; no rerecording, local
DB mutation, substituted audio or API-result injection was used.

Attempt `d5f07df9-fdc0-475c-83a7-440df50eb2b5`, duration 16,830 ms, uploaded
successfully. The agent operated Start and the explicit ElevenLabs Continue
disclosure under the user's existing request to test Scribe transcription. The
real worker's Silero gate detected speech; exactly one durable request completed
with `elevenlabs / scribe_v2`, generation 1, outcome received. A private Scribe
transcription ID exists and the request input hash matches the stored recording.

The response contains 26 timed words aligned to three slide visits. Both raw and
normalized results retain `Uh,` (6,180–6,340 ms) and `Um,` (13,120–13,380 ms). The
actual phone SQLite analysis cache matches the server transcript exactly. The
agent inspected the app's slide-1 transcript displaying `Uh,`; the upload error
was cleared. Source media, full transcript, slides and screenshots stay private.

This verifies one real phone recording's save/retry/upload/consent/provider/
alignment/display/cache path. The user made the recording; the agent performed
the recovery and checks. Playback was not listened to, so acoustic transcription
accuracy, filler recall, pause detection and human acceptance are not claimed.
Keep the phone's USB data connection and Mac development services active for this
local build. No application code change was needed for the upload recovery.
