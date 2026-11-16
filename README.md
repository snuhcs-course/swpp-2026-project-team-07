# OutLoud · Team 07

OutLoud is an Android app for rehearsing a presentation. Import your slides, record a take, then review the transcript, audio, and slide-specific feedback.

<a id="current-status"></a>

## Install the Iteration 3 demo APK

Use **[OutLoud demo v8](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v8-20261103)** to review the published Iteration 3 baseline. Download `OutLoud-demo-v8-issue49.apk` and install it on Android 7.0 or later. Install it as an update to an earlier demo to keep your recordings and settings. If your phone already has a newer OutLoud build, use a separate test device or emulator for v8.

Open OutLoud and enter the team’s reviewer code. This APK connects to the shared Azure backend over HTTPS and runs without Metro or a local server. Use sample slides and recordings in the shared workspace. Transcription and feedback require internet and the hosted backend. The release links the checksum and evidence for source commit `cdb8055`.

### Try the published demo flow

1. Pull up on Home to import a PDF. Review and save the audience and time target. New imports start at **General audience** and **10 minutes**.
2. Check the slide's **Must Cover** and **Further Insight** cues when available. Record a short rehearsal, swipe forward and back between slides, then tap Stop.
3. Accept the first-use transcription disclosure to continue analysis. When processing finishes, open **Review** for slide-specific playback and feedback or **Full Review** for the whole recording, transcript, and any available score.
4. Redo a slide and choose **Keep current** or **Overwrite**. Reopen the rehearsal from Home to check that the selected take was saved.

V8 also supports saved audience Q&A, spoken questions, and retrying feedback for an affected slide. See the [recording and review guide](docs/rehearsal-review.md#published-demo-behavior--november-5-reconciliation) and the [release evidence](docs/testing-evidence/iteration-3-reconciliation-20261105.md).

The [v10 APK](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v10-20261115) is a later demo with live slide feedback.

### Known limitations and remaining work

- **Shared workspace.** The reviewer code gives users access to the same workspace. Full server-side deletion is incomplete. V8 uploads rehearsal audio before showing the first-use transcription disclosure. Cancelling stops transcription and leaves the uploaded copy on the server.
- **Recording and review.** V8 blocks Back while recording. Stop/save/discard, a separate spoken summary, and full comparison between two takes remain open. The compact UI omits some older recovery and transcript correction controls.
- **Evidence.** V8 has a limited phone smoke test. Broad recognition quality, feedback usefulness, score calibration, and full acceptance still need verification. [Remaining requirements](docs/requirements-and-specifications.md#remaining-requirements-and-acceptance-gaps) · [Dated test results](docs/testing-evidence/iteration-3-reconciliation-20261105.md#dated-verification-evidence)

## Quick start

Use this path to run the code in your checkout. The Iteration 3 repository baseline is [v8 source `cdb8055`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/cdb8055f0fd5022aafccb47625889d3f9a403f5f).

Install Git, Node.js 24 LTS (minimum 22.13) and npm, Docker with Compose, Android Studio, JDK 17, and Android SDK Platform 36. Set `JAVA_HOME` and Android Studio’s Gradle JDK to JDK 17.

### Start the backend

```sh
git clone https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07
cp -n backend/.env.example backend/.env
docker compose up --build
```

Leave Compose running. The API starts on port 8000 and applies migrations. Compose stores the database and uploaded media in persistent volumes. In another terminal, check [API liveness](http://127.0.0.1:8000/api/health/) and [database and Redis readiness](http://127.0.0.1:8000/api/ready/). Run `docker compose exec worker celery -A config inspect ping` from the repository root to check the worker.

### Start Android

Start an Android emulator or connect a phone with USB debugging. From the repository root in a second terminal:

```sh
cd mobile
npm ci
cp -n .env.example .env
```

- **Emulator:** use `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api` in `mobile/.env`.
- **USB phone:** use `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api` in `mobile/.env` and run `adb reverse tcp:8000 tcp:8000` and `adb reverse tcp:8081 tcp:8081`. Use an emulator or a separate test phone if Android reports a signing conflict with the installed demo.

From `mobile/`, run `npm run android` to build and launch the Expo development client. Keep Metro running. Native PDF rendering and SQLite need the development client. After editing `mobile/.env`, restart Metro. See the [local development guide](docs/local-development.md) for Android Studio setup and troubleshooting.

## Configuration and limits

PDF import, recording, and saved-audio playback work offline. Upload, transcription, and feedback need the configured server. Feedback is disabled by default. For transcription, set `ELEVENLABS_API_KEY` in `backend/.env`. For feedback, enable it and supply the OpenRouter key, project identity, and request limits described in the [provider setup](docs/ai-feedback.md#openrouter-activation-and-saved-job-cutover). Keep provider keys in `backend/.env`. The Android environment holds the API address. Retrying an uncertain provider request may incur another charge.

Use a PDF with at least one slide and up to **50 MiB**, and record at most **30 minutes**. Audio uploads are capped at **25,000,000 bytes**. Oversized saved audio can still play locally. Record a shorter take to upload. [Capture and recovery details](docs/rehearsal-review.md#local-capture-and-limits)

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

The bundle command checks the Android JavaScript export. Use the [verification guide](docs/verification.md) for PostgreSQL concurrency and worker recovery checks. All tests passed in the October 22 Iteration 2 run. Backend coverage met its targets, and mobile coverage fell below both line targets. [October 22 coverage record](docs/testing.md#october-22-local-coverage)

## Documentation

- [Requirements and acceptance criteria](docs/requirements-and-specifications.md)
- [System design](Design-Documentation.md), [repository layout](docs/local-development.md#repository-structure), and [API contract](docs/api-contract.md)
- [Recording and review](docs/rehearsal-review.md), [AI feedback reference](docs/ai-feedback.md), and [Iteration 2 AI feature history](docs/iteration-2-ai-feedback.md)
- [Testing Documentation](docs/testing.md) and [story-to-test matrix](docs/story-test-matrix.md)
- [Contributor instructions](AGENTS.md), [AI collaboration log](docs/ai-collaboration-prompts.md), and [AI reporting guide](docs/ai-collaboration-guidelines.md)
- [Daily standup workflow](docs/meeting-log-workflow.md)
- [Team Wiki](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki)
