# AI-use evidence

**Contributor:** Seoyeon, confirmed October 15, 2026. Development and independent AI review are identified separately in the linked task entries.

Phase 1 used Codex desktop and a separate AI reviewer to generate/review the requirements model/API, migration, mobile storage/client/scope helpers, tests and documentation. Actual requests, human decisions, the review finding/fix, verification and pending human inspection are recorded in [the authoritative Iteration 2 task entry](../../ai-collaboration/iteration-2/prompt-log.md#phase-1-ai-feedback-foundation--october-15-2026).

Phase 2's profile schemas/API, reused worker orchestration, cached cue integration, synthetic tests, independent review and Android verification are recorded in [its task entry](../../ai-collaboration/iteration-2/prompt-log.md#phase-2-cached-slide-profiles-and-cues--october-15-2026). The reviewed implementation was committed locally as `67a240a1c74ff8dbeb793394f21aa320c46e522d`; physical-phone and human usefulness acceptance of the new cue categories remain pending. No push, merge or later-phase implementation is implied.

The October 15 Must Cover / Go Deeper revision is recorded in [the active prompt log](../../ai-collaboration/iteration-2/prompt-log.md#phase-2-must-cover--go-deeper-revision--october-15-2026). [Live same-input quality evaluation](ai-feedback/phase-2-cue-quality.md) distinguishes real-provider results from synthetic validation and pending human acceptance.

This is a pointer for the requester's `docs/ai-use.md` handoff requirement; maintain detailed evidence in the active collaboration log rather than a second diary. No human code review, publication, device-flow acceptance or completion of later phases is implied.

Phase 3 timing, longer recording support and verification are recorded in [the task entry](../../ai-collaboration/iteration-2/prompt-log.md#phase-3-required-timing-and-longer-recordings--october-15-2026) and [the evidence record](ai-feedback/phase-3-verification.md). Phase 3 remains uncommitted pending final staged review and inspection.

Phase 3 was subsequently approved and committed as `ee6233be2875739c6c9f8d2c62e9878e4ab759b7`.
Phase 4 correction persistence, separate STT suggestions, explicit feedback updates,
review repairs and verification are recorded in [its task entry](../../ai-collaboration/iteration-2/prompt-log.md#phase-4-confirmed-transcript-corrections--october-15-2026)
and [verification ledger](ai-feedback/phase-4-verification.md). Contributor: Seoyeon. This does
not authorize a Phase 4 commit, publication or Phase 5 work.

The separately approved transcript first/return-visit labels are recorded in the
[follow-up entry](../../ai-collaboration/iteration-2/prompt-log.md#transcript-visit-labels--october-15-2026)
and [verification evidence](transcription/transcript-visits-verification.md). Contributor: Seoyeon.

The playback reliability/word-highlighting follow-up is recorded in
[its task entry](../../ai-collaboration/iteration-2/prompt-log.md#transcript-playback-and-word-highlighting--october-15-2026)
and [verification evidence](transcription/transcript-playback-verification.md). Contributor: Seoyeon.

Phase 4 recognition-only amendment: removed unrestricted transcript edits and
restricted acceptance to persisted AI recognition offers while preserving source
media, synchronization and explicit feedback updates. Contributor: Seoyeon.
See [verification](ai-feedback/phase-4-recognition-only-verification.md) and the matching
[collaboration entry](../../ai-collaboration/iteration-2/prompt-log.md#phase-4-recognition-only-amendment--october-15-2026).

October 16 contextual transcript controls: Contributor Seoyeon requested quieter
sync/status controls and an explicit heading action for AI transcription checks.
[Changes, review repairs and checks](../../ai-collaboration/iteration-2/prompt-log.md#contextual-transcript-controls--october-16-2026).
The immediately retracted custom-editor request was not implemented.

## October 16, 2026 — Phase 5 selected-slide review

Contributor: Seoyeon. OpenAI Codex implemented the approved Phase 5 slice; prompt,
incorporated material and evidence are in the [active prompt log](../../ai-collaboration/iteration-2/prompt-log.md#phase-5-selected-slide-review-october-16-2026)
and [verification ledger](ai-feedback/phase-5-verification.md). AI independent review is distinct
from human review. No publication or later phase is included.

October 16 purpose-aware feedback and interaction repairs: Contributor Seoyeon.
OpenAI Codex modified only the existing Phase 5 pipeline/Review and recognition
controls, with tests and separate AI review. [Prompts and contribution](../../ai-collaboration/iteration-2/prompt-log.md#purpose-aware-feedback-and-reachable-correction-choices-october-16-2026)
and [verification](ai-feedback/phase-5-verification.md#purpose-aware-feedback-and-interaction-repairs-october-16).
External-search enrichment is pending explicit data-sharing approval; the reported
blank screen remains unreproduced. No commit, push or merge.


Phase 6 durable audience Q&A: Contributor Seoyeon. OpenAI Codex implemented and
separately AI-reviewed the selected-run question/answer persistence and existing-screen
integration. [Prompt/contribution record](../../ai-collaboration/iteration-2/prompt-log.md#phase-6-durable-audience-qa-october-16-2026),
[verification and remaining limits](ai-feedback/phase-6-verification.md). No commit/push/merge or
human acceptance is implied.


Phase 6 phone availability repair: Contributor Seoyeon. Codex diagnosed and repaired
an overly strict scope parser after updating the older local API. [Prompts/review](../../ai-collaboration/iteration-2/prompt-log.md#phase-6-phone-qa-availability-repair-october-16-2026)
and [physical-phone/automated evidence](ai-feedback/phase-6-verification.md#phone-qa-availability-repair-october-16).

New-presentation defaults: Contributor Seoyeon. Codex implemented General audience /
five-minute initialization and existing-screen labels, preserving existing saved
preferences. [Request/contribution](../../ai-collaboration/iteration-2/prompt-log.md#new-presentation-defaults-october-16-2026),
[checks and Android evidence](ai-feedback/presentation-defaults-verification.md).


Cue policy v5: Contributor Seoyeon. Codex implemented the approved 8–16-word target /
25-word maximum and stronger non-repetition guidance, with legacy-cache/recovery
compatibility. [Requests/contribution](../../ai-collaboration/iteration-2/prompt-log.md#cue-policy-v5-october-16-2026)
and [automated, real-provider and phone evidence](ai-feedback/cue-policy-v5-verification.md).
No commit, push or merge; human usefulness acceptance remains pending.


Q&A navigation/expression follow-up: Contributor Seoyeon. Codex repaired safe
background question startup and bounded navigation, and added versioned advice on
clearer articulation without transcript editing. Independent review identified a
one-time admission regression, repaired with a persisted-marker test.
[Requests/contribution](../../ai-collaboration/iteration-2/prompt-log.md#qa-navigation-and-clearer-expression-feedback-october-16-2026),
[verification](ai-feedback/qa-navigation-expression-verification.md). Incremental recording held;
no commit, push or merge authorized.


Evidence-validation audit: Contributor Seoyeon. Codex implemented conservative shared
quotation matching, isolated finding validation, accurate existing-screen statuses,
same-visit word spans, bounded metadata and safe saved-receipt revalidation. Separate
AI review identified and verified repairs for unit/operator and Unicode/length cases.
[Request/contribution](../../ai-collaboration/iteration-2/prompt-log.md#evidence-validation-audit-october-16-2026),
[checks, device GET and limitations](ai-feedback/evidence-validation-verification.md). No fresh
provider request, transcript rewrite, commit, push or merge.
