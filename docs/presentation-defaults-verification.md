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


## November 3, 2026 — issues #36 and #43 follow-up

The current new-import policy is **General audience / 600 seconds (10:00)**. The
October 16 request, screenshots and results above remain historical evidence.

- Issue #36: shared constants replace setup's duplicated five-minute values. An
  empty revision-zero context remains eligible for import defaults after its ID
  is reserved. Untouched controls follow accepted store updates; edits, drafts,
  custom settings, previously saved five-minute values and explicit clears win.
  Existing accepted five-minute default provenance is retained at its original
  context/revision without changing stored settings.
- Issue #43: main questions and follow-ups select `en` for Latin text without
  Hangul and `ko` for text containing Hangul. Other text keeps the platform
  fallback. Mixed Hangul/Latin uses Korean; this is not general language detection.
  Speech cancellation and saved-audio coordination remain intact.
- Regression proof: defaults tests failed before the repair; the focused defaults,
  setup and draft tests passed **28/28**, including explicit-clear synchronization
  before defaults, behind a queued writer and during an already submitted PATCH. Speech-language tests also failed
  before the repair and runtime/navigation tests passed **12/12** afterward. All
  checks are agent-operated and use mocks; no speech audio was generated.
- `npm run check` passed typechecking, lint (one pre-existing player cleanup-ref
  warning) and **591/591 tests**. `npm run bundle:android` passed. Independent AI
  review found the explicit-clear race, which was fixed and rechecked; no findings
  remain. The offline Gradle release build passed in 3m21s.
- The user requested an APK handoff because the phone is unavailable. Installation,
  phone UI/defaults, English voice availability and audible pronunciation remain
  unverified. All checks stayed silent; no microphone or real transcription checks
  were performed. No backend, API, provider or dependency changes are included.

- Native artifact: **demo v7**, package `com.team07.outloud`, versionName `0.1.0`,
  versionCode **7**, non-debuggable. APK signature verifies with the same
  certificate as v6. Manifest comparison differs only in versionCode. The embedded
  Hermes bundle matches the final Gradle bundle; its source map contains all five
  exact final changed application files.
- APK SHA-256: `c44bebc27d804c65451807a43f0ac1f5db5cf6ee572ded5270996ccf36e098c7`.
  Workspace-local APK, checksum, focused patch, logs and verification are under
  `outputs/demo-fixes36-43-20261103/`, outside this source checkout. The APK was
  not installed, and no phone data/settings were changed.

The artifact above is the earlier #36/#43-only v7. For the combined #35/#36/#43/#44–46 build and its distinct checksum, see [combined v7 verification](demo-v7-combined-verification-20261103.md).
