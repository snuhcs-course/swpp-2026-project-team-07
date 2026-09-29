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
