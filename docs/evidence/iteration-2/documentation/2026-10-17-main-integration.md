# Main integration and Audience Q&A scope correction

**Date:** 2026-10-17
**Operator:** OpenAI Codex
**Branch:** `it2/documentation/cleanup`
**Integrated revision:** `origin/main` at `5aed316`

## Scope and decisions

The latest `origin/main` changes were merged into the documentation-cleanup branch.
The integration retained the reorganized documentation taxonomy while routing the new
interface specifications, assets, Scribe v2 reference and transcription evidence to
their current locations.

The human requester corrected the earlier scope decision: Audience Q&A is an
implemented Iteration 2 feature, not an optional Iteration 3 proposal. Current README,
Requirements, Design and traceability sources now describe it as implemented. Verbatim
historical prompts retain the earlier wording and are followed by the correction.

Conflict resolution retained the durable Audience Q&A implementation from this branch
and integrated main's current interface and Scribe v2 transcription changes. The
recording limit and boundary fixtures were reconciled to the current 20-minute limit.
Main's provider-request migration was renumbered to `0010_provider_request_options` so
it follows this branch's existing `0009_qaanswer` migration without creating a fork.

## Agent-operated verification

- `mobile/npm run check`: passed TypeScript, ESLint and all 306 Node tests. The
  integration initially exposed stale 30-minute expectations and one hook cleanup
  warning; both were corrected before the passing run.
- `docker compose run --rm --no-deps api python manage.py test --settings=config.test_settings --noinput`:
  passed 396 tests with 24 PostgreSQL-specific tests skipped by the SQLite test settings.
  Initial failures were limited to stale 30-minute/OpenAI-format fixtures; they were
  updated to the current 20-minute/Scribe v2 contract and the full suite was rerun.
- `docker compose run --rm --no-deps api python manage.py makemigrations --check --dry-run`:
  passed with “No changes detected.” The command warned that the optional `db` host was
  unavailable because the no-dependencies check does not start PostgreSQL.
- `docs/tools/check_docs.py`: checked 509 local Markdown links in 59 files; all file
  targets and heading anchors passed after repairing moved historical references.
- `git diff --check`: passed; the only emitted message was Git's local LF-to-CRLF
  working-copy notice for the prompt log.
- Conflict-marker search found no unresolved merge markers outside the preserved
  untracked `sites/` directory.

## Limits and publication state

These are automated and agent-operated checks, not human acceptance or an Android
device test. The SQLite suite skips PostgreSQL-specific concurrency behavior. No
private provider call, Wiki publication, push, eTL submission or final submission
export was performed. The unrelated untracked `sites/` directory was not modified.
