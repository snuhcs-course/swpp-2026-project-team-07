# Iteration 1 team handoff

The scaffold/branch, hosted-processing, rehearsal-review and checkpoint-2/3 sections below are historical. Checkpoint 4 records its completed coordinator verification; the final checkpoint-5 section records completed controlled evaluation and its remaining human/device limits.

This is a shared starting scaffold based on the submitted Expo/React Native/TypeScript Android + Django REST architecture. Hours are outside this task. The schedule does not establish individual feature owners; assign names as a team.

Use [team-work-division.md](team-work-division.md) for the recommended owner split, detailed completion checks, shared-file coordination, and branch commands.

| Branch | Main files | Implement | Acceptance evidence |
| --- | --- | --- | --- |
| `feature/pdf-viewer` | `mobile/src/features/pdf/`, backend `services/pdf.py` | Pick/persist/upload PDF; ordered slide images/text; real viewer | 3–5-page PDF, page boundaries, cancellation/invalid-file handling |
| `feature/recording-tracking` | `mobile/src/features/recording/` | Permission, real audio, durable file, slide events on audio timeline | Playback and checked forward/backward transition timestamps |
| `feature/whisper-alignment` | `mobile/src/features/transcription/`, backend `services/transcription.py`, `services/alignment.py` | Upload, hosted Whisper, word timestamps, slide matching, transcript UI | Real words and human-checked boundaries; failure retains audio |
| `feature/prototype-integration` | Backend `services/feedback.py`, `tasks.py`, API handlers, shared types | Storage/worker integration, initial Gemini image feedback, evidence validation | PDF → recording → transcript → matching → feedback |

The last row is an integration responsibility, not necessarily a fourth person. Initial Gemini feedback is included in the submitted Iteration 1 scope.

## Historical scaffold: already wired

- Four screen frames with back navigation and explicit sample-data notices.
- Sample slide navigation, audience input, and sample/processing/failure result previews.
- A real app-to-Django HTTP health check.
- Deck/slide/attempt models, initial migration, metadata validation.
- PostgreSQL, Redis, shared media and Celery development configuration.
- Feature interfaces, backend adapter entry points, setup docs and CI checks.

## Historical scaffold implementation entry points

- `pdfService.importPdf()` raises a not-implemented error. Implement picker cancellation as `null`; never substitute demo data for a real import.
- `SlidePreview` renders designed sample slides. Replace it with real slide images, or agree on a native PDF renderer before adding a dependency.
- Recording controls are disabled. Implement `RecordingService` before enabling them; a timer alone does not establish audio capture.
- Results combine the saved Whisper transcript of synthetic speech with local audio playback, synchronized word highlighting and tap-to-seek; other states remain explicit previews. Live `AttemptResult` wiring remains pending; no app upload is claimed.
- The [mobile transcription client](mobile-transcription.md) now implements requests and cancellable polling with mocked tests on `feature/transcription-client-and-playback`. Native upload and recorder/result-screen integration are not yet verified.
- Feature API routes return HTTP 501. Implement real storage/processing instead of fake success responses.
- The Celery task, PDF, and feedback adapters still raise `NotImplementedError`. The [Whisper adapter](whisper-transcription.md) is implemented with mocked-provider tests; a live synthetic TTS check passed; human-recorded speech verification is pending. The standalone [word alignment function](word-alignment.md) is implemented and tested on `feature/whisper-alignment`; its proposed output needs integration review before worker wiring.

## Shared rules

Follow `api-contract.md`: zero-based slide indexes, integer milliseconds relative to actual captured audio, and a new attempt ID for every new recording. Processing retries preserve the ID/audio. Keep every repeated/backward slide visit. The PDF owner supplies images/text for feedback. The recording and Whisper owners agree on the capture-start signal and time base before integration.

Coordinate shared model/migration changes. Keep provider credentials on the backend. Evaluate real recordings before claiming filler/repetition/false-start detection. Saved-attempt browsing, selected-slide retries, and comparisons belong to later iteration UI; this scaffold retains the data identities needed for them.

Start branches from the reviewed scaffold commit. Follow the team's review/testing agreement before pushing. Include commands, device evidence and limitations in each PR. Integrate on an Android device; the submitted plan names Galaxy S22/S23.


## Initial stage 1 restoration branch plan (historical, 2026-10-08)

Real local PDF identity, native page count (up to 10), confirmed selected starting page, and audio-timed page-change callbacks are connected to capture. Actual saved audio plays in Results without a sample transcript. Capture failures/navigation use the reviewed lifecycle behavior.

Stage 1 is being prepared on isolated `codex/recording-review-fixes`, `codex/pdf-import`, and `codex/pdf-recording-restore` branches. Recording fixes are based on PR #13 head `040880f8`; PDF/integration snapshots start from main `f6f6e766`. Integration currently includes its prerequisites so it can be tested before commits. After human review, merge the recording/PDF prerequisites first and refresh the integration PR base. Updated user direction (2026-10-08): publish the review branches and continue all remaining stages while teammate review is pending. Later stages stack on the preceding implementation branch; maintainers merge in dependency order. No agent merge is authorized.

The local prototype and earlier worktrees are reference sources, not merge bases. Reused code/tests originate in local recording `b28de880`, PDF `260dcbae`, and the preserved unfinished integration worktree. The original worktrees remain unchanged.


## Hosted-processing base handoff (2026-10-08)

This stage builds on committed storage base `06fe340`. The current user explicitly authorized `feature/whisper-api-processing`, superseding the historical stop-after-storage instruction. No named owner approval is inferred. The local pipeline supplied implementation and independent staged review; the coordinator handles authorized publication. Human review and merging remain with the team.

Implemented scope: automatic upload/transcription after new capture with first-use OpenAI disclosure, plus manual Analyze for cancelled/older recordings; PostgreSQL durable queue and 30-second Beat recovery; generation/token claims; packaged Silero CPU presence gate; hosted `whisper-1` only; private raw/usage records; persisted normalized transcript; authoritative-duration alignment and EN/KO timing/rate estimates; stage/Refresh/revision-aware Retry/uncertain-charge confirmation; API-scoped SQLite cache; plain real transcript and retained local replay. The upload endpoint remains storage-only; the mobile result screen coordinates initial processing. Feedback stays disabled regardless of configured credentials. Full synchronized review UI, themes, auth, deployment and new detectors are excluded.

Read [api-contract.md](api-contract.md) before changing the pipeline. Additive migration preserves existing results/media and does not queue legacy rows. A request marked submitted without a durable outcome cannot be automatically called again. Raw/transcript resume avoids provider work. The prototype `33907d3` supplied only the no-speech presence policy and metrics approach; its local Whisper inference, automatic retries and duration extension were not incorporated.

Coordinator repair: no-speech now follows shared alignment/metrics with a saved empty transcript, empty-word visits (including repeated/backward/zero-duration visits), unchanged recording duration and zero provider requests. Torch/Torchaudio are pinned to 2.10.0; the regenerated lock preserves all other pins. Two residual advisories and the packaged ONNX source-path assessment are recorded in [whisper-transcription.md](whisper-transcription.md#packaged-gate-dependency-assessment-2026-10-08). Final coordinator verification repeated affected checks against the repaired source; detailed evidence and remaining human/device boundaries are linked below.

Verification separates mocked/SQLite checks, real infrastructure, synthetic hosted speech, emulator behavior and human review. The final outcomes and outstanding checks follow.

Base-stage handoff: independent staged review passed. Mobile checks (115 tests), Android export, backend checks (74 tests; five skips on SQLite, all 74 passing on PostgreSQL), populated/interrupted upgrades, real worker crash recovery and Linux packaged VAD passed. A controlled hosted English TTS pilot produced 41 timestamped words and slide visits 3 → 4 → 3; completed retries reused its saved result. Android emulator checks covered consent, Analyze, silence metadata, restart/offline cache and local replay. Physical-phone/human-speech and Korean VAD evaluation, native API-switch/background stress checks and human code review remained pending. See [AI-use evidence](ai-use.md#2026-10-08--hosted-processing-coordinator-verification-and-publication). That stage was stacked on `feature/recording-storage-upload`. The later explicit rehearsal-review authorization supersedes its historical stop instruction.

## Historical rehearsal-review handoff (2026-10-08)

The authorized `feature/rehearsal-review` patch builds on Whisper PR #19, `c7733d8288833b010948d2c5737929088547aa1e`. One writer continued the existing patch. The coordinator owns staging, independent review and eventual publication as one stacked PR; no writer commit/push/merge or named owner's approval is claimed.

Implemented: API-scoped cached-first per-presentation history; UUID server-only review records distinct from captures; validated audio/PDF recovery into separate durable media records; native-position PDF/transcript/visit synchronization; serial latest-target seeks with pause during seek; saved timing and explicit EN/KO total-rehearsal rates. Existing native dependencies, visual style, recovery/upload retry, Analyze/disclosure/Refresh/revision retry and uncertain-charge confirmation remain. Review operations never analyze. Contract and failure policies are in [api-contract.md](api-contract.md#mobile-rehearsal-review).

Prototype `33907d3` was inspected read-only: `PlaybackSlide.tsx`, `PlaybackTranscript.tsx`, `playback.ts`, `transcriptLayout.ts` and `ResultsScreen.tsx`. Reuse is limited to native PDF presentation, chronological visit lookup and verbatim transcript span/highlight/seek concepts, adapted to current capture, analysis and SQLite foundations. Prototype theme, Feedback/Playback tabs, feedback providers, local transcription and layout-follow scrolling were not incorporated. No backend/provider/schema/dependency changes are part of this stage.

Continuation repair: installed Expo 57 recreates the native player on source change while `useAudioPlayerStatus`/`useEvent` retains the old snapshot until an event. A regression fixture reproduced disabled Play after first download. Review now subscribes/reads status per player identity, retains a validated source/position on return, and reasserts pause on foreground; delayed old-player callbacks cannot clear good media. Strict result validation was extracted unchanged to break `client.ts → reviewValidation.ts → client.ts`.

Round-1 review reproduced three issues, now repaired: seek controls disabled during Android buffering, shared PDF validation cancelled by its first consumer's unmount, and absolute-path original audio blocked from recovery. Seek readiness now tracks initial load per player; native validation transfers to a remaining consumer over the same downloaded file; recovery saves the canonical original URI. Tests reproduced all three failures before the fixes and cover replacement/error/lifecycle callbacks, shared-download validation failure and recovery followed by upload.

Round-2 review reproduced three further issues, now repaired: an older seek's EOF cleared newer playing intent, detached PDF errors cleared validated replacement media, and failed deck metadata had no explicit retry. EOF now passes through the seek controller with a fresh native-position check; media errors are fenced by source and focus session; Refresh retries cancellable deck and attempt GETs. Synthetic regressions failed before these fixes and now pass, including normal EOF/replay/Pause, background/navigation callbacks and stale/API-switched deck refreshes.

Round-3 review reproduced three issues, now repaired: offline upgrades without an additive review cache hid saved analysis; incomplete refreshes rendered unreconciled snapshots; ordinary native pauses retained playing intent. Review now derives from the existing API-scoped analysis cache, renders storage's reconciled result and preserves validated in-memory content on cache failure. Native pauses clear intent outside seek/buffering transitions, with fresh native status and separate EOF handling. Twelve new regressions include nine failing-before/passing-after cases plus late refresh rejection after background/navigation/API changes.

Final verification: independent staged review passed after the documented repair rounds. Mobile TypeScript/lint, **209 tests** and Android export passed. Final application/test bytes match the reviewed snapshot; coordinator-only documentation records publication evidence. Backend source/dependencies are unchanged, with system/migration checks, 74 PostgreSQL tests and API restart/media retrieval verified separately. Android emulator checks covered real PDF/transcript/audio review, server-only audio/PDF recovery, offline restart, word/visit seeks, pause/foreground behavior and EOF/replay. No new provider request occurred.

Physical-phone/audible synchronization, native audio-focus fault injection, API-switch and exhaustive callback/download-cancellation stress remain pending; automated regressions cover their modeled cases. Human review remains pending. See [final evidence](ai-use.md#2026-10-08--rehearsal-review-final-verification-and-publication). Publish one PR against `feature/whisper-api-processing`; do not merge. The proposed next implementation is `feature/ai-feedback`, and it requires user confirmation after this handoff.


## Historical AI feedback checkpoint-2 handoff (2026-10-08)

The user authorized continuation after checkpoint 1 at reviewed/tested local
`f07e55395d2e38eabec7c39ea766f643b2e5c7c1`, on `feature/ai-feedback` stacked on open
PR #20 (`1305917`). That authorization is not a claim of human code review or a
named owner's approval. One eventual PR covers the five-checkpoint plan.

This patch adds durable saved-deck descriptions only: deck-only immutable source
preparation; provider/project/model/prompt/schema-scoped cache; explicit GET,
generate and revision-checked PATCH; additive description/job/request/quota models;
claim/revision fencing; private receipt-first persistence and recovery; required
provider-specific application reservation settings. Existing Beat recovers both
queues. No upload/transcription-triggered description calls, rehearsal coaching,
new AttemptResult state, mobile code/UI/disclosure, auth or provider evaluation.
Whisper request uniqueness and original PDF/audio/transcript/results are retained;
existing app processing still uses `feedback_state=disabled`.

Checkpoint-2 review repairs preserve same-receipt recovery when completion writes
or commits fail, and finalize private receipt evidence after retry or PATCH
supersedes a job and the worker stops, including late receipts for jobs already
marked `needs_confirmation`. Receipt-only claims fence duplicate/expired workers;
newer jobs and generated/edited descriptions and revisions remain intact.
Synthetic regression results are in AI-use; real PostgreSQL and worker-restart
validation remains pending.

Read [AI feedback](ai-feedback.md) for source/prototype attribution, quota policy,
checkpoint ledger and the precise fake-worker validation recipe; read the separate
[description API contract](api-contract.md#durable-slide-descriptions-checkpoint-2)
before implementing part-4 consumers. Prototype `33907d3` was read-only evidence
for deck cache/revision, private usage and Pacific reset ideas. Its countTokens,
free-tier assumptions, automatic orchestration and cross-scope edit reuse were
not imported.

Writer checks and limitations are in [AI-use](ai-use.md). The runner owns staging,
mandatory checks and independent review; the coordinator owns real PostgreSQL/
Redis/Celery/process-restart validation using synthetic media and an external
temporary fake-provider seam, without live API calls. Human inspection remains
pending. Transfer reviewed work only. The later checkpoint-3 authorization below supersedes this section’s original confirmation gate. The writer performs no Git mutations, dependency installation, service changes,
commit/push/PR/merge or edits to the original prototype/pipeline worktree.


Checkpoint-2 coordinator verification completed: independent staged review passed,
Django system/migration checks passed, and all 172 tests passed on real
PostgreSQL (12 database-specific tests skip under SQLite). Real Redis/Celery/Beat
checks used only synthetic responses and confirmed duplicate prevention, three
worker termination points, late-receipt recovery, edit fencing, disabled/project
change rejection, and broker-outage redispatch. API/database restart retained
description/history results and all five synthetic PDF/audio/image hashes.
Provider-request counts were unchanged by reads. See the
[coordinator record](ai-use.md#2026-10-08--ai-feedback-checkpoint-2-coordinator-handoff).
Checkpoint 2 is staged on `feature/ai-feedback` for human inspection; no checkpoint-2
commit, push, PR or merge had been performed at that checkpoint-2 handoff. Its original stop-before-part-3 gate is superseded by the current authorization below.


## AI feedback checkpoint 3 — historical bounded handoff (2026-10-08)

The user authorized all remaining checkpoints with checks between them, on one
`feature/ai-feedback` PR. This writer starts from supplied base `ce16ae1` and
implements checkpoint 3 only. Coordinator continuation to checkpoint-4 UI and
checkpoint-5 controlled evaluation is authorized; another checkpoint-3 permission
stop is unnecessary. No named owner approval or human review is inferred. The
historical automatic-feedback task in the original division document is superseded
by explicit generation: upload, Analyze, GET/history and replay never generate it.

New `FeedbackAnalysis`/revisioned `FeedbackJob` records are independent of Whisper.
The additive request-owner constraint permits exactly one description or coaching
owner with the corresponding stage. No old attempt/media/description/request is
rewritten or auto-enqueued. Both stages share the original quota bucket. Captured
selection and original-index transcript evidence persist across retries; description
edits fence submission/completion and leave prior suggestions visibly stale.

Read the [coaching contract](api-contract.md#durable-rehearsal-coaching-checkpoint-3)
for explicit admission, dependency retry versus coaching retry, uncertainty,
retained results and safe evidence context. Mobile additions are types, parsers,
API clients and cache validation/reconciliation only. Malformed feedback cannot
hide an otherwise valid recording. No feedback UI/disclosure/editing flow is added.
Prototype `33907d3` supplied bounded-card/cache/usage-ledger ideas read-only;
substring word matching, automatic orchestration and cross-scope reuse were not
incorporated. Sources and generated advice remain untrusted data.

Actual commands/outcomes and limitations are in [AI-use](ai-use.md). The runner
stages and independently reviews; the coordinator runs PostgreSQL/Redis/Celery
and API restart/crash checks with synthetic inputs/fake providers. Human inspection,
Android device regression, checkpoint-4 interaction and checkpoint-5 live quality
remain pending. The writer makes no Git mutations/publication, dependency install,
real provider call, credential/private-media read or other-worktree edit.

Checkpoint-3 review repair: description state/receipt transitions now advance
dependency freshness without changing the feedback generation. Mobile caches
retain the newest retry/confirmation action across delayed responses, including
late-receipt recovery and explicit dependency retry. NUL-source regressions inject
malformed inputs at the read/preflight boundary because PostgreSQL rejects NUL
fixtures before validation. Current description documentation now covers dependent
coaching staleness and existing mobile clients. Repair checks and remaining
coordinator/human verification are recorded in [AI-use](ai-use.md).

The subsequent bounded receipt/admission repair preserves uncertainty acknowledgement
after an edit between receipt persistence and normalization. Saved 408/5xx and
incomplete 200 receipts use the adapter's transport classification; complete 200
and known rejections keep their existing handling. Raw/usage recovery remains tied
to the original generation, with no automatic call. The runner must independently
review the final repaired snapshot; see the new red/green evidence in [AI-use](ai-use.md).

Current coaching receipt/finalization timestamps now contribute to feedback
freshness even after a description edit leaves the job stale. Reversed refresh
delivery cannot restore obsolete confirmation in either mobile cache. Older
generations' receipts leave the newer public snapshot unchanged. Backend tests
cover live/expired claims and read-only feedback/attempt/history consistency;
the runner/coordinator must verify this repaired snapshot before continuation.


## AI feedback checkpoint 4 — verified handoff (2026-10-08)

The writer started from committed checkpoint-3 base `e31937b7df2120a39a3e8edc303b9e120f21a368`
and implemented only the approved feedback review/disclosure checkpoint. The runner
owns staging/checks/independent review; coordinator transfer, commits and eventual
single-PR publication remain outside this writer. No named owner approval is inferred.

The existing saved screen now has explicit feedback generation/retry, scoped
provider consent, separate uncertainty acknowledgement, progress/recovery, cached
partial results, up to three evidence-linked cards and complete-set description
editing. The existing player/transcript/PDF/Analyze/Whisper/upload controls remain.
Evidence uses the original player controller; stale/unsupported actions are disabled.
Edits retain source identities and captured revisions, preserve conflicted drafts,
and visibly invalidate feedback without generating or retranscribing. Backend
`expected_selection` compares nonsecret effective provider/project/model/prompt/schema
identity before admission, returning 409 on disclosure races. Saved retries keep
their original selection. Captured set-origin metadata uses the existing snapshot;
there is no migration, dependency or native configuration change.

Cross-component files: backend feedback configuration/admission/views, mobile
feedback contracts/validation/storage/hook/panel, the saved-screen integration and
an optional accessibility expansion state on the shared Action button. See the
[contract](api-contract.md#generation-selection-assertion-and-mobile-feedback-review-checkpoint-4)
and [checkpoint-4 notes](ai-feedback.md#checkpoint-4-review-and-disclosure).
Checkpoint-3 prototype attribution is retained; this writer did not read or change
the prototype or any other worktree. New UI/admission-guard material is generated
against the current source, reusing its validated clients and player harness.

Review repairs: failed deck metadata no longer hides validated fresh/cached
descriptions or their editor; unknown-page evidence playback remains disabled.
Reload descriptions resumes active-job polling after releasing its lock on success
or failure, retaining focus/foreground cancellation. Four synthetic renderer
regressions failed before the two focused fixes and passed afterward.

Writer checks after repair passed: 270 mobile tests, TypeScript/lint, Android JavaScript export;
Django system/migration checks and 229 SQLite tests with 18 PostgreSQL-only skips.
See [exact repair evidence](ai-use.md#2026-10-08--ai-feedback-checkpoint-4-review-repair).
Subsequent independent review and coordinator verification passed at `64ec596`:
229/229 real PostgreSQL tests and agent-operated Android emulator disclosure,
edit/stale/regenerate, offline restart and evidence-seek flows against the real
API/PostgreSQL/Redis/Celery/Beat stack with synthetic providers. The reviewed patch
was `64399166b696522607fc588d0cd1fcd7a524ca2196992da488cce12920043bf9`;
backend bytes matched the PostgreSQL-tested snapshot. See the
[coordinator record](ai-use.md#2026-10-08--checkpoint-4-coordinator-verification).
TalkBack, extended text/keyboard layout, physical-phone audible synchronization and
human inspection remain pending. No live generation occurred in those emulator
checks. Their results do not verify the new checkpoint-5 backend repair below.

## AI feedback checkpoint 5 — controlled evaluation and publication (2026-10-08)

All five checkpoints are implemented on `feature/ai-feedback`, for one PR stacked on `feature/rehearsal-review` while unmerged. No merge is authorized. Feedback defaults to disabled; backend configuration selects exactly one provider/model for descriptions and coaching. Defaults remain `gemini-3.1-flash-lite` and `gpt-6-luna`, with no fallback or automatic retry.

Live Gemini testing exposed a schema-complexity rejection. New descriptions use `description-gemini-v3`, removing wire array bounds while local validation retains every slide/fact bound. Saved v1/v2 contracts and all coaching/OpenAI payload identities remain reconstructable. Both failed Gemini scopes and diagnostic history were preserved. See [schema details](ai-feedback.md#checkpoint-5-gemini-schema-compatibility).

Verification passed: 247 SQLite tests (18 PostgreSQL-only skips), 247/247 real PostgreSQL tests, Django system/migration checks and independent staged review. Real-worker v2/v3 tests killed the worker after a saved response, aged the claim, restarted with generation disabled, and recovered without a second synthetic provider call. Mobile remains the independently reviewed checkpoint-4 snapshot: 270 tests, TypeScript/lint, Android export and synthetic-provider emulator disclosure/edit/stale/regenerate/offline/evidence-seek checks.

Controlled full runs used identical saved pilot/adversarial inputs. OpenAI returned 1 baseline and 3 adversarial accepted cards. Gemini returned 2 baseline cards and a partial adversarial result (1 accepted, 1 discarded for a speech-quote mismatch). Each successful scope made four description/coaching calls. Refreshes, duplicate tasks and API/worker/Beat restart reused results, preserving media/source hashes, processing revision 1 and one existing Whisper record; no new transcription occurred. All seven accepted cards passed the real mobile parser/seek gate. [The evaluation](feedback-evaluation.md) records versions, token usage, earlier failures and diagnostic call accounting.

Agent assessment found useful 50%/20% discrepancy feedback, but also generic advice, a possible slide-number false positive, a weak OpenAI chart claim and a Gemini description overstatement. Human usefulness, Korean quality, physical-phone listening/synchronization, TalkBack and extended keyboard/long-text usability remain pending. This small English fixture does not prove prompt-injection immunity or a provider quality ranking. Existing dependency advisories and legacy callers' omitted-selection-assertion limitation remain documented.

Reviewed/tested application bytes were transferred exactly; coordinator documentation records the separate live and emulator evidence. Prototype and unrelated worktrees remain preserved. Human review is pending. Publication uses only `feature/ai-feedback`; the proposed next implementation is UI polish (`feature/practice-ui`) and requires user confirmation. Feedback/Playback tabs, themes, comparison, deletion, authentication and public deployment remain outside this feature.
