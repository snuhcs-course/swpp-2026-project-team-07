# Iteration 1 prompt appendix

## 1. Purpose, coverage and provenance

This is the development evidence behind the [main report](ai-collaboration-report-iteration-1.md), covering **September 26–October 9, 2026**. It includes the earlier prototype and the post-revert rebuild because both fall inside the requested period. Earlier UI examples are historical; they do not describe the current `main` or claim that the rebuild restored that UI. The October 9 request to investigate the whole iteration supersedes the earlier draft's post-revert-only selection.

Evidence labels used below:

- **Original:** recovered from a `response_item` whose role is `user`, not a task title, generated summary or PR description. Fenced quotations retain spelling, capitalization and Markdown; terminal whitespace is omitted.
- **Contributor-supplied original:** verbatim prompt text in a supplied contribution file, identified by the requester as that member's work. These quotations were checked against the supplied file; the underlying raw chat was not independently retrieved.
- **Approved AI plan:** text first drafted by the assistant and then submitted in a user-role “PLEASE IMPLEMENT THIS PLAN” message. This proves approval/instruction, not independent human authorship of the plan.
- **Secondary quotation:** exact wording in a dated AI-use log; the original conversation was not recovered.
- **Summary / missing:** source describes the work but supplies no authentic prompt. Summary prose is never placed in a prompt quotation.

Source IDs and original record locations appear in the [source register](ai-collaboration-validation-iteration-1.md#source-register). Recovered Codex sessions record model identifier `gpt-6-astra`; the client version is not established. Other teammates' Codex model versions are unknown. `whisper-1`, Gemini and OpenAI feedback models are application providers, not evidence of the coding assistant's model.

Contributor identities use the requester's explicit mapping (S8:12: `joo`/`zoo`/`zoo_zero` → Jooyoung; `justaoj` → Jaewon), Git/PR records and named disclosures. Seoyeon identifies herself in S5:237. The local sessions grouped under Seoyeon are her available project history; that self-identification does not authenticate every older message's sender. She must confirm the selection. No prompt is assigned to a person solely from a commit author or filesystem username.

## 2. Injoon: transcription and alignment

### I1. Standalone word-to-slide alignment, September 29

**Evidence: summary; original prompt missing.** The contemporaneous log names Injoon as requester and Codex as implementer. It describes incremental work: alignment first, Whisper second, transcript UI afterward. This is the log's account, not a recovered quotation.

Codex generated `backend/rehearsals/services/alignment.py`, nine synthetic tests and `docs/word-alignment.md`. The implementation assigns each word by its start time, sends exact-boundary words to the new visit, retains silent/repeated/backward visits, and rejects invalid timestamps instead of clamping them. Injoon's recorded final inspection accepted the restaged backend scope; no human-written patch is reported.

Evidence: [PR #3](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/3), [nine tests](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/backend/rehearsals/test_alignment.py#L19-L86), and [dated implementation/review log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/docs/ai-use.md). Codex recorded nine alignment tests passing, an initial 14-test backend suite, and a later 23-test suite after the adapter/review fixes. These are different checkpoints. The boundaries are executable examples, not measured real-speech alignment accuracy. **Needed from Injoon:** original alignment request, revisions, model/version and personal edit/test notes.

### I2. Hosted Whisper adapter and response-shape repair, September 29

**Evidence: summary; implementation and debugging prompts missing.** Codex generated the hosted adapter, normalized seconds into integer milliseconds, retained the raw response, and added tests using the actual SDK over mocked HTTP. Injoon's task log records acceptance after restaging and personal inspection.

The generated code assumed a successful SDK result supported `model_dump()`. A separate Codex reviewer found that a non-object HTTP-success body could instead escape as `AttributeError`, violating the adapter's safe-error contract. Codex added a `TranscriptionVerbose` guard and cases for array, null, string and integer responses. The cases also assert one request and unchanged audio. The detecting reviewer was AI; Injoon's final inspection followed the repair. This is an **implementation error**, with no recovered false explanatory assertion sufficient to classify it as a hallucination. The recorded cost is an additional repair and review cycle; elapsed time is unknown.

Evidence: [type guard](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/backend/rehearsals/services/transcription.py#L78-L87), [malformed-response regression](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/backend/rehearsals/test_transcription.py#L73-L81), [PR #3](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/3). The log records nine transcription tests and 23 total backend tests after repair. A separate live Korean TTS check returned 38 words on 23,902 ms audio; synthetic slide changes were supplied as test input. Neither that check nor the mocked suite establishes physical microphone capture or human-speech accuracy. **Needed:** Injoon's exact request/follow-ups and confirmation of his review; no debugging duration has been invented.

### I3. Mobile transcription client and synchronized transcript, September 29

**Evidence: summary; original messages missing.** Injoon asked for work that could proceed before the recording teammate's implementation. Codex produced `client.ts`, the Expo file/fetch adapter, a saved-transcript screen, `playback.ts`, highlighting and tap-to-seek. These are distinct from Seoyeon's later full-PDF playback and navigation work in S2 below.

An independent Codex review found that `String(status)` admitted an array such as `["completed"]`. Codex required a string and added malformed-status plus cancellation cases. The review record reports 15 passing client tests; the final playback scope reports 21 mobile tests, TypeScript/lint and Android export. An agent-operated emulator check exercised play, pause and word seeking with saved TTS; audible timing and live upload remained unverified. The user reported no apparent functional issue but deferred the unsatisfactory transcript UI. That is partial acceptance, not visual approval.

Evidence: [PR #4](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/4), [strict result validation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/92e542e6f4cfe558bda39fa090826f539b3ae728/mobile/src/features/transcription/client.ts#L38-L46), [client, playback and inspection log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/92e542e6f4cfe558bda39fa090826f539b3ae728/docs/ai-use.md). **Needed from Injoon:** original client/playback prompts, the request to defer UI changes, review follow-ups and individual verification notes.

## 3. Jaewon: PDF import and rendering

**Evidence: contributor-supplied original prompts, F1.** The requester supplied [Jaewon's contribution file](history/jaewon-ai-collaboration-prompts-iteration-1.md) on October 9 and explicitly identified it as his work. Its first prompt identifies the sender as **“Team mate A.”** Together with the requester's `justaoj` → Jaewon mapping, this resolves the earlier sender ambiguity. The file attributes these quotations to original Codex user messages; this revision checks them against the supplied file, without independently retrieving the raw chat. October 4 is the feature-record date, not a verified timestamp for each message. Source-message IDs, exact timestamps and coding model/version were not supplied.

### J1. Local PDF import, persistent catalog and page viewer, October 4

**Contributor-supplied original request, F1 J1** (full text):

```text
I am Team mate A and I have to implement the pdf import tool for the project.
instructions are - we have the main code - do not push to main but branch it off from the github ([https://github.com/snuhcs-course/swpp-2026-project-team-07](https://github.com/snuhcs-course/swpp-2026-project-team-07))
i want to work on it off line on my mac and test it out before i uplaod the branch like the others did- but I also want to test out the main code on the android device.
I want to first implement it so that you can upload the pdf (store it in your device, not server side) and be able to see it slide by slide like described.
```

Codex implemented the PDF service, Library/Viewer screens, app-private copies and catalog, and native renderer configuration. This was local PDF rendering; server slide-image/text preparation was still absent. The work was incorporated into PR #5, removed from the baseline by #10, and reused during the rebuild. Seoyeon's restoration prompts below do not substitute for Jaewon's original contribution.

Evidence: [`9547f1d`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b), [PDF task and phone follow-up](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/docs/ai-use.md#L218-L267). Codex reported 21 existing mobile tests, typecheck/lint, export and prebuild. A later agent-operated Samsung SM-S901N check rendered a 14-page PDF, swiped to page 2, used Next and opened rehearsal. It did not verify every rehearsal control, cancellation or malformed files. During coordinate-based testing Codex tapped **Remove** instead of **Open**; the app-private copy was deleted, the original remained in Downloads, and Codex reimported it. This is a verified **tool-operation mistake**, not a hallucination or human code repair; time cost was not recorded.

### J2. Imported PDF in Practice and first-page entry, October 4 feature record

**Contributor-supplied original follow-up, F1 J2** (full text):

```text
now implement after "preview rehearsal" - it leads to the practice tab. under rehearsal, currently there are sample slides. change them to the uplaoded pdf file and maintain the next slide feature in the same tab.
```

**Contributor-supplied original follow-up, F1 J2** (full text):

```text
also, when the app enters rehearsal/practice, make sure even if the slide was moved to a different slide in the your slides slide preview tab, when you press preview rehearsal and move to the practice slide, it always goes back to the first slide
```

**Human decision and incorporated output:** Jaewon extended the import/viewer request to the Practice flow: replace its sample slides with the imported PDF, retain Next, and open at the first page regardless of the page selected in the viewer. At `9547f1d`, [Preview rehearsal passes the PDF URI and `slide: 0`](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/mobile/src/features/pdf/ViewerScreen.tsx#L134-L142), and [Practice renders that PDF with page-navigation controls](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/mobile/src/features/recording/RehearsalScreen.tsx#L62-L115). The [October 4 agent-operated phone check](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/9547f1dd397436f7fb1d74b9c4e94d7ca8d20d1b/docs/ai-use.md#L246-L267) observed the same PDF opening in Practice at page one; Practice's Next control itself was not tested on the device. These are historical requirements and results at that commit, not a claim about the current app's entry-page behavior.

**Still needed from Jaewon:** acceptance/edit decisions, any additional failed attempts or revisions, personally performed phone-test/review notes, and coding model/version if recorded. The three supplied prompts and “Teammate A” identity are no longer missing. Native-build and device activity in the existing log belongs to Codex, not automatically to Jaewon.

## 4. Jooyoung: recording and timeline

### Y1. Microphone capture and local preview, September 30

**Evidence: original user-role messages supplied by Jooyoung in the current reporting conversation (F2); requester label conflict remains.** The original commit uses Git author `joo`, mapped to Jooyoung by the requester. However, its AI-use entry says **“Contributor: Injoon (requester).”** The prompts below establish their wording, not who authored every earlier request; the members should resolve that label conflict.

**Original user-role message, F2 (September 30; verbatim):**

```text
Read README.md, AGENTS.md, docs/api-contract.md, docs/iteration-1-handoff.md, and mobile/AGENTS.md.

Implement only `RecordingService.start()` using Expo SDK 57 `expo-audio`. The current RehearsalScreen.txs is a fixture-only preview. Your first task is to implement the "Start recording" button. It requires requesting audio permission, (if granted) set audio mode, create a useAudioRecorder using RecordingPresets.High_QUALITY with directory: "document", await prepareToRecordAsync(), then call record(). Then, it will switch the UI to a real "Recording" state and enable Stop. Do not modify shared contracts, app.json, Android generated files, dependencies, or navigation. keep in mind that the next task is to implement slide-change timestamps on the same timeline. In the future, the app will allow re-recordings for selected slides. Show me the changed diff and run the relevant static checks. Do not commit or push. make sure to be on feature/recording-tracking branch
```

**Original user-role follow-ups, F2 (September 30; verbatim):**

```text
implement slide-change timestamps on the same timeline
```

```text
use the local recording preview. additionally, when stop recording is clicked, keep the timestamp
```

Codex generated microphone permission handling, audio mode, capture, native-duration polling, `LocalRecording`, repeated/backward slide events and local preview. The original requester tested and reported permission/timer/Stop problems. A separate AI reviewer found stale duration from an earlier attempt, Preview navigation during capture and a failed Stop leaving unusable controls; Codex repaired them before the recorded commit. The requester confirmed capture/timeline behavior, but that person's name cannot be inferred from the commit alone.

Evidence: [`04857fb`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/04857fb93d0a64784feb8bfb1d4b61f4b47bf251), [recording entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/04857fb93d0a64784feb8bfb1d4b61f4b47bf251/docs/ai-use.md#L309-L346), and F2. Codex reported 21 mobile tests, typecheck/lint and Android export; the log distinguishes earlier human testing from the final static checks. The final device snapshot was not independently rechecked in that entry.

### Y2. Empty Android timeline after Stop, October 7–8

**Evidence: original defect report supplied by Jooyoung (F2), named development log and PR.** The later entry explicitly names Jooyoung as contributor, issue reporter and phone verifier. During Android testing he reported:

**Original user-role message, F2 (October 7; verbatim):**

```text
when i try the app, the slide timeline has nothing on it??
```

The previous code read `durationMillis` after `await recorder.stop()` and even commented that final duration would be available then. Android reset the duration, so filtering against the zero result removed the timeline.

Codex added `stopCapture.ts` to pause and snapshot the native clock before stopping, and wired `RehearsalScreen.tsx` to the preserved duration. Jooyoung then confirmed that a stopped recording displayed its timeline. An independent Codex reviewer inspected the staged fix. This establishes a narrow phone result, not all timing boundaries or recording reliability.

Evidence: [PR #13](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/13), [`040880f`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/040880f8a21b2f866228984e9fb3c438fa6ee4bf), [duration-preservation helper](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/040880f8a21b2f866228984e9fb3c438fa6ee4bf/mobile/src/features/recording/stopCapture.ts#L1-L18), [named reporter and verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/040880f8a21b2f866228984e9fb3c438fa6ee4bf/docs/ai-use.md#L319-L352). Codex recorded `npm run check` (21 tests), Android export and a native launch. The PR explicitly leaves quick Stop, re-recording and automated pause/stop helper coverage pending at that revision. This is an **implementation error contradicted by observed Android behavior**. No fabricated API or other coding-model hallucination is established. Rework involved a new helper, caller change, rebuild and retest; minutes/hours were not logged.

**Needed from Jooyoung:** date/device/check steps for his retest; acceptance/edit notes; resolution of Y1's Injoon label; model/version if known. Git authorship establishes ownership of the commit, not authorship of the AI-written repair.

## 5. Seoyeon: integration and interface

The following originals come from the available local project sessions. Seoyeon's self-identification and the requester's contributor mapping support grouping them here; her per-record confirmation remains part of team sign-off. Do not transfer the earlier feature authors' work into this integration credit.

### S0. Shared scaffold and explainable handoff, September 28

**Original user-role message, S0:9** (2026-09-28 05:00:47.584 UTC; full text):

```text
I would like to setup an android studio app and frames so that my team can implement the pdf import and slide viewer, the recording and slide tracking, and whisper implementation to complete iteration 1.&#x20;

I would like to setup and then upload in on git so each invidivual can make a branch and implement their code.
```
**Original user-role message, S0:180** (2026-09-28 05:06:03.696 UTC; full text):

```text
ignore hours cause they are just placeholder values focus on the original tas. setting up and uploading to github so my teammates can implement features
```
**Original user-role message, S0:664** (2026-09-28 05:32:41.979 UTC; full text):

```text
Also I want to understand so write me a .md file about everything youve done
```
**Context and decision:** the follow-up redirected attention from placeholder hours to the feature scaffold; the final request asked Codex to explain its work. Codex generated the Expo/Django starting code, labelled preview screens, contracts and setup/handoff material, including `docs/setup-explained.md`. The human asked to see code before pushing and later accepted the scaffold. **Outcome:** incorporated in [PR #1](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/1) at [`e80e813`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/e80e81313d3c5faa775795fa97797b5507b17360). The [PR #1](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/1) record reports mobile checks/export, a JDK 17 APK/emulator run, and five backend tests by the agent. This did not implement real PDF capture, recording or feedback. These original requests improve attribution beyond the older log's missing-scaffold-prompt entry; they do not identify a human reviewer of every line.

### S1. Integrating teammate features, October 4

**Original user-role message, S3:12** (2026-10-04 07:48:02.677 UTC; full text):

```text
All of my teammates have finished implementing their assinged tasks. Go over the code and merge it into one. They should be labeled as feature/
```
**Original user-role message, S3:95** (2026-10-04 07:49:38.843 UTC; full text):

```text
merge what there is and we'll implement the missing portions
```
**Context and decision:** the first request assumed assigned work was finished. After the agent identified unfinished integration, the follow-up accepted merging the available pieces and implementing missing portions later. Codex combined the PDF/recording branches, reconciled actual page count/start page/events and retained preview labels. [PR #5](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/5) reached [`c609514`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/c6095141d182e4d5aa30b0d2e1c7d1eb5d311696); its [integration log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/54078a33a2409aae8d671aaabca6d26476f0ea02/docs/ai-use.md#L403-L408) records 23 mobile and 23 backend tests, export and mocked-provider checks, with no connected device in that session. Treat the initial completeness claim as a user assumption, not an AI hallucination. The later review-process reversal is explained under A1, not counted as a second implementation.

### S2. Playback transcript and navigation revision, October 6

**Original user-role message, S1:12** (2026-10-06 01:13:44.757 UTC; full text):

```text
I want to make it so transcript goes along with playback highlighting the current word it is t. Also place transcript inside the playback area. Also I would like the main screen to be divided into sdifferent tabas of presentations, librabry, home screen
```
Codex drafted the three-tab implementation plan in S1:90; the user approved the full plan in S1:100. It placed transcript/highlighting inside the player and added Home, Presentations and Library. The feedback below followed that implementation:

**Original user-role message, S2:12** (2026-10-06 02:10:26.696 UTC; full text):

```text
I feel like the ui is too cluttered right now how could we change it
```
Codex proposed merging Library into Presentations, prioritizing practice on Home and separating Feedback/Playback. The user approved the revised plan at S2:94. Both approved plans are retained below to distinguish the user's feedback from agent-written implementation detail.

<details>
<summary>Exact approved initial three-tab plan (assistant draft: S1:90)</summary>

**Original user-role message, S1:100** (2026-10-06 01:17:10.633 UTC; full text):

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
<summary>Exact approved revised two-tab plan (assistant draft: S2:84)</summary>

**Original user-role message, S2:94** (2026-10-06 02:12:33.070 UTC; full text):

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

**Accepted/revised outcome:** [`54078a3`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/54078a33a2409aae8d671aaabca6d26476f0ea02) incorporates both stages, so the public commit is not a separately published three-tab baseline. Its [two dated checkpoints](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/54078a33a2409aae8d671aaabca6d26476f0ea02/docs/ai-use.md#L456-L480) reports 45 tests for the initial change and 52 after simplification, typecheck/lint, export, separate AI reviews and agent-operated emulator checks. Generated files include `mobile/src/features/transcription/PlaybackTranscript.tsx`, `reviewState.ts`, and `mobile/src/features/home/PresentationsScreen.tsx`. The revised constraints gave the agent concrete navigation priorities and removed a duplicate browsing destination. They produced the specified structure; there was **no usability study proving it easier to use**. This prototype change is historical, not restored UI on current `main`.

<a id="p1-initial-roadmap-for-the-current-product"></a>
<a id="p2-change-to-hosted-whisper-and-selectable-feedback"></a>

### S3. Rebuilding the current feature flow, October 8

**Original user-role message, S4:163** (2026-10-07 23:39:30.096 UTC; full text):

```text
I would like to implement the remaining work in this order:

1. **Complete PDF + recording integration.** Review PR #13, restore PDF import/viewing separately, and connect actual deck identity, page count, selected starting page and page-change events.
2. **Restore durable attempts and uploads.** Save audio references and timelines across restart; implement deck/attempt endpoints, server storage, upload retries and duplicate protection.
3. **Restore background processing.** Connect transcription → alignment → saved results, with partial-result preservation and failed-stage retries. The local prototype already provides the local-Whisper implementation.
4. **Restore real review screens.** Render the returned transcript, synchronize the actual PDF with playback, expose saved history and recovery.
5. **Restore and validate feedback.** Bring back descriptions, evidence-linked suggestions, caching and quota handling. Live feedback usefulness still needs evaluation.
6. **Bring back UI polish.** Home/Presentations navigation, Feedback/Playback organization and themes can follow the working flow.
```
**Original user-role message, S4:234** (2026-10-07 23:45:56.910 UTC; full text):

```text
I would like to implement whisper api and i would like to give gemini or openai feedback
```
**Revision and result:** the roadmap mentioned local Whisper; the next message chose the hosted API and Gemini/OpenAI feedback. Codex drafted the revised plan at S4:296, approved at S4:306. The roadmap is an authentic submitted message, not proof its polished wording was independently composed by the human. Codex restored PDF/recording using earlier teammates' source in [PR #14](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/14)/[PR #17](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/17), then storage [PR #18](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/18), processing [PR #19](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/19), review [PR #20](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/20) and feedback [PR #21](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/21). These PRs' acceptance/status differs from a merge; #17–#21 remain open at retrieval. Stage six's UI polish is a requested stage, not claimed completion. [PR #17](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/17) records 60 mobile tests/export, independent AI review, native build and synthetic emulator import/start-on-page-3/3→4→3 capture/replay; physical microphone quality and interruption checks remained pending.

### S4. Durable recording storage and retry acceptance, October 8

The roadmap's second stage supplied the feature request. After implementation had started, the requester asked for tighter checkpoints:

**Original user-role message, S4:1235** (2026-10-08 01:15:08.525 UTC; full text):

```text
Before continuing to next step stop and report what was implemented and replan for next stage. Receive my confirmation before continuing
```
**Original user-role message, S4:1306** (2026-10-08 01:20:07.215 UTC; full text):

```text
Plan next implementation goals and methodology. Use the local multi agent pipeline in implementation
```
The assistant's S4:1347 plan was approved in S4:1357. This opening excerpt records the concrete storage scope; it is an approved AI draft, not independently authored human prose:

**Original user-role message, S4:1357** (2026-10-08 01:26:25.968 UTC; verbatim opening excerpt; remaining plan omitted):

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
**Incorporation:** Codex implemented SQLite checkpoints, durable audio references, deck mapping, backend deck/attempt storage, retry and duplicate protection in [PR #18](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/18) at [`06fe340`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/06fe340a207639826143383364c13b4dd9636d31). The [final verification](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/06fe340a207639826143383364c13b4dd9636d31/docs/ai-use.md#L375-L387) records 94 mobile tests, 42 SQLite backend tests with two PostgreSQL-only skips, and 19 PostgreSQL storage tests. Agent-operated emulator/API-restart checks compared UUID, bytes/hashes, duration and visits through failure/retry/restart. They verify the exercised recovery cases; no measured time saving or human acceptance is claimed. The human changed the process by requiring a report/replan before the next implementation.

### S5. Hosted processing and saved rehearsal review, October 8

**Original user-role message, S4:2198** (2026-10-08 01:59:11.478 UTC; full text):

```text
plan feature/whisper-api-processing implementation.
```
The assistant wrote S4:2261; the user approved it at S4:2271. The exact opening scope was:

**Original user-role message, S4:2271** (2026-10-08 02:01:13.931 UTC; verbatim opening excerpt; remaining plan omitted):

```text
PLEASE IMPLEMENT THIS PLAN:
# `feature/whisper-api-processing` implementation plan

## Goal and boundaries

Connect **saved recording → explicit Analyze action → hosted Whisper → persisted transcript → slide alignment and metrics**.

The storage branch is clean at `06fe340`; [PR #18](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/18) remains open and unmerged. Start from that committed implementation and publish one stacked PR against `feature/recording-storage-upload`. Recheck the base before implementation in case storage has merged.

Keep local audio playback available throughout. Full synchronized review screens, feedback providers and UI redesign remain later implementations.
```
Codex reused Injoon's hosted adapter/alignment, added durable processing/admission/recovery, saved transcripts and a consent/polling client. [processing implementation and final checks](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c7733d8288833b010948d2c5737929088547aa1e/docs/ai-use.md#L397-L501) records mocked checks, PostgreSQL/Redis/Celery recovery cases and a controlled synthetic hosted pilot, separately from human-phone accuracy. The chosen architecture excluded local inference/model downloads. These are agent-run or attributed runner checks in the source log, not new executions for this report.

**Original user-role message, S4:3739** (2026-10-08 03:04:02.760 UTC; full text):

```text
Plan next proposed stage
```
The human then approved the assistant's S4:3790 plan at S4:3800. Its opening excerpt states what the review stage should do:

**Original user-role message, S4:3800** (2026-10-08 03:53:29.958 UTC; verbatim opening excerpt; remaining plan omitted):

```text
PLEASE IMPLEMENT THIS PLAN:
# `feature/rehearsal-review` implementation plan

## Summary

Make saved rehearsals reviewable with **actual PDF pages, audio, synchronized transcript, slide-visit navigation, and durable history**. Include server history and recovery of missing audio/PDF, as selected.

PR #19 is currently open and unmerged at `c7733d8`. Start from that implementation and publish one stacked PR against `feature/whisper-api-processing`. Recheck its merge status before branching.

Keep the current visual style. Feedback providers, Feedback/Playback tabs, themes, comparison, and deletion remain later work.
```
**Incorporation:** [PR #20](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/20), initially [`1305917`](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/130591744c976a1e7225b9c1b76172bb746ac3c4), added actual-PDF/audio/transcript review, history and independent media recovery. The [review repair and final verification log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/130591744c976a1e7225b9c1b76172bb746ac3c4/docs/ai-use.md) records six AI review rounds and repairs for asynchronous player state, stale PDF callbacks and exact token mapping; 209 mobile tests/export and agent-operated synthetic emulator seek/recovery checks passed at the final checkpoint. Those checks did not establish audible/perceptual synchronization on a physical phone. No exact human debugging prompt for each AI-review repair was recovered, so those findings remain log summaries.

<a id="p3-initial-ai-feedback-request-for-pr-21"></a>

### S6. Feedback scope, rejected PR split and quota behavior, October 8

**Original user-role message, S4:5652** (2026-10-08 05:45:56.287 UTC; full text):

```text
Plan ai feedback feature. Be aware of prompt injections slopsquatting and other problems common with api implementation. Also describe how each form of feedback will be given what feedback will be given and how it will be received and displayed
```
**Original user-role message, S4:5717** (2026-10-08 05:56:23.188 UTC; full text):

```text
Scope seems to large divide it into smaller tasks with checks in between each task
```
The agent answered at S4:5721 with five implementations and **five PRs**, which exceeded the requested implementation split. The human corrected that interpretation:

**Original user-role message, S4:5728** (2026-10-08 05:57:23.486 UTC; full text):

```text
Dont use various prs but when implementing split into the 5 parts and do the checks after each part upload on one pr
```
**Original user-role message, S4:5740** (2026-10-08 05:58:26.160 UTC; full text):

```text
Implement the proposed plan.
```
**Revision and result:** S4:5731 proposed five checked parts in one PR; the short approval above refers to that plan. Codex implemented adapters/evidence validation, durable descriptions, coaching persistence, review controls and controlled evaluation in [PR #21](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/21). The [feedback checkpoint/evaluation record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/ce9f248256b1bbfc0d66f139886503261cc25953/docs/ai-use.md) distinguishes AI review, synthetic infrastructure/device checks and small live-provider evaluations. Scope splitting improved inspectability; no productivity estimate is available. This is a verified **planning mismatch corrected by feedback**, not a hallucinated API.

**Original user-role message, S4:12339** (2026-10-08 12:32:09.003 UTC; full text):

```text
For gemini if quota problems just stop . Priority is openai
```
This later instruction changed implemented quota policy: stop Gemini jobs on local exhaustion and require explicit retry after cooldown, prioritize OpenAI, and retain provider choice without automatic fallback. The [PR #21](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/21) record reports eight synthetic Redis/Celery quota/recovery cases and zero automatic calls from stopped Gemini jobs. The command is not a measured evaluation of which provider is universally better.

### S7. Automatic transcription and cancellation review, October 8–9

**Original user-role message, S7:118** (2026-10-08 14:32:06.816 UTC; full text):

```text
Change corresponding pr such that transcription happens automatically after recording is over
```
**Original user-role message, S7:514** (2026-10-08 15:14:43.909 UTC; full text):

```text
Test this using android studio
```
**Context:** the earlier S5 plan required explicit Analyze. The new prompt deliberately revised that behavior to automatic transcription after saving, while coaching remained explicit. Codex changed PR #19 and synchronized dependents. An independent Codex reviewer found a delayed-status-read cancellation race. A regression failed before the fix; Codex made Cancel consume the pending automatic intent. The [automatic-transcription record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/a0ee4755fb6f9a56c77fd967bdd83d1f7a37c400/docs/ai-use.md#L503-L516) reports 125 tests/export and 47 focused tests in review. An agent-operated emulator observed a single process POST after Stop using a clearly synthetic API; that core check preceded the cancellation repair. Native first-use cancellation and human acceptance remain unverified. The implementation was accepted into the PR, not merged into `main`; repair time was not recorded.

### S8. Human testing evidence and its limits, October 6–7

**Original user-role message, S6:12** (2026-10-06 14:53:15.407 UTC; full text):

```text
Let's test the new features on phyiscal phone
```
**Original user-role message, S6:199** (2026-10-06 15:38:28.539 UTC; full text):

```text
Everything worked well./ Just that transccription isnt as accurate . update the presentation pptx. to accomodate for these changes. Also make the pptx more clear as it sounds to sloppy and disoriented
```
The report of successful phone use came at **00:38 KST on October 7**, with transcription accuracy as an exception. Codex prepared/installed the app and later revised presentation material; the human judged the phone flow. The message gives no device-by-device test matrix, quantified accuracy score or verified repair. This supports a human testing role while preserving the reported limitation. It must not be generalized into proof that every feature passed physical-phone acceptance.

## 6. Meaningful revisions and debugging sequences

Use the original quotations above once; this table explains the comparison without duplicating them.

| Sequence | Why the initial result/instruction was inadequate | Human decision and observable outcome |
| --- | --- | --- |
| [J1](#j1-local-pdf-import-persistent-catalog-and-page-viewer-october-4) → [J2](#j2-imported-pdf-in-practice-and-first-page-entry-october-4-feature-record) | The initial request covered import/viewing; the follow-up reported sample slides in Practice and specified its entry page. | Jaewon requested the imported PDF, Next and a reset to page one. `9547f1d` contains the changes; the agent phone check observed first-page entry but did not test Practice Next. |
| [S0](#s0-shared-scaffold-and-explainable-handoff-september-28) | Planning context included placeholder hours. | Redirected to scaffold/handoff and requested an explanation document. |
| [S2](#s2-playback-transcript-and-navigation-revision-october-6) | The user described the implemented three-tab UI as cluttered. | Approved the assistant's two-tab plan; `54078a3` contains the changed navigation. No usability gain inferred from tests. |
| [S3](#s3-rebuilding-the-current-feature-flow-october-8) | Roadmap carried forward local Whisper. | Specified hosted Whisper plus provider-selectable feedback; #19/#21 implement that choice. |
| [S6](#s6-feedback-scope-rejected-pr-split-and-quota-behavior-october-8) | Large feedback plan; assistant then proposed five PRs. | Human requested checks between five parts in one PR; #21 retains that boundary. |
| [S5](#s5-hosted-processing-and-saved-rehearsal-review-october-8) → [S7](#s7-automatic-transcription-and-cancellation-review-october-89) | Explicit Analyze was the earlier accepted behavior. | Later feature-change prompt switched to automatic processing; reviewer discovered/repaired a cancellation race. This is a requirement revision, not proof the earlier behavior was a bug. |
| [I2](#i2-hosted-whisper-adapter-and-response-shape-repair-september-29), [Y2](#y2-empty-android-timeline-after-stop-october-78) | SDK response and native Stop assumptions failed. | AI repaired defects after independent AI review or Jooyoung's recovered phone report. The initial recording request and the empty-timeline report are quoted above; the intermediate debugging exchange remains unavailable. |

No complete, independently verified **development-assistant hallucination** was recovered. The defects and operation/planning mistakes above are documented separately. No debugging duration or time-saving estimate was recorded for these examples.

## 7. Additional development/administrative prompts

### A1. Revert and consolidation: review workflow, not hallucination

[PR #10](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/10) says the reason for reverting #5 was to restore separate feature-owner review, not that all integrated code was defective. The dated [revert log](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/f6f6e76605632296a802aecef25ac10c6d0fd0cd/docs/ai-use.md) contains this **secondary quotation**, whose original user message was not recovered:

> Okay I want to revert #5 through new PR.

The agent preserved history and the previous AI-use log in `docs/history/pr-5-ai-use.md`. The process cost included reverting, reapplying and re-reviewing features; elapsed time is unknown.

**Original user-role message, S4:1155** (2026-10-08 01:11:59.727 UTC; full text):

```text
name the prs as feature/ and if they are similar make it into one branch
```
This original consolidation instruction led to [PR #17](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/17). #15 and #17 have the identical head `b60c357`; #14's PDF and #16's recording lifecycle work were retained. #14–#16 are closed without merge, and #17 is open at retrieval. The PR metadata establishes consolidation rather than discarded defective implementations. Ownership review with #13 remains necessary.

<a id="contributor-submission-form"></a>

## 8. Missing contributor evidence and confirmation checklist

| Person | What must be supplied or confirmed |
| --- | --- |
| Injoon | Export exact September 29 alignment, Whisper, transcript/playback and review prompts, including failed attempts and follow-ups. Confirm personal inspection, any hand edits, model/version and real-audio/device tests. Resolve Y1's requester label with Jooyoung. |
| Jaewon | Three original prompt quotations supplied in F1; “Teammate A” identity resolved by the requester and supplied text. Supply acceptance/edit decisions, any additional failed attempts/revisions, personally performed test/review steps and model/version if known. Keep the agent-operated phone mistake separate from human testing. |
| Jooyoung | Confirm who prompted Y1, the Y2 date/device/retest, tool/model, direct edits (if any) and device test notes. The representative recording/timeline and empty-timeline messages are now supplied as F2. |
| Seoyeon | Confirm S0–S8 messages and integration decisions, the human phone-test report, requester statements about all-code-by-AI/no hand edits, and the difference between reviewed plans and verified app behavior. Identify the report's human writer and obtain all four members' sign-off. |

Each contribution should provide an original export or accessible source, date, exact request and revisions, generated output accepted/modified/rejected, file/commit/PR, reviewer and performed tests. “No manual application-code edits” is a valid answer when confirmed; do not invent a hand fix. The requester confirms that AI wrote all application code, Codex was preferred, humans handled keys/sensitive data and phone testing, and humans reviewed plans. These are requester statements, not four separate attestations.

The current revision is a team-review draft in the existing documentation branch/PR. Local logs were inspected read-only; the appendix exposes selected project prompts, not private media or credentials. The raw session records have not been published. Contributor-accessible source handoff, full code-marker coverage on the eventual integrated source, Wiki publication/subpage/sidebar and submission remain outstanding.
