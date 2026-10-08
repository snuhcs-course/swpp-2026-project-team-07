# AI Collaboration Report – Iteration 1

Period: September 26 – October 9, 2026.

## 1. Where AI was used, and where it was not

AI wrote all of OutLoud's application code this iteration. OpenAI Codex wrote PDF import, recording, Whisper transcription, slide alignment, playback, the mobile interface, tests and bug fixes. It also drafted plans and installed builds on test devices.

Each member directed Codex on their own feature: Injoon on transcription and alignment, Jaewon on PDF import, Jooyoung on recording, Seoyeon on integration.

We kept three kinds of work for ourselves:

- **API keys and sensitive data.** We created and entered API keys and other private data ourselves, and made sure no key was submitted in a prompt, because a leaked key could cause a security breach.
- **Physical phone testing.** We tested each feature locally on a real phone before creating its branch, and pushed it only after the tests passed. We did these checks by hand: recording real speech, moving through slides and judging whether the app felt right.
- **Plan review.** Codex drafted a plan before each larger change. We read every plan and sent it back with feedback until it matched what we wanted (see Section 5).

## 2. Prompt history

Two examples; more are in the [prompt appendix](ai-collaboration-prompts-iteration-1.md).

October 6, interface request: “I want to make it so transcript goes along with playback highlighting the current word it is t. Also place transcript inside the playback area.”

One concrete behavior gave Codex a clear target and gave us a clear check.

October 8, review workflow: “just post it as a pr so another person can check the code but continue implementing other features,”

This kept a human reviewer between AI-written code and the main branch.

## 3. What AI did well

Injoon had Codex build slide alignment before adding Whisper and the transcript screen. Codex wrote `align_words` and nine tests, preserved in [e71c3e0](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/e71c3e06945517219b9a343e80f9680829c0bd58). The tests covered returning to earlier slides, silence, invalid input and exact boundaries. For example, a word starting at 4,000 milliseconds belongs to the slide that begins then; a word starting at 3,999 stays with the previous slide.

All nine tests and the 14-test backend suite passed, and Injoon reviewed the final changes. Takeaway: define the timing rules first, then check that generated tests cover the edge cases.

## 4. Hallucinations and errors

Codex's Whisper adapter crashed when the API returned a successful response whose body was not a JSON object. It raised `AttributeError` instead of `TranscriptionError`. A separate AI review caught the problem. Codex added a type check and tests for array, null, string and integer responses; afterward, nine transcription tests and 23 backend tests passed ([repair record](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e71c3e06945517219b9a343e80f9680829c0bd58/docs/ai-use.md#L152-L176)). Takeaway: ask for tests on unexpected inputs, not only normal ones.

We also had workflow problems. PR #5 combined several features, so we [reverted it in #10](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/10) to review them separately. PRs #14–#16 overlapped, so we closed them and [combined their code in #17](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/17). Takeaway: AI produces code faster than we can review it, so each PR needs a small scope and one owner.

## 5. Prompt revisions

Before (October 6): “Also I would like the main screen to be divided into sdifferent tabas of presentations, librabry, home screen”

Codex planned three tabs. On review, we wrote: “I feel like the ui is too cluttered right now how could we change it”. We approved Codex's revised plan:

After: “Use **Home + Presentations** as the two main tabs.”

The revised plan told Codex what mattered: merge Library into Presentations, make practice easy to reach, and open saved rehearsals on Feedback. [54078a3](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/54078a33a2409aae8d671aaabca6d26476f0ea02/docs/ai-use.md#L467-L480) records the change, 52 passing mobile tests and emulator checks. Takeaway: say what to remove and what users should reach first.

## 6. Manual fixes and why

No one edited application code by hand this iteration. When something broke, we described the problem and Codex wrote the fix. For example, Jooyoung found that the Android recording timeline was blank, reported it, and confirmed on the device that [Codex's fix](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/040880f8a21b2f866228984e9fb3c438fa6ee4bf/docs/ai-use.md#L319-L352) worked.

Codex was our preferred coding agent, so every fix went through it. Our effort went into the Section 1 work and into judging whether each fix solved the real problem.
