# OutLoud · Team 07

OutLoud helps presenters rehearse with their PDF slides on Android. Import a deck, record across slides, review the audio, transcript, and slide feedback, then redo a slide.

<a id="current-status"></a>

## What Iteration 3 changed

Iteration 3 added hosted reviewer access, precise audio seeking and fuller feedback in slide Review. The first Redo starts a new capture, and you can retry feedback for an affected slide. The Iteration 3 demo uses [v8 (`cdb8055`)](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v8-20261103). [Iteration 3 release evidence](docs/testing-evidence/iteration-3-reconciliation-20261105.md)

<a id="install-the-iteration-3-demo-apk"></a>

## Run the Iteration 3 demo

### Install and connect

Download the [v8 APK](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/download/outloud-demo-v8-20261103/OutLoud-demo-v8-issue49.apk). Ask Team 07 for the reviewer code and enter it when you open OutLoud. The APK connects to the hosted Azure backend over HTTPS without Metro or a local server. Use sample slides and recordings in the shared workspace. Transcription and feedback require internet access.

Install v8 over an earlier demo to keep your recordings and settings. Use a separate test device or emulator if your phone already has a newer OutLoud build. [Verify the APK checksum](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/download/outloud-demo-v8-20261103/OutLoud-demo-v8-issue49.apk.sha256)

<a id="try-the-published-demo-flow"></a>

### Try one rehearsal

1. Pull up on Home to import a sample PDF with at least two slides. Review and save the audience and time target. New imports start at **General audience** and **10 minutes**.
2. Check **Must Cover** and **Further Insight** when cues appear. Record a short rehearsal, swipe forward and back between slides, then tap Stop.
3. Accept the first-use transcription disclosure to continue analysis. After processing, open **Review** and check that the feedback belongs to the selected slide. In **Full Review**, play the saved audio and check it against the transcript. A score appears when available.
4. Redo a slide and choose **Keep current** or **Overwrite**. Reopen the rehearsal from Home and play the selected slide to verify that the chosen take was saved.

V8 also supports saved audience Q&A with spoken questions. [Recording and review guide](docs/rehearsal-review.md#published-demo-behavior--november-5-reconciliation)

### Demo environment

| Item | Iteration 3 |
| --- | --- |
| App | `OutLoud-demo-v8-issue49.apk`, [source `cdb8055`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/cdb8055f0fd5022aafccb47625889d3f9a403f5f) |
| Minimum Android | Android 7.0 (API 24) |
| Phone smoke test | Samsung SM-S918N, Android 16, November 3, 2026 |
| Hosted backend | Azure over HTTPS. We deployed the separate v2.4 grading repair on November 3. [Hosting details](docs/azure-hosting.md) |

## Known limitations and remaining work

- **Shared workspace.** The reviewer code gives users access to the same workspace. Full server-side deletion is incomplete. V8 uploads rehearsal audio before showing the first-use transcription disclosure. Cancelling prevents transcription and leaves the uploaded copy on the server.
- **Recording and review.** V8 blocks Back while recording. Stop/save/discard, a separate spoken summary, and full comparison between two takes remain open. The compact UI omits some older recovery and transcript correction controls.
- **Evidence.** V8 has a limited phone smoke test. Broad recognition quality, feedback usefulness, score calibration, and full acceptance still need verification. [Remaining requirements](docs/requirements-and-specifications.md#remaining-requirements-and-acceptance-gaps) · [Dated test results](docs/testing-evidence/iteration-3-reconciliation-20261105.md#dated-verification-evidence)

<a id="quick-start"></a>

## Run locally

The checkout contains the Android app in `mobile/`, the Django API and Celery workers in `backend/`, and project guides in `docs/`. Compose runs the local API, database, Redis, and workers. [Repository layout](docs/local-development.md#repository-structure)

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

### Configuration and limits

PDF import, recording, and saved-audio playback work offline. Upload, transcription, and feedback need the configured server. Feedback is disabled by default. For transcription, set `ELEVENLABS_API_KEY` in `backend/.env`. For feedback, enable it and supply the OpenRouter key, project identity, and request limits described in the [provider setup](docs/ai-feedback.md#openrouter-activation-and-saved-job-cutover). Keep provider keys in `backend/.env`. The Android environment holds the API address. Retrying an uncertain provider request may incur another charge.

Use a PDF with at least one slide and up to **50 MiB**, and record at most **30 minutes**. Audio uploads are capped at **25,000,000 bytes**. Oversized saved audio can still play locally. Record a shorter take to upload. [Capture and recovery details](docs/rehearsal-review.md#local-capture-and-limits)

<a id="checks"></a>

## Checks and evidence

### Run the checks

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

The bundle command checks the Android JavaScript export. See the [verification guide](docs/verification.md) for PostgreSQL concurrency and worker recovery checks.

### What we verified for Iteration 3

- **V8 release:** 617 mobile tests passed. The Android JavaScript export and production APK build passed. [Release verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v8-20261103)
- **V8 phone smoke test:** The phone check covered PDF import, playback, and restart persistence on Android 16. One English/Korean rehearsal produced a transcript and a displayed score. [Dated evidence and limits](docs/testing-evidence/iteration-3-reconciliation-20261105.md#dated-verification-evidence)
- **Iteration 2 coverage:** The October 22 suites passed. Backend coverage met its targets, and mobile coverage fell below both line targets. [October 22 coverage record](docs/testing.md#october-22-local-coverage)

<a id="documentation"></a>

## Project documentation

- [Submitted Iteration 3 archive](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/b49b65aad0b45d97d837f09ea1aced53927fabf2/team7-iter3.zip)
- [Requirements and acceptance criteria](docs/requirements-and-specifications.md)
- [System design](Design-Documentation.md) and [API contract](docs/api-contract.md)
- [Recording and review](docs/rehearsal-review.md), [AI feedback reference](docs/ai-feedback.md), and [Iteration 2 AI feature history](docs/iteration-2-ai-feedback.md)
- [Testing Documentation](docs/testing.md) and [story-to-test matrix](docs/story-test-matrix.md)
- [Contributor instructions](AGENTS.md), [AI collaboration log](docs/ai-collaboration-prompts.md), and [AI reporting guide](docs/ai-collaboration-guidelines.md)
- [Daily standup workflow](docs/meeting-log-workflow.md)
- [Team Wiki](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki)
- [Iteration 4 demo v10 with live slide feedback](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v10-20261115)
