# Combined OutLoud demo v7 — November 3, 2026

This is the combined v7 build for fixes **#35, #36, #43 and #44–46**. It supersedes the earlier #36/#43-only local v7 artifact for publication; that older file remains preserved.

## Included changes

- #35: complete compact feedback text in the existing details view.
- #36: ten-minute/General audience defaults, preserving edits and explicit clears.
- #43: English/Korean Q&A speech-language selection.
- #44: precise audio seeking with play/pause, source and cancellation protection.
- #45: evidence-linked actionable feedback instructions in backend prompt v2.3.
- #46: consistent timing allocation labels and informational filler counts.

The source includes #45, but this publication does **not** deploy the running backend. New generated-feedback usefulness and physical-phone speech quality remain unverified.

## APK

`OutLoud-demo-v7-combined-fixes.apk` — **143,234,646 bytes**. Package `com.team07.outloud`, versionName `0.1.0`, versionCode **7**, non-debuggable. Android API24 minimum/API36 target; arm64-v8a, armeabi-v7a, x86 and x86_64 included. Signature verifies with the same certificate as the earlier demos.

SHA-256: `24df70866369ef4af2a55513765f5daa364463896b97a848c29c2436c553f55b`.

ZIP CRC passes. Embedded Hermes matches the generated bundle; all 11 changed application sources match the packager source map, with all 116 mounted application files matched and 123 build-source files checked. Normal app entry and bundled Seoul PDF are retained; QA harness content is absent. The actual compiler input proves public HTTPS and the demo-code requirement; no reviewer code was supplied by the build.

## Checks before publication

- Fresh isolated-source `npm run check`: **607/607 tests**, typecheck and lint passed; one existing player cleanup-ref warning.
- Public-config Android JavaScript export passed.
- Backend system/migration checks passed; **601 tests**, with **25 PostgreSQL-only skips**.
- Independent staged-source review found no concrete defect; **69 focused tests** passed independently.
- Production offline Gradle release build passed in 2m53s; one capture-forward proof build passed in 41s with compiler output byte-identical to the direct build.
- Ten prior silent native component-fixture checks apply through exact parity of the six relevant source files. They cover seeking/playback intent, timing/filler labels and existing actionable-advice/citation display. Retake/missing-audio, boundary/EOF, cancellation-race and accessibility matrices remain unit-only.

No physical-phone installation, audible-quality check, microphone recording or real provider request was performed for this build. The fixture advice is not a real-model quality result. Source and APK are prepared from the same reviewed snapshot; GitHub publication receipts are recorded separately in the collaboration log/release metadata.
