# OutLoud · Team 07

An Android presentation practice app connecting PDF slides, recordings, slide-aligned transcripts, and feedback.

**Current status on `feature/pdf-viewer-v2`: local PDF viewing restored for separate review.** Import and store PDFs on the device, navigate their pages, and open rehearsal preview at the selected page. Microphone recording remains disabled on this branch. This branch starts at post-revert `main` (`f6f6e76`) and restores the PDF portion of PR #5; its separate recording branch is `feature/recording-tracking-v2`. Server upload, PDF preparation, worker orchestration, and Gemini feedback remain unfinished. New Android verification and human feature review are pending.

On `feature/whisper-alignment`, the hosted Whisper adapter, standalone word-to-slide matcher, and mocked/synthetic tests are implemented. [Alignment notes](docs/word-alignment.md) describe its
proposed internal output and a runnable example. It is not yet wired into the
worker, API, or app. [Whisper setup](docs/whisper-transcription.md) explains how to run a real-audio check; a live TTS transcription/alignment check passed; human-speech accuracy remains unverified.

On `feature/transcription-client-and-playback`, the [mobile transcription client](docs/mobile-transcription.md)
implements upload, processing requests, validated results, retries, and cancellable
polling with mocked-network tests. Recorder, real feature endpoints, and live result-screen
wiring remain pending. The result screen now displays the saved Whisper TTS transcript,
synchronized local-audio word highlighting and tap-to-seek. Processing/failure/retry
states remain explicitly simulated.

## Start here

- [Understand everything in this setup](docs/setup-explained.md)
- [Divide the work and start teammate branches](docs/team-work-division.md)
- [Team handoff and feature ownership](docs/iteration-1-handoff.md)
- [API and timestamp contract](docs/api-contract.md)
- [Submitted requirements mapped to code](docs/source-alignment.md)
- [Verification and code review](docs/review.md)

```text
mobile/                         Expo + React Native + TypeScript
  src/app/                      Expo Router route files
  src/features/pdf/             Library, viewer, PDF service interface
  src/features/recording/       Rehearsal screen and recording interface
  src/features/transcription/  Result screen and API interface
  src/contracts/                Shared wire types
  src/fixtures/                 Hand-written demo content
backend/                        Django REST + Celery
  rehearsals/models.py          Deck, slide, and attempt storage
  rehearsals/services/          PDF, Whisper, alignment, Gemini entry points
  rehearsals/tasks.py           Background task entry point
compose.yaml                    Local PostgreSQL, Redis, API, worker
```

## Run Android

Install Node.js 24 LTS (minimum 22.13), npm, Android Studio, **JDK 17**, Android SDK Platform 36, and an emulator or USB-debug-enabled phone. This project uses Expo SDK 57 / React Native 0.86. Set both the shell's `JAVA_HOME` and Android Studio's project Gradle JDK to JDK 17. The local build using Android Studio's bundled Java 25 failed during Worklets/CMake setup. Expect the first native build to download Gradle and Android dependencies.

After the scaffold is merged into the repository:

```sh
git clone https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07/mobile
npm ci
cp .env.example .env
npm run android
```

Start an emulator in Android Studio Device Manager first. `npm run android` generates the native Android project, builds and installs a development client, and starts Metro. No EAS account/cloud build is required.

To open the native project in Android Studio, run `npm run prebuild:android`, then open **`mobile/android`** and allow Gradle sync. Keep `npm start` running when launching a debug app from Android Studio. Feature code is TypeScript under `mobile/src`; this is not a Kotlin/Compose project. Generated `android/` is ignored by Git. Configure native changes through `app.json` or Expo config plugins so teammates can regenerate them.

If a macOS shell cannot find Java or Android tools:

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
```

That Java command requires a macOS-registered JDK 17. If Gradle provisioned your JDK instead, point `JAVA_HOME` directly to its `Contents/Home` directory. The exact path used on the setup machine is recorded in [setup-explained.md](docs/setup-explained.md).

The screen preview runs without backend services or provider keys: **Open sample slides → Preview rehearsal → Preview transcript and feedback**. Recording remains a preview; the result screen can play the matching local TTS audio with synchronized word highlighting.

The local PDF viewer uses native Android PDF rendering. After installing dependencies, build/install a new development app with `npm run android`; Expo Go does not include this renderer. Imported PDFs are copied into the app's private documents directory and remain available in the in-app library after restart. Removing a library entry deletes its local PDF. The app does not upload imported PDFs in this first step.

## Run the backend

Install Docker Desktop or another Docker Compose-compatible runtime. From the repository root:

If macOS reports `docker: command not found` after installing Docker Desktop, first run `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"` in that terminal.

```sh
cp backend/.env.example backend/.env
docker compose up --build
```

This starts PostgreSQL, Redis, Django on port 8000, and a Celery worker, with persistent database/media volumes. The API container applies migrations. Ports bind to loopback. This is a local development configuration; authentication and production deployment are separate work.

`http://127.0.0.1:8000/api/health/` checks API liveness. `/api/ready/` checks database/broker connectivity, not AI implementation or worker readiness. Check the worker using `docker compose exec worker celery -A config inspect ping`.

For local Python development:

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Run `docker compose up -d db redis` from the repository root. Then run `python manage.py migrate` and `python manage.py runserver 0.0.0.0:8000` from `backend/`. In another activated terminal, run `celery -A config worker --loglevel=info`.

The **health endpoint and unfinished routes only** can be smoke-tested without PostgreSQL/Redis using `python manage.py runserver --settings=config.test_settings 127.0.0.1:8000`. This uses an ephemeral test database and may warn about unapplied migrations; do not use it for feature development or saving attempts. Storage/processing need the real services; this limited smoke check is not infrastructure validation.

## App connection

- Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api` in `mobile/.env`.
- USB phone: run `adb reverse tcp:8000 tcp:8000`, use `http://127.0.0.1:8000/api`, and restart Metro.
- Tap **Check connection** in the Library screen.

Provider keys belong only in ignored `backend/.env`. Never use `EXPO_PUBLIC_*` for secrets. No provider is called by this scaffold, and keys are not needed for its preview.

## Checks

```sh
cd mobile
npm ci
npm run check
npm run bundle:android
```

```sh
cd backend
.venv/bin/python manage.py check
.venv/bin/python manage.py test --settings=config.test_settings
.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings
```

Unit tests use in-memory SQLite. GitHub CI also configures PostgreSQL and applies migrations. JavaScript bundle validation is separate from APK/device testing. See `docs/review.md` for verification actually performed.

## Team branches

Once the reviewed scaffold reaches `main`:

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/pdf-viewer
# Implement, test, and arrange teammate review.
git add <your-changed-files>
git commit -m "Add PDF import and slide viewer"
git push -u origin feature/pdf-viewer
```

Use `feature/recording-tracking` and `feature/whisper-alignment` for the other workstreams. Coordinate changes to shared types, models/migrations, routes, and dependency locks. Follow the submitted team agreement on teammate review/testing before push, then use pull requests for merge review. Never force-push `main`.

## Tool references

- [Expo local Android builds](https://docs.expo.dev/guides/local-app-development/)
- [Expo Router](https://docs.expo.dev/router/installation/)
- [Expo audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
- [Expo document picker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/)
- [Celery with Django](https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html)
- [React Native Java setup](https://reactnative.dev/docs/set-up-your-environment#java-development-kit)

The submitted proposal defines the stack. Expo template assets/license remain under `mobile/`.
