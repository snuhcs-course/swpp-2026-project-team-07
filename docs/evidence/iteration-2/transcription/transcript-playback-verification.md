# Transcript playback and word highlighting — October 15, 2026

User-authorized bug fix and inline highlighting on `it2/feature/ai_feedback`,
preserving prior staged Phase 3/visit labels. No commit, push, merge, Phase 4,
new screen, dependency, API, persistence, provider or native configuration change.

## Findings and changes

The heading previously had no press handler; only its triangle played slide audio.
Sentence taps reached playback on the connected phone. Automated hook tests
reproduced three timing failures: the previous native position could trigger an
early stop while seeking backwards; stale audio-mode setup could replace a newer
source; concurrent native seeks could finish out of order. These findings do not
establish that every reported intermittent tap had the same cause.

Source/seek work now runs serially with stale-request checks. Initial seeks, like
visit transitions, suppress end detection until ready; old audio pauses during
seek. Stop/unmount cancel pending intent. Failure clears active state, shows a
fixed retry hint, and a fresh tap reloads the source. The heading and triangle
both play/pause slide audio. Sentence timestamps now share the sentence tap action.

Native audio position and URI drive current-word highlighting, preserving original
text/punctuation and correction ranges. Sentence feedback remains available for
edits that cannot safely map to original word timing. There is no estimated timing
for newly written words, and no word highlight during inter-word silence.

## Verification

- Test-first failures reproduced the three playback races, absent native-position
  reporting, absent word highlighting, and silent playback failure. Final tests
  also cover cancel during seek, visit sequencing, pause/resume, tap-again stop,
  failure/retry, exact word boundaries, punctuation, multiword correction flags
  and corrections that no longer map to original words.
- `npm run check`: TypeScript/lint and **215 tests passed**, no failures/skips.
- `npm run bundle:android`: passed after the final source change.
- Independent AI review ran 53 focused tests and found a P2: an ignored stored
  full-sentence edit prevented first-word highlighting after slide clipping.
  A new regression failed before the fix. Normalization now follows the actual
  rendered-text condition. Independent follow-up confirmed the repair and ran
  **13 focused tests**, with no further findings. This is not teammate approval.
- Connected Galaxy phone: existing dev client hot-reloaded the fix. Both first
  and return visit dividers were visible. Tapping the heading entered slide
  playback (Pause icon), and a screenshot captured the current word highlighted.
  Heading pause, return-sentence selection and switching backwards using the
  first sentence's timestamp were exercised; the corresponding active row changed.
  Earlier targeted Android audio logs showed native started/paused events.
  Human audible synchronization and exhaustive device/gesture stress remain
  unverified. No database/recording export or provider request was needed.

Logs: `/private/tmp/transcript-playback-check.log`,
`/private/tmp/transcript-playback-bundle.log`,
`/private/tmp/transcript-playback-focused.log`. Screenshots remain outside Git
because they contain private transcript content. Prior phase evidence is historical;
the final combined staged patch includes this follow-up.
