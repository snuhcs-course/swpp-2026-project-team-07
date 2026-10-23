# Iteration 2 Supporting Test Records

Detailed records for [Testing Documentation](../testing.md).

## October 20 CI Baseline

[CI configuration](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c4a3f48d2a635bb2edb44828c62fb286b55f8d94/.github/workflows/checks.yml).

**Date:** October 20, 2026, KST · **Commit:** `c4a3f48d2a635bb2edb44828c62fb286b55f8d94` · **Run:** [GitHub Actions 39344748984](https://github.com/snuhcs-course/swpp-2026-project-team-07/actions/runs/39344748984).

| Check / command | Actual result | Evidence |
| --- | --- | --- |
| Mobile `npm run check` | 548 passed; 0 failed; 0 skipped. Type checking passed; lint passed with an existing warning. | [Mobile job](https://github.com/snuhcs-course/swpp-2026-project-team-07/actions/runs/39344748984/job/118374547570) |
| Mobile `npm run bundle:android` | Passed JavaScript export; this is not an APK/device test. | Same mobile job |
| Backend `python manage.py test` | 554 tests OK on PostgreSQL; no skips reported. | [Backend job](https://github.com/snuhcs-course/swpp-2026-project-team-07/actions/runs/39344748984/job/118374547787) |
| Backend system check | No issues | Same backend job |
| Migration-drift check / fresh migrations | No changes detected; migrations applied | Same backend job |

## October 19 Manual Testing

| Session field | Recorded information |
| --- | --- |
| Test date | October 19, 2026 |
| Device | Samsung Galaxy S25 |
| Connection | USB to a development computer (Mac) |
| Version | PR31 application; exact installed commit/build pending |
| Method | Exploratory manual walkthrough and demo recording |
| Reporter | Injoon; per-case operators/other participants pending |
| Android version | Not recorded |
| Evidence | Demo video finished; file/link and timestamps pending |

The walkthrough predates the October 20 merge. Per-case steps, expected/actual results, pass results and evidence references remain missing.

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

Confirm priorities and assignees. For B08, measure the wait and capture the loading/error UI.

B09 has two symptoms with separate outcomes:

| Symptom | Current status |
| --- | --- |
| First Redo reports an already-started take | Fixed on branch; regression and agent-operated Galaxy S25 checks passed. Integration and human review remain pending. |
| Timer stays at 0:00, then jumps to 0:07 | Open; the exact symptom remains unreproduced on baseline or fix. |

See [Appendix B](#appendix-b-b09-evidence) for the October 20 branch retest, cause, revisions and limits. Human acceptance remains pending.

## Jaewon Galaxy S22 Findings

**Tester:** Jaewon (JJ) · **Device:** Galaxy S22 · **Scope:** PR #31 / Nakajima version; later demo-only changes excluded. Test date, Android version and exact installed build are not recorded. [Original report](teammate-reports-2026-10-23/jj-bugs-and-improvements-report.md).

The source mixes observations and proposed improvements. Its suggested checks are follow-up work; no completed case-by-case pass/fail or submitted-build retest is recorded.

| ID | Recorded observation or proposal | Status / follow-up |
| --- | --- | --- |
| JJ01 | Home carousel stutters; returns from presentation/recording screens can feel delayed. | Reported performance observation; no timing/FPS measurement. Profile gestures/transitions on the final build. |
| JJ02 | Backward slide movement during recording can disrupt audio/transcript-to-slide association. | Reported alignment concern; reproduce repeated visits with timestamps. Disabling backward movement is a proposal that conflicts with current PR31 repeated/backward-visit behavior. |
| JJ03 | PDF setup needs visible duration/audience controls, optional audience selection and timing feedback tied to the chosen duration. | Reported setup concern and recommendation; verify visibility and persistence before changing requirements. |
| JJ04 | Presentation labels can retain old numbers after deletion, such as keeping number three after deleting number two. | Reported numbering issue; test first/middle/last deletion and subsequent insertion. No saved-data identity failure is established. |
| JJ05 | Layout, icons, labels, visual states and theme consistency need a full-journey UI pass. | Review recommendation; concrete per-screen reproductions and retests are not recorded. |
| JJ06 | Gesture navigation needs a first-launch tutorial and a persistent Help/Gestures entry to reopen it. | Proposed improvement; no requirement change or completed tutorial test. |

The report proposes high priority for alignment, navigation performance and onboarding, and medium priority for setup, numbering and UI consistency. These are suggested priorities. No fix or retest evidence accompanies the report.

## Jooyoung PDF Upload Failure

**Tester:** Jooyoung · **Date:** October 23, 2026 · **Device:** Galaxy Tab S7 FE · **App:** PR #31; exact installed build and Android version not recorded. [Original report](teammate-reports-2026-10-23/jooyoung-iteration-2-testing-pdf.md).

**Recorded steps:** open the app; upload the PDF identified as malformed; observe the app around 07:14; retry or observe the upload response.

**Expected:** upload succeeds or the app rejects the PDF with a clear, controlled validation message; the rest of the app stays responsive.

**Actual / result:** **Failed.** Two `POST /api/decks/` requests returned HTTP 500 at approximately **07:14:27** and **07:14:40** in the tester's log. PostgreSQL/psycopg raised `UnicodeEncodeError` with `surrogates not allowed` while saving extracted slide text. Django raised the same encoding error while rendering the error page. The log clock's timezone is not recorded.

| ID | Recorded outcome | Evidence / retest status |
| --- | --- | --- |
| JY01 | PDF upload failed twice with the surrogate-character encoding error and HTTP 500. | Failed in the tester's report. Raw Docker log, input PDF and recording are referenced but not supplied; no fix/retest is recorded. |
| JY02 | The uploading slide glitched; the app became laggy, including navigation in a different valid PDF. | Related observation; the upload's causal role is unconfirmed. |
| JY03 | After recording on the malformed PDF, the transcript page showed “Couldn’t upload this take.” | Related observation; upload request details and a retest are not recorded. |
| JY04 | On a valid PDF, Rerecord played audio instead of starting the expected rerecord flow. | Reported retry/playback issue. Keep separate from B09 until a shared cause is established. |
| JY05 | Buttons and swipe-back became unresponsive while Docker logged the encoding error. | Related observation; measure responsiveness and isolate the failure path. |

JY01 concerns surrogate characters. The earlier NUL-character repair remains a separate record. The report does not prove that the upload caused each later lag or UI symptom.

## Seoyeon Phone Observations

**Tester:** Seoyeon · **Dates:** October 15–16, 2026 · **Device:** physical phone; model/Android version not recorded. Exact installed-build IDs and a complete personal retest of fixes are not retained. [Original report](teammate-reports-2026-10-23/seoyeon-iteration-2-testing.md#personal-phone-checks).

On October 15, cues and transcription worked after initial failures; short playback/transcription also worked. These observations do not establish an all-flow pass or recognition accuracy.

| ID | Date | Recorded observation | Status / follow-up |
| --- | --- | --- | --- |
| SY01 | October 15 | First and return slide visits were indistinguishable in the transcript view. | Reported visit-display issue; verify repeated-visit ordering and displayed identity on the final build. |
| SY02 | October 15 | Heading, sentence/word and Play controls behaved inconsistently. | Reported control/playback issue; exact case steps and full retest are not retained. |
| SY03 | October 16 | Recognition choices for spoken “Tajumulco” were inaccessible. | Reported correction-control issue; retest choice access and application. |
| SY04 | October 16 | Audio played with a blank screen. | Intermittent reported issue; the later investigation did not reproduce it. No complete personal fix retest is recorded. |
| SY05 | October 16 | Returning from Review was difficult. | Reported navigation issue; record the route and expected/actual transition in a retest. |
| SY06 | October 16 | Q&A showed offline/unavailable. | Reported unavailable state; device/backend/provider conditions and recovery need verification. |
| SY07 | October 16 | Swiping to an unfinished question showed a blank screen. | Reported pending-state issue; retest loading, unavailable and completed states. |

## Seoyeon Focused Automated Checks

**Date:** October 22, 2026 · **Executor:** Codex · **Source commit:** `f1af9dd9737e2ac9adbe8a45186f0e2722863e60`. The supplied report states that 572 committed file hashes were verified. [Original scope, results and reproduction commands](teammate-reports-2026-10-23/seoyeon-iteration-2-testing.md).

**Reported plan:** recorded at 15:16:59 KST before measurement. Targets were 80% backend statement coverage and 70% client source-line coverage, with zero failures/errors. These targets belong to this subset; the four team line/branch targets remain unchanged.

**Scope / isolation:** 40 complete backend feature/API/shared-support files and 57 client domain/controller files, exercised by 51 client test files. Shared files count in full; unexecuted files stay at 0%. Exclusions include tests/helpers, dependencies, generated projects, migrations/configuration, backend Scribe/audio-gate/upload/PDF services, and client screens/styles, Home/carousel, native PDF/capture and unrelated storage wrappers. Backend tests use SQLite, synthetic provider responses, blocked sockets and disabled private environment loading. Client tests use transport/native mocks without a blanket socket guard.

| Component | Focused target | Actual coverage | Total / passed / failed / skipped | Reported outcome |
| --- | --- | --- | --- | --- |
| Backend, 40 files | 80% statements | 93.78%: 4,675 / 4,985 | 475 / 456 / 0 / 19; zero errors | Target met |
| Client, 57 files | 70% physical source lines | 83.38%: 4,487 / 5,381 | 477 / 477 / 0 / 0 | Target met |

The 19 skips require PostgreSQL row locks. This run did not repeat PostgreSQL/Redis/separate-worker checks; backend connection attempts were zero. The full team PostgreSQL run remains 554 passes with zero skips. Do not add these overlapping counts or substitute the subset's percentages for team coverage.

**Tools / environment:** macOS arm64; Python 3.12.14, Django 5.2.17; Node 26.8.2, npm 11.19.1, TypeScript 6.0.3 and React/Test Renderer 19.2.3. coverage.py 7.16.2 measures executable statements; backend branch coverage was not collected. c8 10.1.3 / v8-to-istanbul 9.3.0 measures mapped TypeScript physical source lines, including types/comments/blanks. The report records 555 compiled-instance mapping checks and a synthetic covered/uncovered-line check. Dependency differences include absent Torch/Silero and different NumPy/ONNX Runtime versions; native speech inference was outside scope.

The companion `seoyeon-iteration-2-testing-evidence/` folder was not supplied. Its frozen file lists, plan, commands, logs, environment audit, mapping audit, HTML reports and screenshots cannot be inspected from the Markdown alone. The original reproduction commands remain unchanged in the source report and require that folder. No screenshots or raw results have been recreated.

Earlier October 15–17 checkpoints and their pinned verification links remain in the original report. They overlap: 52/139/17/72 backend test checkpoints and 35 client parser/playback tests, plus idempotent-delivery/recovery records. A 29:59.061 emulator recording and a generated thirty-minute file yielding 1,860 timed words do not establish thirty-minute phone speech accuracy. This additional coverage run adds no new device/provider, recognition-accuracy, usefulness or score-calibration evidence.

## Appendix A. Supporting Checks

The October 20 records below retain their original scope. The later [focused-check report](#seoyeon-focused-automated-checks) supplies dated October 15–17 checkpoints and verification links; fix authorship, exact historical run identities and raw companion outputs remain incomplete.

### Result-count context

The [matrix](../story-test-matrix.md) keeps device, quality and requirements gaps open. Earlier integration: 549 mobile tests; cleanup removed one obsolete component test, leaving 548. The phone-demo checkout's 556 backend tests include separate local fixes; main CI ran 554.

[Earlier integration verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c4a3f48d2a635bb2edb44828c62fb286b55f8d94/docs/scribe-only-integration-verification.md) · [Final cleanup verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c4a3f48d2a635bb2edb44828c62fb286b55f8d94/docs/scribe-integration-cleanup-verification.md).

### Reported AI and data-processing repairs

**Source:** Seoyeon's summary of earlier checks, supplied by Injoon on October 20. Seoyeon reports the repairs as complete. Fix authors, run dates, revisions, commands and original evidence links remain unconfirmed. These results are separate from the walkthrough and main CI totals.

| Check | Type | Reported result | Evidence still needed |
| --- | --- | --- | --- |
| Feedback evidence validation repair | Saved-job replay and backend tests | Saved job 56 recovered one finding with zero rejections and no new provider call. A focused PostgreSQL suite passed 139 tests. | Fix commit, replay record and original test output |
| Gemini schema compatibility repair | Live-provider integration | Four HTTP 200 calls over two fixtures; backend validation still rejected an invalid finding. | Fix commit and evaluation output |
| Cue-length policy repair | Live integration and manual device observation | A seven-slide deck produced 17 validated cues; longest 19 words. Cues appeared on a phone. | Fix commit, run date, phone/tester and screenshot |
| Extracted PDF NUL-character repair | Automated PostgreSQL regression | The test reproduced the database failure before the fix and passed afterward. | Test case, fix commit and before/after output |

Attach fix commits before attributing repairs to the demo/submission revision. B01–B09 retain their status. The 139-test run is a subset of the 554-test suite.

### Exploratory provider experiment

**Source:** Seoyeon's notes, “PR31: Bugs and Improvements for Testing Documentation”, supplied October 20. Eight pairs of normal and compact feedback requests. Notes summarize earlier runs; their preparation involved no new tests. Experiment dates, versions, commands and outputs remain missing.

| Measure | Normal requests | Compact requests |
| --- | --- | --- |
| Median API latency | 15.607 seconds | 18.443 seconds |
| Usage-derived warm-cache cost | USD 0.00674171 | USD 0.00679283 |
| Reviews retaining accepted findings | 7 of 8 | 7 of 8 |

Compact requests reduced input tokens by 62.9%. The cost calculation uses returned usage; invoice amounts remain unverified. AI reviewers judged quality. Human usefulness remains unmeasured.

Two compact responses exhausted the 2,500-token output allowance. A rerun with 10,000 tokens completed without truncation. Generated content varied between runs, and the application defaults stayed unchanged.

**Decision pending:** Seoyeon recommends reverting the compact format. A change needs checks of feedback generation, evidence handling and saved-result compatibility.

## Appendix B. B09 Evidence

### Selected bug and retest record

**Date:** October 20, 2026 · **Executor:** Codex (automated and agent-operated checks). Original observation: October 19 PR31 demo, reported by Injoon. Human acceptance remains pending.

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

[B09 spec, commands and test logs](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/3ae9d162d53088a129bffaf15a915400480a6483/docs/b09-retry-recording.md). Automated tests use native audio/UI fixtures and injected timer durations. Codex used the real phone recorder/player with backend services offline. Selection/playback passed; SQLite tests cover retention of unselected files and IDs. Codex did not export the private database or assess audible quality. The private course-workspace pack holds clips and speaker notes. Separate AI review found no blocking findings; human review remains pending.

## Coverage Scope and Targets

| Group | Maintainer | Source scope | Line target | Branch target | Reason |
| --- | --- | --- | --- | --- | --- |
| Mobile logic and storage | Jooyoung | `mobile/src/**/*.ts` | 85% | 75% | Failures could lose recordings, mix up takes or prevent recovery. These paths deserve strong automated coverage. |
| Mobile screens and components | Jaewon | `mobile/src/**/*.tsx` | 70% | 60% | Screen tests need simulated native interfaces and lifecycle behavior. Phone checks separately verify microphone, playback and Android behavior. |
| Backend logic and services | Seoyeon | `backend/rehearsals/services/**/*.py`, plus `models.py`, `limits.py` and `tasks.py` in `backend/rehearsals/` | 85% | 75% | This code validates evidence, calculates scores and manages saved results. Errors could produce misleading feedback or inconsistent data. |
| Backend API and runtime | Injoon | Remaining application Python files under `backend/` | 80% | 70% | We need strong checks for valid requests, invalid inputs and failures. This group also includes configuration and operational code requiring more setup. |

## Original Check Commands

### Environment

```sh
export POSTGRES_HOST=127.0.0.1
export POSTGRES_PORT=5432
export POSTGRES_DB=outloud
export POSTGRES_USER=outloud
export POSTGRES_PASSWORD=outloud-local-only
export DJANGO_DEBUG=1
export OPENAI_API_KEY= GEMINI_API_KEY= ELEVENLABS_API_KEY=
```

### Mobile checks

```sh
cd mobile
npm ci
npm run check
npm run bundle:android
```

### Backend checks

```sh
cd backend
python -m pip install -r requirements.txt
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate
python manage.py test
```

### Mobile coverage

```sh
cd mobile
npm ci
node tools/validate-coverage.mjs
npm run test:coverage
```

### Backend coverage

```sh
cd backend
python -m pip install -r requirements-test.txt
python -m coverage run manage.py test --noinput
python -m coverage json
python -m coverage html
python ../tools/coverage_report.py backend --check
```
