# Mobile Coverage Test Specifications

**Status:** Proposed cases; implementation and execution pending.

Use these cases to test the mobile files recorded at 0% line coverage on October 22, 2026. The application baseline is merged PR #31, `c4a3f48`; [PR #33](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/33) adds the coverage setup at `f0d7148`. The [measurement record](testing-evidence/coverage-2026-10-22.json) preserves scope, counts and tooling hashes. The [PR CI mobile log](https://github.com/snuhcs-course/swpp-2026-project-team-07/actions/runs/39719152101/job/119628338510) confirms 548 passing tests and the same group shortfalls.

0% means that the measured suite recorded no covered lines in that file. Related helpers can already have tests. None of the cases below count as completed tests or acceptance evidence.

## Implementation order and responsibility

1. Implement feedback/media controller cases, PDF import and the Upload/Home screen cases. Start with cancellation, file retention and request duplication.
2. Add transcription, worker/host and navigation cases. Finish with shared controls and application entry points.
3. Rerun coverage after each group. Use the new report to choose the next missing behavior.

Follow the [testing plan](testing.md): Jooyoung maintains mobile logic/storage (`.ts` coverage group); Jaewon maintains screens/components (`.tsx` coverage group). Coordinate cases that cross the two groups. All four members perform manual phone testing and record their own results.

## Test method

Use the existing Node test runner, `node:assert/strict`, React test renderer and source-map loaders. Keep each test file under `mobile/tests/` with a `.test.mjs` suffix. Case IDs below can prefix test names; split parameterized inputs into named cases.

- Import the complete production module. Keep the behavior under assertion real. Replace native APIs, network responses and clocks with controlled fixtures; use real storage/domain code where the assertion concerns their integration. Do not copy production functions into tests or replace the controller under test with a mock.
- Mount hooks through a small React probe and drive updates with `act`. Reuse the pattern in [presentation-score-automatic.test.mjs](../mobile/tests/presentation-score-automatic.test.mjs) and the focus/AppState controls in [recording-screen-ui.mjs](../mobile/tests/helpers/recording-screen-ui.mjs). Adapt loaders for each boundary; existing loaders may replace the module these new cases need to execute.
- Reuse valid `feedbackState`, `descriptionState`, `absentFeedback` and `withFeedback` fixtures from [feedback-fixtures.mjs](../mobile/tests/helpers/feedback-fixtures.mjs). Use distinct attempt/deck IDs and API addresses when testing identity changes. Keep response bodies valid unless malformed input is the subject of the test.
- Control pending responses with deferred promises. Record request method, payload, signal and call count. Check state before completion, then resolve, reject or abort the operation and check the result.
- Use fake timers for polling, retry windows and animation completion. Reset mocks, timers, AppState, focus, storage fixtures and mounted trees after each case. Isolate module-level worker registries between test files or remove their entries during cleanup.
- Assert visible text/state, navigation arguments, saved records and request/file operations. Import-only checks and snapshots alone do not satisfy these cases.

These are regression specifications for current behavior unless a row identifies a requirement check. Use the [story matrix](story-test-matrix.md) and [known requirement differences](requirements-and-specifications.md#iteration-2-implementation-status) when evaluating acceptance. A failing requirement check may identify a defect; do not change its expected result to match the defect.

## First group: feedback, media, import and screens

### F. Feedback review

Source: [useFeedbackReview.ts](../mobile/src/features/feedback/useFeedbackReview.ts). Suggested file: `feedback-review-runtime.test.mjs`. Basis: cached feedback, disclosure and recovery in the [API contract](api-contract.md), plus the controller's revision and cancellation rules. This is the legacy take-level review controller; selected-slide automatic feedback has separate tests.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| F01 | Seed cached feedback/descriptions. Mount while focused; return newer feedback and descriptions from GET requests. | Show cached data, then the validated newer revision. Save accepted data. Opening/refreshing review sends no generation POST. |
| F02 | Let feedback GET succeed and descriptions GET fail. Repeat with a failed cache write after a successful GET. | Keep the usable feedback in memory and show the refresh/cache warning. Preserve the recording, transcript and prior cache where writes failed. |
| F03 | Begin a refresh or polling request. Blur, background, unmount or change the attempt/API identity before resolving it. | Abort the old operation and ignore its late response. Stop the old polling timer. Foreground/focus may refresh the current identity; it must not resubmit generation. |
| F04 | Request generation with no matching provider consent. Cancel the disclosure; repeat and continue with an unchanged selection. | Cancellation sends no generation POST. Continuing saves consent for that selection and submits only after fresh selection/revision checks. |
| F05 | Change the provider token, feedback revision or description-set ID during preflight. Also repeat a valid Generate action while its first request is pending. | Reject stale intent with a refresh notice. Concurrent actions produce at most one generation POST for the accepted intent. |
| F06 | Dispatch generation, then simulate a timeout. Refresh and remount; attempt generation again. Separately return a definite 4xx rejection. | Save the pending marker before POST. An uncertain outcome requires explicit acknowledgement before another submission. Reconciliation sends GETs, without an automatic second POST. A definite rejection clears the marker when storage permits and shows the matching recovery notice. |
| F07 | Supply a newer edited description revision or a correction change. Compare with unchanged and unrelated description sets. | Mark affected feedback stale. Preserve unrelated/current feedback. A description dependency needing recovery directs the user to description retry; description retry uses its own set ID and processing revision. |
| F08 | Edit descriptions: save a valid draft; try an invalid fact; change the server revision before Save; fail a submitted save; then Reload or Cancel. | Validate before mutation. A valid save clears the draft and marks affected feedback stale. Conflict/uncertainty retains the unsaved draft. Reload uses the current server revision; Cancel discards the local draft. Editing does not start paid regeneration. |

### M. Audio, PDF and metadata controllers

Sources: [useReviewMedia.ts](../mobile/src/features/transcription/useReviewMedia.ts), [useReviewPdf.ts](../mobile/src/features/transcription/useReviewPdf.ts), [useReviewDeck.ts](../mobile/src/features/transcription/useReviewDeck.ts), [useReviewPlayerStatus.ts](../mobile/src/features/transcription/useReviewPlayerStatus.ts). Suggested files: `review-media-hooks.test.mjs`, `review-metadata-hooks.test.mjs`, `review-player-status.test.mjs`.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| M01 | Mount with existing valid original audio/PDF files. Return to focus with the same source identities. | Validate and expose those files without downloading replacements. Retain an unchanged validated URI when returning to focus. |
| M02 | Supply a missing original, an invalid original and a valid cached candidate in order. Also test no usable candidate. | Try the next candidate after validation failure. Expose only a validated URI; otherwise show the unavailable/error state. Preserve original files. |
| M03 | Choose Download. Test success, network rejection and native validation rejection with a previous usable file present. | Publish the validated result on success. On failure, clear busy state, show the error and retain the previous usable file. Reuse the lower-level checks in [review-media.test.mjs](../mobile/tests/review-media.test.mjs). |
| M04 | Invoke Download twice before the first settles. Background/blur during download, then deliver a late completion or renderer-error callback from the old session. | Start one download for that hook session. Abort on lifecycle exit. Ignore callbacks that no longer own the active source/session. A new focus session can recover. |
| M05 | Keep audio loading while PDF metadata changes or PDF validation fails. Mount audio-only and PDF-only variants in separate cases. | PDF work does not cancel or reset the audio session. Audio-only review does not validate a PDF. PDF-only review does not start an audio validator. |
| M06 | Discover PDFs from imported files and saved attempts across two API addresses. Include duplicates; fail one catalog read; repeat discovery with unchanged candidates. | Return deduplicated candidates for the requested API/deck. A failed catalog does not hide candidates from the other catalog. Preserve the array identity for unchanged ordered candidates, including an empty result. |
| M07 | Refresh deck metadata with a matching cached deck, no deck ID, a page-count mismatch, a failed request and a late response after switching deck/API. | Fetch only for a present current ID. Reject mismatched page counts and late identities. Retain a valid cached deck with a stale notice on refresh failure. |
| M08 | Deliver playback events for the current player and an old player. Make an event's time older than `currentStatus`; provide event-only EOF/error fields. | Ignore the old player. Use current native position/playing/buffering values while retaining event-only error/EOF signals. Refresh reads current native state. |
| M09 | Load a player, report temporary buffering, replace it with an unloaded player, then unsubscribe. | Preserve readiness across buffering for the same player. Reset readiness for the replacement. Remove the old listener and ignore its late events. |

### V. Native validation adapters

Source: [nativeMediaValidation.tsx](../mobile/src/features/transcription/nativeMediaValidation.tsx). Suggested file: `native-media-validation.test.mjs`. Simulate native callbacks here; retain real Android decoder/PDF-renderer checks in the phone plan.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| V01 | Send loaded audio statuses with a matching duration, a difference of 1,000 ms, a difference of 1,001 ms, zero, a negative value and a non-finite value. | Accept a positive finite duration within the 1,000 ms tolerance. Reject the other durations. Release each validation player once. |
| V02 | Simulate decoder error, listener-start failure, an already-aborted signal, abort during loading and no load event for 15 seconds. Deliver a late success afterward. | Reject once with the corresponding error. Clear timeout/abort listener, remove the native listener and release the player. Late completion cannot change the outcome. |
| V03 | Validate PDFs with matching positive integer pages, mismatched/zero/fractional pages and renderer error. Test two simultaneous requests, abort, unmount and the 45-second timeout. | Settle each request by its own key. Accept only the expected positive integer page count. Reject cancelled/expired requests, remove pending renderers/listeners and ignore late callbacks. |

### I. PDF import orchestration

Source: [importer.ts](../mobile/src/features/presentations/importer.ts). Suggested file: `presentation-importer.test.mjs`. Keep the importer real; fake page rendering/filesystem/network boundaries. Basis: AC-01a–c and current offline import behavior. Existing [pdf-import.test.mjs](../mobile/tests/pdf-import.test.mjs) covers the lower-level PDF service.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| I01 | Cancel file selection; then select a three-page fixture and render its pages. | Cancellation returns null. Successful rendering copies pages into the app documents directory in order, preserves dimensions and removes disposable renderer copies. |
| I02 | Analyze a rendered deck with server text, empty server text and an unavailable server in separate cases. | Save the correct page count, parsed slides and timing targets. Text state is `ready`, `none` or `pending` as appropriate. Server failure still permits local import. Report staged progress through Ready. |
| I03 | Render a password-protected PDF, a damaged PDF and a zero-page PDF. | Reject with the matching usable error; save no presentation. Check cleanup through U03, where the caller owns the import. |
| I04 | Abort while page rendering or slide-text retrieval is pending, then resolve it. | Reject cancellation before saving a presentation or reporting Ready. An unavailable server must not swallow cancellation. |
| I05 | Cancel/discard an import. Make PDF removal reject because a saved rehearsal still references it; make page-directory removal fail in another case. | Cancel pending defaults and forget the imported presentation. Attempt owned-file cleanup without deleting protected rehearsal media. Cleanup failure does not escape as an unhandled rejection. |
| I06 | Run `ensurePages` and `ensureSlideText` for a legacy/pending deck. Change or remove that deck during the pending operation; test an offline text retry. | Apply results to the latest existing deck, preserve current attributes and derive matching slide/timing arrays. Do not resurrect a removed deck. A failed text retry leaves it pending. |

### U. Upload screen

Source: [UploadScreen.tsx](../mobile/src/screens/UploadScreen.tsx). Suggested file: `upload-screen-runtime.test.mjs`. Mount the real screen with shell/theme/animation fixtures. Keep importer integration in at least U02–U04. Basis: AC-01a–c and the saved presentation-setup flow.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| U01 | Cancel the picker; separately reject the picker before a PDF exists. | Return to file selection. Show the error for rejection. Start no analysis and create no presentation. |
| U02 | Select a valid PDF, deliver rendering/text progress and complete analysis. Finish presentation setup. | Show analysis progress, then the requirements editor. Navigate once to Rehearse with the imported deck ID and slide 0 after setup finishes. Reset Home's upload/setup state. |
| U03 | Reject analysis after the app has an imported PDF. Then choose a valid file again. | Show the failure, return to selection and discard the failed import. The next selection can complete; unrelated saved files remain intact. |
| U04 | Leave while analysis is pending, then deliver late progress/success/error callbacks. | Abort the current job, discard its import and return Home. Late completion cannot open setup or Rehearse. |
| U05 | Repeat selection while picking/analysis is active; repeat Finish setup before navigation settles. | Prevent duplicate active imports and repeated navigation. Exercise same-turn repeated actions as well as actions after a render; record any guard failure as a defect. |
| U06 | Drag Back below, at and above the screen's `BACK_T` threshold; also cancel the gesture and invoke Android Back. | A completed drag above the threshold exits. Other drags reset the screen's shared visual state. Android Back follows the leave path and aborts an active import. |
| U07 | Leave while the picker promise is unresolved, then return a selected PDF. | **Requirement check, AC-01c:** no analysis/navigation; discard any new app-owned copy. Inspect the late-picker branch during implementation and record a defect if it leaves that copy behind. |

### H. Home screen

Source: [HomeScreen.tsx](../mobile/src/screens/HomeScreen.tsx). Suggested file: `home-screen-runtime.test.mjs`. Use empty, one-deck and three-deck stores, with distinct titles and IDs. Drive accessibility actions and the registered gesture callbacks. Basis: presentation selection/history, current Hide/Undo behavior and access to Full Review.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| H01 | Mount an empty library; activate the empty-card add area and the Add accessibility action in separate cases. | Show the empty-library label/hints. Open Upload without dereferencing a missing deck. |
| H02 | Move forward/backward through three decks; tap a side card, then the front card; use accessibility Activate. | Select the expected wrapped deck. A side-card tap centers it; a front-card activation opens that deck's Rehearse screen at slide 0. |
| H03 | Open Full Review for a deck with a saved run. Repeat without a run, while the carousel moves and while an overlay covers Home. | Route to Full Review only for the current stable selection with a run. Set the return source to Home. |
| H04 | Hide one of several decks and choose Undo before 4,500 ms. Repeat without Undo. | Hide the selected card, keep the front index valid and show Undo. Undo restores the same deck and cancels finalization. Timeout finalizes the hidden deck. |
| H05 | Let Hide time out with saved rehearsals, without saved rehearsals, and with storage/removal errors. Try hiding the last visible deck. | Retain PDF files needed by saved rehearsals. Attempt removal of an unreferenced app PDF. Handle cleanup errors. Preserve the current last-deck guard. Full deletion under AC-11 remains an open requirement. |
| H06 | Open icon selection/About, use Android Back, and switch Home to upload/covered mode. | Back closes the active overlay. Covered Home exposes no interactive/accessibility targets. Reopen controls for the current deck after returning. |
| H07 | Perform horizontal drag, upward add, downward hold and cancelled hold. Remove a deck during a store update; enable reduced motion. | Horizontal movement does not trigger add/hide. Add/hide require their intended gesture conditions; cancel disarms the hold. Keep the displayed index in range after store changes. Stop decorative repeating motion under reduced motion. |

## Second group: transcription, hosts and shared UI

### A. Attempt-analysis controller

Source: [useAttemptAnalysis.ts](../mobile/src/features/transcription/useAttemptAnalysis.ts). Suggested file: `attempt-analysis-hook.test.mjs`. Use real result/review validation and controlled transport/cache fixtures. Basis: explicit process/retry payloads in the API contract and preserved local audio.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| A01 | Focus with cached analysis/review, with no uploaded attempt/cache, and with a failed refresh. | Show matching cached data. Skip remote refresh when neither upload nor API-scoped analysis is known. Keep prior results/audio after refresh failure. |
| A02 | Receive an older revision after a completed result, a wrong deck/duration, and a valid result whose cache write fails. | Keep the preferred valid revision. Reject identity/duration mismatches. Retain valid in-memory data and show the storage notice if persistence fails. |
| A03 | Poll a processing result at two-second intervals; complete it, fail a GET, blur/background, unmount or change identity. | Poll only while processing and active. Stop on completion/lifecycle exit, retain cached results on GET failure and ignore obsolete responses. |
| A04 | Analyze without consent. Cancel; then continue a fresh disclosure. Make consent persistence fail in a separate case. | Cancel sends no process POST. Successful consent permits preflight. A failed consent write blocks processing. This does not establish that recording upload itself occurs after consent; that requirement difference remains open. |
| A05 | Retry with matching/stale revisions, unavailable retry time, already-completed/processing status and uncertain prior outcome. | GET current state before POST. Submit only the valid current retry with its revision; require explicit uncertainty acknowledgement. Reuse completed/processing results without a new process request. |
| A06 | Enable automatic start for initial awaiting-analysis work. Repeat renders/actions; fail a dispatched POST or return a conflict. | Consume the automatic initial action once. Prevent overlapping submissions. Reconcile uncertain/conflicted requests with GET and require user action for another retry; preserve local audio. |

### R. Deck model, analysis and coaching hosts

Sources: [useDeckModel.ts](../mobile/src/features/presentations/useDeckModel.ts), [analysis.tsx](../mobile/src/features/rehearsal/analysis.tsx), [coaching.tsx](../mobile/src/features/rehearsal/coaching.tsx), [DefaultRequirementsHost.tsx](../mobile/src/features/presentations/DefaultRequirementsHost.tsx). Suggested files: `deck-model.test.mjs`, `analysis-host-runtime.test.mjs`, `coaching-host-runtime.test.mjs`, `default-requirements-host.test.mjs`.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| R01 | Build a deck model for no run, partially transcribed selected takes and completed/no-speech takes. Update the store or saved requirements. | Derive times, total duration, lines and pending/transcribed state from the selected run. Return null for a missing deck; recompute on the relevant store versions. Do not invent speech for no-speech takes. |
| R02 | Mix current/stale cached suggestions and replaced slide takes; include corrections tied to a different transcript ID. | Include suggestions only for the take still supplying that slide and a non-stale result. Apply persisted corrections only to their matching transcript. Model reads start no generation request. |
| R03 | Query stages for completed speech/no-speech, processing/failed, local/interrupted/uploading/upload-failed/submitted and absent takes. Resolve audio from an original or valid offline cache. | Return the matching stage with cached-result precedence. Return an existing matching audio URI or null. Stage/audio lookup performs no network request. |
| R04 | Mount AnalysisHost with duplicate IDs and a saved one-time automatic handoff. Fail saving the consumed flag; fail upload; request upload retry. | Mount one worker per ID. Persist consumption before upload, preserve the same attempt ID/file on retry and show recoverable failure. A failed durable handoff does not start automatic upload. Remove worker/listener state on unmount. |
| R05 | Call Inspect coaching, then Request coaching. Repeat after a request older than 30 seconds or during cooldown; deliver a later available state. | Inspect stays read-only. Consume one eligible explicit generation action. Expired/unavailable intent cannot turn into a paid request on a later refresh. Publish the correct prompt/status for the worker. |
| R06 | Retain a coaching worker from two views; release one, then the last. Let a settled worker remain unviewed for 15 seconds; reattach before expiry in another case. | Keep work while a viewer or unfinished generation needs it. Retire settled unviewed work after its delay, cancel retirement on reattach and remove its registrations on disposal. |
| R07 | Mount pending default/confirmed requirements with/without a server-deck mapping. Simulate offline failure, a conflicting draft, backgrounding and overlapping ten-second ticks. | Synchronize the appropriate pending defaults/draft while active. Respect conflicts and one in-flight worker. Keep confirmed choices pending on failure; retry after return/tick. Stop timers/listeners on unmount. |

### Q. Q&A host and recorder

Sources: [InitialQaHost.tsx](../mobile/src/features/qa/InitialQaHost.tsx), [AnswerRecorder.tsx](../mobile/src/features/qa/AnswerRecorder.tsx). Suggested files: `initial-qa-host.test.mjs`, `answer-recorder.test.mjs`. Use the existing durable-Q&A tests for downstream question-generation rules.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| Q01 | Mount visible decks with and without a selected run; change visibility/run state. | Wire automatic durable Q&A only for visible models with a run. Remove the worker when its host disappears. Keep a connected test with the real durable-Q&A controller to check admission deduplication. |
| Q02 | Start with denied permission, successful permission and an app that backgrounds during preparation. Stop a successful capture. | Denial/backgrounding prevents `record`. Success configures/prepares the recorder and sets recording state. Stop delegates to the real stop-capture helper and returns its validated URI/duration while clearing active state. |
| Q03 | Advance 70 ms metering ticks with numeric/missing meters; cross 300,000 ms; throw a status error; background; replace callbacks; unmount. | Meter only an active recording, using -160 for a missing meter. Request stop at the five-minute boundary, status failure or backgrounding. Use the latest callbacks and remove interval/AppState subscriptions on unmount. Phone tests still assess actual capture quality. |

### S. Navigation, entry points and shared hooks

Sources: [AppShell.tsx](../mobile/src/screens/AppShell.tsx), [shared.ts](../mobile/src/screens/shared.ts), [app/_layout.tsx](../mobile/src/app/_layout.tsx), [app/index.tsx](../mobile/src/app/index.tsx). Suggested files: `app-shell-navigation.test.mjs`, `screen-shared-hooks.test.mjs`, `app-entry.test.mjs`. Child-screen stubs are valid for routing assertions; use real Home/Upload in at least one connected journey.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| S01 | Mount AppShell, background and foreground it, then unmount. | Start at Home, load saved presentations on mount/foreground and remove the AppState listener. Mount the expected shared background hosts. |
| S02 | Navigate Home → Upload → Rehearse → Review and back. Repeat with Full Review, Compare and Q&A; select another slide on Review. | Route to the requested screen/deck. Replace the completed Upload layer, preserve mounted underlay state on return and synchronize Rehearse's selected slide. Keep the import hue/order stable during Upload. |
| S03 | Cover a screen with a new layer, return Home from Rehearse, then advance animation frames. | Enable touch/accessibility for the active layer, hide inactive layers from accessibility and retire the hidden Rehearse tree after the two-frame handoff. Cancel scheduled cleanup on disposal. |
| S04 | Supply shared attempt IDs from current runs, pending comparisons and playback. Include terminal/missing stages; present transcription and coaching prompts together. | Deduplicate eligible analysis workers and filter terminal/missing takes. Show transcription prompt first. Continue first-use disclosure for waiting workers; handle uncertain retry for its owner. Forward cancel/confirm to the selected prompt owner. |
| S05 | Read shell hooks inside/outside providers; replace a Back handler; mount two clock subscribers and remove them. | Return provider data or the specified missing-context error. Use the latest Back callback without duplicate listeners. Share the 30-second clock and stop it after the last subscriber leaves. |
| S06 | Mount the root with fonts pending, loaded and failed; switch theme. Import the index route through its real entry module. | Show the themed loading view until load or font error, then expose the index route. Use a dark status bar for light mode and light for dark mode. The index exports the actual AppShell. |

### T. Shared controls

Sources: [ScoreRing.tsx](../mobile/src/design/ScoreRing.tsx), [ThemeToggle.tsx](../mobile/src/design/ThemeToggle.tsx). Suggested file: `shared-controls-runtime.test.mjs`.

| ID | Setup and action | Expected result |
| --- | --- | --- |
| T01 | Render a score ring with null, 0, 100, below-zero and above-100 percentages. Change it with animation and reduced motion. | Hide an unavailable arc, clamp its drawn percentage to 0–100, preserve the caller's value/label and expose their accessibility label. Reduced motion applies the target without a timed transition. |
| T02 | Toggle light/dark mode, rerender without a mode change, then enable reduced motion. | Invoke the theme action and report the matching switch checked state. Add one half-turn per mode change, with no extra turn for an unchanged mode. Apply the new rotation without timing under reduced motion. |

## Complete 0% file inventory

Line totals below come from the October 22 native c8 summary. They are the measured denominator, not a promise that every counted line contains executable behavior. The prefix for paths in this table is `mobile/src/`.

| File | Measured lines | Planned cases / disposition |
| --- | ---: | --- |
| `app/_layout.tsx` | 41 | S06 |
| `app/index.tsx` | 4 | S06, connected AppShell entry |
| `contracts/index.ts` | 83 | Type-only declarations/re-export: scope review below |
| `design/ScoreRing.tsx` | 45 | T01 |
| `design/ThemeToggle.tsx` | 49 | T02 |
| `features/feedback/useFeedbackReview.ts` | 268 | F01–F08 |
| `features/presentations/DefaultRequirementsHost.tsx` | 37 | R07 |
| `features/presentations/importer.ts` | 114 | I01–I06; U02–U04 |
| `features/presentations/useDeckModel.ts` | 87 | R01–R02 |
| `features/qa/AnswerRecorder.tsx` | 47 | Q02–Q03 |
| `features/qa/InitialQaHost.tsx` | 6 | Q01 |
| `features/rehearsal/analysis.tsx` | 182 | R03–R04; S04 |
| `features/rehearsal/coaching.tsx` | 110 | R05–R06; S04 |
| `features/transcription/nativeMediaValidation.tsx` | 75 | V01–V03 |
| `features/transcription/useAttemptAnalysis.ts` | 198 | A01–A06 |
| `features/transcription/useReviewDeck.ts` | 40 | M07 |
| `features/transcription/useReviewMedia.ts` | 134 | M01–M05 |
| `features/transcription/useReviewPdf.ts` | 36 | M06 |
| `features/transcription/useReviewPlayerStatus.ts` | 39 | M08–M09 |
| `screens/AppShell.tsx` | 257 | S01–S04 |
| `screens/HomeScreen.tsx` | 599 | H01–H07 |
| `screens/UploadScreen.tsx` | 230 | U01–U07 |
| `screens/shared.ts` | 72 | S05 |

### Type-only coverage question

`contracts/index.ts` contains types and a re-export of the type-only feedback contract. c8's all-files report assigns it 83 uncovered lines. Verify emitted runtime code and the collector's handling of type-only `.ts` files before deciding how to represent it. Existing policy excludes type declarations, but the current collector configuration names `.d.ts` and `contracts/feedback.ts`; it still includes this file. Keep current evidence and exclusions unchanged during test implementation. Any scope correction needs its own reviewed configuration change and a fresh measurement. Do not add an import-only test to claim behavioral coverage.

## Completion and evidence

Implement each case with explicit assertions and record its case ID, test path, result and relevant native mocks. Where practical, demonstrate that breaking the asserted behavior makes the test fail. Record defects and known requirement differences instead of weakening assertions to get a green run.

From `mobile/`, run each new test file with Node 24, then run:

```sh
npm run check
node tools/validate-coverage.mjs
npm run test:coverage
npm run bundle:android
```

Save the new native report and `coverage/groups.json`/`groups.html`. Record the tested commit, date, commands, test counts and remaining uncovered behaviors. Keep the October 22 report as historical evidence. Adding these specifications alone changes no test counts or coverage results.

Keep the approved targets: logic/storage 85% lines and 75% branches; screens/components 70% and 60%. Re-measure to establish whether the implemented cases meet them. Phone checks by all four members remain necessary for microphone behavior, audible playback, native PDF rendering, gesture feel and accessibility; simulated callbacks do not establish those results.
