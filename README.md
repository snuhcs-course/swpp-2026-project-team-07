# OutLoud — Iteration 1 Demo

**Team 07 · Android presentation rehearsal app**

Practice with your PDF slides, record your voice, and review a transcript, slide timings, and AI feedback together.

[Watch the demo](docs/demo/iteration-1-demo.mp4) · [Demo slides](docs/demo/Neural_Networks_7_Slides.pdf) · [Detailed setup and walkthrough](docs/iteration-1-demo.md)

## Table of Contents

- [Demo Overview](#demo-overview)
- [Technology Stack](#technology-stack)
- [Environment & Prerequisites](#environment--prerequisites)
- [Setup Instructions](#setup-instructions)
- [How to Run the Demo](#how-to-run-the-demo)
- [API Information](#api-information)
- [What This Demo Demonstrates](#what-this-demo-demonstrates)
- [Demo Video](#demo-video)
- [Development & Verification](#development--verification)

## Demo Overview

This `iteration-1-demo` branch contains the mobile app and backend needed to reproduce the recorded flow. It includes the Refactor Design UI and functional dependencies through `ce9f248`; no separate feature-branch merges are required.

### Implemented Features

- **PDF library and practice setup:** import a PDF, preview its pages, and optionally describe the audience.
- **Voice recording and slide tracking:** save an audio recording with chronological slide visits, including repeated and backward visits.
- **Automatic transcription:** a new saved attempt opens review, uploads its PDF/audio, and requests hosted Whisper transcription after the first-use OpenAI disclosure.
- **Synchronized review:** switch between Overview, Slides, and Transcript; play audio, seek from timed words or visits, and inspect time per slide and whole-rehearsal speaking rates.
- **AI feedback:** explicitly generate suggestions, inspect supporting slide/transcript quotes, and seek to the evidence. Saved slide descriptions can be edited; affected feedback becomes stale until explicitly regenerated.
- **Saved practice history:** browse attempts grouped by presentation and reopen recordings. Available media can be downloaded for offline review; upload and analysis failures retain recovery controls.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Android app | Expo SDK 57, React Native 0.86, React 19, TypeScript, Expo Router |
| On-device storage and media | SQLite, Expo Audio, native PDF renderer |
| Backend API | Django 5.2, Django REST Framework |
| Background processing | Celery, Redis 7 |
| Server database | PostgreSQL 16 |
| Speech processing | Silero speech-presence check, OpenAI `whisper-1` |
| Demo feedback provider | OpenAI `gpt-6-luna`, configured on the backend |
| Local development | Docker Compose, Android development client, Metro |

The backend also supports a configurable Gemini feedback adapter. Provider selection and credentials stay on the backend.

## Environment & Prerequisites

- Node.js **24 LTS** and npm.
- Android Studio, **JDK 17**, Android SDK Platform 36, and Android platform-tools (`adb`). Use JDK 17 for both the shell and Android Studio's Gradle JDK.
- Docker with Docker Compose.
- An Android phone with USB debugging enabled, or an Android emulator. The submitted video uses a **Samsung Galaxy S23 Ultra (SM-S918N)**.
- Internet access and backend provider credentials for real transcription and feedback. Provider calls may incur charges.

Local PDF import, recording, and replay work without provider keys. Native PDF, audio, and SQLite modules require the Android development build; use the build below rather than Expo Go.

## Setup Instructions

### 1. Clone the Demo Branch

```sh
git clone --branch iteration-1-demo --single-branch https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07
```

### 2. Configure and Start the Backend

```sh
cp backend/.env.example backend/.env
```

Edit the ignored `backend/.env`:

| Setting | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `FEEDBACK_ENABLED` | `true` |
| `FEEDBACK_PROVIDER` | `openai` |
| `FEEDBACK_OPENAI_MODEL` | `gpt-6-luna` |
| `FEEDBACK_OPENAI_PROJECT_ID` | The project used by your key |
| `FEEDBACK_OPENAI_RPM` / `FEEDBACK_OPENAI_TPM` | Positive application allowances appropriate for your account |

Keep the other local defaults. These application allowances are not a monetary cap or a guarantee of provider capacity; the detailed [configuration notes](docs/iteration-1-demo.md#2-start-the-backend) explain admission accounting. Never put keys in `EXPO_PUBLIC_*` or commit `.env` files.

```sh
docker compose up --build
```

Keep this terminal running. Compose starts the API, database, Redis, worker, and scheduler, and applies migrations. In another terminal at the repository root, verify readiness:

```sh
curl --fail http://127.0.0.1:8000/api/health/
curl --fail http://127.0.0.1:8000/api/ready/
docker compose exec worker celery -A config inspect ping
```

### 3. Build and Start the Android App

Connect the phone, accept its USB debugging prompt, and confirm it appears as `device` in `adb devices`.

```sh
cd mobile
npm ci
cp .env.example .env
```

Set `mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api
EXPO_PUBLIC_UI_LAYOUT=refactor
```

Then build and launch:

```sh
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081
npm run android -- --device
```

Select the physical phone when prompted. Keep USB connected and Metro running. The first build downloads native dependencies and can take several minutes.

For later sessions, start the backend with `docker compose up`, run `npm start` from `mobile/`, repeat the port-forwarding commands, and open the installed app. Restart Metro after changing `.env`. If Metro selects a different port, forward that port instead of 8081. For an emulator, use `http://10.0.2.2:8000/api` as the API URL.

See [detailed Android setup](docs/iteration-1-demo.md#3-build-and-open-the-app-on-a-physical-android-phone) for macOS PATH/JDK setup and multiple-device notes.

## How to Run the Demo

1. Copy the included [Neural Networks PDF](docs/demo/Neural_Networks_7_Slides.pdf) to the phone. Open OutLoud → **Import PDF** and select it.
2. Preview the slides and enter an audience, such as “students learning about machine learning.”
3. Start a rehearsal, record your voice, and move forward and backward through slides. Stop to save the attempt.
4. Review the upload/transcription state. Accept the first-use OpenAI disclosure if prompted. The PDF/audio upload happens before that disclosure; cancelling leaves the server upload saved.
5. Explore **Overview**, **Slides**, and **Transcript**. Play the recording, tap a timed word or slide visit, and inspect slide totals.
6. Select **Generate feedback**, accept its separate provider disclosure if prompted, and wait for the result. Expand supporting quotes and use **Review evidence** to seek to the linked moment.
7. Record another attempt, then open **Practice** to see both attempts grouped under the presentation.

The [extended walkthrough](docs/iteration-1-demo.md#4-simple-feature-walkthrough) also covers editing slide descriptions and regenerating stale feedback. Reading history, switching review tabs, or replaying audio does not generate new coaching. AI wording may differ between runs.

## API Information

This demo uses a local development backend. No public production API is required.

| Endpoint | Purpose |
| --- | --- |
| `http://127.0.0.1:8000/api` | API base for the USB-forwarded phone |
| `/api/health/` | API liveness |
| `/api/ready/` | Database and broker connectivity |

A successful readiness response does not establish worker readiness; use the Celery ping above. Database and media persist in Docker volumes. Keep those volumes when restarting a demo whose recordings should remain available.

For upload, transcription, alignment, feedback, retry, and timestamp formats, see the [API contract](docs/api-contract.md). The local configuration is not an authenticated production deployment.

## What This Demo Demonstrates

The submitted recording shows PDF selection and preview, audience entry, a new spoken rehearsal with repeated slide visits, completed transcription, slide timing summaries, playback and seeking, completed AI suggestions with supporting quotes and evidence seeking, another recording, and grouped saved attempts.

The opening minute also browses an older silent rehearsal. The new neural-networks rehearsal starts around **1:50**; its results appear around **3:10**. The earlier no-speech result is separate from the new spoken attempt.

Current limits are **10 slides**, **20 MiB per PDF**, **10 minutes per capture**, and **25,000,000 uploaded audio bytes**. Speaking-rate estimates use total rehearsal time, including silence.

Description editing/regeneration, offline downloads, and failure recovery are implemented but not demonstrated in this recording. Selected-slide retry selection, attempt comparison, spoken key-idea summaries, filler/pause flags, per-slide pace, and full attempt/deck deletion are outside this snapshot. **Remove PDF** only removes the local library PDF.

## Demo Video

**[Watch the Iteration 1 demo (MP4)](docs/demo/iteration-1-demo.mp4)**

A **6:42** screen recording made by the user on a physical Galaxy S23 Ultra. The repository copy retains the full timeline and original AAC audio, with smaller video dimensions for packaging. No captions were added.

| Approximate time | Feature |
| --- | --- |
| 0:00 | Home, existing presentation and saved review |
| 1:05 | Import neural-networks PDF, preview slides and enter audience |
| 1:50 | Record speech while moving between slides |
| 3:05 | Automatic processing, transcript completion and timing summary |
| 3:30 | Request feedback; inspect slide totals and chronological visits |
| 4:05 | Audio controls, visit seeking and transcript word highlighting |
| 4:55 | Completed feedback, evidence seeking and supporting quotes |
| 5:50 | Record another attempt |
| 6:25 | Grouped Practice history |

See the [recording and verification record](docs/iteration-1-demo.md#recording-and-verification-record) for inspection coverage and limits.

## Development & Verification

```sh
cd mobile
npm run check
npm run bundle:android
```

With Compose running, from the repository root:

```sh
docker compose exec api python manage.py check --settings=config.test_settings
docker compose exec api python manage.py test --settings=config.test_settings
docker compose exec api python manage.py makemigrations --check --dry-run --settings=config.test_settings
```

The prepared snapshot passed **300 mobile tests**, TypeScript, lint/layout-boundary checks and Android JavaScript export. Backend system/migration checks and **277 SQLite tests (18 PostgreSQL-only skips)** passed using the existing Python environment. These results do not claim a fresh native APK or Docker-image build. Real database/worker checks, independent AI review, and device evidence are recorded with their boundaries in [AI-use](docs/ai-use.md).

Start new work from updated `main` on a task branch. Follow the submitted team agreement on teammate review/testing before push, then use pull requests for merge review. Follow [AGENTS.md](AGENTS.md) for staged review and user final inspection; AI review is separate from human approval. Never force-push shared history.

- [Setup explained](docs/setup-explained.md)
- [Feature boundaries and team handoff](docs/iteration-1-handoff.md)
- [Work division](docs/team-work-division.md)
- [Requirements mapped to implementation](docs/source-alignment.md)
- [Verification and review](docs/review.md)
- [Transcription pipeline](docs/whisper-transcription.md) · [Alignment](docs/word-alignment.md)
- [AI feedback implementation](docs/ai-feedback.md) · [Feedback evaluation](docs/feedback-evaluation.md)
- [Frontend layout contracts](docs/ui-layouts.md)

Historical checkpoint results and prior phone-session configurations remain in their linked records; use this README and the branch-specific demo setup for reproduction.
