# Verification commands and evidence

**Status: Current command reference with clearly labeled historical results.** New
results must be recorded under `docs/evidence/iteration-2/<area>/`.

- Commands and dated evidence relocated from README on October 13, 2026.
- Historical counts below describe separate snapshots; they are not new test runs or a combined total.
- Automated checks and agent-operated emulator/provider checks do not establish human approval or physical-phone validation.

## Routine and integration checks

Run each command block from the repository root in a separate terminal, using the environment prepared in the [local development guide](local-development.md).

```sh
cd mobile
npm ci
npm run check
npm run bundle:android
```

```sh
cd backend
.venv/bin/python manage.py check --settings=config.test_settings
.venv/bin/python manage.py test --settings=config.test_settings
.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings
```

Unit tests use in-memory SQLite. PostgreSQL-specific processing/upload/description/coaching races are explicitly skipped there. Run them separately against the real test database with `.venv/bin/python manage.py test rehearsals.test_processing.ConcurrentProcessingTests rehearsals.test_storage.ConcurrentUploadTests rehearsals.test_descriptions.ConcurrentDescriptionTests rehearsals.test_coaching.ConcurrentCoachingTests --settings=config.settings` from `backend/` with test-database privileges. Never substitute SQLite for that evidence. Verify scheduler restart, missed broker publication, worker termination before/after submission and after raw persistence, Android lifecycle/cache/replay, and a consented hosted pilot separately.

A submitted marker means a request may have reached the provider. SDK timeout is 120 seconds, task limit 300 seconds, and claim expiry 360 seconds. Automatic provider/SDK retries are disabled. Received raw output and successful transcripts are reused. Ambiguous outbound failures require explicit acknowledgement before a new generation; this does not promise provider exactly-once execution or a monetary cap.

## Historical evidence snapshots

### Rehearsal review snapshot

The rehearsal-review snapshot passed independent AI review, **209 mobile tests**, TypeScript/lint and Android export. Coordinator checks passed Django system/migration checks, 74 tests on real PostgreSQL, API restart/media retrieval, and Android emulator review/recovery checks using the saved synthetic Whisper pilot without another provider call. Physical-phone/audible quality, native interruption/API-switch stress cases and human review remain pending. See [final evidence](../archive/iteration-1/ai-collaboration/raw/ai-use-before-stack-consolidation-2026-10-11.md#2026-10-08--rehearsal-review-final-verification-and-publication) for exact coverage, review repairs and limitations.

### Feedback checkpoint 2

Checkpoint 2 passed independent AI review, Django system/migration checks and
172 tests on real PostgreSQL. Synthetic checks verified Redis/Celery/Beat
recovery and API/database restart with unchanged saved media. See the
[checkpoint evidence](../archive/iteration-1/ai-collaboration/raw/ai-use-before-stack-consolidation-2026-10-11.md#2026-10-08--ai-feedback-checkpoint-2-coordinator-handoff).
Human inspection remains pending. Checkpoint-4 coordinator evidence for the mobile
feedback controls is linked in the checkpoint-4 snapshot below; live-provider quality is evaluated separately.

### Feedback checkpoints 4 and 5

Checkpoint 4 passed independent review, **270 mobile tests**, TypeScript/lint,
Android JS export, Django system/migration checks, **229 SQLite tests (18 skips)**
and **229/229 real PostgreSQL tests**. Agent-operated emulator checks covered
disclosure/cancellation, editing/staleness/regeneration, offline restart and evidence
seek with synthetic providers. See [coordinator evidence](../archive/iteration-1/ai-collaboration/raw/ai-use-before-stack-consolidation-2026-10-11.md#2026-10-08--checkpoint-4-coordinator-verification).
The final checkpoint-5 backend passed **247 SQLite tests (18 PostgreSQL-only skips)**, **247/247 PostgreSQL tests**, system/migration checks and independent review. Real-worker saved-v2/new-v3 receipt recovery preserved one provider-stub call per case. Controlled `gemini-3.1-flash-lite` and `gpt-6-luna` description/coaching runs each completed two synthetic cases without another Whisper request; refresh, duplicate jobs and restart reused results. All seven accepted live cards passed mobile parsing/seek validation. The [evaluation record](../evidence/iteration-1/ai-feedback/controlled-evaluation.md) includes earlier Gemini rejections, diagnostic calls, partial output, token usage and agent-assessed quality limits. Physical-phone listening/synchronization, accessibility, extended text/keyboard usability and human usefulness testing remain pending.

## Evidence navigation

- [Original scaffold review](../archive/iteration-1/scaffold-review.md): historical foundation checks, not the current feature suite.
- [Feature implementation and recovery evidence](../archive/iteration-1/ai-collaboration/raw/ai-use-before-stack-consolidation-2026-10-11.md): dated checks and limitations for the integrated features.
- [Feedback checkpoint ledger](../features/ai-feedback/reference.md#five-checkpoint-ledger): distinguishes each checkpoint's scope and evidence.
- [Controlled provider evaluation](../evidence/iteration-1/ai-feedback/controlled-evaluation.md): synthetic cases, earlier failures, usage and agent-assessed quality limits.
- Remaining work includes physical-phone listening/synchronization, native interruption/API-switch stress cases, accessibility, extended text/keyboard usability, and human usefulness testing.
