# Automatic scoring review artifacts — October 17, 2026

This archive preserves the reviewed automatic-scoring task as three separate patches.
It does not commit the application source or its earlier uncommitted dependencies.
The user approved committing the reviewed result; the earlier patch-and-manifest
preservation approach is reused to retain the original staging snapshot and avoid
including unfinished scoring work.

- `workflow-backend.patch`: automatic selected-source admission, synchronized updates,
  submission recovery, versioned delivery instructions and rejected-result recovery.
- `display.patch`: shared level colors, direct advice/evidence and Home statistics.
- `documentation.patch`: contracts, verification and task-level AI-use records.
- `manifest.json`: dirty-baseline and final source hashes, patch hashes, source scope
  and original index-patch digest.
- `verification.json`: automated, physical synthetic and local-phone delivery results.
- `independent-review-sha256.json`: exact source bytes covered by independent review.

The patches apply to the saved dirty baseline, **not committed HEAD**. A source-only
commit cannot safely be produced from HEAD without separately reviewing and committing
the earlier scoring implementation. The manifest identifies affected files absent
from HEAD; those pre-existing dependencies remain uncommitted. Do not treat this
archive commit as an independently runnable application revision. No implementation
or original staging entry was changed while archiving.

Verification of unchanged reviewed source: 555 mobile tests, typecheck, lint with
one existing warning, Android export, 615 SQLite backend tests (24 PostgreSQL-only
skips), 615 PostgreSQL backend tests, Django system/migration checks, independent
review and mocked physical Android workflows. The phone preview has no Internet
permission and uses clearly labeled synthetic fixtures. A final held-submission
retest displays Scoring… and repeated navigation retains one mocked request.

The final normal APK was installed in place on the Galaxy S23 Ultra without launch.
The existing local backend is ready; saved jobs/receipts and provider request counts
were unchanged. Real-provider adherence and human usefulness remain manual testing
limitations. Unsupported evidence still withholds the affected score.

AI assistance: OpenAI Codex implemented, tested, reviewed and archived the task.
The detailed AI-use entry is included in `documentation.patch`; no human teammate
review is asserted. The user said “Looks good commit” after reviewing the handoff.
No push, merge, cleanup or agent-triggered paid inference was performed.

Detailed logs, saved pre-task source, staging snapshot, native build/source proofs
and 37 screenshot files remain local at
`/private/tmp/outloud-automatic-scoring-20261017/` and are not included here.
