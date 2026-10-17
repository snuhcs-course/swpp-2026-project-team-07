# New-presentation defaults — October 16, 2026

Contributor: Seoyeon. User request: “Set default audience as general ppl. default duration 5 minutes”.
Base: `0585e2e`, isolated `it2/feature/ai_feedback`. This narrow default policy does
not authorize Phase 7's requirements sheet or any new screen. No commit/push/merge.

New imports opt into a persisted initialization intent. Once their server PDF exists,
the existing context client reserves a UUID, idempotently creates/reads its context,
and saves `General audience` / `300` seconds only for untouched revision-zero empty
requirements. No API/schema/provider configuration changes. Completed saves and
concurrent callers reuse context identity. Offline initialization remains pending and
retries on reconnect; failed acknowledgements/conflicts resolve through a read and
preserve newer saved preferences. Existing presentations are not backfilled and
existing customized/cleared requirements are preserved. Legacy missing values remain
missing outside this explicitly authorized new-import workflow.

Initial recording feedback waits while the new presentation's defaults are pending;
Q&A already requires saved audience prerequisites. Context setup itself requests no
AI work. Once synchronized, the existing recording workflows can use saved audience
and timing. Rehearse/Review show default duration; current Q&A labels its default
audience. Labels apply only to the accepted matching server-deck context and matching
saved revision/values. The held requirements sheet remains unchanged.

Verification:

- Initial new-default test failed on missing module; implemented behavior passed.
- Focused defaults/initial-feedback cases: six passed, covering deduplication, offline
  retry/stable UUID, legacy absence, existing preferences, lost PATCH acknowledgement,
  concurrent preference conflict and holding first feedback until synchronization.
- `npm run check`: typecheck/lint passed; **280 tests passed**. Existing player ref
  warning and test-renderer/module-type notices remain.
- `npm run bundle:android`: passed, `entry-964e2d596a98066f1c5be2bcd04d4314.hbc`.
- Emulator: used production analyzePdf/native page rendering on a new explicitly
  synthetic local presentation, reusing the original synthetic PDF's server copy.
  Context synchronized at revision 1 with General audience/300 seconds; targets
  summed to 300. Screenshot visibly showed “Full run · default 5:00”. No recording
  or feedback generation was requested. Temporary presentation/cache/context were
  removed, original fixture retained. The physical phone was not modified by this
  harness. Physical-phone new-import acceptance remains for the user's test.
- Independent AI review checked context revision/identity protection, retry behavior,
  legacy preservation, initial feedback gate and existing labels; no material defect.
  Suggested boundary tests and matching-context label guard were incorporated.
- No backend changes; prior backend checks remain applicable. No broad dependency,
  native configuration, requirement-entry screen or provider changes.

Local evidence: `/private/tmp/presentation-defaults-final-check.log`,
`/private/tmp/presentation-defaults-boundaries.log`, `/private/tmp/presentation-defaults-bundle.log`,
`/private/tmp/defaults-android-result.json`, `/private/tmp/defaults-new-presentation-ready.png`.
