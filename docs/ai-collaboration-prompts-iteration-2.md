# Iteration 2 AI collaboration log

**Team 07 · OutLoud**

Record actual prompts and concise task notes here during Iteration 2, following the [reporting guide](ai-collaboration-guidelines.md). Excerpts are labelled; missing metadata stays explicit.

## Meeting documentation, October 12, 2026

**Tool:** OpenAI Codex · **Model:** not recorded

- **Output and use:** Codex consolidated three earlier Notion meeting notes and the October 11 kickoff PDF into the approved [Daily Standup Meeting Log](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki/Daily-Standup-Meeting-Log), published at Wiki revision `bbf1b61`. The [reusable template](daily-standup-meeting-log-template.md) keeps six sections from the existing Notion template, with member updates, decisions and actions. Only the review-draft label was removed from the approved template for upload.
- **Verification:** Codex read the three source pages and both PDF pages, checked the PDF visually, checked deadlines and Markdown tables, and inspected the staged publication diff. The Wiki commit contains only the log and its sidebar link; its staged page matched the latest approved local draft byte-for-byte. Repository changes are documentation only; application builds and device tests were not needed. Agent checks are not teammate review.
- **Errors and revisions:** The initial search looked in Docs & Meetings and missed meeting notes stored in Tasks & Milestones. The user's clarification identified the three pages, and Codex included them. An ad hoc table checker incorrectly treated a two-column decision row as an action row; Codex corrected it to check contiguous table widths, which passed. No repair time or token cost was recorded.
- **Human decisions:** The user approved publication. The approved saved draft includes Zoom/full-attendance details for the earlier meetings, selection of the presentation app, and full attendance at the Manjok Coffee kickoff. Unrecorded owners and deadlines remain explicit. No repository PR merge or eTL submission was authorized or performed.

### Initial request — verbatim excerpt

```text
First create a template, then make a draft allow me to read it then after approval post on wiki
```

### Source clarification — verbatim

```text
Ideas worth investing on, addressing elephant in the room, requirements are all meeting notes from that day
```

### Publication approval — verbatim

```text
Looks good, upload reusable template on github and update wiki with daraft 
```


## Shared instructions and meeting-log workflow, October 13, 2026

**Contributor:** Injoon · **Tool:** OpenAI Codex · **Model:** not recorded

- **Output and use:** Reviewed PR #26 and separated shared agent rules from the meeting workflow. `AGENTS.md` explicitly selects Iteration 2's collaboration log; a linked guide covers template-based drafts, user approval, Wiki upload and remote verification. README, template, mobile verification pointer and reporting-guide references were aligned.
- **Errors and revisions:** The first local change put the whole meeting workflow in `AGENTS.md` on an unrelated checkout. Injoon requested a plan and general-purpose instructions; Codex moved the detailed workflow into its own guide and prepared this PR update in a separate checkout. The initial answer said the log was not automatically updated; existing agent instructions already required agents to maintain it, though no background capture service exists. Current iteration routing is now explicit. The link check caught an incorrect `#verification` heading in two new README links; Codex corrected both to the existing `#checks` heading. An earlier same-day source review reported no open PRs; the live lookup found open PR #26.
- **Human decisions:** Injoon approved the plan and authorized updating PR #26, explicitly retaining Wiki upload approval. No new meeting entry, Wiki publication, PR merge or coursework submission was requested. This is requester approval, not teammate review.
- **Verification:** 59 local links/headings passed; the original October 12 log entry is preserved byte-for-byte. Documentation whitespace checks passed. Codex reviewed the full outgoing documentation diff, template approval rule and current-iteration references. No application code changed; app builds and device tests were not run. Publication evidence is tracked in [PR #26](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/26).

### Prompts — verbatim, in order

```text
Check this PR: Add reusable daily standup meeting log template

From what i understand the file changes are for the iteration 2 prompts and meeting logs. For the meeting logs, is it providing only the template or is it also uploading on wiki?
```

```text
So the ai-collaboration-prompts file is automatically updated with every prompt but the template is just a template right? So how do we make sure that we use this template
```

```text
So you're saying that we need to follow this template when writing our meeting logs on wiki right that's why seoyeon put this into our PR
```

```text
Is it possible to ask you to give you unstructured notes and then put that into our wiki using the template
```

```text
I want to make agents upload this with the agents.md file is that possible
```

```text
But I feel like the agents.md file should contain guidelines that are relevant to any prompt but this is relevant for only prompts that are related to meeting notes. I also want to make it explicit that we are in iteration 2 so that the prompts go to ai-collaboration-prompts. Can you give me a plan before you change
```

```text
Looks good, I want you to one last check on the agents.md making sure that all of is important and would be relevant to any prompt. Make those changes and update PR #26. Keep the Wiki upload approval step and make sure prompts go into the iteration 2 collaboration log.
```
