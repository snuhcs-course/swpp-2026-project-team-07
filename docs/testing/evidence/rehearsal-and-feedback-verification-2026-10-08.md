# October 8 rehearsal and feedback verification

[Original verification guide](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/verification.md). The snapshots use their historical environments and are not fresh results.


### Rehearsal review snapshot

The rehearsal-review snapshot passed independent AI review, **209 mobile tests**, TypeScript/lint and Android export. Coordinator checks passed Django system/migration checks, 74 tests on real PostgreSQL, API restart/media retrieval, and Android emulator review/recovery checks using the saved synthetic Whisper pilot without another provider call. Physical-phone/audible quality, native interruption/API-switch stress cases and human review remain pending. See [final evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-stack-consolidation-2026-10-11.md#2026-10-08--rehearsal-review-final-verification-and-publication) for exact coverage, review repairs and limitations.

### Feedback checkpoint 2

Checkpoint 2 passed independent AI review, Django system/migration checks and
172 tests on real PostgreSQL. Synthetic checks verified Redis/Celery/Beat
recovery and API/database restart with unchanged saved media. See the
[checkpoint evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-stack-consolidation-2026-10-11.md#2026-10-08--ai-feedback-checkpoint-2-coordinator-handoff).
Human inspection remains pending. Checkpoint-4 coordinator evidence for the mobile
feedback controls is linked in the checkpoint-4 snapshot below; live-provider quality is evaluated separately.

### Feedback checkpoints 4 and 5

Checkpoint 4 passed independent review, **270 mobile tests**, TypeScript/lint,
Android JS export, Django system/migration checks, **229 SQLite tests (18 skips)**
and **229/229 real PostgreSQL tests**. Agent-operated emulator checks covered
disclosure/cancellation, editing/staleness/regeneration, offline restart and evidence
seek with synthetic providers. See [coordinator evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-stack-consolidation-2026-10-11.md#2026-10-08--checkpoint-4-coordinator-verification).
The final checkpoint-5 backend passed **247 SQLite tests (18 PostgreSQL-only skips)**, **247/247 PostgreSQL tests**, system/migration checks and independent review. Real-worker saved-v2/new-v3 receipt recovery preserved one provider-stub call per case. Controlled `gemini-3.1-flash-lite` and `gpt-6-luna` description/coaching runs each completed two synthetic cases without another Whisper request; refresh, duplicate jobs and restart reused results. All seven accepted live cards passed mobile parsing/seek validation. The [evaluation record](feedback-evaluation-2026-10-08.md) includes earlier Gemini rejections, diagnostic calls, partial output, token usage and agent-assessed quality limits. Physical-phone listening/synchronization, accessibility, extended text/keyboard usability and human usefulness testing remain pending.
