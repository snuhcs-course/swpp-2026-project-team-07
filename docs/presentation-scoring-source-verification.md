# Complete automatic presentation-scoring source snapshot — October 17, 2026

This source snapshot builds on `4c23ab6` and includes the complete scoring runtime,
Android consumers, required earlier helpers and focused regressions. It was tested
independently of the broader dirty working tree. The earlier artifact-only commit
remains historical evidence; this change commits runnable application source.

## Dependency boundary

The existing feedback database/jobs, revision fences and provider adapters are
reused. Five earlier runtime modules are required by the v2 import graph:
`presentation_score.py`, `presentation_rubric.py`, `presentation_measurements.py`,
`presentation_eligibility.py` and `presentation_evidence_selection.py`. V2 uses
strict reference reconstruction from the last module despite its old experiment
label. Its experiment entry points are not exposed through the scoring API.

All nine Android scoring modules are included, together with selected-source
admission, existing-layout display and original-recording evidence playback.
Shared screen, worker and test-helper files contain scoring-only hunks. Existing
findings counters remain separate from performance points. Zero-duration and
repeated-visit citations retain their original identities; no audio range is
fabricated for an empty interval.

The evaluation/consensus/recovery experiment runners, grouped-feedback model and
migration, Step 1 implementation changes, and independent cue/navigation/reliability
changes are outside this scoring dependency closure. They remain in the original
working tree/index as applicable. Existing committed singleton feedback is used.
The lifecycle test retains singleton/scoring owner independence without requiring
an uncommitted historical membership table. The v1 evaluation-only test class is
excluded together with its separate evaluation tool; reused-runtime tests remain.

## Verification of this exact candidate

- `npm run check`: 494/494 tests, TypeScript pass, ESLint zero errors and one existing
  `useSegmentPlayer.ts:108` cleanup-ref warning.
- `npm run bundle:android -- --clear --source-maps`: pass. All 112 embedded
  application sources, including all nine scoring modules, match this candidate.
- Backend full SQLite suite: 517 tests, 24 expected PostgreSQL-only skips.
- Backend full PostgreSQL suite: 517 tests, no skips. A separate temporary test
  database was destroyed after verification; the phone database was not used.
- Django system check: pass. Migration check/dry run: no changes detected.
- Provider HTTP is blocked at the test runner; automated responses are mocked.
- Independent source review found a missing explicit Retry in slide/composed views
  after rejected assessments. A narrow current-assessment gate and exact/composed
  regression repaired it. Independent focused checks pass: 43 mobile and 61 backend
  cases, plus 17 UI cases after repair. No remaining actionable findings; final
  staged-diff digest is recorded in local commit evidence.

These counts differ from the broader dirty-tree checks because unrelated feature,
grouping and experiment suites are excluded. All selected scoring suites are kept.
Earlier mocked physical-phone results demonstrate the unchanged scoring components,
but this narrower snapshot has not been installed or deployed. Provider adherence,
audible recording quality and human usefulness remain manual testing limitations.
Unsupported evidence must continue to withhold the affected score.

## Staging and remaining work

The exact pre-task index, binary staged/unstaged patches and file hashes are saved
locally at `/private/tmp/outloud-scoring-source-commit-20261017/`. A temporary index
selects this commit, leaving the original active index unchanged during review.
After committing, entries included in the commit advance normally; unrelated
staged content stays staged and the exact old snapshot remains recoverable. No
push, merge, deployment, device operation, cleanup or paid inference is authorized
or performed by this source-commit task.

## Included files

- `README.md`
- `backend/rehearsals/presentation_score_views.py`
- `backend/rehearsals/services/coaching.py`
- `backend/rehearsals/services/feedback_config.py`
- `backend/rehearsals/services/feedback_provider.py`
- `backend/rehearsals/services/presentation_eligibility.py`
- `backend/rehearsals/services/presentation_evidence_selection.py`
- `backend/rehearsals/services/presentation_measurements.py`
- `backend/rehearsals/services/presentation_rubric.py`
- `backend/rehearsals/services/presentation_rubric_v2.py`
- `backend/rehearsals/services/presentation_score.py`
- `backend/rehearsals/services/presentation_score_v2.py`
- `backend/rehearsals/services/presentation_scoring.py`
- `backend/rehearsals/services/presentation_visit_evidence.py`
- `backend/rehearsals/test_presentation_eligibility.py`
- `backend/rehearsals/test_presentation_evidence_selection.py`
- `backend/rehearsals/test_presentation_rubric_v2.py`
- `backend/rehearsals/test_presentation_score.py`
- `backend/rehearsals/test_presentation_score_v2.py`
- `backend/rehearsals/test_presentation_score_v2_boundaries.py`
- `backend/rehearsals/test_presentation_scoring.py`
- `backend/rehearsals/test_presentation_scoring_lifecycle.py`
- `backend/rehearsals/test_presentation_visit_evidence.py`
- `backend/rehearsals/urls.py`
- `docs/ai-collaboration-prompts-iteration-2.md`
- `docs/ai-use.md`
- `docs/api-contract.md`
- `docs/presentation-score-v2.md`
- `docs/presentation-scoring-source-verification.md`
- `mobile/src/features/feedback/InitialPresentationScoreHost.tsx`
- `mobile/src/features/feedback/PresentationScorePanel.tsx`
- `mobile/src/features/feedback/automaticPresentationScore.ts`
- `mobile/src/features/feedback/presentationScore.ts`
- `mobile/src/features/feedback/presentationScoreDisplay.ts`
- `mobile/src/features/feedback/presentationScoreStore.ts`
- `mobile/src/features/feedback/selectedPresentationScores.ts`
- `mobile/src/features/feedback/usePresentationScore.ts`
- `mobile/src/features/feedback/useRunPresentationScores.ts`
- `mobile/src/features/rehearsal/analysis.tsx`
- `mobile/src/screens/AppShell.tsx`
- `mobile/src/screens/FullReviewScreen.tsx`
- `mobile/src/screens/HomeFeedbackStats.tsx`
- `mobile/src/screens/ReviewScreen.tsx`
- `mobile/src/screens/ReviewSlidePlayback.tsx`
- `mobile/tests/ai-overview-screens.test.mjs`
- `mobile/tests/helpers/ai-overview-screen-loader.mjs`
- `mobile/tests/helpers/ai-overview-screen-native.mjs`
- `mobile/tests/helpers/presentation-score-fixtures.mjs`
- `mobile/tests/helpers/presentation-score-integration-loader.mjs`
- `mobile/tests/helpers/presentation-score-integration-native.mjs`
- `mobile/tests/helpers/presentation-score-workflow-loader.mjs`
- `mobile/tests/helpers/slide-review-runtime-store.mjs`
- `mobile/tests/presentation-score-automatic.test.mjs`
- `mobile/tests/presentation-score-integration.test.mjs`
- `mobile/tests/presentation-score-projection.test.mjs`
- `mobile/tests/presentation-score-ui.test.mjs`
- `mobile/tests/presentation-score-workflow.test.mjs`
- `mobile/tests/presentation-score.test.mjs`
- `mobile/tests/segment-player.test.mjs`
