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


## 2026-10-09 - Design documentation and course-reference benchmark

- Tool/contributor: OpenAI Codex assisted the requester. This is documentation self-review, not independent AI review, human teammate review or course approval.
- Representative request: Implement the approved English wiki-ready design draft, matching PDF and comparison report; inspect all four previous-year examples and the current guideline; distinguish main, PRs #17-21, incorporated #13 recording work, staged local redesign and planned requirements; omit reverted/mistaken PR ranges from document revision history.
- Scope: New `Design-Documentation.md`, `Design-Comparison.md`, `docs/design-source-snapshot.json`, six supporting SVG figures, reproducible documentation-only Python tools and `output/pdf/OutLoud_Design_Documentation.pdf` with build/check manifests. No application API, behavior or dependency change. Created isolated `codex/design-documentation` at main `f6f6e76605632296a802aecef25ac10c6d0fd0cd`; original checkout and staged `codex/refactor-design` preserved.
- Incorporated material: Source-backed architecture and rationale, actual Django/SQLite data design, routes and field contracts, capture/timing/recovery, independent descriptions/coaching, frontend state/layout boundaries and proposed remaining scope. The four course examples informed documentation quality only. All major diagrams include status, purpose, interactions and surrounding explanation. Main source is PR #21 `ce9f248256b1bbfc0d66f139886503261cc25953`; complete revisions/source hashes are in the snapshot. The PR #13 acknowledgment describes incorporated work, not a claim that its head is a Git ancestor of #17.
- Document verification: Generated the 19-page PDF from Markdown using ReportLab; inspected all Poppler-rendered pages and diagram details. Browser-rendered all six Mermaid figures at 760 CSS pixels. Checked 41 link occurrences including pinned source paths/anchors, five parseable JSON examples, shared diagram definitions, PDF text parity windows and 36 link annotations. PDF character bounds check found no text outside page safety bounds. `check_design.py` records the final result in `output/pdf/document-checks.json`; `git diff --check` covers the modified log, with a separate whitespace check for new documents/tools.
- Corrections: Fixed Mermaid semicolon syntax, timing-interval Markdown parsing and PDF pagination. Clarified edit versus generation revisions, partial data and stopping conditions. Flagged the requirements' pre-upload disclosure wording versus current backend-upload-before-transcription-consent flow for human reconciliation. No product requirement was silently rewritten.
- Preservation and boundaries: Local redesign staged-diff SHA-256 remains `542f11d3a3e08184370e0cf180f365f3ee52fb5ca0942c43c699f3dd6d3023a3`; original task's modified AI-use log and untracked files are untouched. No application build, fresh application/device/provider testing, evaluation, commit, push, merge, wiki publication or eTL submission was performed. User/team final inspection and decisions remain pending.


## 2026-10-09 - Simplified, diagram-focused design revision

- Request and tool: The user asked Codex to refocus the 19-page draft on architecture and interactions, retain six diagrams, reduce auditing/API repetition, follow the nine specified sections, and use plain Arial or Times New Roman. Work continued on `codex/design-documentation`; no new worktree or application branch was created.
- Incorporated edits: Rewrote `Design-Documentation.md` to explain component responsibilities and decisions around the diagrams. Established implementation scope once; replaced field/error catalogues with endpoint groups and one upload request/response example; retained word-start alignment, durable jobs/recovery, description reuse/invalidation, evidence validation and controller-owned state. Detailed material remains in supporting contracts and the source snapshot. Updated `Design-Comparison.md`, diagram definitions/SVGs and the PDF build/check scripts.
- Presentation: The PDF is now 12 pages with Arial regular/bold throughout, including the JSON example. Removed colored branding and Courier fragments. Retained all six diagrams, simplified workflow messages and reduced unused diagram spacing without reducing their font size. Removed explicit page-break logic; kept each diagram with its first explanation and the example request/response together. Non-diagram text decreased from about 5,820 to 2,917 words using the same count method, excluding link targets.
- Document verification: `build_design_pdf.py` generated the PDF successfully. `check_design.py` passed 34 link occurrences, two JSON blocks, six shared diagram definitions, complete text-window parity and 30 PDF link annotations. All 12 Poppler-rendered pages were inspected, including figure details. All six Mermaid diagrams rendered successfully in the local browser at 760 CSS pixels. PDF inspection found only Arial regular/bold characters and no text outside page safety bounds. No application builds, device checks or provider calls were performed.
- Preservation/review: This is self-review, not human teammate approval. The source redesign's staged-diff fingerprint remains unchanged, and the original checkout's existing modifications were preserved. Application source is unchanged; nothing was staged, committed, pushed or published. The earlier 19-page record above describes the preceding draft; this entry records its requested revision.


## 2026-10-09 - Phase 1 diagram redesign for approval

- Request/tool: The user asked Codex to redesign six architecture, database and sequence figures using diagrams.net, dbdiagram.io and mermaid.live, and explicitly prohibited Phase 2 text revision until diagram approval. This entry records documentation self-review, not independent or human approval.
- Incorporated material: Added `docs/diagram-review/` with an HTML gallery, per-figure explanations/source links, editable draw.io/DBML/Mermaid sources, SVG/PNG exports, browser evidence and source/check manifests. Created `output/pdf/OutLoud_Diagram_Review.pdf` (eight large digital pages) and `output/diagrams/OutLoud_Diagram_Review.zip`. Figures 4 and 5 each use two panels for legibility. Existing Design Documentation Markdown/PDF, comparison and old figures were not replaced.
- Evidence and corrections: Rechecked main and open PRs #17-21, read PR21 source at `ce9f248256b1bbfc0d66f139886503261cc25953` and local staged `codex/refactor-design`. Separated synchronous upload/PDF preparation from worker processing and Beat scheduling from worker recovery. Checked real ER keys/cardinalities and revision dependencies, API-scoped known-attempt polling, consent, durable save/retry, word-start alignment, cached descriptions, evidence checks and stale feedback. Flagged pre-upload requirement wording versus implemented post-upload provider disclosure. No implementation behavior changed.
- Browser work: Created/revised and inspected architecture/frontend figures in diagrams.net. Both ER schemas were rendered in dbdiagram.io; its export required sign-in, so retained DBML/browser evidence and exported clearer annotated layouts via diagrams.net. Rendered all four sequence panels in mermaid.live. Normalized SVG export bounds/lifeline ends and inspected the final browser output. Arial is used throughout.
- Verification: All eight final browser panels and all eight `pdftoppm` PDF pages visually inspected. XML/PNG checks, gallery links, PDF titles/page numbers/link targets and 35 code references passed; results are in `docs/diagram-review/verification.json`. An initial PDF-annotation count assertion was corrected to compare URI targets because wrapped source links create multiple annotation rectangles. No application build/device/provider test was run.
- Preservation/approval: SHA-256 checks confirm the main Markdown, existing PDF and comparison are unchanged. The local redesign staged diff remains `542f11d3a3e08184370e0cf180f365f3ee52fb5ca0942c43c699f3dd6d3023a3`. The original checkout's unrelated changes remain untouched. Nothing was staged, committed, pushed or published. Diagram approval is pending; Phase 2 has not begun.

## 2026-10-09 - Phase 2 design documentation revision

- Tool: Codex with local shell/file inspection, browser inspection, GitHub read-only API access, and the PDF and Stop Slop skills. No independent reviewer agent was required for this documentation-only scope.
- Representative requests: revise the documentation around the approved Phase 1 diagrams; inspect actual repository/PR/local code; keep implementation status distinct; preserve application code; make Markdown the primary source; generate and visually verify the PDF; do not commit, push or publish.
- Incorporated material: Rev.3.0 `Design-Documentation.md`, six approved figures/eight panels integrated with captions and explanations; updated comparison/discrepancy report; source snapshot; Markdown-driven PDF/HTML/Wiki build and document-check scripts; bundled SVG/PNG/editable assets. Original diagram source/SVG files were not redesigned or changed.
- Source boundary: main `f6f6e766`, PRs #17-21 open through `ce9f2482`, and local staged `codex/refactor-design`; remote states checked during this task. Read models, routes, services, contracts, frontend hosts/layout contracts, current Wiki requirements and the course guidelines. Reopened Team 07's course reference; retained the prior four-example benchmark rather than claiming a new diagram-by-diagram review of all examples.
- Verification: `build_design_pdf.py` produced 11 pages from the primary Markdown without modifying it; `check_design.py --source-repo <integration worktree>` passed. It checked 24 source-link occurrences/22 distinct paths at the linked revision, two JSON examples, anchors, local assets, Wiki text parity, PDF text parity, all eight embedded image pixels, Arial text and page bounds. All 27 public source/reference URLs returned HTTP 200. The local browser loaded all eight SVGs; Poppler renders of all 11 pages were inspected. A3/A2 figure pages preserve the approved diagrams' label sizes.
- Repairs during document checks: removed a near-empty spill page and fixed large-page header positioning. An initial extracted-PDF image comparison failed; inspection found Phase 1 browser captures with JPEG bytes under `.png` names and extraction re-encoding. Exported raster copies were normalized to true PNG with unchanged decoded pixels, after which the strict pixel comparison passed. Phase 1 originals remain untouched.
- Preservation: primary, integration and frontend HEAD/status/staged/unstaged snapshots matched before/after; all Phase 1 package file hashes matched. Only intended documentation files and generated documentation outputs were copied to `codex/design-documentation`. No application build, device check or provider test was run.
- Human direction incorporated: treat the completed diagrams as the visual baseline; Markdown is authoritative. The final text remains pending the user's inspection. No human technical approval, commit, push, PR, Wiki publication or eTL submission is claimed.
- Outstanding: NFR-05 pre-upload disclosure differs from current timing; automatic-processing scope differs from explicit coaching; private access/deletion remain planned; the older scope map calls now-implemented saved-review work deferred. Proposed resolutions are recorded without modifying Requirements or Testing Documentation. Wiki asset URLs become live only after authorized publication, followed by a live rendering check; PNG fallbacks are included.


## 2026-10-09 - Proposed Wiki design documentation PR

- Authorization/tool: The user requested a design documentation PR and upload, clarified the Wiki destination, then clarified “dont publish just put it out as pr.” Used Codex with Git/GitHub CLI and browser inspection. This is documentation self-review, not independent or human teammate approval.
- Publication correction: The Wiki update had already been pushed as `449db72299d4e6595388aa7429d90c0aee708000` when the PR-only clarification arrived. Reverted only that update in `0856f77992e8783905bb62a57fe7eae9ed453ff1`; the remote Wiki tree now matches prior revision `411ce5d` exactly. The publication and revert remain in history. No further Wiki publication is authorized.
- Incorporated material: The repository PR proposes the Wiki replacement through authoritative Rev.3.0 Markdown, unchanged PDF, approved SVG/PNG/editable assets, comparison report, source snapshot, document-check evidence and current build inputs. README links make the proposal discoverable. Historical renderers, local review galleries and scratch outputs remain uncommitted. GitHub Wikis do not provide a native PR workflow; merging this repository PR will not publish the Wiki.
- Verification: GitHub main and open PRs #17-21 still match the recorded revisions. `check_design.py --source-repo <integration worktree>` passed without errors: 24 source-link occurrences, two JSON examples, eight approved image panels, PDF text/pixel parity, Wiki text parity, Arial and page bounds. Reused prior visual PDF review because the export bytes are unchanged. All eight SVGs loaded during the reverted Wiki publication and its architecture/navigation were inspected; this is historical rendering evidence, not a claim that the new Wiki page remains live. Current evidence is in `docs/design-document-checks.json`.
- Boundaries: Application code, requirements, testing documents and unrelated worktrees remain unchanged. No application/device/provider test, human technical approval, merge, deployment or eTL submission is claimed. The document retains its review-draft label and merged/unmerged/local/planned distinctions.
- Pre-commit self-review: all 64 staged files matched their working copies; staged whitespace, repository-local links, XML/JSON parsing and credential-pattern checks passed. The Markdown hash, approved Phase 1 files, PDF bytes and unrelated primary/integration/frontend worktree fingerprints remain unchanged. The staged scope contains no mobile/backend code.


## 2026-10-09 - Rev.4.0 clarity rewrite and PR #23 update

- Request/tool: The user asked Codex to rewrite only the design Markdown as a developer-facing system design document, preserve all eight diagram images, remove audit/status/reference material, and shorten the text. After inspection, the user said "looks good commit and push onto pr 23." This authorizes the repository update, not Wiki publication or merging.
- Incorporated material: Rev.4.0 `Design-Documentation.md` uses seven sections, explains subsystem responsibilities and rationale, simplifies API/recovery/controller detail, and retains database relationships, word-start alignment, description caching/invalidation and evidence-linked coaching. References, Planned Extensions, source links and Markdown implementation-status commentary were removed. Three subsequent wording edits in the working file were preserved and reviewed before staging.
- Verification: Fresh Markdown checks passed for the current source SHA-256 `549fb2d5af9df9515b3c8800b1d5dc2688e73456e1704a2310e9b3752d4bd771`: eight unchanged image embeds and SVG bytes, seven required sections, six valid contents anchors, all 12 documented route paths matching the reviewed integration source, excluded-content checks and `git diff --check`. Visible text decreased from 3,017 to 2,091 words (30.7%) under the same counting method. Reused the previous source/model/algorithm review for unchanged content; the latest wording still describes intended automatic processing, while actual admission remains consent-controlled.
- Review boundary: Documentation self-review only; no independent review agent or fresh application, Android/device or provider tests were required. The requester approved the rewrite for commit/push; no human teammate technical testing or course approval is claimed. Changes are limited to the Markdown and this required AI-use record. Application files, diagrams, other worktrees and unrelated untracked files are preserved.
- Known limitations: The PDF, HTML, comparison, source snapshot and export/check manifests remain from Rev.3.0; they do not establish parity with Rev.4.0. Six preserved SVGs retain embedded status labels. Pre-upload disclosure timing differs between requirements and the inspected client. Iteration 5 still needs two detailed code-backed pattern analyses. These limitations were reported outside the design document; no requirements or application behavior changed.

## 2026-10-09 - Iteration 1 features, technologies and transcription limitations

- Request/tool: The user asked Codex to add how each attempted feature is implemented, what worked and what did not at Iteration 1. The user reported poor real-voice recognition, including non-words, with both local and API Whisper. Incorporated that qualitative human finding without inventing a measured error rate, a diagnosis, a model ranking or a fix.
- Incorporated material: Rev.4.1 adds Section 8 to `Design-Documentation.md`, with eleven feature/technology rows grouped into capture/storage/review, speech processing, and feedback/frontend. It distinguishes the merged baseline, unmerged integrated features, earlier local-Whisper prototype and local layout redesign once; records prior observed behavior and known limitations; and explains how recognition errors can propagate through timing alignment and text-based evidence validation. Existing sections and all eight diagram embeds are preserved, apart from the revision header/history and contents entry.
- Evidence reviewed: GitHub main remains `f6f6e76605632296a802aecef25ac10c6d0fd0cd`; PRs #17-21 remain open, with #19 at `a0ee4755fb6f9a56c77fd967bdd83d1f7a37c400`, #20 at `3abcf4b6c97bbd6ef2da6cfd6d40670b4dbfca88`, and #21 at `ce9f248256b1bbfc0d66f139886503261cc25953`. PR #23 remains at `65e40174980dd9c7a08cfa8d62c3d93f07e59cfb`. Read the integration README, API contract, handoff, work-division notes, feedback evaluation and existing AI-use records; checked PDF/storage/recording, hosted transcription, alignment/metrics and feedback validation source. Read the preserved prototype's CPU INT8 faster-whisper source and documented synthetic/mixed-language results, plus the staged frontend's layout contracts and verification record. Excluded superseded PRs from the document's revision history.
- Verification: Documentation self-review and `git diff --check` passed. A fresh Python check verified eleven table rows, seven valid contents anchors, all eight unchanged image embeds, unchanged existing body text, and byte preservation of every tracked file except the two intended documents. HEAD, staged diff, working diff and status of the three other inspected worktrees matched their before-edit snapshots. Current Markdown SHA-256: `37835e41431c378e828c9ec2c9045934cad25f770a82ac43a9691939a2612c41`. Existing feature results are historical source-backed observations, not newly rerun application checks. The latest human report supersedes a blanket pending status for recognition quality: both approaches have an observed unresolved problem, though its extent and cause remain unmeasured. Detailed test procedures/results remain in supporting documentation.
- Boundaries: Only the design Markdown and this task-level AI-use record are edited. No application, device or provider tests were run, and no private recording was read or uploaded. Application files, diagrams, existing exports and other worktrees (including staged frontend changes) are preserved. PDF/HTML remain Rev.3.0 and are not claimed to match Rev.4.1. This request did not authorize a new commit, push, Wiki publication or merge; the addition remains for user inspection.

- Publication follow-up: The user subsequently said "push on pr", authorizing commit/push of this reviewed addition to existing PR #23. Rechecked the open PR and matching branch head, reviewed the two-file diff and reused the preceding source review for unchanged text. The final staged snapshot is checked for contents anchors, table structure, unchanged diagrams, working/index agreement and whitespace before commit; no application/device/provider test is added. Wiki publication and merge remain outside this authorization.


## 2026-10-09 - Rev.4.1 submission PDF export

- Request/tool: The user asked Codex to turn the design document into a submittable PDF, preserve the existing font/plain style, and then add colored table boundaries. Used the PDF skill, bundled Python/ReportLab, pypdf, pdfplumber and Poppler. Neutral gray table rules implement the clarification; white cells and black Arial text preserve the document style.
- Incorporated material: Exported the unchanged authoritative Rev.4.1 Markdown to `OutLoud_Design_Documentation.pdf` and its matching `output/pdf/` copy. The PDF has 13 pages, embedded Arial, seven internal contents links, and all eight approved diagram panels. Kept the established A4 text/A3 diagram/A2 long-sequence page sizes to preserve label readability. Updated PDF metadata and headers to Rev.4.1. No new feature design, prose revision, diagram edit or application implementation was made.
- Verification: `python /private/tmp/outloud-pdf-rev41/check_pdf.py` passed with no errors after correcting an overbroad Markdown-link matching expression in the temporary checker. Verified full Markdown/PDF text parity, eight pixel-identical embedded images, seven valid internal PDF destinations, embedded Arial, page numbering, margins, black text and 0.4 pt gray table rules. Rendered the final PDF with Poppler and visually inspected all 13 pages for table wrapping, complete diagrams, captions and clipping. Source SHA-256 `37835e41431c378e828c9ec2c9045934cad25f770a82ac43a9691939a2612c41`; PDF SHA-256 `2530e1b77d98b093c000a63d146caa387b7cb3dbdf1eb3fca6143e20790374c3`.
- Boundaries: Formatting/export verification, not a claim of complete course/content compliance. The five proposed Iteration 2 designs remain absent, and the existing Iteration 1 outcomes section is preserved. No app/device/provider testing, staging, commit, push, Wiki publication or eTL submission. Markdown, source diagrams, application files, existing staged work and unrelated files are preserved. The prior PDF is backed up under `/private/tmp/outloud-pdf-rev41/previous-export/`. HTML/Wiki exports and tracked Rev.3.0 build/check tooling were not changed; this PDF-only export used the temporary adjusted exporter, with its matching manifest/checks saved under `output/pdf/`.


## 2026-10-09 - Rev.4.2 separates testing outcomes from design

- Request/tool: The user requested the PDF again without its final section because course guidelines place testing plans/results in separate documentation. Codex removed Section 8, "Features and Technologies Attempted in Iteration 1," and its contents entry from the primary Markdown, recorded Rev.4.2, and exported a matching 10-page PDF with the existing Arial font and thin gray table borders. The removed content remains in committed Rev.4.1 and `/private/tmp/outloud-pdf-rev42/Design-Documentation-Rev4.1.md`; it was not represented as newly incorporated into a Testing Documentation page.
- Verification: `python /private/tmp/outloud-pdf-rev42/check_pdf.py` passed with no errors: complete Markdown/PDF text parity, eight pixel-identical approved diagram panels, six working internal contents links, embedded Arial, page numbers, margins and table styling. Rendered all 10 pages with Poppler. Visually inspected the changed first page and final page; page bodies 2–10 are pixel-identical to the preceding fully inspected export, excluding updated revision headers. Sections 2–7 are byte-identical to the preceding Markdown. Source SHA-256 `4bcd78c78c46c6c96dd17b17821d7610825727a56b0ef2a95f15824ed9620a55`; PDF SHA-256 `ea75524b6cc096f2f5f5e90bcaa1f75b87c72245688162050b170cb54c43bf90`.
- Boundaries: The final PDF is `output/pdf/OutLoud_Design_Documentation.pdf`. The root PDF was already absent when this request began; its pre-existing deletion is preserved. Only the primary Markdown, this appended AI-use record and ignored PDF outputs were changed. Application files, original diagrams, other worktrees, HTML/Wiki exports and tracked build tools are unchanged. No application/device/provider tests, staging, commit, push, Wiki publication or eTL submission. The separate five-feature Iteration 2 design discussion remains outside this removal/export task.


## 2026-10-09 - Remove testing outcomes from PR #23

- Request/tool: The user clarified "remove only the testing-outcomes addition" after GitHub inspection established that it was commit `261559a` within the broader design-documentation PR. This authorizes publishing the correction to existing PR #23, keeping that PR open and retaining the rest of its documentation. Codex uses a normal follow-up commit; no shared history is rewritten.
- Incorporated material: Publish the already-reviewed Rev.4.2 Markdown removal, its contents/revision updates, and this append-only AI-use record (including the preceding local PDF-export records). Historical outcome evidence remains in Git history and existing supporting documentation; it is no longer a section of the design document. The PR title/description are updated to describe the resulting seven-section design.
- Verification: Fresh documentation self-review confirmed seven sections, six valid contents anchors, eight unchanged image embeds and SVG bytes, and exact preservation of design sections 2–7 against both Rev.4.0 and the preceding Rev.4.1 body. Markdown SHA-256 is `4bcd78c78c46c6c96dd17b17821d7610825727a56b0ef2a95f15824ed9620a55`. The exact staged two-file diff, staged/working agreement, whitespace and outgoing commit scope are checked before commit/push. No application/device/provider tests are needed or claimed for this removal.
- Boundaries: Only `Design-Documentation.md` and `docs/ai-use.md` are included. The pre-existing local root-PDF deletion stays unstaged; local Rev.4.2 PDF output is not published by this commit. The PDF/HTML already in the PR remain Rev.3.0. Original diagrams, other worktrees and staged feature work are preserved. No fabricated teammate approval, Wiki publication, merge or eTL submission; requester authorization is distinct from human technical review.


## 2026-10-09 - Rev.4.3 planned design beyond Iteration 1

- Request/tool: The user requested a local revision from Rev.4.2 covering the intended product and mandatory work beyond Iteration 1, with updated editable diagrams, a matching PDF and `team7-iter1-design.pdf`. Codex used repository/GitHub read-only inspection, browser interaction in diagrams.net and Mermaid Live Editor, the PDF and Stop Slop skills, and the existing Python documentation workflow. This is documentation self-review; no independent reviewer or human technical approval is claimed.
- Incorporated material: Updated the authoritative `Design-Documentation.md` to Rev.4.3 with a living-document scope, one status legend, nine mandatory story mappings and NFR-05. Added proposed speech summaries, delivery analysis, selected-slide rehearsal/comparison, deletion/recovery and ownership/access/consent. Each design identifies flow, data/components, failure behavior, rationale and open decisions. Current routes/schema remain separate from proposed operations/entities. Figures 1, 4A/4B, 5A/5B and 6 were selectively updated; Figures 2-3 remain unchanged. Added a proposed data extension and two workflow diagrams, for eleven panels total.
- Accuracy and decisions: Rechecked main, open PRs #17-21 and staged local frontend work; exact revisions and the current requirements/guideline hashes are recorded under `revision_4_3` in `docs/design-source-snapshot.json`. The source code confirms that the current client uploads before transcription disclosure, that the speech-presence gate does not implement pause/filler analysis, that coaching validators assume a complete deck, and that PROTECT relationships require ordered deletion. The document labels corrections/extensions Planned, preserves original slide indexes and repeated visits, separates new attempts from processing retries, and leaves identity provider, summary trigger, detector thresholds, ordering and retention choices open. No team agreement was invented.
- Browser rendering: Edited draw.io and Mermaid sources, exported/inspected their browser-rendered SVGs and PNGs, and regenerated public assets, HTML and the Wiki-ready local derivative. Explicit Planned labels carry implementation status; dashed sequence arrows retain response/callback meaning. Fixed a clipped review label and clarified cached comparison/server reads and local-only deletion. Source/render hashes in the new figure manifest prevent silently reusing stale assets.
- Production/checks: Updated `docs/design-tools/build_design_pdf.py` and `check_design.py` to derive revisions and expected panels from the Markdown/manifest. Ran `python docs/design-tools/build_design_pdf.py` and `python docs/design-tools/check_design.py --source-repo /Users/seoyeonpark/.codex/worktrees/ai-feedback/OnLoud` using the bundled Python runtime. Checks passed: full Markdown/PDF text parity, Wiki text parity, eleven pixel-identical embedded panels, source/render hashes, five pinned source paths, local assets/anchors, 28 valid internal PDF destinations, external link-target coverage, Arial/page bounds, ten required coverage entries, unchanged current-schema sources/renders and byte-identical submission copy. These verify document structure and linked source paths; they are not a new live-HTTP check of every external site.
- Visual review: Rendered all 17 final PDF pages with Poppler and visually inspected every page for legibility, diagrams, table clipping, captions and status labels. Preserved Arial, white cells, black text, 0.4 pt gray table grids and the established mixed A4/A3/A2 paper sizes. `output/pdf/visual-review.json` records the reviewed PDF hash; `docs/design-document-checks.json` contains the automated result. The testing-outcomes section remains removed. No application, device or provider tests were run.
- Preservation and handoff: Rev.4.2 Markdown/PDF and production inputs are preserved under `output/archive/Rev.4.2/`; their hashes match the pre-edit files. Other worktrees' HEAD/status/staged/unstaged fingerprints and all pre-existing unrelated tracked/untracked files match the before snapshot. The obsolete root-PDF deletion is preserved. Current Markdown SHA-256: `fa95745bc9289be70989c3345c101fcbd471e95dfa969ee2b2953e646209bdee`; PDF SHA-256: `515506afaf76746021f01e64fd398f0dbd2e4d1fa81e9ae85d4fec0b924d73ea`. No application code was modified and nothing was staged, committed, pushed, merged, published to the Wiki or submitted. User/team review of the provisional designs remains pending.


## 2026-10-09 - Publish Rev.4.3 to PR #23

- Authorization: After inspecting the local Rev.4.3 deliverables, the user requested "push this new ver on pr". This authorizes committing and pushing the reviewed documentation to the existing `codex/design-documentation` branch and updating PR #23, without merging or publishing the Wiki.
- Scope: Authoritative Markdown, matching HTML, all eleven diagram panels and editable sources, source/check manifests, production tools and AI-use evidence. Include the reviewed 17-page PDF and identical `team7-iter1-design.pdf` under `output/pdf/`; remove the obsolete Rev.3.0 root PDF and update README links. Mark the comparison report's Rev.3.0 evaluation as historical. Local Rev.4.2 backups, render galleries, scratch outputs and the editable ZIP stay outside the commit.
- Publication repair: The submission-named PDF was absent when this follow-up began; recreated it byte-for-byte from the unchanged reviewed documentation PDF. The checker previously depended on the ignored local Rev.4.2 archive. Store its eight current-schema source/render hashes in the committed figure manifest and check against that baseline instead, so a new checkout can run the same preservation check. No document prose, diagram pixels or PDF bytes changed during this follow-up.
- Verification: Run the complete documentation checker on the publication snapshot; review the exact staged diff, source/asset links, staged/working agreement, sensitive-file scope and outgoing commits before push. Reuse the prior page-by-page visual review because both PDF hashes remain `515506afaf76746021f01e64fd398f0dbd2e4d1fa81e9ae85d4fec0b924d73ea`. Record the final result below after checking. No application, device or provider testing is required for this documentation-only update, and no human teammate technical approval is claimed.

- Final pre-commit result: document checks passed on the working files and a clean temporary export of the exact staged build inputs (17 pages, eleven pixel-identical panels, full text/Wiki parity, 28 internal destinations and current-schema baseline preservation). Reviewed 68 added/modified staged files plus the obsolete PDF deletion; staged bytes matched working files, local links resolved to tracked files, and scope/credential-pattern checks found no issues. The clean export builds without the local Rev.4.2 archive. Whitespace checks passed. The user-authorized push proceeds without any application changes or Wiki publication.


## 2026-10-09 - Merge short and long design drafts into Iteration 1 Rev.2.0

- Request and tools: The user asked to start from the supplied short Rev.4.4 PDF, restore selected Rev.4.3 figures and planned-work details, collapse same-day draft revisions, and generate matching Wiki Markdown/PDF. Codex used the PDF, Stop Slop and verification-before-completion skills, the bundled Python/ReportLab/Poppler tools, GitHub read-only inspection and browser rendering/inspection. This was documentation self-review, not independent agent or human approval.
- Sources and preservation: Inspected all text in the supplied 14-page short PDF, its five diagram pages, the long Markdown and current guidelines. Read relevant API, model/route and frontend design material. Rechecked the public PR list: #17-21 remain open at the previously reviewed heads; the controller/layout redesign remains a staged local prototype without a PR and is labeled Planned. Fetched/fast-forwarded the existing documentation branch from 23725b4 to aa2195f, preserving the user's newer removal of Section 9. Archived source drafts and production inputs in output/archive/before-merged-iteration1. No new commit, staging, push, Wiki publication or application change.
- Incorporated material: Replaced the primary Markdown with the requested eight-section outline and two major revisions, 1.0 and 2.0. Retained the short draft's five diagram structures/labels, restored Figures 6, 3A and 8, and omitted Figure 7 from the document. Added one nine-decision choice/alternative/rationale table, the provisional interface table, binary-search alignment, the requirement roadmap and five consistent feature bullet groups. Preserved summary states, AttemptSelection/source_attempt_id, deletion dependency order and late-result discard, OIDC/PKCE and owner-scoped deduplication. Removed the contents list, status legend/branch names, AC codes, maintenance section, caption status notes, Iteration 5 reminder and repeated ending.
- Graphics and export: Transcribed the supplied PDF's vector paths and positioned Arial labels to editable SVG; checked exact label preservation for all five figures. Retained draw.io/Mermaid sources for the three restored figures, corrected the frontend status, used grayscale and converted HTML labels to portable SVG text. Browser renders supply PNGs for the PDF. Fixed Figure 4 lifelines painting over notes during visual review. Updated the existing builder for four-column decisions, new figure order, continuous same-size sections, feature bullet grouping and text-page transitions. Preserved Arial, white tables and thin gray borders. The final export has 16 pages and eight figures, with larger paper for detailed diagrams; both PDF filenames have identical bytes.
- Verification: Ran the complete build and check commands documented in docs/design-tools/README.md with the bundled Python runtime. Full Markdown/PDF and Wiki text parity, eight pixel-identical PDF figures, source/render hashes, 17 internal PDF destinations, five distinct pinned source paths, all six public links (HTTP 200), fonts, bounds, required-story roadmap and submission-copy identity passed. All 16 pages were visually inspected. After the final correction, pages 7, 9 and 10 were reinspected; the other 13 renders were pixel-identical. The initial 3x long-figure raster exceeded pypdf's decompression limit; 2x restored-figure renders resolved it without disabling the limit. Whitespace review passed. No application, device or provider tests were run.
- Evidence and review boundary: docs/design-document-checks.json and output/pdf/visual-review.json record the final checks. Markdown SHA-256: 9569b203779a5f4ba57bca1ef91b75b24c72c04c4aff34187f618ee270361240. PDF SHA-256: ff74a65fc46957d43b75a561a50a15313c23ab152d1b7ab5495371a8d2be3907. The historical course comparison remains labeled historical. Supporting source hashes and AI-use records stay outside the main design document. Testing outcomes remain excluded. User/team review of the merged document and proposed Iteration 2 decisions remains pending; no implementation or teammate approval is claimed.


## 2026-10-09 - Uniform A4 pages and consistent text sizes

- Request and tools: The user asked for consistent page and word font sizes. Codex used the PDF skill, bundled Python/ReportLab/Pillow/Poppler, and local browser diagram inspection/rendering. This is documentation self-review.
- Incorporated changes: Replaced the mixed A4/A3/A2 export with A4 portrait throughout. Body text, table cells, captions and code use 11-point Arial, with a consistent heading hierarchy and the existing white tables, gray borders and black text. Reflowed Figures 6, 3A and 8 into two, two and three A4-width panels respectively; their original design sources remain available, and the same complete panels appear in the Wiki SVGs. The primary Markdown and Figures 1-5 are unchanged. Updated reproducible export/check tools and saved a backup at output/archive/before-uniform-a4.
- Verification: The full builder and documentation checker passed: 24 A4 page boxes, expected Arial sizes, complete Markdown/PDF and Wiki prose parity, 12 pixel-identical image panels reconstructing all eight diagrams, source hashes, local assets, 17 internal destinations, pinned source paths, bounds and byte-identical submission copy. All 24 pages were rendered with Poppler and visually inspected; the final widow-control adjustment changed pages 12-13 only, both reinspected, with the other 22 pixel-identical. Whitespace review passed.
- Boundaries: Formatting and document checks only; no application/device/provider tests or application changes. Existing worktrees, staged work and prior documentation edits are preserved. No staging, commit, push, Wiki publication or submission. Main Markdown SHA-256: 9569b203779a5f4ba57bca1ef91b75b24c72c04c4aff34187f618ee270361240. PDF SHA-256: a41de7c89d76124391230b99a0c3168761577cb90451ed88c7e69f1d0d64b3ff.


## 2026-10-09 - Publish the uniform A4 version to PR #23

- Authorization: After reviewing the delivered version, the user said "upload this version into pr". This authorizes committing and pushing the merged Iteration 1 Markdown and reviewed A4 export to existing PR #23, with an updated PR description. It does not authorize Wiki publication or merge.
- Scope: The approved eight-section document, diagrams, matching HTML/PDF exports, reproducible tools and documentation evidence. Corrected the comparison report's stale mixed-paper-size delivery note. No main-document text or reviewed PDF bytes changed in this publication step. Historical galleries, local archives and unrelated untracked files are excluded.
- Local preservation: The submission-named PDF had been removed locally after export. Keep that local absence while storing the reviewed main PDF's identical bytes under both tracked PDF names in the commit. Verify both through a clean staged-file export; this explicit staging exception does not restore or overwrite the local removal.
- Review: Documentation self-review, with the previous visual inspection reused only after matching the exact PDF hash. Fresh staged-content checks and clean export validation are recorded below before commit. No application/device/provider tests or human teammate technical approval are claimed.

- Final pre-commit result: Reviewed 68 staged documentation files. A clean export from the exact index built successfully without local archives or unrelated untracked inputs. The full checker passed on the staged PDF bytes: 24 A4 pages, 12 pixel-identical panels reconstructing eight figures, Markdown/Wiki/PDF parity, source hashes, local assets, 17 internal destinations, Arial sizes and page bounds. Both staged PDFs match the previously visually reviewed SHA-256 a41de7c89d76124391230b99a0c3168761577cb90451ed88c7e69f1d0d64b3ff. Scope, staged/working equality (except the explicitly preserved duplicate-PDF absence), credential-pattern and whitespace checks passed. The remote PR branch still matches aa2195f before this commit.
