# Q&A navigation and clearer-expression feedback — October 16, 2026

Contributor: Seoyeon. OpenAI Codex implementation and separate AI review;
no human code-review or usability acceptance is implied.

## Implemented scope

Q&A already had an app-level host alongside initial feedback. Repaired its premature
initial-marker consumption: synchronization failures now remain eligible for safe
background recovery, with a five-second backoff and four-second GET polling while
eligible. Successful/uncertain submission retains the durable one-time marker and
explicit recovery; consumed absent scopes cannot silently backfill. No automatic
question regeneration after corrections or repeated failed-provider requests.

The existing Q&A screen adopts the complete validated question/follow-up batch,
retains answers for the same job and bounds its index to available questions.
Pending states have no Next hint; Next is now an accessible action when available.
The last actual question always identifies the end of the set. This does not force
three questions or make unready questions navigable; one or two remain valid.

Review v3 can critique articulation, ordering, ambiguous references and connections
between ideas using speech evidence. The existing suggestion field can offer a
concise "Clearer way to express this" example preserving meaning and qualifications.
It is future-rehearsal advice, never transcript modification or an STT suggestion.
The output schema, zero-to-four findings cap, original word/visit references and
playback anchors are unchanged. Frozen v2 rules reconstruct historical payloads;
old results remain retained/outdated and require explicit Update feedback.

No incremental recording, new screen, requirements sheet, unrestricted editor,
commit, push or merge. The misleading insufficient-evidence label for rejected
provider evidence remains a separate known issue; source-validation checks were
not relaxed to accept invalid quotes.

## Automated verification

- From `mobile/`: `npm run check` — TypeScript and 288 tests passed.
- From `mobile/`: `npm run bundle:android` — passed; final bundle
  `entry-0f402be7ef2819935259457ab4b463e8.hbc`.
- From `backend/`, using the project's Python environment:
  `python manage.py check --settings=config.test_settings` — passed.
- `python manage.py test --settings=config.test_settings` — 374 tests,
  25 PostgreSQL-only skips; passed.
- `python manage.py makemigrations --check --dry-run --settings=config.test_settings`
  — no changes detected.
- `PYTHONPATH=/private/tmp:. python manage.py test rehearsals.test_slide_review
  rehearsals.test_durable_qa rehearsals.test_cue_guidance
  --settings=phase2_runtime_settings --noinput` — 46 passed in the separate isolated
  PostgreSQL test database, including concurrent admission checks.

The new safe-preflight recovery and Q&A last/pending-state tests failed before the
fix. Interaction tests invoke the real QAScreen gesture handlers with native/design
adapters mocked: one/two/three questions, extra swipe at the last question, pending
controls, pending-to-completed batch without leaving, and reverse navigation.
Hook tests cover concurrent hosts, remounts, offline preflight recovery, uncertain
POST outcomes, consumed markers, pending corrections and no historical backfill.
Backend tests verify speech-only advice/evidence, unchanged source transcript,
versioned saved-payload reconstruction and existing invalid-evidence rejection.
Mobile parser tests preserve outdated v2 results and reject falsely current ones.

Logs: `/private/tmp/qa-expression-mobile-final.log`,
`/private/tmp/qa-expression-bundle-final.log`,
`/private/tmp/qa-expression-backend-final.log`,
`/private/tmp/qa-expression-postgres-final.log`. Logs are temporary, outside Git.

## Independent review and repairs

The separate reviewer identified a removed read of the consumed initial marker.
Restored it while keeping the write at the POST boundary; added a persisted-marker
plus absent-server regression. Follow-up review found no further defects and
independently passed 29 focused mobile tests and 20 backend review tests (one
PostgreSQL skip). It compared frozen v2 rules directly against HEAD byte-for-byte.
Final review inspected staged patch
`2d30060a943ebc3bd4d6979c0f7f851a9eae00fc006325b16eb76b56348fe0b4`,
confirmed no unstaged changes/whitespace errors and independently reran 18 focused
mobile tests after the final polling adjustment. No code findings remained. The
only subsequent change was this documentation accuracy/review-evidence update.

## Physical Android and real provider

On the physical Samsung phone, the saved current Q&A batch contained three completed
questions. Verified actual swipes 1 → 2 → 3, then an extra forward swipe stayed on
3 with the last-question message. No generation or recording occurred during Q&A
navigation. Returned to Review afterward. Screenshot:
`/private/tmp/qa-repair-phone-last.png` (private, outside Git).

One explicit existing Update feedback action for selected Slide 2 admitted a v3
job through the real backend/worker. It completed with one accepted finding and
zero discarded findings; the phone displayed Focus on these. The old rejected v2
result remains retained. That real result was a content finding, so production
expression-advice usefulness remains for human testing; automated mocked-provider
coverage verifies the new advice contract. Screenshot:
`/private/tmp/expression-phone-result.png` (private, outside Git).

No fresh physical microphone recording, offline-device simulation or full new-run
background-start acceptance was performed. Startup recovery is covered by hook
regressions, pending screen interaction by renderer tests, and PostgreSQL/Celery
integration by the real selected-slide update. Android used the existing development
APK with updated Metro source; JavaScript export is not a newly built APK.
