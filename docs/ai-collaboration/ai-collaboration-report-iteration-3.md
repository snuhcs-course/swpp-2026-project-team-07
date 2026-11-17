# AI Collaboration Report – Iteration 3

**October 23–November 6, 2026**

## 1. Where AI Was Used and Deliberately Not Used

**AI work:** Codex assisted with Review/Rehearse UI and playback changes, Android builds and checks, issues #44–46, release preparation, and Iteration 3 documentation.

Jaewon Choi used Codex GPT-6.1-Sol to fix UI issues in Review/Rehearse, particularly issues involving alignment with the backend. Seoyeon used Codex GPT-6 to fix issues #44–46 and work on documentation.

**Human work:** Seoyeon handled API keys for Azure HTTPS backend to protect credentials. All members performed personal device tests to judge usability, feedback quality, and grading accuracy.

## 2. Prompt History

The [verbatim prompt log](https://github.com/snuhcs-course/swpp-2026-project-team-07/wiki/AI-Collaboration-Prompt-Log) preserves the full history.

## 3. What AI Did Well

- **Regression checks exposed interaction defects.** For issues #44–46, mobile checks passed 607 tests, backend checks passed 601 SQLite tests (with 25 PostgreSQL-only skips), and ten silent Android 16 fixture checks passed. A separate reviewer ran 59 focused mobile tests and 40 backend tests. The work caught a stale accessibility callback. These checks do not establish human acceptance or feedback usefulness.
- **Documentation review found inaccurate guidance before publication.** A reviewer caught an outdated statement about provider use and references to controls absent from the current UI. The team corrected the distinction between PDF profile admission and audio upload/processing, then reran link, Wiki parity, and rendering checks. The documentation was published with PR #50 and Wiki pages; see the [publication record](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/50).

## 4. Hallucinations and Errors

- **Documentation described outdated behavior.** An older guide said uploads did not call providers and named compact-UI controls that were not present. Review caught this; the guide was corrected to distinguish PDF profile admission from audio upload/processing.
- **The documentation conversion introduced errors.** Link checks found release-only paths and a renamed anchor; Wiki checks found duplicated fenced-code delimiters. These errors were corrected, and parity checks passed.

## 5. Prompt Revisions

- **Issue scope (Seoyeon). Before:** “44 and 46 seem like ui fixes i think a fix for 45 is by adding to feedback a specific explanation or concrete suggestion what do u think” **Clarifications:** “I just dont want to touch the ui” and “Keep design, fix behavior.” The follow-up plan specified behavior and wording changes while preserving layout and scoring. This made the UI boundary explicit and gave the checks concrete timing and filler cases.
- **Documentation (Seoyeon). Before:** “Go through github and see whats changed since iteration 2 , whats outdated? whats incorrect?” **After:** A detailed plan naming baselines, deliverables, required corrections, evidence, and validation. That plan made the documentation scope and release distinctions reviewable.

## 6. Manual Fixes and Why

- **Documentation corrections were made after review.** The team revised inaccurate provider and UI guidance and repaired link and Wiki conversion issues, then reran checks rather than treating generated content as authoritative.

## 7. Takeaway for Iteration 4

Frontend and backend tasks were divided among teammates. However, agents tended to suggest editing the UI design, despite being told to work on behavior only. This caused design misalignment, which was discovered during human testing. Prompts should therefore specify these divisions, and human testing should be carried out regularly.
