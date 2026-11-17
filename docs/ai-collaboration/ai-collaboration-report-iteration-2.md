# AI Collaboration Report – Iteration 2

**Team 07 · OutLoud · October 10–23, 2026 · Asia/Seoul**

**Written by:** Injoon · **Contributors:** Injoon, Jaewon, Jooyoung, Seoyeon

## 1. Where AI was used and deliberately not used

**AI work:** We used coding agents for code, tests, review and documentation ([PR #31](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/31)). Codex drafted this report.

| Contributor | Tool/model and work |
| --- | --- |
| Injoon | Codex `gpt-6.1-sol`: transcription and integration |
| Seoyeon | Codex: feedback (variant unrecorded), Review navigation (`gpt-6.1-sol`) |
| Jaewon | Claude `claude-opus-5-5`: UI rebuild; Codex (model unrecorded): recording controls |
| Jooyoung | Codex GPT-6 Luna: documentation and PDF investigation |

**Human work:** We handled API keys ourselves to protect credentials and performed [personal device tests](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki/Testing-Documentation) to judge usability firsthand.

## 2. Prompt history

The [full verbatim prompt log (Wiki)](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki/Iteration-2-%E2%80%93-Prompt-Log) and [repository copy](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/ai-collaboration-prompts-iteration-2.md) preserve our original requests.

## 3. What AI did well

- **Clear product rules helped AI stay within scope.** Seoyeon required transcript corrections to preserve what the presenter said. Codex removed free-text editing and restricted replacements to offered recognition corrections. The [server validation](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/c4a3f48d2a635bb2edb44828c62fb286b55f8d94/backend/rehearsals/services/corrections.py#L119-L136) enforces that boundary.
- **A second AI reviewer found what the first missed.** During Scribe integration, a reviewer found that Q&A could bypass transcription consent. Codex added the gate and [upgrade/cancel/retry tests](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/ai-collaboration-prompts-iteration-2.md#L3013-L3019).

## 4. Hallucinations and errors

- **AI wrote tests with incorrect assumptions.** A reviewer found a cue-confirmation test relying on another test's data. Codex reproduced the isolated failure and gave that test independent setup; the reviewer then passed the isolated test and all seven file tests ([record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/ai-collaboration-prompts-iteration-2.md#L852-L870)).
- **AI's readiness claim needed an emulator check.** Codex's usable-prototype claim conflicted with unnatural controls and navigation. After Injoon requested an emulator inspection, Codex fixed Back/cancel behavior, an accelerated timer and a first-recording review crash ([record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/ai-collaboration-prompts-iteration-2.md#L4440-L4491)).

## 5. Prompt revisions

- **Specific examples improved the evidence behind recommendations ([Injoon](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/ai-collaboration-prompts-iteration-2.md#L4595-L4740)).** **Before:** “How would you improve transcription accuracy and add filler-word and pause detection? Please compare the options and recommend an approach for our app.” **After:** “Test presentations 10, 12 and 5 with Whisper, Scribe and Gemini, then compare transcription accuracy, filler detection and cost.” Naming inputs, models and criteria led to recording/reference comparisons that informed our Scribe choice.
- **One-phase instructions made a broad request easier to review ([Seoyeon](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/4b5ac7becfaf342bba90c3b8b9d76b4138a6b5ee/docs/ai-collaboration-prompts-iteration-2.md#L729-L805), verbatim excerpts).** **Before:** “Let's plan to implement the following features by making a branch from JJ's frontend code.” **After:** “Start implementation with Phase 1 only.” The follow-up added tests, diff review and an inspection checkpoint. Codex delivered the requirements foundation before later UI work, giving us a smaller change to inspect.

## 6. Manual fixes and why

- **We made no manual application-code edits.** We preferred having coding agents make changes and run automated tests, so we requested AI revisions rather than editing the code ourselves.
- **We used AI revisions and performed our own device tests.** For B09, we reported the retry failure; Codex wrote regressions and fixed the recorder. Four regression cases failed before the fix; all five passed afterward ([separate fix branch](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/3ae9d16/docs/b09-retry-recording.md)). We assessed app behavior and usability through our [personal device tests](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki/Testing-Documentation).

## 7. Takeaway for Iteration 3

- Define product rules and divide work into reviewable phases.
- Specify inputs and comparison criteria before asking AI for recommendations.
- Review test assumptions and demonstrate user flows before accepting completion claims.
