# OutLoud · Team 07

OutLoud is an Android presentation-rehearsal app that connects PDF slides,
recordings, slide-aligned transcripts and evidence-linked feedback.

- **Mobile:** Expo SDK 57, React Native 0.86 and TypeScript.
- **Backend:** Django REST Framework and Celery.
- **State:** SQLite on the device; PostgreSQL, Redis and shared media storage on
  the development backend.
- **Current iteration:** Iteration 2 (implementation and testing).

The complete documentation map is in the [documentation index](docs/README.md).

## Current implementation

The current branch contains the redesigned mobile UI and the integrated
recording/review pipeline:

- PDF import, local presentation storage and native slide rendering;
- microphone capture with recorder-clock slide changes and interrupted-capture
  recovery;
- saved attempts, per-slide take selection, keep/overwrite comparison and local
  playback;
- ElevenLabs Scribe v2 transcription with slide-derived vocabulary hints, slide
  visits and word-timed playback;
- cached slide cues and evidence-linked feedback through a configured backend
  provider;
- implemented Audience Q&A with generated deck-aware questions, recorded answers,
  transcription and answer feedback;
- confirmed recognition corrections that preserve original transcript/media;
- exact-sum per-slide timing for explicitly saved duration requirements; and
- retry, stale-result and partial-failure states that retain usable local data.

Feedback is disabled by default. AI output is advisory and still requires human
judgment. Automated checks and agent-operated device/provider checks do not establish
human usefulness, accessibility approval or complete physical-device acceptance.

## Quick start

### Prerequisites

- Node.js 24 LTS recommended (minimum 22.13), npm and Git.
- Android Studio, JDK 17, Android SDK Platform 36, and an emulator or
  USB-debug-enabled Android phone.
- Docker Desktop or another Docker Compose-compatible runtime.

Set both `JAVA_HOME` and Android Studio's Gradle JDK to JDK 17.

### Backend

From the repository root, preserve any existing environment file and copy the
example only for a new setup:

```sh
cp -n backend/.env.example backend/.env
docker compose up --build
```

The Compose stack starts PostgreSQL, Redis, Django, a Celery worker and recovery
scheduling. Check the API at `http://127.0.0.1:8000/api/health/` and readiness at
`http://127.0.0.1:8000/api/ready/`.

### Android

In a second terminal:

```sh
cd mobile
npm ci
cp -n .env.example .env
npm run android
```

Use a development client, not Expo Go. Native PDF rendering and SQLite require a
native build.

- **Android emulator:** `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api`
- **USB phone:** run `adb reverse tcp:8000 tcp:8000` and use
  `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api`
- For Metro over USB, also run `adb reverse tcp:8081 tcp:8081`.

Restart Metro after changing `.env`. Provider credentials belong only in the
ignored backend environment file; never place secrets in `EXPO_PUBLIC_*` values.

See the [local development guide](docs/development/local-development.md) for Android
Studio, Java, Docker, dependency and troubleshooting details.

## Main rehearsal flow

1. Import a PDF from Home and open its presentation card.
2. Record while navigating slides, then finish the recording.
3. With the backend available and disclosure accepted, upload and transcribe the
   saved attempt. Failed stages retain local playback and explicit retry controls.
4. Review one slide at a time. Tap transcript words or the transcript-heading control
   to play the corresponding selected recording.
5. Retake a slide and choose **Keep current** or **Overwrite** in Compare. The new
   take remains pending until the choice is made.
6. Review saved cues and feedback when the backend provider is enabled. Evidence
   links return to the corresponding slide and recording interval.
7. Open **Audience Q&A** to generate presentation-specific questions, record an
   answer, and review its transcript and provider feedback.

The [rehearsal review reference](docs/features/rehearsal-review.md) describes saved
media, recovery and playback behavior. The [API contract](docs/architecture/api-contract.md)
defines the shared client/server interfaces.

## Limits and configuration

- PDF upload: 50 MiB, with any positive slide count.
- New recording capture: up to 20 minutes; mono AAC at 64 kbps.
- Audio upload: at most 25,000,000 bytes.
- Hosted transcription: ElevenLabs `scribe_v2` after the saved disclosure flow;
  visited-slide text may contribute up to 100 bounded vocabulary keyterms.
- Feedback: `FEEDBACK_ENABLED=true` plus a configured OpenAI or Gemini provider,
  model, key, project identity and positive RPM/TPM allowances.

The [AI feedback reference](docs/features/ai-feedback/reference.md) documents provider
configuration, Q&A, recovery and operational bounds. The [Scribe v2 reference](docs/features/transcription/scribe-v2.md)
documents current transcription behavior; the [hosted Whisper reference](docs/features/transcription/hosted-whisper.md)
is retained as historical implementation evidence and for the packaged speech-gate
assessment.

## Checks

From `mobile/`:

```sh
npm run check
npm run bundle:android
```

With Compose running, from the repository root:

```sh
docker compose exec api python manage.py check
docker compose exec api python manage.py test --noinput
docker compose exec api python manage.py makemigrations --check --dry-run
```

The [verification guide](docs/development/verification.md) distinguishes routine
commands from historical evidence and device/provider observations. A JavaScript
export is not an APK test, and automated tests are not human acceptance.

## Iteration 2 demo preparation

The required demo will be published separately on `iteration-2-demo`. Before that
branch is created, its root README must include the exact environment, clean setup
and execution steps, demonstrated features, known limits and the short demo-video
link. The demo branch and video are not created by this documentation cleanup.

## Documentation and submissions

Start with [docs/README.md](docs/README.md). It identifies canonical product,
architecture, feature, process, evidence and archive documents and separates current
claims from historical snapshots.

The repository sources do not by themselves publish the GitHub Wiki or submit eTL
artifacts. Wiki publication, PDF/XLSX export, ZIP creation, commit, push and eTL
submission require separate review and authorization.
