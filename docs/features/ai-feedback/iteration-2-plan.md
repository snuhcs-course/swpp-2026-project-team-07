# Iteration 2 AI feedback contract and phase ledger

**Status: Historical execution ledger and active contract record.** Use the current
API contract and feature reference for behavior; use this file to understand phase
decisions and authorization boundaries.

Approved base: `front-end-design-JJ` at `eeb3307a431e62d80b2b2d261420963193da22c3`.
Implementation branch: `it2/feature/ai_feedback`. Phase 1 is committed locally as `2bd6cd2ad7128bb30d59da8dae818b5bdb01d66c`; Phase 2 as `67a240a1c74ff8dbeb793394f21aa320c46e522d`, followed by documentation commit `fb616d6cc80f3f9ec9561c7b89a827a399d24867`. None is pushed. The user authorized Phase 3 execution on October 15; the separate UI scope update below does not authorize later phases.

Phase 3 and its authorized transcript follow-ups were subsequently committed as
`ee6233be2875739c6c9f8d2c62e9878e4ab759b7`. The user authorized the amended
Phase 4 implementation on October 15. Phase 4 was committed as `c99d74b` after approval. Its recognition-only contract
is tracked in [Phase 4 verification](../../evidence/iteration-2/ai-feedback/phase-4-recognition-only-verification.md).
Phase 5 was approved and committed locally as `6a4dfb11afdc7990759a5ca0bf150460174b25d4`.
Phase 6 implementation is staged for inspection under separate user authorization; see [its execution ledger](../../evidence/iteration-2/ai-feedback/phase-6-verification.md).

## Full implementation contract

1. Detect slide/speech differences, especially graph interpretation and numerical inconsistencies, using slide images and text with evidence and uncertainty.
2. Ask for required presentation duration and allocate per-slide time from it. Support required durations and recordings up to 30 minutes; retain the 25,000,000-byte upload limit, using mono AAC at 64 kbps for new recordings in Phase 3.
3. Highlight likely recognition errors or wrong/nonexistent words, offer intended alternatives and custom edits, and let users keep the original. Preserve original transcripts/audio and their timestamps; confirmed corrections must inform analysis.
4. Save the intended audience and adapt feedback to that audience's knowledge and terminology. Do not rewrite the transcript.
5. Analyze repeated terms and filler words, distinguishing useful technical repetition from problems.
6. Generate essential Must Cover and optional Go Deeper guidance, each zero to three items per slide, including graphs and full-deck connections; do not pad title/closing or sparse slides. This October 15 scope update supersedes the original single zero-to-four cue collection.
7. After each recording, produce at most four prioritized problems per recorded slide. A successful no-problem analysis may say “Looks good!”; unavailable or failed analysis must never masquerade as success.
8. Generate up to three audience-specific Q&A questions with follow-ups from slide profiles and the selected run; reuse answer recording/evaluation.

Automatically generate analysis without separate consent prompts when its prerequisites are ready. Reuse immutable/versioned slide profiles across recordings. Keep every attempt and JJ's selected-run/Keep/Overwrite behavior; accept/reject retakes without mixing output identities. Changes to inputs invalidate only dependent outputs; reopening, refresh and playback do not generate requests. Failed/uncertain submitted calls retain explicit retry rather than blind automatic resubmission. Provider configuration, quotas, source validation, receipts and recovery remain required.

Phase 4 amendment (October 15): saving confirmed corrections, invalidating dependent feedback, and regenerating feedback are three separate operations. Correction saves/synchronization never enqueue presentation feedback. Retain outdated results with their transcript revision and analysis version; do not present them as current. Regeneration requires an explicit request (or a separately defined and approved application workflow), uses the latest synchronized revision, and blocks unresolved synchronization/conflicts. This exception takes precedence over the general automatic-analysis rule above. Transcription suggestions are a separate pipeline and never trigger presentation feedback. Screen opening, navigation and playback admit neither pipeline.

The October 15 scope update authorizes designing and implementing additional transcript correction controls in Phase 4 and redesigning the problem-summary layout within JJ's existing Review experience in Phase 5. Prefer extending existing components; preserve JJ's visual language and selected-run architecture. This authorizes their scope within those phases, not advancement into them.

Still held: the duration/audience presentation requirements sheet, any other new screens, and unrelated UI redesigns. Existing-control integration may be done in its authorized phase. No UI design is implemented in Phase 1.

The user-authorized automatic generation/no-separate-consent behavior supersedes the old repository requirements for requested feedback/disclosures on this branch. Those old flows remain unchanged in Phase 1; implementing their replacement belongs to later phases. This document records that conflict instead of claiming the old text already describes the new behavior.

## Phase sequence and inspection gates

| Phase | Deliverable | Dependencies | Acceptance gate |
| --- | --- | --- | --- |
| 1 | Independent presentation requirements/context, client/storage, canonical input scope | JJ baseline | Strict API, revisions, SQLite reopen, legacy preservation, PostgreSQL migration/concurrency, full regression suites |
| 2 | Cached image-aware slide profiles and AI cues | 1 | Graph/text/sparse/uncertain sources, bounded output, deduplication and worker recovery |
| 3 | Required-duration allocation and 30-minute recording | 1–2 | Exact allocation sum, boundary/upload tests, real 30-minute capture/upload/transcription; requirements-entry UI held |
| 4 | Revisioned confirmed corrections, AI suggestions and additional correction controls within JJ's existing transcript editor | 1 | Incorrect terms, mixed languages, slide boundaries, original timestamps, offline/reload/stale synchronization; Android suggestion/replacement/custom-edit/keep-original interactions |
| 5 | Per-slide content/audience/timing/delivery problems and redesigned selected-run summaries within JJ's existing Review experience | 1–4 | Evidence/graphs/paraphrases/retakes, zero to four prioritized findings, evidence playback navigation; Android interactions and distinct pending/failed/insufficient-evidence/successful states |
| 6 | Durable audience Q&A | 1, 2, 4, 5 | Audience/scope changes, concurrent scheduling, quota/receipt/restart recovery, answer flows |
| 7 | Requirements UI after its separate approval and complete integration | Requirements-sheet approval and 1–6 | Full Android flow plus human chart/advice evaluation |

After each phase: run relevant checks, document functionality and limits, independently review the staged diff, fix/retest confirmed defects, present evidence, then stop for inspection. No advancement, commit, push or merge without user authorization.

## Authorized UI scope for Phases 4 and 5

### Phase 4 — Confirmed recognition corrections

October 15 product amendment supersedes unrestricted manual/custom editing:
transcripts must faithfully represent speech. Existing controls now offer only
AI recognition replacements or Keep original, source playback and Restore original.
Grammar/phrasing/fillers/repetitions/factual explanations must be improved through
rerecording, not transcript rewrites. The persistence/revision/synchronization and
explicit feedback-regeneration requirements below remain in force. Detailed current
behavior and physical-device checklist: [recognition-only verification](../../evidence/iteration-2/ai-feedback/phase-4-recognition-only-verification.md).

Historical scope below is superseded wherever it permits manual/custom editing.

- Extend JJ's existing transcript editor where practical. Support AI suggestions, selecting replacements, entering custom corrections, and keeping the original transcript; never silently apply a suggestion.
- Preserve original transcript/audio and timestamps. Confirmed corrections belong to their source attempt and revision, and must follow the currently selected slide take without changing Keep/Overwrite behavior.
- Add interaction tests for suggestion selection, custom-edit save/cancel, keeping the original, revision conflicts, and replacing/rejecting a take while a suggestion or draft is open.
- Verify on Android: highlighted-word selection, replacement controls, keyboard and scrolling behavior, playback after edits, persisted corrections after reopening, and the existing rehearsal/Compare flow. Distinguish automated interaction tests, agent-operated Android checks and human acceptance.
- Persist source-indexed correction overlays independently of original STT/audio. Increment the effective transcript revision only for changed text; identical saves and suggestion dismissal do not advance it. Preserve pending local edits through offline failures and concurrent server updates.
- Mark dependent recording feedback outdated immediately for pending local changes and after synchronization. Retain historical output, slide-only cue caches and independent audio metrics. Conservatively invalidate a whole-attempt analysis that consumes the whole transcript, including every affected boundary visit; future per-slide dependency scopes belong to Phase 5.
- Expose updating through existing feedback controls. Synchronize first; verify the captured revision again at admission. Deduplicate by source attempt, transcript revision, analysis type/version and other relevant dependencies. Fence late results against newer input. Keep explicit failure/uncertainty recovery.
- Generate STT suggestions independently; require confirmation and reject stale ranges/revisions. Preserve custom sentence edits, keep-original decisions, playback and word highlighting. Test repeated occurrences, boundaries, offline/reopen, conflicts, multiple edits, in-flight saves, concurrent regeneration, duplicate requests, late responses and cue preservation.

### Phase 5 — Review problem-summary layout

- Redesign within JJ's existing Review experience, showing zero to four prioritized findings per recorded slide. Include supporting evidence and navigation to the relevant slide/audio interval using existing validated playback behavior.
- Make pending, failed, insufficient-evidence and successful states distinct. Successful analysis with zero supported findings may show “Looks good!”; missing/insufficient evidence or a failed request must not show that success state.
- Bind findings and playback evidence to the selected source attempt/segments and input revisions. Changes of selected take or corrected transcript must not display superseded results as current or navigate to unrelated audio.
- Add state/interaction tests for zero/four findings, prioritization, evidence selection, playback navigation, partial recordings, stale responses, accepted/rejected retakes and failed retries. Verify the redesigned layout, evidence interactions and existing Review navigation on Android, including readable text and accessibility labels.

Do not add standalone correction/summary screens or use these authorizations to implement the held requirements sheet or unrelated redesigns. New screens require separate authorization. Phase approval, verification, independent-review and inspection gates remain unchanged.

## Phase 1 implementation decisions

- `PresentationContext` is independent of the deduplicated PDF. Two contexts can reference one deck with different requirements. The client reserves a UUID before POST so failed requests can be retried without duplicate contexts.
- Create starts at revision 0 with duration `null` and audience `""`. PATCH sends the full requirement values and expected revision. Only changed values increment revision; stale writes conflict even when their requested values happen to match. Duration can be cleared and audience can be blank. Neither is inferred from legacy defaults.
- Mobile records use a separate versioned, API-address/local-presentation namespace. Reads of missing requirements do not write or alter `pres:v1`/`deck:v1` records. Missing, partial, and ready status is derived from explicit duration and nonblank audience. A reserved context is not proof of provided requirements.
- Validate identities and revisions before caching. Reject rebinding or different values at the same revision; ignore older responses. Refresh/create/update are caller-driven helpers only; no screen invokes them yet.
- A canonical private JSON scope includes source/context identity, requirement/profile/analysis versions, selected attempt and transcript/correction revisions, and ordered segment bounds/null slides. Run labels/UUIDs and object insertion order do not change identity. This is identity input only, not a cryptographic/public identifier or a job admission implementation.
- No existing attempt, transcript, run, UI, worker or provider path is changed. The 10-minute capture limit remains until Phase 3. Duration up to 30 minutes is accepted as requirements metadata, not a Phase 1 recording-support claim.

## Phase 1 verification and status

Baseline at the approved JJ revision: `npm run check` passed (168 tests); backend SQLite suite passed (286 tests, 19 skips). The skips do not establish PostgreSQL behavior. At the Phase 1 inspection, HEAD was the Phase 1 commit recorded above.

Phase 1 verification and independent-review findings are recorded in the task's entry in [the active collaboration log](../../ai-collaboration/iteration-2/prompt-log.md). Provider/profile worker behavior advances in Phase 2 below; correction synchronization, allocations, longer captures, the separately authorized Phase 4/5 UI and complete user flows remain outstanding in their assigned phases.

## Phase 2 implementation decisions

- Reuse `DescriptionSet`/`DescriptionJob`, the deck row lock, existing uniqueness constraint, shared quotas, durable receipts and Celery/Beat recovery. Current JSON scopes use `slide-profile-v5` / `slide-profile-gemini-v5` and prompt `slide-profile-v5`. Preserve v1–v4 identities and validation for historical normalization/recovery; reuse successful same-source v4 caches. No database migration or new job infrastructure. Cues target 8–16 words with a maximum of 25, one speaking objective, no repetitive clauses or duplicate objectives, no linking rationale, with supporting details collapsed by default. Seek meaningful guidance on readable content slides before returning empty categories; preserve sparse/unreadable exceptions.
- Profiles retain slide/source IDs, summary, key ideas, visual facts and uncertainty, plus slide kind, zero to three Must Cover objectives and zero to three optional Go Deeper suggestions. Local certain-fact references ground essential objectives; optional suggestions include exact quoted current/cross-slide premises and explicit missing-information questions. Graph axes, units, values and comparisons belong in visual facts. Profiles are immutable; historical descriptions and editable JJ description scopes retain their exact schemas/prompts.
- Successful PDF POST automatically admits one current source/profile scope when configured. Repeated imports, concurrent admissions and accepted/failed/uncertain cached scopes reuse the job. A broker failure leaves the existing durable recovery mechanism responsible for delivery. Disabled or failed AI admission does not fail PDF import.
- GET, screen reopening, polling, playback and retakes never admit jobs. Legacy decks or imports made with AI disabled can use an explicit generate action in the existing cue panel. Failure/uncertainty requires revisioned recovery; the existing Dialog is reused for acknowledging potentially charged uncertain resubmission, not for initial consent.
- Duration, audience, recordings and corrections do not invalidate profiles. Source identity or provider/project/model/prompt/schema changes select a new scope. Previous snapshots remain saved. No timing, speech feedback, corrections or Q&A implementation advances in this phase.
- JJ's existing explicit coaching still uses its legacy description scope. It can therefore perform its own description scan even when a cue profile is cached; profile consumption by the new speech-feedback pipeline belongs to Phase 5. Profile deduplication is per profile scope, not a promise of one total provider call across all existing features.
- The Rehearse cue toggle reads validated cached profiles with an essential/optional selector instead of keyword heuristics. Existing styling is retained with scrolling for long cues and distinct pending/failed/disabled/offline/stale/insufficient-evidence states. A separate API/deck cache preserves cues offline and fences reversed refreshes. Historical flat cues are not relabeled essential points. No requirements sheet or new screen is added.

Phase 2 verification, review and outstanding limits are recorded in the active collaboration log before inspection. Agent-operated synthetic worker/Android checks do not establish real-provider cue quality or human acceptance.

## Phase 3 — implementation and inspection record

The user authorized Phase 3 only on October 15. Required timing reuses Phase 1's
explicit context duration and JJ's deterministic text-weighted allocation, with
exact whole-second sums. Missing requirements remain distinct from legacy suggested
targets. Allocation is derived on read; duration changes do not rewrite selected
runs, Compare snapshots, profiles or transcripts and admit no provider jobs.

New capture uses mono AAC at 64 kbps. The timeline cap increases to thirty minutes
through recording, recovery, upload, packaged VAD and result/evidence consumers;
the 25,000,000-byte cap and source audio/attempt identities remain unchanged.
No new UI sheet, screen, database migration or worker infrastructure is added.
The existing timing readout labels requirements versus suggestions.

[Implementation decisions, checks, live-provider evidence and remaining acceptance
limits](../../evidence/iteration-2/ai-feedback/phase-3-verification.md) record completed checks and independent review.
Phase 3 was subsequently committed as `ee6233b`. Phase 4 implementation and its
current inspection gate are recorded in [the Phase 4 ledger](../../evidence/iteration-2/ai-feedback/phase-4-verification.md).
Seoyeon confirmed short phone playback/transcription. A separately authorized
follow-up now labels first/return visits within the existing transcript panel;
see the [follow-up evidence](../../evidence/iteration-2/transcription/transcript-visits-verification.md). Physical-phone
long-capture acceptance remains pending. The presentation requirements sheet remains held.

## Phase 5 execution ledger (October 16)

Authorized scope: selected-visit per-slide content/graph, audience, repetition/filler,
evidence-based delivery and explicit-duration timing findings in JJ's existing Review.
Base: `c99d74b`; branch `it2/feature/ai_feedback`. No Phase 6, requirements sheet,
new screen, commit, push or merge is authorized by this execution request.

- Reuse FeedbackAnalysis/FeedbackJob, provider receipts, quotas and recovery; introduce
  `review_<scope digest>` analysis types without schema changes. Scope is context ID
  plus ordered chosen slide visits within one source attempt. Normal UI requests one
  selected slide at a time to avoid deck-sized output and preserve partial-run review.
- Reuse image-aware cue profile jobs/caches as the description dependency. Keep the
  full guidance snapshot, adapting common facts to the existing evidence adapter.
- Capture explicit requirements revision, transcript revision, review version and
  original source identity. Context/correction/profile changes fence stale results.
- Saving corrections never generates review; Review opens/refreshes are GET only.
  Analyze slide / Update feedback explicitly synchronizes before admission.
- Ruling: retain whole-attempt transcript invalidation within each selected-visit
  scope. A correction near a boundary can affect surrounding interpretation; a
  narrower dependency graph would risk falsely current findings. Cost: another
  selected slide may need an explicit refresh after an unrelated correction.
- Ruling: use timestamp/text evidence for delivery. This pipeline does not receive
  audio acoustics, so it must not infer voice volume, tone or eye contact. Cost:
  acoustic delivery evaluation remains unavailable rather than fabricated.
- Preserve all recordings, original STT, accepted recognition overlays, cue caches,
  Keep/Overwrite and recording-details playback. Requirements-entry UI remains held.

Verification and independent-review evidence will be recorded in
`docs/evidence/iteration-2/ai-feedback/phase-5-verification.md` before the inspection gate.

October 16 first-feedback amendment: Seoyeon authorized automatic initial feedback
from the completed selected-recording workflow. There is no initial Analyze slide
button; one durable initial admission is allowed per source/selected slide. Existing
completed/running analysis reuses its result/job. This initial workflow is the
explicitly defined exception permitted by the Phase 4 regeneration amendment.
Confirmed corrections/requirements changes still require Update feedback, and
failures/uncertain submissions require explicit retry. Navigation and playback do
not admit work; unrelated historical recordings are not backfilled automatically.

## October 16 purpose-aware coaching and interaction amendment

Both informative/descriptive and analytical/persuasive evaluation are supported
in the shared Phase 5 evaluator, automatically selected from deck purpose; mixed
or uncertain purpose uses only justified criteria. Informative presentations are
assessed for essential explanations and audience understanding, not missing
hypotheses or exhaustive topic coverage. Already-explained ideas must not be
recommended again. Optional illustrative Go deeper ideas are separate from actual
problems, expandable in Review, and never alter the transcript or verdict.
Research-backed factual/story enrichment remains pending explicit approval of
OpenAI web-search data sharing after automatic approval review rejected enabling
that destination. No search tool has been enabled or workaround used.

Review allows pull-down navigation from the top of its scrolling content and
exposes tappable existing footer actions. Recognition replacements appear in a
scrollable popover on the existing rehearsal screen, avoiding clipped choices
below long transcript sentences. Accept, Keep original, Restore original and
source-audio playback remain recognition-only. No custom editor, new screen,
requirements sheet, commit, push, merge or Phase 6 is included.

## Phase 6 implementation decisions (October 16)

Use the existing Q&A screen and preserve legacy endpoints/caches. New question
requests submit only a selected-run manifest; the server validates complete original
visits and captures synchronized correction revisions for every selected source.
Question jobs reuse cached image-aware profiles and existing quota, receipt, worker
and recovery machinery. Stable question IDs are bound to the exact job generation.

`QaAnswer` links an immutable question ID/part/generation to one existing Attempt.
Original answer audio, transcription receipts, word times and alignment stay on
Attempt. Retry preserves identity; rerecord creates a new identity. Completed STT
advances to evaluation through the worker/recovery workflow. GET never admits work.

A separate Phase 6 initial-eligibility marker prevents installing this phase from
backfilling old recordings. Subsequent corrections/audience/source changes invalidate
questions without generation. Saved generations (including legacy local Q&A) remain
read-only and playable within the current screen. No requirements sheet/new screen.

## New-presentation default policy (October 16)

Seoyeon authorized `General audience` and five minutes for new imports. Save these
through the existing context revision API; label them as defaults rather than
silently treating legacy suggestions as entered requirements. Preserve existing
presentation preferences and legacy missing values. This supersedes the earlier
missing-requirement rule only for the new-import default initialization workflow;
the separate requirements sheet remains held. [Verification](../../evidence/iteration-2/ai-feedback/presentation-defaults-verification.md).


### Approved follow-up — Q&A readiness and clearer expression (October 16)

Repair automatic question admission after safe synchronization failures and keep
navigation within the complete saved question set. Add meaning-preserving expression
advice to existing Review findings under `slide-review-v3`; retained old reviews need
explicit Update feedback. Incremental recording remains held. No unrestricted editing.
See [verification](../../evidence/iteration-2/ai-feedback/qa-navigation-expression-verification.md).


### Evidence-validation follow-up (October 16)

Seoyeon authorized a scoped grounding audit: safe quotation normalization, independent
finding validation, accurate review statuses, same-visit chunk crossing, bounded Q&A
names and structural metadata comparison. Original source/revision/word/timing checks
remain strict. No generation prompt redesign or new screen. Completed behavior,
regressions, independent AI review and current-device GET verification are recorded
in [the evidence ledger](../../evidence/iteration-2/ai-feedback/evidence-validation-verification.md). No commit/push/merge.
