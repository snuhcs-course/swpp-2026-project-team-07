# OutLoud · Team 07

An Android presentation rehearsal app that connects PDF slides, recordings, slide-aligned transcripts and AI feedback.

- **Mobile:** Expo SDK 57 / React Native 0.86 / TypeScript.
- **Backend:** Django / Celery, with PostgreSQL and Redis.
- **Repository:** `mobile/` for the app, `backend/` for the API and workers, `docs/` for guides and evidence, `compose.yaml` for local services.

## Current status

- **This copy has the redesigned mobile UI** (design prototype rebuild, October 14, 2026). See [REDESIGN.md](REDESIGN.md) for setup, the screen-to-feature map and verification limits.
- **Iteration 2 is current.** Iteration 1 features were merged into `main` on October 11, 2026 (PRs #17–#21).
- Available features include PDF import, recording with slide tracking, saved audio playback, hosted Whisper transcription, synchronized transcript review and AI feedback.
- Local import, recording and saved-media playback work without the backend. Upload, transcription and feedback require the configured server; provider work requires internet and credentials.
- Feedback supports Gemini or OpenAI through backend configuration and is **disabled by default**. Suggestions link to evidence; they still require human judgment.
- Limited agent-operated physical-phone checks are recorded in the active prompt log. Full device flow and human usefulness testing remain pending. This is a local development setup; authentication and production deployment remain separate work.
- [Verification evidence and remaining limits](docs/verification.md) distinguish automated tests, agent-operated emulator checks and controlled provider evaluation. Sample previews remain separate from real results.

## Quick start

### 1. Prerequisites and clone

- Node.js 24 LTS recommended (minimum 22.13), npm and Git.
- Android Studio, **JDK 17**, Android SDK Platform 36, and an emulator or USB-debug-enabled Android phone.
- Docker Desktop or another Docker Compose-compatible runtime for the backend.
- Set both shell `JAVA_HOME` and Android Studio's project Gradle JDK to **JDK 17**.

```sh
git clone https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07
```

### 2. Start the backend

From the repository root, copy the example only on first setup; preserve any existing `.env`:

```sh
cp -n backend/.env.example backend/.env
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

1. On Home, pull up to add a PDF. After slide analysis, set a 1–20 minute presentation target and optionally choose the audience in the blurred setup overlay, then tap the checkmark to start a rehearsal. The target sets slide pacing and Review timing comparisons; the audience is available to coaching and Audience Q&A.
2. Record while moving forward through slides, then finish the recording. You can move back and forth before or after recording; backward slide navigation is disabled while capture is starting, running or stopping so transcript checkpoints stay in order.
3. With the server available, the app uploads the PDF/audio and starts transcription after first-use OpenAI disclosure. If upload or transcription fails, tap its status in the slide transcript to retry.
4. Open a presentation from Home. The transcript is limited to the current slide; tap its words to play that sentence from the selected recording, or tap the small icon on the right of the transcript heading to play or pause that slide's full recording. Retaking a recorded slide opens the existing comparison screen, where you choose **Keep current** or **Overwrite**. The new recording stays pending until you decide. If a capture is interrupted, tap the status beneath the timer to inspect and recover its audio; close the sheet and tap again to inspect another interrupted capture. A recovered redo uses the same choice.
5. If feedback is configured, choose **Generate suggestions** and accept its separate provider disclosure. Review up to three suggestions and their slide/transcript evidence.
6. In Review, each slide shows its score, timing bars, PDF preview, four feedback rows and a local recording playback strip. **Full review** shows the merged run's audio, timed transcript and slide grades. You can also open Full review by tapping the coverage ring on Home. Audio starts from transcript words in Rehearse; the existing interrupted-capture status beneath its timer still opens recovery details when needed.

- Previously saved local media and cached results remain stored through network or provider failures. The Review slide preview does not expose download or PDF offline tools.
- Browsing, refreshing, downloading and replaying do not start analysis or feedback. Feedback generation remains explicit and does not retranscribe audio.
- History covers locally known presentations for the selected API, not an account-wide archive. [Recording, playback and recovery details](docs/rehearsal-review.md).

## Configuration and limits

- Keep provider keys in ignored `backend/.env`; never put secrets in `EXPO_PUBLIC_*` variables.
- Hosted transcription uses OpenAI `whisper-1`. Detected no-speech recordings produce an empty transcript without a provider request.
- To enable feedback, set `FEEDBACK_ENABLED=true` and configure the selected provider's key, model, project identity and positive RPM/TPM allowances. `FEEDBACK_PROVIDER` defaults to `openai`; `gemini` is supported. See the [configuration reference](docs/ai-feedback.md#provider-configuration-and-operational-bounds) and [operator summary](docs/ai-feedback.md#operator-and-review-summary).
- **Input limits:** any positive slide count, 50 MiB PDF, twenty-minute recordings and 25,000,000 audio bytes. Oversized audio remains playable locally; record a smaller attempt to upload.
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
- SQLite tests skip PostgreSQL-specific races. An Android JavaScript export does not establish APK, physical-device or human-usefulness results.

## Documentation

| Need | Document |
| --- | --- |
| Requirements and implementation context | [Submitted requirements traceability](docs/source-alignment.md) · [GitHub Wiki](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki) |
| Design and TA review artifacts | [Proposed Wiki design revision](Design-Documentation.md) · [reading PDF](output/pdf/OutLoud_Design_Documentation.pdf) · [submission copy](output/pdf/team7-iter1-design.pdf) · [reference comparison](Design-Comparison.md) |
| Setup and repository layout | [Local development guide](docs/local-development.md) |
| Data boundaries and recovery | [API contract](docs/api-contract.md) · [rehearsal review](docs/rehearsal-review.md) |
| Feedback behavior and quality limits | [AI feedback reference](docs/ai-feedback.md) · [controlled evaluation](docs/feedback-evaluation.md) |
| Verification evidence | [Verification guide](docs/verification.md) · [historical scaffold review](docs/review.md) |
| Contributor rules and earlier ownership context | [Shared instructions](AGENTS.md) · [Iteration 1 work division](docs/team-work-division.md) · [Iteration 1 handoff](docs/iteration-1-handoff.md) |
| AI contribution and disclosure | [Iteration 2 collaboration log](docs/ai-collaboration-prompts-iteration-2.md) · [reporting guide](docs/ai-collaboration-guidelines.md) |
| Meeting records | [Meeting-log workflow](docs/meeting-log-workflow.md) · [reusable template](docs/daily-standup-meeting-log-template.md); Wiki publication follows approval |
| Historical setup rationale | [Original scaffold walkthrough](docs/setup-explained.md); its scaffold-only status and branch instructions describe the earlier stage |

- The design draft, PDF copies and published Wiki have separate version/publication status; confirm the relevant version before review or submission.
- Preserve dated evidence and confirm current task ownership.
- Expo template assets/license remain under `mobile/`.
