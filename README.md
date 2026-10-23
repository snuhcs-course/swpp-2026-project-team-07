# OutLoud · Team 07

An Android presentation rehearsal app that connects PDF slides, recordings, slide-aligned transcripts and AI feedback.

- **Mobile:** Expo SDK 57 / React Native 0.86 / TypeScript.
- **Backend:** Django / Celery, with PostgreSQL and Redis.
- **Repository:** `mobile/` for the app, `backend/` for the API and workers, `docs/` for guides and evidence, `compose.yaml` for local services.

## Iteration 2 demo

Application baseline: merged PR31, `c4a3f48d2a635bb2edb44828c62fb286b55f8d94`. This branch retains that application and includes the current Requirements, Design and Testing documents. B09's first-Redo fix remains on the separate `fix/retry-recording` branch.

### Implemented features

- Import PDF slides and save presentation audience/time settings.
- Record while visiting slides forward or backward; save audio and review it locally.
- Transcribe with ElevenLabs Scribe v2 and replay synchronized transcript words.
- Show slide cues, evidence-linked feedback and presentation/per-slide scores.
- Save transcript corrections and maintain audience Q&A state.
- Retain recordings and explicit recovery states through network/provider failures.

### Major progress in Iteration 2

Integrated the redesigned rehearsal/review screens with Scribe, saved settings, reusable cues, automatic initial feedback/scoring, transcript corrections and durable Q&A. Added test-to-requirement mapping, coverage measurements and team device findings. [Testing Documentation](docs/testing.md) separates automated results, coverage shortfalls and manual observations.

### Demo video

[Watch or download the demo (MP4, 1 min 19 sec)](assets/demo/iteration-2-demo.mp4). The walkthrough shows presentation setup, recording, review/feedback, retake comparison and audience Q&A.

### Known limitations

PR31 retains the first-Redo recorder bug; its separate B09 fix is excluded. Back confirmation, spoken summaries, complete attempt comparison, full deletion and pre-upload rehearsal disclosure remain Iteration 3 work. Reported PDF-upload, navigation/playback and Q&A bugs remain open. Human advice usefulness and Korean recognition quality are unverified. [Requirements status](docs/requirements-and-specifications.md#iteration-2-implementation-status) records the remaining scope.

## Quick start

### 1. Prerequisites and clone

- Node.js 24 LTS recommended (minimum 22.13), npm and Git.
- Android Studio, **JDK 17**, Android SDK Platform 36, and an emulator or USB-debug-enabled Android phone.
- Docker Desktop or another Docker Compose-compatible runtime for the backend.
- Set both shell `JAVA_HOME` and Android Studio's project Gradle JDK to **JDK 17**.

```sh
git clone --branch iteration-2-demo https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07
```

### 2. Start the backend

From the repository root, copy the example only on first setup; preserve any existing `.env`:

```sh
cp -n backend/.env.example backend/.env
```

For transcription, set `ELEVENLABS_API_KEY` in `backend/.env`. For cues, feedback, scoring and Q&A, enable and configure the analysis provider as described in [Configuration and limits](#configuration-and-limits), including its key, project identity and positive RPM/TPM allowances. Keep the real keys outside Git.

```sh
docker compose up --build
```

- Compose starts PostgreSQL, Redis, Django on port 8000, a Celery worker and one recovery scheduler; the API applies migrations.
- Database and media volumes persist. Services bind to loopback for local development.
- `http://127.0.0.1:8000/api/health/` checks API liveness; `/api/ready/` checks database/broker connectivity.
- Check the worker with `docker compose exec worker celery -A config inspect ping`.

### 3. Start Android

In a second terminal, from the repository root:

```sh
cd mobile
npm ci
cp -n .env.example .env
npm run android
```

- Start the emulator first. The command builds and installs an Android development client and starts Metro; keep Metro running.
- Use the development client, **not Expo Go**: native PDF rendering and SQLite require a native build. No EAS account or cloud build is required.
- Expect the first build to download Gradle and Android dependencies.

### 4. Connect the app

- **Emulator:** set `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api` in `mobile/.env`.
- **USB phone:** run `adb reverse tcp:8000 tcp:8000` and use `EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api`. For a development client using Metro over USB, also run `adb reverse tcp:8081 tcp:8081`; debug builds can use Metro over the Mac's LAN address as well.
- The Android release build permits local HTTP only for the USB-forwarded loopback address or Android emulator host. The backend must be running for uploads and transcription; offline recording and playback stay local.
- Restart Metro after changing `.env`, then import a PDF and check the upload status in the redesigned app.
- [Detailed setup](docs/local-development.md) includes Android Studio launching, macOS Java/Android/Docker troubleshooting, local Python development and dependency maintenance.

## Try the main flow

1. On Home, pull up to add a PDF. After slide analysis, choose a 1–30 minute presentation time and audience in the setup overlay, then tap the checkmark. Choices synchronize through the existing presentation context API; offline saves remain pending and visible. Tap **Edit time & audience** in the idle recording header to edit them later. Conflicts offer Use server or Keep mine; dependent AI updates wait for synchronization.
2. Record while navigating forward or backward through slides, then finish the recording. Repeated visits retain their source audio times.
3. With the server available, the app uploads the PDF/audio and starts transcription after first-use ElevenLabs disclosure covering audio and visited-slide vocabulary hints. If upload or transcription fails, use the saved recording details to retry.
4. Open a presentation from Home. The normal recording layout shows the selected slide's Must Cover and Further Insight cues before and during capture. Tap Play beside Cues to play or pause its saved audio when not recording. Rotation enlarges the PDF; returning restores the current slide's Cues panel. Retaking a recorded slide opens the existing comparison screen, where you choose **Keep current** or **Overwrite**. The new recording stays pending until you decide. If a capture is interrupted, tap the status beneath the timer to inspect and recover its audio; close the sheet and tap again to inspect another interrupted capture. A recovered redo uses the same choice.
5. After a new selected recording is transcribed, its first feedback starts automatically. In Review, select a recorded slide. The AI status ring and page-level feedback show up to four verified findings. Expand Details & evidence, then use **Listen at…** and **Play evidence** to hear the original bounded interval. Use **Update feedback** after confirmed transcription corrections. Legacy take-level suggestions remain under Recording tools.
6. The first saved recording opens Full Review; later recordings use the selected slide review. Keep/Overwrite decisions retain their selected slide and return route. Review has a persistent Full Review button above its scroll content.
7. In Review, the transcript appears directly below Play and above AI feedback, highlighting the original timed words as audio plays. Confirmed suggestions, restore, synchronization and sentence playback stay inline. Recording tools retain original-word playback, transcription retries and slide descriptions; remote audio can be downloaded on the same page. Full Review retains saved audio and transcripts; Full Review is also accessible from the Home assessment ring. Home and Full Review share a verified overall score for an exact complete original recording; slide rings and tiles show validated per-slide scores. Home also shows total current findings, recording duration and WPM. Scores start after transcription and refresh after saved corrections/settings synchronize. Failures and uncertain requests require explicit Retry. Full Review warns before playing a run with missing source audio.

- Previously saved local media and cached results remain stored through network or provider failures. Download uncached remote audio directly in Review when needed.
- Refreshing, downloading and replaying do not start transcription or feedback. Opening a presentation may automatically score its selected recordings; unused history is not backfilled. Indicator GET requests never admit work. PDF upload may generate the reusable AI cue profile; failed/uncertain generation requires explicit recovery. Initial selected-slide feedback starts automatically when usable transcription and saved settings are ready. Updates and failed/uncertain retries require explicit actions; feedback does not retranscribe audio.
- History covers locally known presentations for the selected API, not an account-wide archive. [Recording, playback and recovery details](docs/rehearsal-review.md).

## Configuration and limits

- Keep provider keys in ignored `backend/.env`; never put secrets in `EXPO_PUBLIC_*` variables.
- Hosted transcription uses ElevenLabs `scribe_v2` exclusively and requires `ELEVENLABS_API_KEY`. Up to 100 vocabulary hints come only from visited slides; see [Scribe transcription](docs/scribe-transcription.md). Detected no-speech recordings produce an empty transcript without a provider request.
- To enable feedback, set `FEEDBACK_ENABLED=true` and configure the selected provider's key, model, project identity and positive RPM/TPM allowances. `FEEDBACK_PROVIDER` defaults to `openai`; `gemini` is supported. See the [configuration reference](docs/ai-feedback.md#provider-configuration-and-operational-bounds) and [operator summary](docs/ai-feedback.md#operator-and-review-summary).
- **Input limits:** any positive slide count, 50 MiB PDF, thirty-minute recordings and 25,000,000 audio bytes. Oversized legacy audio remains playable locally; record a shorter attempt to upload.
- Failed or uncertain provider submissions retain explicit recovery/confirmation controls. A retry may incur another charge; the system does not guarantee exactly-once provider execution or a spending cap.
- [Dependency assessment](docs/whisper-transcription.md#packaged-gate-dependency-assessment-2026-10-08) records unresolved Torch advisories and their assessed scope.

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

- [Verification guide](docs/verification.md) covers local Python/SQLite commands, PostgreSQL concurrency tests, worker recovery and historical evidence.
- [Testing Documentation](docs/testing.md#environment-and-commands) gives reproducible commands for the published [coverage setup](https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/testing-setup-documentation). The October 22 run passes all application tests and meets backend targets; mobile CI fails its two line-coverage targets. Reports remain available after failure.
- SQLite tests skip PostgreSQL-specific races. An Android JavaScript export does not establish APK, physical-device or human-usefulness results.

## Documentation

| Need | Document |
| --- | --- |
| Requirements and implementation context | [Requirements and current status](docs/requirements-and-specifications.md) · [Story-to-Test Matrix](docs/story-test-matrix.md) · [GitHub Wiki](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki) |
| Design and TA review artifacts | [Current Iteration 2 design](Design-Documentation.md) · [historical Iteration 1 design](Design-Documentation-Iteration-1.md) and [export tools](docs/design-tools/README.md) |
| Setup and repository layout | [Local development guide](docs/local-development.md) |
| Data boundaries and recovery | [API contract](docs/api-contract.md) · [rehearsal review](docs/rehearsal-review.md) |
| Feedback behavior and quality limits | [AI feedback reference](docs/ai-feedback.md) · [controlled evaluation](docs/feedback-evaluation.md) |
| Testing plan and evidence | [Testing Documentation](docs/testing.md) · [Test Inventory](docs/test-inventory.md) · [verification commands and historical evidence](docs/verification.md) |
| Contributor rules and earlier ownership context | [Shared instructions](AGENTS.md) · [Iteration 1 work division](docs/team-work-division.md) · [Iteration 1 handoff](docs/iteration-1-handoff.md) |
| AI contribution and disclosure | [Iteration 2 collaboration log](docs/ai-collaboration-prompts-iteration-2.md) · [reporting guide](docs/ai-collaboration-guidelines.md) |
| Meeting records | [Meeting-log workflow](docs/meeting-log-workflow.md) · [reusable template](docs/daily-standup-meeting-log-template.md); Wiki publication follows approval |
| Historical setup rationale | [Original scaffold walkthrough](docs/setup-explained.md); its scaffold-only status and branch instructions describe the earlier stage |

- Existing design and requirements PDFs describe Iteration 1. Iteration 2 needs current exports and a separate eTL submission.
- Preserve dated evidence and confirm current task ownership.
- Expo template assets/license remain under `mobile/`.
