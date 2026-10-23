## Seoyeon AI Feedback and Q&A Testing

I tested cues, feedback evidence, transcription corrections, scoring, Q&A and related playback controls. I checked phone flows on October 15–16, 2026, and used Codex for automated tests. The October 22 coverage run is reported separately from those earlier checks.

### Plan and scope

For my contribution, I plan to rerun affected tests after changes and before handoff, review failures/skips and record the tested revision. Backend tests use Django/unittest, `unittest.mock` and HTTPX `MockTransport`; client tests use `node:test`, `node:assert/strict`, React Test Renderer and fetch/native stubs.

Codex recorded the [coverage plan](seoyeon-iteration-2-testing-evidence/coverage-plan.json) at **15:16:59 KST on October 22**, before measurement: **80% backend statement coverage** for deterministic validation/persistence logic and **70% client source-line coverage**, allowing for mocked native/UI boundaries. These are new working targets; earlier targets and team approval are not recorded. Pass criteria were zero test failures/errors and meeting these targets.

- **Scope:** 40 complete backend feature/API/shared-support files and 57 client domain/controller files, exercised by 51 client test files. [Backend file/test list](seoyeon-iteration-2-testing-evidence/backend/scope.json) · [Client file/test list](seoyeon-iteration-2-testing-evidence/mobile/scope.json). Shared files count in full without implying exclusive authorship; unexecuted files remain at 0%.
- **Exclusions:** tests/helpers, dependencies, generated projects, migrations/configuration; backend Scribe/audio-gate/upload/PDF services; client screens/styles, Home/carousel, native PDF/capture and unrelated storage wrappers.
- **Isolation:** committed SQLite settings and synthetic provider responses; backend sockets blocked and private environment loading disabled. Client tests retain their existing transport/native mocks without a blanket socket guard.

### Coverage results on October 22

Codex tested commit [`f1af9dd`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/f1af9dd9737e2ac9adbe8a45186f0e2722863e60), verifying all **572 committed file hashes**.

| Component | Target | Actual coverage | Total / passed / failed / skipped | Result |
|---|---|---|---|---|
| Backend, 40 files | 80% statements | **93.78%: 4,675 / 4,985** | **475 / 456 / 0 / 19**; zero errors | Target met |
| Client, 57 files | 70% source lines | **83.38%: 4,487 / 5,381** | **477 / 477 / 0 / 0** | Target met |

The **19 skips require PostgreSQL row locks**. This run used SQLite and did not repeat PostgreSQL/Redis/separate-worker checks. Backend connection attempts were zero. [Backend results and skip reasons](seoyeon-iteration-2-testing-evidence/backend/result-summary.json) · [Client results and mapping audit](seoyeon-iteration-2-testing-evidence/mobile/result-summary.json)

**coverage.py 7.16.2** measures Python executable statements; backend branch coverage was not collected. **c8 10.1.3 / v8-to-istanbul 9.3.0** measures mapped TypeScript physical source lines, including types/comments/blanks. I report its **Lines** metric, not AST statement coverage, and do not average the two percentages. Mapping checks covered **555 compiled instances** plus a synthetic covered/uncovered-line check.

![Backend coverage report: 93.78 percent](seoyeon-iteration-2-testing-evidence/backend-coverage.png)

![Client source-line coverage report: 83.38 percent](seoyeon-iteration-2-testing-evidence/mobile-coverage.png)

Full reports: [backend](seoyeon-iteration-2-testing-evidence/backend/html/index.html) · [client](seoyeon-iteration-2-testing-evidence/mobile/report/index.html). The evidence retains test logs, missing lines and the initial measurement attempts. Codex corrected file-discovery/source-map tooling and reran the same scopes without changing product code or application tests.

### Reproduction

Tested environment: **macOS arm64; Python 3.12.14, Django 5.2.17; Node 26.8.2, npm 11.19.1, TypeScript 6.0.3, React/Test Renderer 19.2.3**. Use Node 26.8.2 to match this run, rather than the repository's recommended Node 24. [Python pins](seoyeon-iteration-2-testing-evidence/backend/environment-requirements.txt) and the [dependency audit](seoyeon-iteration-2-testing-evidence/backend/dependency-audit.json) record differences from the full lock, including absent Torch/Silero and different NumPy/ONNX Runtime versions; native speech inference was outside this run.

From a fresh copy of this Markdown and its evidence folder, run:

```sh
git clone https://github.com/snuhcs-course/swpp-2026-project-team-07.git outloud-source
git -C outloud-source fetch origin f1af9dd9737e2ac9adbe8a45186f0e2722863e60
python3.12 seoyeon-iteration-2-testing-evidence/tooling/prepare_source.py --repo outloud-source

python3.12 -m venv .coverage-python
.coverage-python/bin/python -m pip install -r seoyeon-iteration-2-testing-evidence/backend/environment-requirements.txt
.coverage-python/bin/python seoyeon-iteration-2-testing-evidence/tooling/backend/run_backend.py

# Select Node 26.8.2 and npm 11.19.1 before the client commands.
npm ci --prefix seoyeon-iteration-2-testing-evidence/source/mobile --ignore-scripts --no-audit --no-fund
npm ci --prefix seoyeon-iteration-2-testing-evidence/tooling/mobile-deps --ignore-scripts --no-audit --no-fund
node seoyeon-iteration-2-testing-evidence/tooling/mobile-run.mjs
node seoyeon-iteration-2-testing-evidence/tooling/mobile-report.mjs
node seoyeon-iteration-2-testing-evidence/tooling/mobile-mapping-selfcheck.mjs
node seoyeon-iteration-2-testing-evidence/tooling/mobile-verify.mjs
```

The preparation script verifies the pinned source without changing the checkout and rejects private `.env` files. No credentials/device are needed. Runners use committed `config.test_settings` and the supplied frozen lists/tooling; rerunning regenerates outputs. Exact measured commands/timestamps: [backend](seoyeon-iteration-2-testing-evidence/backend/commands.json) · [client](seoyeon-iteration-2-testing-evidence/mobile/command.json). Setup details: [backend](seoyeon-iteration-2-testing-evidence/backend/README.txt) · [client](seoyeon-iteration-2-testing-evidence/tooling/mobile-reproduce.txt).

### Earlier development checks

These overlapping checks ran on October 15–17. [Checkpoint metadata](seoyeon-iteration-2-testing-evidence/historical-checkpoints.json) distinguishes known patches/base commits from missing final identities. GitHub links pin the saved records at `f1af9dd`, not every historical tested revision. No historical coverage percentage is available.

| Date (2026) | Component and checks | Results and evidence |
|---|---|---|
| Oct 16 | Cues/profiles: word limits, source/cache/policy validation and concurrency | **52 focused PostgreSQL tests passed**, covering cues, profiles, review and Q&A. [Verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/cue-policy-v5-verification.md?plain=1#L22-L41) |
| Oct 16 | Feedback: quote formatting, numbers/negation, source/visit/staleness and independent findings | **139 PostgreSQL tests passed**; saved-result revalidation recovered **1 accepted / 0 rejected findings**, without a provider call. [Verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/evidence-validation-verification.md?plain=1#L33-L79) |
| Oct 15 | Corrections: accept/keep/restore, revisions, persistence, migrations and concurrency | **17 PostgreSQL tests passed, zero skips.** [Verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/phase-4-recognition-only-verification.md?plain=1#L32-L58) |
| Oct 16 | Selected-slide feedback: duplicate delivery and cache/result reuse | Two deliveries produced **one review request**; completed results were reused. [Verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/phase-5-verification.md?plain=1#L22-L43) |
| Oct 16 | Q&A: duplicate question/evaluation delivery, recovery and migration preservation | Two question deliveries produced **one question request**; two evaluation deliveries produced **one evaluation request**. Recovery completed and preserved the original recording. [Verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/phase-6-verification.md?plain=1#L23-L53) |
| Oct 17, separate checkpoints | Scoring/playback: rubric/evidence/lifecycle and repeated/backward/zero-duration visits/timestamps | **72 backend tests passed**; **35 mobile parser/playback tests passed** after the zero-duration repair. [Backend](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/presentation-scoring-milestones.md?plain=1#L85-L115) · [Client](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/android-scoring-visits-verification.md?plain=1#L38-L69) |

On October 15, an emulator recording stopped at **29:59.061**, uploaded and survived reopening. A separate generated 30-minute speech file produced **1,860 timed words** through the real worker/transcription flow. This does not establish thirty-minute phone speech accuracy. [Verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/phase-3-verification.md?plain=1#L54-L86)

### Personal phone checks

| Date (2026) | Observation |
|---|---|
| Oct 15 | Cues and transcription worked after initial failures. Short playback/transcription worked, but first/return slide visits were indistinguishable in the transcript view. Heading, sentence/word and Play controls behaved inconsistently. |
| Oct 16 | Recognition choices for spoken “Tajumulco” were inaccessible; audio played with a blank screen and Review return navigation was difficult. Q&A showed offline/unavailable, and swiping to an unfinished question produced a blank screen. |

[Recorded observations](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f1af9dd9737e2ac9adbe8a45186f0e2722863e60/docs/ai-collaboration-prompts-iteration-2.md?plain=1#L898-L1743). Exact installed-build IDs and a complete personal retest of all fixes are not retained. The later investigation did not reproduce the intermittent playback blank screen.

### Remaining checks

Coverage gaps remain: command wrapper **0%**, task dispatch **46.15%**, six client controllers **0%**, transcription-helper group **64.86%**. Targets applied to aggregate layers, not individual files/groups. Next checks should cover these paths and rerun the 19 PostgreSQL concurrency cases; uncovered files remain counted.

The October 22 run added no new device/provider, recognition-accuracy, usefulness or score-calibration evidence. Keep the companion evidence folder with this Markdown when sharing.
