# Seoyeon — Iteration 1

[AI collaboration index](../../README.md). Entries retain their recorded context and attribution.

<a id="record-013"></a>

<a id="5-seoyeon-integration-and-interface"></a>

<a id="i1-seoyeon-integration-and-interface"></a>

### Seoyeon: integration and interface

**Tool:** OpenAI Codex · **Model:** `gpt-6-astra`

<a id="record-014"></a>

<a id="i1-s0-shared-scaffold-and-explainable-handoff-september-28"></a>

#### S0. Shared scaffold and explainable handoff, September 28

- **Output and decision:** Codex generated the Expo/Django scaffold, labelled preview screens, contracts and setup/handoff material. The follow-up redirected placeholder-hour planning toward the feature scaffold; the human requested an explanation and code inspection before publication.
- **Verification:** PR #1 (`e80e813`) reports agent-run mobile/export/APK/emulator checks and five backend tests. The scaffold did not implement real PDF capture, recording or feedback.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/1).

<!-- S0:9 -->

**Prompt**

```text
I would like to setup an android studio app and frames so that my team can implement the pdf import and slide viewer, the recording and slide tracking, and whisper implementation to complete iteration 1.&#x20;

I would like to setup and then upload in on git so each invidivual can make a branch and implement their code.
```

<!-- S0:180 -->

**Prompt**

```text
ignore hours cause they are just placeholder values focus on the original tas. setting up and uploading to github so my teammates can implement features
```

<!-- S0:664 -->

**Prompt**

```text
Also I want to understand so write me a .md file about everything youve done
```

<a id="record-015"></a>

<a id="i1-s1-integrating-teammate-features-october-4"></a>

#### S1. Integrating teammate features, October 4

- **Revision and use:** The initial request assumed teammate features were complete. After Codex identified integration gaps, the follow-up accepted combining the available PDF/recording pieces and finishing the rest later. PR #5 incorporated page-count/start-page/event integration at `c609514`.
- **Verification and limits:** Integration checks included 23 mobile and 23 backend tests, export and mocked-provider checks, with no connected device in that session. The later revert is recorded in A1.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/54078a33a2409aae8d671aaabca6d26476f0ea02/docs/ai-use.md#L403-L408).

<!-- S3:12 -->

**Prompt**

```text
All of my teammates have finished implementing their assinged tasks. Go over the code and merge it into one. They should be labeled as feature/
```

<!-- S3:95 -->

**Prompt**

```text
merge what there is and we'll implement the missing portions
```

<a id="record-016"></a>

<a id="i1-s2-playback-transcript-and-navigation-revision-october-6"></a>

#### S2. Playback transcript and navigation revision, October 6

- **Revision and use:** The user requested three tabs, then reported clutter and approved Codex's revised Home + Presentations plan. Concrete navigation priorities removed a duplicate browsing destination and guided the implementation.
- **Verification:** Commit `54078a3` includes both stages; checks included 45 tests initially and 52 after simplification, static checks/export, AI reviews and agent-operated emulator checks. Usability was not evaluated.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/54078a33a2409aae8d671aaabca6d26476f0ea02/docs/ai-use.md#L456-L480).

<!-- S1:12 -->

**Prompt**

```text
I want to make it so transcript goes along with playback highlighting the current word it is t. Also place transcript inside the playback area. Also I would like the main screen to be divided into sdifferent tabas of presentations, librabry, home screen
```

<!-- S2:12 -->

**Prompt**

```text
I feel like the ui is too cluttered right now how could we change it
```

<details>

<summary>Approved initial three-tab plan</summary>

<!-- S1:100 -->

**Approved AI plan**

```text
PLEASE IMPLEMENT THIS PLAN:
# Playback transcript and main-screen tabs

## Summary

Place the scrolling transcript inside the playback card and keep the current word visible during playback. Split the main screen into **Home**, **Presentations**, and **Library**, using the tab roles you selected.

## Playback changes

- Arrange the playback card as: **slide → playback controls → transcript**. Remove the separate transcript card below analysis progress.
- Show the full transcript in a bounded, independently scrolling panel.
- Reuse word timestamps and the player’s existing 100 ms status updates. Highlight the word at the actual audio position; preserve correct behavior for pause, seeking, replay, and silence. [Expo audio reference](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)
- Keep tap-to-seek. Seeking preserves whether audio was playing or paused and updates both the slide and highlighted word.
- Use measured text-line positions to scroll only when the active word leaves the visible panel. Avoid scrolling the whole results screen.
- Manual transcript scrolling pauses automatic following while highlighting continues. Show **Follow playback** to return to the current position and resume following.
- Preserve punctuation, whitespace, and Korean/English text. Show readable text when timestamps cannot be mapped reliably; show distinct waiting and no-speech states.
- Reset transcript scrolling and following state when opening a different attempt. Retain audio playback when slides or transcription are unavailable.

## Main-screen navigation

Use Expo Router’s existing JavaScript tabs inside the root stack, ordered **Home · Presentations · Library**, with Home selected initially. Viewer, recording, playback, and description screens remain full-screen stack destinations. [Expo tabs reference](https://docs.expo.dev/router/advanced/tabs/)

| Tab | Content and actions |
|---|---|
| **Home** | Welcome text, **Import PDF**, **Start practice**, and the three newest saved rehearsals with deck title, date, and status. Import opens the existing picker/viewer flow; Start practice opens Presentations. |
| **Presentations** | Imported decks grouped with their rehearsal history. Each deck opens its slides to start practice; saved attempts open playback and retain upload-retry/recovery access. |
| **Library** | PDF import, saved PDF list, open/remove actions, clearly labelled sample slides, and the existing connection check. Rehearsal history moves to Presentations. |

- Refresh saved data whenever a tab gains focus; reuse existing PDF and attempt storage.
- Keep PDF removal protection for decks with saved rehearsals.
- Provide useful empty states linking to PDF import.
- Add `/presentations` and `/library`; `/` becomes Home. Update existing fallback buttons to the appropriate destination.
- Preserve Back navigation, recording exit protection, and pausing playback when leaving review.

## Verification

- Existing playback baseline: **10 tests passed**.
- Extend tests for transcript-to-line mapping, repeated words, punctuation, Korean/English text, silence, backward seeking, and scroll-follow state.
- Verify recent-attempt ordering and grouping by deck, including empty data.
- Run `npm run check` and `npm run bundle:android` from the mobile project.
- On Android, verify long-transcript following, manual scrolling and resumption, word seeking, replay, tab navigation, import cancellation, upload retry, and recording exit protection.
- Check narrow screens and enlarged text for clipping and nested-scroll problems.

## Assumptions and handoff

- Continue the existing mobile-flow work while preserving the staged playback-slide changes and unrelated files.
- Reuse current styling and installed dependencies. Backend APIs, transcript wire types, and stored-data formats remain unchanged.
- Record changes and actual verification in the README and AI-use log. Commit and push remain subject to the repository’s review and user-inspection workflow.
```

</details>

<details>

<summary>Approved revised two-tab plan</summary>

<!-- S2:94 -->

**Approved AI plan**

```text
PLEASE IMPLEMENT THIS PLAN:
# Simplify OutLoud around practice and review

## Summary

Use **Home + Presentations** as the two main tabs. Home prioritizes practicing your latest deck; saved rehearsals open **Feedback first**, with Playback one tap away. Keep the blue accent and reduce repeated headings, bordered cards, explanatory text, and large secondary buttons.

## Screen changes

- **Home:** Replace the large introduction with “Practice again,” the deck title, and one primary button. Choose the most recently practiced available deck, falling back to the newest imported PDF. Show “Choose another” and three recent rehearsals as compact tappable rows. With no decks, make “Import PDF” the primary action.
- **Presentations:** Merge Library into this screen. Show one row per deck with its title and rehearsal count; keep Import in the header. Tapping a deck opens its slides shortcut and rehearsal history. Put PDF removal in an overflow menu, retaining the existing protection for PDFs with recordings. Preserve access to rehearsals whose PDF is unavailable.
- **Settings:** Move backend connection information and the clearly labelled sample preview here, accessible from Home’s header.
- **Slide setup and recording:** Put optional audience input behind “Audience.” Keep limits and save-on-exit behavior concise and visible before recording. During recording, prioritize the slide, page controls, timer, and Start/Stop action. Keep recording controls visible without scrolling at normal text size.
- **Review:** Add **Feedback / Playback** tabs within the rehearsal screen. Feedback shows available suggestions with expandable evidence, followed by collapsed “Timing & pace.” Pending, disabled, or unavailable feedback gets a short truthful message and a Playback shortcut. Playback contains the slide, compact audio controls, and synchronized transcript; the full slide-visit list is expandable.
- **Status and errors:** Replace the expanded processing card with a short status and expandable “Analysis details.” Keep actionable failures, recovery, and valid retry actions visible. Selecting suggestion evidence opens Playback and seeks to that moment.

## Implementation boundaries

- Use simple rows and dividers, one title per screen, and one dominant action per view. Retain readable text and at least 48-dp action targets.
- Add presentation-detail navigation keyed by the existing local deck ID and a Settings route. Redirect `/library` to Presentations and update internal links.
- Keep the audio player above the Review tab content so switching tabs preserves position and play/pause state. Evidence seeking also preserves that state.
- Reuse existing storage, upload, recovery, and processing behavior. No backend API changes, storage migrations, new dependencies, or overall presentation score.
- Preserve current staged work. Update README navigation guidance and task-level AI-use evidence with implementation and verification results.

## Verification

- Run `npm run check` and `npm run bundle:android` from `mobile/`.
- Test latest-deck selection, empty catalogs, duplicate titles, unavailable PDFs, and retained rehearsal history.
- Check Android navigation, long titles, large text, and small screens; ensure recording controls remain reachable.
- Verify Feedback-first behavior while processing, disabled, failed, and complete; confirm recovery and retry remain accessible.
- Recheck transcript seeking, evidence seeking, repeated/backward slide visits, tab switching during playback, and saving when leaving a recording.

Acceptance: normal browsing shows compact lists; each screen has one clear next action; technical details appear on demand without hiding failures or removing existing capabilities.
```

</details>

<a id="p1-initial-roadmap-for-the-current-product"></a>

<a id="p2-change-to-hosted-whisper-and-selectable-feedback"></a>

**Historical source supplement — `root-local-i1`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

- **Historical task-log supplement — summary:** Codex first synchronized slide visits and audio, including backward/word seeks, EOF boundaries and server-image recovery ([source task record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). Checks passed 35 mobile tests and Android export; separate AI review found and rechecked an image-error recovery fix. The later transcript/tabs and simplified UI phases passed 45 and 52 tests respectively, with agent-operated synthetic emulator checks ([transcript/tabs](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [practice/review UI](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). Publication preparation reused those checks and reviewed the combined 34-file staged diff ([publication record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). These checks belong to the prototype revisions; they are not human acceptance or live-provider evaluation. The supplemental source does not record the model or confirm the requester.

<a id="record-017"></a>

<a id="i1-s3-rebuilding-the-current-feature-flow-october-8"></a>

#### S3. Rebuilding the current feature flow, October 8

- **Revision and use:** The initial roadmap chose local Whisper; the next prompt chose the hosted API and Gemini/OpenAI feedback. Codex revised the plan and restored PDF/recording using the teammates' source in PR #17, followed by storage, processing, review and feedback in #18–#21.
- **Verification and limits:** PR #17 checks included 60 mobile tests, export, AI review, native build and synthetic emulator import/capture/replay checks. Physical microphone/interruption checks remained pending. UI polish remained a later stage.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/17).

<!-- S4:163 -->

**Prompt**

```text
I would like to implement the remaining work in this order:

1. **Complete PDF + recording integration.** Review PR #13, restore PDF import/viewing separately, and connect actual deck identity, page count, selected starting page and page-change events.
2. **Restore durable attempts and uploads.** Save audio references and timelines across restart; implement deck/attempt endpoints, server storage, upload retries and duplicate protection.
3. **Restore background processing.** Connect transcription → alignment → saved results, with partial-result preservation and failed-stage retries. The local prototype already provides the local-Whisper implementation.
4. **Restore real review screens.** Render the returned transcript, synchronize the actual PDF with playback, expose saved history and recovery.
5. **Restore and validate feedback.** Bring back descriptions, evidence-linked suggestions, caching and quota handling. Live feedback usefulness still needs evaluation.
6. **Bring back UI polish.** Home/Presentations navigation, Feedback/Playback organization and themes can follow the working flow.
```

<!-- S4:234 -->

**Prompt**

```text
I would like to implement whisper api and i would like to give gemini or openai feedback
```

<a id="record-018"></a>

<a id="i1-s4-durable-recording-storage-and-retry-acceptance-october-8"></a>

#### S4. Durable recording storage and retry acceptance, October 8

- **Output and decision:** Codex implemented SQLite checkpoints, durable audio references, backend deck/attempt storage and retry/duplicate protection in PR #18 (`06fe340`). The user required a progress report and revised plan before the next implementation.
- **Verification:** Checks included 94 mobile tests, 42 SQLite backend tests with two PostgreSQL-only skips, and 19 PostgreSQL storage tests. Agent-operated failure/retry/restart checks compared UUID, media hashes, duration and visits.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/06fe340a207639826143383364c13b4dd9636d31/docs/ai-use.md#L375-L387).

<!-- S4:1235 -->

**Prompt**

```text
Before continuing to next step stop and report what was implemented and replan for next stage. Receive my confirmation before continuing
```

<!-- S4:1306 -->

**Prompt**

```text
Plan next implementation goals and methodology. Use the local multi agent pipeline in implementation
```

<!-- S4:1357 -->

**Approved AI plan (excerpt)**

```text
PLEASE IMPLEMENT THIS PLAN:
# Recording Storage, Then Whisper API

## Goals and sequence

1. Finish, validate, and publish the existing storage implementation as **`feature/recording-storage-upload`**.
2. Report what works, remaining limitations, and the next implementation scope. **Stop for your confirmation.**
3. After confirmation, implement **`feature/whisper-api-processing`** using the local multi-agent pipeline.

Transcription will use **OpenAI’s hosted Whisper API (`whisper-1`)**. No local Whisper inference or model downloads will be introduced.

## First implementation: finish recording storage

The current storage changes exist locally but remain uncommitted and independently unreviewed.

- Rename `feature/attempt-processing` to `feature/recording-storage-upload`.
- Finish SQLite recording checkpoints, restart recovery, local/server deck mapping, retryable uploads, and server file persistence.
- Verify that retries preserve the recording UUID, identical submissions deduplicate, and conflicting submissions return an explicit error.
- Keep uploaded recordings visibly **awaiting analysis**. Storage completion must not imply successful transcription.
- Preserve the existing limits: 10 slides, 20 MiB PDF, 10-minute recordings, and **25,000,000 audio bytes**.
- Correct stale documentation and assess dependency advisories introduced by this change.

**Acceptance:** record a real PDF rehearsal, restart the app, replay saved audio, attempt an offline upload, reconnect and retry, then restart the server and retrieve the same saved recording.

Publish one storage PR, based on `feature/pdf-recording` while that dependency remains unmerged. Do not merge either PR.

## Local multi-agent methodology

Use the existing runner at `tools/agents/pipeline.py` in the local pipeline worktree. Its workflow is:

**Planner → parallel mobile/backend investigators → one implementation agent → checks → independent reviewer → bounded repair/review → inspection**

- Run its preflight and tests before relying on it. Use the configured Codex model without overriding it.
- Give each run a bounded task, acceptance criteria, prototype references, and explicit exclusions. Only investigators run concurrently; one agent owns code changes and shared contracts.
- For storage, export the existing changes—including new files—as a frozen patch against their exact base. The pipeline implementation agent imports that patch into its isolated worktree before making confirmed fixes. Preserve the original worktree.
- Transfer the reviewed result back to the named feature branch, verify that its staged content matches the reviewed/tested patch, and record evidence in `docs/ai-use.md`.
- Keep pipeline-generated branches internal. Publish only the requested `feature/*` branches.
- The runner stops before commits and publication. The coordinating agent handles the authorized PR workflow and reports human review as pending.

The pipeline does not replace Android, PostgreSQL, Redis/Celery, or live-provider checks.
```

<a id="record-019"></a>

<a id="i1-s5-hosted-processing-and-saved-rehearsal-review-october-8"></a>

#### S5. Hosted processing and saved rehearsal review, October 8

- **Output and use:** PR #19 reused Injoon's hosted adapter/alignment and added durable processing/recovery, saved transcripts and consent/polling. PR #20 added actual-PDF/audio/transcript review, history and separate media recovery.
- **Errors and corrections:** Six recorded AI-review rounds for the review stage led to Codex repairs for asynchronous player state, stale PDF callbacks and exact token mapping.
- **Verification and limits:** Processing was checked with mocked providers, infrastructure recovery cases and a synthetic hosted pilot. Review checkpoint `1305917` records 209 mobile tests/export and agent-operated synthetic seek/recovery checks. Physical-phone perceptual synchronization was not tested.

[Processing checks](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c7733d8288833b010948d2c5737929088547aa1e/docs/ai-use.md#L397-L501) · [Review checks](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/130591744c976a1e7225b9c1b76172bb746ac3c4/docs/ai-use.md).

<!-- S4:2198 -->

**Prompt**

```text
plan feature/whisper-api-processing implementation.
```

<!-- S4:2271 -->

**Approved AI plan (excerpt)**

```text
PLEASE IMPLEMENT THIS PLAN:
# `feature/whisper-api-processing` implementation plan

## Goal and boundaries

Connect **saved recording → explicit Analyze action → hosted Whisper → persisted transcript → slide alignment and metrics**.

The storage branch is clean at `06fe340`; [PR #18](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/18) remains open and unmerged. Start from that committed implementation and publish one stacked PR against `feature/recording-storage-upload`. Recheck the base before implementation in case storage has merged.

Keep local audio playback available throughout. Full synchronized review screens, feedback providers and UI redesign remain later implementations.
```

<!-- S4:3739 -->

**Prompt**

```text
Plan next proposed stage
```

<!-- S4:3800 -->

**Approved AI plan (excerpt)**

```text
PLEASE IMPLEMENT THIS PLAN:
# `feature/rehearsal-review` implementation plan

## Summary

Make saved rehearsals reviewable with **actual PDF pages, audio, synchronized transcript, slide-visit navigation, and durable history**. Include server history and recovery of missing audio/PDF, as selected.

PR #19 is currently open and unmerged at `c7733d8`. Start from that implementation and publish one stacked PR against `feature/whisper-api-processing`. Recheck its merge status before branching.

Keep the current visual style. Feedback providers, Feedback/Playback tabs, themes, comparison, and deletion remain later work.
```

<a id="record-020"></a>

<a id="p3-initial-ai-feedback-request-for-pr-21"></a>

<a id="i1-s6-feedback-scope-rejected-pr-split-and-quota-behavior-october-8"></a>

#### S6. Feedback scope, rejected PR split and quota behavior, October 8

- **Revision and use:** The user rejected five separate PRs and approved five checked implementation parts within one PR. Codex implemented feedback adapters/evidence validation, descriptions, coaching persistence and review controls in PR #21. The later quota instruction prioritized OpenAI and asked Gemini work to stop on quota problems.
- **Result and limits:** Verification included AI review, synthetic checks and small live-provider evaluations. The revised split made the requested review structure explicit. This corrected a planning mismatch; productivity was not measured.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/ce9f248256b1bbfc0d66f139886503261cc25953/docs/ai-use.md).

<!-- S4:5652 -->

**Prompt**

```text
Plan ai feedback feature. Be aware of prompt injections slopsquatting and other problems common with api implementation. Also describe how each form of feedback will be given what feedback will be given and how it will be received and displayed
```

<!-- S4:5717 -->

**Prompt**

```text
Scope seems to large divide it into smaller tasks with checks in between each task
```

<!-- S4:5728 -->

**Prompt**

```text
Dont use various prs but when implementing split into the 5 parts and do the checks after each part upload on one pr
```

<!-- S4:5740 -->

**Prompt**

Approval of five implementation parts in one PR.

```text
Implement the proposed plan.
```

<!-- S4:12339 -->

**Prompt**

```text
For gemini if quota problems just stop . Priority is openai
```

<a id="record-021"></a>

<a id="i1-s7-automatic-transcription-and-cancellation-review-october-89"></a>

#### S7. Automatic transcription and cancellation review, October 8–9

- **Revision and use:** The user changed the earlier explicit Analyze flow to automatic transcription after saving; coaching remained explicit. Codex updated PR #19 and its dependents.
- **Error → correction:** An independent Codex reviewer found a delayed-status-read cancellation race. A regression failed before the fix; Codex changed Cancel to consume the pending automatic intent. Elapsed repair time was not recorded.
- **Verification and limits:** Checkpoint `a0ee475` reports 125 tests/export and 47 focused review tests. The synthetic emulator's single process POST check preceded the cancellation repair. Native first-use cancellation remained untested.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/a0ee4755fb6f9a56c77fd967bdd83d1f7a37c400/docs/ai-use.md#L503-L516).

<!-- S7:118 -->

**Prompt**

```text
Change corresponding pr such that transcription happens automatically after recording is over
```

<!-- S7:514 -->

**Prompt**

```text
Test this using android studio
```

<a id="record-022"></a>

<a id="s8-human-testing-evidence-and-its-limits-october-67"></a>

<a id="i1-s8-phone-testing-october-67"></a>

#### S8. Phone testing, October 6–7

- **Human observation:** At 00:38 KST on October 7, the user reported that the phone flow worked, with transcription accuracy as an exception. Codex prepared/installed the app and revised presentation material; the human judged the flow.
- **Limit:** Transcription accuracy was reported qualitatively; no accuracy score or confirmed repair was recorded.

<!-- S6:12 -->

**Prompt**

```text
Let's test the new features on phyiscal phone
```

<!-- S6:199 -->

**Prompt**

```text
Everything worked well./ Just that transccription isnt as accurate . update the presentation pptx. to accomodate for these changes. Also make the pptx more clear as it sounds to sloppy and disoriented
```

<a id="7-additional-developmentadministrative-prompts"></a>

**Historical source supplement — `root-local-i1`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

- **Historical task-log supplement — summary:** Codex's October 6 preparation passed 54 mobile tests, checked API/database/broker readiness and a worker pong, then installed the existing APK after USB authorization. The initial launch remained behind the phone lock screen ([source task record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). The October 7 demo launch showed dark Playback with a rendered PDF and transcript on the physical phone; its checks again passed 54 tests and host readiness ([demo launch](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). That run did not independently evaluate a new recording, audible synchronization, microphone/transcription quality, theme persistence or Gemini output. The human result below remains qualitative. The supplemental source does not record the model or confirm the requester.
