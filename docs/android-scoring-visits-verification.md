# Android scoring visit compatibility — October 17, 2026

> Historical feature evidence. The current retained-feature integration and cleanup are recorded in [retained-feature verification](retained-features-verification.md). Earlier deployment/test statements below belong to their original checkpoints.


The Android score parser now preserves every original slide visit, including
zero-duration simultaneous transitions. It accepts the unchanged saved backend
worker response that previously failed validation. This is a compatibility repair
in `codex/presentation-score`, with score UI integration still separate.

## Change and guarantees

Only `mobile/src/features/feedback/presentationScore.ts` changes runtime behavior:
reconstruct the full original event timeline for evidence validation rather than
using the positive-duration run/playback helper. Keep all original visit IDs;
retain the existing helper for run selection. No backend or playback implementation
was changed, and no data contract was redesigned.

- Allow equal start/end times in visit records; do not drop or renumber them.
- Validate original event/word times as safe nonnegative integers, within the
  recording duration; require a zero-start, nondecreasing event timeline and valid
  slide indexes. Negative spans, fractional/nonfinite/invalid times fail.
- Compare backend visits and word ownership against every original event. Unknown
  visit IDs, wrong slide/source, forged quotes, altered timestamps, word allocation
  to an empty visit and silently renumbered citations still fail.
- Empty records retain chronology but cannot own speech. At simultaneous boundaries,
  words belong to the last visit starting there. References to subsequent original
  visit IDs are accepted without relaxing provenance checks.
- A zero-duration visit alone cannot qualify its slide for a score. The positive
  visit requirement remains; such a slide can be read as `not_recorded`, with its
  score and dependent overall score withheld while valid other slide scores remain.
- Valid zero-duration original words/measurements retain their exact source times.
  Existing `useSegmentPlayer` skips empty audio ranges; existing `TakePlayback`
  disables the empty-interval play control. Tests confirm no native seek/source
  replacement for point evidence, and ordered playback of repeated nonempty visits
  without inventing time around empty visits.

## Verification

The initial red run had four expected validation failures (16 passed), reproducing
rejection of simultaneous/repeated chronology and acceptance of mirrored malformed
time metadata. Independent review then found one compatibility regression: the new
full chronology also fed the old scored-slide eligibility check. A dedicated red
regression reproduced an empty-only slide incorrectly scoring. The final repair
requires positive duration for that predicate while keeping all visits for evidence.

| Check | Result |
| --- | --- |
| Focused score parser, segment player and TakePlayback | 35/35 pass |
| `npm run check` | 483/483 tests; typecheck passes; lint 0 errors, one pre-existing `useSegmentPlayer.ts:108` cleanup-ref warning |
| Android export with cleared cache | Pass; JavaScript/Hermes export, no APK/device claim |
| Unchanged saved backend worker response | Accepted by actual parser; overall 67, slide 67, original empty visit preserved |
| Independent AI review | Eligibility repair verified; independent focused 35/35, no remaining material task findings |
| Git preservation | Original staged binary diff byte-identical; no backend source changes |

Commands from `mobile/`:

```sh
node --test tests/presentation-score.test.mjs tests/segment-player.test.mjs tests/take-evidence-playback.test.mjs
npm run check
EXPO_ROUTER_APP_ROOT=/Users/seoyeonpark/.codex/worktrees/presentation-score/OnLoud/mobile/src/app npm run bundle:android -- --clear
```

The saved worker-response check only reads the synthetic response produced in the
previous backend milestone. It performs no HTTP request, inference or worker job.
Tests include simultaneous empty visits at the beginning and middle, repeated and
backward slide visits, preserved original citation IDs, exact boundary word
ownership, no fabricated point-evidence audio, empty-only slide eligibility,
malformed timestamps, unknown IDs and mismatched evidence.

## Scope and handoff

Changes are one parser, two regression test files and task documentation. Backend
scoring, run/playback implementation, navigation, existing scoring work and earlier
milestone artifacts remain untouched. Original staging remains byte-identical with
SHA-256 `d620f261d498820ec0a29683f6ed146951c16d04a8c35648cf4a615b2b3e4ccc`.
The scoped patch, before/after hashes, original index snapshot and verification logs
are local at `/tmp/outloud-android-zero-visits-20261017/`.

No commit, push, merge, paid call, dependency installation or scoring UI integration
was performed. Device scoring interaction and live-provider usefulness remain
unverified. The former zero-duration validation blocker is resolved; connecting the
existing score API/cache to scoring controls, circular indicators, navigation tiles
and explanation panels remains the next separately reviewable milestone.
