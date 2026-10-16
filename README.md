# OutLoud · Team 07

An Android presentation rehearsal app that connects PDF slides, recordings, slide-aligned transcripts and AI feedback.

- **Mobile:** Expo SDK 57 / React Native 0.86 / TypeScript.
- **Backend:** Django / Celery, with PostgreSQL and Redis.
- **Repository:** `mobile/` for the app, `backend/` for the API and workers, `docs/` for guides and evidence, `compose.yaml` for local services.

## Current status

- **This copy has the redesigned mobile UI** (design prototype rebuild, October 14, 2026). See [REDESIGN.md](REDESIGN.md) for setup, the screen-to-feature map and verification limits.
- **Iteration 2 is current.** Iteration 1 features were merged into `main` on October 11, 2026 (PRs #17–#21).
- Available features include PDF import, recording with slide tracking, saved audio playback, ElevenLabs Scribe v2 transcription, synchronized transcript review and AI feedback.
- Local import, recording and saved-media playback work without the backend. Upload, transcription and feedback require the configured server; provider work requires internet and credentials.
- Iteration 2 Phase 2 adds cached image-aware slide profiles with zero to three essential Must Cover points and zero to three optional Further Insight suggestions per slide, aiming for 8–16 words (maximum 25) with expandable supporting details. PDF upload admits them automatically when feedback is configured; the permanent Cues panel shows both categories, progress and saved results beside selected-slide playback. Historical description/coaching functionality remains separate. See the [phase ledger](docs/iteration-2-ai-feedback.md).
- Phase 3 derives exact-sum per-slide timing from explicitly saved duration requirements and uses mono AAC at 64 kbps for new captures up to thirty minutes. Missing duration retains labeled suggested timing; time and audience are editable through the shared presentation setup overlay. See [Phase 3 evidence](docs/phase-3-verification.md).
- Phase 5 adds automatic initial selected-slide feedback in Review: up to four prioritized evidence-linked findings, with separate pending, failed, insufficient-evidence, successful and outdated states. The evaluator also critiques idea ordering/connections and can suggest a clearer way to express the same meaning for a future rehearsal, without editing the transcript. Accepted transcript corrections invalidate results without automatically regenerating them. Audience/time checks require explicit requirements; the shared setup overlay saves those requirements. See [Phase 5 evidence](docs/phase-5-verification.md).
- Phase 6 adds durable audience Q&A using saved presentation audience and selected slide takes. New recording workflows admit one initial question set; changes mark it outdated and require an explicit update. Answers retain their own recording identity and cached transcription through retries. Saved Q&A remains playable in the existing screen. Apply backend migrations before loading this client against an older API. See [Phase 6 evidence and device limits](docs/phase-6-verification.md).
- New imports initialize saved requirements to **General audience** and **5 minutes**, using existing context APIs and labeled defaults in the current screens. Existing presentation preferences are preserved; the shared setup overlay can edit these values. [Verification](docs/presentation-defaults-verification.md).
- Feedback supports Gemini or OpenAI through backend configuration and is **disabled by default**. Suggestions link to evidence; they still require human judgment.
- Limited agent-operated physical-phone checks are recorded in the active prompt log. Full device flow and human usefulness testing remain pending. This is a local development setup; authentication and production deployment remain separate work.
- [Verification evidence and remaining limits](docs/verification.md) distinguish automated tests, agent-operated emulator checks and controlled provider evaluation. Sample previews remain separate from real results.

## Quick start

Automatic presentation scoring now uses the existing durable feedback jobs. It produces validated overall and per-slide scores, refreshes after synchronized input changes, and retains explicit failure/uncertainty recovery. Existing review screens show level colors, direct advice and evidence; Home shows the overall score, total findings, duration and WPM. See the [v2 contract](docs/presentation-score-v2.md) and [source snapshot verification](docs/presentation-scoring-source-verification.md). Scores remain provisional; provider usefulness requires human testing.

Step 1 compact feedback requests and cue/feedback reliability are integrated alongside scoring. Cached cues reconnect after connection failures, pause in the background or while covered, and resume on return. New feedback remains independent per slide; discontinued grouping and experiment tools are removed. See [compact context](docs/feedback-compact-context.md) and [retained-feature verification](docs/retained-features-verification.md).

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

1. On Home, pull up to add a PDF. After slide analysis, choose a 1–30 minute presentation time and audience in the setup overlay, then tap the checkmark. Choices synchronize through the existing presentation context API; offline saves remain pending and visible. Tap **Edit time & audience** in the idle recording header to edit them later. Conflicts offer Use server or Keep mine; dependent AI updates wait for synchronization.
2. Record while navigating forward or backward through slides, then finish the recording. Repeated visits retain their source audio times.
3. With the server available, the app uploads the PDF/audio and starts transcription after first-use ElevenLabs disclosure covering audio and visited-slide vocabulary hints. If upload or transcription fails, use the saved recording details to retry.
4. Open a presentation from Home. The normal recording layout shows the selected slide's Must Cover and Further Insight cues before and during capture. Tap Play beside Cues to play or pause its saved audio when not recording. Rotation enlarges the PDF; returning restores the current slide's Cues panel. Retaking a recorded slide opens the existing comparison screen, where you choose **Keep current** or **Overwrite**. The new recording stays pending until you decide. If a capture is interrupted, tap the status beneath the timer to inspect and recover its audio; close the sheet and tap again to inspect another interrupted capture. A recovered redo uses the same choice.
5. After a new selected recording is transcribed, its first feedback starts automatically. In Review, select a recorded slide. The AI status ring and page-level feedback show up to four verified findings. Expand Details & evidence, then use **Listen at…** and **Play evidence** to hear the original bounded interval. Use **Update feedback** after confirmed transcription corrections. Legacy take-level suggestions remain under Recording tools.
6. The first saved recording opens Full Review; later recordings use the selected slide review. Keep/Overwrite decisions retain their selected slide and return route. Review has a persistent Full Review button above its scroll content.
7. In Review, the transcript appears directly below Play and above AI feedback, highlighting the original timed words as audio plays. Confirmed suggestions, restore, synchronization and sentence playback stay inline. Recording tools retain original-word playback, transcription retries and slide descriptions; remote audio can be downloaded on the same page. Full Review retains saved audio and transcripts; Full Review is also accessible from the Home assessment ring. Home and Full Review share a verified overall score for an exact complete original recording; slide rings and tiles show validated per-slide scores. Home also shows total current findings, recording duration and WPM. Scores start after transcription and refresh after saved corrections/settings synchronize. Failures and uncertain requests require explicit Retry. Full Review warns before playing a run with missing source audio.

- Previously saved local media and cached results remain stored through network or provider failures. Download uncached remote audio directly in Review when needed.
- Refreshing, downloading and replaying do not start transcription or feedback. Opening a presentation may automatically score its selected recordings; unused history is not backfilled. Indicator GET requests never admit work. PDF upload may generate the reusable AI cue profile; failed/uncertain generation requires explicit recovery. Rehearsal coaching generation remains explicit and does not retranscribe audio.
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
