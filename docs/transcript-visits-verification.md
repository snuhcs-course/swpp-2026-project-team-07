# Transcript visit labels — October 15, 2026

Separately authorized follow-up to the staged Phase 3 work on
`it2/feature/ai_feedback`. No commit, push, merge or Phase 4 implementation.

## Behavior

The existing Rehearse transcript panel inserts a divider before each source visit:
`First visit · 0:00 in recording`, then `Return visit 1`, `Return visit 2`, etc.
Times refer to source recording audio, while existing sentence times/playback stay
unchanged. Multiple sentences from one visit share a divider. Silent visits still
count, even though no empty transcript group is rendered. Zero-duration events
remain excluded by JJ's existing `takeVisits` policy. Separate selected retakes
start their own counts. Moved/corrected sentences retain source provenance, with
the original slide identified when moved.

This derives transient metadata from selected-run segments. No persistence, API,
backend, job, provider, dependency or native configuration changes are needed.
Requirements entry and other held UI remain held.

## Verification

- Test-first: three new regression tests failed on absent visit metadata before
  implementation, then passed. They exercise real run merging/line building,
  first and multiple return visits, exact-boundary words, silent first visits,
  correction/move provenance, source timestamp labels and selected retakes.
- `npm run check`: TypeScript, lint and **205 tests passed**, no skips/failures.
- `npm run bundle:android`: passed. Initial sandbox attempts could not write
  Expo's local caches; reruns with approved filesystem access succeeded.
- Independent AI review of the incremental patch found no concrete defects and
  independently ran **44 tests**, covering visit labels, domain, selected takes
  and playback. This is not human teammate review.
- Connected physical phone: existing development client hot-reloaded the change;
  first-visit divider rendered in the current saved transcript. Existing header
  playback changed to Pause on tap and was paused again. Screenshots are local
  verification artifacts, not committed private content. Audible synchronization,
  return-divider rendering and correction gestures on the phone remain unverified;
  return/source/correction behavior is covered by automated tests.
- A proposed read-only phone SQLite export was rejected by automatic approval
  review because it could copy private app content. No database export was run;
  verification continued through ordinary UI interaction instead.

Logs: `/private/tmp/transcript-visits-check.log`,
`/private/tmp/transcript-visits-bundle.log`. Incremental reviewed code patch:
`/private/tmp/transcript-visits-increment.patch`. No changes to prior staged
Phase 3 source beyond the intended Rehearse transcript rendering increment.
