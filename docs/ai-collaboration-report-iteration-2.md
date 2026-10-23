# AI Collaboration Report – Iteration 2

**Team 07 · OutLoud · October 10–23, 2026 (Asia/Seoul)**

**Provisional draft as of October 23.** Rotating writer, contributor confirmation and final review remain pending. Coverage is incomplete; see the [coverage record](ai-collaboration/iteration-2/README.md) and refresh before final review and submission.

## 1. Where AI was used and deliberately not used

We used AI for implementation, tests, review and documentation. Injoon’s Scribe work used Codex (`gpt-6.1-sol` per recovered context; serving variant unverified). Jaewon used Claude (`claude-opus-5-5`) for the UI rebuild and Codex for recording refinements (model not recorded). Seoyeon used Codex (`gpt-6.1-sol`) for Review navigation. Jooyoung used Codex (GPT-6 Luna) for documentation reorganization, report drafting and PDF investigation. Development assistants are separate from ElevenLabs `scribe_v2`.

Seoyeon reports avoiding AI for API keys and actual human testing. Reasons for other members’ deliberate non-use remain unconfirmed.

## 2. Prompt history

The [Iteration 2 log](ai-collaboration-prompts-iteration-2.md) consolidates prompts and outcomes from the available branches, including Jooyoung’s documentation-reorganization requests and follow-ups. Section 5 preserves exact revision examples. Full-history and owner privacy review remain pending; missing metadata does not mean no AI use.

## 3. What AI did well

Codex coordinated the Scribe adapter, provider-specific consent, historical-result compatibility and visited-slide vocabulary hints. The [integration record](ai-collaboration-prompts-iteration-2.md#scribe-v2-integration-onto-merged-main--october-16-2026) reports 296 backend tests on disposable PostgreSQL, 180 mobile tests and Android JavaScript export passing; these are agent-operated checks, not human acceptance.

On Jooyoung’s [documentation branch](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/e4263cd), Codex created an index/routing policy, reorganized references and prepared a [pre-close report](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/e4263cd/docs/ai-collaboration/iteration-2/report-draft.md). After main integration, the [cleanup evidence](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/1b69db0/docs/evidence/iteration-2/documentation/documentation-cleanup.md) reports 510 links across 60 Markdown files, 306 mobile tests and 396 backend tests passed, with 24 PostgreSQL-specific skips. The report prose was AI-generated; the branch records Jooyoung’s requests and decisions, not manual authorship of that prose.

Injoon’s saved phone findings led to [a separate recorder fix](https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/fix/retry-recording/docs/b09-retry-recording.md): four new regression cases failed before the change, then all five passed with 553 mobile tests. Codex’s Galaxy S25 checks covered consecutive retakes and Keep/Overwrite; these were not Injoon’s manual retest, and the reported seven-second timer jump remains unreproduced.

## 4. Hallucinations and errors

The agent initially counted five fillers because its punctuation filter excluded `uh--`; it checked the receipt, corrected the count to six and reran the parser assertion. A separate reviewer found that Q&A could bypass Scribe consent; Codex added the gate and retry/cancel tests. Repair time and token cost were not recorded.

Jooyoung’s documentation branch first reflected an earlier decision to treat Q&A as optional. She later corrected the scope because Q&A was already implemented; current documentation was updated while historical prompts remained unchanged. This is a human scope correction, not an AI hallucination. Her malformed-PDF log confirms two upload HTTP 500s from invalid extracted text; it does not prove the upload caused every reported app-wide lag symptom.

## 5. Prompt revisions

Jaewon clarified that the three-second hold applied to whole-presentation redo, while single-slide redo retained tap and confirmation. Injoon changed from emulator to phone after microphone injection failed; the record distinguishes the failed capture from later USB testing. Jooyoung’s broad documentation review became a scoped reorganization plan with a directory taxonomy, source-retention rules and explicit verification limits. A later Q&A correction updated current scope without rewriting the earlier prompt.

## 6. Manual fixes and why

Seoyeon reports no manual application-code edits and describes personal phone checks, but device/date and detailed results remain incomplete. Injoon reports nine October 19 observations on a Galaxy S25; this is not an all-flow pass, and he reports no manual code edits. For Jooyoung, October 23 manual observations on a Galaxy Tab S7 FE (app version identified as “PR #31”) include two malformed-PDF upload attempts that returned HTTP 500. She also reported tablet layout issues; upload and Home content appearing together, including the duration prompt over a Home icon; repeated deck data; transcript playback not switching the play control to pause; a malformed-PDF upload screen glitch and a failed-take message; rerecord playing audio instead; and controls/swipe-back becoming unresponsive while encoding errors appeared in Docker logs. Her write-up cites a Docker log and video, but neither was independently inspected and no media timestamp was recorded. The log supports the malformed-input server failure; it does not establish that it caused every reported lag or UI symptom. Manual code edits, reasons for stopping prompting and deliberate AI non-use remain unconfirmed. Agent-operated checks are not human tests.

## 7. Takeaway for the next iteration

Keep one canonical prompt log and add branch-sourced entries promptly. State expected behavior and verification boundaries in the first request, preserve historical wording when scope changes, and record human test metadata while separating observed symptoms from proven causes. Contributors still need to confirm their edits, non-use and report review.
