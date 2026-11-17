# Phase 6 — durable audience Q&A execution ledger

Base: `6a4dfb11afdc7990759a5ca0bf150460174b25d4`, isolated `it2/feature/ai_feedback` checkout.
User authorized Phase 6 implementation. No commit, push, merge or Phase 7.

Plan: bind questions to selected sources and saved audience; reuse profile-backed durable
feedback jobs; persist answer bindings and reuse the original recording/STT processing;
retain historical output and local recordings; integrate the existing Q&A screen;
verify revisions, deduplication, failures and Android interactions; independent review.

Ruling: legacy Q&A endpoints remain compatible. New versioned endpoints consume a
validated selected-run manifest rather than trusting client-supplied transcript text.
Answer processing reuses Attempt and its durable Whisper receipt/recovery pipeline.
No requirements sheet, new screen, custom transcript editing or external research.

Implementation is staged for human inspection. Automated and agent-operated checks below do not establish human usefulness or a complete physical-phone submission flow.

Ruling: Phase 6 automatic eligibility is marked only by a new recording's explicit
transcription handoff, separately from Phase 5 eligibility. Installing this phase or
opening existing recordings must not silently backfill provider calls. Historical
recordings can use the existing Q&A retry/update control explicitly.

## Verification evidence

- Baseline: `python manage.py test rehearsals.test_qa rehearsals.test_slide_review
  --settings=config.test_settings` from backend: 26 tests, one PostgreSQL skip.
- Initial new-route tests failed because `/audience-qa/` was absent; the initial
  selected-run mobile test failed on the absent module. The implemented focused
  backend cases and mobile state/client/workflow regressions now pass.
- `npm run check` from mobile: typecheck/lint pass, **274 tests passed**.
  The pre-existing useSegmentPlayer cleanup-ref warning and test-renderer deprecation
  notices remain. No new lint errors/warnings.
- `npm run bundle:android`: passed; final export
  `entry-575888e574c2f193f90571eb66ee19cb.hbc`.
- `python manage.py check --settings=config.test_settings`: passed.
- `python manage.py makemigrations --check --dry-run --settings=config.test_settings`:
  no changes detected after adding `0009_qaanswer`.
- Full SQLite suite: **367 tests, 25 skips**, passed. Full PostgreSQL suite:
  **367 tests, one host-dependency skip**, passed, including concurrent Q&A
  admission and existing regression/migration/concurrency tests. PostgreSQL ran
  against a disposable Django test database, not the phone database.
- Separate full-dependency Docker worker, actual PostgreSQL and Redis, isolated queue,
  mocked provider transport with no credential mount: two question task deliveries
  produced one request; two answer-evaluation deliveries produced one request.
  Cached profiles were reused; durable answer recovery completed. Migration forward,
  reverse to 0008, and forward to 0009 preserved the seeded source Attempt exactly.
  Temporary verification container and `phase6_worker_verify` database were removed.

Commands above use the existing backend Python environment. Local log artifacts:
`/private/tmp/phase6-baseline-backend.log`, `phase6-red.log`,
`phase6-focused-mobile.log`, `phase6-mobile-final.log`, `phase6-bundle-final.log`,
`phase6-backend-final.log`, `phase6-pg.log`, `phase6-worker.log` (all under
`/private/tmp/`). Automated provider responses are synthetic, not real model quality.

## Android observations and limits

Agent-operated emulator checks used the existing explicitly labeled synthetic
presentation and temporary synthetic Q&A cache values. Verified existing Q&A layout,
main/follow-up navigation, saved answer playback (visible pause state), prior question
history, and native answer capture/local persistence with a new UUID (9,528 ms).
The observed history-control overlap was repaired; duplicate play controls were removed.

During initial checks, the API on port 58000 was the previous code loaded with `--noreload`. Native
answer submission correctly reported the missing Phase 6 route. The attempted test
interceptor covered global fetch, while the client uses Expo fetch; it therefore did
not intercept the real upload. One generated emulator test answer reached only the
isolated local backend. No processing/provider request ran. Exact ID/deck/duration,
pending state, zero processing revision and absence of provider requests were verified
before removing only that generated backend row/file. The original synthetic fixture
was preserved. Temporary emulator cache values were restored and only the new local
test audio/key was removed. This failed interception is not reported as successful
end-to-end submission. No user's recording/transcript/correction was changed.

Screenshots outside Git: `/private/tmp/phase6-qa.png`, `phase6-playing.png`,
`phase6-followup.png`, `phase6-recorded.png`, `phase6-history.png`,
`phase6-history-playing.png`. UI Automator could not obtain idle state while animations
were active; actual screenshots/native taps and cached metadata were inspected instead.
No Phase 6 physical-phone flow or live-provider usefulness acceptance is claimed.
The subsequent availability repair below updates the isolated runtime; full answer submission and human usefulness testing remain pending.

## Review and inspection gate

Separate AI review found and prompted repairs for failed profile-dependency recovery,
explicit follow-up question context, outdated-current history availability, and
same-job correction synchronization initializing answer storage. Client/state/workflow
regressions cover these paths. Final independent AI review of all 29 staged files found no remaining concrete findings and independently reran 14 focused mobile tests successfully. Staged whitespace and working-tree/index parity checks passed. Human inspection
remains pending. No commit, push, merge, requirements-sheet work or Phase 7.

## Physical-device acceptance checklist (after API migration/restart)

1. Complete a new recording with the saved intended audience. Its first question set
   should start once after selected recordings finish transcription, without opening
   Q&A. An old recording should require its explicit Q&A action.
2. Open/reopen Q&A and play questions/answers: no additional generation. Check one
   to three questions and follow-ups are appropriate to audience and deck purpose.
3. Record a main answer and follow-up; reopen while processing. Audio/identity should
   survive and processing continue. Retry evaluation without a second transcription.
4. Rerecord: a new answer ID, with old media retained. Retry failed/uncertain work
   explicitly; repeated taps must not duplicate active/completed provider work.
5. Confirm a recognition correction or accept a slide retake. Q&A should become
   outdated, retain prior playback through Saved Q&A, and update only explicitly.
6. Test offline saved playback, pending correction synchronization/conflicts, failed
   profiles and uncertain submissions. Verify clear states and recovery. Check
   Keep/Overwrite, Review navigation and transcript playback for regressions.


## Phone Q&A availability repair (October 16)

Contributor: Seoyeon. User reported “Im getting that Audience Q&A is offline or unavailable”.
Two causes were independently verified:

1. The reachable development API returned 404 for the new Q&A route. Applied only
   the additive 0009 migration to the existing isolated phone database, restarted
   its API and full-dependency worker, resumed the existing configured recovery
   scheduler, and restored USB forwarding. Original env files/media were preserved.
2. Real GET then returned 200/available, but the mobile parser still rejected it:
   JSON.stringify compared object insertion order. Pydantic inheritance serializes
   slide_index/segments/attempt_id; the client builds slide_index/attempt_id/segments.
   Replaced this with structural comparison of context, ordered slide/source IDs,
   segment counts and exact ordered start/end bounds. Added a regression observed
   failing before the fix, passing afterward, including rejection of changed bounds.

Verification: `npm run check` passed **275 tests**, typecheck/lint (existing ref warning);
`npm run bundle:android` passed with
`entry-bbdae152c2025190003213a6d1280be3.hbc`. Separate AI review independently reran
**15 focused tests**, checked malformed/foreign-scope rejection, and found no defects.
Backend code/schema contract was unchanged by the parser repair; prior backend gates
remain applicable. Runtime worker returned pong. Through the physical phone, Q&A
now reports available/completed/current with **three questions**, no error, and an
empty offline notice. This verifies real question generation/display, not question
usefulness or complete spoken-answer submission. No commit, push or merge.

Local evidence: `/private/tmp/phase6-field-order-red.log`,
`/private/tmp/phase6-field-order-green.log`, `/private/tmp/phase6-availability-mobile.log`,
`/private/tmp/phase6-availability-bundle.log`.
