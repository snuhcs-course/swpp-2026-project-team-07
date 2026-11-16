# OutLoud demo v8 — November 3, 2026

VersionCode **8**, package `com.team07.outloud`, versionName `0.1.0`. This release retains published v7 fixes and adds the selected-slide recovery UI from [issue #49](https://github.com/snuhcs-course/swpp-2026-project-team-07/issues/49). Install as an update to preserve existing recordings and settings.

## Backend dependency

The source includes #49's duration-validation repair and completed-result recovery support. **The hosted backend has not been deployed with these changes. Installing this APK alone does not resolve the reported repeated grading failure.** The v2.3 generation prompt also remains source-only until backend activation. No backend deployment, main merge or real provider evaluation is part of this release task. Follow the [drain prerequisites](issue49-fix-verification-20261103.md#rollout-prerequisites--not-performed) before a separately authorized deployment.

## Verification

The 17 product modules match the independently reviewed #49 implementation exactly. Its [verification record](issue49-fix-verification-20261103.md) covers 630 backend tests on PostgreSQL (one host dependency skip verified separately in the packaged image), real Redis/Celery integration with mocked providers, exact history preservation, and 20 synthetic physical-phone checks. Those checks are reused by byte parity; they do not establish a live-backend or original-rehearsal result.

For v8, the Android version code is the only new runtime configuration change. Fresh `npm run check` passed typecheck/lint and **617/617 tests**, retaining the pre-existing unchanged-player exhaustive-deps warning. The public-config `npm run bundle:android` passed. Offline Expo prebuild derived code8 from the exact app configuration; production Gradle compilation passed in **4m22s**, and the single compiler-input capture rebuild passed in **37s** with byte-identical Hermes output.

`OutLoud-demo-v8-issue49.apk`: **143,240,104 bytes**, SHA-256 `3ad854aff6fecb823e4ed7c5364aa52d86a497611551134d8343d6f1a0e22a4b`. Signature and ZIP CRC pass. The package is non-debuggable, API24 minimum/API36 target, and retains arm64-v8a, armeabi-v7a, x86 and x86_64. Its signing certificate matches v6/v7 (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`) for update continuity.

All 125 build-source inventory files match. All 118 mounted application modules match packager source content; all six changed mounted modules match, while the seventh changed legacy summary component is mirrored but unmounted by compact Review. The actual Hermes compiler input proves the public HTTPS endpoint and required demo-code guard; no reviewer code was supplied. The embedded Hermes equals generated compiler output. Normal entry, exact Seoul PDF and all nine unchanged earlier-v7 fix modules were verified; QA markers are absent and the previous APK is preserved.

The 20 native fixture checks are reused through 15 unchanged source hashes. The production v8 APK was not installed on a phone in this release task. Independent staged-source and APK audits gate publication; remote source/CI/release receipts are recorded separately in the active collaboration log and release metadata.

The production APK uses normal Expo Router entry, bundled Seoul PDF, public HTTPS and an entered reviewer code. Generated native projects, installed dependencies, private media and credentials are excluded from the source commit. No QA entry, mock transport or synthetic recordings belong in the release.
