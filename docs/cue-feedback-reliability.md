# Cue and feedback reliability — October 16, 2026

> Historical feature evidence. The current retained-feature integration and cleanup are recorded in [retained-feature verification](retained-features-verification.md). Earlier deployment/test statements below belong to their original checkpoints.


Implemented on `it2/integration-ai-nakajima`, starting at `c5c370d`. Existing edits in `docs/ai-use.md` were preserved. The user authorized a commit after the implementation handoff; its revision is reported in the chat. No push was requested.

## Changes and decisions

- Cue GETs resume after transient failures with 2.5/5/10/30-second capped backoff. Current validated cached cues remain visible with one inline connection notice. Screen activation and app foreground resume reading immediately; covering, backgrounding, switching decks and unmounting cancel obsolete reads/timers.
- Failed-first-read feedback reconnects in detail and overview, without a generation POST. Active feedback shows queued/context preparation/provider processing/verification/quota state. Two minutes without a server timestamp change adds a delay notice; elapsed quota retry times are explicitly overdue.
- Missing completed-slide output is a recovery problem. Insufficient recorded words and model-declined assessment have different explanations. Invalid evidence, malformed responses, partial findings and valid empty findings retain their existing meanings.
- Cue and optional enrichment UI/accessibility labels now say Further Insight. Wire keys remain unchanged.
- Early profile generation already occurs during backend PDF upload and is deduplicated. Reused that behavior rather than adding another client admission path; recording remains available.

## Automated evidence

- `cd mobile && npm run check`: typecheck passed; ESLint had zero errors and one pre-existing warning in `useSegmentPlayer.ts:108`; all **416 tests passed**.
- `cd mobile && npm run bundle:android`: passed after the final application changes.
- Regression failures were observed before the fixes: stopped cue polling (1 read instead of 5), missing output classified as insufficient, generic stage messages, failed first feedback reads that never recovered, covered Rehearse issuing another GET, and an overdue quota wait described only as scheduled. Updated old label/source-shape assertions reflect the approved behavior.
- Existing mocked backend tests `SlideProfileTests.test_upload_admits_once_and_ai_failure_does_not_break_import` and `SlideProfileTests.test_admission_deduplicates_and_reads_do_not_admit`: **2 passed** in the existing worker container. That container mounts the AI-feedback backend, not this checkout; its profile implementation/tests match, but the integration branch differs in an unrelated limit file and provider test. No backend production code changed, and these results are not claimed as an integration-wide backend suite.
- Separate AI reviewer found the AppShell covered-screen focus mismatch. A real-Rehearse regression reproduced it, the fix passed that regression and the full suite, and same-screen cache/reconnection coverage was added. This is AI review, not human approval.

## Live runtime observations

The API on 58000 reported database and broker reachable. The existing worker answered ping with an empty reserved queue. One saved feedback job was waiting for quota with a retry timestamp already passed; no recovery scheduler was running. Its provider request had not been submitted or received. The agent restored Celery beat inside the existing worker container using its existing demo settings. The already-admitted job **68, generation 1** then completed; generation was not incremented. This does involve the original queued real-provider work, unlike the mocked automated tests. No recording, transcript or credential content is included here.

The restored scheduler uses `/tmp/outloud-demo-recovery.pid` and `/tmp/outloud-demo-recovery-schedule` inside the worker container. It is a current demo-session process, not a newly installed persistent service. A container restart requires the normal worker **and beat** startup described in README. Existing failed/uncertain work was not blindly regenerated.

Physical Android verification is recorded below. Fresh import, fresh microphone capture, new full-rehearsal provider latency, advice usefulness and human acceptance are not established by automated tests or JavaScript export.


## Agent-operated Android checks

The physical Galaxy S23 Ultra loaded the final integration bundle from Metro 8091, with API 58000 and existing app data. The agent refreshed Metro's stale development cache; the served Android bundle contains Further Insight and the new recovery messages. The phone Home displayed the specific `Transcript pending` status instead of a generic analyzing count. A saved presentation opened with **Must Cover / Further Insight** visible together; another slide displayed its actual cached cue. No microphone capture or import was performed. Screenshots remain temporary and are not included in the repository because they contain presentation/user content.


For a controlled disconnection, the agent temporarily routed only the phone backend port to an unreachable local port, cold-opened the app, and opened a saved presentation. Cached cue categories/empty-state content stayed visible and the panel displayed “Connection interrupted. Saved cues are retained. Reconnecting…”. The normal backend forward was then restored. This test did not change the backend service, app data or recording. The normal API and Metro forwarding rules were restored before handoff.


After restoring the forward, the reconnecting notice cleared automatically on the same cue screen without tapping Refresh or Generate; cached content remained visible. Final checks confirmed both phone forwards restored and **zero active feedback jobs** in the demo database. Metro remains running on 8091 with the same API URL; the restored scheduler remains running in the current worker container. A fresh recording and human usefulness review remain pending.


## Commit preparation

After the user's `commit` instruction, Codex staged only this task's 26 files. Earlier installation/offline-recovery additions in `docs/ai-use.md` remain unstaged. All 22 staged mobile source/test files were byte-identical to the verified working files. A separate AI reviewer examined the exact staged diff (tree `1ba4129ab2ac8b9ed90cd8b81e6b397da186db0d`), reported no actionable findings and 46 passing focused tests, and confirmed no staged secrets/generated artifacts. The final additions after that review only record this result. Earlier full-suite, Android-export and physical-phone evidence remains tied to unchanged application code. The user authorized the commit, without a push or human functional-acceptance claim.
