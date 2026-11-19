# Incremental feedback: Android phone test

The shared demo uses the Azure backend and standalone v10 APK. It makes real
Scribe and configured feedback-provider calls. Use an ordinary, nonprivate deck
and test speech. Automated fixtures are separate from this physical-phone test.

## Azure setup (no computer required)

1. Download the APK from the [v10 release](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v10-20261115).
   Install it as an update; keep the existing app installed to preserve local takes.
   This standalone, non-debuggable demo retains the team's development signing key.
2. Connect the phone to Wi-Fi or mobile data. The APK uses
   `https://outloud-team07.koreacentral.cloudapp.azure.com/api` and does not need
   Metro, USB forwarding or a running laptop. Enter the existing private reviewer
   code when prompted; obtain it separately from the team operator.
3. Open OutLoud, import/select the test deck and allow microphone access. The slide
   counter shows **Live feedback**; tap it before starting to switch modes. Accept
   the live upload disclosure. Confirm the recording screen offers **Feedback**
   after Start; otherwise this take used the after-Stop fallback.
4. For agent-operated checks, USB can be used to install and inspect the app, but
   `adb reverse --list` must be empty. Feedback traffic must use the public address
   through the phone's own connection. Record this separately from USB control.

### Local development alternative

Follow [local development](../README.md#quick-start) to start PostgreSQL, Redis,
Django, a Celery worker and Beat. Apply migration 0013. Put `ELEVENLABS_API_KEY` and
`OPENROUTER_API_KEY` only in ignored `backend/.env`; enable `FEEDBACK_V3_ENABLED`,
`FEEDBACK_V3_AUTO_START` and `INCREMENTAL_CAPTURE_ENABLED` on all three services.
Rebuild with the chosen local `EXPO_PUBLIC_API_URL`; the v10 release always uses
Azure. A localhost development APK needs `adb reverse tcp:8000 tcp:8000` and its
Mac backend. Do not put provider credentials or the reviewer code in the APK.

## One continuous take, with a revisit

| Action | Expected result / evidence |
| --- | --- |
| On slide 1, start and speak continuously for 20–30 seconds. Say “first visit to slide one” near the beginning. | The timer and microphone meter advance. Full audio remains local. |
| While speaking a counted sequence, advance to slide 2. Continue for 30–60 seconds. | The timer never resets. Slide 1's segment uploads/transcribes; no microphone restart is required. |
| Open Feedback while still recording. | Recording and the timer continue. Slide 1 feedback appears before Stop; slide 2 is marked recording/pending. Note elapsed time and take a screenshot when advice first appears. |
| Close Feedback, rotate to landscape, then open its Feedback control. | Recording continues across layout changes. Closing the panel returns to the same take. |
| Return to slide 1 and say “second visit to slide one” plus new content for 20 seconds. | Earlier speech stays intact. Previous slide 1 advice is provisional while this visit is unfinished; it is not presented as the current score. |
| Advance to slide 3 and continue speaking. | Once every slide 1 segment is transcribed, its assessment updates. Slide 2's unchanged assessment is reused. |
| Stay on one slide beyond 60 seconds. | Internal file rotation does not interrupt capture or assess the still-active visit as finished. |
| Stop. | Final segment and full playback WAV upload. Full Review opens immediately with existing feedback and progress for unfinished parts. Whole feedback waits for all segments and the full audio. |

Play the saved recording end to end. Listen across every transition and the
60-second boundary for lost/duplicated counts, gaps or restarted audio. Both visits
to slide 1 must be audible and appear in speaking order. Transcript timestamps must
remain within the full recording and retain zero-based source slide references.
Sentence splits at transitions are expected in this version; no overlap is added.

## Failed upload while the microphone keeps running

1. Start a fresh online take. Finish slide 1 and leave its feedback visible.
2. On the Azure APK, disable both Wi-Fi and mobile data on this phone. Keep talking
   and visit slide 2, slide 1 again, and slide 3. For a localhost development APK,
   stop only its isolated Django API instead; airplane mode does not break USB forwarding.
3. Verify the timer/meter keep moving, the pending segment count grows, earlier
   feedback remains visible, and the UI reports retained audio/retry progress.
4. Restore the phone’s internet connection while still presenting (or restart the
   isolated local API). Pending uploads should resume with the same attempt ID and
   segment sequence. New feedback must arrive before Stop. A Retry button is also available.
5. Stop while one upload is pending. Relaunch the app after the recording is saved.
   The outbox must finish without a new attempt, lost audio or a full Scribe call.
6. If testing a provider failure separately, use an isolated test backend or a
   controlled provider rejection. A known failure has Retry; an uncertain submitted
   request asks for acknowledgement of a possible second charge. Network upload
   retries alone must never duplicate provider calls.

## After-Stop fallback

Tap the slide counter to select **After Stop** before starting another take, or start with the
incremental capability disabled/unreachable. Verify the original recorder saves
playable audio and the existing after-Stop upload/transcription/feedback flow still
works. An already incremental take must keep its segment mode through outages.

## Evidence and pass conditions

Record Android model/version, APK hash, backend revision/configuration (no keys),
attempt IDs, first-feedback time, Stop time and observed results. With the backend
capture response, check:

- Segment sequence is contiguous; intervals have no gaps/overlap. Revisited slide
  references repeat without overwriting earlier segments.
- A completed slide assessment exists while `stopped:false`; a visited active slide
  is provisional. Whole feedback is pending until all final inputs are ready.
- Exactly one accepted Scribe result exists per speech segment (except a deliberately
  acknowledged uncertain retry); detected silent segments require no provider call.
  No whole-audio transcription occurs.
- Assessment work rows reuse unchanged input hashes; revisits only regenerate the
  affected slide and Stop adds the whole-presentation call.
- Full playback PCM equals concatenated segment PCM, and playback remains continuous.

A passing JavaScript bundle, APK build, mocked provider test or JVM file test does
not establish physical microphone continuity or real AI latency. Mark those phone
observations separately from automated checks.

## Executed check — November 15, 2026

Agent-operated checks on a Samsung SM-S918N running Android 16 passed continuous
capture, mid-speech transitions, return visits, feedback before Stop, API outage
and upload recovery, landscape controls, and the original after-Stop M4A path.
The main 6:58 take retained nine contiguous segments with byte-identical full
playback audio. A final 42-second take on the local ARM64 APK retained all 107 words
across four visits; full playback and visit skipping followed their original order.
These used generated test speech through the phone microphone
and real Scribe/OpenRouter calls; they are not human usability or rubric-quality
acceptance. See the [task evidence in the active collaboration log](ai-collaboration-prompts-iteration-2.md#continuous-per-slide-transcription-and-feedback--november-15-2026)
for attempt IDs, provider counts, checks and APK identity.


### Shared Azure v9 follow-up

The actual Azure image passed the 710-test backend suite (27 expected SQLite skips).
A real public HTTPS smoke returned slide feedback after 10.663 seconds while still
active and whole feedback 16.384 seconds after Stop, using exactly two Scribe and
three feedback calls. Duplicate uploads reused results; timestamps, full PCM binding
and authenticated playback download passed. This used synthetic prerecorded speech.

The universal v9 APK installed successfully on the same Samsung phone and opened
with its saved reviewer code. Public PDF import and Live feedback mode worked with
no USB forwarding and the Mac API stopped. The user then asked to stop audio tests
because they were wearing earbuds. Recording and playback were stopped immediately;
the v9 phone recording/outage/finalization test is **interrupted, not passed**.
The earlier local APK checks above remain distinct evidence. The user subsequently
reauthorized audio tests; the resumed check is recorded below and in the active log.


### Resumed Azure phone check

After the user reauthorized audio testing, the installed v9 APK completed the
previously interrupted check on the same Samsung phone, with no USB forwarding
and the local Mac API stopped. Attempt `c774d83a-0c26-473e-8773-94e41ecfe472`
recorded 409,320 ms across four slide visits (1 → 2 → 1 → 2) and nine contiguous
segments. Slide feedback appeared before Stop; revisiting slide 1 withheld its
current score until the new speech was ready, then updated its advice.

Disabling Wi-Fi and mobile data left no active Android network. Recording
continued, uploads queued locally, and restoring connectivity completed them
without tapping Retry. A second outage at Stop followed by an offline app restart
also retained the same attempt and uploaded its remaining audio after reconnecting.
The full PCM exactly matched all nine segments; all 214 assembled transcript
words had valid timestamps. Five speech segments each had one accepted Scribe
result; four silent segments made no Scribe call. The two slide assessments plus
one revisit update and one whole-presentation assessment each made one model call.
No full-audio transcription or unchanged-slide reassessment occurred. Playback
crossed the first transition and skipped to both later visits in speaking order.
This is an agent-operated synthetic-speech check, not human scoring-quality
acceptance. The microphone and playback were stopped afterward.

Separately, Recover recording finalized the earlier interrupted attempt
`9a29bb6c-cc8d-41b0-8477-77949c9e55bc` with the same identity and matching full PCM.
Its mostly silent audio is recovery evidence only.

The follow-up v10 source also repairs the failed automated checks: 669 mobile tests
and 710 PostgreSQL backend tests pass with zero skips, alongside typecheck, lint,
Django checks and migration consistency. Cue retry controls, Q&A tap/TTS behavior,
legacy Review pending/failure messages and Unicode audience input were corrected.
An independent AI review found and resolved cue-control overlap and passed its
focused checks. The updated APK was then installed and checked on the phone as recorded below.


### Final v10 phone checks

The universal v10 update installed successfully without deleting local decks or
recordings, and no USB reverse mapping was used. The After Stop fallback completed
attempt `3aa04a86-8d2f-4da8-88a1-347e456b7696`: 41,814 ms M4A, 107 transcript words,
one whole-audio Scribe request and three completed feedback calls, with no
incremental capture session.

A fresh live take, `1f2c57f5-ce0b-4fc8-9a12-6819b8ebeb5d`, completed at 45,900 ms.
Slide 1 feedback appeared while the microphone continued and the server reported
`stopped:false`. Its two segments retained 108 words with valid timestamps and
byte-identical full PCM. Two segment Scribe calls and three feedback calls
(two slides plus whole presentation) completed; whole-audio Scribe requests
remained zero. The final Overview showed both slide scores and whole feedback.

The corrected Q&A Next/Back controls responded to taps; tapping an automatically
spoken question stopped it. The cue sheet displayed its complete offline message
and a reachable Refresh action while retaining cached cues. Source regressions
cover the other pending/legacy Review and Unicode input cases; this is not a claim
of human usability or semantic scoring acceptance.

The final v10 full-audio player advanced past the slide boundary. The later
screenshot showed Feedback, so it does not establish an observed playback-end
event; full-audio completeness is established separately by the PCM comparison. The app and microphone were stopped after testing; Wi-Fi and
mobile data were restored and USB reverse mappings stayed empty. The release's
GitHub asset hashes match the installed APK and companion verification files.
