# AI Collaboration Report – Iteration 1

**Team 07 · OutLoud · September 26–October 9, 2026**

Contributors: Injoon, Jaewon, Jooyoung and Seoyeon.

## 1. Where AI was used and deliberately not used

- **Tools:** We used OpenAI Codex. Injoon and Seoyeon used `gpt-6-astra`. Jaewon's and Jooyoung's model versions were not recorded.
- **Development:** Injoon used Codex for alignment, Whisper and transcript playback. Jaewon used it for PDF import/viewing. Jooyoung used it for recording. Seoyeon used it for integration and interface work. We also used Codex for tests, review and documentation.
- **Without AI:** We handled API keys and sensitive data on our own machines to keep them out of prompts. We reviewed plans and tested phone behavior.

## 2. Prompt history

- [Iteration 1 prompt logs and task notes](README.md#iteration-1-logs)

## 3. What AI did well

- **Alignment ([Injoon, PR #3](prompt-logs/injoon/iteration-1.md#record-004)):** Codex wrote `align_words` and nine tests. These covered slide boundaries, repeated visits, silence and invalid timestamps. Clear timing rules made the output easy to check. The tests used synthetic data; human-speech accuracy remained untested.
- **Recording storage ([Seoyeon, PR #18](prompt-logs/seoyeon/iteration-1.md#record-018)):** Codex added restart recovery and upload retries. Checks included 94 mobile tests and 19 PostgreSQL storage tests. Codex also checked that retries kept the same recording ID, audio and timeline. This checked data preservation after failures. We did not measure time savings.

## 4. Hallucinations and errors

- Our records show code bugs. We have no confirmed example of a coding-assistant hallucination.
- **Whisper response ([Injoon](prompt-logs/injoon/iteration-1.md#record-005)):** The adapter assumed a successful response supported `model_dump()`. An independent Codex reviewer found that other response types caused `AttributeError`. Codex added a type check and tests for invalid responses. All 23 backend tests passed.
- **Empty timeline ([Jooyoung](prompt-logs/jooyoung/iteration-1.md#record-012)):** Jooyoung found an empty timeline on Android. Stop reset the recording duration before the code read it. Codex changed the code to save the duration first. She confirmed the timeline appeared. The repair needed a helper, a caller change and retesting. We did not record elapsed repair time for either defect.

## 5. Prompt revisions

- **Playback ([Injoon](prompt-logs/injoon/iteration-1.md#record-006)):** Before, he approved the saved-result screen: “알겠어 그렇게 해줘”. After: “내가 생각했던 전사가 있으면 녹음의 진행에 따라 단어가 하이라이트가 되는 거지.” (excerpt). The correction stated how text should follow audio. Codex added word highlighting and tap-to-seek. PR #4 records 21 mobile tests and emulator checks. We still need to check how well the highlighting matches the audio.
- **PDF entry ([Jaewon](prompt-logs/jaewon/iteration-1.md#record-009)):** Before: “change them to the uplaoded pdf file and maintain the next slide feature in the same tab.” After: “it always goes back to the first slide” (both excerpts). The added rule defined the starting page. Codex set `slide: 0` at `9547f1d` and checked page-one entry on a phone. Codex did not test Practice's Next button on the phone.

## 6. Manual fixes and why

- No one reported editing application code by hand. In our recorded workflow, we asked Codex to make repairs because it was our preferred coding agent. Our work included Injoon's code inspection, Jaewon's behavior constraints and Jooyoung's bug report and retest.
- AI code comments appear in [alignment.py](../../backend/rehearsals/services/alignment.py#L1) and [33 other baseline modules](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-before-submission-cleanup.md#ai-code-markers). We still need to check the final integrated code.

## 7. Takeaway for Iteration 2

- We will describe expected behavior in the first prompt. The highlighting and first-page revisions showed that general requests left key behavior unclear.
- Separate AI review caught a wrong response assumption. We will keep this review step and add a test for each confirmed bug.
- Phone testing exposed the empty timeline. We will test recording, playback and recovery on a real phone before marking a feature complete.
