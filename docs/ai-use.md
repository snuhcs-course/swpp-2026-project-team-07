# AI-use log

Record AI contributions to each task here, on the same branch as the associated
code or documentation. Summarize the relevant entry in the PR description and
use these records to prepare the iteration's GitHub Wiki AI Collaboration Report.
This file does not automatically publish or submit the course report.

## How to record a task

- Add a dated entry with the tool used, representative requests, generated work,
  what was incorporated, and how it was checked. Full chat transcripts are not required.
- Separate agent-run checks from human verification. Mark unperformed checks and
  pending review explicitly; update them when evidence or reviewer feedback arrives.
- Link to a PR or commit when available. Use repository links that teammates can
  access rather than paths on one person's machine.
- Preserve earlier results as historical evidence. Add dated follow-ups when
  later changes or reviews alter the status.
- Exclude credentials, private recordings/transcripts, and personal information.
  Do not infer another teammate's AI use or retroactively invent disclosures.

## Entry template

```md
## YYYY-MM-DD — Task title

- Contributor: <person responsible for this entry>
- Tool: <AI tool; model/version if known>
- Task and scope: <what the AI was asked to do>
- Representative request: <short quotation or clearly labeled summary>
- Generated work and incorporation: <files/changes used, modified, or rejected>
- Verification: <checks actually performed, by whom, and outcomes>
- Human review/corrections: <what a person checked or changed; pending if not done>
- Limitations: <unverified behavior or unfinished work>
- Related PR/commit: <link, or not created yet>
```

## 2026-09-29 — Shared agent guidance and AI-use logging

- Contributor: Injoon (requester); OpenAI Codex assisted with drafting and checks.
- Tool: OpenAI Codex.
- Task and scope: Prepare shared repository instructions and an AI-use log on
  `docs/agent-guidelines`, for user review before publication.
- Representative requests (summarized from Korean): Create the guidelines on a
  separate branch for review; add the AI-use log on that same branch; push the
  two files and open a PR only after the user has reviewed them.
- Generated work and incorporation: Codex drafted [AGENTS.md](../AGENTS.md) and
  this file. The draft uses the existing README, API contract, work-division
  documents, mobile instructions, and CI configuration. Existing mobile guidance
  and application code were left unchanged. Both files were prepared as local drafts
  for review before publication.
- Verification: Codex checked local Markdown link targets, code-fence balance,
  whitespace, and documented commands against the existing package scripts and
  Django settings. Application builds and tests were not rerun for this
  documentation-only change.
- Human review/corrections: The requester selected a shared `docs/ai-use.md` log
  and requested both files for review. Initially, review was pending. On
  2026-09-29, Injoon reported reviewing both files and finding them satisfactory,
  then authorized push and PR creation. No content corrections were requested.
  This records the requester's review, not an additional teammate approval or
  a submitted GitHub approval.
- Limitations: These guidelines have not yet been adopted through a merged PR.
  This entry documents this task only, not all prior AI work on the scaffold.
  Earlier local verification records have not been imported into this log.
- Related branch: [docs/agent-guidelines](https://github.com/snuhcs-course/swpp-2026-project-team-07/tree/docs/agent-guidelines).
  The PR description summarizes this entry.
- Publication follow-up (2026-09-29): Codex was authorized to commit and push
  these two files and open a PR. Merge was not requested.

## 2026-09-29 — Standalone word-to-slide alignment

- Contributor: Injoon (requester); OpenAI Codex implemented and checked this step.
- Tool: OpenAI Codex.
- Representative request (summary): Develop incrementally, explaining and reviewing
  alignment first, then Whisper integration, then the transcript screen.
- Generated work and incorporation: Implemented `align_words`, added nine synthetic
  unit tests in `backend/rehearsals/test_alignment.py`, documented the proposed
  visit-based return shape in `docs/word-alignment.md`, and updated scope notes.
- Verification by Codex: `python3 -m unittest rehearsals.test_alignment -v`
  passed all nine alignment tests. Using the existing local review virtualenv,
  `python manage.py check --settings=config.test_settings` passed;
  `python manage.py test --settings=config.test_settings` passed all 14 tests;
  `python manage.py makemigrations --check --dry-run --settings=config.test_settings`
  reported no changes. These are local, SQLite/synthetic checks, not CI results.
- Human review/corrections: Pending for this implementation; earlier review of the
  documentation PR does not constitute review of this code.
- Limitations: Return shape is proposed for integration-owner review. No provider
  request, real audio evaluation, database/worker integration, or device test was
  performed. No public API, persistence, or mobile contract was changed.
- Related branch: `feature/whisper-alignment`; this step is not committed or pushed
  and no feature PR has been created.

## 2026-09-29 — Hosted Whisper adapter

- Contributor: Injoon (requester); OpenAI Codex implemented and tested the adapter.
- Tool: OpenAI Codex with the OpenAI Docs skill and official API documentation.
- Representative request: Implement Whisper integration after the alignment step.
- Generated work: `transcription.py`, eight provider-mocked tests, SDK dependency
  declaration/lock update, and `docs/whisper-transcription.md`; updated current scope notes.
- Verification: Local backend suite passed 22 tests (eight transcription, nine
  alignment, five existing). Tests exercise the actual SDK via mocked HTTP;
  no OpenAI request or real audio evaluation was performed. Django system check
  passed and migration dry-run reported no changes.
- Human review: Pending for this adapter. No live accuracy or device verification
  is claimed. API key and user-selected test audio are needed for live verification.
- Limitations: Internal raw-response output and shared dependency changes require
  integration review. Persistence, duplicate-attempt protection, worker/API and
  mobile wiring are not implemented by this adapter. See its setup document.
- Related branch: `feature/whisper-alignment`; changes remain local and uncommitted.

### 2026-09-29 — Synthetic speech fixture

- At Injoon's request, Codex wrote a short Korean OutLoud presentation script and
  generated audio using the local macOS Yuna TTS voice, then converted it to AAC
  in an M4A container using ffmpeg. Files are under ignored `backend/media/`.
- ffprobe verified a duration of 23.902 seconds and a size of 305,512 bytes.
  The first sandboxed synthesis produced an empty file; synthesis with access
  to the system speech service produced the verified replacement.
- This is synthetic speech, not a human recording or accuracy evidence. No
  Whisper API call was made in this fixture-generation step. Listening review
  and live transcription remain pending.

### 2026-09-29 — Live Whisper check with synthetic speech

- After the requester accepted the generated TTS fixture, Codex sent that file
  to hosted whisper-1 using the backend key (key value was not displayed).
- The request succeeded: 38 word records returned. Transcript matches the input
  script after removing punctuation and whitespace; punctuation differs.
- Normalized times fit the 23,902 ms recording. Synthetic slide changes at 0,
  8,000, and 16,000 ms assigned 12, 13, and 13 words to visits 0, 1, and 0.
  These slide changes were test inputs, not captured app events.
- Full parsed response and alignment are saved only in ignored backend/media/
  as whisper-test-result.json and whisper-test-alignment.json.
- This verifies a real provider call and adapter-to-alignment flow with TTS.
  It does not verify human-speech accuracy, perceived timestamp precision,
  actual recording capture, app/API/worker wiring, or human code review.
  The provider returned a zero-length interval for one word; no timestamp
  correction or clamping was applied.

### 2026-09-29 — Standing review workflow

- Injoon reported reviewing the staged changes, then requested review before all
  future commits and pushes, not only this feature's first publication.
- Codex added the user-specific workflow to AGENTS.md: review staged/outgoing
  changes, separate agent review for substantive code, meaningful checks, review
  of fixes, and honest evidence. This records a preference, not a team-wide vote.
- The requester also reported instructor guidance to review AI-generated code
  manually or with AI before pushing. That report has not been independently
  checked against a new official course source.
- This documentation edit does not mean an independent review of the current
  feature has run, nor does it install a Git hook or authorize publication.

### 2026-09-29 — Independent pre-publication review and fix

- Injoon requested review under the new AGENTS.md workflow after reporting their
  own diff review complete. Remote inspection found no Whisper feature branch or
  open PR; HEAD remains b11ce27 and implementation is still local/staged.
- A separate Codex reviewer inspected all 11 staged files and unstaged instruction/
  log updates against the API contract, without private audio, keys, or provider calls.
- Finding P2: a non-object successful provider response escaped as AttributeError
  at model_dump instead of a safe TranscriptionError. Codex added a
  TranscriptionVerbose type guard and SDK-level regression cases for array,
  null, string, and integer responses; these also check one request and intact audio.
- The independent reviewer re-reviewed the exact fix, reran all nine transcription
  tests, and confirmed resolution with no new actionable findings. The full local
  suite passed 23 tests; Django system check and migration dry-run passed, and
  staged/working-tree whitespace checks passed. No new live provider call was made.
- Clarified handoff/alignment notes: synthetic TTS verification passed; human-recorded
  speech verification is pending. Extreme unrealistic numeric overflow was considered
  optional hardening, not a material finding for this review.
- Reviewed final Git blob IDs: transcription.py a03f545336c5d52eed851b0348d6a8a2b27459e3;
  alignment.py 428c57dda7589a6de7022a6bfc6de82ee9b8a77e;
  test_transcription.py 4f4cd9d90f0e5a75fd560ec1ec4f16aba50896e7;
  test_alignment.py 7dce0a2d576dc1dda15c0c37954fb90ee5fd5ad9.
- The original human review predates these fixes; user inspection of the additional
  diff remains pending. New fixes/log/rule changes remain unstaged to expose that
  delta. No commit, push, merge, or teammate approval is claimed.

### 2026-09-29 — Staged-review precautions

- At Injoon's request, Codex clarified the standing workflow in AGENTS.md:
  staging captures a snapshot; fixes need restaging and review; working-tree test
  results must match the staged code; unchanged reviewed commits do not need an
  identical review again before push. Outgoing scope and sensitive-file checks
  still apply, and changed code/context requires appropriate renewed checks.
- Verification: documentation diff/whitespace and command semantics reviewed.
  No application changes or repeated runtime tests were needed. Existing staging
  was preserved; these documentation edits remain unstaged for inspection.

### 2026-09-29 — Final user review and publication authorization

- Injoon confirmed reviewing all restaged changes, then authorized the scoped
  backend commit, push, and PR. This records requester review and authorization;
  no additional teammate review or submitted GitHub approval is claimed.
- Before publication, Codex verified that the four staged implementation/test blob
  IDs exactly match the independently reviewed versions recorded above. No code
  changed after that review, so its 23-test result is reused. Staged whitespace
  checks passed and no .env or generated media files are included.
- Remote main remains the branch base b11ce27. The PR covers backend adapters,
  tests, documentation, and the user's standing review workflow. App integration
  remains separate follow-up work after merge. Merge is not authorized here.

## 2026-09-29 — Mobile transcription client before recorder integration

- Contributor: Injoon requested work that can proceed while the recording teammate
  has not started. Scope is the mobile upload/request/result client, not taking
  ownership of server upload/storage or microphone capture.
- Tool: OpenAI Codex generated client.ts, wired the Expo File/fetch adapter in
  service.ts, added synthetic/mocked tests and npm test/check integration, and
  documented the handoff in docs/mobile-transcription.md.
- Verification: 13 mocked-network tests passed, TypeScript/lint checks passed,
  Android JavaScript export passed. The tests do not establish native file upload,
  Android device behavior, real server integration, or provider accuracy.
- No provider calls, real audio uploads, public contract changes, or new dependencies
  were introduced. Server 501 is an explicit error; preview UI remains labeled.
- Human review and integration verification remain pending. Changes are local;
  no staging, commit, push, or PR publication was requested for this step.

### Independent review follow-up

- A separate Codex reviewer found that coercing response status with String()
  allowed an array such as ["completed"] through validation. Codex required a
  string and added the reproducing malformed-response case, plus active-request
  and post-upload cancellation tests. The reviewer inspected the fix and reran
  all 15 tests successfully, with no further findings in the changed scope.
- TypeScript/lint and Android export passed; native upload/device verification
  remains pending. Final review targets are recorded below as Git blob IDs.
  - client.ts: f7592a5c611b66776354998bf06796dab0c8e5e5
  - service.ts: 042467388840e45214a29b2f395e69ba8dc89d7d
  - transcription.test.mjs: 9b01486b9a7f7c42f0fa74feca09b4dd0a1272c5
  - package.json: ad247d80fa63cc4ca73a07f0b1de806c714ae278

## 2026-09-29 — Saved Whisper transcript screen

- Injoon accepted building the result screen from the saved Whisper result while
  server/recording integration remains pending. Codex replaced the hand-written
  slide/feedback preview with full transcript and optional word timestamps.
- Only normalized text and words from the user-approved synthetic speech result
  were copied into a source fixture. The original ignored audio/script/result
  files remain excluded; no raw provider metadata, keys or private recordings
  were added. The fixture is necessary for a reproducible screen preview.
- Processing/failure and one-second retry are explicitly local simulations.
  Timers clear on state changes and unmount. No new API calls were made.
- Checks: mobile typecheck/lint, existing 15 client tests, and Android JS export
  passed. Separate AI static review of the screen and fixture found no actionable
  issues. Codex verified completed/processing/failed/retry and timestamp expansion
  in the Android 36 emulator using an existing dev APK with this branch's Metro.
- Human review remains pending. This does not verify actual mobile upload, worker
  execution, playback, slide-specific results, or human-speech accuracy. Changes
  remain local/unstaged; no commit or push was performed.

## 2026-09-29 — Integrated audio-follow transcript

- User corrected the separate transcript/timestamp presentation: words should
  highlight with recording progress. Codex used the frontend-design skill and
  Expo SDK 57 audio/picker documentation to implement a fixed player, flowing
  transcript, native-position highlighting and word tap-to-seek. No new dependency.
- Saved TTS audio is selected locally; filename/duration only guard obvious
  mismatches. Audio/script/raw JSON remain ignored. No new provider call or upload.
- Separate reviewer identified a late Replay seek that could resume after newer
  navigation/source intent and a swallowed seek failure. Codex added intent/focus
  guards and awaited successful seeks; two regression tests cover the helper.
  Reviewer reran all 21 tests and found no additional material issue on re-review.
- Typecheck, 21 tests and Android JS export passed. Lint: zero errors, one
  react-hooks/exhaustive-deps warning about the intent ref read during cleanup.
- Agent-operated Android 36 check: local file selection, playback to about 0:05
  with 소개하겠습니다 highlighted, pause, and tapping 안녕하세요 to return to 0:00.
  Existing development APK/current Metro used. Emulator audio output was disabled;
  audible timing, new APK build, native upload and live backend flow remain unverified.
- Human review pending. Changes are unstaged; no commit/push. Earlier saved-screen
  evidence above is historical; current structure is documented in mobile-transcription.md.

## 2026-09-29 — Final pre-staging independent review

- User requested another AI verification and staging only if no problems were found.
- A separate Codex reviewer inspected the complete 12-file working-tree change,
  including untracked client/playback code, fixture, tests and documentation,
  against the shared API contracts. No actionable blocking defect was found.
- Reviewer ran npm run check: TypeScript passed, all 21 tests passed, lint had
  zero errors and the existing single intent-ref cleanup warning. The warning
  was assessed as nonblocking; the ref is a mutable operation counter, not a DOM ref.
  git diff --check passed. Prior successful Android export and emulator checks
  remain applicable because the application code has not changed since those checks.
- The emulator was subsequently restarted without -no-audio; audible timing has
  not been independently measured or confirmed by the user. Live upload/server
  integration remains unverified and is not represented as implemented end-to-end.
- Staging is authorized; commit/push and final human inspection remain pending.
  Generated media, raw provider output and credentials remain excluded.

## 2026-09-29 — Human inspection and branch naming

- User reported no apparent issue after direct inspection, asked to assess/rename
  the branch, and explicitly deferred improving the unsatisfactory transcript UI.
  This is functional review feedback, not final visual-design approval.
- Codex renamed the local branch from feature/transcript-screen to
  feature/transcription-client-and-playback and updated current documentation.
  Earlier branch names and review status above remain historical records.
- Application code is unchanged from the independently reviewed staged snapshot.
  Documentation changes were checked for consistency and staged; no commit/push.

## 2026-09-29 — Publication authorization

- After direct inspection and branch renaming, the user explicitly authorized
  commit, push and PR creation. Final staged application/test blobs match the
  separate review's recorded hashes; no application changes followed that review.
- Refreshed origin/main matches this branch's base. Staged whitespace and
  working-tree/index consistency checks passed. Existing verification applies;
  UI refinement and live backend integration remain follow-up work.

## 2026-10-07 — Revert PR #5 for separate feature reviews

- Source/status: user request received 2026-10-07 in Codex: “Okay I want to revert #5 through new PR.” Confirmed authorization to prepare and publish a revert PR; merging it remains pending.
- Tool: OpenAI Codex. Applied the inverse of merge `c6095141d182e4d5aa30b0d2e1c7d1eb5d311696` relative to its first parent, preserving shared Git history. Application code, configuration, dependencies, and README return to the PR #4 baseline `7af66ab`.
- Purpose: reintroduce PDF viewing and recording through separate teammate-owned PRs with review and verification. This is a review-process reset, not a claim that all integration changes were defective.
- Historical disclosures removed by the mechanical revert are preserved verbatim in [PR #5 AI-use history](history/pr-5-ai-use.md). Original feature commits remain in Git history: PDF `9547f1d`, recording `04857fb`.
- Follow-up: after this revert merges, each owner starts a fresh branch from updated main and reapplies their original feature change. Review integration changes explicitly when updating the second feature PR after the first merges. PRs #6–#9 depend on the reverted integration; this task does not close or delete them.
- Verification: clean dependency install from the restored lockfile succeeded. `npm run check` passed TypeScript and all 21 mobile tests; lint had zero errors and one existing `react-hooks/exhaustive-deps` warning in `ResultsScreen.tsx:33`. `npm run bundle:android` passed. Staged whitespace check passed; the entire staged tree matches `7af66ab` except this disclosure and the historical AI-use archive. Backend files are unchanged; backend tests were not rerun.
- Independent Codex review of the exact staged diff found no actionable findings: correct merge parent and baseline, consistent removed dependencies/plugins/consumers, and verbatim preservation of both original AI-use additions. Working tree matched the staged snapshot. No new Android device verification or human teammate approval is claimed; native/device behavior remains unverified in this task.


## 2026-10-08 — PDF and recording integration restoration (Codex, pending human inspection)

- Request: implement the approved six-stage restoration in order; review PR #13 separately, preserve local references, and complete PDF/capture integration before durable attempts or hosted processing.
- Incorporated: Real local PDF identity, native page count (up to 10), confirmed selected starting page, and audio-timed page-change callbacks are connected to capture. Actual saved audio plays in Results without a sample transcript. Capture failures/navigation use the reviewed lifecycle behavior.
- Reuse: PR #13 (`040880f8`), local PDF restoration (`260dcbae`), local recording regression/retry work (`b28de880`) and copied integration reference code/tests. The source worktrees and teammate branch were preserved.
- AI-generated changes: lifecycle regression tests/guards, integration wiring, catalog concurrency/size validation, documentation. Expo SDK 57 docs and installed native source were inspected; no provider calls or credentials were used.
- Verification so far: clean baseline 21/21; restored regression tests reproduced missing behavior, followed by passing automated checks. Final commands/counts and independent review evidence are recorded below when completed.
- At initial staging, independent review and human inspection were pending. The user subsequently authorized publication as PRs and continued implementation of all stages; teammate review and merges remain pending. SQLite attempt recovery, uploads, Whisper jobs and selectable feedback are later stages.

### Final stage 1 review and checks

- `npm run check`: passed (typecheck, lint and 60/60 tests). `npm run bundle:android`: passed on the final product code. `git diff --cached --check`: passed. Backend unchanged; backend/worker/provider checks do not establish any new capability in this mobile-only stage.
- Independent AI reviewer: separate Codex agent reviewed staged source/contracts/tests, then reviewed the changed failure paths. Initial Android event-order coverage exposed a stale completion event affecting the next capture; captures now await native completion and use separate recorder lifetimes. The reviewer reproduced stale parent preview after a later failed capture; the new Start now clears that preview. Added bounded-stop and consecutive-PDF regression tests. Final disposition: no remaining actionable findings. This is AI review, not teammate approval.
- Reviewed staged diff before this documentation-only evidence update: SHA-256 `b3584fa7b743c7b314151b1a019a19849696efa617b6bc96e914221d777834e6`. Documentation evidence was self-reviewed against command outputs afterward.
- Native integration verification: JDK 17 `./android/gradlew -p android assembleDebug -PreactNativeArchitectures=arm64-v8a -x lint -x test` passed. An isolated read-only Android emulator imported the synthetic six-page PDF, rendered page 3, captured visits 3 → 4 → 3, finalized 1:03 of audio and loaded/advanced its native player. A second recording finalized after Android Back. App restart retained the PDF catalog. Revoked microphone permission produced an explicit denial and fresh retry succeeded after regrant. A malformed synthetic PDF displayed a renderer error. These checks exercised the integration branch; they are not independent device checks of every prerequisite branch.
- Android investigation found that the permission activity briefly backgrounds the app. Capture now checks foreground state after permission/preparation; an already-running capture stops on background. Temporary diagnostic traces were removed.
- Still pending: physical-phone microphone/audible quality, hardware interruptions and sub-second Stop on a physical device. Automated tests cover zero/invalid durations, delayed native stop errors, missing completion, and hung stop promises; these do not replace device evidence. No API/provider calls were made.
- Human instruction: “just post it as a pr so another person can check the code but continue implementing other features,” followed by “implement everything and then wait for others to merge.” Commits/push/PR publication are authorized; human review/merge approval is not claimed.


## 2026-10-08 — durable attempt storage restoration (paused before next implementation)

- Tool: Codex. Requests: restore durable attempts/uploads; publish for teammate review while continuing; consolidate related work under feature/*; then stop before the next implementation, report/replan, and require user confirmation.
- Historical working name: `feature/attempt-processing` (superseded by publication target `feature/recording-storage-upload`), based on reviewed PDF/recording integration `b60c357`. Changes are currently uncommitted and not independently reviewed. No new human approval or completed device check is claimed.
- Incorporated material: prototype storage/PDF backend and additive migration from `764e683`, local SQLite approach from the preserved prototype; new durable capture integration, local/server identity separation, retry-only upload, restart recovery, exact decimal byte limits and concurrency tests. The original prototype and its local edits remain untouched.
- Verification: storage tests first failed against 501 endpoints, then passed after restoration. `npm run check`: 66 passing tests (including actual Node SQLite reopening in another process and mocked native boundaries). Backend check passes; SQLite suite 29 tests with 2 PostgreSQL-only skips; migration-drift check reports no changes. Isolated PostgreSQL on port 55432: additive migrations and all 6 storage tests passed, including simultaneous duplicate deck/attempt uploads and conflicting IDs. No provider calls were made.
- Remaining before publication: independent staged-diff review, Android validation of newly added SQLite/capture/recovery/upload flow, persistent server restart/media verification, and final handoff. Stage 1 emulator evidence does not cover these new changes. Dependency installation reported npm audit advisories; these have not yet been triaged and no audit-clean claim is made.
- Publication/cleanup: related Stage 1 PRs #14–#16 are superseded by #17 (`feature/pdf-recording`). The three redundant remote codex branches were deleted at the user's explicit request only after creating and independently verifying `OnLoud-backups/2026-10-08-consolidated-feature-branches/repository.bundle` and its browsable clone. Original worktree files and teammate/prototype branches remain preserved.
- Next implementation requires user confirmation. Proposed scope is hosted `whisper-1` processing with persisted request states, transcript reuse, alignment/results, silence handling, uncertain-outcome recovery and the first-use audio disclosure. Gemini/OpenAI feedback and review/UI work remain later implementations.

## 2026-10-08 — recording storage/upload failure repairs (Codex; runner review pending)

- Representative request: finish the existing recording storage/upload implementation, preserve its source patch and identity/timeline rules, repair concrete failure cases, and stop before Whisper or UI redesign. Publication target: `feature/recording-storage-upload`.
- Starting material: applied the frozen binary patch with `git apply` without staging, based on `b60c3571a481cd60160ea79a3ab44bd5a86f2856`; SHA256 `65ccb8529d0fa57a5c17d6ba13581bb397456478cae0b9afc68c595ad6858ff6` verified. Prototype reuse/attribution to `764e683` above is preserved. Other worktrees were not modified.
- Incorporated repairs: SQLite initialization/recovery and atomic prepared-URI storage (`mobile/src/services/storage.ts`, recording `storage.ts`); recorder cleanup despite metadata-write failure (`RehearsalScreen.tsx`); replay/focus/seek and saved-read error handling (`SavedAttemptScreen.tsx`); validated API-scoped deck mappings and upload-only retry handling (`upload.ts`). Limits and native audio-relative integer timestamps, including repeated/backward visits, are preserved. Oversized legacy audio stays local with a shorter-recording explanation. Existing screen structure is retained.
- Backend: `rehearsals/services/storage.py` now tracks partial media writes in unique submission paths, protects committed/winning media after transaction exceptions, preserves media if the database outcome cannot be resolved, and validates decoded audio duration. Cleanup failures may leave unreferenced files; no automatic deletion/reconciliation job was introduced. `services/pdf.py` clarifies MiB units. README/API descriptions now reflect storage-only upload and process HTTP 501.
- Regression evidence: new mobile storage-failure, uploader and saved-playback tests plus expanded capture/restart tests use real Node SQLite and synthetic native/network fixtures. Failing tests reproduced poisoned initialization, stranded capture cleanup, replay/read failures, stale deck mappings, and masked upload errors before repair. Backend failure injection reproduced missing committed media and orphaned partial writes before repair. `test_storage.py` adds normalized UUID/default metadata, valid-content conflicts, truncated/undecodable audio, cleanup/commit faults and development HTTP media retrieval; PostgreSQL-only races now force both requests past the initial missing-row check and assert winner hashes/bytes.
- Current checks using dependencies already provided in this workspace: `mobile/`: `npm run check` passed TypeScript, lint and **94 tests**; `CI=1 EXPO_OFFLINE=1 npm run bundle:android` passed. `backend/`: `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings` passed **42 tests, including 2 PostgreSQL-only skips**; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. Expected fault-injection warnings, Node module-format warnings and react-test-renderer deprecation notices occurred. Synthetic PDF/PNG/audio retrieval passed via Django test HTTP routes; this is not a server-restart check. Expo SDK 57 [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) and [audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) documentation was consulted. No dependencies were installed, private media/credentials read, or live providers called.
- Pending coordinator evidence: rebuilt Android client capture/force-stop/relaunch/recovery/audible replay and rapid replay/navigation; offline/reconnect retries preserving UUID/audio/visits; PostgreSQL migrations and deterministic concurrent storage tests; persistent server restart followed by original PDF, slide and audio retrieval; PostgreSQL/Redis readiness, worker availability and shared media access without processing jobs. These checks were not performed in this writer task. Historical totals above do not validate the final patch. The runner must stage and independently review final content; human review/corrections remain pending. No agent delegation, staging, commit, push or merge occurred. Publication and user confirmation before Whisper remain coordinator responsibilities.


### Local agent pipeline 20261008T012701Z-819aee

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T012701Z-819aee/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T012701Z-819aee/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T012701Z-819aee/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — processing review repair: selected upload API (Codex)

- Representative request: fix the confirmed review finding that switching the saved-attempt API still uploaded to the global address. Incorporated changes are limited to `mobile/src/features/recording/SavedAttemptScreen.tsx`, `mobile/src/features/recording/upload.ts`, their two existing test files, and this disclosure. Existing staged processing work is preserved; this writer did not stage, commit, publish, install dependencies, inspect credentials/private media, delegate, or call a live provider.
- The screen passes its selected API into upload. PDF lookup/upload, audio upload, deck mappings, completed-upload detection and in-flight deduplication use the same normalized address. Screen callbacks have destination/attempt lifetimes; a late upload success/failure from an older destination cannot overwrite the latest requested destination's local checkpoint. Reselecting an active destination reuses its request and restores checkpoint ownership. Recording UUID, audio and slide events remain unchanged; upload does not trigger analysis.
- Regression evidence: four added cases first failed on wrong destination, missing selected-server upload or cross-server request coalescing, then passed. A follow-up destination-reselection case caught checkpoint ownership remaining with the other server and passed after correction. Six added cases cover actual Upload taps after API changes (fresh and already-uploaded recordings), repeated taps, normalized mapping/deduplication, overlapping destinations, old failure callbacks and retained replay. Tests use synthetic files, mocked network/native boundaries and real local SQLite persistence. The [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/) and [FileSystem upload documentation](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/) were consulted; no native API or dependency changes were made.
- Fresh checks from `mobile/`: `npm run check` passed TypeScript, lint and **111/111 tests**; `npm run bundle:android` passed (**1,381 modules**). From `backend/`: `.venv/bin/python -B manage.py check --settings=config.test_settings` passed; `.venv/bin/python -B manage.py test --settings=config.test_settings` passed **70 tests with 5 PostgreSQL-only skips**; `.venv/bin/python -B manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. `git diff --check` passed. Existing Node module-format/react-test-renderer deprecation and export color warnings, plus expected injected backend warnings, remain; no lint warnings/errors were reported.
- Pending: runner staging and independent review of the repaired content, then human inspection. Coordinator must verify Android switching/upload/Analyze/offline/reopen/audible replay, including switching during an upload. Previously listed PostgreSQL/Redis/Celery/Linux packaging, quiet/short EN/KO speech and controlled hosted-pilot checks remain pending; SQLite tests and JS export do not establish them.


### Storage publication verification and coordinator handoff — 2026-10-08

- User explicitly requested implementing the approved storage-first plan through the local multi-agent pipeline, publishing for teammate review, and stopping for confirmation before Whisper. Renamed the existing branch to `feature/recording-storage-upload`; the preserved prototype, teammate branches and unrelated edits remain unchanged.
- Pipeline preflight passed with authenticated Codex CLI 0.159.2; all 16 runner tests passed. Used the configured model without override: separate planner, parallel mobile/backend investigators, one writer and a fresh independent reviewer. The frozen starting patch was SHA-256 `65ccb8529d0fa57a5c17d6ba13581bb397456478cae0b9afc68c595ad6858ff6` against `b60c357`. Coordinator provided isolated dependencies. No agent inference was represented as offline/local-model inference.
- Confirmed fixes cover SQLite initialization and capture-write failures, prepared audio-reference persistence, retry-safe startup recovery, saved-audio replay/navigation, stale server mappings, upload acknowledgements, undecodable audio, and media cleanup after uncertain database commits. New regression tests exercise these failures; the original prototype's source attribution remains above.
- Independent reviewer found no actionable findings in staged patch SHA-256 `c99fbba11e554a8d7925741e2fd9fddcf46fc118e7d05ae743b79c1671696bc3`. The coordinator transferred the patch to the feature branch and verified byte-for-byte staged equality. Only this evidence, README status and handoff documentation changed afterward; those prose changes received accuracy/link/diff review. Human review is pending.
- Final runner checks: `npm run check` passed TypeScript, lint and **94/94 tests**; `npm run bundle:android` passed. Backend `manage.py check`, `manage.py test`, and `manage.py makemigrations --check --dry-run`, all with `config.test_settings`, passed (**42 tests, 2 PostgreSQL-only skips**; no migration drift). Final `manage.py test rehearsals.test_storage --noinput` on isolated PostgreSQL passed **19/19**, including deterministic concurrent identical/conflicting uploads and winning-file checks. Additive migrations were applied to the isolated persistent database.
- Native verification: Expo prebuild and JDK 17 Android `assembleDebug -PreactNativeArchitectures=arm64-v8a -x lint -x test` passed. Final native configuration and dependency lock match that APK. On an isolated read-only Android emulator, the final staged JS recorded a synthetic six-page PDF starting on page 3, retained visits 3→4→3 with native millisecond timing, and reopened its SQLite metadata/audio after force-stop. Native playback and replay from the end worked; navigation returned to the library. Killing capture retained its audio reference/checkpoint as interrupted; playable audio recovered to saved state. Rapid/overlapping seek and stale callback cases are automated tests, not physical-device evidence.
- Final Android upload checks: a stopped API produced a visible connection failure while preserving the saved attempt. After API restart, retry succeeded under the same UUID with identical duration, slide visits and audio bytes; the screen displayed Uploaded · awaiting analysis. No transcript fixture appeared for real recordings.
- Persistent integration: restarted the isolated PostgreSQL database and final-code API, then retrieved matching original PDF/audio SHA-256 hashes and rendered slide images. A separate Redis/Celery worker answered ping and ran a temporary read-only storage probe, loading the same PostgreSQL attempt and exact shared PDF/audio bytes. The probe was outside the repository and did not invoke `process_attempt` or any provider. This establishes storage access, not implemented background analysis.
- Dependency assessment: `npm audit --json` on this lockfile and the unchanged PDF/recording baseline returned identical vulnerability entries: **33 total (10 moderate, 22 high, 1 critical)**. Storage added none; no audit-clean claim or forced SDK downgrade is made. Existing dependency remediation remains separate work.
- Remaining boundaries: physical-phone microphone/audible quality, hardware interruptions, physical rapid-stop behavior, human code review, and all live-provider/processing validation remain pending. Audio used in these checks was synthetic/emulator pilot material. No credentials, private recordings, generated native projects, installed dependencies or pipeline logs are included in the commit.
- Publication is authorized as a PR based on `feature/pdf-recording`; no merge is authorized. Hosted Whisper API processing, full review screens, Gemini/OpenAI feedback and UI polish were not started. Report this storage stage and wait for user confirmation before the next implementation.

## 2026-10-08 — explicit hosted Whisper processing (Codex pipeline writer; review pending)

- Representative request: implement saved recording → explicit Analyze → hosted `whisper-1` → durable transcript/aligned visits/metrics, retaining local replay and conservative manual retries. This user-authorized stage supersedes the earlier stop-after-storage instruction. One writer changed contracts/code on the pipeline workspace; no delegation, staging, commit, push, merge, private-media/credential inspection, dependency installation or live provider calls were performed.
- Incorporated material: additive Attempt/ProviderRequest migration; durable queue/admission/claim/recovery service and Celery scheduler; hosted adapter split into local preparation, one outbound request and normalization; private raw/usage persistence before normalization and transcript before alignment; CPU packaged Silero/PyAV presence gate; metrics; strict process/result API; mobile types/validation, consent, explicit processing, API/attempt-scoped SQLite cache and focus/background-safe polling; retained saved-audio playback. Feedback is disabled. Source foundation: existing hosted `services/transcription.py` and unchanged `services/alignment.py`. Read-only prototype `33907d3` supplied only the presence policy from `local_transcription.py` and the metrics approach from `metrics.py`; its local Whisper/model downloads, automatic retries and duration extension from `tasks.py` were not incorporated. Korean counts are accurately labeled Hangul-run estimates over total rehearsal time.
- Behavioral evidence: the initial admission test failed against HTTP 501 before implementation; mobile tests failed on missing processing/disclosure before integration. Final regressions cover duplicate admission/retry generations, stale/expired claims, marker-save failure, missed publication, crashes before/after submission, raw/transcript reuse, normalization/alignment partial failures, auth/rate limits/uncertain outcomes/missing keys, original bytes/input hash, no transaction during outbound work, and raw → transcript → alignment durability/privacy. Migration tests preserve old results/media and do not queue old work. Existing repeated/backward/simultaneous boundary alignment tests remain in the suite. SQLite tests do not claim concurrency; three processing and two upload race tests explicitly require PostgreSQL.
- Mobile evidence: `npm run check` from `mobile/` passed TypeScript, lint and **105 tests**; `npm run bundle:android` passed (1,381 modules exported). Tests exercise disclosure cancellation/consent-write failure/repeated Continue, revision-aware uncertain-charge acknowledgement, timeout reconciliation without repeated POST, cached partial transcript offline/reopening, cache-write failure, API changes, polling cancellation on blur/background, and attempt/player release with deferred seeks. Mocks now use per-hook/source player lifetime and reject calls after release. Node module-format and react-test-renderer deprecation notices remain; no lint errors/warnings in the final run. JS export does not prove native Android behavior.
- Backend evidence, run from `backend/`: `.venv/bin/python -B manage.py check --settings=config.test_settings` passed; `.venv/bin/python -B manage.py test --settings=config.test_settings` passed **70 tests with 5 PostgreSQL-only skips**; `.venv/bin/python -B manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. Expected synthetic invalid-PDF and injected storage/broker warnings appeared. An earlier unlabelled test invocation from the repository root discovered zero tests; it was superseded by the full backend-directory runs above. `git diff --check` and local documentation-link checks passed; index remains untouched.
- Dependency evidence: networked `uv pip compile` initially failed on PyPI DNS. After the pinned dependencies/cache became available in this environment, `uv pip compile backend/requirements.in -o backend/requirements.txt --cache-dir /tmp/onloud-uv-cache --offline` resolved **61 packages** and generated the lock. Installed metadata confirmed Silero 6.2.0, Torch/Torchaudio 2.8.0, ONNX Runtime 1.23.2, NumPy 2.2.6 and PyAV 16.1.0. The real packaged CPU gate passed generated silence with socket connections forbidden; PyAV decode/presence-policy tests preserve original bytes. Detection-error and presence branches also use labeled mocks. A local synthetic-speech generation probe yielded empty audio, so quiet/short speech accuracy was not established. No model was downloaded by this writer.
- Documentation consulted: versioned [Expo 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) and [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), installed Expo audio lifetime code, and the [Silero packaged loader](https://github.com/snakers4/silero-vad/blob/master/src/silero_vad/model.py). Current installed Silero confirms CPU ONNX loading. Historical memory supplied orientation only; current source/prototype files were inspected directly.
- Pending coordinator/human evidence: install/verify the generated lock in Linux/Compose; PostgreSQL locking/races and migration preservation; Redis outage/missed publish; scheduler/worker restart and worker termination before submission, after submission and after raw persistence; stale-worker completion; Android disclosure/consent persistence/process restart/offline cache/API changes/background/navigation/rapid taps and audible local replay; approved quiet/short English/Korean speech; controlled consented hosted pilot and human boundary review. No such infrastructure/device/live-provider result or named approval is claimed. The runner must stage the exact final scope, run mandatory checks and obtain independent review (bounded repair cycles) before human inspection and any separately authorized publication.


### Local agent pipeline 20261008T020210Z-143ece

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### Local agent pipeline 20261008T020210Z-143ece

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-1/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — processing review repair: cached results after API switching (Codex)

- Representative request: fix the confirmed review finding that API A's cached analysis disappears after uploading the recording to API B and reopening A offline. Incorporated changes are limited to `SavedAttemptScreen.tsx`, `useAttemptAnalysis.ts`, `saved-attempt.test.mjs`, and this disclosure. The screen displays current-API cached results independently of the latest upload destination; cached results permit read-only Refresh, while Analyze/Retry retain current-server upload gating. Recording identity, audio, upload metadata and API contracts are unchanged.
- Regression evidence: three A → B upload → A offline cases (completed, partial failure, awaiting analysis) first failed because the analysis card was hidden, then passed after the fix. They exercise real screen/hook/upload/cache code with synthetic fixtures, mocked network/native boundaries and local SQLite, asserting server isolation, retained transcript/audio/visits, local replay, offline and reconnected Refresh, and no processing POST. `node --test tests/saved-attempt.test.mjs` passed **22/22** from `mobile/`.
- Fresh checks: from `mobile/`, `npm run check` passed TypeScript, lint and **114/114 tests**; `npm run bundle:android` passed (**1,381 modules**). From `backend/`, `.venv/bin/python -B manage.py check --settings=config.test_settings` passed; `.venv/bin/python -B manage.py test --settings=config.test_settings` ran **70 tests, with 5 PostgreSQL-only skips**, successfully; `.venv/bin/python -B manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. `git diff --check` passed. Existing Node module-format/react-test-renderer deprecation/export color warnings and expected backend fault-injection warnings remain.
- Pending: runner staging/independent review of this repair and human inspection; coordinator Android A → B → A offline/reconnect and audible replay checks, plus previously listed Linux/Compose, PostgreSQL/Redis/Celery, quiet/short English/Korean speech and consented hosted-provider pilot validation. No native API/dependency changes, installs, private-media/credential reads, live provider calls, delegation, staging, commits or publication occurred in this repair.


### Local agent pipeline 20261008T020210Z-143ece

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-2/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — rehearsal-review round-2 findings repair

- Tool/request: sole local Codex implementation writer, configured model unchanged; repair the three confirmed round-2 review findings within the approved rehearsal-review scope, preserving staged work. No named owner approval is inferred.
- Incorporated changes: `SavedAttemptScreen.tsx` routes EOF through `playback.ts` and reads fresh native position; newer queued/running seeks retain playing intent while natural EOF, an unsuperseded seek to the end and explicit Pause stop playback. `useReviewMedia.ts` binds error callbacks to source URI and focus session, rejecting detached/background callbacks without clearing good replacement files. `useReviewDeck.ts` exposes its cancellable refresh through the existing Refresh action, preserving cached metadata and rejecting superseded/lifecycle/API callbacks. README, contract and handoff describe the changes; existing prototype attribution is retained. No backend, provider, schema or dependency changes.
- Regression evidence: three new synthetic screen tests failed before production edits, reproducing every finding, then passed after repair. Twelve added tests in `playback.test.mjs` and `review-screen.test.mjs` cover queued/running/delayed EOF, normal completion/replay/Pause, replacement PDF errors and retained sources across background/navigation, missing-metadata recovery, cached-deck failure, superseded refresh and cancellation on background/navigation/API change. In-memory files, mocked HTTP and native events only; review requests remain GETs.
- References: fetched matching [Expo 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) and [Router](https://docs.expo.dev/versions/v57.0.0/sdk/router/) docs and inspected installed Android status emission. The repair reuses existing native APIs; no new dependencies were installed.
- Fresh checks from `mobile/`: `EXPO_NO_DOTENV=1 node --test tests/playback.test.mjs tests/review-screen.test.mjs tests/saved-attempt.test.mjs` passed **68/68**; `EXPO_NO_DOTENV=1 npm run check` passed TypeScript, lint and **179/179** tests; `EXPO_NO_DOTENV=1 npm run bundle:android` exported **1,393 modules** successfully. `git diff --check` passed. Existing Node module-format, react-test-renderer deprecation and export color notices remain. No checks were disabled.
- Pending: runner staging, mandatory checks and independent review of these fixes, followed by human inspection. Coordinator should repeat Android EOF/newer-seek/Pause ordering, PDF replacement/lifecycle errors, metadata recovery, offline reopening and API switching with the saved pilot and **zero additional provider requests**. Prior coordinator backend/PostgreSQL/media-restart/device evidence was not rerun by this writer; physical-phone/audible synchronization remains unverified. These repairs are unstaged on top of the runner's existing staged patch. No staging, commits, publication, delegation, credential/private-media reads or live provider calls were performed by this writer.

### 2026-10-08 — coordinator repair: silent timelines and Torch pins (Codex)

- Representative request: correct only no-speech visits/metrics and upgrade the audited Torch/Torchaudio pair, preserving earlier review fixes. Incorporated changes: `processing.py` durably saves the empty transcript/outcome then uses existing alignment and timing metrics; mobile result validation/types require the normal metrics shape and empty words for silent visits; focused processing/client/model regressions and linked API/setup/handoff documentation. No other processing, replay, native API or admission behavior was redesigned. Existing prototype `33907d3` alignment/metrics attribution above remains unchanged; no further prototype code was copied.
- Regression evidence: the two no-speech processing tests and client acceptance test failed on the pre-repair source, then passed. Coverage includes simultaneous/zero-duration, repeated and backward visits, authoritative duration, unchanged synthetic audio/events, GET/history/process consistency, zero provider requests, alignment failure with saved partial data/manual retry, and simulated worker exit after the empty transcript save followed by stale-claim recovery. Client tests accept timeline-derived silent results and reject the former `{}` metrics shape, nonempty silent words and wrong metric duration. Worker-exit tests use injected exceptions/SQLite; they do not establish real process/locking behavior.
- Dependency evidence: `uv pip compile backend/requirements.in -o backend/requirements.txt --cache-dir /tmp/onloud-uv-cache --offline` regenerated **61 pins** with the repository paths in its header; comparison to the staged lock changed only `torch` and `torchaudio`, 2.8.0 → 2.10.0. Existing environment metadata matched all 61 generated pins; this writer installed nothing. Read only the coordinator's named baseline/candidate/patched audit JSON reports: 0/8/2 advisories. The six-advisory reduction leaves `PYSEC-2026-139` (PT2 loading) and `PYSEC-2025-194` (`torch.jit.script`); no audit-clean claim is made. Inspected the application's gate and installed Silero 6.2.0 loader/inference source: packaged ONNX CPU inference consumes PyAV-decoded tensors without passing uploads to either affected operation. The residual installed-library risk and advisory links are recorded in [whisper-transcription.md](whisper-transcription.md#packaged-gate-dependency-assessment-2026-10-08).
- Fresh local checks, from `backend/` with `PYTHON_DOTENV_DISABLED=1` to avoid reading local credentials: `.venv/bin/python -B manage.py check --settings=config.test_settings` passed; `.venv/bin/python -B manage.py test --settings=config.test_settings` ran **72 tests successfully, including 5 PostgreSQL-only skips**; `.venv/bin/python -B manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. The packaged gate test passed a fresh CPU model load on generated silence with network, `torch.export.load`, `torch.load`, `torch.jit.load` and `torch.jit.script` forbidden. This proves the exercised synthetic-silence path, not general speech accuracy or absence of dependency vulnerabilities.
- Fresh mobile checks, from `mobile/` with `EXPO_NO_DOTENV=1`: `npm run check` passed TypeScript, lint and **115/115 tests**; `npm run bundle:android` exported **1,381 modules**. `git diff --check` passed. Existing Node module-format/react-test-renderer/export-color notices and expected backend fault-injection warnings remain. No native APIs/dependencies changed, so no new Expo API usage required verification.
- Coordinator-supplied evidence predating this repair: PostgreSQL processing/migration suite **20 passed**; actual isolated Redis/Celery worker termination before submission, after submission and after raw save yielded stub call counts **1 / 2 with explicit confirmation / 1**, with no automatic uncertain retransmit; Beat recovered queued admission after broker restart. The coordinator also reports a synthetic English hosted pilot (41 words with bounded timestamps, original audio hash), VAD full/short/quiet English and silence checks, and installed Android disclosure Cancel/Continue plus offline force-stop/reopen cache and native playback-state checks. These are attributed reports, not this writer's executions or final-source verification; no credential or pilot media/raw output was inspected.
- Pending: runner stages/reviews the exact repaired scope and repeats required checks; coordinator installs the exact regenerated lock and repeats the audit, packaged gate and Linux/Compose integration, plus affected PostgreSQL/Redis/Celery and Android no-speech/cache/replay checks. Physical-phone/human microphone quality, Korean VAD quality and human review remain pending. This repair leaves changes unstaged; no agents, messages, dependency installs, credentials/private-media reads, live provider calls, commits, pushes or publication were performed by this writer.

### 2026-10-08 — coordinator repair: populated PostgreSQL migration and rehearsal copy (Codex)

- Representative request: fix the confirmed populated-database migration failure and stale rehearsal banner only, preserving reviewed processing behavior and dependency pins. Incorporated material: removed the legacy data updates from schema migration `0003`; added sequential data-only `0004_preserve_existing_attempts`, restricted to revision-zero rows on the migration's database alias. Deferred indexes now finish before the backfill; existing media references, transcript, feedback and errors remain intact, legacy processing becomes awaiting analysis without queuing, and current-generation rows are untouched. `RehearsalScreen.tsx` now explains upload followed by explicit Analyze recording; no native API or behavior changed.
- Coordinator evidence correction: the earlier focused PostgreSQL run of **20 passing tests** was not final verification. Inspected the coordinator's `postgres-final.log` and `postgres-migration-repro.log`: the expanded pre-repair run executed **72 tests and failed with 26 errors**, starting with `cannot CREATE INDEX "rehearsals_attempt" because it has pending trigger events` and followed by aborted-transaction errors. Django's deferred index creation ran after the data updates in the same schema migration. These are coordinator logs, not this writer's PostgreSQL executions.
- Regression coverage in `test_processing_migration.py`: populated storage-base upgrade to the latest migration leaf with completed/failed/pending/processing legacy fixtures, preserved old fields and no queue/provider requests; interrupted schema-only upgrade and data-migration replay preserving all current-generation fields and synthetic private request records; deliberately failed deferred SQL rolled back before schema restoration. Cleanup is registered before downgrade and unwinds a schema-editor transaction left open by deferred SQL failure. All fixtures are synthetic references/data; no private files were opened.
- Fresh local checks from `backend/`, each with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python -B manage.py test rehearsals.test_processing_migration --settings=config.test_settings -v 2` passed **3/3**; `.venv/bin/python -B manage.py check --settings=config.test_settings` passed; `.venv/bin/python -B manage.py test --settings=config.test_settings` passed with **74 tests run, 5 PostgreSQL-only skips**; `.venv/bin/python -B manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. These are SQLite results and do not establish the PostgreSQL upgrade or locking behavior.
- Fresh checks from `mobile/`, with `EXPO_NO_DOTENV=1`: `npm run check` passed TypeScript, lint and **115/115 tests**; `npm run bundle:android` exported **1,381 modules**. `git diff --check` passed. Existing module-format/react-test-renderer/export-color warnings and expected backend fault-injection warnings remain. Both dependency files' SHA-256 hashes match their pre-repair values; all earlier application/review fixes remain unchanged.
- Pending: coordinator reruns the full actual PostgreSQL suite, including populated migration and cleanup regressions, then stages the exact final files for independent review and human inspection. Android visual confirmation of the new banner remains unperformed here; earlier device/worker/provider evidence is unchanged and is not final-source verification. This writer performed no staging, commits, publication, delegation, dependency installs, credential/private-media reads or live provider calls.


### Local agent pipeline 20261008T020210Z-143ece

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/.codex/worktrees/attempt-storage/OnLoud/tmp/agent-pipeline/20261008T020210Z-143ece/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-3/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

## 2026-10-08 — hosted-processing coordinator verification and publication

- Tool/method: Codex coordinated the existing local `tools/agents/pipeline.py` (preflight and 16 runner tests passed), with its configured model unchanged. Run `20261008T020210Z-143ece` used planner → parallel mobile/backend investigators → one writer → checks → independent reviewers and bounded repair passes. Additional confirmed coordinator findings used the same guarded writer entry point, then the normal CLI `verify` command; pipeline source was not modified. No implementation branch or prototype checkout was overwritten.
- Representative requests/material: integrate the existing hosted Whisper adapter and alignment into durable storage, preserve uncertain-request safety and local replay, repair API-address upload/cache cases, retain silence visits/metrics, update Torch pins, and fix a reproduced PostgreSQL migration ordering failure. Prototype `33907d3` supplied only speech-presence policy and metrics; local Whisper inference/downloads were excluded. The root coordinator prepared temporary test harnesses and this documentation; application code came through the pipeline's sequential writers.
- Final independent review: round 3 passed with no findings. Reviewed patch SHA-256 `46c19e3d81c73701ba1c616f28ddaa342732aefc4d0950479b407cce134d7919`. Publication worktree was staged from that exact patch and its hash matched before these documentation-only finalization edits. All application/test/config blobs remain identical to the reviewed/tested snapshot; final prose received accuracy/link/diff inspection.
- Automated checks: `npm run check` passed TypeScript, lint and **115/115** tests; `npm run bundle:android` passed. Django `check`, `test`, and `makemigrations --check --dry-run` with `config.test_settings` passed: **74 tests run, five PostgreSQL-only skips**, no migration drift. The exact reviewed code then passed **all 74 tests on real PostgreSQL**, including processing/upload races, populated upgrades, interrupted upgrades and migration cleanup. Initial populated migration failure was repaired by schema-only 0003 followed by data-only 0004; the final suite was not waived or narrowed.
- Infrastructure: isolated PostgreSQL on 55432, Redis on 56379/database 2, host API/Celery and actual Beat recovery; original prototype services were untouched. Temporary fault-injection workers used a mocked provider and real broker/database, were killed before submission, after submission and after raw-save, then restarted with claim timestamps advanced past 360 seconds. Final stub-call totals were **1, 2 only after explicit acknowledgement, and 1** respectively. Duplicate completed jobs made no new request. Redis stopped during queue admission retained the PostgreSQL intent; restarting Redis and Beat's 30-second recovery completed the missed silent job. These were solo-worker/manual-kill checks, not a measurement of production prefork hard-time-limit enforcement.
- Dependencies/gate: final lock installed locally and in a temporary Linux arm64 `python:3.12-slim` image. Exact lock bytes matched the Linux-tested copy. Actual packaged ONNX gate accepted full, one-second and 8%-amplitude synthetic English speech and rejected silence on both host and Linux. Original audio bytes remained unchanged. No runtime downloads or local Whisper were used. `pip-audit -r requirements.txt` reports two residual Torch 2.10.0 advisories (PYSEC-2026-139, PYSEC-2025-194); six initially introduced Torch 2.8.0 advisories were removed by the upgrade. Source-path assessment is in whisper-transcription.md; this is not an audit-clean claim. Mobile dependencies are unchanged from storage, so its documented baseline advisories remain.
- Controlled live provider check: user-configured backend credential loaded privately into only the isolated live worker. One hosted `whisper-1` call processed a locally generated non-confidential **16.168-second English TTS** rehearsal through PDF/audio upload → explicit process API → VAD → worker → saved transcript/alignment. All **41 words** matched the spoken script ignoring punctuation/case, with bounded integer timestamps. Synthetic visits **3 → 4 → 3** received **15/12/14 words**, using word-start assignment. Original audio SHA-256 was unchanged. API/worker restart, completed resubmission and duplicate job preserved the result and single provider-request record. No second live transcription was used for repairs; final worker checks ran without credentials. This establishes synthetic integration, not human-speech/perceptual accuracy.
- Android emulator: existing native development client reused because package/native configuration blobs are unchanged; final JS export was tested separately. A saved synthetic rehearsal uploaded to the isolated API; disclosure Cancel retained awaiting_analysis/revision zero, Continue explicitly queued processing, and silence completed with no provider request. App force-stop/reopen with API offline retained cached result and local play/pause state. After the final no-speech repair, a fresh native **8,323 ms** rehearsal imported from the existing real test PDF uploaded/analyzed with persisted consent and returned a matching empty-word slide visit and timing metrics. The controlled live speech/alignment pilot above was verified through API/worker; it was not a physical-phone microphone recording or fully synchronized mobile review.
- Remaining boundaries: physical-phone audible quality/hardware interruptions, human speech and Korean VAD evaluation, native API-switch/background/rapid-tap stress checks, and human code review remain pending. Automated tests cover API-switch/offline cache and lifecycle cases. No feedback adapters or synchronized review UI were added. No credentials, recordings, generated native projects, dependencies, test harnesses or pipeline logs are committed.
- Publication is authorized as one `feature/whisper-api-processing` PR based on still-open `feature/recording-storage-upload` (storage PR #18). No merge is authorized. Next proposed implementation is `feature/rehearsal-review`; stop for user confirmation before starting it.

## 2026-10-08 — rehearsal-review implementation and native status repair

- Tool/request: local Codex implementation writer, configured model unchanged. Continue the approved rehearsal-review patch from Whisper PR #19 (`c7733d8288833b010948d2c5737929088547aa1e`), finish docs/tests and investigate coordinator-reported first-download/background playback status. This later authorization supersedes the preceding stage's stop instruction. No named owner approval is inferred.
- Incorporated material: validated mobile deck/history/review models, API-scoped additive SQLite records, independent bounded audio/PDF recovery and native validators, Library history and saved-attempt synchronization/transport. Existing Analyze/disclosure/Refresh/revision retry/uncertain-charge safety and upload/recovery foundations are retained. Prototype `33907d3` was inspected read-only; native PDF rendering, chronological visit lookup and verbatim transcript span/highlight/seek concepts were adapted from `PlaybackSlide.tsx`, `PlaybackTranscript.tsx` and `playback.ts`. `ResultsScreen.tsx` and `transcriptLayout.ts` informed comparison; their theme, tabs, feedback, local transcription and follow-scroll behavior were not copied. No backend/provider/schema/dependency changes.
- Native diagnosis/repair: installed `expo-audio` 57.0.5 creates a new player for a source change; its status hook uses Expo's `useEvent`, whose state is initialized only once. A synthetic event fixture reproduced disabled Play after a null→downloaded-URI change before repair. `useReviewPlayerStatus.ts` now binds snapshot/subscription to native player identity, rejects detached callbacks and refreshes across lifecycle changes. `useReviewMedia.ts` preserves an unchanged validated source during revalidation. Playback intent resets on blur/background, and foreground reasserts pause because Android's native host may resume before the JS callback. Regression tests cover first-download readiness, missed pause events, retained native position, focus return and host auto-resume. Strict result validation moved unchanged into `resultValidation.ts` to remove the confirmed client/review-validation import cycle; a local source import-graph check found no remaining transcription cycles.
- API references: fetched matching [Expo 57 audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) and [FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/) docs; checked installed hook, `AudioPlayer.currentStatus`/event types and Android lifecycle implementation. No dependency installation or native configuration edit.
- Fresh writer checks from `mobile/`: `EXPO_NO_DOTENV=1 npm run check` passed TypeScript, lint and **156/156 tests**; `EXPO_NO_DOTENV=1 npm run bundle:android` passed. `git diff --check` passed. New tests use synthetic files/responses/native events; no device or provider execution is implied. Existing Node module-format, react-test-renderer deprecation and export color notices remain. Initial regression failure and lint failures were repaired before these final passing checks; no checks were disabled.
- Coordinator-supplied preliminary evidence, before this status repair: server-only saved-pilot audio/PDF recovery worked after reopening; offline force-stop/reopen retained media; paused 5→10-second seek rendered actual PDF page 4. Coordinator reported unchanged API/pilot metadata and one existing provider request. The writer did not inspect pilot media or run those native checks. First-download Play readiness and Play→HOME→return require stable final-code reruns; hot reload was not accepted as an established cause.
- Pending handoff: runner stages the exact patch, runs mandatory checks and requests independent review; coordinator verifies real PostgreSQL/API/media/server restart and Android flows using the saved pilot with **zero additional provider requests**. Physical-phone/audible quality, teammate/human review and final native confirmation remain pending. This writer left all changes unstaged and made no commits, pushes, merges, external publication, delegation, credential/private-media reads or live provider calls.


### Local agent pipeline 20261008T035437Z-aea489

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 2.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### 2026-10-08 — rehearsal review coordinator verification

- Base: PR #19 head `c7733d8288833b010948d2c5737929088547aa1e`; publication targets `feature/rehearsal-review`, stacked on `feature/whisper-api-processing`. Neither PR is authorized for merge.
- Local runner preflight and 16 runner tests passed using configured Codex model without override. Planner and parallel investigators completed; initial writer reached its 1,200-second timeout with work preserved. One bounded sequential continuation finished the implementation and native-status repair. Independent staged review is pending at this entry.
- Coordinator baseline Django system check, 74 tests (five PostgreSQL skips on SQLite), migration-drift check and all 74 tests against isolated real PostgreSQL passed. Backend source and dependencies are unchanged by this stage. Mobile writer checks passed with 156 tests plus Android export; final pipeline checks/review supersede these provisional counts.
- Isolated API restart preserved the saved synthetic pilot's original audio/PDF hashes, history, revision 1 and one existing ProviderRequest. No new provider call or credential was needed; review API ran without a key or worker. Existing prototype services were left unchanged.
- Agent-operated Android emulator checks used the saved 16.168-second synthetic hosted Whisper pilot: server-only attempt-ID review; real PDF and transcript rendering; audio download; actual 3 → 4 → 3 visits; previous-visit seek to 6 seconds; paused +5-second seeks from 5 to 10 seconds; word-tap seek on “return” at 12.9 seconds selecting visit 3; missing-PDF download; API-offline force-stop/reopen with recovered audio/PDF, cached transcript and stale-metadata notice.
- Native smoke exposed disabled Play immediately after audio download and stale Pause after foreground return. The writer reproduced the first-download case in an event-lifetime test and fixed status ownership per native player. Stable-build retests confirmed immediate Play readiness after a fresh download and Play → HOME → return remaining paused. Temporary holds affected only synthetic test media and were restored; original capture records were not manufactured for server-only attempts.
- Limits: physical-phone behavior, perceptual/audible synchronization quality, native API-address switching and exhaustive rapid-action/download-cancellation stress remain pending; automated tests cover lifecycle, identity and cancellation cases. Preliminary native results are tied to the pre-review patch; affected flows must be repeated if review changes behavior. Human review remains pending. Full feedback, themes and navigation redesign are excluded.


### Local agent pipeline 20261008T035437Z-aea489

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-1/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — rehearsal-review round-1 findings repair

- Tool/request: sole local Codex implementation writer, configured model unchanged; fix the three reproduced round-1 review findings while preserving the approved rehearsal-review scope and existing staged work. No named owner approval is inferred.
- Incorporated changes: `SavedAttemptScreen.tsx` and `useReviewPlayerStatus.ts` distinguish initial native loading from later buffering so newer word/visit/transport seeks reach the existing controller. Initial-load readiness is scoped to the current player and clears on error. Recovery compares canonical original audio URIs and saves the normalized URI for the existing upload path; downloaded review media cannot become a capture. `reviewMedia.ts` tracks each consumer's validator and cancellation signal, transferring native validation of the same temporary file when its owner leaves, without another GET or premature cache publication. README, contract and handoff reflect these repairs; previous prototype attribution and coordinator evidence are retained.
- Regression evidence: new synthetic screen tests reproduced all three findings before production edits (3 failures), then passed with the fixes. Expanded tests exercise initial loading/replacement/error, buffered word/visit/transport seeks, Pause while seeking, background/navigation/API cancellation, two real validator-hook consumers with first-consumer unmount, late callback rejection, shared validation before/during cancellation, replacement-validation failure preserving good media, canonical recovery followed by same-UUID upload, and rejection of downloaded audio as an interrupted original. Fixtures use in-memory files, mocked network/native events and no provider calls.
- Native reference: fetched matching [Expo 57 audio documentation](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) and inspected installed `expo-audio` 57.0.5 Android `AudioPlayer.currentStatus`: `isLoaded` is false in `STATE_BUFFERING`. No new native APIs, dependencies or configuration were introduced.
- Fresh writer checks from `mobile/`: `EXPO_NO_DOTENV=1 node --test tests/review-screen.test.mjs tests/review-media.test.mjs tests/saved-attempt.test.mjs tests/playback.test.mjs` passed **73/73**; `EXPO_NO_DOTENV=1 npm run check` passed TypeScript, lint and **167/167** tests; `EXPO_NO_DOTENV=1 npm run bundle:android` exported **1,393 modules** successfully. `git diff --check` passed. Existing Node module-format, react-test-renderer deprecation and export color notices remain; checks were not bypassed.
- Pending: runner stages the repair, repeats mandatory checks and obtains independent review of the final scope. Coordinator should repeat affected Android buffering/rapid-seek/Pause, lifecycle/API-switch, concurrent PDF download cancellation and canonical original-audio recovery/upload flows using the saved pilot or synthetic fixtures, with **zero additional provider requests**. Earlier coordinator backend/PostgreSQL/restart/emulator evidence above was not rerun by this writer. Physical-phone/audible synchronization and human inspection remain pending. Changes remain unstaged; this writer performed no staging, commits, publication, delegation, dependency installation, credential/private-media reads or live provider calls.


### Local agent pipeline 20261008T035437Z-aea489

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-2/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### Local agent pipeline 20261008T035437Z-aea489

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-3/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — rehearsal-review round-3 findings repair

- Tool/request: sole local Codex writer, configured model unchanged; fix only the three round-3 reviewer findings and add regressions, preserving the existing staged patch. Incorporated changes are limited to `reviewStorage.ts` (analysis-only upgrade fallback), `useAttemptAnalysis.ts` (reconciled refresh and retained validated state on cache-write failure), `SavedAttemptScreen.tsx`/`playback.ts` (native pause intent outside seek/buffering/EOF transitions), two review test files and these scope/evidence docs. Earlier prototype attribution remains unchanged.
- Regression proof: synthetic fixtures reproduced **nine failures before production edits**, then passed. Twelve added tests cover offline upgrade without `review:v1` or writes; API/attempt isolation; incomplete/legacy refreshes with successful/failed persistence; retention of a validated result held only in memory; delayed refresh rejection after background/navigation/API changes; native pause followed by paused word/visit seeks; buffering, controller-owned seek pauses and stale pause notifications. Existing rapid-seek/EOF/Pause, disclosure/retry/upload and no-review-process-POST tests still pass. SQLite, network and native boundaries are fixtures; no provider or private media was used.
- Native reference: fetched matching [Expo 57 audio documentation](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) and checked installed `expo-audio` 57.0.5 `AudioPlayer.currentStatus`/EOF status emission. The fix uses existing `playing`, `isLoaded`, `isBuffering`, `didJustFinish` and fresh native snapshot fields; no dependencies, native configuration or backend changes.
- Fresh working-tree checks from `mobile/`: `EXPO_NO_DOTENV=1 node --test tests/review-screen.test.mjs tests/review-history.test.mjs tests/saved-attempt.test.mjs tests/playback.test.mjs` passed **86/86**; `EXPO_NO_DOTENV=1 npm run check` passed TypeScript, lint and **191/191** tests; `EXPO_NO_DOTENV=1 npm run bundle:android` exported **1,393 modules** successfully. `git diff --check` passed and the staged patch SHA-256 stayed unchanged. Existing Node module-format, react-test-renderer deprecation and export color notices remain. `EXPO_NO_DOTENV=1` prevents local env-file loading; checks were not bypassed.
- Pending: runner restages these unstaged repairs, checks the final staged snapshot and obtains independent review; human inspection remains pending. Coordinator repeats affected Android audio-focus interruption/seek/Pause/EOF, offline upgrade/reopening, media recovery, lifecycle and API-switch flows using the saved pilot with **zero additional provider requests**. This writer ran no Android/device, backend, PostgreSQL/API/media/server-restart or live-provider checks. No named approval, staging, commit, publication, delegation, dependency installation or credential/private-media reads are claimed.


### Local agent pipeline 20261008T035437Z-aea489

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-4/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — rehearsal-review round-4 findings repair

- Tool/request: sole local Codex writer, configured model unchanged; fix only the two reproduced round-4 findings while preserving the existing 191-test patch. `useAttemptAnalysis.ts` now reconciles cached and current in-memory revisions before publishing UI state or writing either cache, retaining the reconciled result on SQLite failure. `reviewValidation.ts` falls back to verbatim untimed text for malformed token lists, preventing repeated words from inheriting another occurrence's timing. No new native APIs, dependencies, contracts or provider behavior were added; previous prototype attribution remains unchanged.
- Regression proof: five synthetic regressions in `review-screen.test.mjs` and `review-history.test.mjs` failed before production edits and passed afterward. They cover a stale valid awaiting-analysis response against cached completion or newer in-memory completion, failures at either cache write, preservation of transcript/metrics and processing controls, reconciled cache payloads, GET-only review, and `Echo Echo` with an invalid first timestamp. SQLite/network/native boundaries remain fixtures.
- Fresh working-tree checks from `mobile/`: `EXPO_NO_DOTENV=1 node --test --test-name-pattern='stale awaiting response|malformed first timestamp' tests/review-screen.test.mjs tests/review-history.test.mjs` passed **5/5**; `EXPO_NO_DOTENV=1 npm run check` passed TypeScript, lint and **196/196** tests; `EXPO_NO_DOTENV=1 npm run bundle:android` successfully exported **1,393 modules**. `git diff --check` passed. Existing module-format, react-test-renderer deprecation and export color notices remain; no checks were bypassed.
- Pending: runner stages the repairs and independently reviews the final snapshot; human inspection remains pending. Coordinator repeats affected Android playback/interruption/recovery/offline/API-switch flows using saved fixtures with **zero additional provider requests**. This writer ran no device, backend, PostgreSQL/API/server-restart or provider checks and performed no staging, commits, publication, delegation, dependency installation or credential/private-media reads. Repairs remain unstaged and the prior staged patch is preserved.


### Local agent pipeline 20261008T035437Z-aea489

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-5/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — rehearsal-review round-5 findings repair

- Tool/request: sole local Codex writer, configured model unchanged; repair only the three round-5 findings. Incorporated changes: `useReviewPlayerStatus.ts` reads fresh native position/playback/buffering state for queued same-player events while retaining event-only error/EOF signals; `useReviewPdf.ts`/`useReviewMedia.ts` collect API-matched local PDF candidates and check distinct canonical files sequentially with native validation before display; `playback.ts` rejects substring and omitted-word mappings while preserving exact English/Korean text, punctuation and whitespace. Existing prototype attribution remains unchanged; no dependencies, contracts, backend or provider behavior changed.
- Regression proof: 13 added synthetic tests in `playback.test.mjs` and `review-screen.test.mjs`, including 12 failing-before/passing-after regressions. They cover delayed EOF display/PDF/highlight/relative-seek targets, fresh buffering plus event-only errors/EOF, missing/corrupt originals followed by invalid-page and usable same-deck copies, API isolation, retained originals, and substring/omitted-token plain-text fallback. Existing lifecycle, rapid-seek/Pause, disclosure/retry/upload and GET-only review tests remain passing. Native/network/storage boundaries are mocks; no private media or provider calls were used.
- Native reference: read matching [Expo 57 audio documentation](https://docs.expo.dev/versions/v57.0.0/sdk/audio/) and installed `expo-audio` 57.0.5 types/Android implementation. Its `currentStatus()` reports fresh buffering/position but returns null error and false EOF; event-only signals must be retained. No new native API was introduced.
- Fresh working-tree checks from `mobile/`: `EXPO_NO_DOTENV=1 node --test tests/playback.test.mjs tests/review-screen.test.mjs` passed **74/74**; `EXPO_NO_DOTENV=1 npm run check` passed TypeScript, lint and **209/209** tests; `EXPO_NO_DOTENV=1 npm run bundle:android` exported **1,393 modules** successfully. `git diff --check` passed. Existing module-format, react-test-renderer and export color notices remain; no checks were bypassed and local env files were not loaded.
- Pending: runner stages the unstaged repairs, reruns checks against that snapshot and obtains independent review; human inspection remains pending. Coordinator verifies affected Android delayed-EOF/seek/Pause, PDF fallback, lifecycle/offline and API-switch flows using saved fixtures with **zero additional provider requests**. This writer ran no device, backend, PostgreSQL/API/media/server-restart or provider checks; no staging, commits, publication, delegation or dependency installation occurred.


### Local agent pipeline 20261008T035437Z-aea489

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-6/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### 2026-10-08 — rehearsal review final verification and publication

- Final pipeline state: `ready_for_inspection`, round-6 independent reviewer `pass`, no findings. The final focused review verified the last repairs and reused prior independent review for unchanged content. Earlier pending/finding records above are historical and superseded by this entry; human review is still pending.
- Reviewed patch SHA-256: `8a68f5f5b3f66fbe05d35be411bcae0ba241ae75e605be722e3efc95f827835e`. Applying that frozen patch with `git apply --index` on `feature/rehearsal-review` reproduced the exact hash. Only this coordinator evidence and README/handoff accuracy updates follow; application/test/config content must remain byte-identical before commit.
- Final runner commands: `npm run check` passed TypeScript, lint and **209 tests**; `npm run bundle:android` passed; staged whitespace check passed. Real PostgreSQL **74/74 tests**, Django system/migration-drift checks and SQLite **74 tests with five PostgreSQL-specific skips** were independently run earlier this stage. Backend source/dependencies did not change afterward.
- Review repairs include native source/status lifetime, buffering and EOF/seek ordering, native pause intent, stale PDF callbacks, shared validation ownership, canonical capture recovery, metadata retry, old-cache upgrade, revision-aware in-memory/cache reconciliation and safe verbatim token mapping. Regressions reproduced confirmed failures before fixes. No dependency changes or new advisories were introduced by this patch; inherited dependency limitations remain documented in the preceding stage.
- Native evidence: final candidate reopened the saved synthetic pilot and paused seeks at 5 and 10 seconds selected actual PDF pages 3 and 4. Prior affected-flow reruns verified immediate Play after audio download, paused foreground return retaining position, rapid seeks followed by Pause, EOF at 16 seconds/final visit and replay. Word tap on the saved “return” timestamp selected visit 3 near 12.9 seconds. Independent audio/PDF recovery and API-offline process restart were checked; synthetic original files temporarily held for missing-media tests were restored. Test harness/screenshots remain private temporary artifacts, not repository files.
- Final API/media comparison after testing retained original audio/PDF hashes, processing revision 1 and exactly one pre-existing ProviderRequest for the saved pilot. No fresh transcription was requested. The task's isolated API ran without a provider key or worker; unrelated prototype services and original worktrees were preserved.
- Limits: emulator results establish the exercised visual/control/file behavior, not physical-phone or audible/perceptual synchronization quality. Native audio-focus loss, API-address switching, shared-consumer unmount and exhaustive malformed-media/callback stress remain modeled automated tests rather than native proofs. A rapid development-client deep-link launch produced an Expo Router `useLinking.native` pre-mount warning; settled review/seek behavior continued. No dependency change was made for that launcher warning.
- Authorized publication: one `feature/rehearsal-review` PR stacked on open PR #19 at `c7733d8`, without merging. User requested implementation/publication; no human code approval is inferred. Stop after publication before implementing `feature/ai-feedback`.

### 2026-10-08 — AI feedback checkpoint 1 standalone adapters

- Tool/request: sole local Codex implementation writer on rehearsal-review base `130591744c976a1e7225b9c1b76172bb746ac3c4`; implement only checkpoint 1 of the approved five-part feedback plan, with synthetic tests and no app integration. Incorporated material: strict immutable input/output contracts, complete slide descriptions with per-fact uncertainty, transcript-index/visit/segment evidence validation, separate prepare/raw/normalize APIs, fixed Gemini REST and OpenAI Responses adapters, and the checkpoint/internal-contract documentation. Changes are in `backend/rehearsals/services/feedback.py`, new `feedback_provider.py`, new `test_feedback.py`/`test_feedback_provider.py`, a processing-isolation regression, direct dependency declarations/lock provenance comments, README/API/env-example docs and this record. No installed lock version changed.
- Attribution: prototype `33907d3` feedback/Gemini/test files were inspected read-only. Reuse is limited to strict-schema, every-slide-once, bounded-field and fixed untrusted-source prompt concepts; indexed exact quotation validation replaces substring matching. Prototype persistence/locks, countTokens and free-tier assumptions were not incorporated. Current transcription and alignment source supplied the preparation/raw boundary and assignment-by-start policy; neither implementation changed. Official provider references are linked in [ai-feedback.md](ai-feedback.md).
- Verification: synthetic PNG/JPEG/text fixtures and HTTPX MockTransport exercise **actual installed OpenAI 2.54.0**, HTTPX 0.28.1 and Pydantic 2.13.5. Thirty-six focused tests plus one processing-isolation test cover matching provider results/serialized schemas, source identity/uncertainty, complete indexed quotations/Korean/punctuation/repeated phrases, repeated/backward/simultaneous visits, crossing/overlapping word ranges, strict bounds/types/envelopes, max-three/dedup/states, missing/no-speech preflight, injection strings remaining data, response/error-body bounds/compression/partial reads, refusal/truncation/invalid JSON, safe errors/reprs/debug logs, Retry-After, zero retries/fallback/redirects and destination/header controls. The first test run caught SDK streaming-marker loss during header sanitization; a separate allowlisted wire request fixed it and the failing tests passed afterward. No live compatibility or model prompt immunity is claimed.
- Actual working-tree checks from `backend/`, with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings` passed **111 tests with five PostgreSQL-specific skips**; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` passed with **no changes detected**. The focused 37-test run also passed. `git diff --check` passed. Existing synthetic failure-path notices appeared during the full suite. Dependencies were already present in the runner workspace; this writer installed none. No credentials/private media were read and no provider calls occurred.
- Boundary/review: processing/views/tasks/models/migrations/mobile and public `feedback=[]`, `feedback_state=disabled` behavior remain unchanged. Input/output limits and disabled retries do not implement durable deduplication, a spending cap or crash recovery. Existing dependency advisory assessment is unchanged; no new audit is claimed. This writer performed self-review only and did not spawn agents, stage, commit, push, merge or publish. The coordinator must stage all intended/new files, run its mandatory gates and obtain independent review of the final staged diff. Human inspection and explicit user confirmation remain pending **before checkpoint 2**; all five checkpoints still target one eventual PR. PostgreSQL/Redis/worker/device/live-provider integration and human visual/language/coaching evaluation were not run here and remain later-checkpoint work. No named owner's approval is inferred.


### Local agent pipeline 20261008T060009Z-87048f

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — AI feedback checkpoint 1 environment-header repair

- Tool/request: sole local Codex writer; fix the confirmed round-0 SDK environment-header finding only. Incorporated changes in `feedback_provider.py` clear this adapter's private OpenAI client's custom headers before request construction, without mutating the process environment or other clients. Caught preparation errors before outbound transport entry now return safe `invalid_request`/`uncertain=false`; errors after entry retain conservative uncertainty. The final destination/header guard remains. `ai-feedback.md` documents the pinned SDK private-attribute dependency and the in-memory boundary, which is not durable submission evidence.
- Regression evidence in `test_feedback_provider.py`: the actual installed OpenAI 2.54.0 SDK and HTTPX MockTransport reproduced multipart and non-ASCII header failures before the fix. Two added regression methods failed before and passed after the repair; a third checks that an error after transport entry remains uncertain for either provider. Cases cover both description/coaching stages, JSON payload preservation, one request, unchanged environment, and safe exceptions/reprs/debug logs. All data/keys are synthetic; no provider calls occurred.
- Fresh working-tree checks from `backend/`, prefixed with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings` passed **114 tests with five PostgreSQL-specific skips**; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported **no changes detected**. The intermediate provider-only run passed 20 tests before the third test was added; the final full suite includes all three additions. `git diff --check` and `git diff --cached --check` passed. Existing synthetic failure-path notices remain; no dependencies were installed.
- Review/boundary: this repair has writer self-review only and remains unstaged; the runner must stage and independently review the final patch, including new files. Human inspection and explicit confirmation are pending before checkpoint 2. Public feedback remains disabled; no processing/mobile/provider integration was added. No agents, commits, pushes or publication were performed. PostgreSQL/worker/device/live-provider checks and human description/coaching evaluation remain pending.


### Local agent pipeline 20261008T060009Z-87048f

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-1/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — AI feedback checkpoint 1 image-metadata logging repair

- Tool/request: sole local Codex writer; repair the confirmed round-1 Pillow metadata logging defect only. `services/feedback.py` now filters the pinned Pillow producer loggers within image preparation using a context variable, including open/verify/load/close and exceptional exits. PNG/JPEG-only probing bounds the decoder paths. Other threads and unrelated application logging retain their configuration. `ai-feedback.md` records the scope and upgrade-validation boundary; public feedback stays disabled.
- Incorporated regression evidence in `test_feedback.py`: generated synthetic PNG profile names leaked on both valid preparation and missing-IEND rejection before the fix. Two regression methods failed before and pass after the repair. They cover accepted bytes/MIME, safe rejection/repr, filtering during decode, logging after success/failure, and unrelated application/concurrent Pillow logs. No private media, credentials, dependency installs or live provider calls were used.
- Fresh checks from `backend/`, all prefixed with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py test rehearsals.test_feedback --settings=config.test_settings` passed 20 tests; `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings` passed **116 tests with five PostgreSQL-specific skips**; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported **no changes detected**. The final full suite includes an additional decode-log assertion added after the focused run. Existing synthetic failure-path notices appeared. `git diff --check` and `git diff --cached --check` passed; the latter checks the runner's prior snapshot, not this unstaged repair.
- Review/boundary: writer self-review only; runner staging and independent review of the final patch, including new files, remain pending. No agents, staging, commits, pushes or publication were performed by this writer. Human inspection and explicit user confirmation are still required before checkpoint 2. PostgreSQL/Redis/worker/device/live-provider integration and human description/coaching evaluation remain pending.


### Local agent pipeline 20261008T060009Z-87048f

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T060009Z-87048f/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-2/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### 2026-10-08 — AI feedback checkpoint 1 coordinator handoff

- Scope: checkpoint 1 of the approved five-part plan, on `feature/ai-feedback` from open rehearsal-review PR #20 at `1305917`. One eventual PR will cover all five checkpoints; none is published at this checkpoint. User inspection and confirmation gate checkpoint 2.
- Local pipeline preflight passed using configured Codex CLI 0.159.2 without a model override; 16 runner tests passed. Run `20261008T060009Z-87048f` used planner, parallel mobile/backend investigators, one implementation writer, mandatory checks, independent staged review and two bounded repair/review passes.
- Final pipeline status is `ready_for_inspection`; round-2 independent reviewer returned `pass` with no findings. Reviewed patch SHA-256 `391d2846ab388df051022c802b1451a30f3c0d7e8901d995cc9475aea61c9538` was transferred with `git apply --index`; its hash and all 12 changed files matched exactly. Only coordinator documentation updates followed; application/test/config bytes remain identical to the reviewed snapshot.
- Confirmed review repairs: SDK environment headers could affect serialization before final transport sanitization and mislabel a local error as uncertain; client-local header neutralization plus outbound-boundary classification fixes this. Pillow PNG metadata could leak through debug logs during image validation; scoped producer-logger filtering and PNG/JPEG-only decoding fix this. Regression tests reproduced both reported failures before their repairs and cover isolation from unrelated requests/logging.
- Final pipeline checks passed; the coordinator then repeated `python manage.py check`, `python manage.py test`, and `python manage.py makemigrations --check --dry-run` from the transferred feature worktree with `--settings=config.test_settings` and the isolated pinned environment. System check passed, **116 tests passed with five PostgreSQL-specific skips**, and no migration drift was detected. Staged whitespace check passed. No database schema, worker, public API or mobile behavior changes; no corresponding integration/device pass is claimed. Current application processing remains feedback-disabled even under enabled/missing/malformed standalone adapter configuration.
- Coordinator checked all 61 existing package versions against public PyPI advisory metadata; all pins remain unchanged. OpenAI/HTTPX/Pydantic provenance matches official repositories and no advisories were listed for their pins. The two inherited Torch advisories remain; see `docs/ai-feedback.md`. No credentials, private recordings or real-provider calls were used.
- Human inspection, live provider compatibility, visual/language/coaching usefulness and later checkpoint PostgreSQL/Redis/Celery/Android integration remain pending. Mocked injection tests prove fixed local request boundaries, not model immunity or semantic correctness. No commit, push, merge or human approval is claimed.

### 2026-10-08 — AI feedback checkpoint 2: durable slide descriptions

- Tool/request: sole local Codex implementation writer, using the configured model without override. Representative request: implement only checkpoint 2 of the five-checkpoint, one-eventual-PR plan—durable saved-deck descriptions, scoped cache, revision-checked editing, durable queue/request evidence and provider-specific application quotas. The user authorized continuation from reviewed/tested local checkpoint-1 base `f07e55395d2e38eabec7c39ea766f643b2e5c7c1`; this is not human code-review approval or a named owner's approval.
- Incorporated material: immutable deck-only preparation and shared description source identity; nonsecret selection separated from backend credential resolution; five additive tables/migration 0005; dedicated description API/service, quota reservations and existing Beat/task integration; complete bounded edits with independent description/processing revisions and late-receipt fencing. Separate request records retain bounded receipt/usage evidence, distinguish local/known/uncertain outcomes and recover saved responses without another call. Required positive RPM/TPM settings have no tier defaults; the byte-plus-output reservation and optional daily windows are application policy, not exact provider accounting or a money cap. README, API contract, env example, handoff and checkpoint ledger describe actual scope and limits.
- Attribution: inspected prototype `33907d3` read-only (`services/feedback.py`, `services/gemini.py`, `models.py`, `test_feedback.py`). Adapted deck-cache/revision, private usage-evidence and Pacific reset ideas. Did not import its countTokens calls, free-tier assumptions, automatic attempt orchestration or edited-data reuse across provider/source scopes. Existing checkpoint-1 adapters supply prepare/request_raw/normalize, fixed prompts/schema, source validation and transport/privacy bounds; existing processing supplies durable-intent/claim concepts, while its Whisper model, uniqueness constraint and service remain unchanged. Official Gemini/OpenAI rate-limit pages were reopened; source links are in `docs/ai-feedback.md`.
- Meaningful synthetic/mocked coverage: initial/cache-hit/GET call counts; strict bounded API/ownership/edit validation; scope isolation and saved configuration retries; source/media/snapshot/configuration failures; uncertainty acknowledgement and replayed revision rejection; reservation/cooldown/rolling and Pacific DST/UTC daily boundaries; key-echo redaction and scoped SQL-debug privacy; commit failure, lost broker publication, duplicate/stale work, expiry before/after submission, saved/late receipt recovery, invalid receipt retry and in-flight edit preservation. A populated migration test compares existing Deck/Slide/Attempt/Whisper rows and media/result references, preserves Whisper uniqueness, and proves no legacy enqueue. Five PostgreSQL transaction tests cover initial dedup/duplicate workers, concurrent retry, RPM/TPM/daily quota races, concurrent edits and edit/generation completion; they explicitly skip on SQLite.
- Writer self-review repairs include keeping late receipt evidence after edit fencing, reclaiming normalization when a receipt arrives after expiry, preventing stale completion from consuming current recovery evidence, and reading set/job state consistently. The new description fixture initially reused the checkpoint-1 helper's hardcoded deck UUID; the dedicated synthetic helper was corrected. SQL debug logs are filtered within description operations; an exact echoed submitted key is removed before receipt persistence and marked `credential_redacted`, never normalized into successful descriptions. No private content or real credentials were used.
- Final working-tree verification from `backend/`, each prefixed with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings` passed **159 tests with 10 PostgreSQL-only skips** (five new description races plus five inherited races); `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported **no changes detected**. The final focused description run passed 42 tests with five PostgreSQL skips; the full suite also includes migration preservation and all checkpoint-1 SDK environment-header/Pillow logging regressions. `git diff --check` passed. An earlier unlabeled discovery command run from the repository root found zero tests and is not counted as validation; the reported full runs used `backend/`. Existing synthetic PDF/storage/processing failure-path notices appeared. The supplied exact-lock environment was used; no dependencies were installed/upgraded and no lockfiles changed.
- Boundary/handoff: no live Whisper/Gemini/OpenAI calls, private media/credential reads, PostgreSQL/Redis/Celery/process-restart checks, device checks or service changes were performed by this writer. Automated mocks are not real integration evidence. No mobile code or existing AttemptResult change; app processing remains `feedback_state=disabled`. Original PDF/audio/transcript/results are not modified. The runner owns staging, mandatory gates and independent review; the coordinator owns real PostgreSQL races and the documented temporary fake-worker recovery recipe. Human inspection remains pending. This writer spawned no agents and performed no staging, commit, checkout/reset, push, PR creation, merge or edits to other worktrees. Stop for inspection and confirmation before checkpoint 3; checkpoints 3–5 remain unimplemented.


### Local agent pipeline 20261008T072824Z-8435ee

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — Checkpoint 2 recovery review repairs

- Tool/request: sole Codex writer using the configured model without override. Representative request: fix the two confirmed checkpoint-2 review findings only, preserving scope and stopping before checkpoint 3. No agents were spawned and no Git mutation, service change, dependency installation or live provider call was performed.
- Incorporated material: separated completion persistence from provider-output error classification, so failed completion writes/commits retain the same recoverable receipt. Superseded jobs can claim saved-receipt normalization only; original request outcomes finalize without overwriting edited descriptions/revisions. Receipt recovery leases fence duplicate/expired workers and late original workers. README, API contract, handoff and checkpoint ledger/validation recipe document these behaviors. No new prototype code/ideas were incorporated; the checkpoint-2 attribution above remains applicable.
- Regression evidence: before repair, both one-shot row-write and transaction-commit failures incorrectly marked a valid receipt `invalid`; after repair each completes with one mocked provider call and the original request/generation/reservation. Before repair, edit → saved receipt → simulated worker termination left valid/invalid/rejected/partial receipts at `received`; after repair each finalizes its classified outcome with one mocked call and unchanged edits. Additional tests cover receipt-only duplicate/expired claims and safe error logging. A sixth PostgreSQL-only description race test covers duplicate receipt recovery; it was skipped on SQLite and awaits coordinator execution.
- Actual checks from `backend/`, all prefixed with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py test rehearsals.test_descriptions --settings=config.test_settings` ran 46 tests successfully with six PostgreSQL skips; `.venv/bin/python manage.py test --settings=config.test_settings` ran 163 tests successfully with 11 PostgreSQL skips (152 executed); `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. `git diff --check` passed. The full suite includes additive migration preservation and checkpoint-1 adapter/privacy regressions; existing synthetic failure-path notices appeared. All tested repairs are in the working tree, not staged by this writer.
- Pending: runner staging and independent re-review, human inspection, full PostgreSQL suite and real PostgreSQL/Redis/Celery/process-restart validation with synthetic media/fake provider, including both repaired failure sequences and exact call counts. Mocks and simulated termination are not real process/integration evidence. No device or live-provider evaluation is claimed. Existing attempts/Whisper/mobile behavior is unchanged; checkpoints 3–5 remain unimplemented and one eventual PR remains the plan.


### Local agent pipeline 20261008T072824Z-8435ee

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-1/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — Checkpoint 2 late terminal-receipt recovery repair

- Tool/request: sole Codex implementation writer, configured model without override. Representative request: repair the confirmed review finding where a late receipt remained unfinished after `needs_confirmation` was superseded by retry or PATCH. Scope remains checkpoint 2; no new prototype material was incorporated, and the existing checkpoint-2 attribution remains applicable.
- Incorporated material: `services/descriptions.py` discovers unfinished saved receipts independently of job state/revision and grants superseded generations receipt-only claims. Finalization fences original/duplicate/expired workers, preserves the old job outcome and newer job/set data, and never submits another request. `test_descriptions.py` adds retry/PATCH termination regressions for valid/invalid/rejected/partial receipts, terminal-claim fencing with a completed newer generation, and a PostgreSQL-only concurrent recovery test covering both supersession paths. README, API contract, handoff and AI-feedback ledger/validation recipe describe the repaired behavior. No schema, quota configuration, adapter, Whisper or mobile changes were needed.
- Reproduction: the two new retry/PATCH regression methods failed before the repair in all eight receipt/path combinations because recovery did not publish the old terminal generation. They pass after repair, asserting one mocked provider call, one normalization, retained raw/usage/reservation evidence, no repeat normalization, disabled/missing-key/media-independent recovery and unchanged newer jobs/descriptions/revisions. The additional terminal-claim test preserves an already completed newer generation and rejects stale finalization; its recovery makes zero provider calls.
- Actual checks from `backend/`, each prefixed with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py test rehearsals.test_descriptions --settings=config.test_settings` ran **50 tests successfully, seven PostgreSQL-only skips**; `.venv/bin/python manage.py test --settings=config.test_settings` ran **167 tests successfully, 12 PostgreSQL-only skips (155 executed)**; `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. `git diff --check` passed. Existing synthetic failure-path notices appeared; the full suite includes migration preservation and checkpoint-1 adapter/privacy regressions. The supplied environment was used without installing/upgrading dependencies.
- Pending: runner staging and independent re-review of these working-tree repairs, human inspection, full PostgreSQL suite and real PostgreSQL/Redis/Celery/process-restart checks with synthetic media/fake provider. The new PostgreSQL race is explicitly unexecuted here; simulated termination/mocks are not real process/integration evidence. No live provider/device check, private media/credential read, agent delegation, Git mutation, service change or other-worktree edit was performed. Checkpoints 3–5 remain unimplemented; stop for confirmation before checkpoint 3 and retain the one-eventual-PR plan.


### Local agent pipeline 20261008T072824Z-8435ee

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-2/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — Checkpoint 2 receipt acknowledgement and NUL fact repairs

- Tool/request: sole Codex writer, configured model without override. Representative request: repair only the confirmed receipt-save acknowledgement-loss finding and PostgreSQL NUL-fact persistence defect, then return for independent review. Read the round-2 finding and coordinator's synthetic reproduction/test proposal without executing their database script or accessing the isolated database. Adapted the proposed generated/edit regressions; no new prototype material was incorporated, and existing attribution remains applicable.
- Incorporated material: `services/descriptions.py` leaves failed receipt persistence unresolved for lease recovery instead of misclassifying it as invalid output. Recovery uses the same durable sanitized receipt, or requires uncertainty confirmation if the save rolled back; unpersisted output is never normalized. `services/feedback.py` rejects U+0000 in fact text and uncertainty through the existing shared validator, preserving other Unicode and evidence checks. `test_descriptions.py` adds five regression methods. AI-feedback behavior/validation notes and the API contract describe the boundaries; no schema, configuration, dependency, Whisper, mobile or coaching changes were made.
- Red/green evidence: all five new regression methods failed before implementation. The receipt cases reproduced premature terminal outcomes after actual `save_receipt` commits followed by a one-shot `DatabaseError`, as well as rollback with no saved receipt. Generated NUL facts incorrectly completed on SQLite; all six fact-location/field PATCH cases returned 200 after refreshing the fixture revision between cases. After repair, the five methods passed. They cover valid/invalid/rejected/partial/key-redacted receipts, exact provider-call counts, no normalization before confirmed persistence, retained reservations, edited/completed newer results, both providers and all three fact locations, explicit-only retry, and unchanged Unicode edits/revisions. Existing completion-write and older terminal/superseded recovery tests remain intact.
- Actual checks from `backend/`, each prefixed with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py test rehearsals.test_descriptions --settings=config.test_settings` passed **55 tests with seven PostgreSQL-only skips**; `.venv/bin/python manage.py test --settings=config.test_settings` passed **172 tests with 12 PostgreSQL-only skips (160 executed)**; `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. `git diff --check` passed. The supplied exact-lock environment was used without installation/upgrades. The suite includes migration preservation and checkpoint-1 SDK-header/image-debug privacy regressions; expected synthetic failure-path warnings appeared.
- Handoff: all repair edits remain unstaged over the runner's staged checkpoint-2 snapshot. Runner staging/independent re-review, coordinator real PostgreSQL/Redis/Celery restart checks (including acknowledgement loss, rolled-back receipt, and saved NUL receipt normalization), and human inspection remain pending. SQLite/mocks do not establish real integration. No agents, Git mutations, external publication, live providers, credential/private-media reads, service changes, other-worktree edits or device checks were performed. Checkpoints 3–5 remain unimplemented; stop for user confirmation before checkpoint 3 and retain the one-eventual-PR plan.


### Local agent pipeline 20261008T072824Z-8435ee

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T072824Z-8435ee/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-3/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### 2026-10-08 — AI feedback checkpoint 2 coordinator handoff

- Scope/authorization: user **Continue** authorized checkpoint 2 only, after checkpoint 1. The previously inspected checkpoint-1 snapshot was committed locally as `f07e55395d2e38eabec7c39ea766f643b2e5c7c1`; it was not pushed. PR #20 was rechecked open/unmerged at `1305917`. One eventual `feature/ai-feedback` PR remains the publication plan; checkpoints 3–5 require their later gates.
- Method: local pipeline preflight and **16 runner tests** passed. Run `20261008T072824Z-8435ee` used the configured Codex model without override: planner, parallel mobile/backend investigators, one writer, mandatory checks, independent review and inspection. Original prototype, pipeline worktree changes and unrelated local documents were preserved.
- Reviewed transfer: pipeline status `ready_for_inspection`, final independent reviewer `pass`. Exact staged patch SHA-256 `298478d4b16b9fbbd3cac05287005d3061b13e29d9ddf414a91cd1eacf95d8a8` and all 18 changed files matched during `git apply --index` transfer from the isolated pipeline workspace. Coordinator-only documentation records the additional evidence; application/test/config bytes remain identical to the reviewed and tested snapshot. Human review is not claimed.
- Independent-review repairs: a completion write/commit failure previously classified a valid saved receipt as invalid and allowed a paid retry; finalization persistence now remains recoverable within the same generation. A superseded edited job with a saved receipt previously left request evidence unfinished after worker death; receipt-only recovery now finalizes that old request under a fenced claim without changing edits or submitting again. These sequences and late receipts after uncertain retry/PATCH have regression tests and real-worker call-count checks. A further independent review found receipt-commit acknowledgement loss being misclassified as invalid output; a bounded repair through the unchanged runner now preserves recovery of the committed receipt, or uncertainty if it rolled back. The coordinator also reproduced PostgreSQL rejection of U+0000 in otherwise accepted description facts; generated and edited facts now reject it safely before storage while retaining private receipts and existing edits. New regressions reproduced the failures before the repairs; final checks below cover the repaired snapshot.
- Automated gates: Django system check, full suite and migration-drift check with `config.test_settings` passed; **172 tests, 12 PostgreSQL-specific skips** on SQLite. The coordinator then ran the full suite with isolated real PostgreSQL settings: **172 passed, no skips**. This covers request/evidence validation, scope isolation, quota windows/cooldown, edit/retry races, private response/logging handling, duplicate/stale work and additive migration preservation. Dependency manifests/locks and mobile code are unchanged. Existing dependency advisory limitations remain in `docs/ai-feedback.md`; no new package or version was introduced.
- Real infrastructure: isolated PostgreSQL 16 and Redis 7, actual Celery worker and Beat, with synthetic PDF/audio and a temporary fake-provider seam outside tracked code. Actual hosted transport was explicitly forbidden. Kill-before-submit recovered with one fake call; kill-after-submit stayed uncertain with one call until acknowledgement, then exactly two total; kill-after-private-receipt recovered with one call. A receipt arriving after lease expiry completed with one call. An injected one-shot failure at the completion UPDATE recovered the same generation with one call. Edit followed by durable receipt and worker termination finalized request evidence without changing the edit or calling again. Late receipts after uncertainty followed by retry or PATCH finalized only their old request, preserving the newer revision. Receipt-commit acknowledgement loss recovered with one call; a failed receipt write with no saved body required confirmation without another call. Malformed NUL fact output retained its private receipt as a terminal validation failure with one call. Duplicate/completed submissions added no calls. An in-flight edit retained its descriptions while late receipt and usage were preserved. Disabled feedback and changed project produced zero calls. Stopping the isolated broker left durable queued work; restarting it with Beat/worker completed exactly once. Tests aged claim timestamps to exercise the 360-second recovery boundary without waiting six minutes.
- Persistence/HTTP evidence: synthetic pre-migration Deck/Slide/Attempt/Whisper records and all **five media hashes** survived migration. Actual HTTP description/history/attempt/media GETs before and after API + PostgreSQL restart matched; all files remained retrievable. These reads left both feedback and Whisper request counts unchanged. Existing saved transcript and Whisper request uniqueness remain intact. Local scripts/results are under `/private/tmp/onloud-feedback-part2`; pipeline reports are under `tmp/agent-pipeline/20261008T072824Z-8435ee`.
- Real-time quota/key-rotation check: two synthetic decks shared one provider/project/model bucket configured to one request per minute. The second worker job entered `waiting_quota`, then resumed after **60.11 real seconds**, with two calls total and both original generation numbers retained. Worker assertions confirmed use of a rotated synthetic key for the same saved project. No clock or reservation timestamp was altered for this check. The original pre-fix NUL receipt also reached a terminal `invalid_descriptions` outcome with its one existing request retained and zero new calls.
- Coverage distinction: actual worker kill tests used successful receipts; rejected/malformed/partial receipt restart and classification variants were exercised by automated database tests. The worker additionally exercised malformed NUL output without a kill. These are separate from live-provider behavior, which remains untested.
- Boundaries: no real Gemini/OpenAI/Whisper call or private recording/key was used. Mocked outputs establish transport/state-machine behavior, not model accuracy, injection immunity or coaching usefulness. This checkpoint has no mobile change, so no new Android check is claimed. Mobile feedback/disclosure/editing validation belongs to checkpoint 4; controlled provider evaluation belongs to checkpoint 5. Human inspection is pending. Checkpoint 2 is staged, not committed/pushed/published/merged; stop for confirmation before checkpoint 3.
