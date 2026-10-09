# Combined UI, automatic transcription and feedback phone test

Historical setup notes from before the swappable-layout refactor. The active local branch is now `codex/refactor-design`, with published functional dependency `ce9f248` (PR #21). The previous branch/base and staged-repair references below describe that earlier session; current verification is recorded in [AI-use](ai-use.md#2026-10-09--swappable-frontend-extraction-refactor-design).
Prepared 2026-10-09 (Asia/Seoul). Mobile source is the staged `codex/frontend-prototype` worktree, based on `feature/ai-feedback` a850424, with the automatic-transcription change adapted from the staged `codex/automatic-transcription` worktree. No commit or push is implied.

## Current session

- Physical Galaxy S23 Ultra (SM-S918N), connected over USB. The compatible frontend development APK was installed with `adb install -r`; app storage was not cleared.
- Metro: `http://127.0.0.1:8085`, serving the combined frontend. API: `http://127.0.0.1:8011/api`, forwarded over USB. Keep the phone connected and Mac awake while testing.
- API/worker/Beat use the existing local `ai-feedback` worktree and its staged oversized-slide-image repair, with real PostgreSQL and Redis. This setup does not merge or modify that backend worktree.
- Whisper transcription and OpenAI `gpt-6-luna` feedback are configured. Feedback generation stays explicit, separate from transcription. Existing testing quota configuration is retained; provider limits still apply.
- Existing recordings and presentations are retained. The latest UI was observed on the physical phone at Practice setup with the existing deck.

## Try the complete flow

1. Open an imported PDF on Home, or use Import PDF. PDF limits are 20 MiB and 10 slides.
2. Start rehearsal, speak for 30–60 seconds and visit slides 1 → 2 → 1 → 3. Stop when ready.
3. After durable saving, review opens automatically and uploads the PDF/audio. First-use OpenAI disclosure requires Continue before transcription; existing consent can make transcription start immediately. Cancelling leaves manual Analyze available.
4. Check Transcript for recognized speech and tap a timed word to seek. In Slides, check actual visit ranges and total seconds across return visits. Overview shows actual duration and available estimates.
5. Choose Generate feedback and review its separate provider disclosure when shown. Inspect the suggestions and use Review evidence to jump to Slides and the relevant audio time.
6. Return to Practice to see attempts grouped under the presentation. To record again, return to setup or use Record again on the saved completion screen behind review.

Failed upload/analysis retains the recording and explicit recovery controls. Older recordings do not start processing just because they are opened. Tab changes, refresh, playback and downloads do not generate coaching. An uncertain prior provider request still requires its own retry confirmation.

## Evidence boundary

Setup verifies installation, rendered physical-phone UI, API/database/broker health and a responding live worker. Automated tests cover automatic handoff, disclosure cancellation, duplicate prevention, API/foreground scoping and the existing review/player behavior. A new full physical recording-to-transcript-to-feedback run, audible recording quality, speech recognition accuracy and human evaluation of advice remain for the user to test; setup is not acceptance evidence for those outcomes.
