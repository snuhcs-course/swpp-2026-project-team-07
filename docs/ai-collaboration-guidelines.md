# AI collaboration reporting guide

Based on the supplied **AI Collaboration Report Guidelines v1.1**, pp. 1–3
([course guideline location](https://myetl.snu.ac.kr/courses/305891/files/9386035)),
and **AI Agent Session Exporter Student Tutorial**, pp. 1–4. Maintain one
collaboration log per iteration and use it to write the team report. Review full
interaction histories when deriving findings; publishing full transcripts is not required.

## Working documents

**Current iteration: 2.** Record new app-development prompts in the
[Iteration 2 collaboration log](ai-collaboration-prompts-iteration-2.md).
The [shared agent instructions](../AGENTS.md#current-iteration-and-prompt-logging)
identify the active iteration; update both references at a confirmed transition.

| Document | Purpose |
| --- | --- |
| [Iteration 2 collaboration log](ai-collaboration-prompts-iteration-2.md) | Actual prompts, tool/model metadata and concise task notes; update during work and at handoff |
| [Iteration 2 report draft](ai-collaboration-report-iteration-2.md) | The team's analysis of AI use, results, failures, revisions and human decisions; the [Iteration 1 report](ai-collaboration-report-iteration-1.md) is a prior-iteration reference |
| [Iteration 2 collection and member pages](ai-collaboration/iteration-2/README.md) | Development-topic selection, coverage gaps and contributor confirmations; metadata and links only |
| [This guide](#human-review-before-submission) | Course full-history review, optional export/privacy procedure, report format and human review checklist |

The earlier [AI-use record](history/ai-use-before-prompt-consolidation-2026-10-09.md) and [validation review](history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md) are archived. Keep one collaboration log per iteration at `docs/ai-collaboration-prompts-iteration-N.md`. Do not recreate either retired document as an active log. Do not create an `ai-use.md` pointer file or second task diary. References to that path in historical prompts remain quotations; record current results in the matching collaboration entry.

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

Seoyeon confirmed on October 15, 2026 that their own prompts in every iteration
should use exactly `Seoyeon` in the contributor field, without a requester/requestor
suffix. Use confirmed names for other contributors. The same request identified the
Iteration 2 entries between Injoon's README task and Seoyeon's Phase 1 task as Jaewon's;
those contributor fields use `Jaewon`. This attribution does not assert manual
code authorship, review or acceptance.

Update the same entry when a meaningful failure, revision or decision occurs. At handoff, record the incorporated result, checks and unresolved issues. At iteration close, every member confirms their entries and supplies missing edit notes; rotate the report writer.

## Review all members' interaction histories

Version 1.1 requires the team to review **all members' full AI-agent interaction
histories for the iteration**, rather than relying only on selected prompts.
Read the full record, including prompts, agent outputs, tool results, failures,
revisions and human interventions, as source material. Each member supplies their
actual input prompts and notes; the shared report remains the team's responsibility. The Wiki needs
the input prompt log and findings, not full responses or complete transcripts.

**Confirmed Iteration 2 scope: October 10–23, 2026, inclusive, in `Asia/Seoul`.**
An October 20 review is preliminary. Continue collection and review as work proceeds,
then refresh before final team review and submission. Record the source cutoff and
any later or still-running sessions as coverage gaps. Complete submission by the
assignment deadline; the interval's end date does not independently establish it.

Keep source coverage, review status and unresolved gaps in the
[member coverage pages](ai-collaboration/iteration-2/README.md#member-coverage).
Each member identifies tools, machines/interfaces and repository/worktree roots,
reviews complete relevant exchanges, and confirms prompts, personal edits,
non-use, errors and testing. A focused extraction or technical ZIP inspection
is not completed full-history review or owner privacy approval.

The [development-only collection](ai-collaboration/iteration-2/README.md#what-belongs-in-the-development-collection)
is a team convention requested by the user, not a course exemption. Select
sessions by privately reviewing their content, not directory/date matches.
Exclude reporting/admin, coursework logistics, presentation/editorial work,
general Codex/tool setup and unrelated conversations; exclude whole mixed or
uncertain sessions pending content review. This reporting/collection conversation
is outside the developer prompt log and development archive. The private source
export may contain such candidates; the separate selection/build step decides
what enters the development archive.

Keep actual development prompts and findings in the existing canonical task
entries. Member pages contain only coverage/confirmation metadata and links;
never make a second diary or copy full transcripts into them.

### Optional local session exporter

The course [AI Agent Session Exporter](https://github.com/snuhcs-course/session-exporter)
is an optional collection aid for local Codex and Claude Code histories. The
tutorial's default commands need Python 3.9+ and Git, without extra Python
packages. Follow the
Student Tutorial and the [reviewed exporter README](https://github.com/snuhcs-course/session-exporter/blob/3251f6338e647fda5e7abb6f6108f6f176b5ae9f/README.md).
Run it on each machine holding the relevant histories, from a separate exporter
checkout. These examples are for macOS/Linux/WSL; on Windows, use the tutorial's
PowerShell syntax and check the README's named-timezone requirements. Run inside
WSL for histories created there.

1. Set `--repo` to the absolute **project repository root**, not the exporter
   directory. Subfolder sessions, including `mobile/` and `backend/`, are included
   by default; `--exact` would exclude them. Run separately for every linked
   worktree outside that root. Do not broaden the query to a home directory to
   capture them.
2. Preview the confirmed interval first:

   ```sh
   python3 export_sessions.py --tool both \
     --repo /absolute/project/path \
     --from 2026-10-10 --to 2026-10-23 \
     --timezone Asia/Seoul --dry-run
   ```

   Check **Selected**, **Excluded** and their reasons, **Privacy findings** and
   **Final re-scan**. Dates select sessions whose timestamp spans overlap the
   inclusive range; the selected session is exported in full as read, including
   events outside the iteration. Use only relevant iteration events for report
   claims. A currently running session is only a snapshot through the read time.
3. After reviewing the preview, export to a private directory outside every Git
   checkout. Replace the output placeholder with an existing private directory
   and a distinct filename for the member/root being reviewed:

   ```sh
   python3 export_sessions.py --tool both \
     --repo /absolute/project/path \
     --from 2026-10-10 --to 2026-10-23 \
     --timezone Asia/Seoul \
     --output /absolute/private/ai-review/iteration-2-member-root.zip
   ```

   The exporter prints a private staging-folder path and asks `[y/N]`. Inspect
   the actual redacted copies there before answering `y`. Do not edit originals
   or staged files; changing staged files aborts the export. Cancel and rerun
   with repeated `--redact-term "YOUR NAME"` and
   `--redact-term "YOUR STUDENT ID"` options for names, IDs or other sensitive
   terms found during review. Apply the same terms to the preview and export.
   Keep interactive confirmation enabled.
4. Inspect `session_exporter.omitted_line` records and their reasons, redactions,
   keys/tokens/passwords, `.env` content and personal details in the staged
   files. Automatic detection does not cover every name, encoded value or
   contextual detail; a clean re-scan alone does not establish privacy. If an
   actual secret was exposed, revoke/rotate it as well as redacting the copy.
5. Inspect the finished ZIP's file list and contents, including `manifest.json`:

   ```sh
   unzip -l /absolute/private/ai-review/iteration-2-member-root.zip
   ```

   Check its query, coverage, exclusions, omissions and final re-scan result.
   Redaction counts are in `privacy.redactions_by_detector` in the manifest,
   not a separate summary file. Keep the ZIP and source review private; this
   procedure does not authorize committing, uploading or sharing them.

The exporter cannot establish complete coverage by itself. Histories begun in a
parent directory then moved into the repository, ambiguous/old formats and
sessions crossing outside the root may be excluded. Remote/cloud, Claude Cowork
and other unsupported histories may need review or export in their original
interface. Review those sources separately and record unresolved gaps explicitly.

## Accuracy and presentation

- Preserve prompt wording, typos and language. Label approved AI-written plans, excerpts, redactions and task-log quotations. Do not reconstruct missing prompts or expose secrets/private media.
- Identify the development assistant separately from app providers such as Whisper or Gemini. Include documentation, testing and review assistance as well as code generation.
- Write "not recorded" for missing dates/models/costs and "unconfirmed" for missing contributor input. Silence does not establish zero errors, no manual edits or acceptance.
- Distinguish hallucinations from implementation defects, tool-operation mistakes and changed requirements. Support an incorrect-claim account with code, documentation or observed behavior. Record useful failures even when they are not hallucinations.
- Separate human edits/testing from AI-written repairs and agent-operated checks. Do not invent time savings, debugging costs, authorship or approval.
- Write submission-facing prose about the work and results. Keep historical source/review details in `docs/history/`. Note contributor coverage gaps in the member metadata pages and link the relevant development task. Source IDs may remain in Markdown comments. Use the [contributor references](#contributor-references) below.

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

Choose notable examples across the team's work after the full-history review: a useful constraint, a failure, a meaningful revision or a human decision with a verifiable result. Explain why each example matters. Equal space per person is not required; do not let the most complete chat dominate the report by default. The full log retains the remaining material.

Use short bullets, simple words and short sentences. Use “we” and “our” for the team’s narrative. Keep individual names where attribution matters, and preserve quoted prompts verbatim.

The guideline allows a long prompt log on a linked Wiki subpage. Our format uses only that link in §2 and keeps exact revision excerpts in §5. This is our reading of the log/analysis split; the guideline does not explicitly prescribe a link-only §2.

Reference files/lines, commits, PRs or issues so readers can check the examples.

## Human review before submission

Review the report together using this checklist. Automated checks can help with quotations, links and formatting; contributors confirm their own work. Keep corrections in the report or log rather than maintaining a separate validation file.

- [ ] Choose the rotating writer. Each member confirms their prompts, tool/model, manual edits, deliberate non-use, errors and personal testing. Do not treat missing input as “none.”
- [ ] Complete the member coverage pages. Review all members' full histories for October 10–23 in `Asia/Seoul`, refresh before final submission, and resolve or state gaps. Development-only topic selection does not establish this course review.
- [ ] Read all six required subjects and §7. Check that the examples reflect the team's work and explain what helped, what failed and what we will change next time.
- [ ] Match quotations to the log and claims to cited evidence. Distinguish human edits/testing from AI-written repairs and agent-operated checks. Keep unknown costs and test limits explicit.
- [ ] Check AI code comments on the final submitted revision and verify the report's links to them.
- [ ] Check the one-page report, roughly 500–700 words, and working links. Prepare/check a PDF and Wiki page/subpage/sidebar within authorization; confirm any Iteration 2 filename, ZIP upload or deadline from its actual assignment.

For Iteration 1, confirm Jaewon's and Jooyoung's model details if available and resolve the Y1 prompt author's name with Injoon and Jooyoung. Each member still needs to confirm personal edits/non-use and review the report. The archived review preserves the earlier source notes and open findings.

Keep this guide, the report, the log and affected shared instructions consistent when any of them changes. Human review has not happened until the contributors say it has.

## Contributor references

For Iteration 1, use he/him for Injoon, Jaewon and Seoyeon, and she/her for Jooyoung, as confirmed by Injoon on October 9. Names and pronouns do not resolve the unconfirmed Y1 prompt authorship.

## Code attribution and submission

Version 1.1 asks for a short comment near a manual fix discussed in the report
**when it helps readers locate that change**, with a link from the report. It
explicitly does not require marking all AI-generated code.

Our existing internal convention is stronger: mark AI-generated code with short
source comments and point to them from the report. Identify the actual scope/tool;
include dates or reviewers only when supported. Review the final submitted code
revision. Prompt logs and commit trailers do not replace those internal markers.
Keep the distinction clear: do not attribute the blanket convention to v1.1 or
silently remove it. Do not add/remove comments across the codebase merely for
this documentation update; record any missing attribution scope for contributor
review and a separate, focused decision.

After human review and explicit publication authorization, publish **AI Collaboration Report – Iteration N** on the repository Wiki, add a sidebar link and link the full prompt log. Check the exported PDF's one-page layout and links.

For Iteration 1, the [eTL assignment](https://myetl.snu.ac.kr/courses/305891/assignments/381929) requires `team7-iter1-AI-collaboration-report.pdf` in the submission ZIP. That historical filename/ZIP requirement does not establish an Iteration 2 requirement. The [Iteration 2 assignment](https://myetl.snu.ac.kr/courses/305891/assignments/386091), in the official API/page snapshot retrieved October 18, specifies `team7-iter2-AI-collaboration-report.pdf` inside `team7-iter2.zip`, due October 23 at 23:59 KST. Recheck the live assignment before uploading; this source review did not refresh eTL. Neither v1.1 nor the exporter tutorial independently establishes the assignment deadline or ZIP contents. This guide is internal working guidance. Commit, push, Wiki publication and eTL submission must stay within the user's authorization; human review does not itself authorize publication.
