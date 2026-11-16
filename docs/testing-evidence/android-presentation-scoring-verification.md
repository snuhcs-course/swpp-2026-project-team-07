# Android presentation scoring integration — October 17, 2026

> Historical feature evidence. The current retained-feature integration and cleanup are recorded in [retained-feature verification](retained-features-verification.md). Earlier deployment/test statements below belong to their original checkpoints.


## Automatic scoring follow-up — October 17, 2026

The current follow-up supersedes the explicit Grade/Update controls and expandable rubric display described in the earlier integration record below. It preserves the existing scorer, exact source/evidence validation, Step 1 compact context, singleton feedback and original index. All source remains uncommitted.

- **Workflow:** one app-level host reuses the existing scoring controller/cache/jobs. New selected recordings become eligible through the recording hand-off; opening a saved presentation enables only its selected sources. Pending comparisons, sources with no exact selected slide interval, missing transcripts, unsynchronized settings/corrections and background state cannot admit a score. First scoring starts automatically; confirmed synchronized changes debounce for one second.
- **Recovery:** durable input markers precede POST, with shared cross-screen locks. Same-input failed/rejected requests never auto-retry. Unresolved submissions poll through GET after foreground/restart, including the independently reproduced race where foreground reads absent before the old POST is accepted. Failure and uncertain-charge recovery remain explicit.
- **Backend:** the saved overall failure reproduced without transport: six slide scores validated, while delivery cited measurements/requirements without supporting speech. Versioned prompt v2.1 now states that requirement explicitly. Strict validation is unchanged. Completed invalid totals permit revision/cooldown/uncertainty-fenced Retry. Exact recognized previous v2 protocol permits a fresh generation without reinterpreting old receipts; canonical fingerprints handle PostgreSQL JSONB ordering.
- **Display:** direct summaries, strengths, weaknesses, improvements and playable summary/advice evidence; no rubric cards, weights, anchors, Grade/Update or explanation toggle. Home/Full Review/slide rings and navigation tiles use backend levels: Beginning red, Emerging amber, Competent green, Advanced blue. Empty/stale/loading states are neutral and ring messages are short. Rejected totals preserve valid slide scores with explicit Retry.
- **Home:** the same verified selected-run overall score as Full Review, total current verified findings once, recording duration and WPM. Mixed/incomplete selections never borrow an old recording's total.

Automated verification: `npm run check` passes all **555 mobile tests**, typecheck and lint (one existing `useSegmentPlayer.ts:108` warning), using Node v26.8.2 (compatible with the package minimum; README recommends Node 24). Full backend suites pass **615 on SQLite** (24 expected PostgreSQL-only skips) and **615 on PostgreSQL** (no skips); Django system and migration checks pass. Android export passes. Independent review reproduced and verified the foreground/admission race repair, tested exact previous-protocol acceptance versus altered-protocol rejection, and found no remaining actionable issues in the reviewed scope. Final foreground-state lint repair received a further review. The physical synthetic preview also exposed a transient in-flight uncertainty notice. A held-POST regression reproduced it; the narrow repair displays shared progress across readers and defers local-marker uncertainty until submission settles. Four further independent lifecycle regressions and 54 adjacent tests pass. Physical rendering and installation evidence follows below.

Task artifacts, before-source copies, exact staging snapshot, red/green logs and independent review evidence: `/private/tmp/outloud-automatic-scoring-20261017/`. No agent-triggered paid inference, commit, push, merge or cleanup. The clearly labeled synthetic preview has no Android Internet permission and cannot use the real backend. The authorized local-phone rollout is recorded separately below.

## Physical automatic-scoring preview and local delivery — October 17, 2026

A separate `com.team07.outloud.scoringpreview` release runs the real screens, automatic host, controller, cache, validators and playback with clearly labeled synthetic data. It has **no Android Internet permission**. On the physical Galaxy S23 Ultra (`SM-S918N`), agent-operated checks verified Home/Full Review/slide colors in both themes, neutral unavailable/loading states, direct summary/strength/weakness/improvement content, saved slide scores after overall rejection, explicit failure/rejected-result Retry and original-evidence playback. Silent fixture audio proves the playback path; audible speech quality remains untested. Home shows the same 67/100 Competent result, two current verified findings and 0:02 duration; WPM remains unavailable under the existing five-second minimum. The temporary preview controls and fixtures are outside the repository and excluded from the main app.

The initial automatic request was admitted once; repeated navigation retained one mocked POST. One synchronized update and two explicit failure/rejection retries produced four mocked POSTs in total. The automated held-POST regression and final physical capture pass: ring and panel show Scoring… with no uncertainty/Retry, and repeated Home/slide/Full navigation retains exactly one mocked POST in the separate final retest. There are 37 saved PNG files across the original matrix and final retest (including one duplicate alias). Screenshots, request logs, APK hashes and source/permission proofs are under `/private/tmp/outloud-automatic-scoring-20261017/android-preview/`.

Both native builds use isolated temporary copies. A full-source check rejected an initial normal APK containing a cross-project preview router context before installation. Rebuilding with isolated Metro temporary storage, explicit project/router roots and forced no-cache JS generation restored exact production source. The respective contributions of shared cache and daemon environment were not separately isolated. The final main APK has all 112 embedded application sources matching the reviewed worktree, no preview code, and identical generated/packaged Hermes bytes. Its original package, recording permission, signing certificate and USB API endpoint are verified.

The verified main `com.team07.outloud` APK was updated in place using `adb install -r`, without opening it or clearing data. Its installed SHA256 is `860dd83b1a3f6dac56a144f9904b2c2c50e3e62e43666a245243b8d03d2b8079`; signature matches the previous build, first-install identity remains October 6, and last-update time is October 17 at 04:46:21 on the phone. The parallel AI Feedback package and USB forwards are unchanged. The main process remains stopped. The optional Play Protect upload was declined without changing security settings. This proves installation and packaged source; final real-provider interaction is left to the user.

Only the existing idle scoring-phone API, worker and scheduler were gracefully reloaded. Health/readiness return 200 and the worker responds. Frozen job/source/result and saved receipt hashes are unchanged; feedback request count remains 106 and transcription request count remains 10. Other local workers and databases were left running. This reload and all automated/physical synthetic verification made no provider inference requests. The user previously authorized real AI for manual phone use; real-provider scoring after opening the main app remains a separate human test. Unsupported evidence still withholds the affected score.

## Earlier integration record (explicit workflow)

Implemented the authorized Phase A workflow and Phase B UI integration in the
existing `codex/presentation-score` worktree at `234c0e1`. Existing v2 scoring,
zero-duration validation, Step 1 compact context, singleton feedback, navigation,
reliability work and original staging are preserved. No backend or scoring parser
change was needed. This is an uncommitted local implementation with mocked evidence;
it is not a deployed service or physical-device acceptance result.

## Phase A — explicit grading workflow

`usePresentationScore.ts` reuses the score reader, strict response validator,
persistent cache, submission locks, correction client and requirements stores.
Opening, focusing, restoring, reconnecting and polling use GET only. Explicit
Grade/Update/Retry uses the existing scoring POST and selected provider token,
transcript revision, generation and uncertainty acknowledgement. Shared profile
failure recovery uses its existing endpoint; it never requests singleton feedback.

- Refresh and synchronize corrections before explicit admission, then recheck the
  original recording/transcript, current settings, selection and server job.
- Preserve captured old job revisions when recognizing staleness, while submitting
  current corrections and explicit feedback generation for an Update.
- Keep one cross-instance submission lock per scoring identity, with a durable
  uncertain-submission marker written before transport. Ambiguous outcomes do not
  automatically retry; acknowledgement is bound to the latest source, corrections,
  settings and job snapshot. Confirmation/cancellation cannot cross sources.
- Poll active jobs and reconnect after read failure; pause work while inactive or
  backgrounded, restore saved assessments, and fence late responses.

`selectedPresentationScores.ts` and `useRunPresentationScores.ts` project only
validated exact original source selections. Per-slide scores may come from
separate recordings. Overall scoring requires the existing complete-single-attempt
check, including all original positive-duration visits and the approved
not-applicable exception. Composite, partial, altered-source, silent or untimed
selections do not inherit an invented total. Correction/settings changes suppress
numbers without deleting saved assessments. Overview reads are bounded/deduplicated
by the existing cache reader; the selected controller owns its own polling path.

## Phase B — existing layouts and evidence

Full Review and Review retain their layout, timing, fillers, WPM, audio, transcript,
corrections, thumbnails and navigation. Their rings now show current performance
points from 0–100, including a valid zero. Full Review's existing slide tiles show
scores for each selected original source. Finding counts remain explicitly labeled
as findings, separate from performance. Pending, failed, stale, ungraded,
insufficient, unavailable and composite states show no fabricated number.

A shared panel provides explicit Grade/Update/Retry, Refresh and uncertain-retry
controls. A current completed assessment hides the no-op Update action. Expandable
sections show criterion levels, exact approved anchors, justifications, limitations,
supported deduction consequences, strengths, weaknesses and actionable improvements.
All 28 displayed anchor descriptions match the frozen backend v2 rubric exactly.
Visible text frames these as provisional rubric points, not calibrated grades.

Evidence actions are bound to the current validated result and original recording.
They reuse existing audio/navigation controls, support multiple chronological cited
intervals, slide-fact navigation, speech/measurement/full-recording evidence and
missing-audio recovery. Empty intervals are preserved as evidence but do not create
playback ranges. No selected recording is replaced by another source for playback.
Staleness/source changes invalidate old evidence controls and stop score-evidence
playback; ordinary run playback retains its existing behavior. ReviewSlidePlayback
only widens its prop to the already existing structural ReviewEvidence type.

No score indicator admits additional slide-feedback inference. Home and Compare
remain outside this task's named Full Review/slide layout scope.

## Tests and independent review

| Check | Actual result |
| --- | --- |
| Mounted explicit grading controller | 25 new cases pass |
| Exact-source projection | 8 new cases pass |
| Real panel/controller/API/validator/cache mocked end-to-end | 4 new workflows pass |
| Actual review screens and evidence with native boundaries mocked | 13 new cases pass |
| Focused scoring contract/workflow/projection/integration/UI/overview command | 80/80 pass |
| Full `npm run check` | 533/533 tests; typecheck passes; lint 0 errors, one pre-existing `useSegmentPlayer.ts:108` cleanup-ref warning |
| Android JavaScript/Hermes export with cleared cache | Pass; no APK/device claim |
| Rubric display comparison | All 28 anchors equal frozen backend v2 text |
| Independent AI review | No remaining actionable findings; 37 controller/projection/integration tests plus final 17 UI/integration tests passed independently (4 overlap) |
| Additional independent composed-run exploration | GET polling restored 67/100, no overall score, polling stopped, zero POSTs |

Commands from `mobile/`:

```sh
node --test tests/presentation-score.test.mjs tests/presentation-score-workflow.test.mjs tests/presentation-score-projection.test.mjs tests/presentation-score-integration.test.mjs tests/presentation-score-ui.test.mjs tests/ai-overview-screens.test.mjs
npm run check
EXPO_ROUTER_APP_ROOT=/Users/seoyeonpark/.codex/worktrees/presentation-score/OnLoud/mobile/src/app npm run bundle:android -- --clear
```

The new tests cover first Grade, queued-to-completed polling, validated 0/67/100
rendering, explicit failure retry/cooldown, repeated taps/multiple mounted owners,
persisted uncertain outcomes/confirmation, profile dependency recovery, source and
context switching, background/focus/restoration, settings/corrections and stale
scores, offline reopening, malformed responses, simultaneous zero-duration and
repeated/backward visits, exact source selection, and evidence playback/navigation.

Red/green failures exposed frozen-revision Update handling, acknowledgement/source
fences and stale evidence playback before repairs. The full gate also caught a
React Compiler callback-dependency lint issue; adding the stable state setters
matches the existing overview convention. Independent repair review reran 17
integration/UI cases and found no new issue. The final full checks run against the
reviewed source; no rule was suppressed. Independent review is AI review; human
inspection remains pending.

## Preservation and review artifacts

No Git staging, commit, merge, push, branch/worktree cleanup, dependency installation,
provider dispatch or paid call occurred. Backend files, the scoring parser/cache,
Step 1 and singleton runtime source remain byte-identical to the pre-task snapshot.
The original staged binary patch is byte-identical with SHA-256
`d620f261d498820ec0a29683f6ed146951c16d04a8c35648cf4a615b2b3e4ccc`.

`/tmp/outloud-scoring-android-ui-20261017/` contains the original source/index/hash
snapshot, final logs, manifest and three separate task-only patches:
`phase-a-workflow.patch`, `phase-b-ui.patch`, `documentation.patch`.
They apply to the dirty pre-task source snapshot, not committed HEAD, and exclude
unrelated unfinished code. Patch round-trip and protected-file hashes are verified
in `manifest-final.json`.

## Remaining limits

There is no known automated-check or independent-review blocker in this scoped
implementation. At the original JavaScript-only handoff, physical Android scoring
interaction, accessibility/layout across devices, APK verification and live-provider
format compatibility/usefulness remained unverified. The physical installation
follow-up below now verifies APK assembly, launch and two review-screen renders;
end-to-end grading, broad accessibility/layout and live-provider quality remain unverified. The export and native mocks do not establish those behaviors. No paid
model run, experiment ledger write or budget change was made. Human diff inspection
and any subsequent commit/deployment are separate from this report.


## Physical-phone installation follow-up — October 17, 2026

The user requested, “upload to physical phone”. Codex copied the current dirty
scoring mobile source into `/private/tmp/outloud-scoring-phone-20261017/mobile` and
ran Expo Android prebuild there, leaving repository source/configuration untouched.
JDK 17 / Android SDK 36 built a standalone arm64 release APK with
`./gradlew app:assembleRelease -x lint -x test --build-cache -PreactNativeArchitectures=arm64-v8a --max-workers=4`.
The build passed in 4m10s. All 110 embedded application source-map files match the
copied source exactly, including the scoring controller, panel and Full Review.

Same-signature `adb install -r` updated `com.team07.outloud` on a Galaxy S23 Ultra
(SM-S918N), without uninstalling or clearing data. Existing saved presentations
remained visible; the separate `com.team07.outloud.aifeedback` app remains installed.
Play Protect offered to upload the unknown local APK for scanning; “Don't send”
was selected without changing the phone's security settings. Phone-installed APK
SHA-256 equals the built artifact:
`80e9a2d891ef03411e268f33ad6481270a875d9a2c528dcb990ad50c0195412a`.

Agent-operated physical checks: cold launch returned `Status: ok`; the app remained
running with no captured React Native/Android fatal errors. Screenshots verified
Home, the slide score indicator and Full Review's overall score panel/navigation
tiles. The saved composite run correctly showed “Combined recordings” with no
invented total. No Grade or transcription control was pressed; no live inference
or microphone test occurred. Screenshots remain private local artifacts because
they contain saved presentation content. UIAutomator's idle dump failed on an
animated review screen, so screenshots were used for visual verification.

The standalone build needs no Metro process. Its API is
`http://127.0.0.1:8000/api`, with USB port forwarding configured. Port 8000 was not
listening at verification, so live transcription/grading was unavailable. No
backend, worker or provider was started. Original mobile source and staging remain
byte-identical; only these installation records were appended. No commit/push.
Build/APK/install/source-hash evidence is in
`/private/tmp/outloud-scoring-phone-20261017/installation-manifest.json`.


## Physical phone backend enabled — October 17, 2026

The user requested the full flow and explicitly authorized real AI for manual phone testing. The scoring API, Celery worker, and recovery scheduler now run from this worktree using a cloned PostgreSQL phone database (`scoring_phone_20261017`), copied media, and a separate Redis database/queue. Six decks, fourteen attempts, and fifty-four media files were preserved in the copy. Only the existing additive `0010_slide_review_membership` compatibility migration was needed on the clone; the previous backend database/media and worker were left untouched. Temporary process configuration reads the existing keys without copying them into the repository or changing `.env`. It reuses the existing OpenAI model/project and application quota settings.

Live checks: Django system check passed; API health and readiness returned HTTP 200; PostgreSQL and Redis were reachable; the worker replied to targeted Celery ping; packaged Silero and audio decoding dependencies loaded successfully. The physical app made four successful read-only API requests after USB forwarding was restored. Both current port 8000 and historical saved-media port 58000 reach this API. No grading/transcription action was performed by the agent, and no POST request occurred during setup. Live inference quality and the complete paid grading flow remain for the user's manual test. Keep the phone connected by USB and the Mac awake. Analyze a complete original recording before using Grade presentation; combined or incomplete selections cannot supply an overall score.

Runtime files, private database/media copy, logs, PIDs, and readiness evidence are under `/private/tmp/outloud-scoring-phone-20261017/backend-runtime/`. Product source and the original staged snapshot were unchanged. No commit, push, merge, or worktree cleanup was performed.
