# Local development guide

- Current setup details relocated from README on October 13, 2026.
- Use the [README quick start](../README.md#quick-start) for the recommended path.
- The [original scaffold walkthrough](setup-explained.md) preserves earlier setup history; its scaffold-only scope is historical.

## Repository structure

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
compose.yaml                    Local PostgreSQL, Redis, API, worker, scheduler
```

## Run Android

Copy environment examples only on first setup; `cp -n` preserves an existing `.env`.

Install Node.js 24 LTS (minimum 22.13), npm, Android Studio, **JDK 17**, Android SDK Platform 36, and an emulator or USB-debug-enabled phone. This project uses Expo SDK 57 / React Native 0.86. Set both the shell's `JAVA_HOME` and Android Studio's project Gradle JDK to JDK 17. The local build using Android Studio's bundled Java 25 failed during Worklets/CMake setup. Expect the first native build to download Gradle and Android dependencies.

```sh
git clone https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07/mobile
npm ci
cp -n .env.example .env
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

That Java command requires a macOS-registered JDK 17. If Gradle provisioned your JDK instead, point `JAVA_HOME` directly to its `Contents/Home` directory. The exact path used on the setup machine is recorded in [setup-explained.md](setup-explained.md).

## Run the backend

Install Docker Desktop or another Docker Compose-compatible runtime. From the repository root:

If macOS reports `docker: command not found` after installing Docker Desktop, first run `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"` in that terminal.

```sh
cp -n backend/.env.example backend/.env
docker compose up --build
```

This starts PostgreSQL, Redis, Django on port 8000, a Celery worker and periodic recovery scheduler, with persistent database/media volumes. The API container applies migrations. Ports bind to loopback. This is a local development configuration; authentication and production deployment are separate work.

`http://127.0.0.1:8000/api/health/` checks API liveness. `/api/ready/` checks database/broker connectivity, not AI implementation or worker readiness. Check the worker using `docker compose exec worker celery -A config inspect ping`.

For local Python development:

```sh
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp -n .env.example .env
```

Run `docker compose up -d db redis` from the repository root. Then run `python manage.py migrate` and `python manage.py runserver 0.0.0.0:8000` from `backend/`. In separate activated terminals, run `celery -A config worker --loglevel=info` and `celery -A config beat --loglevel=info --schedule=/tmp/outloud-celerybeat`. Keep one scheduler running. It republishes durable queued rows and recovers expired claims every 30 seconds.

The SQLite `config.test_settings` setup is for automated tests; persistent development and concurrency validation require PostgreSQL, Redis, the worker and scheduler. A successful SQLite test or Android JavaScript export does not establish worker recovery or device behavior.

The dependency lock includes `silero-vad==6.2.0`, `torch==2.10.0`, `torchaudio==2.10.0`, `onnxruntime==1.23.2`, `numpy==2.2.6`, and `av==16.1.0`. Silero's packaged ONNX model runs on CPU; there are no local Whisper dependencies or model downloads. PyAV decodes only a temporary in-memory waveform for presence detection; hosted transcription receives the original audio bytes unchanged. Decode/model failures stop recoverably before provider submission.

The coordinator's dependency audit reports two residual Torch advisories after this upgrade: PT2 loading (`PYSEC-2026-139`) and `torch.jit.script` (`PYSEC-2025-194`). The current gate uses neither affected operation on uploaded data; this is not an audit-clean dependency set. See the [dependency assessment](whisper-transcription.md#packaged-gate-dependency-assessment-2026-10-08) for source paths, evidence and remaining risk.

Regenerate the lock with `uv pip compile backend/requirements.in -o backend/requirements.txt --cache-dir /tmp/onloud-uv-cache` from the repository root (append `--offline` when the cache is populated). Install through the setup above; native CPU/runtime packaging must also be verified in the coordinator's Linux/Compose environment.

## Tool references

- [Expo local Android builds](https://docs.expo.dev/guides/local-app-development/)
- [Expo Router](https://docs.expo.dev/router/installation/)
- [Expo audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
- [Expo document picker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/)
- [Celery with Django](https://docs.celeryq.dev/en/stable/django/first-steps-with-django.html)
- [React Native Java setup](https://reactnative.dev/docs/set-up-your-environment#java-development-kit)

The submitted proposal defines the stack. Expo template assets/license remain under `mobile/`.

## Contributor workflow

- Follow [shared instructions](../AGENTS.md) and the team's review/testing agreement before publication.
- Coordinate shared types, models/migrations, routes and dependency locks. Never force-push `main`.
- The [Iteration 1 work division](team-work-division.md#git-commands) preserves the earlier branch examples and ownership suggestions; confirm current assignments and PR bases for each task.
- Expo template assets/license remain under `mobile/`; the submitted proposal records the stack choice.

## Earlier branch example (historical)

The original README used the example below during scaffold handoff. Its future-tense condition and branch names describe that earlier stage; use current task ownership and instructions for new work.


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
