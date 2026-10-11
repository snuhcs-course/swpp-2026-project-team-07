# OutLoud · Team 07

An Android presentation practice app connecting PDF slides, recordings, slide-aligned transcripts, and feedback.

**Current scope: `feature/rehearsal-review`, stacked on Whisper PR #19 (`c7733d8`).** The Library merges local captures and server history for known presentations. Saved rehearsals open by attempt UUID with actual PDF pages, audio, synchronized transcript and chronological slide visits. Missing audio/PDF can be downloaded explicitly for offline review. Ordinary browsing, refreshing, downloading and replaying never start analysis; the single-use new-capture handoff below is the explicit exception. Existing **Analyze recording**, OpenAI disclosure, stage/Refresh/Retry and uncertain-charge confirmation remain in place; sample previews stay separate.

**Processing scope: `feature/whisper-api-processing`.** Finishing a real recording opens its saved result and uploads the PDF and audio to the configured server. Transcription starts automatically after the first-use OpenAI disclosure is accepted; cancelling the disclosure leaves the server upload saved without starting transcription. The saved-attempt screen retains **Analyze recording** for cancelled/older recordings, stage/Refresh/Retry controls and a plain real transcript. SQLite caches results by API address and attempt UUID. Local replay remains available through network/provider/analysis failures; sample previews stay separate.

The backend coordinates a durable PostgreSQL queue, packaged Silero speech-presence check, hosted `whisper-1`, private raw-response persistence, normalized transcript, chronological slide visits and timing/rate estimates. Feedback is disabled for this stage. See the [API contract](docs/api-contract.md) for revision-aware retries and uncertain outbound requests. Historical standalone adapter/alignment work is now integrated; its older pilot evidence does not establish this pipeline's live accuracy.

Detected no-speech saves an empty transcript, chronological visits with empty word lists, and timing metrics over the original recording duration, with zero provider requests. Repeated, backward and zero-duration visits remain visible in the result data.

The rehearsal-review snapshot passed independent AI review, **209 mobile tests**, TypeScript/lint and Android export. Coordinator checks passed Django system/migration checks, 74 tests on real PostgreSQL, API restart/media retrieval, and Android emulator review/recovery checks using the saved synthetic Whisper pilot without another provider call. Physical-phone/audible quality, native interruption/API-switch stress cases and human review remain pending. See [final evidence](docs/ai-use.md#2026-10-08--rehearsal-review-final-verification-and-publication) for exact coverage, review repairs and limitations.

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
compose.yaml                    Local PostgreSQL, Redis, API, worker, scheduler
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

Local PDF import, capture and saved-audio playback run without backend services or provider keys. SQLite stores one UUID, the prepared audio URI and audio-relative slide checkpoints per real recording. On restart, interrupted capture requires playable-audio recovery; an unfinalized/missing native file cannot be reconstructed. Upload retries retain the UUID, source audio and slide visits. Native PDF rendering and SQLite require a rebuilt Android development client, not Expo Go.

Limits remain **10 slides, 20 MiB PDF, ten minutes (600,000 ms), and 25,000,000 audio bytes**. Legacy audio above the byte limit stays local and can still be played; make a shorter new recording to upload. New captures automatically continue from upload to analysis; first-use cancellation leaves them awaiting analysis. Deck mappings are scoped to the configured API address, and confirmed missing mappings are repaired before audio upload.

## Review a saved rehearsal

Open a presentation's rehearsal history in Library, then **Open saved rehearsal**. Cached entries appear before online refresh; a failed refresh retains them with a stale notice. History covers only locally known presentation mappings for the current API, not an account-wide archive. Entries distinguish local captures from server review copies and show date, duration, upload/processing state and media availability.

Review prefers existing local audio/PDF. Use **Download audio for offline review** or **Download PDF for offline review** when needed; each succeeds independently. **Refresh** retries both rehearsal and presentation metadata, including a failed lookup that prevented PDF recovery. Downloads are bounded and validated with the native player/renderer before durable cache publication. They never create a local capture or PDF import, and failed downloads preserve original and previously valid files. Switching API addresses separates history, analysis and downloaded media.

The native audio position drives PDF pages and timed word highlighting. Tap a timed word or visit, use previous/next visit or ±5 seconds; seeks preserve playing/paused intent. Backgrounding or leaving the screen pauses playback, and returning requires Play. Repeated/backward and instantaneous visits remain listed; simultaneous events use the last event. Missing alignment falls back to **Recorded navigation**. Partial/untimed text remains readable, and saved EN/KO rates explicitly use total rehearsal time including silence. See the [review contract](docs/api-contract.md#mobile-rehearsal-review).

## Run the backend

Install Docker Desktop or another Docker Compose-compatible runtime. From the repository root:

If macOS reports `docker: command not found` after installing Docker Desktop, first run `export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"` in that terminal.

```sh
cp backend/.env.example backend/.env
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
cp .env.example .env
```

Run `docker compose up -d db redis` from the repository root. Then run `python manage.py migrate` and `python manage.py runserver 0.0.0.0:8000` from `backend/`. In separate activated terminals, run `celery -A config worker --loglevel=info` and `celery -A config beat --loglevel=info --schedule=/tmp/outloud-celerybeat`. Keep one scheduler running. It republishes durable queued rows and recovers expired claims every 30 seconds.

The SQLite `config.test_settings` setup is for automated tests; persistent development and concurrency validation require PostgreSQL, Redis, the worker and scheduler. A successful SQLite test or Android JavaScript export does not establish worker recovery or device behavior.

The dependency lock includes `silero-vad==6.2.0`, `torch==2.10.0`, `torchaudio==2.10.0`, `onnxruntime==1.23.2`, `numpy==2.2.6`, and `av==16.1.0`. Silero's packaged ONNX model runs on CPU; there are no local Whisper dependencies or model downloads. PyAV decodes only a temporary in-memory waveform for presence detection; hosted transcription receives the original audio bytes unchanged. Decode/model failures stop recoverably before provider submission.

The coordinator's dependency audit reports two residual Torch advisories after this upgrade: PT2 loading (`PYSEC-2026-139`) and `torch.jit.script` (`PYSEC-2025-194`). The current gate uses neither affected operation on uploaded data; this is not an audit-clean dependency set. See the [dependency assessment](docs/whisper-transcription.md#packaged-gate-dependency-assessment-2026-10-08) for source paths, evidence and remaining risk.

Regenerate the lock with `uv pip compile backend/requirements.in -o backend/requirements.txt --cache-dir /tmp/onloud-uv-cache` from the repository root (append `--offline` when the cache is populated). Install through the setup above; native CPU/runtime packaging must also be verified in the coordinator's Linux/Compose environment.

## App connection

- Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api` in `mobile/.env`.
- USB phone: run `adb reverse tcp:8000 tcp:8000`, use `http://127.0.0.1:8000/api`, and restart Metro.
- Tap **Check connection** in the Library screen.

Provider keys belong only in ignored `backend/.env`. Never use `EXPO_PUBLIC_*` for secrets. Storage/upload endpoints call no providers. After a new capture uploads, the mobile flow calls `/attempts/{id}/process/` following first-use disclosure; older/cancelled recordings retain Analyze and failures retain explicit Retry. Missing keys and provider rejection fail safely while retaining source audio.

## Checks

```sh
cd mobile
npm ci
npm run check
npm run bundle:android
```

```sh
cd backend
.venv/bin/python manage.py check --settings=config.test_settings
.venv/bin/python manage.py test --settings=config.test_settings
.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings
```

Unit tests use in-memory SQLite. PostgreSQL-specific processing/upload races are explicitly skipped there. Run them separately against the real test database with `.venv/bin/python manage.py test rehearsals.test_processing.ConcurrentProcessingTests rehearsals.test_storage.ConcurrentUploadTests --settings=config.settings` from `backend/` with test-database privileges. Never substitute SQLite for that evidence. Verify scheduler restart, missed broker publication, worker termination before/after submission and after raw persistence, Android lifecycle/cache/replay, and a consented hosted pilot separately.

A submitted marker means a request may have reached the provider. SDK timeout is 120 seconds, task limit 300 seconds, and claim expiry 360 seconds. Automatic provider/SDK retries are disabled. Received raw output and successful transcripts are reused. Ambiguous outbound failures require explicit acknowledgement before a new generation; this does not promise provider exactly-once execution or a monetary cap.

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
