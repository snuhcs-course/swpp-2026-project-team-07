# B09: retry recording

Branch: `fix/retry-recording`, based on merged PR31/main `c4a3f48`.

## Intended behavior

This focused spec refines the existing retry/Keep current/Overwrite flow in
[rehearsal review](rehearsal-review.md) and the new-recording identity rule in
[the API contract](api-contract.md). It does not change upload/analysis retries.

1. After saving a recording, return from Full Review/Review and confirm Redo.
   The first confirmation starts one new recording after the countdown, without
   “This take has already started.” Each new recording owns a fresh recorder,
   attempt ID and audio-relative timeline.
2. The new timer starts at zero and follows the new recorder's elapsed audio
   time. It must not display the previous take's duration or depend on another
   failed Retry tap to reset the capture engine.
3. Additional record taps while starting/stopping do not start another take.
   Cancelling the countdown creates no recording. A cancelled or failed start
   leaves the previous saved take intact and permits another explicit attempt.
4. Stopping the redo preserves the existing Keep current/Overwrite comparison.
   Keep current retains the selected original. Overwrite selects the new take.
   The original saved audio/attempt remains available unless the user separately
   discards it through an existing explicit workflow.
5. Recorder callbacks from a finished take cannot update a later take's timer.

## Verification order

Spec; reproduce; write a failing regression using the actual screen and capture
engine with a labeled native-audio fixture; make the smallest fix; rerun the
regression and mobile gates; repeat the original flow on the Galaxy S25; capture
before/after evidence. Tests, native device checks and human checks are reported
separately. The timer-jump symptom needs its own device observation.

## Evidence

User observation: October 19, Galaxy S25 connected to a Mac by USB, PR31 app;
exact installed commit unknown. First Retry reports an already-started take;
another Retry freezes at 0:00 then jumps to 0:07.

### Cause and change — October 20, 2026

`CaptureEngine.start()` deliberately accepts only a fresh engine (`ready`). A
successful stop leaves it `done`. The rehearsal screen stays mounted beneath
Review, but only its failure paths changed `engineKey`. Returning and confirming
Redo therefore reused the finished engine; the error path then remounted it,
explaining why a second attempt could start.

The fix remounts the capture engine immediately after a successful `commitTake`,
before opening Review. It preserves the single-use guard and the saved original.
Production change: two lines in `mobile/src/screens/RehearseScreen.tsx`.

### Automated results — local branch, not GitHub CI

| Check | Before: main `c4a3f48` plus new tests | After: branch fix |
| --- | --- | --- |
| Five B09 regressions | 1 passed, 4 failed | 5 passed |
| Mobile typecheck, lint and suite | Not rerun for baseline | 553 tests passed; 0 lint errors, 1 existing warning in `useSegmentPlayer.ts` |
| Android JavaScript export | Not rerun for baseline | Passed |
| Independent AI review | Not applicable | No blocking findings; human review pending |

The five cases cover first redo/original preservation and late old-recorder
callbacks; three consecutive retakes with Keep current and Overwrite plus the
new timer display; countdown cancellation; duplicate taps during preparation;
and holding to redo the whole presentation. The tests use the real rehearsal
screen, capture engine, recording service, take selection and SQLite attempt
storage. Native audio, UI/navigation boundaries and deck storage are fixtures.
Injected audio durations check timer wiring; they cannot establish native clock
behavior or audible recording quality.

Commands (from `mobile/`, Node 24.20.0):

```sh
node --test tests/retry-recording.test.mjs
npm run check
EXPO_OFFLINE=1 npm run bundle:android
```

[Before failures](review-artifacts/b09-2026-10-20/before-tests.txt) ·
[After regressions](review-artifacts/b09-2026-10-20/after-tests.txt) ·
[Full mobile checks](review-artifacts/b09-2026-10-20/mobile-check.txt) ·
[Android export](review-artifacts/b09-2026-10-20/android-export.txt)

Console logs above have trailing whitespace removed; results and error messages are retained.

### Device evidence — October 20 follow-up completed

Galaxy S25 `SM-S931N`, Android 17 (SDK 37), connected to the Mac by USB.
Codex operated the checks using a disposable two-slide B09 presentation.
Both runs used the existing native development build with local JavaScript:
main `c4a3f48` for before; fix `e423010` for after. The baseline source was served
temporarily, then the exact committed fix was restored and the app reloaded.
No app data was cleared. Backend/provider services were offline in both runs.

| Device case | Actual result |
| --- | --- |
| Baseline: first Redo after stop/Review | Reproduced “This take has already started.” |
| Baseline: second Retry | Starts recording; early timer seconds advance. Exact seven-second freeze not reproduced. |
| Fix: first slide retake | Starts, records about 3 seconds, stops into comparison; Keep current retains 27-second original |
| Fix: consecutive slide retake after Review, same rehearsal-screen lifetime | Starts on first confirmation, timer advances to about 9 seconds, saves comparison |
| Fix: Overwrite | Review selects the new 9-second take |
| Fix: full-presentation Redo | Starts at slide 1, moves to slide 2, saves 8-second whole-run comparison |
| Fix: Keep current after full redo | Review retains selected 9-second take |
| Fix: selected recording playback | Pause control shown; position advances to 0:03 / 0:09 |

**Outcome:** the already-started error is fixed and verified in this focused
Android flow. The reported 0:00-to-0:07 freeze remains **not reproduced**, not
closed as fixed. Three consecutive retakes succeeded, including a whole run.
These are agent-operated device checks, not human acceptance or a provider test.
Audio quality was not assessed. UI selection/playback was checked on the phone;
original/unselected audio-file and attempt-ID retention is verified by automated
SQLite tests, not by exporting the phone's private database.

Presentation evidence is kept outside the repository:
`project/outloud/reviews/b09-retry-recording-2026-10-20/` in the course workspace.
Use `index.html` for the comparison and `README.md` for execution results and
speaker notes. `device/before-first-redo.mp4` and
`device/after-consecutive-redo.mp4` are 30-second excerpts at original speed,
without an audio track or altered UI. Their source ranges are 61–91 and 53–83
seconds respectively. Full source clips stay private; the before excerpt
excludes an unrelated notification panel. No original recording was deleted.
The branch is not merged; human teammate review remains pending.

### PPT wording available now

- **Bug:** First Redo reused a finished recorder and showed “This take has already started.”
- **Fix:** Create a fresh recorder after each saved take.
- **Evidence:** New regressions: 4 failures before, all 5 pass after. Full mobile suite: 553 pass.
- **Device retest:** three consecutive retakes, Keep/Overwrite and playback passed on Galaxy S25.
- **Open observation:** the original seven-second timer freeze was not reproduced.

Speaker notes: We wrote the intended behavior first, reproduced the error with a
regression test, then made the fix and reran the checks. The automated checks use simulated native audio; the phone checks use the real
recorder. Neither is human acceptance or new GitHub CI. The original PR31 demo
remains the main demo baseline. Use the separate short B09 clips to show the
fix; do not claim the un-reproduced timer symptom is resolved.

AI assistance: OpenAI Codex prepared this spec from the user's B09 report and
the existing recording contract on October 20, 2026. No test result is claimed by
writing the spec.
