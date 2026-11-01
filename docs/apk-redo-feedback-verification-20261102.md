# Version 5 APK — Redo and live feedback verification

Agent-operated checks on November 2, 2026. This report supersedes the version 4
[checkpoint report](apk-feature-verification-20261102.md) for the repaired paths.
It does not claim human acceptance or physical-phone microphone quality.

## Artifact and UI

`OutLoud-public-demo-20261102-feedback.apk`, package `com.team07.outloud`, version
code 5, 143,224,470 bytes. SHA-256:
`9f1e1cbaba83f6c3ea7aef326c2ae163d815ffdedb414658acc29d489d573ffe`.
The local binary is under ignored `output/public-demo/`; it is not stored in Git.
Android API 24+, target 36, four ABIs, non-debuggable manifest and the preceding
internal signing identity were verified.

The selected PR #34 UI is preserved. Rehearse changes recorder lifecycle only;
Review changes computed feedback/filler data only. Layout, styles, icons, static
labels and controls are unchanged from the selected UI. The exact supplied
seven-page Seoul PDF remains bundled for offline use. Independent artifact
inspection verified the compiled bundle, PDF, SecureStore, public API address,
source preservation and zero matches for six known private credential values
and their checked encodings.

## Observed checks

| Area | Result and boundary |
| --- | --- |
| Mobile checks | Clean install, typecheck, lint, 576 tests and Android JS export pass. One existing `useSegmentPlayer` lint warning remains. |
| Backend checks | Final PostgreSQL 16 system/migration/drift checks pass; 597 total tests, 596 executed passes and one local packaged-model skip. PostgreSQL race cases ran. |
| Production runtime | Final canonical amd64 CPU image and actual Azure deployment image each pass 86 offline tests with no skips, including the real packaged speech gate and 52 scoring tests. |
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

[Portable automated/artifact evidence](testing-evidence/redo-feedback-20261102.md)
contains commands, counts and hashes. Raw screenshots, recordings and private
logs remain local; no private media or credentials are included in the branch.
