# Presentation scoring completion milestones — October 17, 2026

> Historical feature evidence. The current retained-feature integration and cleanup are recorded in [retained-feature verification](retained-features-verification.md). Earlier deployment/test statements below belong to their original checkpoints.


Latest follow-up: [Android scoring workflow and review UI integration](android-presentation-scoring-verification.md)
is implemented and independently reviewed with mocked checks. The entries below
retain the earlier backend checkpoint; device scoring and live-provider quality remain unverified.

Follow-up: the Android zero-duration validation blocker described below is now
repaired in a separate compatibility change. See [the repair and verification](android-scoring-visits-verification.md).
The entries below retain the original backend checkpoint; scoring UI integration was pending at that compatibility checkpoint.

Scope: continue `codex/presentation-score` at artifact commit `234c0e1`; preserve all
existing uncommitted scoring work and the original staging snapshot. No paid calls,
merge, push, cleanup or unrelated commits. Android score UI integration is separate.

## Milestone 1 — singleton cooldown regression

The hook and panel incorrectly reused a saved grouped owner's retry cooldown when
creating a distinct singleton with an available current selection. The fix changes
only the two responsible gates. Existing singleton and profile-dependency cooldown,
active/uncertain ownership, selection assertions and no-auto-retry rules remain.

Generated/incorporated files: `useSlideReview.ts`, `SlideReviewSummary.tsx` and their
workflow/panel tests. Two intended red failures were observed; focused 29/29 and
full mobile 474/474 pass. TypeScript/lint pass with one pre-existing cleanup-ref
warning. Android JS export passes using current router root and cache clearing.
The original mounted reproduction now submits exactly once with no error.
No physical microphone/device or live-provider result is claimed.

## Confirmed backend module contracts

- `presentation_rubric_v2`: exact Fraction arithmetic, approved anchors, three
  slide criteria weighted 40/35/25; four equal whole dimensions; 70% unrounded
  equal slide mean plus 30% whole. Half-up once for published integers; descriptor
  levels use unrounded boundaries and ties select the higher level.
- `presentation_visit_evidence`: a frozen visit-local original-word/certain-fact
  registry plus reconstruction through unchanged trusted v1 provenance checks.
  Corrections aid interpretation; original words/times remain citation authority.
- `presentation_score_v2`: protocol/source identities, preparation, component-level
  validation, normalized public result and private audit for existing durable jobs.
  The model selects anchors and explains them; backend alone computes numbers.

Rubric interpretation: missing evidence withholds scores rather than assigning
zero. Only justified first/last slides may be inapplicable; excluding all slides
cannot manufacture a total. Below-Advanced is an anchored assessment, not an
automatic extra penalty. Explicit shared deductions need distinct supported
consequences. Structural evidence checks cannot establish semantic or educational
correctness. The frozen v1 rubric and receipts stay unchanged.

## Milestone 2 — exact rubric and trusted visit evidence

New modules and focused tests implemented. All 26 independent rubric/evidence tests
pass, including original six visit tests. Additional v1 regression scopes pass.
Independent review found no actionable milestone 1/2 issue and reran those 26 tests.
All 28 v2 anchor descriptions were compared to the approved contract exactly.

## Milestone 3 — scorer and existing job integration

Implemented `presentation_score_v2.py` using the frozen v2 rubric and visit registry,
the existing provider PreparedRequest/RawReceipt types, v1 capture/provenance checks,
and the current scoring API/worker transport. No alternate job architecture or
provider dispatch path was introduced. It derives 0–100 slide/overall scores with
exact arithmetic and validates anchored explanations, strengths, weaknesses,
improvements, omissions, shared deductions and delivery evidence. Invalid critical
components suppress dependent totals while preserving other valid slide scores;
optional feedback is validated independently. Missing evidence never becomes zero.

The existing `presentation_scoring.py` receives only these narrow repairs:

- Return frozen requirements needed by the current client contract.
- Withhold stale or prior-generation results from current responses, retaining
  historical results in storage.
- Bind the GET projection to the generation already read, avoiding mixed revision
  metadata when another request advances the owner concurrently.

Independent review found the read/update interleaving and optional unsafe-text
isolation failures. Red/green regressions cover both. NUL-containing optional advice
is filtered without invalidating valid scores; private audit data is reversibly
JSON-escaped when needed for PostgreSQL JSONB. Original receipt bytes are unchanged.
The reviewer independently passed all three final repair tests and reported no
remaining material backend finding in scope. This is AI review; human review is pending.

## Final verification

| Check | Actual result |
| --- | --- |
| M1 cooldown focused mobile tests | 29/29 pass after two intended red failures |
| Full mobile `npm run check` | 474/474 tests; typecheck/lint pass, one existing `useSegmentPlayer.ts` cleanup-ref warning |
| Android JavaScript export | Pass with explicit current router root and cleared cache; no APK/device claim |
| M2 rubric/evidence tests | 26/26 independently verified; all 28 anchor texts match the approved contract |
| Focused backend rubric/evidence/scorer/transport/lifecycle | 72/72 pass |
| Full backend SQLite | 607 run, 583 pass, 24 PostgreSQL-only skips; no failures |
| Full backend PostgreSQL | 607/607 pass, no skips |
| Django check / migration dry-run | No issues / no changes detected |
| Actual PostgreSQL + Redis + Celery worker | Eager mode off, three task deliveries, one score job and one scoring request; overall/slide 67; optional unsafe advice filtered and private audit round-tripped through JSONB |
| Existing Android validator against actual worker response | Fails for zero-duration chronology, as detailed below; not claimed end-to-end ready |

Commands used in `backend/` with the existing project Python environment:

```sh
python -B manage.py test rehearsals.test_presentation_rubric_v2 rehearsals.test_presentation_visit_evidence rehearsals.test_presentation_score_v2 rehearsals.test_presentation_score_v2_boundaries rehearsals.test_presentation_scoring rehearsals.test_presentation_scoring_lifecycle --settings=config.test_settings
python -B manage.py test --settings=config.test_settings
python -B manage.py check --settings=config.test_settings
python -B manage.py makemigrations --check --dry-run --settings=config.test_settings
```

PostgreSQL used `run_pg_full.py` and isolated `milestone_pg_settings.py` in the local
artifact directory, against a fresh test database. `run_worker_proof.py` created and
dropped its own random database and unique queue, with HTTP blocked and synthetic
measurements/provider receipts. Existing database contents and service settings were
not changed. Scoring, singleton independence, corrections/staleness, saved receipt
recovery, repeated visits, duplicate requests, explicit uncertainty recovery and
failure isolation are covered. The prior 26 scoring failures no longer occur.
No provider request, paid inference, model download or ledger change was made.

## Remaining work and blockers — separate Android milestone

1. Repair the existing score validator at `presentationScore.ts:58`: it uses
   `takeVisits`, a run/playback helper that filters zero-duration visits. The API
   correctly preserves those rows under the existing evidence contract. The actual
   worker response with simultaneous slide events is therefore rejected. A temporary
   diagnostic replacing only that imported helper with the full original chronology
   accepts the same unchanged response, including score arithmetic and citations.
   No application source was changed for this diagnostic. Validate all original
   visits without renumbering evidence IDs; retain positive-duration filtering for
   playback/run selection. Add regressions for simultaneous, repeated and backward
   transitions before integration.
2. Connect the existing score API/parser/cache to explicit Grade/Update/Retry
   controls, the existing overall/slide circular indicators and navigation tiles.
   Preserve singleton feedback admission, deduplication, source/revision fences,
   saved/offline restoration, uncertainty recovery and existing playback/navigation.
   Display explanations, strengths, weaknesses and actionable improvements from
   validated results. Do not generate scores on GET or slide navigation.
3. Verify these flows on Android. Current checks prove JS export and synthetic
   logic, not device interaction, microphone behavior or user usefulness.
4. Live model/schema compatibility and rubric semantic support, omissions,
   usefulness/fairness and repeatability remain unverified. Deterministic arithmetic
   does not establish correct anchor selection. Any paid evaluation requires a
   separately authorized exact request and cost preview; this task performs none.

Overall and slide arithmetic, anchored rubric mapping, explanations and singleton
job independence are implemented on the backend. Score display integration is
pending. There is no remaining confirmed backend blocker in the reviewed scope.

## Preservation and review artifacts

All changes are confined to the existing scoring worktree; no Git staging, commit,
merge, push, branch deletion, worktree removal or dependency installation was done.
The pre-milestone source/hash/index snapshots and logs are local at
`/tmp/outloud-scoring-milestones-20261017/`. Four separate task-only patches there
cover the cooldown repair, rubric/evidence modules, scorer/transport and documentation.
They are relative to the dirty pre-task source snapshot, not committed HEAD.
They do not package unrelated unfinished scoring work.

`manifest-final.json` records before/after hashes and patch hashes. The original
staged binary diff remains byte-identical with SHA-256
`d620f261d498820ec0a29683f6ed146951c16d04a8c35648cf4a615b2b3e4ccc`.
All pre-existing files outside the listed task scope remain byte-identical to the
pre-task snapshot, including Step 1, frozen v1, job infrastructure, migrations,
Android score parser/cache, navigation and previous Step 2 artifacts. The prior
Step 2 patch/manifest commit is frozen historical evidence, including its then-open
P2; this milestone record explains the later repair without rewriting it.
