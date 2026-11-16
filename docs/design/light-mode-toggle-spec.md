# Light mode and theme toggle: implementation spec

Prepared with Claude (Anthropic) on 2026-10-15. Every value comes from the OutLoud gesture prototype (`Main.dc.html`, Claude Design artifact, version 88).
The artifact is private, so do not try to open it. This file has everything needed.

Target: the Expo app in `mobile/`. All sizes are in 390 × 844 design-frame units, the same units `Frame` uses.
Icon file: `docs/spec-icons/theme-toggle.svg` (drawn at 0°; §4).

## 1. Rules

1. **Dark mode must not change.** The dark palette equals the current values in `mobile/src/design/tokens.ts` and the current literals in the screens. After this work, dark mode must look exactly as it does now.
2. **Light mode keeps the ambient fade from dark mode.** It uses the same glow image, tint, opacity and hue cross-fade. Only the base colour under it changes.
3. **Only neutral UI changes colour.** These stay as they are in both themes:
   - Slide faces and everything drawn on them.
   - Deck, avatar and slide-preview faces.
   - Chroma icons (`i-*`, `ic-*`).
   - The red record button, the green confirm button and the red dialog badge.
   - Hue glows and the status tint backgrounds.
4. **Do not reuse values from the earlier light-mode pass.** That pass is logged as "Whole-app theme toggle, October 15, 2026", and the requester reverted it. This spec replaces it. In particular:
   - No full-screen hue fill.
   - No raised ambient opacity.
   - No white carousel titles in light mode.
   - No title fade.
   - No white ground glow.
   - No black or hue-coloured percentage ring.
   - The leftover light-only expressions listed in §9 get replaced.

## 2. Behaviour

| Item | Spec |
|---|---|
| Themes | `dark` (default) and `light`. The choice applies to the whole app. |
| Toggle visibility | Shown on Home and on Upload, the screens with the OutLoud wordmark. Hidden while the icon picker is open. The current code shows it on Home only. |
| Tap | Switches the theme. The icon turns another 180°, clockwise every time. |
| Persistence | Use `writeStored('settings.theme', 'dark' \| 'light')` from `src/services/storage.ts`. Read it with `readStored` before the first frame, so a light-mode user never sees a dark flash. If storage throws or holds a bad value, fall back to `dark` without crashing. |
| Colour change | Colours switch immediately. The prototype also cross-fades colours over 420 ms ease. That fade is optional and must not delay the switch. |
| Reduced motion | The icon jumps straight to its end angle (`useReducedMotion`). |
| Status bar | `expo-status-bar` style is `light` in dark mode and `dark` in light mode. |
| Accessibility | `accessibilityRole="switch"`, `accessibilityLabel="Light mode"`, `accessibilityState={{ checked: mode === 'light' }}`. Touch target 44 × 44. |

## 3. Layout (Home and Upload)

| Element | Now | Spec |
|---|---|---|
| Wordmark row (`styles.logo`) | top 51, height 30 | top 57, height 36. Row centre y = 75. |
| Wordmark text (`styles.logoText`) | size 21, line height 22, letter spacing −0.4 | size 26, line height 27, letter spacing −0.5, colour `text`. |
| Toggle hit area | top 40, right 20, 44 × 44 | top 53, right 22, 44 × 44. Centre y = 75, the same as the wordmark. |
| Icon | 32 × 32 | 42 × 42 SVG, centred in the hit area. Its disc diameter is about 22, matching the wordmark height. |

## 4. Icon

The icon is drawn from the requester's reference image. The two pale outer half-rings around the moon are removed.

The SVG uses `viewBox="-525 -525 1050 1050"`. The origin is the disc centre, so rotation happens around the disc. Draw the shapes in this order:

| # | Shape | Values | Colour |
|---|---|---|---|
| 1 | Sun disc (full circle) | `cx 0, cy 0, r 278.5` | `#FFE550` |
| 2 | Moon half (left half, drawn slightly larger to cover the seam) | `d="M0 -279.5 A279.5 279.5 0 0 0 0 279.5 Z"` | `#9B9A96` |
| 3 | Small crater | `cx -89, cy -169, r 32` | `#78777C` |
| 4 | Hook crater | `d="M-121 -72 V-60 A57 57 0 0 1 -178 -3"`, stroke width 38, round cap, no fill | `#78777C` |
| 5 | Large crater | `cx -110, cy 101, r 54` | `#78777C` |
| 6 | Sun inner arc | `d="M189 76 A204 204 0 0 1 80 188"`, stroke width 34, round cap, no fill | `#FFD400` |
| 7 | Six rays at −75°, −45°, −15°, 15°, 45° and 75°, running from radius 425 to 488 | stroke width 74, round cap (paths below) | `#FFE550` |

```
M110 -410.5 L126.3 -471.4
M300.5 -300.5 L345.1 -345.1
M410.5 -110 L471.4 -126.3
M410.5 110 L471.4 126.3
M300.5 300.5 L345.1 345.1
M110 410.5 L126.3 471.4
```

At 0°, the moon is on the left and the sun on the right, as in the reference.

**Rotation.** The resting angle is `90° + 180° × n`, where n counts the theme changes. n starts at 0 in dark mode and 1 in light mode.
- Dark (90°): moon on top, rays pointing down.
- Light (270°): sun on top.

Animate with `withTiming(…, { duration: 560, easing: EASE_SCREEN })`. `EASE_SCREEN` is `cubic-bezier(0.2, 0.8, 0.2, 1)`. After an unmount and remount, start again from the angle of the current theme.

Reference component. Adapt it to the theme API you build in §10.

```tsx
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { EASE_SCREEN } from './tokens';
import { useTheme } from './theme';

const RAYS = ['M110 -410.5 L126.3 -471.4', 'M300.5 -300.5 L345.1 -345.1', 'M410.5 -110 L471.4 -126.3',
  'M410.5 110 L471.4 126.3', 'M300.5 300.5 L345.1 345.1', 'M110 410.5 L126.3 471.4'];

export function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const reduced = useReducedMotion();
  const turns = useSharedValue(mode === 'light' ? 1 : 0); // half turns since dark
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const next = turns.get() + 1;
    turns.set(reduced ? next : withTiming(next, { duration: 560, easing: EASE_SCREEN }));
  }, [mode, reduced, turns]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${90 + 180 * turns.value}deg` }] }));
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel="Light mode" accessibilityState={{ checked: mode === 'light' }}
      onPress={toggle} hitSlop={4} style={styles.hit}>
      <Animated.View style={spin}>
        <Svg width={42} height={42} viewBox="-525 -525 1050 1050">
          <Circle cx={0} cy={0} r={278.5} fill="#FFE550" />
          <Path d="M0 -279.5 A279.5 279.5 0 0 0 0 279.5 Z" fill="#9B9A96" />
          <Circle cx={-89} cy={-169} r={32} fill="#78777C" />
          <Path d="M-121 -72 V-60 A57 57 0 0 1 -178 -3" fill="none" stroke="#78777C" strokeWidth={38} strokeLinecap="round" />
          <Circle cx={-110} cy={101} r={54} fill="#78777C" />
          <Path d="M189 76 A204 204 0 0 1 80 188" fill="none" stroke="#FFD400" strokeWidth={34} strokeLinecap="round" />
          <G fill="none" stroke="#FFE550" strokeWidth={74} strokeLinecap="round">
            {RAYS.map(d => <Path key={d} d={d} />)}
          </G>
        </Svg>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', top: 53, right: 22, width: 44, height: 44, zIndex: 40, alignItems: 'center', justifyContent: 'center' },
});
```

## 5. Palette

Give both palettes identical keys. Existing `C` keys keep their names. Ink in light mode is `rgb(21, 23, 30)`.

### Text and lines

| Token | Dark (current) | Light | Used for |
|---|---|---|---|
| `bg` | `#0A0A0D` (`DARK`) | `#F6F6F9` | Frame root, Stack `contentStyle`, font-loading view, base under the glow |
| `strong` | `#FFFFFF` | `#0A0B10` | Neutral emphasis on the background (see §6) |
| `text` | `#F5F5F7` | `#15171E` | Primary text, wordmark, headings, glyphs on round buttons |
| `body` | `#E6E7EC` | `#2A2D37` | Transcript lines, review/compare rows, answer text, plain chips |
| `body2` | `#D9DAE0` | `#3A3D48` | Compare "Opened with" quote |
| `body3` | `#C9CBD3` | `#4A4D59` | "Keep ‘word’" alt chip text |
| `secondary` | `#A7A9B4` | `#5F6270` | Labels, captions, hint rows, header sub-labels |
| `tertiary` | `#8A8D99` | `#767987` | Timestamps, overline labels, "Tap a bar", empty states |
| `dim` | `#6E7080` | `#A1A4AF` | Idle Rehearse timer `0:00` |
| `meta` | `rgba(255,255,255,0.62)` | `rgba(21,23,30,0.58)` | Home carousel slide-count line |
| `track` | `#1F1F27` | `rgba(21,23,30,0.09)` | Ring tracks: Home %, upload analysis, record, compare keep |
| `dotOff` | `#45464F` | `rgba(21,23,30,0.2)` | Inactive Home page dots (active dot = `text`) |
| `hair` | `rgba(255,255,255,0.1)` | `rgba(21,23,30,0.1)` | Dividers, dialog border, unkept Compare card border |

### Surfaces, borders and ink

These sit on the background.
- **Surfaces** are fills for buttons, cards and chips. In light mode they become translucent white.
- **Borders** become ink.
- **Ink** fills are bars, ticks and wave bars. They also become ink.

| Token | Dark | Light |
|---|---|---|
| `surface04` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.45)` |
| `surface06` | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.55)` |
| `surface08` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.68)` |
| `surface10` | `rgba(255,255,255,0.1)` | `rgba(255,255,255,0.78)` |
| `surface12` | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.88)` |
| `border06` | `rgba(255,255,255,0.06)` | `rgba(21,23,30,0.06)` |
| `border08` | `rgba(255,255,255,0.08)` | `rgba(21,23,30,0.07)` |
| `border12` | `rgba(255,255,255,0.12)` | `rgba(21,23,30,0.1)` |
| `border14` | `rgba(255,255,255,0.14)` | `rgba(21,23,30,0.12)` |
| `border30` | `rgba(255,255,255,0.3)` | `rgba(21,23,30,0.24)` |
| `border50` | `rgba(255,255,255,0.5)` | `rgba(21,23,30,0.42)` |
| `border55` | `rgba(255,255,255,0.55)` | `rgba(21,23,30,0.45)` |
| `ink05` | `rgba(255,255,255,0.05)` | `rgba(21,23,30,0.035)` |
| `ink08` | `rgba(255,255,255,0.08)` | `rgba(21,23,30,0.07)` |
| `ink14` | `rgba(255,255,255,0.14)` | `rgba(21,23,30,0.08)` |
| `ink16` | `rgba(255,255,255,0.16)` | `rgba(21,23,30,0.13)` |
| `ink18` | `rgba(255,255,255,0.18)` | `rgba(21,23,30,0.15)` |
| `ink20` | `rgba(255,255,255,0.2)` | `rgba(21,23,30,0.17)` |
| `ink28` | `rgba(255,255,255,0.28)` | `rgba(21,23,30,0.22)` |
| `ink40` | `rgba(255,255,255,0.4)` | `rgba(21,23,30,0.32)` |
| `ink45` | `rgba(255,255,255,0.45)` | `rgba(21,23,30,0.36)` |
| `ink55` | `rgba(255,255,255,0.55)` | `rgba(21,23,30,0.45)` |
| `ink70` | `rgba(255,255,255,0.7)` | `rgba(21,23,30,0.6)` |

### Overlays

| Token | Dark | Light | Used for |
|---|---|---|---|
| `dialog` | `#1A1A21` | `#FFFFFF` | Redo dialog card |
| `dialogShadow` | `rgba(0,0,0,0.55)` | `rgba(21,23,30,0.18)` | Dialog shadow colour |
| `scrim` | `rgba(0,0,0,0.62)` | `rgba(21,23,30,0.3)` | Dialog backdrop |
| `pickerScrim` | `rgba(8,8,12,0.7)` | `rgba(246,246,249,0.72)` | Icon-picker backdrop, blur unchanged |
| `toast` | `#1C1C23` | `#FFFFFF` | Undo toast, landscape note |
| `toastBorder` | `#2A2A33` | `rgba(21,23,30,0.08)` | Toast border |
| `hud` | `rgba(10,10,13,0.74)` | `rgba(255,255,255,0.84)` | Landscape timer pill, blur unchanged |
| `rowDrag` | `#15151B` | `rgba(21,23,30,0.05)` | Transcript row while dragged |
| `ground` | current `GroundShadow` peak | `rgba(21,23,30,0.2)` | Radial shadow under Home icons, fading to transparent |
| `markerGlow` | `rgba(255,255,255,0.5)` | `rgba(21,23,30,0.18)` | Glow around the Setup ruler's centre marker |
| `titleShadow` | colour `rgba(0,0,0,0.35)`, offset (0, 2), radius 6 | none (`transparent`) | Home carousel title |

### Status text

Status text gets darker shades for contrast on light. The tint backgrounds behind it stay the same.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `good` | `#3FD9A4` | `#08875C` | On pace, Answered, Strongest, the "fixed" note, faster |
| `warn` | `#FFC266` | `#A86200` | Behind, Partly answered, follow-up overlines, edge notes |
| `warnAlt` | `#FFB547` | `#A86200` | Home "Almost there", negative delta |
| `bad` | `#FF9C90` | `#C2392C` | Too short, Needs most work, worse compare values |
| `badAlt` | `#FF7A6B` | `#C2392C` | Home "Needs work" |
| `coralText` | `#FF8A7E` | `#C8402F` | Over-target slide line, over-target bar numbers |
| `info` | `#A9C1FF` | `#2C50CF` | Ahead / under target |
| `violetText` | `#CBB8FF` | `#5A35CC` | Filler-word chips on Review |
| `gold` | `#FFD866` (tip heading only) | `#946300` | Review "What to change first" heading |
| `goldText` | `#FFE08A` | `#8A5A00` | Flagged-word text, "Did you say" alt chips |

`TONE.*.fg` maps to `good`, `warn`, `info` and `bad`. `TONE.plain` becomes bg `surface08` and fg `body`. Every `TONE.*.bg` stays as it is.

### Unchanged in both themes

| Element | Colour |
|---|---|
| Undo button | Fill `#FFD866` (`C.yellow`), label `#14161D` |
| Live wave tail | `#FF5A4E` |
| Status tints | `rgba(63,217,164,0.16)`, `rgba(255,181,71,0.16)`, `rgba(110,150,255,0.18)`, `rgba(255,122,107,0.18)`, `rgba(155,124,255,0.16)` |
| Flagged-word highlight | `rgba(255,216,102,0.14)` with underline `rgba(255,216,102,0.85)` |
| Review tip and tile tints | As now |
| Gradients | Over-target bar gradient, `G.*`, `HUES.*` |

## 6. The white rule

Most mistakes will come from `#FFFFFF` and `rgba(255,255,255,x)`. Apply this test to each one:

- **It stays white** if it sits on any of these:
  - A slide face, deck face, avatar, or the Q&A slide preview.
  - The red record button, the green confirm button, or the red dialog badge.
  - The accent-coloured swipe reveal.
  - The inside of a chroma icon.
  - Their text, bullets, placeholder bars, inner highlights, the check stroke, the mic glyph and the stop square all stay white.
- **It becomes `strong`** when it is neutral emphasis on the background:
  - Home carousel title (with `titleShadow`).
  - Setup ruler centre marker (with `markerGlow`).
  - Selected Review bar and its number.
  - Current slide tick.
  - The playing transcript line: its text and its play/pause icon.
  - Selected icon-picker tile.
  - "Here" badge background (with `bg` as the badge text).
- **Anything else on the background** maps to a surface, border or ink token at the matching alpha (§5).

The redo glyph (`g-redo`) stays white on the red button and the red badge. On the Compare "Try again" round button it uses `text`.

## 7. Element map

| Screen | Element | Tokens |
|---|---|---|
| Home | Wordmark | `text`, §3 sizes |
| Home | Carousel title / meta | `strong` + `titleShadow` / `meta` |
| Home | Ground shadow under icons | `ground` → transparent |
| Home | Side-card dimming | `HomeScreen.tsx` multiplies `f.brightness` into opacity. Keep that in dark. In light, drop the brightness factor and keep `f.opacity × (1 − del × 0.45)`. The prototype uses brightness 1 in light. |
| Home | Page dots | Active `text`, inactive `dotOff` |
| Home | % ring track / numbers / labels | `track` / `text` / `secondary`. Hero status uses `good`, `warnAlt`, `badAlt` |
| Home | Bottom hint row | `secondary` |
| Home | Undo toast | `toast`, `toastBorder`, text `text`. Undo button unchanged |
| Home | Delete hold ring track | `border12` |
| Home | Icon picker | Backdrop `pickerScrim`. Tiles bg `surface12` / `surface04`, border `border55` / `border06`, selected fg `strong`, unselected fg `secondary`. Title `text`, subtitle `secondary` |
| Upload | Title / "Tap the icon" / "PDF · up to 50 MB" | `text` / `secondary` / `tertiary` |
| Upload | Analysis ring track, %, status, file line, stage labels | `track`, `text`, `text`, `secondary`, `secondary` |
| Upload | Carousel blur behind Upload | Blur in both themes. Darkening only in dark |
| Rehearse | Header title / counter | `text` / `secondary` |
| Rehearse | Slide ticks | Current `strong`, past `ink55`, future `ink16` |
| Rehearse | Transcript header / divider / right label | `tertiary` / `hair` / `good` when it is a note, else `tertiary` |
| Rehearse | Transcript row | Time `tertiary`. Text `body`, or `strong` while playing. Icon `secondary`, or `strong` while playing. Playing progress `ink14` → `ink05`. Dragged row `rowDrag` |
| Rehearse | Swipe reveal | Past the threshold: hue `accent` with white text. Before it: `ink08` with `text` |
| Rehearse | Flagged words / "Did you say" / alt chips / keep chip | `goldText` on the fixed tint / `tertiary` / `goldText` on the fixed tint / `surface06` + `border14` + `body3` |
| Rehearse | Edit box | Border `border30`, bg `surface08`, text `text` |
| Rehearse | Edge note | `warn` |
| Rehearse | Pace chip | Fixed tint + `warn`, `info` or `good` |
| Rehearse | Big timer / slide line | `text` (idle `dim`) / `secondary`, or `coralText` when over target |
| Rehearse | Wave | Idle `ink18`, live `ink45`, last five bars `#FF5A4E` |
| Rehearse | Round side buttons (Rotate, Review) | bg `surface08`, border `border12`, glyph `text`, caption `secondary` |
| Rehearse | Record ring track | `track`. Red gradient unchanged |
| Rehearse | Redo dialog | `scrim`, card `dialog`, border `hair`, shadow `dialogShadow`. Title `text`, body `secondary`. Cancel: `surface08` + `border14` + `text`. Confirm: red, unchanged |
| Rehearse (landscape, when built) | Timer pill / note | `hud` / toast tokens |
| Review | Header, big time, sub | `text`, `text`, `secondary` |
| Review | Tip box | Tint unchanged, heading `gold`, text `text` |
| Review | Bars | Selected `strong`, rehearsed `ink28`, not reached `ink08`, over-target gradient unchanged. Numbers: selected `strong`, else `coralText` |
| Review | Selected-slide card | bg `surface06`, border `hair`. Number `secondary`, title `text`, rows `body` |
| Review | Tiles | Strongest `good`, Needs most work `bad`, sub `secondary` |
| Review | Filler chips | Tint unchanged, text `violetText` |
| Compare | Kept card / other card | Border `border50` + bg `surface10` / border `hair` + bg `surface04`. Hue glow shadow on the kept card unchanged |
| Compare | Card internals | Label `secondary`, dividers `hair`, keys `secondary`. Values `text`, `good` or `bad`. "Opened with" `tertiary`, quote `body2` |
| Compare | Rows / Try again | `body` / round-button tokens with the redo glyph in `text` |
| Q&A | Header, role, meta, question | `text`, `text`, `secondary`, `text` |
| Q&A | Hints, overlines, small question, follow-up | `secondary`, `tertiary` (follow-up overline `warn`), `secondary`, `body` |
| Q&A | Slide-preview caption, live time, live text | `tertiary`, `tertiary`, `body` |
| Q&A | Verdict chip | Tint unchanged + `good`, `warn` or `bad` |
| Q&A | Answer chip | `surface06` + `border12` + `body` |
| Q&A | Feedback rows | Key `tertiary`, text `body` |
| Q&A | Follow-up card | Tint unchanged, overline `warn`, hint `secondary` |
| Q&A | Answer box | `surface04` + `border08`. Times `tertiary`, text `body` |
| Q&A | End text, timer, line, wave, ring | `tertiary`, `text`, `secondary`, `ink45`, `track` |
| TakePlayback | (Not in the prototype) | Apply the same rules: `text`, `secondary`, surface and border tokens |

## 8. Ambient background

- Keep `GlowLayer` and `Ambient` exactly as they are in dark: same image, tint, opacity and hue cross-fade.
- In light, only the base colour under the glow changes, to `bg`.
- Remove the light branches: the `rgba(hue, 0.5)` fill in `GlowLayer`, and `opacity: light ? 0.9 : 1` in `Ambient`.

## 9. Leftovers to replace

These lines are from the 2026-10-15 checkout.

| File | Now | Replace with |
|---|---|---|
| `design/theme.tsx` | Fixed dark stub; `lightColor` returns its input | The real theme (§10) |
| `design/ThemeToggle.tsx` | Decorative rotation, old drawing | §4 component |
| `design/icons.tsx:59` | `lightColor(color)` | Callers pass a palette colour |
| `design/ui.tsx:80` | `lightColor(C.track)` | `c.track` |
| `design/ui.tsx:160–161` | `rgba(34, 35, 43, …)` | `c.ink18` / `c.ink45`, tail `#FF5A4E` |
| `design/ui.tsx:254` | Light hue fill | Remove |
| `screens/AppShell.tsx:120` | `opacity: light ? 0.9 : 1` | `1` |
| `screens/UploadScreen.tsx:142` | `lightColor(C.track)` | `c.track` |
| `screens/ReviewScreen.tsx:117, 126` | `#292633` | `c.strong` |
| `screens/RehearseScreen.tsx:514` | `#292633` / `rgba(41, 38, 51, …)` | `c.strong` / `c.ink55` / `c.ink16` |
| `screens/CompareScreen.tsx:73–74, 110` | Light literals | `c.border50` / `c.hair`, `c.surface10` / `c.surface04`, `c.track` |
| `screens/HomeScreen.tsx:286, 328, 503` | `titleLight: '#FFFFFF'` | Remove. Title uses `c.strong` |
| `screens/HomeScreen.tsx:300–302` (`GroundShadow`) | Light branch | Dark: keep as is. Light: `c.ground` → transparent, no white glow |
| `screens/HomeScreen.tsx:435` | `#292633` / `#AAA6AE` | `c.text` / `c.dotOff` |
| `app/_layout.tsx` | `StatusBar style="light"`, `DARK` backgrounds | Theme-driven (§2, §5) |
| `design/frame.tsx` | `backgroundColor: DARK` | `c.bg` |

## 10. Implementation notes

- **Palettes.** `tokens.ts` exports `DARK_PALETTE` and `LIGHT_PALETTE` with identical keys. Keep `C` as an alias of `DARK_PALETTE`, so files you have not reached yet still compile. Keep `TONE` bg values; take its fg values from the palette.
- **Provider.**
  - Put a `ThemeProvider` at the app root (`_layout.tsx`, around `Stack`), with its initial state read synchronously from storage.
  - `useTheme()` returns `{ mode, c, toggle }`.
  - `toggle` flips the mode and calls `writeStored`.
- **Styles.**
  - Colour-bearing styles are created once per palette, for example `createThemedStyles(c => ({ … }))`. It returns `{ dark, light }` `StyleSheet`s, and a `useThemedStyles` hook picks one by mode.
  - Layout-only styles can stay in plain `StyleSheet.create`.
  - Avoid rebuilding style objects on every render.
- **Memoized components.** Every `memo()` component that draws colour must read the theme context, so it re-renders on toggle. The earlier pass found the Home carousel card and the transcript words keeping their old colours.
- **Reanimated worklets** that output colours read the palette from a shared value or a prop that changes with the mode.
- **Out of scope.** Do not change hue tables, the glow asset, layout, gestures or copy.

## 11. Acceptance checklist

- [ ] With dark mode on, every screen looks the same as before this change (compare screenshots).
- [ ] The toggle shows on Home and Upload at right 22, top 53, centred on the 26-unit wordmark, and is hidden while the picker is open.
- [ ] Dark shows the moon on top. Tap: the icon turns 180° clockwise in 560 ms, the sun ends on top and the app is light. Tap again: another 180° clockwise, back to dark.
- [ ] With reduced motion on, the icon changes orientation without animating.
- [ ] Light mode persists through a force-stop and relaunch, with no dark flash on launch.
- [ ] In light mode, the glow fade is the same as in dark, on a `#F6F6F9` base. No extra full-screen fill.
- [ ] No white neutral text or controls remain on the light background. Slide faces, chroma icons and the red and green buttons are unchanged.
- [ ] Status bar icons are dark in light mode and light in dark mode.
- [ ] `npm run check` passes.

## 12. Prompt for Codex

```text
Implement docs/light-mode-toggle-spec.md in mobile/. Follow AGENTS.md (including the prompt log).
Dark mode must look exactly as it does now. Replace the decorative ThemeToggle and the fixed-dark theme stub
with the real theme described in the spec, use the palette values as written, and replace every leftover in §9.
Do not reuse light-mode values from the earlier "Whole-app theme toggle" pass. When done, run npm run check,
build and install on the connected phone, and walk the §11 checklist with screenshots of Home, Upload,
Rehearse, Review, Compare and Q&A in both themes.
```
