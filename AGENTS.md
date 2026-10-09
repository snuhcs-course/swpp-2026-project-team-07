# OutLoud — shared agent instructions

OutLoud is Team 07's Android presentation rehearsal app, with an Expo / React
Native / TypeScript client in `mobile/` and a Django / Celery backend in `backend/`.
Local infrastructure uses PostgreSQL and Redis. These instructions apply to every
contributor; personal workflow preferences belong in that contributor's local context.

## Work from the current task and checkout

- Read the user's request and relevant conversation before acting. Carry forward
  confirmed decisions and authorization; ask only when a missing answer affects the work.
- Check the branch, working tree and relevant instructions. Preserve unrelated changes.
  Continue an existing task on its branch. For new work, choose the base from the
  requested feature and its dependencies; a stacked PR may need another feature branch.
  Do not switch, reset or rebase the user's checkout just to obtain a fresh `main`.
- Start with [README.md](README.md) for setup. Read only the documents needed for the
  task: [API contract](docs/api-contract.md) for data boundaries,
  [feature handoff](docs/iteration-1-handoff.md) and
  [work division](docs/team-work-division.md) for ownership context, and
  [mobile instructions](mobile/AGENTS.md) for mobile changes.
- Inspect the relevant code and tests. Plans, mock screens, old logs and branch names
  do not establish what the current revision implements. Treat suggested assignments
  as suggestions until a contributor confirms ownership.

## Implement and verify

- Make focused, reviewable changes that satisfy the request. Coordinate changes to
  shared contracts, models, migrations, routes, native configuration and dependencies.
  Update affected active documentation; link to existing requirements instead of
  creating competing copies. Flag unresolved requirements conflicts.
- Follow the contract's zero-based slide indexes and integer milliseconds measured
  from audio capture. Preserve repeated/backward visits and transition boundaries.
  New recordings get new attempt IDs; retries retain the existing ID and source audio.
- Keep fixtures and mocked results labelled. Preserve failures and recovery behavior;
  do not replace a failed real operation with sample data or claim unfinished work passed.
- Keep provider credentials and calls on the backend. Exclude secrets, private media,
  local `.env`, generated native projects and installed dependencies from commits.
- Add or update tests when behavior changes and meaningful coverage is needed. Cover
  relevant failure paths and boundaries; do not add tests that merely repeat the code.
- Run checks appropriate to the changed scope using the repository's existing setup:
  - Mobile code: `npm run check` and `npm run bundle:android` from `mobile/`.
    Check affected user flows on Android; a JS export is not an APK or device test.
  - Backend code: run the following from `backend/` in its Python environment:

    ```sh
    python manage.py check --settings=config.test_settings
    python manage.py test --settings=config.test_settings
    python manage.py makemigrations --check --dry-run --settings=config.test_settings
    ```

    These use SQLite. For affected database/migration or worker integration, also
    check the relevant PostgreSQL/Redis/Celery path described in README.
  - Documentation only: check accuracy, links, quotations and the diff. Do not install
    dependencies, rebuild the app or require a separate code reviewer for prose changes.
- Reuse results for unchanged content. Rerun affected checks after fixes or integration
  changes; do not repeat whole suites without a reason. Report skipped checks and limits.

## Review before committing or pushing

- Follow the requester's approval expectations and the team's review/testing agreement.
  Existing authorization remains valid within its scope; do not invent reviewer approval.
- Inspect the intended changes before publication. Stage only the requested scope and
  review the exact staged diff, including new files. Later edits require restaging:
  `git diff --cached` is the proposed commit; `git diff` shows unstaged changes.
- For substantive code changes, use a separate AI reviewer when available to inspect
  the diff, contracts and failure cases before committing. Fix confirmed issues, run
  affected checks, restage and review the fixes. If unavailable, report self-review as
  such. AI review does not establish human approval.
- Confirm the staged files match the work tested and reviewed. Before pushing, inspect
  all outgoing commits against the intended remote/PR base, including inherited work.
  Reuse unchanged review evidence; review new changes or conflict resolutions.
- Obtain any requested final human inspection before committing. Commit, push, PR merge,
  Wiki publication and eTL submission must stay within the user's authorization.
  Never force-push shared history. A commit does not require repeating an unchanged review.

## Record AI collaboration once

- Use the current iteration's `docs/ai-collaboration-prompts-iteration-N.md` as the
  single maintained collaboration log: actual prompts plus concise task notes for
  the report. For Iteration 1, use the [existing log](docs/ai-collaboration-prompts-iteration-1.md).
- Record actual prompts verbatim under the contributor/task, with the date, tool
  and model. Write "not recorded" for missing metadata rather than guessing. One
  header may cover a task or session; note any tool/model changes. Keep meaningful
  corrections/revisions together. Do not reconstruct
  missing prompts, clean up their wording, or copy another entry for the same prompt.
  Label excerpts, redactions, secondary quotations and user-approved AI drafts.
- Update that task's notes when a meaningful result, failure, revision or human decision
  occurs, and at task handoff. Capture generated/retained work, actual verification,
  errors and corrections, prompt revisions, human edits and deliberate non-use.
  Link detailed PR/feature evidence; do not duplicate test logs or create a second diary.
- For an error, record the wrong claim or behavior, why it was wrong, how/who detected
  it, who corrected it, the result and any known cost. Distinguish hallucinations, code
  defects and tool-operation mistakes. Never invent a debugging prompt or elapsed time.
- Follow the [reporting guide](docs/ai-collaboration-guidelines.md) for the compact task
  template. Record observable facts; ask the contributor to confirm personal edits,
  reasons and acceptance when needed. Missing input stays unconfirmed. AI-written
  repairs and agent-operated tests must not be attributed to a human.
- Write the log for the submission reader. Keep historical source/review details in
  `docs/history/` and missing contributor input with its task in the log. Use concise
  source labels and retain technical limits; polished wording must not imply approval.
  Use the [contributor references](docs/ai-collaboration-guidelines.md#contributor-references) for names and pronouns.
- Mark AI-generated code with a short attribution comment and link to it from the
  report as the course requires. Keep its scope accurate; do not invent dates or reviewers.
- `docs/history/` contains frozen evidence. Do not append new task entries there or
  recreate the retired AI-use or validation files as active records. The active
  package is the report, collaboration log and reporting guide.
- Prepare the report for human review using the [checklist](docs/ai-collaboration-guidelines.md#human-review-before-submission).
  Select notable examples across contributors and trace claims and revised prompts
  to evidence. Keep missing facts explicit. Check quotations, links and formatting,
  but do not substitute these checks for each contributor confirming their account.
- Keep the reporting guide, report, log and affected active document references
  consistent in the same change. Our report format has six mandatory course subjects
  plus a separate §7 takeaway. Check the outline and trace each takeaway to a report
  example and a concrete next-iteration action. Preserve historical records and
  verbatim prompts.

## Handoff after the task

Explain the result, relevant files, checks actually performed and remaining issues.
Distinguish automated checks, AI review, agent-operated device checks and human testing.
For a PR, include the relevant AI contribution, verification and limits in its description.
Do not claim a commit, push, publication, approval or submission that did not occur.
