# Redo and feedback verification — November 2, 2026

These are portable summaries of agent-operated checks. They contain commands,
counts and hashes, without private logs, credentials or recordings. Dates use
Asia/Seoul; the backend records also retain their original UTC timestamps.

| Check | Observed result | Record |
| --- | --- | --- |
| Mobile clean install, typecheck, lint, tests and Android JS export | 576 passed; one existing lint warning | [Mobile](redo-feedback-mobile-20261102.json) |
| Local PostgreSQL integration | Final 597 total: 596 passed, one skipped; system and migration checks passed | [Backend](redo-feedback-backend-20261102.json) |
| Production Linux amd64 CPU image, networking disabled | Final 86 passed, no skips; packaged speech-model and scoring checks included | [Image](redo-feedback-image-20261102.json) |
| Version 5 APK inspection | Signature, bundle, PDF, UI preservation and known-credential checks passed | [APK](redo-feedback-apk-20261102.json) |
| Version 5 native lifecycle/access/cues | Redo, Keep/Overwrite, playback and code/offline checks passed; synthetic microphone injection failed; original AVD files preserved | [Native](redo-feedback-native-20261102.json) |
| Real feedback payload to Review component | Four read-only live GETs through real parsers/SQLite/component; accepted observation rendered | [Live component](redo-feedback-live-ui-20261102.json) |
| Initial Azure feedback activation | Seven healthy services, originals unchanged, private backup and temporary SSH cleanup | [Activation](redo-feedback-azure-activation-20261102.json) |
| Final Azure scoring repair rollout | Actual image 86/86 offline; seven healthy services, originals and all media unchanged; SSH closed | [Scoring rollout](redo-feedback-azure-scoring-20261102.json) |
| Live provider acceptance | Profiles, Scribe, accepted finding, Q&A and repaired v2.2 seven-slide/overall score pass | [Live API](redo-feedback-live-api-20261102.json) |
| Final public readiness/access | Normal-TLS health/readiness 200; missing/wrong code 401; browser Origin 403; five read-only probes | [Public health](redo-feedback-final-public-health-20261102.json) |
| Publication source snapshot | Relative paths and SHA-256 hashes for source/configuration deltas | [Manifest](redo-feedback-source-publication-20261102.json) |

The APK is `OutLoud-public-demo-20261102-feedback.apk`, version code 5.
Its SHA-256 is
`9f1e1cbaba83f6c3ea7aef326c2ae163d815ffdedb414658acc29d489d573ffe`.
The UI baseline is [PR #34's pinned source](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/c43ab1fdcabb285327a5c1618e61e4cbf10b400f).
Rehearse changes only recorder lifecycle handling; Review changes only computed
feedback and filler data. The inspection record describes these comparisons.

Run the mobile commands from `mobile/`. The recorded runtime was Node 26.8.2;
[.nvmrc](../../.nvmrc) requests Node 24. Backend commands run from `backend/`
against an isolated PostgreSQL 16 database. The image record gives the actual
Docker build command, selected test modules and offline wrapper conditions;
the original orchestration wrapper is not included. Build configuration is in
[Dockerfile.production](../../backend/Dockerfile.production).

The local backend skip concerns a packaged-model dependency; the separate
production-image run exercised that model offline. APK inspection and component
fixtures do not prove physical microphone behavior. Native recorder/access
checks, real provider checks and the failed emulator microphone setup are
reported separately in the [current report](../apk-redo-feedback-verification-20261102.md).
No human acceptance or feedback-quality rate is claimed.
