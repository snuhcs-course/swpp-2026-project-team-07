# OutLoud — shared agent instructions

OutLoud is Team 07's Android presentation rehearsal app: Expo / React Native /
TypeScript in `mobile/`, Django / Celery in `backend/`, PostgreSQL and Redis.
These rules apply across project tasks; read detailed guides only when relevant.

## Current iteration and prompt logging

**Current iteration: 2.** The active log is
[docs/ai-collaboration-prompts-iteration-2.md](docs/ai-collaboration-prompts-iteration-2.md).

- Record each actual project-task prompt and follow-up verbatim in that log during
  work, under the contributor/task, with date, tool and model. Group related prompts
  in one entry; label excerpts/redactions and write `not recorded` for unknown metadata.
  Do not reconstruct missing prompts, alter wording or duplicate existing entries.
- For Seoyeon's own prompts in any iteration, use exactly `Seoyeon` in the
  contributor field, as confirmed on October 15, 2026. Omit requester/requestor
  suffixes. Attribute other contributors' prompts to their confirmed names.
- Update the same entry with generated/retained work, meaningful results, errors,
  revisions, human decisions and actual verification before handoff. Distinguish
  AI work and agent-operated checks from human edits, testing and approval.
- Follow the [AI collaboration reporting guide](docs/ai-collaboration-guidelines.md)
  for entry fields, accuracy, code attribution and report/submission requirements.
  Preserve earlier iteration logs and frozen `docs/history/` evidence; do not put
  current prompts there or create a second diary. Logging is an agent responsibility,
  not a background capture service.
- `docs/ai-use.md` is retired. Do not create, restore or update it, including
  pointer-only versions. Treat instructions in old branches, task prompts and
  handoffs to use that path as historical. Keep each task's prompts, results,
  errors, revisions, decisions and verification in the active collaboration entry.
- At an iteration transition, update this marker, active-log link and related guide
  references together based on a confirmed transition. Do not infer it from a branch
  name, date or old document.

## Work from the current request and checkout

- Read the request and relevant conversation; carry forward confirmed decisions and
  authorization. Ask only when a missing answer affects the work.
- Check the branch, working tree and applicable instructions. Preserve unrelated
  changes. Continue an existing task on its branch; choose a suitable base for new
  work without switching, resetting or rebasing the user's checkout merely for freshness.
- Start with [README.md](README.md). For implementation, read the relevant
  [API contract](docs/api-contract.md), [handoff](docs/iteration-1-handoff.md),
  [ownership context](docs/team-work-division.md) and directory instructions.
  For meeting-note or meeting-log tasks, follow the
  [meeting-log workflow](docs/meeting-log-workflow.md).
- Verify claims against the relevant source, code and evidence. Plans, mock screens,
  branch names and task ownership do not establish implementation, approval or completion.
  Keep proposals and unresolved questions separate from confirmed decisions.

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
