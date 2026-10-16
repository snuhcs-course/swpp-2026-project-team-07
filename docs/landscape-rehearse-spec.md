# Landscape Rehearse ("rotate for a bigger slide"): implementation spec

Prepared with Claude (Anthropic) on 2026-10-15. Every value comes from the OutLoud gesture prototype (`Main.dc.html`, Claude Design artifact, version 88): the "3 · Rehearse" and "3b · Rehearse — landscape" boards.
The artifact is private, so do not try to open it.

Target: `mobile/src/screens/RehearseScreen.tsx` and the shared design files. Sizes are in design-frame units: portrait 390 × 844, landscape 844 × 390.
Icons: `docs/spec-icons/rotate-to-landscape.svg` and `docs/spec-icons/rotate-to-portrait.svg`.

## 1. What changes

1. **Rehearse is the only screen that rotates.** Every other screen stays locked to portrait.
2. **Portrait Rehearse.** The Cues button at the bottom left becomes a Rotate button.
   - Remove the cues feature from the screen for now: the button, the cue chips and the `cues` state.
   - Keep `domain/slides.cuesFor` and its tests; nothing else uses them.
3. **Landscape Rehearse.**
   - The slide fills the screen except for a right-hand rail.
   - The rail holds a Timer button, the red record button (same icon and function) and a Rotate-back button.
   - The ambient fade covers the whole landscape screen.

## 2. Orientation behaviour

| Situation | Behaviour |
|---|---|
| App start and every screen except Rehearse | Locked portrait (`PORTRAIT_UP`) |
| Entering Rehearse | Follows the device (`OrientationLock.DEFAULT`). It respects the system auto-rotate setting. |
| Tap Rotate in portrait | Lock `LANDSCAPE`. The UI turns landscape at once, even when auto-rotate is off. |
| Tap Rotate in landscape | Lock `PORTRAIT_UP` |
| How long a button lock lasts | Until the next Rotate tap or until the user leaves Rehearse |
| Leaving Rehearse (any navigation, unmount) | Lock `PORTRAIT_UP` |
| Back gestures in landscape | Swipe-down-to-leave is off in landscape. The prototype allows leaving only after rotating back. On Android, the hardware back button in landscape does the same as Rotate (back to portrait); it does not leave the screen. |
| Recording across a rotation | Continues without a break. Slide index, recording, timers, waveform, takes and transcript all keep their state. |
| Swipe in progress at rotation | Cancel it and snap to the current slide, with no animation |
| Run finishes in landscape | Do **not** navigate to Review or Compare, because those are portrait screens. After the confetti, show the landscape note for 3.2 s: "Run saved · rotate back for your review", or "Take saved · rotate back to compare" for a compare take. The user stays on the slide. Review is then reachable from the portrait Review button. |

Implementation:

- **Dependency.** Add `expo-screen-orientation` with `npx expo install expo-screen-orientation`. It is a native module, so the dev client and the release APK must be rebuilt. Set `"orientation": "default"` in `mobile/app.json`, and lock portrait at startup in `_layout.tsx`. Native folders are generated, so do not commit `android/`.
- **Layout choice.** The landscape layout is used when `screen === 'rehearse'` and the window is wider than it is tall (`useWindowDimensions`). Do not use the lock value to decide.
- **One component.** Keep a single `RehearseScreen` that renders either layout from the same hooks and state. Do not remount `CaptureEngine` or the screen when the orientation changes (the screen is keyed `'r' + deckId`; keep it that way).
- **Frame.** `Frame` currently always scales a 390 × 844 canvas. Give it the landscape canvas (844 × 390) in landscape:
  - `s = min(width / 844, availH / 390)`, where `availH` and `availW` subtract the safe-area insets, including left and right cutout insets in landscape.
  - Centre the canvas.
  - The background stays full-bleed.

## 3. Portrait Rehearse changes

| Element | Spec |
|---|---|
| Rotate button | Replaces the Cues button at `left 49, top 690`. Use `RoundButton` (52 × 52) with `glyph="h-landscape"` (size 26, colour `text`) and caption "Rotate". `accessibilityLabel`: "Rotate your phone for a bigger slide". No active state. |
| Review button | Unchanged (`left 289`) |
| Header sub-label | The slide counter only, as before |
| Cue chips area | Removed. The transcript area shows as usual. |

## 4. Landscape layout (844 × 390)

Nothing else from portrait appears in landscape: no header, slide ticks, transcript, big timer, slide line, waveform or hint row.

### Slide stage

| Element | Spec |
|---|---|
| Stage | `left 0, top 0, width 664, height 390`, clips its children. The prototype also fades the stage's right edge to transparent over the last 34 units. That fade is optional and needs a mask view; skip it if none is available. |
| Slide | The normal `SlideCard` (358 × 202) scaled ×1.55 from its top-left corner and placed at `(58, 38)`. On screen it covers x 58–613, y 38–351. The face, right fold, page image and number stay as they are. The left fold is removed. Previous-slide corner taps work only when capture is not active; next-slide taps remain available during recording. |
| Swiping | Same gesture and `decideRelease` rules as portrait, with the card step set to **420** (unscaled) instead of `CARD_STEP` 374. Neighbouring slides then stay outside the stage. When the orientation changes, jump `trackX` to `-slide × step` for the new step. Backward swipes are disabled during active recording; slide navigation pauses during capture startup and shutdown. |

### Timer pill

Shown when the Timer button is on.

| Property | Value |
|---|---|
| Position | Right edge at x 597 (`right: 67` inside the 664 stage), top 54 |
| Shape | Row, gap 10, padding 7 / 10 / 7 / 14, radius 999 |
| Background | `hud` token: dark `rgba(10,10,13,0.74)`, light `rgba(255,255,255,0.84)`. The prototype adds a 12-unit backdrop blur; that is optional. |
| Elapsed time | Bricolage 700, size 26, line height 26, letter spacing −0.8, tabular figures, same colour as the portrait big timer. Idle shows `0:00` in `dim`. |
| Pace chip | Only while recording: the portrait pace chip at size 13 (padding 3 / 11 / 3 / 4, 22-unit icon) |
| Motion | Fades in over 160 ms |
| Touch | Ignores touches |

### Landscape note

| Property | Value |
|---|---|
| Position | Centred over x 58–613, top 54 |
| Style | Padding 9 / 16, radius 999, border `toastBorder`, background `toast`, text 14 semibold `text` |
| Motion | Fades in over 200 ms; hides after 3.2 s |
| Accessibility | `accessibilityLiveRegion="polite"` |

### Right rail

The rail's centre line is x 729.

| Element | Position | Spec |
|---|---|---|
| Timer button | `left 703, top 38`, 52 × 52 | `RoundButton` with `icon="i-timer"` (size 28). Caption: the elapsed time (11 semibold, `secondary`, tabular, no wrap). The tap toggles the Timer pill. When on, the active style is fill `rgba(255,216,102,0.18)` and border `rgba(255,216,102,0.45)`; when off, `surface08` and `border12`. Label: "Show the timer on the slide. {elapsed} so far" or "Hide the timer…". `accessibilityState.selected` follows it. Starts off. |
| Record ring | `left 673, top 139`, 112 × 112 | The same `RecordRing` (track, countdown and hold-to-redo progress) |
| Record button | `left 687, top 153`, 84 × 84 (centre 729, 195) | The same `RecordButton`, glyphs and handlers as portrait: tap to start or stop, hold to redo, 3-2-1 countdown |
| Rotate back | `left 703, top 282`, 52 × 52 | `RoundButton` with `glyph="h-portrait"` (size 26, colour `text`) and caption "Rotate". Label: "Rotate your phone back to portrait". |

### Overlays

| Element | Spec |
|---|---|
| Redo dialog | The same `Dialog`. The scrim covers the whole 844 × 390 frame, and the card is 360 wide, centred both ways. |
| Confetti | Origin `(729, 195)`, the record button centre. The portrait origin stays `(195, 716)`. |

### Ambient fade

The glow must cover the whole landscape screen, including behind the rail, with no dark band on the right. Keep the same hue cross-fade as portrait.

Prototype layers in frame units (wash is the large soft layer, core the brighter centre). Map them to `GlowLayer`; its full-bleed stretched image already covers this if it stays centred.

| Layer | Portrait | Landscape (centred on 422, 195) |
|---|---|---|
| Wash | 900 × 1100 at (−255, −228) | 1500 × 1100 at (−328, −355) |
| Core | 490 × 490 at (−50, 77) | 1060 × 620 at (−108, −115) |

## 5. Icons

Both icons are 24 × 24 outline glyphs, stroke 2, coloured with `currentColor`. The SVG files are in `docs/spec-icons/`.

**`h-landscape`** (portrait screen: rotate to landscape). A phone on its side, with the home bar on the right.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M18 10.5 V13.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
```

**`h-portrait`** (landscape screen: rotate back). An upright phone, with the home bar at the bottom.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/>
  <path d="M10.5 18 H13.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>
```

Add both icons to `GLYPHS` in `design/iconData.tsx`, and add the names to `GlyphName` in `design/icons.tsx`:

```tsx
'h-landscape': { viewBox: '0 0 24 24', body: (c: string) => <><Rect x="2.5" y="6.5" width="19" height="11" rx="2.5" fill="none" stroke={c} strokeWidth="2" /><Path d="M18 10.5 V13.5" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" /></> },
'h-portrait': { viewBox: '0 0 24 24', body: (c: string) => <><Rect x="6.5" y="2.5" width="11" height="19" rx="2.5" fill="none" stroke={c} strokeWidth="2" /><Path d="M10.5 18 H13.5" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" /></> },
```

The icons deliberately differ from the redo glyph (`g-redo`, a circular arrow), which sits on the record button.

## 6. Light mode

If `docs/light-mode-toggle-spec.md` is implemented, landscape uses the same tokens:

| Element | Tokens |
|---|---|
| Rail buttons | `surface08` + `border12` |
| Glyphs | `text` |
| Captions | `secondary` |
| Timer pill | `hud` |
| Landscape note | `toast` + `toastBorder` + `text` |
| Dialog | Dialog tokens |

The record button and the slide face do not change.

## 7. Acceptance checklist

- [ ] Home, Upload, Review, Compare and Q&A stay portrait when the phone turns.
- [ ] On Rehearse with auto-rotate on, turning the phone switches layouts.
- [ ] With auto-rotate off, the Rotate button still switches.
- [ ] Portrait Rehearse shows Rotate (phone-on-side icon) where Cues was. No cue chips remain.
- [ ] Landscape shows the slide at ×1.55 at (58, 38) and the rail at x 673–785: Timer, record, Rotate. Nothing else from portrait shows.
- [ ] Swiping changes slides in landscape, with no neighbour peeking beside the rail.
- [ ] Timer toggles the pill: elapsed time, plus the pace chip while recording.
- [ ] Start recording in portrait, rotate, keep talking, rotate back: one continuous take with correct per-slide times.
- [ ] Finishing a run in landscape shows confetti from the record button and the "rotate back for your review" note. It does not navigate.
- [ ] Android back in landscape returns to portrait and does not leave Rehearse.
- [ ] Leaving Rehearse re-locks portrait.
- [ ] The glow fills the whole landscape screen, rail included.
- [ ] `npm run check` passes. The rebuilt APK installs and runs on the phone.

## 8. Prompt for Codex

```text
Implement docs/landscape-rehearse-spec.md in mobile/. Follow AGENTS.md (including the prompt log).
Only Rehearse may rotate. Replace the portrait Cues button with the Rotate button and remove the cues UI
(keep domain/slides.cuesFor and its tests). Build the landscape layout, orientation rules and icons exactly
as specified, add expo-screen-orientation, and keep recording state continuous across rotation.
When done, run npm run check, rebuild and install on the connected phone, and walk the §7 checklist with
screenshots of portrait and landscape Rehearse (idle, recording with the Timer pill, after a run).
```
