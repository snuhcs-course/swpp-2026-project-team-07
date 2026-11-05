# Iteration 3 documentation evidence — November 5, 2026

This is a reconciliation of existing source and dated evidence, checked November 5, 2026 (Asia/Seoul). It adds no application, device, provider or deployment run. Earlier reports retain their original outcomes; a later result supersedes only the case it actually exercised.

## Baselines and implementation status

| Layer | Source and evidence date | Status |
| --- | --- | --- |
| Merged repository | [PR32](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/32), main [`7b7ef3b`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/7b7ef3be38e0e54fdca9ba0ebb403d670368d9ad), October 23 | Requirements v3.0 and Design Rev.3.1 describe PR31 application `c4a3f48`. These remain the Iteration 2 comparison baseline. |
| Published Android product | [v8 release](https://github.com/snuhcs-course/swpp-2026-project-team-07/releases/tag/outloud-demo-v8-20261103), [`cdb8055`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/cdb8055f0fd5022aafccb47625889d3f9a403f5f), November 3 | Four additional commits after main, including the hosted demo and v7/v8 repairs. Android versionCode 8; application changes remain outside main. |
| Later backend grading repair | Same release record, updated November 3 and read November 5 | Release-reported deployed v2.4: 24,000 output tokens, 128 KiB inner JSON and a grading-only 240-second response deadline. The repair source is uncommitted/unpushed. The release reports a successful original ten-slide retry with zero evidence rejections. No fresh runtime check was made for this documentation task. |
| Early advice preview | Local November 3 work, based on v8 | Implemented and checked locally; uncommitted/unreleased. Shows saved per-slide advice while whole-run scores load. It does not stream numeric slide scores. |
| Review performance and audience citations | Local November 4 work, based on v8 plus the backend repair | Uncommitted/unreleased v2.5 candidate. Caches unchanged projections and restricts requirement citations to fields actually supplied. No production deployment or replacement APK is established. |

Current document versions are 4.0. Their implementation links name the published source explicitly; updating these documents does not merge that application into main.

## Changes since Iteration 2

| Change | Implemented behavior and source | Evidence / limit |
| --- | --- | --- |
| Hosted access | [Production/public composition and access](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/cdb8055f0fd5022aafccb47625889d3f9a403f5f/docs/azure-hosting.md): HTTPS reviewer-code edge, shared workspace, offline local operation | November 1–3 records; no separate application accounts or per-user isolation. A reviewer code is not a provider key or spending cap. |
| Analysis routing | [Configuration](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/cdb8055f0fd5022aafccb47625889d3f9a403f5f/backend/rehearsals/services/feedback_config.py) defaults to OpenRouter `openai/gpt-6-luna`; Scribe v2 remains transcription | Defaults do not prove deployment enablement. Historical adapters/receipts retain their provider identity. |
| Defaults and Redo | [New defaults](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/cdb8055f0fd5022aafccb47625889d3f9a403f5f/mobile/src/features/presentations/defaultRequirementsState.ts) use General audience / 600 seconds; [Redo](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/cdb8055f0fd5022aafccb47625889d3f9a403f5f/mobile/src/screens/RehearseScreen.tsx) replaces the finished capture engine | Released v5/v7 fixes. Custom/cleared settings remain preserved; bundled Seoul's five-minute offline suggestion is separate. |
| Feedback and playback | [v7 record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/cdb8055f0fd5022aafccb47625889d3f9a403f5f/docs/demo-v7-combined-verification-20261103.md): full observations/suggestions, precise seeking, clear timing allocation and filler labels, English/Korean question speech selection | Covers #35, #36, #43–46 implementation. It does not establish human advice usefulness, general language detection or natural pronunciation. |
| Audio and recovery | [v8 record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/cdb8055f0fd5022aafccb47625889d3f9a403f5f/docs/demo-v8-issue49-verification-20261103.md): inclusive ±1,000 ms capture/decoded duration tolerance and targeted slide-review recovery | Original audio/timing stay unchanged. This build-time report precedes the separately reported backend v2.4 repair. |

## Dated verification evidence

| Run | Recorded outcome | What it does not establish |
| --- | --- | --- |
| October 22 Iteration 2 coverage | 548 mobile and 554 PostgreSQL backend tests passed. Backend coverage met targets; mobile logic line coverage 80.73% / 85% target and screens/components 61.78% / 70% target missed. [Coverage record](../testing.md#october-22-local-coverage) | These percentages are not current v8 coverage. Passing later test suites does not demonstrate either coverage target. |
| November 3 v8 release | Release reports 617 mobile tests, Android export/production build and reused hash-bound backend/infrastructure/device evidence. [Build record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/cdb8055f0fd5022aafccb47625889d3f9a403f5f/docs/demo-v8-issue49-verification-20261103.md) | The release task did not install v8 on a phone. The record is historical, not a suite rerun on November 5. |
| November 3 later v8 phone smoke | Samsung SM-S918N / Android 16: exact v8 installation, PDF import/defaults, playback and persistence; one human-operated 42.028-second English/Korean recording transcribed into three slide groups and displayed 67 overall. User confirmed both language portions sounded intact. | One operational smoke test, with limited human participation; no general recognition accuracy, calibrated scoring, full UAT or advice-usefulness acceptance. |
| November 3 early-advice candidate | Local record reports 624 automated mobile tests and ten synthetic Android checks | Unreleased preview; synthetic checks do not establish real-provider or human acceptance. |
| November 4 performance/audience candidate | Local record reports 628 mobile tests; 648 SQLite backend tests with 26 existing skips; 87 focused PostgreSQL tests without skips and one mocked-provider Redis/Celery check | Synthetic phone fixture and local candidate, not deployed performance or provider-generation latency. A brief result-arrival stall remains. |

The later phone and candidate records were inspected locally. Their source filenames and SHA-256 fingerprints are listed below so the summary can be tied to the preserved inputs without publishing private screenshots, recordings or receipts. The combined [prompt log](../ai-collaboration-prompts.md) retains the task decisions, checks and limits.

## Open requirements and issue administration

Pre-upload rehearsal disclosure, spoken summaries, full two-attempt comparison, complete local/server deletion and stop/save/discard navigation remain requirements. Slide-derived cues, Keep/Overwrite and Hide/Undo do not complete those criteria. The compact UI also omits earlier upload/transcription retry, correction and manual remote-audio-download controls; v8's targeted feedback recovery remains available.

GitHub issues #35–49 were open when inspected; [PR34](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/34) and [PR33](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/33) were unmerged. Selected PR34 UI and the released fixes above already appear in the demo. Open administrative state does not prove that a repair is absent. Reports #37–42 and #47–48 originate from older demo builds; their exact current-build status needs retesting. The first-Redo repair does not establish resolution of the separate Q&A timer report.

Performance targets, recognition/feedback-quality thresholds, owners and dates remain unset where not agreed. Human usefulness, large-text/TalkBack acceptance, score consistency and broad English/Korean quality remain incomplete. No issue closure, new product requirement or experiment adoption is inferred from this documentation update.

## Local evidence fingerprints

<!-- Local input fingerprints appended by the documentation reconciliation script. -->

| Preserved local input (relative to the original workspace) | SHA-256 |
| --- | --- |
| `outputs/he-apk-submission-20261103-evidence/verification-report.md` | `922cf09e91e43f87aa763a2cd9554641014e3cba04ba031ff2515d891cb9f5e3` |
| `outputs/v8-lag-audience-20261104/verification-report.md` | `634209c96e3c8360958f2a45a8e3c7af9ecbfa6f576be268473a5ec4e022694b` |
| `outputs/early-slide-feedback-20261103/source/docs/ai-collaboration-prompts-iteration-2.md` | `15b929710575d18d9773c8d27a3c1c2163f48df7f35071e4358c9ee7ed7f3ef0` |
