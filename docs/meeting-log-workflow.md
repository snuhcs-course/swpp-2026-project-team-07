# Meeting-log workflow

Use this guide when a user supplies meeting notes or requests a meeting-log update.
Use the [shared template](daily-standup-meeting-log-template.md) for the entry format.
The destination is the team's
[Daily Standup Meeting Log](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki/Daily-Standup-Meeting-Log).

## Prepare the draft

1. Read the supplied notes and the latest Wiki page. Identify the meeting date and
   iteration from the notes and confirmed context. Ask if a missing date or conflicting
   iteration prevents placing the entry accurately; the current work iteration does
   not change the iteration of an earlier meeting.
2. Organize the notes under the template's participants/objective, agenda, notes,
   decisions, actions and next-check-in sections. Preserve source meaning and links.
   Distinguish confirmed decisions from proposals and unresolved alternatives.
3. Use `Not recorded` for missing source details, and `Not assigned` only when the
   team explicitly left a task unassigned. Do not infer attendance from ownership,
   invent deadlines or manufacture individual updates. Preserve prior meeting records;
   later progress belongs in a new dated entry.
4. Show the proposed entry for user review. Check names, attendance, dates, decisions,
   action owners, missing details, table formatting and links against the notes.

## Approval and upload

- Obtain approval of the proposed Wiki entry and authorization to upload before
  publishing. A request to draft or configure this workflow alone does not authorize
  an upload. Once the user has approved the draft and authorized upload, continue
  without asking for the same approval again. Material changes after approval need
  review of the revised entry before publication.
- GitHub Wiki is a separate repository. Merging a PR containing the template does
  not publish meeting logs. Use available authenticated Wiki access with write
  permission; never treat this guide as granting access.
- Read the remote Wiki again before writing. Append the approved entry under its
  iteration, preserve concurrent changes, and avoid duplicates. If the same meeting
  already exists, show any proposed correction instead of silently replacing it.
- Limit publication to the approved entry and necessary navigation changes. Do not
  merge application PRs, update other Wiki pages or submit coursework as a side effect.

## Verify and record

- Fetch the published page and confirm the approved entry and existing records are
  intact. Report the page URL and Wiki revision. If access/upload fails, retain the
  draft and report that it was not published; a local edit is not upload evidence.
- Record actual prompts, draft/revisions, human approval, verification and publication
  result in the active collaboration log identified by
  [AGENTS.md](../AGENTS.md#current-iteration-and-prompt-logging), currently
  [Iteration 2](ai-collaboration-prompts-iteration-2.md). Keep one task entry and
  follow the [reporting guide](ai-collaboration-guidelines.md).
