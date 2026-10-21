# Testing Documentation

Team 07 · Iteration 2 · Updated October 21, 2026

**Code baseline:** PR #31. The manual walkthrough took place on October 19, before the October 20 merge into main (`c4a3f48`). The exact installed app commit remains unrecorded. The recorded demo uses PR31; B09 has separate October 20 branch/device evidence below; other fixes need their own version and retest evidence.

This report brings together the test plan, verified CI results, manual findings and remaining checks. The [Test Inventory](test-inventory.md) lists existing test files. The [Story-to-Test Matrix](story-test-matrix.md) maps requirements to existing evidence and remaining acceptance checks.

## 1. Test responsibility and schedule

### Plan

| Area | Tools / test boundary | Maintainer |
| --- | --- | --- |
| Backend logic and validation | Django test runner; isolated service tests | Team to confirm |
| Backend API, persistence and concurrency | Django/DRF tests with PostgreSQL; controlled provider responses | Team to confirm |
| Mobile logic and storage | Node test runner; mocks/fakes for network and native interfaces | Team to confirm |
| Mobile screens and hooks | React test renderer and native test loaders | Team to confirm |
| Physical Android walkthrough | Manual checks, recording/screenshots and issue records | Team to confirm individual case executors |

CI runs on pushes and pull requests. Its jobs run mobile checks/export and backend checks/migrations/tests. The repository's agent guidance calls for relevant tests when behavior changes and reuse of results for unchanged code. A regression test should demonstrate a fix where a repeatable automated check fits the defect. The team still needs to confirm named maintainers and its human merge-approval policy; no protected-branch rule is claimed here.

### Results

| Date / target | Activity | Status |
| --- | --- | --- |
| October 19 | Galaxy S25 exploratory walkthrough | Findings recorded in section 3 |
| October 20 | Merged-main automated checks | Passed; CI evidence in section 2 |
| Before the October 21 TA meeting | Present the demo and testing findings, including B09 | B09 evidence recorded below; demo video link still pending |
| October 22, internal target | Complete coverage measurement and testing records | Pending |
| October 23, 23:59 KST | Submit Iteration 2 Testing Documentation PDF with the required package | Pending |

Named test maintainers and per-case executors still need confirmation. The internal targets come from the current team schedule; October 23 is the official submission deadline.

## 2. Unit and integration testing

### Plan

Test the recording timeline, speech-to-slide alignment, PDF/audio storage, evidence validation, scoring, settings/corrections, feedback and Q&A. Test normal flows and relevant error, boundary and recovery cases. Component/UI tests use simulated audio, PDF and lifecycle interfaces; use the physical phone for native behavior. Provider fixtures test application contracts without establishing recognition accuracy or useful feedback.

Use Node.js 24 and Python 3.12 with the committed lockfiles. CI uses PostgreSQL 16-alpine. See the [local development guide](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c4a3f48d2a635bb2edb44828c62fb286b55f8d94/docs/local-development.md) for Python setup, Android JDK/SDK and services, and the [CI workflow](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c4a3f48d2a635bb2edb44828c62fb286b55f8d94/.github/workflows/checks.yml) for its exact environment.

From the repository root, run each block separately:

```sh
cd mobile
npm ci
npm run check
npm run bundle:android
```

With the backend Python environment activated and a disposable PostgreSQL test database configured:

```sh
cd backend
python -m pip install -r requirements.txt
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py test
```

The PostgreSQL role needs test-database creation permission. Configure `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD` for that disposable environment. Use blank provider keys for automated fixture runs. Do not run migrations against shared data as part of test setup. For a local SQLite alternative, use `--settings=config.test_settings`; record its PostgreSQL-only skips rather than treating it as concurrency evidence.

Coverage collection is not configured in the inspected CI workflow. Choose client/service or layer-specific targets, tools and exclusions before measuring, and retain submitted targets if they change. The team has not yet confirmed targets or measured percentages. Generated native/build output, dependencies and test helpers are proposed exclusions, pending agreement; no exclusions have been applied to a report.

### Results

**Date:** October 20, 2026, KST · **Commit:** `c4a3f48d2a635bb2edb44828c62fb286b55f8d94` · **Run:** [GitHub Actions 39344748984](https://github.com/snuhcs-course/swpp-2026-project-team-07/actions/runs/39344748984).

| Check / command | Actual result | Evidence |
| --- | --- | --- |
| Mobile `npm run check` | 548 passed; 0 failed; 0 skipped. Type checking passed; lint passed with an existing warning. | [Mobile job](https://github.com/snuhcs-course/swpp-2026-project-team-07/actions/runs/39344748984/job/118374547570) |
| Mobile `npm run bundle:android` | Passed JavaScript export; this is not an APK/device test. | Same mobile job |
| Backend `python manage.py test` | 554 tests OK on PostgreSQL; no skips reported. | [Backend job](https://github.com/snuhcs-course/swpp-2026-project-team-07/actions/runs/39344748984/job/118374547787) |
| Backend system check | No issues | Same backend job |
| Migration-drift check / fresh migrations | No changes detected; migrations applied | Same backend job |

| Component | Coverage target | Actual coverage | Next action |
| --- | --- | --- | --- |
| Mobile logic, storage and UI | Team to confirm by Iteration 2 close | Not measured | Select tools/targets; collect report and screenshot |
| Backend services and API | Team to confirm by Iteration 2 close | Not measured | Select tools/targets; collect report and screenshot |

Use the [Test Inventory](test-inventory.md) to find source cases and the [Story-to-Test Matrix](story-test-matrix.md) to identify acceptance gaps. Tests passing does not close the separate device, quality or requirement decisions in the matrix. Do not add the older baseline counts to the current suite totals. Earlier integration records include a 549-mobile-test snapshot; cleanup removed one obsolete component test, leaving 548. The local phone-demo checkout's 556 backend tests describe separate local fixes, not this 554-test main run.

[Earlier integration verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c4a3f48d2a635bb2edb44828c62fb286b55f8d94/docs/scribe-only-integration-verification.md) · [Final cleanup verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c4a3f48d2a635bb2edb44828c62fb286b55f8d94/docs/scribe-integration-cleanup-verification.md).

### Reported AI and data-processing repairs

Injoon supplied Seoyeon’s findings dated October 20 that summarize earlier checks. Report authorship does not establish who implemented each fix. The table preserves those reported results. Original run dates, revisions, commands and evidence links still need confirmation. These checks are separate from the October 19 Galaxy S25 session and the verified CI totals above.

| Check | Type | Reported result | Evidence still needed |
| --- | --- | --- | --- |
| Feedback evidence validation repair | Saved-job replay and backend tests | Saved job 56 recovered one finding with zero rejections and no new provider call. A focused PostgreSQL suite passed 139 tests. | Fix commit, replay record and original test output |
| Gemini schema compatibility repair | Live-provider integration | Four HTTP 200 calls over two fixtures; backend validation still rejected an invalid finding. | Fix commit and evaluation output |
| Cue-length policy repair | Live integration and manual device observation | A seven-slide deck produced 17 validated cues; longest 19 words. Cues appeared on a phone. | Fix commit, run date, phone/tester and screenshot |
| Extracted PDF NUL-character repair | Automated PostgreSQL regression | The test reproduced the database failure before the fix and passed afterward. | Test case, fix commit and before/after output |

The teammate describes these as fixed in the earlier work. Their inclusion in the demo/submission revision still needs commit evidence. These results do not close B01–B09. The 139-test focused suite is an earlier subset/run, not an additional 139 tests to add to the 554-test CI total.

### Exploratory provider experiment

The same supplied notes report an eight-pair comparison of normal and compact feedback requests:

| Measure | Normal requests | Compact requests |
| --- | --- | --- |
| Median API latency | 15.607 seconds | 18.443 seconds |
| Usage-derived warm-cache cost | USD 0.00674171 | USD 0.00679283 |
| Reviews retaining accepted findings | 7 of 8 | 7 of 8 |

Compact requests reduced input tokens by 62.9%. Cost figures come from returned usage, rather than confirmed invoices. AI reviewers supplied the quality judgments; human usefulness remains unmeasured.

Two compact responses exhausted the original 2,500-token output allowance. A 10,000-token rerun completed without truncation, but the application defaults stayed unchanged and generated content also varied between runs. Record this as an experiment outcome, not a completed application fix.

The notes recommend reverting the compact format. That recommendation needs a team decision and, if implemented, checks of feedback generation, evidence handling and saved-result compatibility. Original experiment dates, versions, commands and output links remain to be attached.

Source for these two subsections: teammate personal notes supplied October 20, “PR31: Bugs and Improvements for Testing Documentation”. The notes themselves report no new test execution when preparing the summary.

## 3. Manual testing

### Plan

Record device/OS, build/commit, date, executor, steps, expected/actual behavior, outcome and a screenshot/video timestamp for each checked flow. Cover import/settings, recording/transcription, feedback/evidence playback, retake/comparison, spoken Q&A and reopening saved results. These are current exploratory checks, not the later frozen UAT plan.

### Results

| Session field | Recorded information |
| --- | --- |
| Test date | October 19, 2026 |
| Device | Samsung Galaxy S25 |
| Connection | USB to Injoon's Mac |
| Version | PR31 application; exact installed commit/build pending |
| Method | Exploratory manual walkthrough and demo recording |
| Reporter | Injoon; per-case operators/other participants pending |
| Android version | Not recorded |
| Evidence | Demo video finished; file/link and timestamps pending |

Injoon confirmed the date and device on October 20. The following findings come from his walkthrough report. The session has no recorded pass result for every other feature. Detailed per-case steps, expected/actual results and evidence references remain incomplete.

| ID | Finding | Type | Suggested priority | Status |
| --- | --- | --- | --- | --- |
| B01 | Presentation swipes move too fast. | Usability | Medium | Open |
| B02 | Scores and unexpected components appear after importing slides. | UI-state bug | High | Open |
| B03 | Time display and duration slider are cramped. | Layout / usability | Medium | Open |
| B04 | Cues are difficult to find without scrolling. | Improvement | Low–medium | Proposed |
| B05 | Edit time and audience controls are difficult to tap. | Interaction bug | High | Open |
| B06 | Overall-score-unavailable text overflows its circle. | Layout bug | Medium | Open |
| B07 | Opening slide feedback lacks the expected transition animation. | Consistency improvement | Low | Expected behavior to confirm |
| B08 | Feedback takes time to arrive; observation is outside the video. | Performance observation | Unrated | Duration not measured |
| B09 | Retry reports a take already started; another retry freezes at 0:00 then jumps to 0:07. | Recording / retry bug | High | First-Redo fix verified on Galaxy S25; timer jump not reproduced |

Priorities are recommendations. The team has not assigned individual findings. B09 contains two reported symptoms. The first-Redo error is reproduced and fixed on a local branch; the fix has now passed focused Galaxy S25 retry, Keep/Overwrite and selected-audio playback checks. The exact native timer jump was not reproduced and is not closed as fixed. For B08, measure the wait and record the loading/error UI before assigning a latency threshold failure.

### Selected bug and retest record

B09 was selected on October 20. Preserve the October 19 PR31 demo as the original observation. The following results belong to the local fix branch; they are not merged-main CI results or human acceptance.

| Field | Record |
| --- | --- |
| Bug ID and tester | B09; original report by Injoon; new checks operated by Codex |
| Steps | Record and stop; return from Review; confirm the first Redo |
| Expected / actual before fix | A fresh recording should start; the regression instead displays “This take has already started.” |
| Before evidence | Baseline `c4a3f48`: first-Redo error reproduced on Galaxy S25; 30-second before excerpt captured. Five new automated tests: 4 fail, 1 passes. Original main demo timestamp still needed. |
| Cause and fix | Successful stop left the single-use capture engine mounted in `done`; remount after saving. [Published fix branch](https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/fix/retry-recording), public code/evidence commit `3ae9d16` (same code as original local `e423010`); no merge. |
| Regression check | Five B09 tests pass: first redo and original preservation, repeated retakes/timer wiring, cancellation, duplicate taps, full-presentation redo. Full mobile check: 553 pass; typecheck/lint pass with one existing warning; Android export passes. |
| Device retest | Completed after reconnection on October 20: Galaxy S25, Android 17, fix `e423010`; three consecutive retakes including a full redo across two slides succeed. Keep current retains original selection; Overwrite selects new 9-second take; selected playback advances to 0:03 / 0:09. The exact 0:00-to-0:07 freeze was not reproduced on baseline or fix and stays open. |
| After evidence | Automated logs plus 30-second before/after device clips and screenshots available in the local B09 evidence pack; audible quality not assessed. |

[Published B09 spec, commands and test logs](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/3ae9d162d53088a129bffaf15a915400480a6483/docs/b09-retry-recording.md). Native audio/UI boundaries in the automated tests are fixtures; timer assertions inject durations. The separate agent-operated phone retest uses the real native recorder/player with backend services offline. Device UI selection/playback passes; unselected-file/ID retention remains automated SQLite evidence, with no private database export. Device clips and speaker notes remain in the private course-workspace B09 evidence pack; no public clip link has been published. The linked branch spec identifies the files and their limits. Separate AI review found no blocking findings; human review is pending. No other B01–B09 fix or new human retest is claimed.

## 4. AI module testing — Iteration 3

### Plan

To be completed in Iteration 3: commit at least 30 frozen cases with expected behavior/reference labels and thresholds before running the evaluation. Record models/prompts/settings, judgment method and commands. Discuss uncertain ground truth with the TA. Existing exploratory speech/provider records keep their original scope and dates.

### Results

Formal frozen-set results are not yet recorded. The teammate's earlier checks and AI-reviewed experiment remain exploratory evidence. Planned evaluations include:

- Human rubric ratings for feedback correctness, supporting evidence, usefulness, false positives and missed issues.
- Independent human scores on the same recordings, compared with the AI's criterion selections and overall/per-slide scores.
- Repeated evaluations of unchanged recordings to measure consistency and identify unsupported or duplicate deductions.
- Replay of the rejected citation cases: an omitted word within a cited speech range and an unsupported slide-fact reference. Invalid evidence should continue to fail validation.

Agree the method, reviewers and thresholds before running these evaluations. Their results remain pending.

## 5. Acceptance testing — plan in Iteration 3, results in Iteration 4

### Plan

Choose at least five UAT stories with observable criteria and tester procedures, then freeze the stories after Iteration 3. The current matrix is preparation, not a claim that this plan has been approved or frozen.

### Results

To be completed in Iteration 4 with tester, date, pass/fail and deviations.

## 6. Alpha and beta testing — Iteration 5

### Plan

To be completed in Iteration 5: recruit testers, define scenarios, distribution/version and issue handling. Run course alpha first, fix serious issues, then beta with external users on their own devices without the team present. Preserve the course's full-week beta period.

### Results

No alpha/beta participation or results are claimed.

## 7. Remaining work before the Iteration 2 submission

- Confirm test maintainers, component coverage targets, tools and exclusions.
- Add measured coverage and screenshots, then compare results against the agreed targets.
- Attach the completed demo video and add per-case manual results/timestamps.
- Obtain teammate review and integrate B09 if approved; rerun affected checks after integration. Keep its unreproduced timer symptom open.
- Link the teammate's reported checks to their original revisions, dates and test artifacts.
- Keep open requirement differences visible and export this page to PDF at iteration close.

## Sources and AI assistance

Course requirements: Testing Documentation Guidelines, eTL file 9410502, read October 20. The guideline requires English Wiki Plan/Results sections. Preserve submitted targets and explain later revisions.

Implementation/test evidence: pinned repository and CI links in section 2. Manual evidence: Injoon's findings and date/device clarification received October 20. Additional reported checks: Seoyeon’s findings supplied October 20; original execution details remain to be attached.

OpenAI Codex organized the evidence and edited the English report. The B09 follow-up records a local AI-assisted fix and automated checks; the follow-up also records focused native-device checks, but does not establish provider evaluation, audible quality or human approval. This October 21 edit reuses the cited results; it adds no application test run. The submission PDF remains pending.
