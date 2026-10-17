# PR 31 entry, import, and capture inventory

Source snapshot: `/private/tmp/outloud-pr31-f1af9dd`, commit `f1af9dd9737e2ac9adbe8a45186f0e2722863e60`. Read-only source inspection; these are implementation-backed wireframes, not screenshots or runtime/device verification.

## Route and scope boundaries

- Actual route union: `home`, `upload`, `rehearse`, `review`, `full`, `compare`, `qa` (`mobile/src/screens/shared.ts:12-14`); switch renders their screens (`mobile/src/screens/AppShell.tsx:142-149`).
- No separate Settings, Library, Login, Dashboard, onboarding, preflight screen, or PDF content/canvas editor route. Home serves as the presentation library. Time/audience setup is an overlay, also used during import. Slide-description fact editing occurs within `TakePlayback.tsx:288-325` (other inventory scope).
- App keeps underlying Home and earlier screens mounted, presents layers, and hosts global provider dialogs (`AppShell.tsx:106-132`). Android system Back delegates to each active screen (`shared.ts:42-50`).

## H01 — Home / presentation carousel

Wireframe regions, top to bottom:
1. Header: stopwatch brand/About button at left, OutLoud wordmark, Light mode switch at right (`HomeScreen.tsx:281-285`, `ThemeToggle.tsx:28-42`). Theme switch appears on Upload too (`UploadScreen.tsx:204`).
2. Large horizontally spinning carousel: front deck title; slide count and ordinal; colored presentation icon; ghost/adjacent deck cards. Tap adjacent card centers it; tap front deck opens Rehearse at slide 1 (`HomeScreen.tsx:133-150`, `86-94`, `384-394`).
3. Selected deck summary: overall score ring, Last run / No runs yet, total findings, duration, wpm/pace; aggregate status such as pending, outdated, retry, partial, insufficient evidence, not analyzed (`HomeFeedbackStats.tsx:27-42`). With a saved run, tapping score area opens Full review from Home (`HomeScreen.tsx:260-263`, `309-311`).
4. Pagination dots and gesture legend: Spin, Open, Icon, Add, Delete (`HomeScreen.tsx:497-510`).

States/overlays:
- Empty: New presentation icon/title, New ordinal, and hints Tap to add / Add (`HomeScreen.tsx:439-455`, `505-510`), tap opens Upload (`133-145`).
- Add gesture: pull up → Release to add presentation → Upload (`469-470`, `90-94`).
- Delete gesture: pull down and hold → progress ring/bin, Keep holding to delete; last remaining deck says Keep at least one presentation (`461-490`). Deletion is blocked when deck count <=1 (`103-104`). Undo toast `Deleted “{title}”` persists 4.5 seconds and Undo restores it (`103-120`, `314`).
- Long press selected icon → Icon picker bottom sheet. Title Choose an icon + deck title, grid of presentation icons with current selection dot; tap changes icon and closes; tap backdrop/swipe down/Back closes (`151-160`, `515-553`).
- About overlay: four contributor names; tap backdrop or Back closes (`318-325`, `251-255`). No settings list.

## U01 — Add your presentation / file picker

- Large upload icon hit area; Add your presentation; Tap the icon to upload; PDF · up to 50 MiB · any slide count; theme switch; swipe down to go back (`UploadScreen.tsx:165-173`, `202-204`).
- Tap opens native PDF file picker; while opening label reads Opening your files…; cancellation returns to pick. Picker/import error replaces subtitle, tinted error (`58-68`, `84-92`, `171`). Native picker itself is OS UI, not an app-designed screen.
- Swipe down or system Back returns Home. It aborts in-flight import and discards temporary import (`46-55`, `106-144`).

## U02 — Import analysis progress

- Large circular progress ring; percentage; current status (initially Rendering slides, eventually Ready); file name and slide count; 3 stage icons/labels Slides, Text, Timing; offline text warning; swipe down to cancel (`UploadScreen.tsx:153-156`, `175-202`).
- Successful analyze moves to configure and renders PresentationRequirementsEditor; failed analysis clears progress and returns U01 with error (`73-91`, `206`).

## P01 — Presentation time & audience setup/edit overlay

- Header deck title + {n} slides (`PresentationSetup.tsx:77-81`).
- How long is your presentation? Large selected time / No time limit; draggable tick ruler 1–30 minutes in 30-second increments; labels 5/10/15/20/25/30; No required time (`21-26`, `55-68`, `82-96`).
- Do you have a target audience? Chips Students, Teachers, Colleagues, Clients, General audience, Other…; No target audience (`26`, `98-113`).
- Other activates multiline Describe your audience input, current character count /500, Done button when keyboard shown. Scroll viewport shrinks above keyboard (`39-53`, `109-112`).
- Confirm circle/check Save presentation time and audience; swipe down to go back (`119-125`). Initial import defaults 5:00 and General audience (`191-192`).
- Validation error: Use a time from 1–30 minutes and an audience of at most 500 characters (`55-57`). Save errors/pending sync appear above confirm (`115-117`, `188-195`). Conflict disables ordinary Save and adds Use server / Keep mine (`195-198`).
- Import Save → Rehearse slide 1 (`UploadScreen.tsx:95-104`). Rehearse Edit time & audience → this overlay; Save/Back closes onto Rehearse (`RehearseScreen.tsx:161-166`, `461-464`, `510-511`, `397-398`).

## R01 — Rehearsal ready / idle

- Deck title, Slide {current} of {n}; Edit time & audience link (`RehearseScreen.tsx:455-464`).
- Large PDF slide card with previous/next folded corners; horizontal slide swipes and accessible previous/next controls (`530-615`). Tick strip offers direct approximate slide jump (`654-674`).
- Cues panel under PDF: Cues header + slide-audio play/pause button; two columns Must Cover / Further Insight; scrollable cue cards; each has Details / Hide details with source premises and optional To clarify (`CueGuidancePanel.tsx:30-85`).
- Large elapsed clock at 0:00; Full run · target {duration} on first slide / Record slide {n} otherwise; idle waveform (`RehearseScreen.tsx:696-705`).
- Bottom controls: Rotate, microphone/redo button, Review; Tap to record and Home (swipe down) hints (`490-507`). Review disabled until run exists and during recording/count (`495-498`).
- Cues audio plays selected slide segments; missing local audio notice (`341-350`, `475`).

## R02 — Countdown, recording, stop, completion

- New record tap → 3/2/1 countdown with shrinking ring; Get ready…; Tap to cancel returns idle (`253-267`, `306-314`, `423-431`, `697`).
- Starting stage prepares microphone/capture; controls disabled and slide navigation frozen. Native microphone permission may appear; denial surfaces Microphone permission was denied. in idle error text (`RehearseScreen.tsx:232-251`, `505`; `features/recording/service.ts:50-52`). This is OS permission, not an app modal.
- Recording: stop glyph/button; live elapsed time, current-slide elapsed of target; pace chip and live waveform; Tap to stop / Swipe slides. Slides can move forward/back during actual recording (`292-304`, `423-431`, `686-694`, `200-219`).
- Tap stop → stopping stage, frozen navigation/disabled record control; successful capture → transient Run complete/confetti, then review route or Compare (`270-289`, `505`, `521`).
- Review destination depends saved take count: **exactly first saved take → Full review; later takes → current-slide Review**, except redo compare takes priority (`domain/run.ts:143-146`, `RehearseScreen.tsx:155-159`, `277-281`).
- Start/stop failures show error line on idle screen; engine remounts (`244-250`, `282-288`, `697-704`).

## R03 — Rotate PDF view variant

- Rotate changes only PDF orientation for bigger view; switches right Review control to elapsed Time, rotates counter/record glyph/captions; hides tick strip/cues and conventional large readout; keeps waveform, compact status, previous/next controls (`RehearseScreen.tsx:458-505`, `607-615`, `620-651`).
- Button label Return the PDF to normal view; Back first restores normal view (`397-399`, `490-492`).

## R04 — Redo dialogs

- Recorded slide mic is redo. Tap → Redo slide {n}? Body explains recording/transcript replacement, compare and old-take retention. Actions Redo and Cancel (`306-314`, `512-517`).
- Holding mic 3 seconds when any run exists → Redo the whole presentation? Body recording starts slide 1 and compare with current run. Redo all / Cancel (`315-339`, `512-517`). Confirm → countdown; whole redo moves slide 1.
- Existing pending compare routes immediately to Compare when opening deck (`91-97`).

## R05 — Interrupted capture recovery entry

- Idle readout can replace normal hint with Recording interrupted [x of n] · tap to inspect; tap opens TakePlayback overlay for recovery; closing cycles next interrupted attempt (`184-192`, `481-483`, `522-523`, `697-704`).
- Recover/use recording commits it and routes to first/full or later/slide review, or Compare as needed (`434-444`). Recovery inspector design is in TakePlayback inventory.

## Cue states and dialogs

- Common panel state: Requesting AI cues…; error → Refresh AI cues button; unavailable offline; stale/outdated → generate; previous-format saved cues → Generate updated guidance; absent → not generated/generate; disabled/server unavailable/source unavailable/failed/needs confirmation; empty category messages distinguish no essential points, no additional suggestions, not enough readable evidence (`CueGuidancePanel.tsx:25-28`, `55-61`; `slideProfiles.ts:77-91`).
- Requirements notices: saved on phone/sync pending, choices conflict, targets use last synchronized time (`RehearseScreen.tsx:474`).
- Retry AI cues? warning about uncertain provider outcome and another charge; Retry / Cancel (`519-520`).

## Global provider permission/retry dialogs

- Transcribe with ElevenLabs? disclosure: saved audio + slide vocabulary hints via OutLoud server; Continue permits future automatic transcription; Cancel. Alternate Retry may charge again dialog for uncertain prior request (`AppShell.tsx:175-187`).
- AI suggestions from {provider}? disclosure: slide images/text/descriptions/transcript/audience via server, no audio; possible charges. Alternate Request again? warning. Continue / Cancel (`AppShell.tsx:190-197`).

## Source-backed versus inferred presentation

Every item above is from UI/state implementation. Drawing phone cards, diagram arrow positions, grouping states, and sample deck titles/times are editorial wireframe choices. No physical-device rendering, permission flow, backend processing, native picker appearance, provider success, or live network behavior has been exercised in this inventory.
