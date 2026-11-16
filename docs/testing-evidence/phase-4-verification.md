# Phase 4 execution and verification ledger

**Historical implementation evidence:** The later recognition-only product
amendment supersedes manual/custom editing, legacy edit adoption and v1 cache
behavior described below. See [current behavior, checks and device checklist](phase-4-recognition-only-verification.md).

Base: `ee6233be2875739c6c9f8d2c62e9878e4ab759b7`, isolated
`it2/feature/ai_feedback` checkout. User authorized implementation of the amended
Phase 4 only. No commit/push/merge, new screen, Phase 5 summary or requirements
sheet is authorized.

## Design decisions

- `TranscriptCorrection` stores a complete, revisioned, nonoverlapping set of
  original-word-index overlays per attempt. Original Whisper transcript, audio,
  visits and processing generation are never rewritten. Effective text preserves
  source punctuation when the original words map to the original text.
- Correction PATCH is persistence only: no job admission, deletion or provider
  work. No-op effective text keeps the revision. Expected revision conflicts even
  when another writer saved equivalent edits.
- `FeedbackAnalysis` is unique per attempt/analysis type; existing records keep
  `coaching`. `transcription_suggestions` reuses durable jobs, quota reservations,
  receipts and recovery, but has its own prompt/output validation and results.
  It currently reuses the existing description prerequisite for slide context.
  This is separate from the immutable Phase 2 cue/profile cache.
- Coaching source snapshots retain original evidence plus confirmed correction
  overlays/effective text/revision/version. The provider analyzes corrected text
  while quotes and playback indexes remain original evidence. No synthetic word
  timings are assigned to rewritten sentences.
- Existing whole-attempt coaching consumes the full transcript, so any confirmed
  text change invalidates that attempt's output. Other attempts, audio metrics
  and slide-only cue caches remain intact. Fine-grained per-slide findings remain
  Phase 5 work.
- Local SQLite correction state is API/attempt scoped and independent of
  `deck:v1`; legacy edits are retained. Pending/conflicted edits immediately make
  feedback outdated. Explicit feedback requests synchronize before admission.
- Migration 0008 preserves legacy rows. Downgrade is allowed before new Phase 4
  records exist; afterwards it refuses rather than deleting corrections or
  multiple analysis types. Application/database rollback must retain 0008 until
  new data is explicitly archived/reconciled. Old and new worker processes must
  not overlap after multiple analysis types are admitted (old queries lack the
  analysis-type filter).

## Baseline

- Mobile `npm run check`: 215 tests passed, typecheck/lint passed. Initial sandbox
  cache-write failure was rerun with authorized filesystem access.
- Backend `python manage.py test --settings=config.test_settings`: 321 tests,
  passed, 21 skips. SQLite skips are not PostgreSQL evidence.
- Working tree was clean; branch/HEAD verified before edits.

## Final verification

Commands run in the isolated checkout unless a container is named. Backend host
commands use `/Users/seoyeonpark/Documents/ChatGPT/OnLoud/backend/.venv/bin/python`.
All provider calls in Phase 4 automated/runtime verification were mocked.

| Check | Command / evidence | Outcome |
| --- | --- | --- |
| Mobile types, lint, tests | `cd mobile && npm run check`; `/private/tmp/phase4-mobile-check.log` | 232 tests passed; types/lint passed. Existing `useSegmentPlayer` cleanup-ref warning remains. |
| Android JavaScript export | `cd mobile && npm run bundle:android`; `/private/tmp/phase4-android-bundle.log` | Passed; this is not an APK/device claim. |
| Django system checks | `cd backend && python manage.py check --settings=config.test_settings` | No issues. |
| Migration completeness | `python manage.py makemigrations --check --dry-run --settings=config.test_settings` | No changes detected. |
| SQLite suite | `python manage.py test --settings=config.test_settings`; `/private/tmp/phase4-backend-tests.log` | 332 tests ran successfully, 23 skipped (including PostgreSQL row-lock cases). |
| PostgreSQL suite | `PYTHONPATH=/private/tmp:. python manage.py test --settings=phase2_runtime_settings`; `/private/tmp/phase4-pg-tests.log` | 332 tests ran successfully, one host dependency skip. Uses a temporary Django test database. |
| Full worker dependencies | `docker exec outloud-phase2-real-worker python manage.py test rehearsals.test_corrections rehearsals.test_correction_migration --settings=config.test_settings`; `/private/tmp/phase4-full-worker-tests.log` | 11 tests ran successfully, two PostgreSQL-only skips. PostgreSQL/full-worker result is separately recorded below. |
| Full worker + PostgreSQL | `docker exec` with isolated `POSTGRES_*` test connection, then `python manage.py test rehearsals.test_corrections rehearsals.test_correction_migration --settings=config.settings`; `/private/tmp/phase4-full-worker-pg-tests.log` | All 11 tests passed, zero skips, including concurrency and migration roundtrip. |
| Runtime migration | `/private/tmp/phase4-runtime-migrate.py`; `/private/tmp/phase4-runtime-migration.log` | Migration 0008 applied; original-model counts and SHA256 row fingerprints unchanged. |
| Runtime migration plan | `python manage.py migrate --plan --settings=phase2_runtime_settings`; `/private/tmp/phase4-runtime-migration-plan.log` | No planned migration operations. |

The migration test executes legacy forward/back/forward transitions and compares
original attempt data. It separately proves downgrade refuses when new correction
or non-coaching analysis data would be lost. PostgreSQL tests exercise two writers
at revision zero (one success/one conflict) and concurrent regeneration (one job).
No provider requests occur in these tests.

### Worker integration

A separate Celery process consumed `phase4-verification-only` from the existing
isolated Redis against a dedicated `phase4_worker_verify` PostgreSQL database.
`/private/tmp/phase4-worker-verification.py` / `.log` record two deliveries per job,
one STT request, one coaching request, correction revision propagation, and no
feedback job admitted by a correction save. The transport/provider was synthetic;
real Redis/Celery/PostgreSQL were used. The child shut down, its private queue was
empty, and the temporary verification database was removed. Existing runtime
media/database and the normal worker queue were retained.

### Regression coverage and review repairs

- Revision/no-op/stale-base validation; originals, audio identity and visits kept;
  retained outdated feedback, late completion fencing and explicit regeneration.
- Independent STT suggestions, exact original-word evidence, corrected coaching
  context, analysis-version invalidation, and cached slide-only cues preserved.
- SQLite offline edits, API isolation, multiple edits, editing during PATCH,
  shared sync, canonical equivalent ACK and JSONB key-order/lost-response recovery.
- Sticky conflicts, explicit server/local choices, boundary-spanning correction
  restore, repeated-term occurrence targeting and per-source dismissal persistence.
- Hook interaction tests: opening reads/synchronizes without AI POST, retry prompts
  cannot follow another take/generation, failed context has an explicit retry.
- Independent review found and prompted repairs for refresh clearing conflicts,
  equivalent-text PATCH loops, retry identity, dependency recovery, lost dismissals,
  legacy edits bypassing completed-feedback gating, and reversed stale STT reads.
  Reproducing tests failed before their fixes and passed afterwards. Final legacy
  inspection is read-only and uses persisted selected runs without native UI imports.
- Final freshness regressions: `/private/tmp/phase4-freshness-red.log` records the
  two failures; the final full mobile suite covers both repaired cases. Stale
  suggestion metadata cannot become current through a delayed equal-generation
  response, and pending edits/revision differences independently fence cached output.

### Android emulator interaction evidence

Agent-operated checks used a newly labeled `Phase4-Synthetic-Corrections`
presentation, mocked transcription/suggestions and synthetic speech audio. Only
new fixture records/catalog alias/audio were added. Original recordings were not
exported or rewritten. The connected physical phone was not operated in Phase 4.

Verified AI replacement saved/synchronized revision 1; cancel retained revision 1;
custom sentence save produced revision 2; another correction produced revision 3;
cold reopen retained saved text; Keep original on the return-visit suggestion
kept revision 3 and original text. Playback started after a correction (pause
control visible) and the return-visit row was navigable. Original word timings
remain unchanged in automated tests; a fresh native active-word highlight was
not captured. Existing selected-run/Keep/Overwrite regression suites passed.

Evidence files are outside Git: `/private/tmp/phase4-after-cancel.json`,
`phase4-after-custom-save.json`, `phase4-after-keep-original.json`,
`phase4-controls-compact.png`, `phase4-editor-cancel-controls.png`,
`phase4-return-suggestion2.png`, `phase4-keep-original-ready.png`, and
`phase4-playback-after-edit.png`. Test seeder DEX permissions/JSON encoding repairs
were harness changes. Removing a reverse port did not establish disconnection;
no offline Android claim is made. Offline persistence/conflicts are SQLite-tested.

## Inspection gate and remaining limits

- Independent AI review of the staged implementation found no actionable findings
  after repairs and reran 17 focused tests successfully. It does not count as
  human review. The final handoff supplies the exact patch, SHA256 and review
  evidence; user inspection is still pending. No commit/push/merge is authorized.
- Physical-phone Phase 4 flows, human audible alignment/usefulness and live
  provider suggestion quality are unverified. Android evidence uses synthetic
  fixtures and does not imply Whisper/provider acceptance.
- If the original STT source digest changes, corrections are retained but blocked
  for explicit reconciliation. Automatic correction rebasing is not implemented.
- Feedback remains whole-attempt analysis; per-slide problem summaries are Phase 5.
  No new screen, held requirements sheet or Phase 5 summary was implemented.
