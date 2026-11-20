# <img src="docs/design/figures/svg/outloud-logo.svg" alt="OutLoud" width="220" height="64" align="absmiddle"> · Team 07

OutLoud is an Android presentation rehearsal app for students and professionals. Users can upload PDF slides, record rehearsals, and receive feedback on their delivery. OutLoud uses AI to transcribe rehearsals, evaluate how well speakers cover each slide, suggest improvements, and generate audience questions and follow-ups for Q&A practice.

<a name="try-the-published-demo-flow"></a>

## Try the v10 demo

https://github.com/user-attachments/assets/1785e1b9-d7e4-4816-b370-2897a807dabf

[Download the v10 APK](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/download/outloud-demo-v10-20261115/OutLoud-demo-v10-live-feedback.apk) for **Android 7.0 (API 24) or later**. Open OutLoud while online and enter the **demo code** from Team 07. [Release details](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v10-20261115)

1. On **Home**, swipe up to import a PDF. Set the audience and presentation length, then tap the **save checkmark**.
2. Before recording, tap the **slide counter** to choose **Live feedback** for feedback as you rehearse or **After Stop** for feedback once you finish. Tap the **record button** and allow microphone access when asked. Use the **rotate button** to switch to landscape.
3. Speak as you move through the slides. Check **Cues** for points to cover.
4. Tap **Stop**. In the review overview, open **Feedback** to read advice or **Listen back** to replay the rehearsal with its transcript.
5. Tap a **slide number** to see feedback for that slide.
6. To retake **one slide**, return to it on the rehearsal screen and tap the record button. To retake the **entire presentation**, press and hold the same button. Confirm the redo.
7. After recording the retake, **Compare takes** opens. Select **Old take** or **New take**, then tap **Keep this take**.
8. From the review overview, swipe up to open **Audience Q&A**. Read the questions and record your answers.

## What Iteration 4 adds

- **Feedback while you rehearse.** Live feedback transcribes audio from completed slides and shows advice while you’re still recording. You can also choose **After Stop** to process the recording when you finish.
- **Updated feedback when you revisit a slide.** OutLoud keeps what you said on earlier visits and updates that slide’s feedback after your new speech is transcribed. Feedback for unchanged slides stays available.
- **Upload recovery and full-presentation review.** If the connection drops during a live rehearsal, OutLoud keeps recording and uploads the pending audio when you reconnect. After you tap **Stop**, you can review completed slide feedback while feedback for the full presentation is still processing.

<a name="quick-start"></a>

## Local Setup

Install Git, Node.js 24 LTS (minimum 22.13), npm, Docker Compose, Android Studio, Android SDK Platform 36, and JDK 17. Set `JAVA_HOME` and Android Studio’s Gradle JDK to JDK 17.

### 1. Start the backend

```sh
git clone https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07
cp -n backend/.env.example backend/.env
docker compose up -d --build
```

The API applies migrations on startup. Once it starts, check readiness at `http://127.0.0.1:8000/api/ready/`.

### 2. Run the Android app

```sh
cd mobile
npm ci
cp -n .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `mobile/.env` for your device.

- **Emulator.** Start an Android Studio emulator and use `http://10.0.2.2:8000/api`.
- **USB-connected phone.** Enable USB debugging and use `http://127.0.0.1:8000/api`. Run `adb reverse tcp:8000 tcp:8000` for the API and `adb reverse tcp:8081 tcp:8081` for Metro.

Run `npm run android` from `mobile/` to build and install the development client. Keep Metro running while you use it. [Local development guide](docs/local-development.md)

<a name="configuration-and-limits"></a>

### 3. Enable AI features

Add `ELEVENLABS_API_KEY` and `OPENROUTER_API_KEY` to `backend/.env`. Set `FEEDBACK_V3_ENABLED=true` and `INCREMENTAL_CAPTURE_ENABLED=true` for Live feedback. Set `FEEDBACK_V3_AUTO_START=true` to start feedback automatically after transcription in **After Stop** mode. Slide cues and Audience Q&A also require `FEEDBACK_ENABLED=true` and provider quotas. [Provider configuration](docs/reference/ai-feedback.md#provider-configuration-and-operational-bounds)

After editing `backend/.env`, run `docker compose up -d --force-recreate api worker scheduler` from the repository root.

## Checks

Run the mobile type check, lint, and tests from `mobile/`.

```sh
npm run check
```

Run the Django test suite from the repository root with Docker Compose running.

```sh
docker compose exec api python manage.py test --noinput
```

### v10 results

On November 15, 2026, v10 (`5745502`) passed **669 mobile tests** and **710 backend tests on PostgreSQL**, with zero skips. Phone checks covered both **Live feedback** during recording and **After Stop** processing. [Automated test results](docs/testing/evidence/incremental-phone-test-2026-11-15.md#resumed-azure-phone-check) · [Phone checks](docs/testing/evidence/incremental-phone-test-2026-11-15.md#final-v10-phone-checks)

See [Testing Documentation](docs/testing/testing.md#4-acceptance-testing-starting-from-iteration-3) for acceptance testing and the [testing index](docs/testing/README.md#earlier-iterations) for the Iteration 3 heuristic evaluation archive.

## Known Limitations

- **Shared demo access.** Home only shows presentations in your device’s library. Anyone with the demo code and the direct server URL for an uploaded slide deck or recording can open that file. Use sample slides and recordings for the demo. [Hosted access](docs/azure-hosting.md#access-and-data-boundary)
- **UI bugs.** Some screens still have layout issues. For example, Home hints can overlap the PDF import progress screen when offline, and cue status text can be clipped at larger Android text sizes.
- **Rubric validation.** We still need to check how closely OutLoud’s scores match independent human ratings on real presentations and whether presenters find the feedback useful.

## Repository and Documentation

| Folder | What’s inside |
| --- | --- |
| `mobile/` | Android app and mobile tests |
| `backend/` | Django API, background workers, and backend tests |
| `deploy/` | Hosted demo configuration and maintenance scripts |
| `tools/` | Coverage reporting tools |
| `docs/` | Project documentation and technical references |
| `outputs/` | Original course submission archives |

- **Project documentation** — [Requirements and Specifications](docs/requirements/requirements-and-specifications.md) · [Design](docs/design/design-documentation.md) · [Testing](docs/testing/testing.md) · [Full documentation index](docs/README.md)
- **Course records** — [AI collaboration](docs/ai-collaboration/README.md) · [Meeting notes](docs/meetings/README.md) · [Project Wiki](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki) · [Submitted archives](outputs/README.md)
