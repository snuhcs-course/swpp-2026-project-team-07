# Iteration 2 AI feedback contract and phase ledger

Approved base: `front-end-design-JJ` at `eeb3307a431e62d80b2b2d261420963193da22c3`.
Implementation branch: `it2/feature/ai_feedback`. Only Phase 1 is authorized for this pass.

## Full implementation contract

1. Detect slide/speech differences, especially graph interpretation and numerical inconsistencies, using slide images and text with evidence and uncertainty.
2. Ask for required presentation duration and allocate per-slide time from it. Support required durations and recordings up to 30 minutes; retain the 25,000,000-byte upload limit, using mono AAC at 64 kbps for new recordings in Phase 3.
3. Highlight likely recognition errors or wrong/nonexistent words, offer intended alternatives and custom edits, and let users keep the original. Preserve original transcripts/audio and their timestamps; confirmed corrections must inform analysis.
4. Save the intended audience and adapt feedback to that audience's knowledge and terminology. Do not rewrite the transcript.
5. Analyze repeated terms and filler words, distinguishing useful technical repetition from problems.
6. Generate zero to four important AI talking cues per slide, including graphs; do not pad title/closing or sparse slides.
7. After each recording, produce at most four prioritized problems per recorded slide. A successful no-problem analysis may say “Looks good!”; unavailable or failed analysis must never masquerade as success.
8. Generate up to three audience-specific Q&A questions with follow-ups from slide profiles and the selected run; reuse answer recording/evaluation.

Automatically generate analysis without separate consent prompts when its prerequisites are ready. Reuse immutable/versioned slide profiles across recordings. Keep every attempt and JJ's selected-run/Keep/Overwrite behavior; accept/reject retakes without mixing output identities. Changes to inputs invalidate only dependent outputs; reopening, refresh and playback do not generate requests. Failed/uncertain submitted calls retain explicit retry rather than blind automatic resubmission. Provider configuration, quotas, source validation, receipts and recovery remain required.

All new UI designs are held: duration/audience requirements sheet, additional correction controls, and redesigned problem-summary layout. Existing-control integration may be done in its authorized phase. No UI design is implemented in Phase 1.

The user-authorized automatic generation/no-separate-consent behavior supersedes the old repository requirements for requested feedback/disclosures on this branch. Those old flows remain unchanged in Phase 1; implementing their replacement belongs to later phases. This document records that conflict instead of claiming the old text already describes the new behavior.

## Phase sequence and inspection gates

| Phase | Deliverable | Dependencies | Acceptance gate |
| --- | --- | --- | --- |
| 1 | Independent presentation requirements/context, client/storage, canonical input scope | JJ baseline | Strict API, revisions, SQLite reopen, legacy preservation, PostgreSQL migration/concurrency, full regression suites |
| 2 | Cached image-aware slide profiles and AI cues | 1 | Graph/text/sparse/uncertain sources, bounded output, deduplication and worker recovery |
| 3 | Required-duration allocation and 30-minute recording | 1–2 | Exact allocation sum, boundary/upload tests, real 30-minute capture/upload/transcription; requirements-entry UI held |
| 4 | Revisioned confirmed corrections and recognition-error suggestions | 1 | Incorrect terms, mixed languages, slide boundaries, original timestamps, offline/reload/stale synchronization; new controls held |
| 5 | Per-slide content/audience/timing/delivery problems and selected-run summaries | 1–4 | Evidence/graphs/paraphrases/retakes, stale/failed output isolation, zero to four findings; new layouts held |
| 6 | Durable audience Q&A | 1, 2, 4, 5 | Audience/scope changes, concurrent scheduling, quota/receipt/restart recovery, answer flows |
| 7 | Approved requirements UI and complete integration | UI approval and 1–6 | Full Android flow plus human chart/advice evaluation |

After each phase: run relevant checks, document functionality and limits, independently review the staged diff, fix/retest confirmed defects, present evidence, then stop for inspection. No advancement, commit, push or merge without user authorization.

## Phase 1 implementation decisions

- `PresentationContext` is independent of the deduplicated PDF. Two contexts can reference one deck with different requirements. The client reserves a UUID before POST so failed requests can be retried without duplicate contexts.
- Create starts at revision 0 with duration `null` and audience `""`. PATCH sends the full requirement values and expected revision. Only changed values increment revision; stale writes conflict even when their requested values happen to match. Duration can be cleared and audience can be blank. Neither is inferred from legacy defaults.
- Mobile records use a separate versioned, API-address/local-presentation namespace. Reads of missing requirements do not write or alter `pres:v1`/`deck:v1` records. Missing, partial, and ready status is derived from explicit duration and nonblank audience. A reserved context is not proof of provided requirements.
- Validate identities and revisions before caching. Reject rebinding or different values at the same revision; ignore older responses. Refresh/create/update are caller-driven helpers only; no screen invokes them yet.
- A canonical private JSON scope includes source/context identity, requirement/profile/analysis versions, selected attempt and transcript/correction revisions, and ordered segment bounds/null slides. Run labels/UUIDs and object insertion order do not change identity. This is identity input only, not a cryptographic/public identifier or a job admission implementation.
- No existing attempt, transcript, run, UI, worker or provider path is changed. The 10-minute capture limit remains until Phase 3. Duration up to 30 minutes is accepted as requirements metadata, not a Phase 1 recording-support claim.

## Phase 1 verification and status

Baseline: `npm run check` passed (168 tests); backend SQLite suite passed (286 tests, 19 skips). The skips do not establish PostgreSQL behavior. Worktree HEAD equals the approved base.

Final verification and independent-review findings are recorded in the task's entry in [the active collaboration log](ai-collaboration-prompts-iteration-2.md). New UI, provider behavior, worker orchestration, correction synchronization, allocations, longer captures, and complete user flows remain outstanding in their assigned phases.
