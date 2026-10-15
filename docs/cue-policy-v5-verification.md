# Cue policy v5 — October 16, 2026

Contributor: Seoyeon. OpenAI Codex implementation and independent AI review;
this does not represent human code review or usability acceptance.

## Scope

New cue generation targets 8–16 words, allowing up to 25 when needed for clarity.
One objective per cue; remove filler instructions, redundant clauses and duplicate
objectives across Must Cover/Go Deeper. Evidence/reasoning stays expandable.
Semantic repetition is addressed by generation instructions, with existing exact
normalized-duplicate rejection retained; there is no heuristic semantic filter or
silent truncation. The target range is guidance; only 25 is a hard limit.

Immutable v5 prompt/schema identities apply the new policy. Successful same-source
v4 caches remain current/reusable for profiles, Review and Q&A; pending and uncertain
v4 jobs retain their scope to avoid duplicate provider work. Failed or absent v4
scopes use v5 for new admission, with existing v5 scopes taking precedence. Explicit
v4 retries and receipt recovery retain their original 15-word policy and digests.
No migration, new screen, requirements sheet, commit, push or merge.

## Automated verification

- From `mobile/`: `npm run check` — TypeScript and 281 tests passed.
- From `mobile/`: `npm run bundle:android` — passed; bundle
  `entry-37553900e01e4da9c585decb6c265a7c.hbc`.
- From `backend/`, project Python environment:
  `python manage.py check --settings=config.test_settings` — passed.
- `python manage.py test --settings=config.test_settings` — 371 tests,
  25 PostgreSQL-only skips, passed.
- `python manage.py makemigrations --check --dry-run --settings=config.test_settings`
  — no changes detected.
- `PYTHONPATH=/private/tmp:. python manage.py test rehearsals.test_cue_guidance
  rehearsals.test_slide_profiles rehearsals.test_slide_review rehearsals.test_durable_qa
  --settings=phase2_runtime_settings --noinput` — 52 passed against the isolated
  PostgreSQL test database, including concurrency checks; no shared data deleted.
- Final focused cue suite after adding v4 golden digests: 14 passed.
- Regression coverage: both categories at 25/26 words, Unicode separators,
  preserved v4 15-word enforcement, v4 cache reuse, active/uncertain job reuse,
  failed-scope upgrade, source/model changes, historical prompt/schema digests,
  saved-receipt recovery, Review/Q&A and mobile cached parsing.

Logs: `/private/tmp/cues25-mobile-check.log`, `/private/tmp/cues25-bundle.log`,
`/private/tmp/cues25-backend-final.log`, `/private/tmp/cues25-postgres.log`,
`/private/tmp/cues25-cache-final.log`. These local temporary logs are not committed.

## Real provider and physical Android

Reloaded the existing isolated API/worker. One v5 generation completed for the
previously failing seven-slide deck; repeated ensure calls reused that job.
All seven slide profiles passed full source/evidence validation. Aggregate result:
17 cues; maximum 19 words; ten within 8–16 and seven between 17–19; no truncation.
Only the title slide had neither category populated. Private slide/transcript text
and credentials are excluded from this record.

GET-only refresh of the physical Samsung phone's existing cue panel returned
completed/current/no error. Inspected screenshots of the title and next content
slide: the content slide displayed new cues with Details collapsed. No recording
was started or modified. Local screenshots remain outside Git:
`/private/tmp/cues25-phone.png` and `/private/tmp/cues25-phone-content.png`.
The Android export is a bundle check; the phone used the existing development APK.
Human cue usefulness/non-repetition acceptance remains pending.

## Independent review

A separate Codex reviewer inspected the exact staged patch
`b2357c4bc907ef2310718497a12824ccc62860a49fa19dc4f80f045ba2791b40`
(including the previously reviewed defaults) and found no remaining defects.
It independently reran 14 backend cue tests and 21 mobile cue/defaults/gate tests,
compared v4 prompt text, schemas and combined digests directly against HEAD for
both providers, and confirmed no unstaged changes. The final addition is this
review-evidence paragraph only; production code and tests remain unchanged.
