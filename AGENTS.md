# OutLoud — shared agent instructions

OutLoud is Team 07's Android presentation rehearsal app: Expo / React Native /
TypeScript in `mobile/`, Django / Celery in `backend/`, PostgreSQL and Redis.
These rules apply across project tasks; read detailed guides only when relevant.

## Current iteration and prompt logging

Use the [prompt log index by iteration](docs/ai-collaboration/README.md#prompt-logs). Record new entries in the appropriate contributor and iteration file. Use the unattributed column when authorship is unconfirmed.

- Record each actual project-task prompt and follow-up verbatim in the contributor’s iteration log during
  work, under the contributor/task, with date, tool and model. Group related prompts
  in one entry; label excerpts/redactions and write `not recorded` for unknown metadata.
  Do not reconstruct missing prompts, alter wording or duplicate existing entries.
- For Seoyeon's own prompts in any iteration, use exactly `Seoyeon` in the
  contributor field, as confirmed on October 15, 2026. Omit requester/requestor
  suffixes. Attribute other contributors' prompts to their confirmed names.
- Update the same entry with generated/retained work, meaningful results, errors,
  revisions, human decisions and actual verification before handoff. Distinguish
  AI work and agent-operated checks from human edits, testing and approval.
- Follow the [AI collaboration reporting guide](docs/ai-collaboration/ai-collaboration-guidelines.md)
  for entry fields, accuracy, code attribution and report/submission requirements.
  Preserve historical entries and cite their original revisions. Logging is an agent responsibility,
  not a background capture service.
- `docs/ai-use.md` is retired. Do not create, restore or update it, including
  pointer-only versions. Treat instructions in old branches, task prompts and
  handoffs to use that path as historical. Keep each task's prompts, results,
  errors, revisions, decisions and verification in the active collaboration entry.
- Record a task's iteration when confirmed. Retain earlier labels as recorded;
  a branch name, date or planning document does not establish a transition.
  Prepare the team's report separately for each iteration from the relevant entries.

### Contributor prompt-log branches

This default applies to every team member. For tasks that change this repository,
publish the contributor's new prompt-log entries at handoff. Derive the branch
`docs/<contributor>-prompt-logs` from the contributor's confirmed log folder name.

| Contributor | Prompt-log branch |
| --- | --- |
| Injoon | `docs/injoon-prompt-logs` |
| Jaewon | `docs/jaewon-prompt-logs` |
| Jooyoung | `docs/jooyoung-prompt-logs` |
| Seoyeon | `docs/seoyeon-prompt-logs` |

Honor task-specific directions about where to log or whether to publish. Keep
unconfirmed attribution local until it is resolved.

1. Resolve the destination before writing. Check the team remote for the branch.
   Reuse its local worktree or attach the local branch in a dedicated worktree.
   If it exists only on the remote, start the local branch at that ref. If it is
   new, create it from the team remote's current default branch. Verify the
   checked-out branch and write the iteration log using its worktree path.
2. At handoff, review the exact new entries for public sharing. Omit secrets and
   private material, and label any redactions in quoted prompts.
   Stage only this task's log changes under `docs/ai-collaboration/prompt-logs/<contributor>/`.
   Check the entire staged diff before committing. Preserve unrelated staged and
   unstaged changes, including earlier edits to the same log file.
3. Before pushing, verify that every outgoing commit is in the authorized prompt-log
   scope. Compare with the remote log branch, or with the verified default-branch
   base when publishing a new branch. Push only the matching ref with
   `git push <team-remote> HEAD:refs/heads/<branch>`. If someone updated the remote,
   refresh it and retry only when both sets of entries can be preserved safely.
4. If identity, branch setup, edit scope or push access blocks the workflow, report
   the blocker and keep pending work local. Keep the implementation checkout free
   of new prompt-log edits. At handoff, report the destination and what was pushed.

This policy authorizes the agent to commit and push the reviewed prompt-log changes
for the current task without separate approval. Other repository changes follow
the regular review and publication rules below.

## Work from the current request and checkout

- Read the request and relevant conversation; carry forward confirmed decisions and
  authorization. Ask only when a missing answer affects the work.
- Check the branch, working tree and applicable instructions. Preserve unrelated
  changes. Continue an existing task on its branch; choose a suitable base for new
  work without switching, resetting or rebasing the user's checkout merely for freshness.
- Start with [README.md](README.md) and the [documentation index](docs/README.md).
  For implementation, read the [API contract](docs/reference/api-contract.md)
  and directory instructions. For meeting records, use the
  [meeting guide](docs/meetings/meeting-guide.md).
- Verify claims against the relevant source, code and evidence. Plans, mock screens,
  branch names and task ownership do not establish implementation, approval or completion.
  Keep proposals and unresolved questions separate from confirmed decisions.

## Submission document writing

- Write submission documents as finished deliverables in the required format. Use
  direct, short language. Include only required content or detail needed to
  understand, reproduce or assess the work.
- Keep conversation attribution (such as "Injoon said" or "the user approved"),
  editing history and routine approval/publication/coordination notes in working
  records rather than submission prose.
- Retain names where ownership, test execution or required attribution matters.
  Preserve actual results, citations, evidence, limitations and required AI
  disclosures, including verbatim prompts. Keep history or reflection when the
  assignment requires it.
- Link supporting detail when the guidelines allow it, keeping the required
  summary/outcome in the main document. Before handoff, check required headings
  and remove repeated or irrelevant text.

## Make focused changes and verify them

- Satisfy the request with small, reviewable changes. Coordinate shared interfaces
  and dependencies; update affected active documentation and flag unresolved conflicts.
- Protect secrets and private media. Keep provider credentials/calls on the backend;
  exclude local environment files, generated native projects and dependencies from commits.
- Label fixtures and mocks. Preserve failures and recovery behavior; do not replace
  failed real operations with sample results or claim unfinished work passed.
- Use checks appropriate to the changed scope and the existing
  [verification commands](README.md#checks). Add meaningful tests for behavior
  changes when needed. Documentation-only work needs accuracy, link, quotation and
  diff checks, without app builds or a separate code reviewer solely for prose.
- Rerun affected checks after relevant fixes; reuse unchanged evidence. Report skipped
  checks and limits, including the difference between exports, device checks and human tests.

## Review and publish within authorization

- Follow the requester's approval expectations and team review agreement. Reuse valid
  authorization within its scope; never invent reviewer approval.
- Stage only the requested files and inspect the exact staged diff. Restage later
  edits; confirm the commit matches the reviewed and verified work. Before pushing,
  inspect all outgoing commits against the intended remote/PR base.
- For substantive code changes, use a separate AI reviewer when available, fix
  confirmed issues and verify affected paths. Report self-review if unavailable;
  AI review does not establish human approval.
- Obtain any requested final human inspection. Commit, push, merge, Wiki publication
  and eTL submission must stay within authorization. Never force-push shared history.
- At handoff, explain the result, changed files, checks and remaining issues. Include
  AI contribution and verification limits in PR descriptions. Report only publication,
  approval, testing and submission outcomes that actually occurred.
