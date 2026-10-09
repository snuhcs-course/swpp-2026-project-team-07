# Iteration 1 demo: setup and walkthrough

This is the setup for branch `iteration-1-demo`. Use this branch for both the app
and backend so the recorded features can be reproduced. The [demo video](demo/iteration-1-demo.mp4) is the user's screen recording of the
real Android app on a Galaxy S23 Ultra. It runs for 6 minutes 42 seconds and has
no added captions. The repository copy preserves every video frame timestamp and
the original AAC audio payload; the original file is retained outside Git.
Use the included [seven-slide PDF](demo/Neural_Networks_7_Slides.pdf) to reproduce
the main rehearsal.

## 1. Get the exact branch

```sh
git clone --branch iteration-1-demo --single-branch https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07
```

The branch contains the UI and the dependencies through `ce9f248` (PDF capture,
durable storage/upload, hosted Whisper, synchronized review and AI feedback).
No separate cherry-picks or PR merges are needed.

## 2. Start the backend

Install Docker with Docker Compose. From the repository root:

```sh
cp backend/.env.example backend/.env
```

Edit the ignored `backend/.env` locally:

- Set `OPENAI_API_KEY` for hosted `whisper-1` transcription.
- For the demonstrated OpenAI coaching, set `FEEDBACK_ENABLED=true`,
  `FEEDBACK_PROVIDER=openai`, `FEEDBACK_OPENAI_MODEL=gpt-6-luna`, and
  `FEEDBACK_OPENAI_PROJECT_ID` to the project used by that key.
- Set positive `FEEDBACK_OPENAI_RPM` and `FEEDBACK_OPENAI_TPM` application allowances
  suitable for that project. Feedback admission reserves request UTF-8 bytes plus
  the output allowance, so this TPM field is not an exact provider-token count.
  `FEEDBACK_OPENAI_DAILY_REQUEST_LIMIT` is optional. Provider account limits still
  apply. No keys belong in mobile settings or Git.

Keep the other local development values from the example, then run:

```sh
docker compose up --build
```

Keep it running. In a second terminal at the repository root:

```sh
curl --fail http://127.0.0.1:8000/api/health/
curl --fail http://127.0.0.1:8000/api/ready/
docker compose exec worker celery -A config inspect ping
```

The first start installs Python dependencies and applies database migrations.
The API, worker, scheduler, PostgreSQL and Redis must all run for processing.
Health/readiness alone do not prove the worker is running; check the ping too.
Docker stores database and media in named volumes. Do not remove those volumes
when restarting a demo that should retain recordings.

PDF import, recording and local replay do not need provider keys. Real speech
transcription and coaching require the configured providers; a missing key or
failed request must remain visible as a failure, never substituted with samples.
AI outputs can differ on another run. The same interaction is reproducible, not
identical wording from a nondeterministic provider.

## 3. Build and open the app on a physical Android phone

Install Node.js 24 LTS, npm, Android Studio, JDK 17 and Android SDK
Platform 36. Select JDK 17 for Gradle. Enable USB debugging on the phone, connect it
and accept its authorization prompt. The device must appear as `device`, not
`unauthorized`, in `adb devices`.

From the repository root:

```sh
cd mobile
npm ci
cp .env.example .env
```

Set the ignored `mobile/.env` to:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api
EXPO_PUBLIC_UI_LAYOUT=refactor
```

With Android platform-tools on PATH:

```sh
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081
npm run android -- --device
```

Select the physical phone when prompted. This builds/installs the development
client and starts Metro. Keep the phone connected and Metro running. For later
runs use `npm start`; repeat the reverse commands after a USB reconnection. If
Metro uses another port, forward that port instead. Restart Metro after changing
`.env`. When several devices are attached, add `-s YOUR_DEVICE_SERIAL` to adb
commands to target the phone.

This app uses native PDF, SQLite and audio modules and requires its Android
development build; Expo Go cannot run the full flow. Generated `mobile/android/`
and installed dependencies are intentionally not in Git. Configure changes via
`app.json` and regenerate using `npm run prebuild:android` when needed.

On macOS, if Android or Java tools are not on PATH:

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

On the phone open Home → Help → Check connection. If the API cannot be reached,
check USB authorization/port forwarding and the running API before recording.

## 4. Simple feature walkthrough

Use the included seven-slide PDF, or another short, non-confidential PDF. Current
limits are 20 MiB per PDF, ten slides and ten minutes per recording. This extended
walkthrough includes optional features that are not all shown in the submitted
video; see its actual coverage below:

1. Import the PDF on Home and navigate its pages.
2. Enter an audience, such as “students new to this topic”, and open rehearsal.
3. Start recording, speak for 20–30 seconds and visit slides 1 → 2 → 1 → 3.
4. Stop. Show the saved attempt opening review and the upload/transcription state.
   First-use transcription requires Continue on its disclosure. The PDF/audio
   upload precedes that provider consent; Cancel leaves the server upload saved.
5. In Overview and Slides, show duration, available speaking-rate estimates,
   chronological visits and total time per slide, including the repeated visit.
6. In Transcript, press Play, switch panels, tap a timed word and select a visit.
   Word/evidence taps seek while preserving play/pause intent; they do not promise
   playback bounded to the end of an evidence interval.
7. Choose Generate feedback, accept its separate disclosure, and show an actual
   returned suggestion, supporting quotes and Review evidence. It seeks to the
   linked slide/time. Generation can take time; do not relabel old results as new.
8. Open a saved slide description, make a small correction and Save. Show that
   affected feedback becomes stale. Regenerate explicitly if demonstrating the
   refreshed result; this reuses the transcript.
9. Return to Practice, show attempts grouped by presentation, and reopen this
   saved attempt. Ordinary browsing and playback do not generate new coaching.

A deliberately different number in speech and the slide can make feedback easy
to inspect (e.g. the slide says 20%, speech says 50%). This is demonstration
material, not proof of model accuracy. Speak clearly and verify the actual result.
If prerecorded/synthetic material is used instead, identify it in the app's deck
title and the recording notes; do not present it as a fresh human speech run.

## 5. Reproduction checks and scope

```sh
cd mobile
npm run check
npm run bundle:android
```

From the repository root with Compose running:

```sh
docker compose exec api python manage.py check --settings=config.test_settings
docker compose exec api python manage.py test --settings=config.test_settings
docker compose exec api python manage.py makemigrations --check --dry-run --settings=config.test_settings
```

SQLite tests skip PostgreSQL-specific checks. For actual database/worker
integration use the running Compose services and the phone flow above. Exporting
JavaScript is not evidence of a native APK build or microphone/playback quality.

Included: PDF import/navigation; audience input; audio recording with repeated
slide visits; durable saving/upload; hosted transcription; synchronized review;
slide timing and whole-rehearsal rate estimates; grouped history and media/analysis
recovery; explicit AI coaching, evidence seeking, description editing and staleness.

Not implemented in this snapshot: selected-slide retry selection, attempt A/B
comparison, spoken key-idea summaries, filler/pause flags, per-slide pace and full
attempt/deck-data deletion. The existing Remove PDF action only removes a local
library PDF. Do not imply these later features are shown in the video.

## Record video with voice

Use the Samsung phone’s built-in Screen recorder with **Media sounds and mic**.
The Android Studio/ADB display recorder does not offer an audio option on the
checked device. Before the full take, record a ten-second test while also recording
inside OutLoud. Listen to both the resulting screen video and saved rehearsal;
concurrent microphone capture must not be assumed to work. Confirm both contain
the voice before continuing. If one is silent, stop and choose another audio
capture approach rather than submitting a silent demonstration.

Screen recording instructions: [Samsung support](https://www.samsung.com/us/support/answer/ANS10001616/).
For a new take, use no added captions. Keep setup screens outside the final take.

## Recording and verification record

- Source: `iteration-1-demo`, functional base `ce9f248`, reviewed Refactor Design UI.
- Capture device: physical Galaxy S23 Ultra (SM-S918N).
- Video: [iteration-1-demo.mp4](demo/iteration-1-demo.mp4), 401.876 seconds,
  720 × 1544 H.264 video with the original AAC audio; 46,755,345 bytes
  (44.59 MiB).
- Original supplied file: `Screen_Recording_20261009_235818_OutLoud.mp4`,
  1080 × 2316, 106,093,952 bytes. It was not modified or added to Git.
- Original SHA-256: `b417462c4385b2f35530201b493fe25ea2558bceb1af4c208f69d560dec8f905`.
- Repository video SHA-256: `2d59cd6dd9db669cef0f0a68301316527fbd96ef549a468787b419e625919551`.
- Media verification: decoded all 18,448 original and packaged video frames;
  counts and timestamps match, as does total duration. All 18,820 AAC
  packet payloads match by SHA-256 after packaging. Inspected 51 timeline samples
  and selected packaged frames for legibility. A 16-second audio sample during
  the new rehearsal contains a nonzero signal; no listening assessment of voice
  clarity, microphone contention, or audible synchronization was performed.
- Visible coverage: PDF selection/preview and audience entry; a new 1:16 rehearsal
  with repeated/backward slide visits; completed transcription and speaking rate;
  per-slide ranges/totals; playback, visit and word seeking; feedback requested and
  later shown as completed; supporting quotes and evidence seeking; a second short
  attempt; grouped Practice history. These are observations from the user's video,
  not a separate agent-operated device test or provider-accuracy evaluation.
- The opening minute browses an older silent Guatemala attempt. The new
  neural-networks recording starts around 1:50 and its transcript appears around
  3:10. Description editing/regeneration, offline downloads and failure recovery
  are not demonstrated in this video.
- Sample PDF: seven pages, 373,170 bytes, text/page count checked and all pages
  visually reviewed. This is demonstration material, not measured research.
- Mobile checks: 300 tests, TypeScript, lint/layout-boundary audit and Android
  export passed on this snapshot on 2026-10-09 (Asia/Seoul).
- Backend checks: system check, 277 SQLite tests (18 PostgreSQL-only skips), and
  migration-drift check passed on the same source using the existing project
  Python environment. A fresh Docker build is not yet claimed by these results.
- Independent AI review found no concrete introduced code defect in the copied
  UI snapshot. Human review and new physical demo evidence are recorded separately
  in [AI-use](ai-use.md).
