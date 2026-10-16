# Documentation agent instructions

These rules apply to every file below `docs/`. Follow the repository-wide
[AGENTS.md](../AGENTS.md) first.

## Route new documents by purpose

- Product requirements, design and traceability: `docs/product/`.
- Shared API/data contracts: `docs/architecture/`.
- Current feature behavior and operator references: `docs/features/`.
- Setup and verification commands: `docs/development/`.
- Team documentation workflows: `docs/process/`.
- Prompt logs and short iteration reports: `docs/ai-collaboration/iteration-N/`.
- Dated checks, review findings and device/provider observations:
  `docs/evidence/iteration-N/<area>/`.
- Superseded plans, handoffs and snapshots: `docs/archive/iteration-N/`.
- Generated HTML, PDFs, manifests and Wiki-ready copies: `output/`, not `docs/`.

Do not create miscellaneous Markdown directly under `docs/`. When a new canonical
document is added, update [the documentation index](README.md) in the same change.

## Current iteration and evidence

Iteration 2 is current. Write new evidence beneath
`docs/evidence/iteration-2/<area>/` and link it from the relevant feature or
verification index. Evidence must identify what was checked, the revision/date,
commands or procedure, result, limitations and who operated or confirmed the check.

Do not describe plans, fixtures, mocked responses, JavaScript exports, AI review or
agent-operated device checks as human acceptance or complete live validation.

At a confirmed iteration transition, create the next evidence and collaboration
directories and update this file, the root `AGENTS.md`, the documentation index and
the AI collaboration guide together. Do not infer a transition from a date or branch.

## AI collaboration records

The active log is
[Iteration 2 prompt log](ai-collaboration/iteration-2/prompt-log.md). Record actual
project-task prompts and meaningful follow-ups verbatim, with confirmed contributor,
date, tool and model or `not recorded`. Update the same entry with output, retained or
rejected work, errors, revisions, human decisions, verification and limitations.

Use [the AI collaboration guide](process/ai-collaboration-guidelines.md). Never create
a second task diary under `docs/`; detailed checks belong in `evidence/` and are
linked from the prompt entry.

## Current, evidence and archive boundaries

- Current references describe the checked-out implementation and should not retain
  superseded stop instructions.
- Evidence records are immutable accounts of dated work; add a later record instead
  of rewriting an old result to match current behavior.
- Archive files are not current instructions. Preserve their wording except for
  necessary path repairs or an explicit archive status banner.
- Requirements state approved product scope. Implementation does not automatically
  promote an optional feature to a mandatory requirement.
- Testing Documentation remains separate from Design Documentation.

## Links and generated files

Use relative Markdown links for repository files. After moving or adding documents,
run the documentation checker described in `docs/tools/check_docs.py` and repair all
broken local files and anchors. Update design tools when the canonical design source
or assets move; never hand-edit generated HTML or PDF content.

Wiki preparation may write a local bundle under `output/wiki/`, but publication needs
explicit authorization and a post-publication read-back check.
