# AI Collaboration Report – Iteration 4

**November 7–20, 2026**

## 1. Where AI Was Used and Deliberately Not Used

Codex supported implementation, testing, UAT planning, and documentation. Seoyeon also used Claude Code for the feedback rebuild, then continued with Codex. Logs usually record GPT-6, without exact variants. AI reviewers were agents, not human reviewers; Scribe and OpenRouter were app providers.

Jooyoung requested Seoul scripts without editing the UAT sheet. Jaewon scoped the language control to a preference toggle, not translation. Seoyeon stopped the Korean tester patch before implementation. UAT scenarios and synthetic checks did not replace human feedback-quality assessment.

## 2. Prompt History

The [Iteration 4 prompt logs](README.md#iteration-4-logs) preserve the full prompts, follow-ups, tools, and recorded outcomes for [Injoon](prompt-logs/injoon/iteration-4.md), [Jaewon](prompt-logs/jaewon/iteration-4.md), [Jooyoung](prompt-logs/jooyoung/iteration-4.md), and [Seoyeon](prompt-logs/seoyeon/iteration-4.md). The Jaewon file is stored under Iteration 4, while its task entries retain “Iteration: 2”; confirm this label before submission.

## 3. What AI Did Well

- **Feedback work became testable and shippable.** Seoyeon turned a broad request into progressive per-slide feedback with input reuse, revisit handling, recovery, and whole-presentation review. Codex completed the v10 integration in [PR #60](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/60). The code records Claude Code assistance in the [feedback pipeline attribution comment](../../backend/rehearsals/feedback_v3/pipeline.py#L3). Release checks passed 669 mobile tests and 710 PostgreSQL backend tests; agent-operated phone checks covered Live feedback and After Stop. A synthetic benchmark found 16/16 rebuilt attempts and 7/16 old attempts met their validators across 32 attempts and 292 requests. The 4.8–11.4× speed estimate varied by workload; model settings and caching differed. [v10 evidence](../testing/evidence/incremental-phone-test-2026-11-15.md) · [benchmark log](prompt-logs/seoyeon/iteration-4.md)
- **Focused UI prompts produced bounded changes.** Jaewon’s repeated Home and Review requests led to route, gesture, and animation changes with tests and APK builds. Independent AI reviews found interaction races and rendering edge cases; the agent fixed them. These reviews were not human approval, and several phone checks could not establish visual or usability acceptance.
- **The UAT plan gained observable steps.** Jooyoung separated upload, recording, grading, delivery analysis, feedback consistency, and audience-specific Q&A. Sheet readback caught a write to the wrong column; the correction was made and read back. No app UAT was performed. [UAT and script log](prompt-logs/jooyoung/iteration-4.md)
- **Repository work retained evidence.** Injoon’s log records mobile coverage work and documentation restructuring, with test, archive, and link checks. Jaewon’s prompt revisions also record full mobile suites, APK builds, and limited phone checks for UI behavior.

## 4. Hallucinations and Errors

The logs do not confirm a model hallucination. Checks caught stale route expectations, an animation mock that did not evaluate styles, review defects in stale results and gesture handling, and a spreadsheet write to the wrong column. Corrections were checked again. A cue-reconnection phone check timed out at authenticated readiness; the cause was unresolved, and the public edge’s 401 did not establish backend health. Feedback usefulness and Korean score calibration remain unverified.

## 5. Prompt Revisions

- **Seoyeon:** “plan with me” named broad quality goals. “Review should display existing results rather than trigger generation” added a reuse rule and made the feedback flow testable.
- **Jooyoung:** “fill in UAT Document” became detailed ordering, in-app actions, transcript checks, and separate scripted and spontaneous cases, resolving overlap between upload and recording.
- **Jaewon:** “make all the animations” visible was refined with return destinations, Q&A layering, and touch behavior, helping expose route and gesture edge cases.

## 6. Manual Fixes and Why

The logs attribute implementation and test repairs to AI agents; they do not record human code edits, so we cannot claim that none occurred. Jooyoung supplied scenario decisions and corrected UAT requirements. Seoyeon selected the feedback scope and requested PR #60; the v10 implementation was merged. Jaewon’s UI work came from a separate source snapshot, so its source comments could not be checked here. No contributor has recorded human approval of the report’s product-quality claims.

## 7. Takeaway for Iteration 5

- Turn broad goals into observable behavior, input rules, and recovery cases before implementation.
- Keep automated checks, device observations, and human quality judgments separate. The next iteration should record controlled bilingual comparisons and human ratings before claiming consistent scores or useful feedback.
- Check each contributor log’s iteration labels and source entries with that contributor before report submission.
