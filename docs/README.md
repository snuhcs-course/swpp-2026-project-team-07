# OutLoud documentation index

This is the canonical map for Team 07's repository documentation. It separates
current product and developer references from dated evidence, generated outputs and
historical records.

**Current iteration:** 2  
**Active AI collaboration log:** [Iteration 2 prompt log](ai-collaboration/iteration-2/prompt-log.md)  
**New evidence location:** `docs/evidence/iteration-2/<area>/`

Repository documents do not automatically publish the GitHub Wiki or establish human
approval. Check each document's status and evidence date before repeating a claim.

## Start here

| Audience or task | Canonical document | Status |
| --- | --- | --- |
| Product scope and user-visible behavior | [Requirements & Specifications](product/requirements-and-specifications.md) | Iteration 2 source; Wiki synchronization pending review |
| Architecture and implementation design | [Design Documentation](product/design-documentation.md) | Iteration 2 source; generated PDF/Wiki mirror is local only |
| Requirement-to-code/test navigation | [Traceability](product/traceability.md) | Current branch map; not acceptance evidence |
| API and persistence contracts | [API contract](architecture/api-contract.md) | Current technical contract |
| Local setup and troubleshooting | [Local development](development/local-development.md) | Current developer guide |
| Commands and evidence navigation | [Verification guide](development/verification.md) | Current command/index guide; not the course Testing Documentation |
| AI-use recording and report preparation | [AI collaboration guide](process/ai-collaboration-guidelines.md) | Current process guide |
| Meeting-log drafting and publication | [Meeting-log workflow](process/meeting-log-workflow.md) | Current internal workflow and template |

## Feature references

| Area | Reference | Status |
| --- | --- | --- |
| AI feedback | [Provider, caching and recovery reference](features/ai-feedback/reference.md) | Current behavior plus clearly labeled Iteration 1 checkpoint history |
| Iteration 2 feedback work | [Phase contract and decision ledger](features/ai-feedback/iteration-2-plan.md) | Active Iteration 2 internal plan/decision record |
| Recording and review | [Rehearsal review](features/rehearsal-review.md) | Current feature reference |
| Mobile transcription | [Mobile transcription client](features/transcription/mobile-client.md) | Current client behavior with historical sections labeled |
| Hosted speech processing | [ElevenLabs Scribe v2](features/transcription/scribe-v2.md) | Current provider, keyterm, consent and verification reference |
| Historical speech processing | [Hosted Whisper adapter](features/transcription/hosted-whisper.md) | Superseded provider reference; speech-gate dependency assessment remains relevant |
| Interface behavior | [Landscape rehearsal](features/interface/landscape-rehearse.md), [light/dark theme](features/interface/light-dark-theme.md), and [Review/Full review](features/interface/review-and-full-review.md) | Current implementation specifications merged from `main` |

## Submission sources

| Iteration 2 deliverable | Repository source | State |
| --- | --- | --- |
| Requirements & Specifications PDF | [Requirements source](product/requirements-and-specifications.md) | Source refreshed; final PDF/export not authorized in this task |
| Design Documentation PDF | [Design source](product/design-documentation.md) | Source refreshed; local generated preview and Wiki bundle only |
| Testing Documentation PDF | Reserved: `docs/product/testing-documentation.md` | **Not created.** Team must first confirm component test owners and predeclared coverage targets. |
| Project Schedule XLSX | Team-maintained spreadsheet outside this repository source | Not changed |
| AI Collaboration Report PDF | [Iteration 2 report draft](ai-collaboration/iteration-2/report-draft.md) | Pre-close draft; contributor confirmation and final one-page export pending |

The Iteration 1 submission snapshots are preserved under
`output/archive/iteration-1/`. Do not overwrite them with Iteration 2 exports.

## AI collaboration records

- [Iteration 1 prompt log](ai-collaboration/iteration-1/prompt-log.md)
- [Iteration 1 report](ai-collaboration/iteration-1/report.md)
- [Iteration 2 prompt log](ai-collaboration/iteration-2/prompt-log.md)
- [Iteration 2 report draft](ai-collaboration/iteration-2/report-draft.md)

Prompt logs preserve actual requests. Reports are short team analyses. Dated task
verification belongs under `evidence/`, not in a second prompt diary.

## Evidence

Evidence is organized by the iteration in which the check or observation occurred:

- `evidence/iteration-1/`: controlled provider, device and design evidence from the
  first submission cycle.
- `evidence/iteration-2/ai-feedback/`: Phase 2–6, cue, Q&A, defaults and evidence-
  validation records.
- `evidence/iteration-2/transcription/`: transcript visit/playback checks and dated
  Scribe v2 full-flow/keyterm evidence.
- `evidence/iteration-2/documentation/`: documentation migrations and validation.

Evidence must state the date, revision when known, exact commands, result, operator
and limitations. Automated checks, AI review, device operation, provider evaluation,
human testing and teammate approval are distinct claims.

## Design production

- Canonical design source: [Design Documentation](product/design-documentation.md)
- Build/check tools: [design tooling](tools/design/README.md)
- Canonical diagram sources and reviewed renders: `assets/design/`
- Generated HTML/PDF/Wiki artifacts: `output/`
- Iteration 1 design provenance: `evidence/iteration-1/design/`

Generated outputs are never the primary editing source. Wiki-ready files under
`output/wiki/` are local previews until an authorized publication is verified.

## Archive

`archive/iteration-N/` contains superseded plans, handoffs, scaffold explanations,
old ownership suggestions and raw historical AI records. Archive files may contain
old commands, paths, branches and pending-work statements. They are evidence of what
was known then, not current instructions.

Agents must follow [docs/AGENTS.md](AGENTS.md) before creating or relocating
documentation. Repository-wide rules remain in [../AGENTS.md](../AGENTS.md).
