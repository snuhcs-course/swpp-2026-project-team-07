# OutLoud — shared agent instructions

OutLoud is Team 07's Android presentation rehearsal app. The repository contains
an Expo / React Native / TypeScript client in `mobile/` and a Django / Celery
backend in `backend/`, with PostgreSQL and Redis for local development.

## Read before changing code

- Start with [README.md](README.md) for setup, commands, and implemented scope.
- Read [docs/api-contract.md](docs/api-contract.md) before changing data exchanged
  between recording, transcription, alignment, feedback, and the UI.
- Use [docs/team-work-division.md](docs/team-work-division.md) and
  [docs/iteration-1-handoff.md](docs/iteration-1-handoff.md) for feature boundaries.
  Suggested roles are not evidence of named assignments; follow confirmed team decisions.
- For mobile work, also read [mobile/AGENTS.md](mobile/AGENTS.md).
- Inspect the implementation and tests. A documented interface, screen preview,
  or planned feature does not prove that the feature works.

## Make coordinated, reviewable changes

- Check the current branch and working tree first. Preserve unrelated local changes.
  Start new work from an updated `main` on a task branch; do not switch or reset
  an existing task's branch without considering its uncommitted work.
- Keep changes focused. Coordinate changes to shared types, API routes,
  models/migrations, dependency locks, and native configuration with the affected
  feature owners. Update the contract and its consumers together when they change.
- Follow the README's teammate review/testing agreement before push and use PRs
  for merge review. Identify AI assistance separately from human review.
  Do not invent reviewer approval, push or merge without user authorization,
  or force-push shared history.
- Keep detailed requirements in their existing documents and link to them here
  rather than maintaining competing copies. Flag unresolved conflicts instead
  of silently choosing a new product requirement.

## Review before commits and pushes for Injoon's work

Standing user request received 2026-09-29: apply this workflow to every commit
and push performed by an agent for Injoon in this repository. This is the user's
workflow preference, not an independently verified course-wide or team-wide rule.

Preferred sequence: implement → stage intended changes → AI review → fix and test
→ stage fixes → review the changed scope → user final inspection → commit → push.

- Staging is a snapshot, not a live selection. Later edits are not automatically
  included. Use `git diff --cached` for the proposed commit, `git diff` for edits
  made after staging, and `git status --short` to spot files with both changes.
  After fixes, stage the intended files again and inspect the final staged diff.
- Tests normally run against working-tree files, not the staged snapshot. Before
  committing, ensure the staged code matches the code actually reviewed and tested.
  Do not claim a tested fix is included while it remains unstaged; preserve unrelated
  edits and do not stage them merely to make the working tree clean.
- Before committing, review the exact staged diff, including newly added files,
  against the relevant contracts. For substantive code changes, use a separate
  reviewer agent with the diff, relevant source/contracts, and test instructions;
  ask it to find concrete failure cases without relying on the author's rationale.
  The user authorizes this review delegation as part of the standing workflow.
  If unavailable, disclose that limitation and distinguish self-review from
  independent review; do not silently claim the latter occurred.
- Check correctness, failure paths, boundary conditions, sensitive/generated files,
  and whether tests meaningfully exercise the changed behavior. Fix confirmed
  defects and rerun relevant checks. Review fixes before including them.
- Before pushing, inspect all outgoing commits against the intended remote branch
  (or the PR base for a new branch). Ensure review evidence covers their final
  content. Existing review/test results may be reused for unchanged content;
  changes since review require renewed review of the affected scope.
  A commit followed by a push does not itself require a duplicate AI review.
  Verify the outgoing commits match the reviewed content and contain no secrets
  or unintended files. Reassess changes introduced by fixes, merges, or rebases;
  rerun affected tests when the code or its dependencies/context have changed.
- Summarize findings, fixes, checks and remaining limitations for the user, and
  record evidence in docs/ai-use.md tied to the reviewed files or revisions.
  Do not present unresolved material defects or unperformed required checks as
  a passed review. Preserve the existing teammate-review agreement.
- Documentation-only changes need a proportionate accuracy/link/diff review;
  they do not require application builds or an extra code-review agent.
- This rule does not authorize commits, pushes or merges by itself. AGENTS.md
  guides agent actions; it does not intercept direct terminal commands or enforce
  checks through Git hooks, CI, or branch protections.

## Preserve data and honest behavior

- Follow the API contract's zero-based slide indexes and integer milliseconds
  relative to actual audio capture. Preserve repeated/backward slide visits and
  test transition boundaries; do not substitute wall-clock time for audio time.
- A new recording has a new attempt ID. Processing retries retain its ID and
  source audio. Avoid duplicate provider work for repeated processing requests.
- Keep fixtures clearly labeled. Do not replace a failed real operation with
  sample data or report unfinished routes/adapters as successful.
- Keep provider credentials and calls on the backend. Never put secrets in
  `EXPO_PUBLIC_*`, commits, logs, screenshots, or AI-use records.
- Do not commit local `.env` files, private recordings, generated native projects,
  or installed dependencies. Use the existing ignore rules and example env files.

## Verify the change

Use the setup in README first. Run checks relevant to the changed behavior and
report the actual command, outcome, and any checks that could not run.

- **Mobile code:** from `mobile/`, run `npm run check` and
  `npm run bundle:android`. Verify changed user flows on Android; a JS export
  does not establish APK, microphone, or device behavior.
- **Backend code:** from `backend/`, using the project's Python environment:

  ```sh
  python manage.py check --settings=config.test_settings
  python manage.py test --settings=config.test_settings
  python manage.py makemigrations --check --dry-run --settings=config.test_settings
  ```

  These checks use SQLite. For database/migration or worker integration changes,
  also verify with the real PostgreSQL/Redis/worker setup described in README.
- **Tests:** cover changed behavior, relevant failures, and boundary cases. Mock
  provider calls in automated tests; identify real-provider checks separately.
  Review generated tests for meaningful assertions and missing cases.
- **Documentation only:** check commands, links, and consistency with the code;
  do not install dependencies or rebuild the app solely for prose changes.

## Handoff and AI-use evidence

- Summarize what changed, why, verification results, and remaining limitations.
  Distinguish automated checks, agent-operated device checks, and human testing.
- Record task-level AI use in [docs/ai-use.md](docs/ai-use.md) on the same branch
  as the work. Include the tool, representative requests, generated material
  incorporated, verification, and human corrections or pending review.
- Summarize the relevant AI contribution and verification in the PR description.
  Use these records to prepare the iteration's GitHub Wiki AI Collaboration
  Report; the local log does not automatically update or submit that report.
- Omit secrets and private user content. Do not fabricate tests, contributions,
  or approvals. Keep recorded results tied to the work actually checked.
- Written instructions support the team's review process; they do not replace
  human understanding, test evidence, or enforced CI/branch protections.
