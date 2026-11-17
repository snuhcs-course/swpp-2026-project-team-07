# Unattributed — Iteration 1

[AI collaboration index](../../README.md). Entries retain their recorded context and attribution.

<a id="record-002"></a>

<a id="recorded-iteration-1"></a>

## Recorded Iteration 1

**Historical opening notes — retained source wording:**

**Team 07 · OutLoud · September 26–October 9, 2026**

This log documents our AI-assisted development: prompts, generated work, revisions, errors and verification. Prompt wording is unchanged; excerpts and AI-written plans are labelled. Results refer to the cited code revisions.

[AI Collaboration Report – Iteration 1](../../ai-collaboration-report-iteration-1.md)

<a id="2-injoon-transcription-and-alignment"></a>

Additional local prototype task notes were consolidated on October 17 from a
[frozen source record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md). Notes labelled as summaries retain the source's
checks and limitations; they do not reconstruct missing prompts or establish fresh testing.

<a id="record-011"></a>

<a id="i1-y1-microphone-capture-and-local-preview-september-30"></a>

#### Y1. Microphone capture and local preview, September 30

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

<a id="record-023"></a>

<a id="i1-additional-developmentadministrative-prompts"></a>

### Additional development/administrative prompts

<a id="record-024"></a>

<a id="a1-revert-and-consolidation-review-workflow-not-hallucination"></a>

<a id="i1-a1-revert-and-consolidation-october-78"></a>

#### A1. Revert and consolidation, October 7–8

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

<a id="record-025"></a>

<a id="a2-additional-quotations-from-the-retired-log-october-69"></a>

<a id="i1-a2-repository-and-documentation-tasks-october-69"></a>

#### A2. Repository and documentation tasks, October 6–9

These task-log excerpts cover branch management, report writing and documentation review. Each entry links to its task record.

**Tool:** OpenAI Codex · **Model:** see the linked task records; not recorded for all tasks.

**Task-log excerpt · 2026-10-06 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-06--merged-github-branch-cleanup)**

```text
old onloud branches on git
```

**Task-log excerpt · 2026-10-06 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-06--after-hours-publication-follow-up)**

```text
push on new branch
```

**Task-log excerpt · 2026-10-07 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-07--preserve-prototype-and-restore-original-github-branch-layout)**

```text
yes back up everything so we have a view and then delete the branches so my teammates can reupload like before
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--ai-collaboration-report-preparation-and-task-log-formatting)**

```text
Make ai collaboration report guideline for our project.
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--reflective-ai-collaboration-report-revision)**

```text
The current draft is historically careful but reads too much like an evidence audit rather than a reflective account of human–AI collaboration.
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--focused-report-edit-and-non-use-claim-review)**

```text
Make a focused editorial revision, not a major rewrite.
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--focused-report-edit-and-non-use-claim-review)**

```text
make a light editorial revision of the existing report: simpler English, fewer disclaimers, preserved verbatim quotations, and more emphasis on what the team learned.
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--feature-focused-iteration-1-collaboration-report-and-source-attribution)**

```text
Do not merely polish the existing text. Reevaluate its structure, content, evidence and compliance against the official course requirements.
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--local-commit-preparation-after-requester-edits)**

```text
commit these changes
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--jaewons-supplied-pdf-and-practice-prompts)**

```text
This is jaewon's work, update the ai-collaboration-prompts document
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--injoons-recovered-alignment-whisper-and-playback-prompts)**

```text
Can you edit the appendix with the actual prompts that I used?
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--simplified-injoon-entries-and-incorporated-jooyoungs-update)**

```text
I feel like we don't need the english meaning part. I want to keep it simple and close to the other members.
```

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--verify-course-format-and-simplify-the-iteration-1-prompt-appendix)**

```text
I want to remove unnecessary stuff from the iteration 1 prompt appendix file.
```

**Historical source supplement — `root-local-i1`.** Unique source wording follows; overlapping older attribution or status is retained as a historical variant, not a new correction.

The following are historical task-log summaries. The tool was OpenAI Codex;
models and requesters are unrecorded/unconfirmed unless stated otherwise.

- **Branch management:** Codex checked ancestry and open PRs before deleting seven merged remote branches, retaining local refs ([source task record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). Seoyeon explicitly authorized the later backup/restoration: checks verified archived-file hashes, all 49 valid refs, bundle recovery, original feature tips, closure of two unmerged draft PRs and nine approved remote deletions; main was unchanged ([Seoyeon’s restoration record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). These were repository checks, not new application tests.
- **After Hours appearance:** Codex implemented saved light/dark/system themes, bundled fonts and revised capture/playback layouts. TypeScript/lint, 54 tests, Android export and a JDK 17 debug build passed; separate AI review reported no actionable finding ([source task record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). The authorized publication reused unchanged evidence ([publication](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). The subsequent emulator install/launch succeeded, but desktop controls could not inspect it; visual switching, persistence and human/device acceptance remained unverified ([launch](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)).
- **TA presentation artifacts:** Codex created a seven-slide template deck and demo runbook, then revised a supplied presentation into nine slides with branch history ([template preparation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [supplied-deck update](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). A ten-slide revision incorporated the reported phone result while retaining the transcription limitation ([phone-result update](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). A later required-template deck used seven sections and updated schedule evidence ([required template](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)); the final focused edit changed only slides 4, 9 and 10 of the user's ten-slide deck and identified remaining template gaps ([focused edit](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). Package/reimport, notes and rendered-layout checks passed as recorded; native PowerPoint execution and meeting rehearsal were not checked.
- **Shared schedule and demo preparation:** The October 7 schedule update preserved assignments and recorded hours, labelled new effort estimates, used repository publication evidence for dates, and verified saved-sheet readback/export preservation ([source task record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). Separately, Codex booted the Mac emulator, copied the requested demo PDF and checked server reachability; the user chose manual import, so no import/navigation/processing was verified in that run ([emulator preparation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)).

**Task-log excerpt · 2026-10-06 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-06--merged-github-branch-cleanup)**

**Task-log excerpt · 2026-10-06 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-06--after-hours-publication-follow-up)**

**Task-log excerpt · 2026-10-07 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-07--preserve-prototype-and-restore-original-github-branch-layout)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--ai-collaboration-report-preparation-and-task-log-formatting)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--reflective-ai-collaboration-report-revision)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--focused-report-edit-and-non-use-claim-review)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--feature-focused-iteration-1-collaboration-report-and-source-attribution)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--local-commit-preparation-after-requester-edits)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--jaewons-supplied-pdf-and-practice-prompts)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--injoons-recovered-alignment-whisper-and-playback-prompts)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--simplified-injoon-entries-and-incorporated-jooyoungs-update)**

**Task-log excerpt · 2026-10-09 · [source entry](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/5aed316179a7d093f7db02732e792d1fc7c98444/docs/history/ai-use-before-prompt-consolidation-2026-10-09.md#2026-10-09--verify-course-format-and-simplify-the-iteration-1-prompt-appendix)**

<a id="record-031"></a>

<a id="i1-a9-earlier-prototype-task-notes-september-29october-4-2026"></a>

#### A9. Earlier prototype task notes, September 29–October 4, 2026

**Contributor:** unconfirmed for these supplemental task notes · **Tool:** OpenAI Codex · **Model:** not recorded

- **Request provenance — summaries:** The [shared-guidance record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md) describes the requested repository instructions and AI-use workflow. The [integration record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md) and four milestone records summarize approved integration/storage/transcription/feedback/mobile-flow work; original prompts are not reconstructed here. Existing alignment, Whisper, PDF and recording entries above retain their contributor-specific prompt evidence.
- **Output and use:** Codex combined existing PDF/recording branches, then implemented durable deck/attempt storage, local CPU INT8 transcription, cached optional feedback and automatic save/upload/process with recovery ([storage](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [local transcription](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [cached feedback](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [mobile flow](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). These are the earlier prototype, distinct from October 8's later feature stack.
- **Verification and errors:** Integration passed 23 mobile and 23 backend tests. The milestone sequence reached 31 mobile and 45 backend tests plus static/export checks, with recorded PostgreSQL/Redis/worker checks and agent-operated emulator recovery tests. Independent AI reviews found and rechecked duration loss, failed-stage redelivery, stale feedback evidence and finalization/navigation defects. Synthetic inference exposed multilingual omissions and words on silent audio; Codex added a speech-presence gate. Provider feedback tests were mocked, and no live Gemini request or measured human-speech acceptance was established. The source retains each revision's exact checks and remaining pilot limits.

<a id="record-032"></a>

<a id="i1-a10-schedule-workbook-and-shared-sheet-revisions-october-9-2026"></a>

#### A10. Schedule workbook and shared Sheet revisions, October 9, 2026

**Contributor:** unconfirmed · **Tool:** OpenAI Codex · **Model:** not recorded

- **Request provenance — summaries:** The user approved the first split-task workbook, then a feature-focused v2 with eight unexpected tasks, half-hour allocation and Hold for open-PR work; subsequently requested applying v2 to the shared Sheet and correcting row order/dividers ([first revision](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [v2](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [shared Sheet](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [row correction](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)).
- **Output and human decisions:** V2 replaced the first revision's 20 unexpected tasks with eight, leaving 30 Iteration 1 tasks, 15 later tasks and 46 cleared slots. Original totals stayed 14 human/16.5 agent hours; approved added estimates yielded 19 human/28 agent hours. The user chose feature-level scope, preserved assignments and approved task-time estimates; estimates are not measured human or summed parallel-agent effort.
- **Verification and limits:** Workbook checks reconciled tasks, parent/member totals, half-hour allocation, formulas, five charts and preserved worksheet parts with no cached errors. Live readback matched v2 values/formulas and retained Overview/Config. An exported download returned HTTP 403, so that phase did not establish native visual verification; the later authenticated-browser check showed the corrected row order/dividers. No application test, Git publication or new human review was performed.

<a id="record-033"></a>

<a id="i1-a11-figma-exports-and-evidence-linked-coaching-wireframe-october-9-2026"></a>

#### A11. Figma exports and evidence-linked coaching wireframe, October 9, 2026

**Contributor:** unconfirmed · **Tool:** OpenAI Codex · **Model:** not recorded

- **Request provenance — summaries:** The user requested every screen/board export, then S07F in the existing file through the browser ([exports](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [S07F wireframe](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)).
- **Output and use:** Codex organized 29 screen PNGs and three board PNGs in a ZIP with a hash/dimension manifest. It separately authored/pasted an illustrative S07F vector wireframe showing slide/speech evidence, timestamp references, explanation and recovery/navigation captions. Existing screens were retained; the wireframe has no executable prototype actions and selected-slide retry remains planned.
- **Verification and errors:** ZIP CRCs, all 32 PNG decodes and expected screen sets passed. Live S07F frame/export inspection passed. Accidental temporary lock toggles were undone and checked; a read-only MCP quota failure led to the requested browser route. No application integration, build, device test or human acceptance was established.

<a id="record-034"></a>

<a id="i1-a12-ai-collaboration-report-pdf-export-october-9-2026"></a>

#### A12. AI collaboration report PDF export, October 9, 2026

**Contributor:** unconfirmed · **Tool:** OpenAI Codex · **Model:** not recorded

- **Request provenance — summary:** The user requested a submission PDF of PR #22's report, then formal black typography and dividers ([source task record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)). The frozen source retains the explicitly quoted requests; this summary does not supply additional verbatim prompts.
- **Output and revisions:** Codex exported the report at PR #22 head `97060a2` as one A4 page, retaining all 26 paragraphs, Korean quotations and nine exact-revision references. Human feedback replaced colored styling with Times New Roman/black text and added six section dividers without changing extracted text or reference URLs.
- **Verification and limits:** Generation/text/link/bounds checks, one-page/A4 checks and rendered visual inspection passed after each revision. These are artifact checks; contributor sign-off, Wiki publication and eTL submission were not performed by this export task.

<a id="record-035"></a>

<a id="i1-a13-design-pdf-layout-and-concise-submission-revisions-october-9-2026"></a>

#### A13. Design PDF layout and concise submission revisions, October 9, 2026

**Contributor:** unconfirmed · **Tool:** OpenAI Codex · **Model:** not recorded

- **Request provenance — summaries:** The user requested standalone titled diagram pages, then concise wording without References/Maintenance, then removal of story/revision/scope clutter and seconds-based examples ([layout reflow](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [concise Rev.4.4](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md); [submission cleanup](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)).
- **Output and revisions:** Codex first made a 30-page layout export preserving eleven original diagrams, then a 14-page concise document with five vector diagrams and planned features separated from implemented behavior. The final cleanup retained the required revision history and planned topics. Seconds are explanatory examples; provider adaptation/storage/alignment still use integer milliseconds. The reviewed implementation source was integration `ce9f248`, not this prototype or a claim about current main.
- **Verification and limits:** Checks reconciled source text, decoded diagram pixels for the layout pass, page sizes, diagram-only pages, 11 pt text, bounds and removed sections/tags; rendered-page inspections passed. Each prior output/source was backed up, and the designated submission-folder PDF matched the checked export. No application changes, Wiki publication, eTL upload or human approval were performed by these PDF tasks.

<a id="record-036"></a>

<a id="i1-a14-requirements-wiki-and-matching-pdf-simplification-october-9-2026"></a>

#### A14. Requirements Wiki and matching PDF simplification, October 9, 2026

**Contributor:** unconfirmed · **Tool:** OpenAI Codex · **Model:** not recorded

- **Request provenance — summary:** The user approved retaining the abstract, removing the final appendix and simplifying NFR-05 ([source task record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/ai-collaboration-prompts.md)).
- **Output and use:** Codex preserved the abstract, nine mandatory stories, 34 acceptance criteria and 18 images; simplified privacy wording and removed the requirement-ID appendix. The authorized Wiki save is revision `7e746cdd8ad4f200540fbd55428e151f48097348`; fetched Markdown matched the approved local source. The corresponding 22-page PDF was updated.
- **Verification and errors:** The remote diff changed only the requirements page and passed whitespace checks. Eleven PDF/source checks passed; 18 unchanged pages were pixel-identical and four changed pages were visually inspected. The first sandboxed PDF build failed; the permitted external run succeeded. No application test/build, main-repository commit/push/merge, teammate review or eTL submission was performed by this task.

## Earlier Iteration 1 records

### October 9 report revisions

The Iteration 1 report requester provided these excerpts in Claude Code (Claude Opus 5.5). The source does not name the requester. The statements record the requester's account of team practice. Per-feature phone tests are not independently documented in the source. See the [original review and context](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-before-feature-audit.md#requester-confirmed-revision).

> As a team all our code was written by ai. Non ai portions were handling api keys and sensitive data, physical phone testing, and making good plans by reading plans and giving feedback on it

> After every feature was implemented before making branch it was tested locally on phone and after tests passed it was pushed into branch

> had to make sure that keys werent submitted to the prompt which caould lead to securtiy breaches.

> preferred coding agent

### October 4 prototype integration

The [PR #5 integration record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/pr-5-ai-use.md#2026-10-04--existing-feature-branch-integration) records Codex and an agent reviewer combining the viewer and recording branches, reconciling slide tracking and correcting the native duration reset on stop. It records 23 passing mobile tests, Android JavaScript export and 23 passing backend tests. Provider calls were mocked and the integration session had no connected Android device. The source summarizes the request and leaves the requester unnamed.
