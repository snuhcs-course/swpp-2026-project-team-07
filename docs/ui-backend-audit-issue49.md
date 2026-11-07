# OutLoud issue 49 — frontend and backend audit checklist

**Audit date:** November 7, 2026
**Scope:** `/Users/just_aoj/Desktop/outloud-ui-spec` compared with the issue-49 source snapshot.
**Evidence level:** source and contract inspection. This is not a device visual review or a live backend integration test.

## Status key

- **[x] Present in source:** an implementation or data path is visible in code. This does not certify pixel fidelity or successful device behavior.
- **[~] Partial / mismatch:** implementation exists but a listed requirement is missing, differs, or is limited by the API.
- **[ ] Not verified / missing:** no sufficient evidence, or the required check could not run.

## Part 1 — Frontend checklist

### Shared frame, proportions, and design system

- [x] **Reference frame exists:** the app defines a 390 × 844 design frame and a 844 × 390 landscape frame in `mobile/src/design/tokens.ts`; `Frame` scales the canvas uniformly inside the device safe area in `mobile/src/design/frame.tsx`.
- [x] **Short-phone compact layout (source):** below the 0.9 scale threshold, `Frame` switches to the 390 × 760 compact frame. Home hides carousel neighbours and uses a 120-unit deck icon and 52-unit score; Rehearse uses a 358 × 170 slide card. Text style sizes are unchanged. This has passed typecheck/lint but still needs layout comparison on a short physical phone.
- [~] **Exact measurements:** source sets the standard rehearsal card to 358 × 200, setup dial to 240 units, Waiting tiles to 50 × 50, and Waiting actions side by side. Compact Rehearse uses a 170-unit card. Rendered proportions and spacing still need screenshot comparison.
- [~] **Gesture implementation:** Home carousel uses React Native Gesture Handler gestures, but most screen swipes and sheets use `PanView`, which wraps React Native `PanResponder`. The spec requires Gesture Handler `Gesture.Pan()` with Reanimated worklets and UI-thread gesture animation. The current path is not a full match and has not been frame-rate tested.
- [x] **Theme timing:** `ThemeToggle.tsx` now uses the spec's 420 ms rotation.
- [x] **Fonts load before app content:** `mobile/src/app/_layout.tsx` loads Bricolage Grotesque and Figtree before rendering the app.
- [ ] **One-to-one device appearance:** no Samsung screenshot set or calibrated screenshot-to-reference comparison was performed. “390 × 844” is a design canvas, not proof of a 1:1 rendered match on the phone.
- [ ] **QA conditions:** light-theme contrast ratios, TalkBack labels across every screen, reduce-motion behavior for every animation, 60 fps on a mid-range phone, and layout on a phone no taller than 700 px have not been checked end to end.
- [~] **Text-size floor:** the prior source pass raised many active screen styles to 13.5 units, but this audit did not run a complete automated text-style inventory across all nested components and states. The spec’s 13.5-unit minimum is therefore not certified.

### Spec component-library coverage

The `library/` directory in the supplied spec contains visual reference boards (`foundations.png`, `controls.png`, `content.png`, `layout.png`, and `flow_map.png`), not importable React components. The component catalogue is in §5 of `OUTLOUD_UI_SPEC.md`. The app’s reusable UI is primarily `mobile/src/design/ui.tsx`, `SlideCard.tsx`, `icons.tsx`, and screen-local components.

- [x] Reusable equivalents are used for **RecordButton**, **ConfirmButton** (green/check mode of `RecordButton`), **SideAction** (the `RoundButton` equivalent), **Chip** in selected flows, **HintRow**, **Toast** (`UndoToast`), **SlideFace/SlideCard**, and **DeckIcon/carousel**.
- [~] Several catalogue pieces are present only as screen-local markup rather than reusable shared components: **PillButton, TextAction, DoorRow, CueCard, SegmentedControl, PageDots, SlideProgress, BigNumber, StatColumns, GradeTile, IssueCard, ChatBubble, QuoteCard, StepRow, ColourSwatch, PanelAvatar, RecordingPill, VerdictBar, and Dial**. A local visual equivalent is not proof that the reference component’s states, accessibility, spacing, and behavior all match.
- [~] **GlassArrow** is rendered as screen-local arrow buttons rather than a shared catalogue component.
- [~] **BottomSheet** behavior is assembled from `PanView` and screen-specific views; there is no shared sheet component enforcing the spec’s height cap, scrim/sheet timings, pan thresholds, Android Back, and snap-back behavior across S06/S08.
- [~] **VerdictBar** is a three-segment inline bar for Missed/Partly/Answered. Missed is visual only because the backend currently has no Missed verdict.
- [ ] The supplied UI library boards have not been checked against live device captures component by component.

### Per-screen requirements (S01–S19)

The source status below records whether the screen and its main flow exist. All 19 remain **visually unverified** against their PNG reference on a Samsung device.

| Page | Checklist | Source/evidence and gap |
| --- | --- | --- |
| **S01 Home** | [x] carousel, deck selection, score/stats, tutorial/theme/icon/delete entry points, compact icon/score and hidden neighbours; [~] exact geometry and states | `HomeScreen.tsx`, `HomeFeedbackStats.tsx`. Core gestures and undo are present. Carousel geometry, safe-area fit, compact short-phone spacing, empty/no-run/pending/composed states, and exact styling need device comparison. |
| **S02 Add presentation** | [x] PDF picker, cancel/error recovery, 50 MB/PDF validation path; [~] exact empty-state layout | `UploadScreen.tsx`, `features/pdf/`. Confirm error copy, picker handoff, upload failure, and screen proportions on device. |
| **S03 Analysing** | [x] slide count, text/profile job, time planning, retry/continue path; [~] progress granularity | `UploadScreen.tsx`, `useSlideProfiles.ts`, backend profile endpoints. Profile status is deck-wide, not per-slide; the spec explicitly lists an image-only explanatory state that is not certified here. |
| **S04 Setup** | [x] 1–30 minute dial at the specified 240-unit size, audience selection, save/recovery path; [~] audience contract | `PresentationSetup.tsx`. “Not sure” currently maps to “General audience” in the client; blank audience remains not-ready in backend scoring/Q&A. Verify selection, save failure, custom audience, and accessibility actions on device. |
| **S05 Rehearse** | [x] slide navigation, recording/countdown, timing, cues, redo, Review route, 358 × 200 standard/170 compact card, 1.5 s hold, custom redo-all accessibility action; [~] exact card/haptics/gesture behavior | `RehearseScreen.tsx`, `CaptureEngine.tsx`, `SlideCard.tsx`, `design/ui.tsx`. Recording and repeated/backward slide visits are represented in code. Native mic and interruption behavior still need device verification. |
| **S06 Cue sheet** | [x] cue content for the selected kind and slide; [~] shared sheet behavior | `RehearseScreen.tsx`, `CueGuidancePanel.tsx`. The sheet is screen-local and uses the `PanResponder` wrapper; test own-kind filtering, long-content scrolling, scrim tap, swipe close, and Android Back. |
| **S07 Landscape rehearsal** | [x] landscape screen, controls, slide navigation, cue panel and auto-hide implementation; [ ] physical rotation behavior | `RehearseScreen.tsx`, `AppShell.tsx`. Spec geometry is encoded in styles, but no phone rotation/cue-panel/microphone continuity test was run. |
| **S08 Redo sheet** | [x] confirm redo while preserving the previous take; [~] shared-sheet conformance | `RehearseScreen.tsx`, `CompareScreen.tsx`. Redo-all hold is set to 1.5 s. Verify cancel/confirm, old-take preservation, and compare arrival with device interaction. |
| **S09 Waiting** | [x] status polling, square slide tiles, three-minute reveal fallback, retry, Listen Back, side-by-side actions; [~] exact visual layout; [ ] notification | `WaitScreen.tsx`. Notification and ETA are unavailable in the backend, so the UI offers Go Home without promising “we’ll tell you.” |
| **S10 Full review / overview** | [x] score/status, six-column slide tiles, Feedback/Listen/Q&A/Home paths; [~] design remains a pending spec decision | `OverviewScreen.tsx`. Score uses backend level and composed runs avoid an invented overall grade. The spec itself says the full-review design is not chosen; the recommendation is a pace timeline, but the implementation follows the wireframe. |
| **S11 Slide review** | [x] one issue at a time, slide score, issue dots, category chips, Q&A/back navigation, cited evidence playback | `ReviewScreen.tsx`. Issue evidence now has a “Hear it” action for the exact cited interval. No-issues and insufficient-speech states are present in source. |
| **S12 Feedback** | [x] run feedback points, “You said” evidence, advice/“Do this”, audio evidence, swipe paging; [~] exact quote-card geometry | `FeedbackScreen.tsx`. Playback is wired to evidence intervals. The API suggestion is advice, so the UI labels it “Do this”; verify line wrapping and empty/quote-less point states visually. |
| **S13 Listen back** | [x] run-wide segment playback, transcript sync, filler highlighting, scrubber and slide skip; [~] exact text positions | `ListenBackKaraokeScreen.tsx`, `useSegmentPlayer.ts`. Source implements timing and no-transcript states; native audio, word synchronization, and exact typography/line placement require device validation. |
| **S14 Compare takes** | [x] Old/New selection, time and metrics, playback, Keep and Back; [~] details of shared stat component | `CompareScreen.tsx`. The screen uses inline stat columns without the catalogue’s separator hairlines. Verify delta meanings and that Back preserves the pending choice. |
| **S15 Audience Q&A question** | [x] question state, panelist, TTS, answer recording/waveform, follow-up navigation; [~] exact component styling | `QAScreen.tsx`, `features/qa/`. Real audio capture/TTS, saved answer recovery, and full flow to S16 have not been device tested. |
| **S16 Q&A answer review** | [x] three-segment Missed/Partly/Answered bar, answer verdict, playback, next-time advice, follow-up and redo; [~] Missed verdict data | `QAScreen.tsx`. The visual bar now has three segments; the backend still supports only `answered`, `partly`, and `too_short`, so no result can select Missed. |
| **S17 Tutorial** | [x] six pages, first-launch flag, swipe/close navigation, animated gesture demo; [~] device visual check | `HomeScreen.tsx` (`TutorialOverlay`). The demo card and pointer now animate according to the tutorial page. |
| **S18 Icon picker** | [x] preview, six colors, 4 × 5 icon choices, close-save behavior; [~] exact hit targets and visual states | `HomeScreen.tsx` (`IconPicker`). Source styles define the main layout. Confirm all 20 icons, color persistence, selected indicators, and close paths on device. |
| **S19 Delete with undo** | [x] local delete, next deck selection, 4.5 s undo; [~] toast interaction and media retention | `HomeScreen.tsx`, `UndoToast`. Server copy intentionally remains because there is no delete endpoint. Verify undo timing and file retention when saved takes exist. |

### Frontend functional and visual gates still open

- [ ] Capture all 19 app screens on the Samsung and compare against `screens/S01_*.png` through `screens/S19_*.png` at the reference frame; record per-page deltas and fix them.
- [ ] Verify compact layout on a phone ≤700 dp high, landscape rotation during capture, sheet dismissal, TalkBack, light/dark contrast, reduce motion, and 60 fps gesture behavior. Compact mode is implemented in source; physical layout is unverified.
- [ ] Exercise the primary end-to-end flow with a real PDF and real microphone recording against a running backend; confirm saved audio, transcription, per-slide feedback, overall score, Q&A, and recovery paths.
- [~] After the compact-layout changes, `npm run typecheck` and `npm run lint` pass. `npm test` reports 515 passed and 62 failed of 577. Failures include old `score-ring` UI assertions, Node test-loader/native-module import errors, and UI assertions/runtime failures not yet individually reconciled. The suite is not green. `npm run bundle:android`, the arm64 Gradle release build, and APK v2 signature verification pass. See `docs/ai-use.md` for the recorded result.

## Part 2 — Backend checklist

| Backend area | Checklist | Evidence and gap |
| --- | --- | --- |
| **PDF/decks** | [x] upload, persistence, extracted slide text/images, ordered deck response | `backend/rehearsals/views.py`, `services/storage.py`, deck routes in `urls.py`; API contract documents 50 MiB. Runtime API test not run in this environment. |
| **Recording upload** | [x] UUID attempt identity, strict event schema, zero-based slide index, integer ms, start-at-zero and chronology checks, duration bound | `serializers.py`, `views.py`, `services/storage.py`, `limits.py`. Contract and focused test files cover retries/conflicts; this audit did not execute them. |
| **Processing/recovery** | [x] explicit process endpoint, Celery job, status/revision/failure/retry and recovery worker paths | `views.py`, `tasks.py`, `services/processing.py`; provider work remains server-side. Live worker/Redis/PostgreSQL behavior is not verified here. |
| **Transcription/alignment** | [x] backend provider adapter, normalized word timestamps, slide visits aligned on capture time, repeated/backward visits preserved | `services/transcription.py`, `services/alignment.py`, processing service and API contract. Real provider credentials/audio were not exercised. |
| **Presentation context** | [x] context create/read/update and 60–1,800 second duration validation | `presentation_context_views.py`, context model and mobile client. Blank audience is intentionally treated as missing for AI readiness. |
| **Slide profiles/cues** | [x] profile read/generate/retry, cached must-cover and further-insight items; [~] progress and labels | `slide_profile_views.py`, `services/slide_profiles.py`, `services/feedback_provider.py`. Job state is deck-wide, no per-slide progress; generated cue schema has no short card-label field. |
| **Slide review / feedback** | [x] durable jobs, bounded findings, categories, observation/suggestion, speech quote and original time evidence; [~] metric granularity | `slide_review_views.py`, `feedback_views.py`, `services/coaching.py`, `services/feedback.py`. Non-timing numeric values are not a general finding field; `suggestion` is advice and may not be replacement speech. |
| **Presentation score** | [x] validated overall/per-slide scores, level/status, evidence and recovery routes; [~] combined run overall | `presentation_score_views.py`, `services/presentation_scoring.py`, `services/presentation_score_v2.py`. Composite runs have no overall score; clients must not derive a grade from a score number. |
| **Audience Q&A** | [x] question generation, durable question/answer routes, answer transcript and review; [~] verdict set | `qa_views.py`, `durable_qa_views.py`, `services/qa.py`. Supported verdicts are `answered`, `partly`, and `too_short`; `missed` is absent. |
| **Notifications / wait estimate** | [ ] not implemented | No notification endpoint/push worker or defensible wait-time estimate. The UI cannot truthfully promise “we’ll tell you” or an ETA. |
| **Cue summary labels** | [x] client fallback implemented; [~] no short-label field in API schema | `CueGuidancePanel.tsx` derives the card label from the cue's first clause when the API omits a short label, as the spec directs. A dedicated backend field is not required for current UI behavior. |
| **Access / account ownership** | [~] shared reviewer access, not per-user data isolation | README/API contract describe a shared reviewer workspace. Separate application accounts and per-user ownership are not implemented. |
| **Migrations and live services** | [ ] not verified in this audit | Django is not installed in the active Python environment (`ModuleNotFoundError: django`); Docker CLI is unavailable (`command not found: docker`). The backend `check`, test, and migration-check commands could not execute; PostgreSQL, Redis, Celery, and provider integration were not exercised. |

### Backend check commands and outcome

- `python manage.py check --settings=config.test_settings` — **not run to completion:** Django is not installed in the available Python environment.
- `python manage.py test --settings=config.test_settings` — **not run to completion:** same missing Django dependency.
- `python manage.py makemigrations --check --dry-run --settings=config.test_settings` — **not run to completion:** same missing Django dependency.
- `docker compose ps` — **not available:** Docker CLI is not installed, so the real PostgreSQL/Redis/worker stack could not be checked.

## Audit conclusion

- **Frontend:** all 19 screen routes or corresponding flows are represented in source. This pass fixed the compact source layout and earlier identified screen mismatches. Gesture migration, shared-component coverage, test failures and device comparison remain open; exact 1:1 visual fidelity is **not established** without device comparison.
- **Backend:** the core upload, processing, scoring, feedback, cues, and Q&A API paths exist by source inspection. Known API/product gaps are listed above. Backend automated and live-service verification remains **blocked by the unavailable Django/Docker runtime in this environment**.
- This checklist is an audit result, not a declaration that the app or all checks pass. Resolve each **[~]** and **[ ]** item or record an explicit product/backend decision before claiming complete conformance.

### Samsung device pass (November 7, 2026)

- Samsung Galaxy S22 (`SM-S901N`, `R3CW60FCQXL`) was connected. The earlier clean APK installed and launched after fixing its missing `MainApplication` DEX entry.
- Exercised Home theme toggle in both directions; opened a deck and entered Rehearse; opened Review and observed the first-run Waiting screen; opened Listen Back. The prior saved run's playback button advanced the audio timer and changed to Pause. Go Home returned to the carousel. These checks verified navigation and playback for the installed build; they do not verify microphone recording or backend processing.
- Device captures showed an unintended deck-blue wash across Home, Rehearse, Waiting, and Listen Back. The cause was deck-tinted full-screen artwork in `PageSurface`. Source now uses the neutral theme background on pages and only attaches Home ambient artwork on Home/Add Presentation. Rehearse's “Play saved slide audio” text also overlapped the cue cards; source now exposes that action as a labeled header button.
- The updated source passed `npm run typecheck` and `npm run lint`. A clean arm64 release build succeeded. The copied artifact is `output/OutLoud-UI-overhaul-issue49.apk`, SHA-256 `8f2cc88bfe107a8284667f4a72aece312e280cb89a091e529deb623d3a1a1761`; APK v2 signature verifies, and `MainApplication` is present in `classes4.dex`.
- The updated APK installation is currently paused at Samsung Play Protect. The previous installed build remains the one exercised above; the two visual fixes have not yet been rechecked on-device. Remaining screen and control paths, all-19 screenshot comparisons, real recording, rotation, TalkBack, and the unavailable backend-dependent results remain open.

### Medium-phone defect pass — November 7, 2026

This later pass supersedes the previous paragraph's Play Protect/install status: the corrected build was installed and exercised on the Samsung Galaxy S22 (`SM-S901N`, logical viewport 360 × 780 dp). Current APK: `output/OutLoud-UI-overhaul-issue49.apk`, SHA-256 `46be7fcc20e525d71cd17eb4cdc878fe87a31ff7ede6f50e0ff18b58fc50fcad`.

**Fixed and checked on device:** smooth Home glow without bitmap crop edges; compact Home and Rehearse proportions; duplicate Upload heading; cue cards opening the offline explanation sheet; cue-sheet swipe dismissal staying on Rehearse; slide rotation and return to normal; setup dial visual centering; tutorial paging/close; icon picker open/close; theme toggle; PDF picker open/back; full-screen background on Home/Upload/Wait.

**Automated build checks:** `npm run typecheck` and `npm run lint` pass; arm64 release build and APK v2 signature verification pass. `npm test` remains failing (515 passed, 62 failed of 577); native-module test-loader errors and untriaged UI assertions/runtime failures remain. Do not treat this as a passed suite.

**Still not signed off:** all-19 reference screenshot comparisons; selecting and processing a real PDF; microphone recording; complete Review/Feedback/Listen Back/Compare/Q&A flows; setup dial adjustment gestures; accessibility/TalkBack; backend/Django/PostgreSQL/Redis/Celery/provider checks. No backend code changed. Therefore this pass fixes the reported device defects and verifies representative interactions, but does not establish exact 1:1 conformance or that every function works. See `docs/ai-use.md` for task-level AI-use and build evidence.

### Portrait fullscreen / PDF stuck-state follow-up — November 8, 2026

This follow-up supersedes only the PDF-processing, Rotate, and record-ring items called out above; it does not sign off the full audit.

- **PDF analysis:** mobile PDF import caps optional server text extraction at 20 seconds and profile status waiting at 25 seconds. On an unavailable server, the locally parsed deck advances to Setup. On-device test with the bundled 7-slide sample reached Setup about 28 seconds after the “Reading the text” screen. This did not complete Setup/save or validate backend processing.
- **Fullscreen rehearsal:** Rotate now presents a readable landscape-shaped slide inside the portrait app viewport. Android is configured and runtime-locked to portrait. The top-right cue button opens a cue sheet; the bottom-right button returns to regular portrait rehearsal. Both transitions were exercised on device.
- **Record alignment:** the fullscreen record hit target now matches the reusable button's 84 dp artwork, with a dynamically scaled ring centered around it and the redo hint below. Device screenshot verified alignment on the 360 × 780 dp Galaxy S22.
- **Build:** final APK `output/OutLoud-UI-overhaul-issue49.apk`, SHA-256 `c4a6b843ae9ecf3ce1e496e06b28c4998df9b209745e8053c5df336f8a05eb32`; arm64 Gradle release build and APK v2 signature verification passed. `npm run typecheck` and `npm run lint` passed. `npm run check` still has JS-suite failures, including native-module test-loader errors and untriaged UI assertions.
- No backend source or API contract changed. Django and live backend services were not tested. The 19-screen comparison, recording/microphone flow, full Review/Q&A flows, TalkBack, and other audit gaps remain open. No commit or push was made.

### Fixed fullscreen canvas and popup styling — November 8, 2026

This follow-up closes the specific Rotate, cue-panel, fullscreen record-control, and redo-dialog defects in the latest Samsung captures. It does not complete the overall frontend/backend audit.

**Frontend items checked on Galaxy S22 (`SM-S901N`, 360 × 780 dp):**

- [x] Rotate selects an explicit, fixed landscape-style canvas; Window Manager still reports portrait dimensions and `ROTATION_0` while it is active.
- [x] The upper-left control exits fullscreen to portrait rehearsal. Android Back is consumed while fullscreen so it does not accidentally switch the mode.
- [x] The cue button opens a panel that slides in from the logical right edge, matching S07; the close control dismisses it.
- [x] Fullscreen center record button uses neutral styling; the portrait rehearsal button retains the red redo treatment specified for S05.
- [x] Redo confirmation is a centered shared OutLoud dialog. Device check opened it and Cancel preserved the prior saved take.
- [ ] Physical handset rotation sensor was not exercised; orientation independence is based on the portrait lock, fixed canvas state, and Window Manager `port`/`ROTATION_0` report.
- [ ] Full 19-screen pixel comparison, microphone recording, and independent human visual review remain outstanding.

**Backend checklist:** no backend source, endpoint, schema, or migration changed for this fix. Django checks, PostgreSQL/Redis/Celery, and provider integration were not run as part of this follow-up. Existing backend audit gaps above remain open.

**Automated/build checks:** TypeScript and lint passed cleanly; Android export and arm64 Gradle release build passed; APK v2 signature verification passed. `npm test` remains failing: 515 passed, 62 failed of 577; failures are not marked as resolved by this UI work.

**APK installed and handed off:** arm64 `output/OutLoud-UI-overhaul-issue49.apk`, SHA-256 `d58bf535bbacfada3fb46dfd7471b4d3ff4f06e0a81648959e5451a25722ce01`. No backend change note is needed beyond this recorded “none changed” finding.

### Edge-to-edge canvas and return-control follow-up — November 8, 2026

- [x] Landscape canvas now sizes against the full app viewport without safe-area inset gutters.
- [x] Removed the upper-left exit control; return-to-portrait is now the bottom-right corner control.
- [x] Installed the rebuilt APK and verified on the Samsung that the lower-right control returns to the portrait rehearsal screen. Android remained portrait locked.
- [x] Android bundle, arm64 release build, and APK v2 signature verification passed.
- [ ] The physical handset was not turned during this check. The landscape card retains the reference's inset 16:9 slide proportions; the app canvas itself fills the viewport.

Latest APK SHA-256: `b8285ff509bdfefdf1d72158945e881cc66e10c1a0a51c0812b61c8c939d87d7`. `npm run check` remains non-green (515 passed / 62 failed of 577); failures remain untriaged. Backend files and API contract were not changed.

### Home header alignment follow-up — November 8, 2026

- [x] Home wordmark and both header controls share a vertical center at y=75 dp in the design frame.
- [x] Tutorial ring set to 22 dp, matching the theme toggle's inner moon/sun diameter (about 22.3 dp at 42 dp icon size).
- [x] Typecheck, lint, Android export, ARM64 release build, and APK v2 signature verification passed.
- [ ] Visual check on the Samsung remains pending: the newly installed app is covered by the Google Play Protect first-install prompt. Auto-review rejected dismissing it because that selects “Don't send”; no alternate dismissal was attempted.

Latest APK SHA-256: `28e693e300312d786671fadba1be92c2794e71f0ae30161da0cef3819b44698b`. JS tests remain non-green (515 passed / 62 failed of 577). No backend code changed.
