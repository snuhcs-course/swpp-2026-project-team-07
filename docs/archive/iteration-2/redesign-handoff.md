# OutLoud redesign (October 14, 2026)

This folder is a copy of the team repository with the mobile UI rebuilt from the OutLoud design prototype (`OutLoud — Android App Prototype`). Every earlier screen, component and gesture layer was removed, including the Iteration 2 gesture redesign. The app's functions were kept: PDF import, capture, local storage, upload, hosted transcription, AI feedback and the backend. The new screens are wired to those functions.

## Run it

```bash
cd backend            # unchanged setup; see backend/README.md
cd ../mobile
npm install
npm run android       # a new dev build is required (new native modules below)
```

The redesign adds these native modules, so an existing dev client will not load the bundle until you rebuild it:
- `react-native-svg`
- `react-native-pdf-thumbnail`
- `expo-haptics`
- `expo-speech`
- `expo-font`

Fonts are Bricolage Grotesque and Figtree, bundled through `@expo-google-fonts`.

`npm run check` runs typecheck, lint and the Node tests.

## Screens and what they use

| Screen | Design behaviour | Real function behind it |
|---|---|---|
| Home | Cover-flow carousel with stationary icons at rest, stats panel, dots. Tap fades into the presentation; hold picks an icon; pull up adds; pull down and hold 3 s deletes, with undo. Presentations are numbered by their visible position. | `pdfService` catalog, `savedAttempts` (a PDF that saved takes still need is kept), presentation store (`features/presentations/store.ts`) |
| Upload | Gap in the blurred carousel with the new icon kept sharp, three-stage progress ring, swipe down to cancel. | `pdfService.importPdf`; pages are rendered on the device with Android PdfRenderer; slide text comes from the server's extraction (existing `POST /decks/`); per-slide targets are set from the amount of text |
| Rehearse | Slide track with folded corners, tick strip, red record button with 3-2-1, long-press to redo all, pace chip, waveform, cues, and slide-specific transcript panel. Tapping transcript words plays the selected sentence without a separate take control. | `CaptureEngine` (recorder-clock slide events and 1 s checkpoints), `uploadAttempt`, `useAttemptAnalysis` (Whisper), `transcriptSpans` |
| Compare | Current and new recordings side by side; select **Keep current** or **Overwrite**, then confirm. | Run composition (`domain/run.ts`). The new recording remains pending until the choice; the active run points to one recording per slide. |
| Review | Total vs target, chips, tip, per-slide bars, findings, strongest and weakest slide, fillers, and explicit AI suggestions. Tapping the existing slide preview opens recording details for recovery and slide descriptions. | Merged transcript and timing; validated media recovery; AI suggestions through `useFeedbackReview`, with generation requested only when tapped |
| Audience Q&A | Panel questions read aloud, answer, verdict, follow-up. | New backend endpoints (below); text-to-speech via `expo-speech` on the phone |

## How takes become a run

Each recording is a normal saved attempt, which is uploaded and transcribed as before. A presentation's run maps each slide to the take that last covered it. A slide counts as spoken in a take after 0.7 s of speech-level microphone input on it, and the start slide always counts. Redo-all replaces the whole run.

## Where the app differs from the prototype

- Transcript lines appear when hosted Whisper finishes, not live while you speak. During recording the panel shows the timer, pace and waveform.
- A merged run can use different recordings on different slides. One selected recording supplies each slide; the transcript plays its matching audio sentence. Backing audio can remain stored when another slide still needs it. Unselected uploads are not deleted from the server because this API has no attempt-delete endpoint.
- Slide titles, cues and key-point coverage need the slide text. The server reads it, so a PDF imported offline gets it the next time the server is reachable.
- Audience Q&A and AI suggestions use the server's feedback provider. When `FEEDBACK_ENABLED` is off, the app says so instead of showing sample questions.

## Backend change: Audience Q&A

The backend adds two endpoints. There are no model or migration changes; details are in `docs/api-contract.md`.
- `POST /api/decks/{id}/qa/questions/`
- `POST /api/decks/{id}/qa/answers/`

They reuse the feedback provider settings: `FEEDBACK_ENABLED`, provider, model, key, project id and RPM/TPM. Answer audio goes to hosted Whisper. Nothing is stored on the server.

Known limit: these calls do not create quota reservations, so they are not counted in the RPM/TPM windows. They do respect and set the provider cooldown.

Files:
- `backend/rehearsals/services/qa.py`
- `backend/rehearsals/qa_views.py`
- `backend/rehearsals/urls.py`
- `backend/rehearsals/test_qa.py`
- `backend/rehearsals/services/feedback_provider.py`: two small public helpers added at the end.

## Code map (mobile)

- `src/design/`: tokens, icons (generated from the design bundle), the scaled 390 × 844 frame, slide cards, shared controls, `PanView`
- `src/domain/`: pure rules from the spec (formatting, hues, filler words, coverage, slide targets, run merging, transcript lines, findings, gestures), all unit-tested
- `src/screens/`: the six screens and the shell that keeps the carousel and ambient glow mounted
- `src/features/presentations`, `rehearsal`, `qa`: the new glue between screens and the existing services

The original services and storage are unchanged apart from these additions.

## Verification

Checks performed during the initial redesign build (before the later device work):
- `tsc`, `expo lint` and the Node test suite (168 tests, including new tests for capture, run merging and comparison, and the Q&A client)
- `expo export --platform android` (the JavaScript bundle builds)
- Backend on SQLite test settings with Python 3.13: `manage.py check`, `makemigrations --check` (no changes) and the full suite (286 tests, 19 skipped, including 9 new Q&A tests)
  - The torch/Silero speech-gate packages were not installed for this run.
  - The PostgreSQL-only tests were skipped.

Not done:
- A device build and on-device check of the visuals and gestures. Do that first after `npm run android`.
- Live provider calls for Audience Q&A. The tests use synthetic provider responses and a fake Whisper.
- A run on CI's PostgreSQL/Python 3.12 setup.

This folder has no `.git` metadata. To publish it, copy the changes into a clone of the repository on a new branch and open a pull request.

### Playback and full-screen update, October 14

The redesign now exposes the original recording-review functions in its own Home and Review flow: saved-take playback with transcript and slide-visit seeking, upload/transcription recovery, explicit AI feedback, slide-description editing, and server history for presentations already known on this phone. Opening playback validates audio first; PDF validation runs only when PDF offline tools are opened. The visible Home position supplies presentation numbers after deletion. The ambient glow renders behind the scaled screen frame and crossfades without moving a rectangular layer. The icon picker applies a static blur to the underlying Home layer.

Agent-operated checks: TypeScript and uncached ESLint on the changed mobile files passed; `app:assembleRelease --offline` passed and included the final JavaScript bundle. An intermediate release on the connected Android phone visibly filled the previous dark side and system-bar margins with the ambient glow. The requester authorized interrupting a recording, and the final APK installed in place successfully. Its process launched, but the phone was locked during the first screenshot; icon-picker blur, end-to-end playback/transcription, server history, live provider calls and the final-build gesture smoothness have not yet been checked on device. No app tests were run for this update.

### Presentation-screen follow-up, October 14

The Home saved-recordings shortcut was removed. Each presentation now shows local saved takes and cached server takes in a horizontal row below the slide and transcript, above Record/Redo. Opening a take reveals playback and recovery controls as a sheet over the same presentation. Both the presentation transcript and saved-take transcript are scoped to the selected slide. The recording service already stores recorder-clock slide-change events; transcript sentences are now split at the first word whose timestamp falls after each saved slide-change boundary. Older manual sentence edits that cross a new slide boundary remain stored, but need review on the resulting slide fragments. Home icons use a small UI-thread vertical float that pauses off Home and respects reduced-motion preferences. Opening a presentation fades in; the add flow blurs existing carousel cards while keeping the new icon sharp.

The phone's API target was corrected from the emulator-only address to USB-forwarded loopback. A release network policy permits only local development HTTP hosts; debug resources retain Metro LAN HTTP access. The local backend was offline during device checks, so upload reached `127.0.0.1` but transcription could not complete. After the final release APK was installed, the phone showed the saved-take row on the presentation and a saved take played from its sheet while the visible slide advanced to the recorded visit. A brief extra take was saved during device interaction and left intact; the app is no longer recording. TypeScript, uncached ESLint, plugin syntax/JSON checks and `app:assembleRelease --offline --quiet` passed after the changes. Live transcription, add-page blur and human smoothness remain unverified.

### Recording-choice follow-up, October 14

The take row between the transcript and timer has been removed. Tapping transcript text plays the selected sentence's audio without an extra playback button. The existing Compare screen offers Keep current or Overwrite; a retake remains pending until one is chosen, including after reopening the presentation. The active run keeps one selected audio source per slide. Underlying recordings needed by other slides remain stored, and already uploaded recordings cannot be deleted through the current backend API. In Review, the existing slide preview opens recording details for media recovery and slide descriptions; this sheet no longer has separate playback buttons or slide-visit controls, and its timed transcript words start playback directly. If a capture is interrupted, the existing status beneath the timer opens those details for recovery. A recovered capture joins the active run or goes through the same keep/overwrite choice.

Final agent-operated checks for this follow-up: TypeScript, uncached ESLint on affected mobile source and the offline Android release build passed. The release APK installed in place on the connected Samsung phone, and the presentation screen visibly had no takes row or dark strip between the transcript and timer. The app process stayed running, with no fatal or JavaScript error in the inspected recent Android log window. The backend remained offline, so timed-word playback, interrupted capture recovery and the keep/overwrite choice were not checked end to end on the phone. No app test suite or human test was performed for this follow-up.

### Transcript playback icon, October 14

The current slide's transcript heading has a small play/pause icon on its right. It plays that slide's selected audio, including separate visits to the same slide, and is unavailable when the slide has no recording or capture is active. Sentence and timed-word playback remain available through transcript text.

TypeScript, uncached ESLint and the offline Android release build passed after the review fixes. The APK installed on the connected Samsung phone; slide 1 visibly showed the small icon at the right edge of its transcript heading. A tap check did not establish actual audio playback because the next phone screenshot was on Home. Live transcription remained unavailable while the backend was offline. No app test suite or human test was run for this update.

### Home idle motion removal, October 14

The repeating Home icon float, its synchronized shadow pulse and the new-presentation preview float were removed. Cards remain still at rest. Spin, pull, press, add and delete interactions retain their gesture-driven motion; the existing fade into a presentation remains.

TypeScript, uncached ESLint and the offline Android release build passed. The release APK installed on the connected Samsung phone; two Home screenshots taken several seconds apart showed the icon and shadow in the same position. Gesture flows were not rechecked on device, and no app test suite or human test was run for this update.
