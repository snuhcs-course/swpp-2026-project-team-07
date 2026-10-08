# OutLoud AI collaboration reporting guide

Use this guide with [AGENTS.md](../AGENTS.md), the [master AI-use log](ai-use.md),
the [Iteration 1 report](ai-collaboration-report-iteration-1.md), its
[prompt appendix](ai-collaboration-prompts-iteration-1.md), and
[validation summary](ai-collaboration-validation-iteration-1.md).
Course requirements come from “5 - AI Collaboration Report Guidelines.pdf”
(pages 1–3); this guide applies them to Team 07 without treating examples in the
course PDF as events that happened in this project.

## What to produce each iteration

| Document | Purpose | Length / destination |
| --- | --- | --- |
| Main report | Team analysis covering all six required subjects | Roughly 500–700 words; Wiki page “AI Collaboration Report – Iteration N” |
| Prompt appendix | Exact actual prompts, provenance, dates, outcomes and verified revisions | Separate linked Wiki sub-page “Iteration N – Prompt Log”; no 500–700-word cap |
| Master AI-use log | Dated project-wide task evidence, including out-of-period work | Repository `docs/ai-use.md`; detailed sources may stay at stable commits |
| Validation summary | Boundary evidence, checks, unknowns and submission blockers | Supporting record; excluded from report word count |
| This guide | Repeatable collection and writing process | Supporting document; excluded from report word count |

The team rotates the human writer. Every member supplies their own prompts and edit
notes. Do not assign a writer from PM rotation without confirmation. Link reports
from the Wiki sidebar in iteration order. The course Project Overview also describes
exporting Wiki deliverables to PDF for eTL; verify the actual assignment destination
and cutoff before submission. Creating local Markdown is not Wiki publication or
submission.

## Collect evidence while the work occurs

1. Add a dated task entry on the same branch as the associated work, using the
   [master-log entry template](ai-use.md#entry-template). Keep the log limited to
   that template and task entries; put report guidance and cross-task analysis in
   the supporting documents. Record the
   request, AI-produced material accepted/modified/rejected, exact revision, actual
   checks, human corrections and limitations. Preserve earlier entries and add
   dated follow-ups when status changes.
2. Separate original feature author, prompt sender, integrator, restorer, reviewer,
   manual editor and verifier within each task entry. Normalize Seoyeon / Seoyeon
   Park / gabdeguate to Seoyeon; Injoon / Injoon Jun / BonjourInjoon to Injoon;
   zoo / joo / zoo_zero / zoo-zer0 / kepten31415926 to Jooyoung; and
   justaoj / 재원 / just_aoj to Jaewon,
   but never infer these roles merely from Git authorship or a schedule assignment.
3. Preserve exact prompts at the time they are sent. Record tool/model if known;
   otherwise write “not recorded.” Do not substitute a product model such as
   Whisper or Gemini for the development assistant's model.
4. Link portable repository paths and immutable commit URLs. A PR link supplies
   discussion/status context; record the inspected head SHA and retrieval date
   because PR text and heads can change.
5. Separate automated checks, AI review, agent-operated device checks, human testing
   and live-provider evaluation. State fixture/mocked/synthetic inputs and skipped
   checks. A JS export is not an APK/device check; valid quotations/timestamps do
   not establish useful or semantically correct feedback.
6. Exclude secrets/private media. Explicitly label redactions. Retain rejected work
   and rework evidence when useful; never pad the report with invented examples.

Use the existing template for missing task entries too. Write “unknown” or
“awaiting contributor evidence” when a field lacks support; do not invent a
prompt, participant, check or error to fill it. Keep original source links and
date attribution corrections within the affected entry.

## Write the six sections

| Required section | Include | If evidence is missing |
| --- | --- | --- |
| Where AI was used and deliberately not used | Feature/files, tool/model, person/role; actual decisions not to use AI and reasons | Request named task, explicit choice, reason and contributor confirmation. Missing disclosure is not non-use. |
| Prompt history | Actual verbatim prompts with dates/senders and accessible evidence | Mark original prompts pending; distinguish logged quotations from verified original messages and summaries. |
| What AI did well | A concrete output, revision, meaningful verification and supported technical takeaway | Use the alignment example only within its recorded synthetic-test limits. Time saved requires evidence. Confirm personal/team reflections. |
| Hallucinations / errors | Category, exact assertion or wrong behavior, why wrong, detection, consequence and correction | Ask for the original assertion/behavior, contrary evidence, detector, repair and documented cost. Do not call all reverts hallucinations. |
| Prompt revisions | Exact before → after, reason, changed output and verification | Request a real paired example. Unrelated successive instructions do not count. |
| Manual fixes and why | Actual human-written changes, editor, diff, reason prompting stopped and checks | Record “awaiting contributor evidence.” Human bug reporting, approval, rollback choice or an agent-written repair is not a manual code fix. |

One or two closing takeaway lines are encouraged. Label proposed practices as
proposals until the team confirms adopting them.

## Classify failures accurately

| Category | Minimum evidence | OutLoud treatment |
| --- | --- | --- |
| Development-assistant hallucination | Specific model assertion contradicted by inspected evidence | Awaiting a complete example; do not infer from #5–#10 or #14–#17 |
| Generated-code defect | Reproducible incorrect behavior in an identified revision | Non-object Whisper response handling is a documented defect repaired by Codex |
| Agent workflow or operation error | Intended action/constraint, actual action and mismatch | Recorded PDF Remove-versus-Open tap is an operation error; do not generalize to unauthorized repository actions |
| Human review decision | Recorded choice, rationale and authorization | #10 resets review boundaries after authorized #5 |
| PR organization problem | PR relationships, duplication/dependencies and corrective decision | #14–#16 closed into #17; code retained; branch deletion is separate from PR closure |
| Product-model output error | Model output and source/evaluation supporting the assessment | Feedback-model overstatement and silent-audio decoding belong to application evaluation, not automatically development-assistant hallucinations |

Keep measured costs separate from qualitative rework. Do not assume fees were zero
when provider usage was unrecorded, or turn elapsed inference time into development
time saved.

## Source-code attribution markers

The course asks for a short code comment identifying AI-generated code, tool/date,
and actual reviewer, with report links to those markers. A documentation log alone
does not establish compliance.

Audit the final relevant revision for markers and accurate scope. Do not invent a
reviewer or imply whole-file AI authorship when only a helper was generated.
Example format, to be filled only with verified information:

```text
AI-assisted: <tool>, <date>, scope <function/change>; reviewed by <actual reviewer>.
```

If review has not occurred, disclose it as pending and keep the compliance item open.
Any source-comment additions require their own authorized change and review; this
reporting task does not add them. Existing historical records remain intact.

## Validate and publish deliberately

- Confirm the official reporting window before selecting work. Keep retrieval time
  separate from work time. Record conflicting schedule labels rather than silently
  moving early or late work into the iteration.
- Reconcile branch histories without counting inherited entries as multiple tasks.
  Credit original code separately from reapplication and integration.
- Check all six sections, the main report's 500–700-word count, quotes, aliases,
  links/anchors, period membership, PR state and revision-specific results.
- Mark each requirement **supported**, **awaiting contributor evidence**, or
  **not applicable with contributor confirmation**. Never convert a blank into
  “none occurred.”
- Separate “structurally complete draft” from “submission ready.” List unresolved
  original prompts, revisions, non-use, manual edits, hallucination evidence,
  attribution, source markers and human review explicitly.
- Have every member confirm their own evidence and the writer confirm the final
  report. Do not treat this confirmation as application-code review.
- Before authorized Wiki publication, turn supporting repository-relative links
  into verified Wiki/commit links appropriate for the destination. Remove local
  filesystem paths, temporary citations and scratch identifiers. Verify the saved
  Wiki page, prompt sub-page and sidebar links afterward.
- Commit, push, PR creation, Wiki publication and eTL submission are separate
  authorized actions. Record their actual receipts/status; preparing files does
  not perform them.
