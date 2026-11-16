# OutLoud · Team 07

OutLoud is an Android app for rehearsing a presentation. Import your slides, record a take, then review the transcript, audio, and slide-specific feedback.

<a id="current-status"></a>

## Install the demo APK

Use **[OutLoud demo v10](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v10-20261115)** to try the published app. Download `OutLoud-demo-v10-live-feedback.apk` from the release and install it on Android 7.0 or later. Allow the browser or file manager to install it if Android asks. Install it over the existing demo to keep your recordings and settings. Open OutLoud and enter the team’s reviewer code, which the team distributes privately.

The APK uses the shared Azure backend over HTTPS. You need internet for transcription and feedback. You can install and open the APK directly on your phone without Metro or a local server. The release lists the APK checksum, source commit `5745502`, and verification results. The reviewer code grants access to a shared workspace, so use sample slides and recordings for the demo.

### Try the published demo flow

1. Import a PDF and set the audience and time target.
2. Record a short rehearsal across two or more slides. Choose **Live feedback** before recording to see slide feedback as you go, or select **After Stop** to process the take when you finish.
3. Stop, open Review or Full Review, and play the saved recording. Check the transcript and feedback against what you said.

## Quick start

Use this path to run the code in your checkout. The shared repository baseline is [v8 source `cdb8055`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/cdb8055f0fd5022aafccb47625889d3f9a403f5f). The v10 APK uses [its own release source](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/57455028739ad2d1aeb7f1d04723a01f6fb7190e).

Install Git, Node.js 24 and npm, Docker with Compose, Android Studio, JDK 17, and Android SDK Platform 36. Set `JAVA_HOME` and Android Studio’s Gradle JDK to JDK 17.

### Start the backend

```sh
git clone https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07
cp -n backend/.env.example backend/.env
docker compose up --build
```

Leave Compose running. The API starts on port 8000 and applies migrations. In another terminal, check [API liveness](http://127.0.0.1:8000/api/health/) and [database and Redis readiness](http://127.0.0.1:8000/api/ready/). Run `docker compose exec worker celery -A config inspect ping` from the repository root to check the worker.

### Start Android

Start an Android emulator or connect a phone with USB debugging. From the repository root in a second terminal:

```sh
cd mobile
npm ci
cp -n .env.example .env
```

- **Emulator:** use `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api` in `mobile/.env`.
- **USB phone:** use `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api` in `mobile/.env` and run `adb reverse tcp:8000 tcp:8000` and `adb reverse tcp:8081 tcp:8081`. Use an emulator or a separate test phone if Android reports a signing conflict with the installed demo.

From `mobile/`, run `npm run android` to build and launch the Expo development client. Keep Metro running. Native PDF rendering and SQLite need the development client. See the [local development guide](docs/local-development.md) for Android Studio setup and troubleshooting.

## Configuration and limits

The local app can record and play audio without provider keys. For transcription, set `ELEVENLABS_API_KEY` in `backend/.env`. For feedback, enable it and supply the OpenRouter key, project identity, and request limits described in the [provider setup](docs/ai-feedback.md#openrouter-activation-and-saved-job-cutover). Keep provider keys in `backend/.env`. The Android environment holds the API address.

## Checks

From `mobile/`:

```sh
npm run check
npm run bundle:android
```

From the repository root with Compose running:

```sh
docker compose exec api python manage.py check
docker compose exec api python manage.py makemigrations --check --dry-run
docker compose exec api python manage.py test --noinput
```

The bundle command checks the Android JavaScript export. See [Testing Documentation](docs/testing.md) for coverage, device tests, and dated results.

## Documentation

- [Requirements and acceptance criteria](docs/requirements-and-specifications.md)
- [System design](Design-Documentation.md) and [API contract](docs/api-contract.md)
- [Testing Documentation](docs/testing.md) and [story-to-test matrix](docs/story-test-matrix.md)
- [Contributor instructions](AGENTS.md) and [AI collaboration log](docs/ai-collaboration-prompts.md)
- [Team Wiki](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki)
