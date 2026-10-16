# Documentation reorganization verification — 2026-10-16

**Status:** Agent-operated documentation verification on
`it2/documentation/cleanup`. **Contributor:** Jooyoung. **Tool:** OpenAI Codex;
model metadata not recorded. This record does not establish teammate approval,
GitHub Wiki publication, a commit/push, or eTL submission.

## Directory maps

Before this task, the active and historical Markdown files were mixed at the
repository root and directly under `docs/`:

```text
Design-Documentation.md
Design-Documentation.html
Design-Comparison.md
REDESIGN.md
docs/
  api-contract.md
  ai-*.md
  phase-*.md
  *-verification.md
  iteration-1-handoff.md
  local-development.md
  requirements-and-specifications.md
  design-tools/
  diagram-review/
  history/
```

The active structure after reorganization is:

```text
docs/
  README.md                         documentation index
  AGENTS.md                         routing policy
  product/                          requirements, design, traceability
  architecture/                     API/data contracts
  features/                         current technical references
  development/                      setup and verification commands
  process/                          AI and meeting-log workflows
  ai-collaboration/iteration-N/     prompt logs and reports
  evidence/iteration-N/<area>/      dated verification
  archive/iteration-N/              superseded and historical material
  assets/design/                    canonical editable/reviewed figures
  tools/design/                     design build and validation
output/
  archive/iteration-1/              prior submission snapshots
  html/, pdf/, wiki/                generated local artifacts
```

## Move, merge, archive and removal record

- Moved Requirements, Design and the rewritten traceability map to `docs/product/`;
  moved the API contract to `docs/architecture/`.
- Moved AI feedback, rehearsal-review and transcription references to `docs/features/`
  and added explicit current/historical status labels.
- Moved setup and verification references to `docs/development/`; moved the AI-use
  guide and meeting workflow to `docs/process/`.
- Moved both iteration prompt logs and the Iteration 1 report to
  `docs/ai-collaboration/iteration-N/`. The Iteration 2 report remains a clearly
  labeled pre-close draft.
- Moved Phase 2–6, cue, defaults, Q&A, evidence-validation and transcription records
  to dated Iteration 2 evidence areas. Moved Iteration 1 provider/device/design
  records to Iteration 1 evidence.
- Archived the Iteration 1 handoff, scaffold review, setup explanation, ownership
  plan, first word-alignment notes and raw historical AI records. Archived
  `Design-Comparison.md` and `REDESIGN.md` after carrying current behavior into the
  README, Design and feature references.
- Merged the standalone daily-standup template into the meeting-log workflow and
  removed the duplicate template.
- Moved canonical diagram SVG/PNG/source assets and design tools under `docs/`.
  Removed the tracked root HTML and root `assets/outloud-design/` copies because they
  are reproducible generated duplicates. Their prior bytes remain recoverable from
  Git history; canonical sources remain under `docs/assets/design/`.
- Moved the two Iteration 1 PDFs to `output/archive/iteration-1/`. No final Iteration
  2 submission-named PDF was created.
- Preserved the unrelated untracked `sites/` directory without modification.

## Submission decisions

- Requirements and Design are refreshed Iteration 2 canonical Markdown sources.
- Audience Q&A remains optional Iteration 3 scope despite experimental code.
- General-audience/five-minute defaults and automatic-first-feedback behavior are not
  included in the submission-facing Requirements or Design pending team approval.
- The AI Collaboration Report is a pre-close draft following the six required topics
  plus a takeaway; missing contributor/manual-edit facts are explicitly unconfirmed.
- Testing Documentation was **not created**. It remains blocked until the team names
  component test owners and approves predeclared coverage targets.
- The schedule, final submission PDFs, XLSX, ZIP and eTL submission were not produced
  or changed.

## Verification results

| Check | Result |
| --- | --- |
| Branch and preservation | Confirmed `it2/documentation/cleanup`; `sites/` remains untracked and untouched. |
| Markdown links/anchors | `docs/tools/check_docs.py` passed across tracked/new root, mobile and docs Markdown. It resolves local files and headings, skips supported external schemes and rejects retired link targets. |
| Retired-path search | Remaining old names are confined to verbatim/historical prompt records, immutable Iteration 1 provenance snapshots, the checker's rejection list, generated Wiki filenames, and pre-existing historical attribution comments in application source. Those source comments were deliberately left byte-for-byte unchanged to honor the no-application-code boundary; active agent/document links use new paths. |
| Design build | `docs/tools/design/build_design_pdf.py` generated the local HTML, PDF and Design Wiki mirror from `docs/product/design-documentation.md`. |
| Design validation | `docs/tools/design/check_design.py` passed: 12 A4 pages, PDF text parity, six ordered figures/seven panels, canonical diagram hashes and local unpublished Wiki parity. |
| Visual PDF review | Rendered all 12 pages to PNG contact sheets. A clipped three-column architecture table was found, its column ratios were corrected, page 3 was rerendered, and the final page was visually clear. |
| Diff whitespace | `git diff --check` passed. Git emitted only its normal LF-to-CRLF working-copy warning for `README.md`; no whitespace error was reported. |
| Application tests | Not run. Changes are documentation, routing comments and documentation tooling only; no application behavior was changed. |

**Final verification update:** after this evidence and the prompt-log entry were
added, the Markdown checker passed 492 local links across 54 tracked/new Markdown
files. Design validation passed with 12 A4 pages, PDF text parity, six figure IDs,
seven rendered panels, checked manifest hashes and zero errors. `git diff --check`
passed. A changed-path review found no application behavior or application source
changes; the only non-`docs/`/`output/` paths are `.gitignore`, the root README and
agent instructions, and `mobile/AGENTS.md`, all required for documentation routing.

## Wiki and publication status

`output/wiki/` contains an unpublished local mirror for Requirements, Design, the
Iteration 2 prompt log and the draft AI report. It was not uploaded, and no remote Wiki
page or sidebar was changed. Synchronization requires team review plus explicit
publication authorization and a remote read-back check. Requirements retains its
existing Wiki-hosted wireframe image URLs, so that review must also confirm the remote
assets remain available.

## Workflow test

Following only the updated agent instructions routes a new Iteration 2 prompt to
`docs/ai-collaboration/iteration-2/prompt-log.md` and new verification to
`docs/evidence/iteration-2/<area>/`. This record itself exercises the evidence route,
and the Jooyoung entry in the prompt log links back here. Canonical additions also
require updating `docs/README.md`; generated artifacts route to `output/`.
