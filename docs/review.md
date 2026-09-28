# Scaffold code review

Target repository: https://github.com/snuhcs-course/swpp-2026-project-team-07

Prepared on `codex/iteration-1-scaffold`, based on the repository's existing `main` commit `191e80d070d05c1e89fbe464767102c4a1fde4f7`. The user reviewed the local scaffold and authorized its upload. This document records the local verification completed before publication; consult GitHub checks for remote CI results.

## Suggested reading order

1. [App routes](../mobile/src/app/_layout.tsx): four screens, Android back navigation.
2. [Library](../mobile/src/features/pdf/LibraryScreen.tsx) and [viewer](../mobile/src/features/pdf/ViewerScreen.tsx): import seam, sample pages, optional audience.
3. [Recording frame](../mobile/src/features/recording/RehearsalScreen.tsx) and [recording interface](../mobile/src/features/recording/service.ts): capture remains a teammate task.
4. [Result frame](../mobile/src/features/transcription/ResultsScreen.tsx): sample, processing, and failed states.
5. [Shared types](../mobile/src/contracts/index.ts) and [API contract](api-contract.md): feature integration agreement.
6. [Backend models](../backend/rehearsals/models.py), [routes](../backend/rehearsals/urls.py), and [worker entry point](../backend/rehearsals/tasks.py).
7. [Compose services](../compose.yaml), [setup instructions](../README.md), and [CI](../.github/workflows/checks.yml).

## Scope

The actual PDF, recording, Whisper, matching, and Gemini implementations are left for teammates in explicit interfaces/stubs. Unfinished HTTP routes return 501 and processing adapters raise `NotImplementedError`. No provider calls or pretend recordings occur. Generated native Android code, dependencies, secrets, and the older schedule draft are excluded from the proposed upload.

## Verification

- TypeScript and Expo lint: passed.
- Android JavaScript export: passed (1,251 modules).
- Android Studio native project generation: passed.
- Django system check: passed.
- Backend tests: 5 passed with in-memory SQLite, then 5 passed against PostgreSQL in Docker.
- Migration consistency: no changes detected.
- Live Docker API: health 200; readiness 200 with PostgreSQL and Redis reachable. Unfinished routes retain the previously verified HTTP 501 behavior.
- Lockfile dry run (`npm ci --dry-run --offline`): passed; this was not a fresh full installation.
- Native APK compilation: passed for `arm64-v8a` using JDK 17 (`:app:assembleDebug`, 455 actionable tasks). The earlier Java 25 build failed during Worklets/CMake setup; selecting JDK 17 resolved it.
- Android 36 ARM64 emulator: APK installed and loaded through the local Metro server. All four screen frames rendered. Checked first/last slide boundaries, forward/backward navigation, selected slide and audience passed into rehearsal, and disabled recording/playback controls. The Library connection check displayed **Connected to OutLoud backend** against the Docker API. Real PDF/audio/AI behavior and a physical device were not tested.
- Docker Compose: configuration validates; both images build; API, PostgreSQL, Redis, and worker run. PostgreSQL migrations apply; the worker responds to Celery ping through Redis. A temporary file written by the API container was read and removed by the worker, verifying shared media storage. These results are local; GitHub CI results are recorded on the pull request.

Dependency installation reported 13 moderate transitive audit entries (no high/critical entries), tracing to Expo's Xcode/UUID tooling and Router's query-string/decode dependency. The suggested automatic fixes downgrade Expo/Router across major versions, so they were not applied. Recheck upstream fixes before deployment. The scaffold uses the current SDK compatibility table and a committed lockfile.
