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

### 2026-10-08 — Checkpoint 3 bounded repair: uncertainty before receipt normalization

- Tool/request: sole Codex implementation writer, configured model without override. Representative request: reproduce and repair the confirmed uncertainty-acknowledgement race between saved coaching receipt and normalization, preserving the existing checkpoint-3 implementation and review repairs. All remaining checkpoints remain authorized with checks between them on one eventual PR; this run adds only this repair, regression tests and documentation. Human review is pending; no named owner approval is inferred.
- Confirmed issue: the coordinator's two `uncertain_probe` tests failed on the supplied snapshot. After saving HTTP 500 or incomplete HTTP 200 and editing descriptions before normalization, public feedback incorrectly exposed `requires_confirmation=false`; POST with revision 1 and no acknowledgement returned 202 and admitted revision 2. The reported round-1 independent-review pass did not resolve this reproduced defect. Existing dependency-freshness and PostgreSQL-compatible NUL-source repairs were preserved.
- Incorporated material: `services/feedback_provider.py` adds one pure transport-uncertainty helper shared by adapter normalization and `services/coaching.py` admission/public state. Pending 408/5xx and incomplete 200 receipts require acknowledgement when stale; complete 200 and known auth/rate/other rejections retain existing handling even with incomplete rejection bodies. This uses only saved status/completeness, without normalizing under locks, rewriting raw/usage or changing recovery. No schema, mobile implementation, source recording/transcript, quota or lifecycle redesign. README, API contract, checkpoint ledger and handoff describe this boundary. No additional prototype code was incorporated; existing attribution is unchanged.
- Red/green proof: before repair, `PYTHONPATH=/private/tmp/onloud-feedback-part3 PYTHON_DOTENV_DISABLED=1 .venv/bin/python manage.py test uncertain_probe --settings=config.test_settings --noinput` failed both probes. The new `rehearsals.test_coaching.PendingCoachingReceiptTests` also reproduced the gap; complete-success/known-rejection controls passed. After repair, running `uncertain_probe rehearsals.test_coaching.PendingCoachingReceiptTests rehearsals.test_feedback_provider` together with the same settings/environment passed **29 tests**. Both probes now expose confirmation and return **409** for the unacknowledged POST. Six permanent tests cover status/completeness combinations, exact revision/ack replay, source-staleness fixture, shared 429 cooldown, retained raw/usage/reservations, unchanged sources/newer edits/jobs and receipt-only old/same-generation recovery with zero outbound calls. The test fixture prohibits live transport and asserts no Whisper calls.
- Full backend checks from `backend/`, with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings --noinput` passed **218 tests with 17 PostgreSQL-only skips (201 executed)**; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. Existing description/coaching completion-write, receipt-acknowledgement, late-receipt, NUL and quota regressions remain passing.
- Full mobile checks from `mobile/`, with `EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1`: `npm run check` passed TypeScript/lint and **231 tests**; `npm run bundle:android` exported successfully. Existing Node module-type and react-test-renderer deprecation warnings remain. No mobile code/package was changed. `git diff --check` passed. Full-suite/mobile/export logs are in this workspace's ignored `tmp/checkpoint3-uncertainty-repair/`; supplied dependencies were used without installation.
- Evidence boundary/handoff: inspected coordinator logs under `/private/tmp/onloud-feedback-part3` report the **pre-repair** 212/212 PostgreSQL pass, ten synthetic worker fault cases, 60.649-second shared quota spacing, broker/Beat recovery, API/database restart with five retained media hashes and unchanged Whisper/read-only counts. Those are prior-snapshot evidence, not final-patch execution in this run. The runner must stage this unstaged delta and independently review the repaired snapshot; coordinator PostgreSQL/concurrency and affected worker checks must be rerun. Human inspection and Android device checks remain pending, as do checkpoint-4 UI and checkpoint-5 live quality evaluation. No agents spawned, Git mutations/publication, credential/private-media reads, live API calls, dependency installs or other-worktree edits occurred.

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

### 2026-10-08 — Checkpoint 3 review repair: coaching receipt freshness

- Tool/request: sole Codex implementation writer, no model override. Representative request: repair the confirmed stale-coaching cache-ordering defect with backend and both-cache regressions, preserving checkpoint-3 scope. All remaining checkpoints remain authorized with checks between them on one eventual PR; UI and quality evaluation remain checkpoints 4–5.
- Incorporated material: `services/coaching.py` derives public `updated_at` from the current job, description set and current-generation request receipt/finalization timestamps. Late receipts can resolve confirmation while an edited analysis stays stale; older generations' evidence does not change a newer public snapshot. No schema, state-machine, mobile production-code or provider-call change was needed. Added tests in `test_coaching.py` and `mobile/tests/feedback-contract.test.mjs`; updated README, API contract, handoff and AI-feedback ledger. Prototype `33907d3` feedback/Gemini/models/tests were inspected read-only; no new prototype code was incorporated, and earlier attribution remains applicable.
- Regression evidence: the new backend test failed on equal pre/post-receipt freshness for both live and expired claims before the fix, then passed. Coverage includes receipt-only finalization without job writes, duplicate receipts, feedback/attempt/history read consistency, unchanged edited descriptions and newer generations, retained private raw/usage, and zero outbound/Whisper calls during receipt handling. Mobile synthetic fixtures exercise microsecond freshness with forward/reversed delivery through both analysis and review caches, plus newer-generation precedence over a later old receipt.
- Backend checks from `backend/`, with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings --noinput` passed **219 tests with 17 PostgreSQL-only skips (202 executed)**; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. Existing persistence-failure, receipt-acknowledgement, superseded-receipt and NUL regressions remain in the passing suite.
- Mobile checks from `mobile/`, with `EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1`: `npm run check` passed TypeScript/lint and **233 tests**; `npm run bundle:android` exported successfully. Existing Node module-type/react-test-renderer warnings remain. `git diff --check` passed. Supplied dependencies were used without installation, and dotenv loading was disabled.
- Handoff/limits: this repair remains an unstaged delta over the runner's staged checkpoint-3 work. Runner staging and independent review of the final snapshot, coordinator PostgreSQL/Redis/Celery recovery verification with synthetic providers, human inspection and Android review/offline/API-switch/replay checks remain pending. No device, live-provider or model-quality check is claimed. No agents were spawned, Git state mutated, credentials/private media read, live network/provider calls made, dependencies installed or other worktrees/pipeline controls edited. The supplied review identified this defect; no additional human correction or named-owner approval is inferred.

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

### 2026-10-08 — AI feedback checkpoint 3 writer handoff

- Tool/request: sole Codex implementation writer, configured model without override. Representative request: implement checkpoint 3 durable coaching from saved rehearsal evidence, with explicit generation, captured provider scope, independent retries, safe mobile contracts and meaningful mocked tests. The user authorized all remaining checkpoints with checks between them on one eventual PR; this bounded run implements only checkpoint 3. Supplied planning/investigation reports helped locate seams; current source was inspected. No named owner approval or human review is inferred.
- Incorporated material: additive `0006_durable_coaching`, `FeedbackAnalysis`/revisioned `FeedbackJob`, exact-stage request ownership, `services/coaching.py`, feedback routes and shared attempt/history metadata. Existing descriptions expose a captured-selection admission seam and advance only explicitly retried unfulfilled dependencies. Both stages share quota reservations; receipt-first recovery, independent revisions and description-edit fencing preserve prior results and late request evidence. The evidence validator adds source/output NUL rejection and snapshot reconstruction; public transcript IDs use typed field order so PostgreSQL JSONB key reordering cannot change evidence identity. No Whisper processing/media/request constraint is changed. Mobile additions are `contracts/feedback.ts`, feedback validation, explicit clients, recording/feedback parsing and cache reconciliation, with no screen changes. README, API contract, handoff and checkpoint ledger document the current authorization and pending checkpoints.
- Attribution: read-only prototype `33907d3` (`services/feedback.py`, `gemini.py`, `models.py`, `test_feedback.py`) informed bounded-card, cache/revision and private-ledger concepts. Reused current checkpoint-1 adapters/evidence validation and checkpoint-2 description/quota/recovery seams. Prototype substring matching, automatic orchestration, countTokens and cross-scope edited reuse were not incorporated. New durable coaching, contract/parser and regression material was AI-authored in this workspace.
- Verification: from `backend/`, with `PYTHON_DOTENV_DISABLED=1`, `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings --noinput` passed **211 tests with 17 PostgreSQL-only skips (194 executed)**; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. Tests use synthetic sources/mocked providers and assert call counts/zero Whisper calls. New coverage includes cache-hit versus dependent descriptions, selected scope/config changes, local preflight, original-index chronology, output distinctions/NUL, stale retained suggestions, revision/ack conflicts, shared quota/cooldown, submission/receipt/completion persistence failures, late superseded receipts, populated migration preservation and five PostgreSQL-only races. All checkpoint-2 regressions remain in the passing suite. A recovery test caught an unnecessary timestamp write to newer queued work; it was removed. Self-review also identified and repaired typed-versus-JSONB transcript identity ordering, with a regression.
- Mobile verification: from `mobile/`, with `EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1`, `npm run check` passed TypeScript, lint (no lint warnings) and **228 tests**; `npm run bundle:android` exported the Android JavaScript bundle successfully. Parser/client/cache tests cover quarantined malformed feedback, source/word/fact/time bounds, repeated/backward/simultaneous visits, partial/no-speech/legacy caches, independent freshness and failed reanalysis retaining stale prior suggestions. Inherited Node module-type test warnings remain; no package changes were made. `git diff --check` passed. The supplied `.venv`/`node_modules` were used without installation or upgrades.
- Handoff/limits: all changes remain unstaged on the supplied runner branch, base `ce16ae1`. Runner staging and independent review, coordinator real PostgreSQL/Redis/Celery/API restart/crash checks with synthetic fake providers, and human inspection remain pending. SQLite/mocks and JavaScript export are not database concurrency, process recovery, Android device or model-quality evidence. Android saved-review/offline/API-switch/replay regression remains a manual check; feedback interaction/disclosure is checkpoint 4 and controlled live quality evaluation is checkpoint 5. No human corrections were supplied during this writer run. No agents were spawned, Git mutations/publication performed, live provider/network calls made, credentials/private media read, dependencies installed, or original worktrees/pipeline controls edited.


### Local agent pipeline 20261008T090238Z-27b318

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — Checkpoint 3 review repair: dependency freshness and portable NUL fixtures

- Tool/request: sole Codex implementation writer, configured model without override. Representative request: fix the confirmed dependency-response ordering issue, PostgreSQL-incompatible NUL-source fixtures and current description-documentation mismatch; retain checkpoint-3 scope. The existing authorization covers all remaining checkpoints with checks between them on one eventual PR. This repair adds no UI or evaluation work, and infers no named owner approval.
- Incorporated material: `services/descriptions.py` advances existing set freshness under its existing lock for current job transitions/receipts, preserving newer data/timestamps during superseded receipt recovery. `services/coaching.py` includes dependency freshness in the public allowlist and aggregate timestamp. Mobile feedback types/parser and review reconciliation retain microseconds, dependency revisions and terminal-state tie breaks while accepting older cached metadata. `test_coaching.py` injects malformed source data at the real read/preflight boundary, never persisting NUL fixtures, and checks unchanged source rows, no admissions and zero calls. Added backend lifecycle/API and mobile out-of-order/cache regressions; README, API contract, handoff and AI-feedback ledger now describe current invalidation and clients. No new schema/package or prototype code was introduced; prototype `33907d3` was re-read without edits, and the earlier checkpoint attribution remains applicable.
- Reproduction: the new backend freshness test and all three new mobile dependency-ordering tests failed against the pre-repair implementation. After repair, focused source/freshness tests and all 21 feedback-contract tests passed. Coverage includes preparing/submitted/expired uncertainty, a late persisted receipt returning to queued and completing with zero outbound calls, known failure and explicit dependency retry, microsecond ordering, delayed history/detail responses in both caches, legacy metadata and invalid timestamp quarantine. The portable NUL tests execute the actual validator and assert no description preparation, feedback/description admission, request or provider call.
- Backend checks, from `backend/` with `PYTHON_DOTENV_DISABLED=1`: `.venv/bin/python manage.py check --settings=config.test_settings` passed; `.venv/bin/python manage.py test --settings=config.test_settings --noinput` passed **212 tests with 17 PostgreSQL-only skips (195 executed)**; `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings` reported no changes. Existing completion-write/receipt-acknowledgement/late-superseded-receipt regressions remain in that suite.
- Mobile checks, from `mobile/` with `EXPO_NO_DOTENV=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1`: `npm run check` passed TypeScript/lint and **231 tests**; `npm run bundle:android` exported successfully. Existing Node module-type and react-test-renderer deprecation warnings remain. `git diff --check` passed; current documentation was checked against the implementation. Supplied dependencies were used without installation.
- Handoff/limits: this repair is an unstaged working-tree delta over the runner's existing staged checkpoint-3 patch. The runner must stage the repaired files and independently re-review the final content. Human inspection, the full PostgreSQL suite (including migration/concurrency coverage), real Redis/Celery/Beat/API crash/restart checks and Android saved-review/offline/API-switch/replay checks remain pending with the coordinator. PostgreSQL fixture portability was repaired by inspection and boundary injection; no PostgreSQL execution is claimed in this run. Checkpoint-4 UI and checkpoint-5 quality evaluation remain pending and authorized. No agents were spawned, Git mutations/publication performed, credentials/private media read, live provider calls made, dependencies installed or original worktrees/pipeline controls edited.


### Local agent pipeline 20261008T090238Z-27b318

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-1/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### Local agent pipeline 20261008T090238Z-27b318

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-2/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### Local agent pipeline 20261008T090238Z-27b318

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T090238Z-27b318/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-3/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

## 2026-10-08 — AI feedback checkpoint 3 coordinator verification

The user authorized all five checkpoints with checks between them and one final
`feature/ai-feedback` PR. This supersedes earlier per-checkpoint confirmation text;
human code inspection remains pending and no merge is authorized.

The configured local runner executed planner, parallel investigators, one writer,
checks, independent review and bounded repairs against `ce16ae1`. Confirmed repairs
covered dependency freshness, PostgreSQL-safe NUL test setup, uncertainty for saved
HTTP 408/5xx or incomplete successful receipts after a description edit, and current
receipt timestamps in public cache freshness. Regression probes reproduced the
uncertainty and reversed-response defects before repair. Final review evidence and
patch identity are recorded in the checkpoint transfer record below.

Coordinator verification used isolated PostgreSQL 16, Redis 7 and actual Celery
worker processes with synthetic provider responses; no live provider was called:

- Full Django suite: **219 tests passed on PostgreSQL, no skips**. The runner also
  passed `check`, `test` and migration-drift checks with `config.test_settings`
  (17 PostgreSQL-specific skips), plus **233 mobile tests**, TypeScript/lint and
  `npm run bundle:android` on the final snapshot.
- Migration 0006 preserved all preexisting rows in nine tables and five baseline
  media hashes before additional fixtures were inserted. No legacy work was queued.
- Ten worker fault/recovery scenarios covered termination before submission,
  termination after submission, saved-receipt recovery, receipt commit acknowledgement
  loss/rollback, completion-write failure, NUL response rejection, description-edit
  fencing, late old receipts after retry and recovery with generation disabled.
  Provider counters asserted one call or exactly one explicitly acknowledged extra
  call as appropriate. Claim expiry was simulated by aging timestamps 361 seconds;
  the worker processes were actually terminated.
- Two additional worker cases (saved HTTP 500 and incomplete HTTP 200 after an edit)
  returned 409 without uncertainty acknowledgement, then made exactly one additional
  coaching call after explicit acknowledgement. Old receipts finalized without
  replacing the new generation. These affected cases were rerun after the freshness
  repair. Existing Whisper request counts were unchanged.
- Shared quota verification measured 60.649 seconds between a description and
  coaching request with a one-request/minute application policy. A real broker outage
  preserved queue intent; restarting owned Redis and Beat redispatched both stages
  with one synthetic call each. Same-project synthetic key rotation was checked.
- API/PostgreSQL restart preserved saved descriptions, coaching, history and five
  HTTP media hashes. Read operations left provider request counts unchanged.

Android emulator `emulator-5580` used the existing matching native development
client and final checkpoint mobile code. The previously saved non-confidential
Whisper pilot (41 words, 16,168 ms, visits 2 → 3 → 2) was copied to the isolated
backend without calling transcription. Before adding two API-scoped review caches,
the device database was backed up and all 54 existing records preserved. The app
loaded server-only review metadata, independently downloaded playable audio and the
actual six-page PDF, and native playback reached the final repeated visit. Paused
backward seeks selected slide 3 at 11 seconds and slide 4 at 6 seconds. Force-stop
and reopen with the validation API offline retained media and metadata, displayed a
stale notice and left playback paused. Cached audio advanced while offline; backgrounding
paused it at three seconds and foregrounding retained that paused position. UIAutomator
could not report idle during moving playback, so a screenshot established native clock
progress and a fresh foreground dump established the pause. These are agent-operated emulator checks,
not human listening, physical-phone coverage or a claim of complete lifecycle stress
testing. New feedback controls and live Gemini/OpenAI quality are checkpoints 4–5.

The exact-lock Python and npm environments were installed from populated local
caches without changing dependency files. No generated native project, credentials,
private receipt/body, local environment, pilot audio or validation harness is included.
Prototype attribution remains in the existing feature documentation. Human review
and physical-device/audible checks remain pending.

Reviewed application patch SHA-256: `82f3f3fedc8144b9239b7ff915b799ec6254153f3fc949164cd1d36d71a567f3`. The coordinator
verified all 30 transferred files matched the reviewed/tested snapshot byte for byte
before this documentation-only evidence addition.


## 2026-10-08 — AI feedback checkpoint 4 writer

- Tool/workflow: local Codex implementation writer, using the supplied planner and
  investigator evidence and independently inspecting current source at base
  `e31937b7df2120a39a3e8edc303b9e120f21a368`. Representative request: implement
  checkpoint 4 feedback review/disclosure only, preserve saved playback/transcription,
  add safe selection comparison and revision-aware edits/recovery, use synthetic
  tests, and stop for coordinator inspection. No additional agents were spawned.
- Incorporated material: backend nonsecret generation-selection descriptor/token,
  optional pre-admission comparison and captured description-set origin; mobile
  contracts/validators, separate feedback/description/consent/recovery caches,
  lifecycle-fenced review hook, plain-Text suggestion/evidence panel, local complete-set
  description editor and saved-screen integration. The shared Action adds optional
  accessibility expansion state. No model, dependency, migration or native configuration
  changed. Existing checkpoint-3 prototype attribution is retained; no prototype or
  other worktree was read or changed by this writer.
- Meaningful regressions were observed failing before their implementation/repair:
  selection mismatch with zero admitted work, captured origin, stale evidence seek,
  assertion-only initial calls, 64 KiB UTF-8 edit rejection, disclosure cancellation/
  obsolete callbacks/repeated taps, retained edit conflicts, dependency revision
  reconciliation and safe known-rejection copy. Added renderer coverage includes
  scoped consent, API/provider/attempt/lifecycle changes, timeout/restart charge
  acknowledgement, exact dependency retry, offline partial/malformed feedback,
  field validation/whole-set preservation, read/PATCH/POST delivery ordering,
  absent pages/audio, playing/paused intent, rapid seeks/Pause and backward/
  simultaneous native-clock PDF evidence. All inputs/providers/media are synthetic
  fixtures; no live provider or private media was read or sent.
- Final checks in `mobile/`: `EXPO_NO_DOTENV=1 ONLOUD_TEST_DB=:memory: npm run check`
  passed TypeScript, lint and **266 tests**, zero failures/skips;
  `EXPO_NO_DOTENV=1 npm run bundle:android` passed. Existing Node module-type and
  react-test-renderer deprecation warnings remain. SDK 57 reference was fetched;
  current installed hooks/player behavior were reused without adding packages.
- Final checks in `backend/`, using coordinator-supplied `.venv/bin/python`:
  `manage.py check --settings=config.test_settings` passed;
  `manage.py test --settings=config.test_settings` discovered **229 tests**, with
  **211 passed and 18 PostgreSQL-only skips**, no failures;
  `manage.py makemigrations --check --dry-run --settings=config.test_settings`
  passed with no changes. The new simultaneous initial-selection race is among
  PostgreSQL-only tests and is not claimed as run here. The SQLite suite exercises
  a synthetic concurrent-winner interleaving and configuration changes during
  preparation. Expected fault-injection warnings are not provider calls.
- Documentation updated: README, API contract, iteration handoff, feedback notes
  and backend `.env.example` comments now describe coaching/disclosure as implemented.
  No credential files were read; no dependency install, staging, commit, push, merge,
  publication, runner/AGENTS edit, native device operation or live evaluation occurred.
- Review boundary: writer self-review only. Runner independent review and coordinator
  PostgreSQL/API/Redis/worker admission/restart plus Android emulator checks remain
  pending. Human code inspection, TalkBack, keyboard/long-text layout and physical-phone
  audible synchronization remain pending. No named human correction/approval is
  claimed. Checkpoint 5 live model evaluation remains pending; all checkpoints still
  target one eventual PR. This entry does not update or submit the Wiki report.


### Local agent pipeline 20261008T102840Z-f784e2

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T102840Z-f784e2/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T102840Z-f784e2/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T102840Z-f784e2/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

## 2026-10-08 — AI feedback checkpoint 4 review repair

- Tool/request: local Codex sole writer; fix the two confirmed independent-review
  findings about unavailable deck metadata hiding descriptions and Reload cancelling
  active feedback polling. No additional agents were spawned.
- Incorporated material: two focused changes in `FeedbackPanel.tsx` and
  `useFeedbackReview.ts`. Validated slide/source identities now drive description
  display independently of page metadata; evidence seeking still requires known
  pages/audio. Reload releases its lock and restarts existing lifecycle-fenced polling
  on success or failure. Added four synthetic cases to `review-screen.test.mjs`;
  updated README, contract, feedback notes and handoff. Existing backend example
  comments already describe implemented coaching/disclosure and remain intact.
- Regression proof from `mobile/`:
  `EXPO_NO_DOTENV=1 ONLOUD_TEST_DB=:memory: node --test --test-name-pattern='descriptions remain readable|polling resumes after failed Save' tests/review-screen.test.mjs`
  failed all four cases before the source fixes and passed all four afterward.
  Coverage includes fresh/cached descriptions with failed deck metadata, local
  edit/Cancel, unavailable evidence with loaded audio, failed Save preflight then
  successful/failed Reload and Cancel, repeated Reload taps, resumed progress through
  completion, and stopped polling during background/navigation. Requests stayed GET-only.
- Full checks: `EXPO_NO_DOTENV=1 ONLOUD_TEST_DB=:memory: npm run check` passed
  TypeScript/lint and **270 tests**, zero failures/skips;
  `EXPO_NO_DOTENV=1 npm run bundle:android` passed. Existing renderer deprecation
  and module-type warnings remain. The [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
  was reopened; no native APIs, dependencies, models or configuration were changed.
- Backend checks, from `backend/` with `PYTHON_DOTENV_DISABLED=1 .venv/bin/python`:
  `manage.py check --settings=config.test_settings` passed;
  `manage.py test --settings=config.test_settings` ran **229 tests**, **211 passed /
  18 PostgreSQL-only skips**; `manage.py makemigrations --check --dry-run
  --settings=config.test_settings` reported no changes. Backend source is unchanged
  in this repair; all providers/media in these tests are mocked or synthetic.
- Boundary: writer self-review only for this repair; runner staging and renewed
  independent review remain pending. Coordinator PostgreSQL/API/Redis/worker and
  Android emulator checks, human code/accessibility/keyboard inspection and physical-phone
  audible synchronization remain pending. No credentials/private media were read,
  live providers called, dependencies installed, Git index/history changed, or other
  worktrees/prototype/runner changed. Human corrections/approval are not claimed.
  Checkpoint 5 remains separate and pending; stop here for coordinator inspection.


### Local agent pipeline 20261008T102840Z-f784e2

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T102840Z-f784e2/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T102840Z-f784e2/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T102840Z-f784e2/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-1/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.

### 2026-10-08 — checkpoint 4 coordinator verification

- Continued the user-authorized five-checkpoint implementation on one feature branch. The local pipeline used its configured model with one writer and a separate reviewer. Human inspection remains pending.
- Real PostgreSQL suite: `backend/.venv/bin/python /private/tmp/onloud-feedback-part4/launch.py manage.py test --settings=validation_settings` passed all **229 tests**, without skips. This includes concurrent initial selection assertions, mismatched selection admission with no new queue/provider work, saved-provider retries and description/coaching recovery. Calls in these automated checks use synthetic providers with outbound HTTP blocked.
- Agent-operated Android emulator (`emulator-5580`, Expo development client) against a real PostgreSQL/API/Celery/Redis/Beat stack with a deliberately synthetic provider: Cancel on the first OpenAI disclosure kept feedback requests and calls at zero. Continue created exactly one description and one coaching request. The card displayed the category, synthetic observation/action, slide/visit/time and independently expandable description/transcript quotes. Generated descriptions were labeled as not necessarily verbatim PDF text.
- Native evidence seeking while paused displayed 6 seconds (validated target 6,820–7,340 ms), slide 4 / chronological visit 2, and remained paused. Canceling a description draft made no request. Saving the edited synthetic slide-4 summary advanced description revision 1→2, marked the prior suggestion stale and disabled its seek action, without a provider call. Explicit regeneration reused the saved descriptions/transcript and added exactly one coaching request; the resulting card displayed the edited-set label.
- Stopping the owned API/worker/Beat and force-stopping/reopening the app retained the completed feedback, edited descriptions, transcript, PDF and audio with a visible offline/stale notice. Offline evidence seeking again reached 6 seconds / slide 4 / visit 2. Background/foreground returned paused. Restarting the API retained feedback revision 2 and description revision 2. Final synthetic counts were **3 feedback calls (1 description, 2 coaching), 1 unchanged preexisting Whisper request**. No live provider generation occurred in these native checks.
- Physical-phone use, human listening/audible synchronization, TalkBack and extended keyboard/long-text usability remain pending. Emulator and renderer evidence do not establish those behaviors. Controlled real-provider quality evidence belongs to checkpoint 5.
- Independent review reproduced two P2 recovery defects: valid descriptions hidden without deck metadata and polling canceled after draft Reload. Both were repaired with four regression tests that failed before the changes and passed after them. Final checks passed **270 mobile tests**, TypeScript/lint, Android export, **229 SQLite tests (18 PostgreSQL-only skips)** and Django system/migration checks. The earlier **229/229 PostgreSQL run** covers identical backend files; repairs changed only mobile and documentation. A post-repair emulator reopen showed the completed card and retained description controls.
- Reviewed application/test snapshot: `64399166b696522607fc588d0cd1fcd7a524ca2196992da488cce12920043bf9` from pipeline `20261008T102840Z-f784e2`, based on `e31937b7df2120a39a3e8edc303b9e120f21a368`. The full reviewed patch was transferred byte-for-byte; this coordinator append is documentation-only. Final outgoing staged application/test bytes are checked against that snapshot before commit. Human review remains pending.

## 2026-10-08 — checkpoint 5 Gemini schema compatibility repair

- Tool/workflow: sole local Codex implementation writer, configured model without
  override, using runner-supplied plan/investigator evidence and inspecting source
  at checkpoint-4 commit `64ec5960013f1fd36be0d1142bed9c1574bd66bb`. Representative
  request: repair only Gemini's unsupported wire-schema constraints, preserve local
  validation and saved request contracts, add regressions and reconcile current
  status; leave final live evaluation pending coordinator evidence. No agents were
  spawned by the writer; the runner owns independent review and staging.
- Incorporated material: Gemini-only schema projection in `feedback_provider.py`;
  provider/stage/version-aware digests and selection in `feedback_config.py`;
  captured description/coaching version plumbing in `descriptions.py` and
  `coaching.py`. New Gemini schemas are `description-gemini-v2` /
  `coaching-gemini-v2`; prompts, OpenAI schemas/payloads, local validators, model
  defaults and transport bounds are unchanged. Legacy queued work/retries/receipts
  reconstruct v1, including waiting coaching without an input hash. No rows are
  rewritten, and no migration/dependency/mobile changes are incorporated.
- Tests incorporated in `test_feedback_provider.py`, `test_descriptions.py` and
  `test_coaching.py`: supported wire keywords and preserved names/refs/object/array/
  integer bounds, unchanged checkpoint-4 legacy/OpenAI payload and digest anchors,
  malformed/oversized output rejection, unknown-version local failure, schema-only
  disclosure mismatch, separate cache scope, old queued/retried work and receipt-only
  recovery after edit/retry supersession without duplicate calls. The existing
  scope-isolation regression now targets Gemini's separate schema version constant.
  The new compatibility assertion failed before repair on `pattern` in **both**
  stages; it passes after repair. This is local red/green evidence, not a reproduced
  provider-side explanation for the generic HTTP 400.
- Actual checks from `backend/`, each with `PYTHON_DOTENV_DISABLED=1` and the
  coordinator-supplied locked environment:
  - `.venv/bin/python manage.py test rehearsals.test_feedback_provider rehearsals.test_descriptions.DescriptionSchemaVersionTests rehearsals.test_coaching.CoachingSchemaVersionTests --settings=config.test_settings`
    passed **35 tests**, no skips.
  - `.venv/bin/python manage.py check --settings=config.test_settings` passed.
  - `.venv/bin/python manage.py test --settings=config.test_settings` ran **243
    tests**, passed with **18 PostgreSQL-only skips** (225 executed).
  - `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings`
    reported no changes.
  All provider calls in tests were mocked; existing synthetic failure-path notices
  appeared as expected. Mobile check/export was not rerun because mobile code is
  unchanged. Prior checkpoint-4 mobile/PostgreSQL/emulator evidence is attributed
  to that snapshot, not this repair.
- Documentation incorporated: reconciled all five checkpoint states in README,
  feedback notes and handoff, corrected the three recovery paths, clarified schema
  contracts and the legacy `expected_selection` limitation, added explicitly
  hand-authored experience examples, and created an **interim** evaluation record.
  The coordinator summary reports exact-model Gemini metadata success, complete
  baseline description rejection and OpenAI baseline description/coaching success;
  no sanitized per-run output/count/usage files were present. Final evaluation and
  agent usefulness/injection assessment remain pending. Primary Gemini/Genkit
  schema references were inspected; the repair is a compatibility hypothesis until
  live generation. Existing prototype attribution/advisory assessment is preserved.
- Pending: runner independent review of this exact patch; coordinator full
  PostgreSQL and real Redis/Celery/Beat old/new snapshot recovery with synthetic
  providers, followed by controlled Gemini generation in a new disposable scope
  reusing saved transcription. Legacy retries intentionally retain old schemas.
  Final sanitized evaluation/publication evidence follows in a bounded documentation
  run. Human corrections/review, physical-phone listening/synchronization, TalkBack
  and extended keyboard/long-text usability remain pending; no named approval is
  inferred. The one eventual PR remains stacked on `feature/rehearsal-review`.
- Documentation checks: `git diff --check` passed. A local path/heading check
  resolved all 68 relative Markdown links in the six changed Markdown files;
  targeted searches found no remaining obsolete current checkpoint-4 recovery/
  evaluation-pending wording. Historical entries remain explicitly historical.
- No credentials, env files, private media/provider bodies or pilot export were
  read; no live provider call, retranscription, dependency installation, Git
  index/history/config mutation, publication, runner/AGENTS change or other-worktree
  edit was performed. The writer stops for coordinator inspection. Historical
  AI-use entries remain intact.


### Local agent pipeline 20261008T112158Z-a87e4d

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T112158Z-a87e4d/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T112158Z-a87e4d/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T112158Z-a87e4d/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### 2026-10-08 — checkpoint 5 compatibility repair coordinator verification

- Independent pipeline review passed for `e33a0952bb7312bf73eaf4bbc7b6eb381de6686c7f129eeef411567863a73ebb`, based on `64ec5960013f1fd36be0d1142bed9c1574bd66bb`. The reviewed patch was transferred byte-for-byte to `feature/ai-feedback`; this append is documentation only. Application and test bytes match the reviewed snapshot.
- Coordinator real PostgreSQL run passed **243/243 tests**, without skips, in 20.416 seconds. Its backend patch SHA-256 is `af3cf3f866587c74648cd536d22e95a0cf1635cb524b8d7ec5a1d3a152a61484`, exactly matching the reviewed backend. Runner SQLite run passed 243 tests (18 PostgreSQL-only skips); system and migration-drift checks passed. No mobile changes were made after the checkpoint-4 check/export and emulator verification.
- OpenAI's separately controlled initial evaluation completed two description/coaching pairs (four calls). Gemini's initial complete HTTP 400 rejection is preserved; no automatic retry occurred. Corrected Gemini live evaluation follows only after this reviewed repair is committed, in a fresh disposable scope sharing a five-call total Gemini transport ceiling including the rejected request. No new transcription is authorized. These application evaluation bounds are not a monetary cap.
- Saved Gemini legacy contracts intentionally keep v1 payloads and hashes on queue/retry/receipt recovery; new selections use provider-specific v2 schemas. Legacy/current recovery assertions passed with mocked providers on PostgreSQL. Real worker recovery and semantic results from the corrected live run will be recorded separately. Human review remains pending.

### 2026-10-08 — checkpoint 5 description v3 schema repair

- Tool: configured Codex local pipeline, sole implementation writer; no model override
  or delegated agent. Base: `f1165645535429e4c3f14014c123b4f15dc2d2ea`.
  Representative request: remove array bounds only from new Gemini description
  wire schemas while preserving local validation and exact saved v1/v2 contracts.
- Incorporated: a version-aware projection in `feedback_provider.py`, four new
  provider tests and extensions to existing provider/description/coaching recovery
  matrices. Frozen synthetic v1/v2 schema, payload and digest anchors were captured
  before production edits. New selections use `description-gemini-v3`; coaching v2,
  OpenAI v1, prompts, transport, media/request/response bounds and local 1–10-slide/
  five-fact limits are unchanged. Documentation changes are limited to the schema
  compatibility section, API paragraph and this disclosure.
- Red/green evidence: before the production fix, from `backend/`,
  `.venv/bin/python manage.py test rehearsals.test_feedback_provider.FeedbackProviderTests.test_current_gemini_description_removes_only_wire_array_bounds --settings=config.test_settings`
  failed once because `minItems: 1` remained in `slides`. After the fix, the same
  test passed within the focused and full runs below. Synthetic recovery cases
  cover saved v1/v2 queue/retry, waiting coaching without an input hash, and receipts
  after no supersession/edit/retry; no duplicate provider calls are permitted.
- Actual checks used the supplied `backend/.venv` with cleared ambient environment
  (`env -i PATH=/usr/bin:/bin PYTHON_DOTENV_DISABLED=1`), no dependency installation:
  - `.venv/bin/python manage.py test rehearsals.test_feedback_provider rehearsals.test_descriptions.DescriptionSchemaVersionTests rehearsals.test_coaching.CoachingSchemaVersionTests --settings=config.test_settings`
    passed **39 tests**, no skips.
  - `.venv/bin/python manage.py check --settings=config.test_settings` passed.
  - `.venv/bin/python manage.py test --settings=config.test_settings` passed:
    **247 tests, 18 PostgreSQL-only skips (229 executed)** in 9.869 seconds.
  - `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings`
    reported no changes. Existing synthetic failure-path notices were expected.
  All provider calls were mocked. Tested backend diff SHA-256:
  `63c98d95e9ca3093cd29f013fb40cad5cb51eaf9238f16a86baa6a1ca5fb61e2`.
  `git diff --check` passed; all 21 relative Markdown path/heading links in the
  three changed documents resolved. The writer left the index untouched.
- Coordinator-supplied evidence, not writer-run live verification: **7 Gemini
  transport attempts** (two full description HTTP 400 rejections and five tiny
  probes). Text-only, minimal-object, description-v2-without-array-bounds and
  unchanged coaching-v2 probes passed 200; the exact description-v2 schema probe
  failed 400. Each probe ran once with maximum 16/64 output tokens. There was no
  automatic retry or new Whisper call. The [Gemini limitations](https://ai.google.dev/gemini-api/docs/structured-output#limitations)
  and [GenerationConfig reference](https://ai.google.dev/api/generate-content#GenerationConfig)
  were inspected: array bounds are documented as supported, while complex schemas
  may be rejected. Small-probe acceptance is not full application live success.
- Pending: runner staging and independent review of the exact final snapshot;
  coordinator PostgreSQL/Redis/Celery/Beat recovery with synthetic providers and
  the separately authorized full configured-model Gemini run in a fresh disposable
  scope reusing saved transcription. Final evaluation reconciliation belongs to
  the coordinator. Human inspection/corrections remain pending; no named approval,
  semantic accuracy/safety, spending-cap or completed live-run claim is made.
  No mobile build was repeated because mobile is unchanged; existing device,
  audible synchronization, TalkBack and long-text/keyboard checks remain pending.
- Writer self-review checked the focused diff and historical reconstruction;
  it is not independent review. No credentials, private media or saved provider
  bodies were read, and no provider call, Git mutation, dependency/runner/AGENTS
  edit, other-worktree change or publication was performed. Stop: ready for inspection.


### Local agent pipeline 20261008T115050Z-32c7c9

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T115050Z-32c7c9/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T115050Z-32c7c9/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T115050Z-32c7c9/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### 2026-10-08 — checkpoint 5 array-bound repair coordinator verification

- Independent configured-model pipeline review passed for `a5a0a2b1c0a903649d7ce03af7de5b9c36f736b67910618b6da413c6e795ed41`, based on `f1165645535429e4c3f14014c123b4f15dc2d2ea`. The full patch was transferred byte-for-byte; this append changes evidence only. Application and test bytes match the reviewed snapshot.
- Coordinator PostgreSQL suite passed **247/247 tests**, without skips, in 28.340 seconds. Tested backend patch SHA-256: `63c98d95e9ca3093cd29f013fb40cad5cb51eaf9238f16a86baa6a1ca5fb61e2`. Runner SQLite suite, system and migration checks are recorded above; mobile code remains the checkpoint-4 verified snapshot.
- Real PostgreSQL/Redis/Celery checks passed for both saved `description-gemini-v2` and current `description-gemini-v3`: one synthetic description request, worker termination after private receipt persistence, claim aged 361 seconds, restart with generation disabled, saved-receipt recovery and duplicate delivery. Each retained its exact request hash/digest/revision and made one stub call total. The pre-existing Whisper record stayed at one. This was a solo worker/manual kill test, not production prefork timeout or real-provider fault injection. All real outbound HTTP and Whisper entry points were blocked.
- The recovery harness received independent read-only review. Coordinator repaired two harness-only issues before execution: matching saved project identity and counting every provider-stub entry before disabled-generation rejection. Six runtime file fingerprints were retained and verified against the final reviewed patch.
- Controlled diagnostics recorded two full Gemini description rejections and five small text/schema probes (200/400/200/200/200). Removing only description array bounds isolated this schema's compatibility issue; unchanged coaching v2 passed its probe. The final application run follows this committed repair and permits four additional requests in a fresh scope, eleven total Gemini transport attempts including all diagnostic history. No automatic retry or new Whisper call is authorized. A full success/usefulness claim awaits that run. Human review remains pending.


### 2026-10-08 — AI feedback final controlled evaluation and publication inspection

- User authorized all five checkpoints with checks after each, one `feature/ai-feedback` PR, and no merge. The configured-model local pipeline provided planning, parallel investigators, one product writer, checks, independent review and bounded repairs. Prototype source `33907d3`, teammate branches and unrelated prototype edits were preserved. Prior task-level entries retain their historical pending statements; this entry records final coordinator evidence.
- Final application/test snapshot: `f89383f0bd80257e43159f026ffe48cef7c33ee9`. Array-bound repair reviewed patch `a5a0a2b1c0a903649d7ce03af7de5b9c36f736b67910618b6da413c6e795ed41`; application bytes matched the reviewed snapshot and the PostgreSQL-tested backend patch `63c98d95e9ca3093cd29f013fb40cad5cb51eaf9238f16a86baa6a1ca5fb61e2`. Final runner checks: 247 tests with 18 SQLite skips, system check and migration drift passed; coordinator PostgreSQL passed all 247. Saved-v2/new-v3 real Celery receipt recovery passed separately, with exact fingerprints and no duplicate provider-stub work.
- Independent outgoing integration/provenance review of `1305917..64ec596` found no publication blockers, reran 270 mobile tests and 43 targeted provider/evidence/migration tests with dotenv and live HTTP disabled, and checked credential/generated-artifact paths. Subsequent backend repairs each received independent exact staged review and PostgreSQL tests. Mobile application bytes remain unchanged from `64ec596`; its TypeScript/lint, Android export and native evidence remain applicable.
- Controlled evaluation used non-confidential synthetic data and backend-only credentials in disposable PostgreSQL/Redis/Celery/Beat scopes. The original saved pilot and media were untouched. OpenAI (`gpt-6-luna`, description-v1/coaching-v1 schemas) completed both cases at `64ec596` with four calls. Gemini's initial/v2 full descriptions rejected; five bounded text/schema probes isolated this nested schema's array-bound interaction. Recomputed request hashes verified the failing/successful description probes differed only by array-bound removal. Final Gemini (`gemini-3.1-flash-lite`, description-gemini-v3/coaching-gemini-v2) completed both cases at `f89383f` with four more calls. Total Gemini transport entries: eleven, including two full rejections and five probes. These coordinator bounds are not a monetary cap or account-quota claim; missing rejection usage is not assumed zero/free. No automatic retry, model substitution or new Whisper call occurred.
- OpenAI accepted 1 baseline/3 adversarial cards. Gemini accepted 2 baseline cards and 1 adversarial card, discarding a clarity candidate for `speech_quote_mismatch`; the latter reason came from a read-only local diagnostic exposing only category/rejection code. Public APIs never returned raw provider output. Both successful scopes retained exact results/revisions, source/media hashes and their single pre-existing Whisper request through completed-state POST/GET, duplicate tasks and generation-disabled API/worker/Beat restart.
- `node --experimental-strip-types /private/tmp/onloud-feedback-part5/mobile_validation.mjs` passed actual `parseResult`, `parseFeedback` and `feedbackSeekTarget` on all seven accepted live cards, including Gemini partial output. This is live-result parsing/evidence validation, not native rendering of live output. Checkpoint-4 actual Android emulator checks used an explicitly synthetic provider and are recorded separately above. Physical-phone/listening, TalkBack and extended keyboard/long-text checks remain pending.
- Independent agent assessments found well-grounded numerical discrepancy suggestions but weak baseline advice, a possible slide-number false positive, one overstated OpenAI chart claim and Gemini's unsupported “controlled trial” description. Exact quotes/ranges are not semantic correctness. Accepted output did not follow embedded install/URL/canary requests; inert description of malicious footer text and the saved injected edit are not instruction compliance. No general injection-immunity claim, Korean evaluation or human usefulness approval is made. The [evaluation report](feedback-evaluation.md) records actual versions/counts/usage and limitations.
- Final coordinator changes are documentation only: reconciled README, feedback checkpoint status, evaluation and handoff; added actual provider outcomes, review evidence and quality limits. Existing prototype attribution and dependency-advisory assessment are preserved. No dependency versions changed; no source/proposal-driven package was installed. The inherited Torch/mobile advisory set is not audit-clean.
- Command-line Git publication authentication was unavailable. The coordinator will use the authorized connected GitHub service, verify each published Git tree matches its reviewed local checkpoint, preserve local checkpoint history, and attach the single PR. Human review remains pending; no merge or next-stage implementation is authorized by this completion. UI polish is proposed for a later confirmed stage.
- Final documentation accuracy review passed after two narrow corrections: described the completed Gemini call count as observed, and omitted an audio hash not included in the reviewer's allowlisted metadata. All 71 relative link paths, referenced anchors and staged whitespace checks passed. The final outgoing 47-file scope contains no detected credential patterns, private/generated media, environment files or installed dependencies. This scan supplements the per-checkpoint independent reviews; it is not a comprehensive security audit.


### 2026-10-08 — OpenAI default and Gemini quota-stop follow-up (writer handoff)

- Tool: Codex sole implementation writer, using the runner's plan and source
  investigations at exact base `9db4428442708d1f88a2e0a4b2b96dc856edc741`.
  Representative request: prioritize OpenAI for omitted feedback selection; stop
  Gemini on quota exhaustion and preserve explicit, revision-aware retry. Transfer
  the reviewed patch to the existing `feature/ai-feedback` / PR #21.
- Incorporated material: absent-provider defaults in `feedback_config.py` and
  `feedback_provider.py`, example configuration, provider-specific local quota
  policy and guarded legacy-wait termination in both description/coaching claim
  and recovery paths. Terminal errors preserve retry times and saved selections;
  receipts, uncertainty, live claims and revision/edit fences retain precedence.
  No model default, migration, dependency, scheduler or fallback was added.
- Mobile change: fixed `quota_stopped` copy in `FeedbackPanel.tsx`, including the
  matching failed description dependency without masking stale/uncertain errors.
  Existing bounded error validation, polling and manual retry controls are reused.
  Current README, API contract and feedback configuration documentation were updated;
  previous provider, infrastructure and device evidence above remains historical.
- Tests incorporated: new `test_feedback_quota_policy.py` covers both stages'
  Gemini RPM/TPM/daily/cooldown stops with zero attempted outbound calls, duplicate
  tasks/recovery before and after expiry, present/absent legacy request rows,
  queued markers, changed environment provider, explicit cooldown/revision retry,
  actual 429, live claims, completed outcomes, uncertainty and late receipts after
  edit/retry supersession. OpenAI waits resume in the same generation for all four
  quota causes, even after an environment selection change. Existing automatic-wait
  and concurrency assertions now explicitly select OpenAI before scope admission.
  Parser and rendered-screen regressions cover safe quota messages, preserved
  evidence, expiry/Refresh/background/reopen without POST, and one explicit saved
  Gemini revision/selection retry. These are synthetic fixtures, not live results.
- Writer verification (dotenv loading disabled; providers mocked and live HTTP
  blocked by the backend fixtures): focused regressions reproduced the old default,
  quota/legacy wait and mobile-message failures before the fixes. Focused backend
  run: 171 tests, 13 PostgreSQL-only skips; after adding OpenAI and direct-receipt coverage, final
  `.venv/bin/python manage.py test --settings=config.test_settings` from `backend/`
  passed **272 tests, 18 PostgreSQL-only skips (254 executed)** in 6.944 seconds.
  `.venv/bin/python manage.py check --settings=config.test_settings` passed;
  `.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings`
  reported no changes. Commands used `PYTHONDONTWRITEBYTECODE=1 PYTHON_DOTENV_DISABLED=1`.
- From `mobile/`, `EXPO_NO_DOTENV=1 ONLOUD_TEST_DB=:memory: npm run check`
  passed TypeScript, lint and **275 tests**. `EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 CI=1
  npm run bundle:android` passed and exported one Android JS bundle. Expected
  synthetic failure-path notices and the existing react-test-renderer deprecation
  warning do not establish live/device behavior. `git diff --check` passed; all
  47 local Markdown link paths in the four updated documents resolved.
- Pending: runner staging, mandatory final checks and independent review; coordinator
  integration into the same feature branch/PR, real PostgreSQL concurrency tests and
  Redis/Celery/Beat recovery with synthetic providers and blocked outbound calls.
  Android device verification of both messages, cooldown/manual retry, saved-provider
  disclosure and lifecycle behavior remains pending. No new provider or device
  check was performed. Human inspection/corrections remain pending; this writer's
  source/diff review is self-review, not teammate or independent approval.
  No credentials/private media were read, dependencies installed, other checkout
  changed, agent spawned, Git mutation or publication performed.


### Local agent pipeline 20261008T123356Z-b3ea45

- Tool: separate local Codex CLI planner, investigators, implementer and reviewer sessions.
- Requested scope and incorporated material: see the task-level entry above and staged diff.
- Check: git diff --cached --check — exit 0.
- Check: npm run check — exit 0.
- Check: npm run bundle:android — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T123356Z-b3ea45/workspace/backend/.venv/bin/python manage.py check --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T123356Z-b3ea45/workspace/backend/.venv/bin/python manage.py test --settings=config.test_settings — exit 0.
- Check: /Users/seoyeonpark/Documents/ChatGPT/OnLoud/tmp/agent-pipeline/20261008T123356Z-b3ea45/workspace/backend/.venv/bin/python manage.py makemigrations --check --dry-run --settings=config.test_settings — exit 0.
- AI review: this staged snapshot is being sent to an independent reviewer; local evidence is round-0/reviewer/answer.json. This entry does not claim a pass.
- Human corrections/review, changed Android flows, and any required real database/worker/provider validation remain pending. No commit or push is authorized by this run.


### 2026-10-08 — OpenAI priority and Gemini quota-stop verification

- User correction: prioritize OpenAI and stop Gemini when quota is unavailable. The existing PR #21 receives this focused follow-up. Omitted provider configuration and the example now choose OpenAI; feedback remains disabled until configured. Saved selections remain pinned, with no fallback. Gemini local RPM/TPM/daily/cooldown exhaustion now terminates with `failed/quota_stopped`; explicit revision-aware retry remains available only after its cooldown. Existing provider-429 handling remains terminal. OpenAI local quota waits retain their prior recovery behavior.
- The unchanged configured-model local runner passed preflight and all 16 runner tests. Its planner completed read-only, but a coordinator-created dependency symlink triggered the generated-path guard. The coordinator replaced it with an ignored isolated dependency directory, verified a clean base/index/source and validated the saved plan, then resumed the unchanged investigator/writer/check/reviewer methods. No runner source or model setting changed. Parallel investigators, one writer, checks and independent review completed in run `20261008T123356Z-b3ea45`.
- Independent staged review passed with no findings for patch `639c3f1f70aa584a4c09aaf5c4fb560b57baf80582424d210736a1b1a16069d4`, based on `9db4428442708d1f88a2e0a4b2b96dc856edc741`. Transfer to `feature/ai-feedback` matched that patch byte-for-byte before this coordinator-only evidence entry. The final snapshot passed `npm run check` (275 tests, TypeScript and lint), `npm run bundle:android`, Django system/migration-drift checks and 272 SQLite tests (18 PostgreSQL-only skips). A separate final frozen-source run passed all 272 tests on real PostgreSQL in 26.219 seconds. An earlier PostgreSQL run was superseded because tests were still being added; the final backend file hashes match the reviewed source.
- A disposable PostgreSQL/Redis/real solo-Celery-worker harness passed eight synthetic cases: new Gemini description/coaching quota stops, worker restart and explicit retries, both legacy waiting and already-requeued states for both stages, OpenAI automatic local-wait recovery, and terminal Gemini HTTP 429. Cooldown expiry was advanced in the fixture; this is not a provider-quota timing measurement. Duplicate deliveries and recovery did not submit stopped Gemini work. Four explicitly permitted synthetic calls occurred; zero live HTTP attempts, task failures or new Whisper calls occurred. The saved pilot attempt, transcript, media hashes and existing Whisper request row remained identical. The recovered/stale/uncertain receipt boundaries are also covered by the automated regressions. This narrow harness invoked the actual recovery task through Celery; it did not rerun a periodic Beat scheduler or a prefork hard-timeout experiment.
- Runtime code and existing tracked tests used by that harness match patch digest `3ed99f582344c9d3b31e78cd0bb86abe4395f0b18eb5842e7e23a70b266540d8`; the new policy test file was then covered by the final frozen PostgreSQL suite. Local evidence includes the runner report and the coordinator's `report.json`, `postgres-final.log` and source-hash records under the temporary quota-validation directory. No credentials, raw provider responses or private media are incorporated here.
- Native emulator verification used the existing synthetic cached pilot and real API/worker path with fake provider credentials. It showed the terminal Gemini coaching message, retained transcript/PDF/audio and stale prior cards, and exposed manual Retry only after cooldown plus Refresh. Retrying displayed the saved Gemini disclosure despite the new OpenAI default; Cancel sent no generation request. Native description-dependency-message, physical-phone/listening, TalkBack and extended lifecycle checks remain pending; automated rendered-flow tests cover both messages and stale/uncertain precedence. No live provider check was needed for this policy-only change. Existing feedback-quality and dependency-advisory limitations remain unchanged.
- Human code review remains pending. The original prototype/unrelated work and backend key file are preserved. Publish only a follow-up on the existing `feature/ai-feedback` PR, without merge or beginning UI polish.


## 2026-10-08 — PR #21 physical-phone test setup

- Request: prepare a source-specific live test checklist and open all code through PR #21 on the connected phone. User separately selected OpenAI feedback with a ten-request daily application limit.
- Tool: Codex. Incorporated material: docs/live-testing-pr21.md and this evidence entry; no application/test code changes. Remote PR #21 remains open/unmerged at a850424492843bf1ef19ddebd2643acefff2b9d6, matching this feature/ai-feedback checkout and including its stacked prerequisites. Preserved the prototype checkout and unrelated local changes.
- Installed the existing storage-stage native APK with adb install -r, preserving phone app data. Verified its app.json and all production package-lock entries match PR #21. Metro serves this exact PR checkout; Galaxy S23 Ultra SM-S918N displayed the actual Library screen. The app's Check connection issued HTTP 200 to the isolated API.
- Runtime: separate local API/database/media and named queue; backend source remains the PR head. Applied all PostgreSQL migrations and manage.py check (zero issues), checked health/readiness, worker ping and actual queued recovery completion, including Beat delivery. Initial macOS prefork child initialization failed; --pool=solo, as used in prior local verification, completed the same task. This is a local runtime workaround, not verification of process-enforced task timeouts.
- OpenAI feedback configured as gpt-6-luna, one request/minute, conservative 2,000,000 application reservation units/minute and ten feedback requests/day. These are application policy, not verified provider allowances or a monetary cap. Descriptions and coaching share the cap; explicit Whisper transcription is separate. Credentials loaded privately from the existing ignored backend environment. Setup initiated no provider requests.
- Fresh npm run check: TypeScript/lint and 275/275 mobile tests passed. Reused compatible native build; no new native compilation or Android export was claimed. Metro showed manifest-asset timeout warnings but actual phone rendering succeeded. Full backend suites were not rerun for this setup-only work.
- Human microphone/listening, transcript accuracy, live feedback usefulness, lifecycle/offline, accessibility and ten-minute acceptance checks remain pending. No human review, commit, push or merge occurred. The checklist separates these tests from observed setup evidence.


## 2026-10-08 — PR #21 physical feedback admission repair

- User reported repeated Generate feedback rejection ("Generation was not admitted") during the physical-phone test. Codex traced read-only preflight and live HTTP 400s to a valid stored slide PNG of 1,260,810 bytes exceeding feedback's 1 MiB input limit. The original PDF passed its stored hash check; recording/transcription were completed. Repeated refresh could not repair this.
- Local task branch codex/pr21-feedback-image-size is based on PR #21 a850424. Generated/incorporated material: services/feedback_images.py, saved-description preparation, source-specific mobile error copy, five backend regressions, three rendered mobile regressions, and contract notes. Original uploaded files stay unchanged; compatible provider images preserve exact bytes/source IDs. Oversized valid images get deterministic bounded JPEG copies, with bounded resizing only if needed, while pixel/frame/read/aggregate limits remain enforced.
- Regression reproduction failed against the old code for oversized PNG and aggregate image admission, plus all three source-error UI cases. After repair: targeted 5 backend/3 mobile checks passed. Fresh full checks: npm run check passed TypeScript/lint and 278 tests; npm run bundle:android passed. Django check and makemigrations --check --dry-run with config.test_settings passed; full suite ran 277 tests, OK with 18 PostgreSQL-only skips. No new native module/dependency or schema change.
- Independent reviewer agent reviewed exact staged application/test patch SHA-256 a8178d36f2a62e503248e3088006b3e6f918936dc26a2eaf10b3995f4ed32cdf, plus the two contract additions. No actionable findings. Independent synthetic probes covered 1600x1600 high-entropy images, a ten-slide aggregate, corrupt/truncated/multiframe/oversized-dimension rejection, preserved baseline identities, deterministic encoding, removed metadata and private decoder logs. This is AI review, not human approval.
- Live existing-rehearsal preflight passed: the offending feedback copy became 310,950 bytes. Setup's earlier 2,000,000 application-unit allowance was below the 4,078,566-unit description request; local allowance was corrected to 5,000,000 with original 1 RPM / 10 daily retained for that run. One explicit retry of the user's previously requested generation returned HTTP 202. Descriptions and coaching each returned HTTP 200; final state completed/accepted with one accepted suggestion, zero discarded. Original PDF, all slide media, audio and transcript hashes matched the pre-retry baseline. Exactly two feedback submissions occurred; transcription stayed at its original single request.
- User then requested removing rate limits during testing. Session-only configuration now removes the daily cap and uses 1,000 RPM / 1,000,000,000 application reservation units per minute, effectively eliminating local waits for this manual test. The schema requires positive RPM/TPM, so this is a high testing allowance rather than removal of quota code. Provider-enforced rate limits, per-request bounds, explicit generation/retry, and uncertainty guards remain. API/worker/Beat were restarted with the same source/data. No extra paid generation was used to test the configuration.
- Physical phone rendered Completed in the feedback section for the saved rehearsal. JPEG visual fidelity and advice usefulness still require human judgment. No listening/semantic acceptance or full lifecycle coverage is claimed. Original sleep setting was restored after temporary UI verification. No commit, push or merge; human final inspection remains pending.

## 2026-10-09 — feedback image repair publication verification

- Request: publish the prepared bounded-image repair to PR #21, preserving its feature ownership and excluding frontend redesign. Codex preserved the complete staged snapshot and verified the published PR head. Independent reviewer rechecked the exact application/test patch against prior evidence, found no concrete defects, and checked staged files for unintended secrets/generated output.
- Fresh automated evidence: Django `check`, full `test`, and `makemigrations --check --dry-run` under `config.test_settings` passed (277 tests, 18 PostgreSQL-only skips, no migration drift). Mobile `npm run check` passed TypeScript, lint and 278 tests; `npm run bundle:android` passed. Existing live-provider evidence is recorded separately in live-testing-pr21.md; this check made no provider requests.
- User authorized publication to the existing feature PR; dependency merge resolutions require their own review and inspection. No human teammate approval or merge into main is claimed. No credentials, test-session quota overrides, native build output or private media are included.

## 2026-10-08 — automatic transcription after recording

- Request/tool: the user asked Codex to change the corresponding PR so transcription starts automatically when recording finishes. Continued PR #19 from its verified published head `c7733d8288833b010948d2c5737929088547aa1e` in an isolated worktree. Existing feature/prototype worktrees and unrelated edits were preserved.
- Incorporated material: mobile capture now saves an API-pinned, single-use processing intent with the final audio checkpoint and opens the saved result after recorder remount. The result screen uploads and starts initial transcription after the existing first-use disclosure. Cancellation, old recordings, failed/uncertain requests and API changes retain explicit recovery controls. Audio, UUIDs and slide events are retained. Updated README, API contract, mobile-transcription notes and handoff; backend endpoints/dependencies are unchanged.
- Tests/review: four initial behavior tests failed before implementation. Independent reviewer found a delayed-status-read cancellation race; its regression failed before repair, then passed after Cancel consumed the pending automatic intent. Final independent AI review reported no remaining actionable findings and passed 47 focused tests. Reviewed application/test/docs patch SHA-256 before this evidence entry: `e16fb60b845ce6d0c1452e1eeaf8adda865bb7eb7b0079bd1258026b3252f6bc`. Final hook/test/contract Git blobs start `e67604e6`, `cb95a76a`, `26623ab2`. Tested working-tree content matched the staged snapshot.
- Automated verification: `npm run check` passed TypeScript, lint and **125/125 tests**; `npm run bundle:android` passed on final code. `git diff --cached --check` passed. Initial sandbox cache-write failure and a React lint finding were resolved before the final successful checks. Existing React test-renderer deprecation notices remain. No backend files changed; backend/infrastructure suites were not rerun for this mobile-only follow-up.
- Agent-operated Android evidence: emulator `emulator-5580`, existing compatible development client, isolated Metro and a temporary synthetic API without credentials. Imported a synthetic one-page PDF, started native recording, tapped Stop, observed automatic result navigation, one deck upload, one audio upload and exactly one process POST without Upload/Analyze taps. The UI displayed completed status and an explicitly synthetic transcript. Refresh added only a GET; local playback advanced to two seconds with Pause visible. An intermittent ADB disconnect interrupted inspection but later UI and API-log checks confirmed completion. The tested core flow preceded the cancellation-only repair; the repair has automated/independent review evidence, not native first-use-cancellation evidence.
- Limits: the API fabricated clearly labeled test results; this was not Whisper accuracy, real backend/worker integration, audible playback quality or human testing. No paid provider calls were made. Native first-use cancellation, physical-phone behavior and human review remain pending. Temporary API/PDF/audio/log files, installed dependencies and generated build output are excluded from the change. AI assistance and independent AI review do not constitute teammate approval. No merge is authorized.

## 2026-10-09 — automatic transcription publication review

- Request: publish the pending automatic-transcription changes to PR #19 and synchronize its dependent PRs without visual redesign changes. Codex preserved the staged snapshot and verified the existing remote head.
- Fresh verification: mobile `npm run check` passed TypeScript, lint and 125 tests; `npm run bundle:android` passed. Independent reviewer checked the complete staged snapshot against prior review evidence and found one disclosure-copy issue: upload precedes consent. Recording, saved-result and README wording now distinguish server upload from consent-gated provider processing; cancellation retains the server upload. No processing behavior changed in this correction.
- Review: no other concrete findings; staged sensitive-file scan and whitespace checks passed. Final wording correction is submitted for independent recheck. Prior Android and provider evidence above is unchanged; this publication check adds no new physical-device or provider claim. User authorized publication of the presented feature work; no merge into main or human teammate approval is claimed.

## 2026-10-09 — PR #20 dependency merge

- Codex merged automatic-transcription commit a0ee475 into the rehearsal-review branch using a normal two-parent merge. Conflict resolution retains the newer review cache, media validation, playback/lifecycle controller and API/deck/duration checks. The analysis hook receives the automatic-start flag after the existing identity parameters; the saved screen consumes the durable API-pinned intent before upload and preserves newer review state during asynchronous upload completion. No visual redesign code is included. Documentation retains both histories and distinguishes ordinary browsing from the one authorized capture handoff.
- Verification: `npm run check` passed TypeScript, lint and 219 tests; `npm run bundle:android` passed. Existing auto-capture/disclosure/cancellation and review playback/recovery suites ran together. No backend source changed. Independent staged merge-resolution review found no functional issues and passed 105 focused tests. Its eligibility-copy finding was corrected to include validated server history. The user approved this reviewed dependency resolution for publication and carry-forward into PR #21. This approval is not human teammate code review or new Android/provider evidence.

## 2026-10-09 — PR #21 dependency synchronization

- Codex carried user-approved normal merge 3abcf4b from PR #20 into the bounded-image-repair branch. Application code merged without conflicts, retaining the newer feedback panel, review/player/recovery controller and automatic-transcription safeguards. README and append-only AI-use histories required documentation conflict resolution; feature descriptions and both evidence histories are retained. No redesign changes are included.
- The repair commit f2657b9 passed the fresh backend/mobile checks above. Combined mobile `npm run check` passed TypeScript, lint and 288 tests; `npm run bundle:android` passed. Independent review found no functional issues and passed 144 focused tests. Its three documentation findings were corrected: consolidated current scope, explicit separate coaching, and historical labeling of the pre-automatic phone checklist. The user approved publication of the reviewed resolution and its carry-forward; no merge into main is authorized.

## 2026-10-08 — Light frontend redesign

- Contributor: Requester with OpenAI Codex assistance; no teammate approval claimed.
- Representative request: Implement the supplied light navy/coral Android prototype on the latest feature app, using Home/Practice and Overview/Slides/Transcript; omit unsupported controls and retain all recording, recovery and provider-consent behavior.
- Dependency: Isolated `codex/frontend-prototype` worktree created from refreshed `origin/main` (`f6f6e76`), then fast-forwarded to the explicitly selected `feature/ai-feedback` dependency (`a850424492843bf1ef19ddebd2643acefff2b9d6`) before UI edits. The original checkout and its unrelated edits were preserved.
- Incorporated work: Shared tokens, buttons, notices, icons, tabs and safe-area footers in `mobile/src/ui/components.tsx`; Expo Router tabs and library/utilities routes; extracted history loading/presentation under `mobile/src/features/home`; real PDF thumbnails; setup/recording/session-saved layouts; persistent review player and tab panels in `SavedAttemptScreen.tsx`; feedback presentation and retained description editor state in `FeedbackPanel.tsx`. Added SDK-compatible `@expo/vector-icons` and `expo-font` via Expo's installed compatibility data. No backend, contract or recording-format changes.
- Automated verification (Codex): Baseline `npm run check` passed 275 tests. Final redesign `npm run check` passed TypeScript, lint and **281 tests**; `npm run bundle:android` exported successfully. Extended checks cover Home recent limits/new imports/latest review, Practice's existing local/server reconciliation and API separation, import navigation fencing, durable-save completion, review-panel visibility and retained player, evidence routing, and drafts/conflicts across panels. Existing checks cover native recorder mocks, start/stop boundaries, repeated/backward/instantaneous visits, offline and missing media, upload recovery, partial transcripts, stale feedback, and uncertain-request confirmations. Browsing/tab tests assert no generation requests. New behavioral tests were observed failing before their corresponding changes where applicable.
- Native build (Codex): `JAVA_HOME=<installed JDK 17> ANDROID_HOME=<local SDK> EXPO_OFFLINE=1 npx expo run:android --device Medium_Phone --port 8084` built a debug APK successfully and installed/launched it on `emulator-5580`; Metro bundled the Android app. This proves build/install, not the interactive flow. An initial Expo command using the ADB serial instead of the AVD name failed selection. Android Studio's independent auto-sync used its default newer Java and failed Worklets configuration; the explicit JDK-17 command succeeded. Generated native/build files remain ignored.
- Agent-operated Android verification (October 8–9): Used the supported computer-use interface through Android Studio's embedded, task-created `Medium_Phone_2` emulator; no ADB taps or screenshots were used. Imported a synthetic three-slide PDF, entered audience context, confirmed slide navigation and the selected-page handoff, recorded a 26,867 ms attempt with visits 1 → 2 → 1, stopped, saw durable completion, and opened offline review. Playback continued across Overview/Slides/Transcript, and chronological visit selection sought to 17,643 ms / slide 2 and 22,609 ms / slide 1. Home and Practice retained the saved attempt and the earlier interrupted attempt. Record again waited for an explicit start. Compared the light layout against supported prototype screens at about 411dp width; also inspected Home/setup/review at 200% text, and Home/Practice/review at about 346dp (density 500). The large-text review tabs now wrap as whole controls, and player labels remain readable. Audience text entry and a floating keyboard were observed; normal docked-keyboard behavior remains unverified.
- Device-discovered corrections: Record again initially displayed the prior saved duration while ready; changed only the ready-state chip's source and extended the existing completion regression test (observed failing before the fix). Native reinspection showed 0:00. Adjusted review-tab wrapping and player button proportions/short visible seek labels after the narrow, large-text check; accessibility action labels and playback callbacks remain unchanged. Repeated `npm run check` and Android export after these corrections.
- Native limits: The first emulator exited with QEMU SIGSEGV during microphone preparation; its interrupted attempt was recovered on reopening. Restarting the task emulator with host audio disabled (`-no-audio`) allowed the silent capture/save/review flow above. This does not establish microphone or audible synchronization quality. No physical-device, live TalkBack, normal docked-keyboard, or new hosted-provider generation check was performed. Timed transcript/feedback evidence, provider retry confirmations, and missing-media failures are covered by automated tests, not newly claimed native-provider results. Android Studio's developer overlay is not part of the shipped UI.
- Independent AI review: A separate Codex reviewer found no concrete defects in the substantive staged patch (SHA-256 `8d5bc24e9158ff48548daa52433c22271f2a570f56aaabc8e7ce22d7b9a44d26`) and independently passed 116 affected behavioral tests. It separately reviewed the ready-timer correction and passed 25 recording tests (staged patch `9df95531a64856335f361c1a4d1ef4feaeea8a7da95fd2fd589a7b93a9a7efda`). The final large-text layout follow-up also had no concrete findings (staged patch `58ea18804e618461c95dd2faedd925036dae6d68db090671ca8d67d82ea4d8fb`); no duplicate tests were required for that style-only review. All reviews checked staged whitespace and working-tree/index agreement. The coordinator's final check passed all 281 tests, TypeScript/lint and Android export. Only this review-evidence sentence changed after the final independent review; native evidence above is coordinator-operated, not independently device-tested.
- Human final inspection/teammate review: Pending. No new commit, push or PR authorized or created for this redesign.

### 2026-10-09 — Slide visit labels in seconds

- User correction: Express the Slides tab's saved visit times in seconds instead of milliseconds. Codex changed only the displayed range in `SavedAttemptScreen.tsx`, dividing each endpoint by 1,000 and retaining fractional seconds. Stored timings, instantaneous-visit detection and seek callbacks still use the original millisecond values.
- Updated the existing rendered review assertion to expect `1–2 seconds`. `npm run check` passed TypeScript, lint and all 281 tests; `npm run bundle:android` passed. Agent-operated Android Studio emulator inspection confirmed the visible label `0–599.544 seconds` in Slides at the existing enlarged text setting. No new physical-device or provider check was performed.
- The two-line source/test change received a focused self-review and whitespace check; it is a presentation-only follow-up to the independent redesign reviews above. Human final inspection remains pending. No commit or push performed.

### 2026-10-09 — Grouped attempts and actual slide time ranges/totals

- Representative user request: Restore attempts grouped under the same presentation, and show the actual time ranges spent on each slide plus total time spent. Codex changed Practice presentation/order rendering in `historyPresentation.ts` and `LibraryScreen.tsx`, reusing existing identity-based history reconciliation. Groups sort by their latest attempt; attempts stay newest first within each group. Same-title presentations remain separate, local/server UUID deduplication and API scoping are retained, and attempts remain accessible without the original PDF.
- Slides now includes **Time by slide** in `SavedAttemptScreen.tsx`: all chronological visit ranges in seconds, and the sum of their integer-millisecond durations converted to seconds for display. Repeat/backward visits contribute to the same slide's total; instantaneous visits remain visible with zero elapsed time. Existing chronological visit controls, validated seek targets, recorder storage and provider-request paths are unchanged. Updated README to describe the resulting behavior.
- Verification: Focused regressions failed before implementation for split presentation cards and missing slide summaries, then passed. Both affected suites passed **94 tests**. `npm run check` passed TypeScript, lint and **284 tests**; `npm run bundle:android` passed. Tests cover group/attempt order, same-title identity separation, local/server reconciliation, missing PDFs, stale/API-scoped history, aligned and recorded-navigation ranges/totals, repeated/instantaneous visits, precise seeking, offline timing display without audio and GET-only browsing.
- Independent AI review: Separate Codex reviewer found no concrete findings in the staged follow-up or adjacent seconds-label conversion; independently passed 94 affected tests and staged whitespace/index checks. Reviewed full staged patch SHA-256: `3706a0ea8fc293fb1057fcce03fd568bec29e86423a4c4aba38c20333059e08e`. Only README and this evidence entry changed afterward, with coordinator accuracy/diff review.
- Agent-operated Android Studio emulator check: Observed grouped attempt rows within one presentation card and updated chronological visit labels in seconds at the existing enlarged text setting; opening a saved attempt and changing to Slides worked. The new per-slide summary totals were verified by rendered automated tests but not visually confirmed in the emulator during this follow-up. No physical-device, TalkBack, microphone/audio-quality or live-provider validation is newly claimed. Human final inspection remains pending; no commit or push performed.

### 2026-10-09 — Combined physical-device test setup

- Representative user request: Set up the physical phone to test the new UI, automatic transcription and AI feedback together. Codex combined the existing staged automatic-transcription implementation with the current frontend review controllers on `codex/frontend-prototype`, retaining deck/duration validation, synchronized playback, grouped Practice history, slide ranges/totals and separate explicit AI feedback. It also carried over the existing feedback source-error explanation from the staged feedback repair. The automatic-transcription and feedback source worktrees and the original checkout's unrelated edits were preserved. No commit/push was performed.
- New-capture handoff: durable checkpoint includes the selected API; review opens after save, consumes that intent before network I/O, uploads and requests initial transcription once after consent. Cancel, failed/uncertain processing, different API destinations, old captures and ordinary review operations retain explicit recovery. Adapted regression tests cover automatic navigation/upload/process, preserved source audio/events, disclosure cancellation including delayed reads, failed upload recovery, foreground/API scoping and no processing duplicates or feedback generation during tab changes/reopening.
- Checks: imported regressions reproduced the missing integration before implementation. `npm run check` from `mobile/` passed TypeScript, lint and **297 tests**. Android export passed. Independent Codex review ran the four affected suites (**148/148**) and established no runtime regression; it found stale manual-only/ambiguous upload wording in Home, review and docs. Those strings now distinguish automatic PDF/audio upload from consent-gated OpenAI transcription and retain the server-history eligibility clause. Final copy review is recorded below.
- Physical device setup: USB authorization initially failed; the user reconnected and accepted the phone prompt, after which the Galaxy S23 Ultra (SM-S918N) was authorized. `adb install -r` successfully installed the existing compatible frontend development APK without clearing storage; no new native dependency/config change was made. The combined Metro server on 8085 uses the existing live API on 8011, with both forwarded over USB. Android Studio's physical Samsung mirror visibly showed the redesigned Practice setup with a retained real deck and updated flow notice. Phone-originated deck/history GETs returned HTTP 200. API health/readiness passed against the existing PostgreSQL/Redis runtime, Celery worker ping returned pong, and secret-safe checks confirmed OpenAI credentials configured and feedback enabled with `gpt-6-luna`.
- Runtime boundary: Backend source remains the separate existing `codex/pr21-feedback-image-size` worktree, including its already staged bounded-image repair. Its API/worker/Beat and provider testing configuration were reused without code or quota changes. Setup made no new provider-generation request. The coordinator did not perform a new physical recording, listen to audio, validate live transcription/feedback quality or repeat emulator capture tests in this turn. Those human acceptance checks remain open. [Physical-device test steps](physical-device-test.md) document the combined session and short test path. Metro/API remain running for the user's test.
- Final review: independent reviewer confirmed all copy/contract findings resolved, no remaining findings, with reviewed staged SHA-256 `fef2543938aeda23e3797f15ccefab0b4b9290c44c0fd30deba6fb5f4cebc497`. Runtime code is unchanged from its 148-test review; coordinator reran those 148 affected tests and Android export successfully after the final wording correction. Only this task-level evidence entry changed after final review and received coordinator accuracy/diff inspection. Human final inspection remains pending before any commit/push.

## 2026-10-09 — swappable frontend extraction (Refactor Design)

- Request/tool: user-approved plan implemented by Codex; independent reviewer handled staged feature patches and dependency resolutions. Preserved the original staged frontend binary patch/index tree and a second full file snapshot before reconciliation. Renamed the local branch to `codex/refactor-design` and fast-forwarded its dependency to PR #21 `ce9f248`, then reconciled the UI snapshot. Functional changes now belong to published #19 `a0ee475`, #20 `3abcf4b`, and #21 `ce9f248`; no frontend publication or main merge occurred. Original checkout unrelated edits remain untouched.
- Incorporated material: layout registry and type-only model contracts, Refactor Design screen views/tokens/navigation, shared library/setup/capture/review/feedback/utility/preview controllers, native surface bindings, guarded setup/visit callbacks, persistent review validators/player and feedback drafts, layout-provided evidence reveal callback, startup configuration and production rejection of the alternate layout. Development `contract-test` changes navigation and moves review transport above content. Layout import audit blocks integration/native-state imports and direct network/dynamic integration calls. No backend, wire, database or recording-format changes for swapping.
- Baseline: before extraction, `npm run check` passed 297 frontend tests. Each main extraction boundary passed the existing 297 tests. After selection/import enforcement and alternate arrangement assertions, Refactor Design `npm run check` passed TypeScript, lint/boundary audit and 299 tests. The library harness now waits for async catalog I/O admission before asserting requests, instead of assuming a single event-loop tick; a timing-dependent failure was observed in the alternate-layout run and retained assertions were rerun after correction.
- Final automated verification: `npm run check` passed TypeScript, lint/import-boundary audit and **300/300 tests**. The same suite with `NODE_ENV=test EXPO_PUBLIC_UI_LAYOUT=contract-test` passed **300/300**. `npm run bundle:android` passed. Both layouts cover confirmed-page handoff, durable save/automatic transcription, cancellation and retries, grouped history, playback/evidence, retained drafts/conflicts, offline/missing media, and zero generation during browsing/selection. These are automated scenarios, not claims that each was repeated on a device.
- Independent staged review: a separate Codex reviewer passed 156 focused tests in each layout and found a missing Help route in the alternate shell plus two documentation issues. Added Help, a navigation reachability/no-requests regression, clarified upload-before-consent wording, and labelled the earlier phone checklist as historical. Independent recheck passed all three navigation/boundary tests in each layout, found no remaining findings, and confirmed working-tree/index agreement and clean staged whitespace. Reviewed patch SHA-256 `c6e8a1e746f74bd5c4a0adbae58220e35832861b204736350030ff698e51805c`; final full checks above passed on that code. Only this verification entry changed afterward, with coordinator accuracy/diff review.
- Agent-operated physical Android check: on the authorized Galaxy S23 Ultra, Refactor Design opened an existing six-slide PDF; page 2 was visibly confirmed before the recording handoff. A new native capture visited slides 2 → 3 → 2, stopped, durably saved and automatically opened review/upload/initial processing without Upload or Analyze taps. Backend metadata confirmed 21,802 ms, with zero-based events `(0, 1)`, `(12377, 2)`, `(16856, 1)`: human slide 2 ranges 0–12.377 and 16.856–21.802 seconds, total 17.323 seconds; slide 3 range 12.377–16.856 seconds, total 4.479 seconds. Overview displayed the corresponding rounded totals. API logs contain one attempt-upload POST and one process POST for this capture; review navigation added only reads. Playback retained Pause intent and advanced across Slides and Transcript. The no-speech result and untimed/empty transcript fallback rendered honestly; saved slide descriptions were reachable.
- Provider boundary: the real local PostgreSQL/Redis/Celery runtime completed the no-speech gate. No speech was deliberately supplied, and this result sent no audio to OpenAI. No new feedback-generation action was taken. This verifies physical capture/save/handoff and real worker integration, not Whisper accuracy, audible synchronization or AI advice quality. Earlier live feedback evidence belongs to its separately recorded revision; it is not rerun evidence for this extraction.
- Agent-operated emulator check: `contract-test` loaded from a separate Metro server after a development-client restart. At approximately 346dp width and the retained 200% text setting, Home/Practice/Help navigation worked, grouped history remained available, and a retained local rehearsal opened with transport above content and review tabs below. Play → Slides → Transcript retained Pause and advanced to four seconds; explicit pause stopped at eight seconds. Wrapped navigation/tab labels remained reachable. No upload or generation action was taken. A stale black app activity was recovered without clearing data; Metro asset-resolution timeout warnings did not prevent rendering. This check reuses an existing silent recording and is separate from the physical capture above.
- Remaining acceptance limits: fresh physical PDF import, human speech/transcript/feedback quality, audible playback, live TalkBack, and normal docked-keyboard behavior were not newly verified. Native conflict/cancellation/missing-media cases retain automated coverage and their earlier revision-specific records. Existing compatible development APKs were used; the successful JS export is not a new native compilation claim. User final frontend inspection remains pending; AI review is not teammate approval. Frontend changes remain staged locally on `codex/refactor-design`, with no frontend commit/push or merge into main.


## 2026-10-09 — Iteration 1 demo preparation

- Request/tool: user asked Codex to create a reproducible `iteration-1-demo` branch, record a simple physical-phone video and write setup instructions. The user specified no captions and asked that the video retain their voice.
- Branch preparation: verified live `origin/main` at `f6f6e76` and no remote demo branch; created an attached isolated worktree from that base, created the requested branch and fast-forwarded its functional dependencies to `ce9f248`. Copied the reviewed UI staged patch from `codex/refactor-design` (SHA-256 `542f11d3a3e08184370e0cf180f365f3ee52fb5ca0942c43c699f3dd6d3023a3`). The original worktrees and unrelated changes were preserved. No new application behavior was added.
- Incorporated material: README demo entry, branch-specific setup and simple feature walkthrough in `docs/iteration-1-demo.md`. The instructions explain actual upload/disclosure order, dependencies and unsupported later features. Separate independent AI review found no introduced code defect, independently passed all 300 mobile tests and the layout boundary audit, and checked staged/worktree agreement. Documentation review caught the stale Node minimum (tests need newer module hooks); the demo instructions now require Node 24 LTS. The historical phone link was replaced with the demo setup link.
- Coordinator verification: locked `npm ci` succeeded in the new worktree; `npm run check` passed TypeScript, lint/layout-boundary audit and 300 tests; `npm run bundle:android` passed. Host verification used Node v26.8.2/npm 11.19.1. Backend system check, 277 SQLite tests (18 PostgreSQL-only skips), and migration-drift check passed using the existing project Python environment. Local Markdown links and staged whitespace passed. No new native APK or fresh Docker-image build is claimed. The existing compatible native client has matching app config and package lock.
- Phone runtime: authorized physical Galaxy S23 Ultra; Metro serves this demo worktree on 8085 and API serves this demo backend on 8011, both forwarded over USB. Existing phone-test PostgreSQL/Redis/media were reused without clearing app data; this machine’s session-specific port configuration is not required by the clean-clone Docker recipe. API readiness verified database and broker access. Automatic approval review initially blocked worker startup; read-only checks showed all older jobs completed and an empty queue, then the user explicitly approved OpenAI Whisper audio and OpenAI gpt-6-luna slide/transcript/audience processing with possible API charges for this demo. Worker startup succeeded after that approval.
- Capture status: video and concurrent microphone test still pending. The phone app rendered after reloading from the new Metro source. Android Studio’s unrelated old-project Gradle auto-sync failed under its existing Java configuration; it was not used to build this snapshot. Samsung’s screen recorder is selected for voice-inclusive recording; simultaneous OutLoud/audio capture still needs verification.
- Human final inspection/teammate review, final recording inspection and publication remain pending. No new commit, push or merge performed.

- User handoff correction: the user chose to operate Samsung’s screen recorder themselves and asked Codex only to set up OutLoud. Codex left the app/runtime ready and did not start a video or microphone test. Video receipt, sound/content verification and the README video link therefore await the user’s recording. Final documentation recheck resolved the Node/link issues with no remaining findings; reviewed staged SHA-256 before this handoff-only note was `f317aa19ea3a5b8d007e8c7d6837bd6e2c47cc366e447998f455bd41300abff2`.


## 2026-10-10 — Supplied demo video and README structure

- Request/tool: the user supplied `Screen_Recording_20261009_235818_OutLoud.mp4` and asked to follow the README structure of [Team 07's 2025 Iteration 1 branch](https://github.com/snuhcs-course/swpp-2025-project-team-07/tree/iteration-1-demo). Codex read that README as a structural reference, then reorganized ours into overview, stack, prerequisites, setup, walkthrough, local API details, demonstrated scope, video and verification. Project facts and commands come from this branch; the reference project's implementation/deployment claims were not copied.
- Incorporated material: replaced the long historical checkpoint narrative in `README.md` with the branch-specific guide and links to existing detailed records. Added `docs/demo/iteration-1-demo.mp4` and the unchanged `Neural_Networks_7_Slides.pdf` used in the recording. Updated `docs/iteration-1-demo.md` with actual media metadata, approximate feature coverage and inspection boundaries. No application code or runtime configuration changed in this follow-up.
- Media packaging: retained the user's original 106,093,952-byte video outside Git. Used local PyAV/H.264 encoding to make a 46,755,345-byte, 720 × 1544 repository copy with all 18,448 video frame timestamps and the 401.876-second duration preserved. The 18,820 AAC packet payloads were copied unchanged and matched by SHA-256. No captions, cuts, speed changes or new audio were added. Original SHA-256: `b417462c4385b2f35530201b493fe25ea2558bceb1af4c208f69d560dec8f905`; packaged SHA-256: `2d59cd6dd9db669cef0f0a68301316527fbd96ef549a468787b419e625919551`.
- Inspection: decoded both complete video streams, sampled 51 frames across the timeline and checked selected compressed frames for readable UI text. Observed the new neural-networks capture, completed transcription, timing/visit summaries, playback/seek states, completed feedback, supporting quotes/evidence and grouped attempts. Description editing/regeneration and offline/error recovery were not shown. The first minute contains an older no-speech attempt, separately identified in the README. The seven-page demonstration PDF was checked with pypdf and visually reviewed using PDFKit; the original file is unchanged.
- Audio boundary: the AAC track is present and unchanged; a 16-second sample during capture has nonzero decoded audio. The available review interface did not support audio input, so Codex did not listen to or certify voice clarity, simultaneous-microphone behavior or audible synchronization. Visible transcript/feedback completion is not a transcription-accuracy or advice-quality evaluation.
- Review/verification: documentation and media received coordinator accuracy, local-link, anchor and staged-diff review; the final check result is recorded below. Earlier independent code review, 300 passing mobile tests, Android export and backend checks apply to the unchanged application source; no application rebuild was required for this follow-up. Human final inspection and teammate review remain pending. No commit, push or merge performed.
- Final documentation/media checks: all 41 relative links and Markdown anchors in the three changed documents resolved; `git diff --cached --check` passed. The mobile patch is byte-for-byte identical to the previously reviewed snapshot, the packaged video hash matches its verification record, the copied PDF matches its original, and the working tree matches the staged snapshot. The final evidence-only sentence was self-reviewed and restaged. No secrets, local environment files, native build outputs or unrelated recordings were added.


## 2026-10-10 — Demo publication authorization and final inspection

- User decision: after reviewing the main-flow coverage and the implemented features omitted from the recording, the user accepted the current video and explicitly requested: “im fine with showing the main flow. commit and push”. This authorizes publication of the prepared `iteration-1-demo` branch; it does not imply teammate code approval or authorize a merge into `main`.
- Pre-publication inspection: live remote `main` remained `f6f6e76605632296a802aecef25ac10c6d0fd0cd`, and no remote `iteration-1-demo` branch existed. Inspected the 16 inherited commits through `ce9f248256b1bbfc0d66f139886503261cc25953` and their retained implementation/review evidence. Existing review and test results are reused because the final mobile patch is byte-for-byte identical to the reviewed snapshot and backend source is unchanged. The recorded 300 mobile tests, Android export and 277 backend tests (18 SQLite skips) passed; they were not unnecessarily rerun for publication-only documentation changes.
- Final checks: 41 relative links/anchors resolved, staged whitespace passed, video/PDF hashes matched the inspected files and index/working-tree contents agreed. Scanned 370 text blobs across inherited outgoing history and staged additions for credential patterns; no matches or unintended local environment/generated paths were found. This bounded pattern scan is separate from the substantive reviews recorded above.
- Final publication preparation changed only this approval/evidence entry and removed the obsolete pre-publication caveat from the clone instructions. Both received focused accuracy/diff review and were restaged. The user's original recording and other worktrees remain unchanged. The next action is a normal commit and push of `iteration-1-demo`; no force push or main merge is authorized.
