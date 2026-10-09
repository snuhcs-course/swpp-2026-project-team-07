# AI collaboration reporting guide

Based on the [official AI Collaboration Report Guidelines](https://myetl.snu.ac.kr/courses/305891/files/9386035), pp. 1–3. Maintain one collaboration log per iteration and use it to write the team report.

## Working documents

| Document | Purpose |
| --- | --- |
| [Collaboration log](ai-collaboration-prompts-iteration-1.md) | Actual prompts, tool/model metadata and concise task notes; update during work and at handoff |
| [Report](ai-collaboration-report-iteration-1.md) | The team's analysis of AI use, results, failures, revisions and human decisions |
| [This guide](#human-review-before-submission) | Collection rules, report format and human review checklist |

The earlier [AI-use record](history/ai-use-before-prompt-consolidation-2026-10-09.md) and [validation review](history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md) are archived. Keep one collaboration log per iteration at `docs/ai-collaboration-prompts-iteration-N.md`. Do not recreate either retired document as an active log.

## Compact task entry

| Field | Record |
| --- | --- |
| Context | Contributor, date, task, tool and model; note changes during the task |
| Prompts | Actual requests and meaningful follow-ups, verbatim and in order |
| Output and use | What AI generated and what was retained, changed or rejected; file/commit/PR |
| Verification | Who checked it, how, the result and relevant limits |
| Hallucinations/errors | Wrong claim or behavior, why it was wrong, how/who detected it, correction author, result and known cost |
| Prompt revisions | Before → after references and why the change helped or failed |
| Human decisions | Manual edits and why prompting stopped; deliberate non-use and its reason; acceptance or rejection |

Keep notes to a sentence or two per field and combine related fields where useful. Several prompts can share one task entry. Link detailed diffs, tests and PR records instead of copying them.

Update the same entry when a meaningful failure, revision or decision occurs. At handoff, record the incorporated result, checks and unresolved issues. At iteration close, every member confirms their entries and supplies missing edit notes; rotate the report writer.

## Accuracy and presentation

- Preserve prompt wording, typos and language. Label approved AI-written plans, excerpts, redactions and task-log quotations. Do not reconstruct missing prompts or expose secrets/private media.
- Identify the development assistant separately from app providers such as Whisper or Gemini. Include documentation, testing and review assistance as well as code generation.
- Write "not recorded" for missing dates/models/costs and "unconfirmed" for missing contributor input. Silence does not establish zero errors, no manual edits or acceptance.
- Distinguish hallucinations from implementation defects, tool-operation mistakes and changed requirements. Support an incorrect-claim account with code, documentation or observed behavior. Record useful failures even when they are not hallucinations.
- Separate human edits/testing from AI-written repairs and agent-operated checks. Do not invent time savings, debugging costs, authorship or approval.
- Write submission-facing prose about the work and results. Keep historical source/review details in `docs/history/`. Note missing input with its task in the log. Source IDs may remain in Markdown comments. Use the [contributor references](#contributor-references) below.

The course permits a custom appendix format; it specifies no English translation requirement or numerical prompt limit.

## Main report

Write one team report per iteration, one page (roughly 500–700 words). A longer prompt log belongs on a linked Wiki subpage. Use the seven-section outline below. The course requires sections 1–6 and calls the takeaway optional but strongly encouraged. Our report includes it as section 7.

1. **Where AI was used and deliberately not used:** tasks/files, tool/model and reasons for choosing not to use AI.
2. **Prompt history:** link to the full log of actual, verbatim prompts. Keep short before → after quotations with the revision analysis in §5.
3. **What AI did well:** concrete outputs with checkable evidence.
4. **Hallucinations and errors:** what was wrong, how it was caught, the correction and known cost.
5. **Prompt revisions:** before → after and the effect of the change.
6. **Manual fixes and why:** actual human code edits and reasons for stopping prompting. If none occurred, state that accurately.
7. **Takeaway for the next iteration:** brief bullets connecting the main lessons to changes for next iteration. For each lesson, state what happened and what we will do differently. Choose concrete lessons from the report about prompting, review, testing or teamwork.

Choose notable examples across the team's work: a useful constraint, a failure, a meaningful revision or a human decision with a verifiable result. Explain why each example matters. Equal space per person is not required; do not let the most complete chat dominate the report by default. The full log retains the remaining material.

Use short bullets, simple words and short sentences. Use “we” and “our” for the team’s narrative. Keep individual names where attribution matters, and preserve quoted prompts verbatim.

The guideline allows a long prompt log on a linked Wiki subpage. Our format uses only that link in §2 and keeps exact revision excerpts in §5. This is our reading of the log/analysis split; the guideline does not explicitly prescribe a link-only §2.

Reference files/lines, commits, PRs or issues so readers can check the examples.

## Human review before submission

Review the report together using this checklist. Automated checks can help with quotations, links and formatting; contributors confirm their own work. Keep corrections in the report or log rather than maintaining a separate validation file.

- [ ] Choose the rotating writer. Each member confirms their prompts, tool/model, manual edits, deliberate non-use, errors and personal testing. Do not treat missing input as “none.”
- [ ] Read all six required subjects and §7. Check that the examples reflect the team's work and explain what helped, what failed and what we will change next time.
- [ ] Match quotations to the log and claims to cited evidence. Distinguish human edits/testing from AI-written repairs and agent-operated checks. Keep unknown costs and test limits explicit.
- [ ] Check AI code comments on the final submitted revision and verify the report's links to them.
- [ ] Check the one-page PDF, roughly 500–700 words, working links, Wiki page/subpage/sidebar and required submission filename.

For Iteration 1, confirm Jaewon's and Jooyoung's model details if available and resolve the Y1 prompt author's name with Injoon and Jooyoung. Each member still needs to confirm personal edits/non-use and review the report. The archived review preserves the earlier source notes and open findings.

Keep this guide, the report, the log and affected shared instructions consistent when any of them changes. Human review has not happened until the contributors say it has.

## Contributor references

For Iteration 1, use he/him for Injoon, Jaewon and Seoyeon, and she/her for Jooyoung, as confirmed by Injoon on October 9. Names and pronouns do not resolve the unconfirmed Y1 prompt authorship.

## Code attribution and submission

Mark AI-generated code with short source comments and point to them from the report. Identify the actual scope/tool; include dates or reviewers only when supported. Review the final submitted code revision. Prompt logs and commit trailers do not replace the required source comments.

After human review, publish **AI Collaboration Report – Iteration N** on the repository Wiki, add a sidebar link and link the full prompt log. Check the exported PDF's one-page layout and links.

For Iteration 1, the [eTL assignment](https://myetl.snu.ac.kr/courses/305891/assignments/381929) requires `team7-iter1-AI-collaboration-report.pdf` in the submission ZIP. This guide is internal working guidance. Commit, push, Wiki publication and eTL submission must stay within the user's authorization.
