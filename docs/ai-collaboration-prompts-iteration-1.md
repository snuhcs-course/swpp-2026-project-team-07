# Iteration 1 AI collaboration log

**Team 07 · OutLoud · September 26–October 9, 2026**

This log documents our AI-assisted development: prompts, generated work, revisions, errors and verification. Prompt wording is unchanged; excerpts and AI-written plans are labelled. Results refer to the cited code revisions.

[AI Collaboration Report – Iteration 1](ai-collaboration-report-iteration-1.md)

<a id="2-injoon-transcription-and-alignment"></a>

## Injoon: transcription and alignment

**Tool:** OpenAI Codex · **Model:** `gpt-6-astra`

### I1. Standalone word-to-slide alignment, September 29

- **Output and use:** Codex implemented word-start alignment with exact slide boundaries and repeated/backward visits in PR #3 (`e71c3e0`). Injoon approved incremental alignment → Whisper → transcript UI work and requested a longer example.
- **Verification:** Nine synthetic alignment tests covered boundaries and invalid timings. They do not establish human-speech transcription accuracy.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/docs/ai-use.md).

<!-- I-S1:22 -->

**Prompt**

```text
아 그니까 녹음 담당자한테 물어봐야 돼? 근데 그 친구가 지금 바빠서 내가 먼저 내 기능을 추가를 해야 할 것 같아
```

<!-- I-S1:44 -->

**Prompt**

Approval of the proposed alignment → Whisper → transcript UI sequence.

```text
알겠어 그러면 그렇게 하자
```

<!-- I-S1:113 -->

**Prompt**

```text
그러면 몇 단어가 아닌 제대로 된 script을 인풋으로 했을 때 나오는 output을 예시로 보여 줘
```

<!-- I-S1:132 -->

**Prompt**

```text
그러면 우리  whisper 모델은 녹은 파일만 받고 time stamp뿐만 아니라 align도 해 준다는 거지??
```

### I2. Hosted Whisper adapter and response-shape repair, September 29

- **Output and use:** Codex integrated hosted Whisper and generated a Korean TTS sample in PR #3.
- **Error → correction:** The adapter assumed a success response supported `model_dump()`. An independent Codex reviewer found that non-object responses could escape as `AttributeError`; Codex added a type guard and regression cases. This was an implementation defect. Repair time was not recorded.
- **Verification and human role:** The suite passed 23 backend tests; a live TTS call returned 38 words from 23,902 ms. Injoon reported inspecting the restaged changes. Human-speech accuracy and end-to-end app integration were unverified; the repair was AI-written.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/3).

<!-- I-S1:142 -->

**Prompt**

```text
ok whisper연동하자.
```

<!-- I-S1:247 -->

**Prompt**

```text
그 녹음 파일도 네가 생성해 줄 수 있나? TTS로.
```

<!-- I-S1:489 -->

**Prompt**

```text
알겠어. 너무 좋다. 이번에 내가 push한 것도 agents.md에 추가된 계약조건을 바탕으로 확인해 줘. 난 이미 직접 검토했으니까 Ai 검토 후에 뭘 해야하는지도 알려줘
```

<!-- I-S1:645 -->

**Prompt**

```text
알겠어 다 확인했어. 이제 push, commit하고 pr만들면 되는 건가?
```

### I3. Mobile transcription client and synchronized transcript, September 29

- **Output and revision:** Codex built the mobile transcription client and saved-result screen, then changed it to playback-linked word highlighting and tap-to-seek after Injoon's feedback. That prompt made the intended audio/text relationship explicit.
- **Errors and corrections:** The silent emulator used Codex's `-no-audio` launch option, a test-environment mistake. AI review also found status-validation and replay-race defects that Codex repaired; these are not recorded as human code edits.
- **Verification and decision:** PR #4 (`92e542e`) records 21 mobile tests, static checks/export and agent-operated emulator checks. Injoon inspected staged work and deferred visual refinement. Live upload, physical-phone behavior and perceptual synchronization remained unverified.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/92e542e6f4cfe558bda39fa090826f539b3ae728/docs/ai-use.md).

<!-- I-S1:846 -->

**Prompt**

```text
아 그러면 녹음 파일을 서버로 보내는 건 내가 하라고? 그건 할 수 있지
```

<!-- I-S1:856 -->

**Prompt**

```text
근데 녹음 담당자가 아직 일을 시작 안 했어. 현재 repo를 기점으로 내가 할 수 있는 것부터 하자.
```

<!-- I-S2:37 -->

**Prompt**

Approval of a screen using the saved Whisper TTS result.

```text
알겠어 그렇게 해줘
```

<!-- I-S2:199 -->

**Prompt**

```text
근데 이게 내가 생각하는 화면구조는 아닌 것 같아. 내가 생각했던 전사가 있으면 녹음의 진행에 따라 단어가 하이라이트가 되는 거지. 그래서 마치 녹음이랑 전사가 하나가 되는 것 처럼. 지금은 마치 분리가 된 것 같아.
```

<!-- I-S2:398 -->

**Prompt**

```text
아무것도 안 들리는데 정상인가?
```

<!-- I-S2:493 -->

**Prompt**

```text
알겠어 그러면 AI 검증을 한번 거치고, 문제 없으면 add해줘
```

<!-- I-S2:560 -->

**Prompt**

```text
직접 확인했는데 문제는 없는 것 같아. 다만 branch이름이 적합한지 확인해보고, 필요하면 바꿔줘. 그리고 현재 전사 UI가 너무 별론데, 이건 나중에 변경할 사항이야
```

<a id="3-jaewon-pdf-import-and-rendering"></a>

## Jaewon: PDF import and rendering

**Tool:** OpenAI Codex · **Model:** not recorded

### J1. Local PDF import, persistent catalog and page viewer, October 4

- **Output and use:** Codex generated local PDF import, private file copies/catalog, Library/Viewer screens and native rendering at `9547f1d`. Server slide-image/text preparation was still absent.
- **Verification and error:** Codex checks included 21 existing mobile tests and an operated Samsung SM-S901N rendering a 14-page PDF. Codex tapped Remove instead of Open, deleted the app-private copy and reimported the original from Downloads. This was a tool-operation mistake, not a hallucination; time cost was not recorded. Cancellation and malformed files were not verified.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/docs/ai-use.md#L218-L267).

<!-- F1 J1 -->

**Prompt**

```text
I am Team mate A and I have to implement the pdf import tool for the project.
instructions are - we have the main code - do not push to main but branch it off from the github ([https://github.com/snuhcs-course/swpp-2026-project-team-07](https://github.com/snuhcs-course/swpp-2026-project-team-07))
i want to work on it off line on my mac and test it out before i uplaod the branch like the others did- but I also want to test out the main code on the android device.
I want to first implement it so that you can upload the pdf (store it in your device, not server side) and be able to see it slide by slide like described.
```

<a id="j2-imported-pdf-in-practice-and-first-page-entry-october-4-feature-record"></a>

### J2. Imported PDF in Practice and first-page entry, October 4

- **Revision and use:** Jaewon extended PDF viewing to Practice, replacing sample slides with the imported PDF and requiring entry at page one. Codex implemented PDF-URI handoff with `slide: 0` and Practice navigation at `9547f1d`.
- **Verification:** The agent-operated phone check observed that PDF opening in Practice at page one; Practice's Next control was not tested on the device.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/docs/ai-use.md#L246-L267).

<!-- F1 J2 -->

**Prompt**

```text
now implement after "preview rehearsal" - it leads to the practice tab. under rehearsal, currently there are sample slides. change them to the uplaoded pdf file and maintain the next slide feature in the same tab.
```

<!-- F1 J2 -->

**Prompt**

```text
also, when the app enters rehearsal/practice, make sure even if the slide was moved to a different slide in the your slides slide preview tab, when you press preview rehearsal and move to the practice slide, it always goes back to the first slide
```

<a id="4-jooyoung-recording-and-timeline"></a>

## Jooyoung: recording and timeline

**Tool:** OpenAI Codex · **Model:** not recorded

### Y1. Microphone capture and local preview, September 30

- **Output and use:** Codex generated permission/audio-mode handling, recording, native-duration polling, repeated/backward slide events and local preview at `04857fb`.
- **Errors and corrections:** The requester reported permission/timer/Stop problems. AI review found stale duration, Preview navigation during capture and unusable controls after failed Stop; Codex repaired them.
- **Verification:** Static/export checks included 21 mobile tests. The final changes received static checks; no final device retest was documented.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/04857fb93d0a64784feb8bfb1d4b61f4b47bf251/docs/ai-use.md#L309-L346).

**Prompt author:** unconfirmed. Jooyoung supplied these recording prompts.

<!-- F2 · September 30 -->

**Prompt**

```text
Read README.md, AGENTS.md, docs/api-contract.md, docs/iteration-1-handoff.md, and mobile/AGENTS.md.

Implement only `RecordingService.start()` using Expo SDK 57 `expo-audio`. The current RehearsalScreen.txs is a fixture-only preview. Your first task is to implement the "Start recording" button. It requires requesting audio permission, (if granted) set audio mode, create a useAudioRecorder using RecordingPresets.High_QUALITY with directory: "document", await prepareToRecordAsync(), then call record(). Then, it will switch the UI to a real "Recording" state and enable Stop. Do not modify shared contracts, app.json, Android generated files, dependencies, or navigation. keep in mind that the next task is to implement slide-change timestamps on the same timeline. In the future, the app will allow re-recordings for selected slides. Show me the changed diff and run the relevant static checks. Do not commit or push. make sure to be on feature/recording-tracking branch
```

<!-- F2 -->

**Follow-up prompts**

```text
implement slide-change timestamps on the same timeline
```

```text
use the local recording preview. additionally, when stop recording is clicked, keep the timestamp
```

### Y2. Empty Android timeline after Stop, October 7–8

- **Error and detection:** Jooyoung reported an empty Android timeline. Code read `durationMillis` after Stop, but Android reset it to zero, causing timeline filtering to discard the events.
- **Correction and outcome:** Codex added `stopCapture.ts` to pause and save native duration before stopping. Jooyoung confirmed the timeline appeared; an independent Codex reviewer checked the staged fix. The implementation defect was repaired by Codex.
- **Evidence and limits:** PR #13 (`040880f`) records 21 tests, Android export and native launch. Quick Stop, re-recording and automated helper coverage were pending at that revision; elapsed repair cost was not recorded.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/040880f8a21b2f866228984e9fb3c438fa6ee4bf/docs/ai-use.md#L319-L352).

<!-- F2 · October 7 -->

**Prompt**

```text
when i try the app, the slide timeline has nothing on it??
```

<a id="5-seoyeon-integration-and-interface"></a>

## Seoyeon: integration and interface

**Tool:** OpenAI Codex · **Model:** `gpt-6-astra`

### S0. Shared scaffold and explainable handoff, September 28

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

### S1. Integrating teammate features, October 4

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

### S2. Playback transcript and navigation revision, October 6

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

### S3. Rebuilding the current feature flow, October 8

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

### S4. Durable recording storage and retry acceptance, October 8

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

### S5. Hosted processing and saved rehearsal review, October 8

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

<a id="p3-initial-ai-feedback-request-for-pr-21"></a>

### S6. Feedback scope, rejected PR split and quota behavior, October 8

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

### S7. Automatic transcription and cancellation review, October 8–9

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

<a id="s8-human-testing-evidence-and-its-limits-october-67"></a>

### S8. Phone testing, October 6–7

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

## Additional development/administrative prompts

<a id="a1-revert-and-consolidation-review-workflow-not-hallucination"></a>

### A1. Revert and consolidation, October 7–8

- **Decision and outcome:** PR #10 reverted #5 to restore separate feature-owner review. Later consolidation retained the PDF and recording work in PR #17; #15 and #17 shared head `b60c357`.
- **Cost and classification:** Work included reverting, reapplying and re-reviewing features; elapsed time is unknown. The changes addressed the review process.

[Evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f6f6e76605632296a802aecef25ac10c6d0fd0cd/docs/ai-use.md).

**Tool:** OpenAI Codex · **Model:** not recorded for the revert; `gpt-6-astra` for consolidation.

**Prompt from task log · October 7 · [PR #10 log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f6f6e76605632296a802aecef25ac10c6d0fd0cd/docs/ai-use.md)**

> Okay I want to revert #5 through new PR.

<!-- S4:1155 -->

**Prompt**

```text
name the prs as feature/ and if they are similar make it into one branch
```

<a id="a2-additional-quotations-from-the-retired-log-october-69"></a>

### A2. Repository and documentation tasks, October 6–9

These task-log excerpts cover branch management, report writing and documentation review. Each entry links to its task record.

**Tool:** OpenAI Codex · **Model:** see the linked task records; not recorded for all tasks.

**Task-log excerpt · 2026-10-06 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-06--merged-github-branch-cleanup)**

```text
old onloud branches on git
```

**Task-log excerpt · 2026-10-06 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-06--after-hours-publication-follow-up)**

```text
push on new branch
```

**Task-log excerpt · 2026-10-07 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-07--preserve-prototype-and-restore-original-github-branch-layout)**

```text
yes back up everything so we have a view and then delete the branches so my teammates can reupload like before
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--ai-collaboration-report-preparation-and-task-log-formatting)**

```text
Make ai collaboration report guideline for our project.
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--reflective-ai-collaboration-report-revision)**

```text
The current draft is historically careful but reads too much like an evidence audit rather than a reflective account of human–AI collaboration.
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--focused-report-edit-and-non-use-claim-review)**

```text
Make a focused editorial revision, not a major rewrite.
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--focused-report-edit-and-non-use-claim-review)**

```text
make a light editorial revision of the existing report: simpler English, fewer disclaimers, preserved verbatim quotations, and more emphasis on what the team learned.
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--feature-focused-iteration-1-collaboration-report-and-source-attribution)**

```text
Do not merely polish the existing text. Reevaluate its structure, content, evidence and compliance against the official course requirements.
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--local-commit-preparation-after-requester-edits)**

```text
commit these changes
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--jaewons-supplied-pdf-and-practice-prompts)**

```text
This is jaewon's work, update the ai-collaboration-prompts document
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--injoons-recovered-alignment-whisper-and-playback-prompts)**

```text
Can you edit the appendix with the actual prompts that I used?
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--simplified-injoon-entries-and-incorporated-jooyoungs-update)**

```text
I feel like we don't need the english meaning part. I want to keep it simple and close to the other members.
```

**Task-log excerpt · 2026-10-09 · [source entry](history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--verify-course-format-and-simplify-the-iteration-1-prompt-appendix)**

```text
I want to remove unnecessary stuff from the iteration 1 prompt appendix file.
```

### A3. Shared reporting workflow, October 9

- **Output:** Codex combined prompt recording and task notes into one collaboration log and updated the reporting guide and shared agent instructions.
- **Revision and verification:** Injoon requested tool/model metadata, examples across contributors and a human review checklist. Codex revised the report and guide, checked quotations and links, and preserved the earlier review as an archive. Contributor confirmations remain pending.

**Contributor:** Injoon · **Tool:** OpenAI Codex · **Model:** not recorded

```text
The ai-collab prompts iteration and ai-use file overlaps. We need one file to keep track of the prompts. The ai-use file should be either combined or removed. The guidelines should be updated to accomodate this change. If I'm correct, the validation is to check whether the report itself is good right? Also there are many issues with agents.md so we need to change that as well.
```

```text
The file "Review before commits and pushes for Injoon's work". As agents.md is a file that is referenced in everyone's workspace, it should be general to everyone and provide helpful guidance for the AI after any prompt
```

```text
Ok but in the prompt log is there no need to mention things like which tool/model was used? The report should mention everything in the ai collab guidelines but I'm not sure if enough information is provided in the other documents for this guideline.
```

```text
Okay in the guidelines it also says to mark down where hallucinations occured. In general, how do we keep track of these other things? I feel like the one that is in the github branch (the one we checked out) had useful information although it didn't just include the prompts only. I feel like we need some information to create the report.
```

```text
I don't want you clutter the document by saying stuff like "recovered". I want you to make it seem like a submission ready documnet.
```

```text
Btw, Injoon, Seoyeon, and Jaewon are male, Jooyoung is Female. Fix inconsistencies in gender throughout the documents. Similarly to what you did right now, can you make sure that the documents are submission ready by removing  clutter unless absolutely necessary for development.
```

```text
You need to make changes to the content of the report. For example, in the prompt history and prompt revisions, you only mention Seoyeon's. Obviously we can't include everyone's changes but we can include what was notable with references. Also, wasn't the validation supposed to give checks on the content of the report? Maybe we need to change how the validation is done for the report to make sure it is compltely aligned with the requirements.
```

```text
Instead of saying they make sure to say "we".
```

```text
According to the official guidelines, I think it would be fine to just give a link to the prompt log in 2. To reduce the word count while increasing content and readability, use the bulleted format as in the guidelines. Make the wording very simple and sentence structure simple.
```

```text
What happened to 7. Takeaway for Iteration N?
```

```text
But this is not in the guidelines.md file. Remember all the documnets need to be consistent with each other
```

```text
I feel like our takeaway is very bad? Is that the only thing we learned from this iteration
```

```text
do u think that the validation file is important for us right now? I feel like it adds nothing and a human check on the report is much better
```

```text
Ok sure
```

```text
Ok I feel like it's good enough. Can you push the changes to the branch.
```

<a id="1-purpose-coverage-and-provenance"></a>
<a id="6-meaningful-revisions-and-debugging-sequences"></a>
<a id="8-missing-contributor-evidence-and-confirmation-checklist"></a>
<a id="contributor-submission-form"></a>

[Archived source notes](history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#source-register).
