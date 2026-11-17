# Redo and feedback verification — November 2, 2026

Agent-operated checks on November 2, 2026. This report supersedes the version 4
[checkpoint report](../apk-feature-verification-2026-11-02.md) for the repaired paths.
It does not claim human acceptance or physical-phone microphone quality.

## Artifact and UI

`OutLoud-public-demo-20261102-feedback.apk`, package `com.team07.outloud`, version
code 5, 143,224,470 bytes. SHA-256:
`9f1e1cbaba83f6c3ea7aef326c2ae163d815ffdedb414658acc29d489d573ffe`.
The local binary is under ignored `output/public-demo/`; it is not stored in Git.
Android API 24+, target 36, four ABIs, non-debuggable manifest and the preceding
internal signing identity were verified.

The selected [PR #34 UI](https://github.com/snuhcs-course/swpp-2026-project-team-07/commit/c43ab1fdcabb285327a5c1618e61e4cbf10b400f) is preserved. Rehearse changes recorder lifecycle only;
Review changes computed feedback/filler data only. Layout, styles, icons, static
labels and controls are unchanged from the selected UI. The exact supplied
seven-page Seoul PDF remains bundled for offline use. Independent artifact
inspection verified the compiled bundle, PDF, SecureStore, public API address,
source preservation and zero matches for six known private credential values
and their checked encodings.

## Observed checks

| Area | Result and boundary |
| --- | --- |
| First Redo | Immediately after saving, first Redo records and reaches Compare in the same app process. No restart, failed attempt or recovery workaround is needed. |
| Repeated Redo and choices | Keep current retains the original 17-second slide; another Redo saves successfully; Overwrite changes that slide to 11 seconds and preserves the other selected slides. |
| Review/playback | Saved full review, combined-recording state and playback progress are observed. Combined sources correctly have no whole-run score. |
| Access/offline | Wrong code rejected, correct code accepted, and saved secure access restored on an offline cold launch with no active default network. |
| Bundled demo and cues | Seoul opens offline with seven pages. Real OpenRouter-generated palace cues render in the unchanged native Cues panel. |
| Settings | The existing setup screen saves/synchronizes General audience. Bundled defaults are suggestions until explicitly saved; required-duration and audience checks need saved settings. |
| No-speech state | Actual near-silent native uploads yield No speech detected. Compact Review shows that status and dashes, without false green Spot On rows or a fabricated grade. |
| Live profile | Exact Seoul PDF produces a completed seven-slide profile with six essential cues. |
| Live Scribe | A declared 58.190-second synthetic WAV produces 150 timed words and seven visits. |
| Live selected-slide feedback | One accepted finding, zero discarded findings, with grounded evidence for the deliberate spoken 1495 versus slide 1395 mismatch. |
| Live Q&A | Two questions generated; a short synthetic answer transcribed and evaluated. Its reused introduction received partly; this is route validation, not answer-usefulness validation. |
| Scoring validation | Initial generation and one explicit regeneration scored six slides but correctly withheld one slide and the overall score for a cross-slide speech citation. Source mappings were verified. Prompt v2.2 now explicitly states the validator's existing per-slide scope rule. Four new regressions cover scope, exact previous-protocol replacement and blocked old-job submission/normalization; validation, model, public schema and UI remain unchanged. |
| Final live scoring | One fresh v2.2 generation scored all seven slides and the overall presentation (60), with zero score-critical evidence rejections. Prior rejected generations remain stored. This proves the route and evidence reconstruction, not grade calibration. |
| Existing features outside repairs | The historical version 4 matrix records theme, icon, PDF import/invalid input, Hide/Undo, rotation, navigation and interrupted-take recovery. Unchanged evidence is historical; those flows were not all repeated on version 5. |

## Evidence records

The records use Asia/Seoul dates and preserve the backend UTC timestamps.

| Check | Observed result | Record |
| --- | --- | --- |
| Mobile clean install, typecheck, lint, tests and Android JS export | 576 tests passed; one existing `useSegmentPlayer` lint warning | [Mobile](mobile.json) |
| Local PostgreSQL integration | 596 passed and one local packaged-model test skipped. System, migration, and drift checks passed. PostgreSQL race cases ran. | [Backend](backend.json) |
| Production Linux amd64 CPU image, networking disabled | The canonical image and Azure deployment image each passed 86 offline tests with no skips, including the packaged speech gate and 52 scoring tests. | [Image](image.json) |
| Version 5 APK inspection | Signature, bundle, PDF, UI preservation and known-credential checks passed | [APK](apk.json) |
| Version 5 native lifecycle/access/cues | Redo, Keep/Overwrite, playback and code/offline checks passed; synthetic microphone injection failed; original AVD files preserved | [Native](native.json) |
| Real feedback payload to Review component | Four read-only live GETs through real parsers/SQLite/component; accepted observation rendered | [Live component](live-ui.json) |
| Initial Azure feedback activation | Seven healthy services, originals unchanged, private backup and temporary SSH cleanup | [Activation](azure-activation.json) |
| Final Azure scoring repair rollout | Actual image 86/86 offline; seven healthy services, originals and all media unchanged; SSH closed | [Scoring rollout](azure-scoring.json) |
| Live provider acceptance | Profiles, Scribe, accepted finding, Q&A and repaired v2.2 seven-slide/overall score pass | [Live API](live-api.json) |
| Final public readiness/access | Normal-TLS health/readiness 200; missing/wrong code 401; browser Origin 403; five read-only probes | [Public health](final-public-health.json) |
| Publication source snapshot | Relative paths and SHA-256 hashes for source/configuration deltas | [Manifest](source-publication.json) |

The mobile checks ran from `mobile/` on Node 26.8.2. The repository's [.nvmrc](../../../../.nvmrc) specifies Node 24. Backend checks ran from `backend/` against an isolated PostgreSQL 16 database. The image record includes the Docker build command, test modules, and offline conditions. The original orchestration wrapper is unavailable. See [Dockerfile.production](../../../../backend/Dockerfile.production) for the build configuration.

## Deployment and data

The existing public Azure backend is enabled with OpenRouter
`openai/gpt-6-luna`. API, worker and scheduler run the same reviewed image and
configuration. All seven services passed health checks. The application limit
is 300 LLM requests/day, shared across prompt families; this is not a monetary
cap. Repository examples retain disabled defaults. The original three
presentations, 14 slides and 17 attempts were fingerprinted unchanged at
activation. Live checks use additive synthetic records, not original rehearsals.
A consistent data backup and private environment/source rollback remain on the
VM. The scoring rollout also verified all 46 current media files unchanged.
Its first deployment checker omitted Django initialization and triggered a
successful rollback; the corrected checker passed offline and the retry
completed. Temporary operator-only SSH was removed after both attempts.

Only the OpenRouter key was added. No personal OpenAI key is present on the VM,
and the application has no fallback to it. The OpenRouter account belongs to
someone else; upstream BYOK configuration and account balance are unverified.
Observed key-usage deltas exclude Scribe and are not a combined-provider invoice.

## Limits

The emulator microphone-injection setup failed at both 16 and 48 kHz: real
uploaded AAC was near silent despite successful, paced gRPC transport. A later
no-recording routing diagnostic crashed the emulator. These are retained test
setup failures, not proof of a successful native speech-to-feedback flow.
The app's real no-speech response and native recorder lifecycle were observed;
live speech recognition and accepted feedback were separately verified using
the declared synthetic WAV through the actual API. Physical microphone,
audible playback quality, long recordings, broad accessibility and human
usefulness are unverified.

The selected compact UI has no ordinary transcript-correction, detailed
feedback-evidence, feedback-update or manual remote-audio-download controls.
Those controls were not restored as part of this repair. Full Review retains
transcripts and playback; Cues retains its existing details control.

Raw screenshots, recordings, and private logs remain local.
