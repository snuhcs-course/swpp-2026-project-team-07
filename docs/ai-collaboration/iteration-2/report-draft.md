# AI Collaboration Report: Iteration 2 — Pre-close Draft

**Status:** Draft for team review, not the final one-page report. Iteration dates,
complete contributor confirmation, final PR/commit references, manual-edit notes and
time-saved estimates remain to be confirmed at close. Full verbatim prompts are in the
[Iteration 2 prompt log](prompt-log.md).

## 1. Where AI Was Used

The recorded work used OpenAI Codex for meeting-log consolidation, repository-agent
instructions, README and documentation maintenance, mobile UI and playback changes,
transcription/recovery work, and the phased AI-feedback implementation. Jaewon's log
also records Claude (configured as `claude-opus-5-5`) for a design-prototype rebuild.
The exact Codex model is often not recorded and must remain labeled that way. AI also
operated automated tests, emulators or a connected phone in specifically identified
tasks. Those checks are not human testing. Team decisions, approval, manual edits and
work performed without AI are incomplete in the current records and must be supplied
by each contributor before finalization.

## 2. Prompt History

The full log preserves prompts verbatim by contributor and task rather than rewriting
them for this summary. Examples include Seoyeon's staged instruction, "Proceed with
Phase 1 only, following the specified revision and isolated checkout requirements,"
and the later instruction to remove manual sentence editing while retaining shared
AI-correction functionality. Jaewon's entries retain successive icon and mobile-design
requests, including corrections and stop conditions. Injoon's entries preserve the
request to generalize agent instructions and separate the detailed meeting workflow.
This report links the full log because reproducing it would exceed the 500–700-word
limit.

## 3. What AI Did Well

Codex was effective at turning bounded feature contracts into testable revision and
recovery behavior. For Phase 2 slide profiles it added source/configuration-scoped
caching, durable jobs and frontend reconciliation, then exercised focused backend,
mobile, worker and Android paths. Independent AI review found a test-isolation issue;
the implementation was corrected and rerun rather than reporting the initial pass.
For transcript playback, review caught stale-source and overlapping-seek failures and
the final focused tests passed. Documentation work also benefited from mechanical
link/path checks: earlier tasks caught wrong anchors and preserved verbatim prompt
whitespace instead of silently editing historical records. No reliable time-saved
estimate has been supplied, so this draft does not invent one.

## 4. Hallucinations and Errors

The log records concrete tool and reasoning failures. An initial meeting-note search
looked in the wrong workspace area until the requester named the correct pages. A
table checker misclassified a two-column decision row; contiguous table-width checks
caught and corrected it. Early shared instructions incorrectly said prompt logging was
not automatically required even though the repository already assigned it to agents.
Mobile work also surfaced invented or stale assumptions through real checks: missing
modules/imports, obsolete components, old ten-slide expectations and tests tied to a
previous feedback schema. These were detected by typecheck, lint, tests, live source
inspection or independent review. Repair time was generally not recorded.

## 5. Prompt Revisions

The clearest recurring improvement was narrowing broad requests into phase and
boundary constraints. "Implement the feedback features" became a sequence that named
the approved revision, limited work to one phase, required baseline inspection and
specified verification before proceeding. The transcript-editing request was revised
to distinguish manual editor-only components from shared correction, playback and
accessibility paths. This reduced accidental deletion of shared behavior. UI prompts
also improved after the user supplied concrete visual references and explicitly named
which characteristics to preserve or change.

## 6. Manual Fixes and Why

The log distinguishes requester decisions and human phone confirmation from
agent-operated edits, but it does not yet contain every member's manual-code edits.
Known human decisions include phase authorization, scope exclusions, contributor-name
corrections, visual direction and whether runtime services could remain active. The
team must add any code rewritten by hand, why prompting stopped, and reviewer/owner
confirmation before this section can be final. Absence of that information is not
evidence that no manual fixes occurred.

## Takeaway for Iteration 3

Use phase-bounded prompts with explicit source revisions and acceptance checks, and
record human edits and elapsed repair cost when they happen rather than reconstructing
them at iteration close.
