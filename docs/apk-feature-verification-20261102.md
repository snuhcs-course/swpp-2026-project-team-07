# OutLoud APK verification — historical v4, November 2, 2026

This report preserves the **v4 verification checkpoint**, before the later Redo and compact-feedback fixes and OpenRouter activation work. Its results, disabled-provider state and unresolved authorization describe that checkpoint; they are not the current v5 deployment status. Source links may now open subsequently fixed code. Evidence under `output/` is ignored local operator material, not a published repository attachment.

## Outcome

The v4 APK contains the selected updated UI and the bundled seven-page Seoul presentation. Offline local workflows were exercised on a disposable Android emulator. **First-attempt Redo failed (R5); retrying or reopening with a fresh engine allowed recording, and both comparison choices worked after that workaround.** Several ordinary Review tools were no longer reachable. This was not an “all features work” result.

## Build and implementation

- APK: `output/public-demo/OutLoud-public-demo-20261102.apk`, version code **4**, **143,222,930 bytes**. SHA-256: `a5d84d14a96b73285ca608abbe32140831352b5dec3dde52b5c3d8ae8df8a45c`.
- Non-debuggable; signature verified and matches the previous signer. Embedded bundle matches the final build. Public HTTPS and native SecureStore are packaged; the old tailnet hostname and five checked private values are absent.
- All **12 selected UI/source-test files exactly match PR34 `c43ab1fdcabb285327a5c1618e61e4cbf10b400f`**. No UI repair or redesign was applied.
- Seoul PDF: seven pages, **6,793,649 bytes**, SHA-256 `48e673f2dce98c5b4a67a1ad52fcb68092bdc5d606c03d68892e6b187be1f9aa`; exact bytes verified inside the APK.
- Nonvisual seeding uses `presentations/bundledDemo.ts`, serialized startup in `store.ts`, catalog registration in `pdf/service.ts`, and the extracted `pdf/renderPages.ts` helper/re-export. It copies durable local assets, registers metadata/catalog, then writes a completion marker. Retry/hide/removal tests preserve existing presentations, runs and audio; no upload/provider intent is created. `expo-asset` declares the existing exact dependency version.

Local evidence paths: `output/public-demo/artifact-verification-20261102.json`, `output/public-demo/backend-verification-20261102.json`, `output/public-demo/native-emulator-verification-20261102.json`, and `output/public-demo/native-v4/`. Screenshots 01–12 are preliminary v3 evidence and excluded from final-v4 acceptance.

## Checks and environment

Mobile checks passed **561 tests**, type/lint checks and Android export. Backend system/migration checks passed; **544 tests executed successfully, 25 skipped**: 24 PostgreSQL concurrency cases and one locally unavailable packaged VAD dependency. Native mocks and SQLite do not establish hardware or PostgreSQL concurrency behavior.

The deployed seven services were healthy; the worker returned pong and matched the API image. The actual deployed speech gate classified zero PCM as **no speech**, with socket networking blocked. Feedback is explicitly disabled; a Scribe key is configured, checked only as a boolean. **24 public GET/HEAD probes passed** with ordinary TLS validation, no proxy and no followed redirects. Runtime inventory retained 3 presentations, 14 slides and 17 attempts, with zero provider/feedback requests and description/feedback jobs.

Native checks used a temporary copy-on-write emulator, reduced motion and host audio disabled with `-no-audio`. App-data clearing affected only that disposable copy. Online code entry checked health; local captures/recovery used Wi-Fi/data off with no active default network. Playback progress proves native timing/state, not audible quality. Physical phones were untouched. The emulator was closed after stopping the app and restoring its temporary settings. All six original AVD disk images and the final APK checksum remained unchanged; local preservation evidence: `output/public-demo/emulator-preservation-20261102.json`. Final screenshots 49–52 confirm the retained Literature icon, Hide toast, immediate Undo restoration and another cold restart. The exact whole-redo Cancel action returned to idle without recording (53); an earlier expired Undo attempt was an observation-driver timing limit, not an app failure.

## Twenty-two feature areas

**Native** denotes agent-operated emulator evidence; **automated** denotes tests/probes. Disabled or untested provider paths are not functional-success claims.

| # | Feature | Result and boundary |
| --- | --- | --- |
| 1 | Public access/auth/TLS | **Native/automated pass:** wrong-code rejection, correct unlock without losing Seoul, offline restore; public TLS/auth guards passed. |
| 2 | Health/readiness | **Automated/live pass:** API/database/broker ready; separate worker pong. Readiness alone does not check workers. |
| 3 | PDF import/dedup/slides | **Native pass:** picker cancellation, invalid-PDF rejection, valid three-slide import; bundled Seoul renders through page 7 offline and rotates. Dedup is automated. |
| 4 | Defaults/requirements | **Native local pass:** retained Reviewers/5-minute settings; clear time/audience saved and reopened with offline sync pending. Cloud conflict/sync is automated only. |
| 5 | Recording/timeline | **Native partial pass:** save a 31-second seven-slide run with local durations. Physical microphone, audible signal and speech accuracy unverified. |
| 6 | Redo/Keep/Overwrite | **Native failure R5:** first Redo fails. After retry/fresh launch, Compare works; Keep retained old slide 7 at 6 seconds, Overwrite replaced only slide 7 with 3 seconds. |
| 7 | Interruption/recovery | **Native pass:** force-stopped capture reopens with recovery notice; Recover playable recording reaches Compare; Keep current retains the old selection. |
| 8 | Upload/retry identity | **Automated pass; live write blocked.** Offline local files retained. Ordinary manual retry entry removed (R1). |
| 9 | Silence processing | **Deployed gate preflight pass:** actual model rejects zero PCM offline. Full HTTP/worker pipeline not run. |
| 10 | Scribe transcription | **Automated only:** transport/keyterms/failures. Configured key is not a successful provider request; no new live transcription. |
| 11 | Alignment/metrics | **Automated pass; native duration display observed.** Human listening/recognition alignment unverified. |
| 12 | Playback/review | **Native pass for state/progress:** retained local playback, whole-run playback/seek and compact slide playback. No audible-quality claim. |
| 13 | Remote offline downloads | **Automated/live-read pass for URLs/auth/ranges; normal UI blocked by R1/R2.** No current native download acceptance. |
| 14 | History/data retention | **Native upgrade/restart and Hide/Undo pass; backend read/import tests pass.** Restored deck/icon survive cold restart. History requires known API/deck bindings; Hide is not server deletion. |
| 15 | Confirmed corrections | **Automated only:** revisions/conflicts/restore. Ordinary native correction entry removed (R1). |
| 16 | Recognition suggestions | **Disabled/provider not run.** Recognition-policy/staleness tests pass; ordinary entry removed. |
| 17 | Cues/profiles | **Disabled; native unavailable/offline state observed.** No generation or cue-quality acceptance. |
| 18 | Slide descriptions | **Disabled; automated contracts pass.** No live edit/generation acceptance. |
| 19 | Coaching/slide feedback | **Disabled; automated evidence/lifecycle tests pass.** Detailed ordinary controls removed; unassessed display issue R3 remains. |
| 20 | Presentation scoring | **Automated only; native unavailable/mixed-source state observed.** Combined recordings correctly lack an overall score; no live scoring/usefulness result. |
| 21 | Audience Q&A | **Native prerequisite-blocking screen observed.** Questions/answer/judging contracts are automated; generated/spoken-answer flow not run. |
| 22 | Offline/lifecycle/UI controls | **Native local pass:** offline launch, page navigation, About/close, theme, persistent Literature icon, Hide/Undo and whole-redo confirmation/Cancel without capture. |

## Failures and retained limitations

- **R5 — Native first-Redo failure.** Screens 31/32 show “This take has already started”; 33/34 show successful retry/Compare. [CaptureEngine](../mobile/src/features/rehearsal/CaptureEngine.tsx) line 100 requires `ready`, but successful stop leaves `done` at line 132. [RehearseScreen](../mobile/src/screens/RehearseScreen.tsx) saves/navigates without remounting the engine; its failure handler increments the key, enabling retry. Recording UI tests replace that lifecycle with a restartable mock, so 561 green tests missed it. Both comparison choices passed only after the workaround.
- **R1/R2 — Removed ordinary Review tools.** [ReviewScreen](../mobile/src/screens/ReviewScreen.tsx) no longer mounts `ReviewSlidePlayback`/`SlideReviewSummary`. Correction/restore, word playback, upload/transcription retry, detailed evidence and downloads lose their normal entry. Recovery-only `TakePlayback` is not an ordinary saved-take route. Full Review still directs missing-audio users to slide review for download, but that screen disables Play and has no download action.
- **R3 — Synthetic component reproduction.** Actual feedback-status derivation plus updated Review, with native boundaries mocked, displays zero fillers and three “Spot On!” rows for unassessed no-speech/untimed cases. Awaiting/transcribing correctly shows its pending row. This is component evidence, not a native or live-provider result; local compact probe: `output/public-demo/ui-empty-word-probe-20261102.json`.
- **R4 — Source-only accessibility limitation.** Full Review accessibility increments call `startWholeAt`, which returns without updating selection when audio is missing; touch scrubbing previews first. General TalkBack behavior and a native reproduction are unverified. Review's separate selection remount works; no blanket stuck-scrubber claim is made.

At the v4 checkpoint, automatic approval review rejected a persistent synthetic production upload before execution because explicit data-mutation authorization was required. Approval was unresolved at that checkpoint: **no upload/process request, production fixture or paid provider action had been sent**. The read-only checks and offline gate preflight did not replace a full pipeline run. AI usefulness, English/Korean accuracy, physical listening, long captures and complete accessibility were unverified.
