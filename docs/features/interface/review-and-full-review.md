# Review and Full review: implementation spec

Prepared with Claude (Anthropic) on 2026-10-15.

**Source of the design.** Every layout value comes from the OutLoud gesture prototype (`Main.dc.html`, Claude Design artifact, version 110). The relevant boards are:
- "4 · Review"
- "4b · Full review"
- "1 · Home" (the % ring entry)

The artifact is private, so do not try to open it. Reference renders of the prototype are in `docs/assets/interface/references/review-full-review/`, listed in §13.

**Targets.**
- Change: `mobile/src/screens/ReviewScreen.tsx`
- New: `mobile/src/screens/FullReviewScreen.tsx`
- Small changes:
  - `HomeScreen.tsx`
  - `AppShell.tsx`
  - `shared.ts`
  - `domain/analysis.ts`
  - `features/rehearsal/useSegmentPlayer.ts`
  - `design/` (new components)

**Units and coordinates.**
- Sizes are design-frame units in the 390 × 844 portrait frame, the same as the other specs.
- Positions are given as `x, y, w, h` in that frame.
- Font names refer to `F` in `design/tokens.ts`, and colours refer to the theme palette `c.*`, so dark and light both work.
- Literal hex colours appear only where they are the same in both themes (the grade colours).

**Icons.** Status icons are monochrome outlines in the secondary text colour, the same `UIIcon` set the app already uses. The only coloured icon on these pages is the grade grid on the Full review button. The reference renders were updated to show this.

**Code baseline.** The current-code details in this spec were read from this folder on 2026-10-15 at about 22:45 KST. A Codex session was editing the folder at the same time; at that point it had just removed Review's upward-gesture transform. If a file has moved on since, keep its newer behaviour and apply this spec on top.

**The prototype versus the app.** The prototype uses sample data and speaks the transcript with text-to-speech. The app has real recordings, Whisper transcripts and AI suggestions. Match the prototype's layout, sizes, colours, order and behaviour, and feed it the app's real data. §11 lists the few places where the app needs a rule the prototype does not have. Those rules are proposals, marked as such.

---

## 1. What changes, in one list

**Review (`ReviewScreen`)**
1. **Removed from the screen:**
   - the big total time "12:47 / 10:00"
   - the run chips (over/under, wpm, faster/slower)
   - the "What to change first" tip
   - the "Strongest" and "Needs most work" tiles
   - the filler chips row

   Remove only the rendering. Keep `reviewChips` and `reviewInsights` in `domain/analysis.ts`, because the existing tests import `reviewInsights`.
2. **New:** a **slide ring row** at the top. It shows the selected slide's score in a ring drawn like Home's % ring, with three stat rows beside it.
3. **Unchanged except its position:** the "Times per slide" block. It moves up from y 330 to y 278.
4. **Selected-slide card:**
   - it gets a fixed size (16, 419, 358, 281);
   - a larger slide preview (170 × 96);
   - a new playback strip for that slide;
   - always exactly **four** feedback rows (time, fillers, what was said, delivery). A row with nothing to fix says **"Spot On!"**.
5. **New:** a **Full review** button pinned at (16, 718, 358, 58).
6. **Hint row:** the back hint reads "Back to slides", or "Full review" when Review was opened from Full review.

**Full review (`FullReviewScreen`, new screen `'full'`)**
1. A ring row at the same place as Review's. It shows the deck's points-said %, the same number as Home's ring, with four run stats beside it.
2. **Whole run:**
   - a minimal play button;
   - a thin bar split into slide sections that fill as the audio plays;
   - tap a section to hear only that slide.
3. **Transcript:** the whole run transcript in a scrolling, borderless list. It highlights the line being played and scrolls to keep it centred.
4. **Slides:**
   - a header with the colour legend and counts;
   - a 58-tall card with one row of grade-coloured square tiles that scrolls sideways;
   - tap a tile to open that slide on Review.

**Home**
- The % ring in the stats panel becomes a tap target that opens Full review for the front deck.

## 2. What stays exactly the same (do not change)

- **Review header:**
  - the title and run label;
  - position: `left 40, right 40, top 50`;
  - styles: `title`, `label`;
  - the run label text (`runLabel` + transcript-fix count).
- **"Times per slide" block:** only its y position changes. Everything else stays:
  - the header row ("Times per slide" in `F.bold` 14 `c.text`, "Tap a bar" in `F.medium` 12 `c.tertiary`);
  - the bars: 80 high, gap 3, height `max(6, round(t/maxT·78))`, or 4 when not reached;
  - bar colours: selected `c.strong`, over by 15 s or more uses the red `OverBar` gradient, otherwise `c.ink28`, not reached `c.ink08`;
  - the number row: 14 high, margin-top 4, numbers shown for the selected and over slides;
  - tap behaviour: `setSel(b); go('review', { sel: b })`.
- **Review gestures:**
  - swipe down to go back, with the in-place fade (`BACK_FADE_Y`, `BACK_T`);
  - swipe up for Audience Q&A;
  - Android back does the same as swipe down.
  - The Review page stays fixed during the upward gesture. That was a recent Codex fix; keep it.
- **Page transitions:**
  - Use the app's current stationary opacity fades: `nav: 'fade'` for a new layer, `nav: null` when revealing an existing layer.
  - Do **not** port the prototype's zoom or rise entrances.
- **Unchanged components:** `MiniSlide` keeps rendering the real PDF page image, and `Pill` (the verdict chip), `HintRow`, `IconRow` and `UIIcon` are unchanged.
- **Transcription and AI coaching:**
  - pending transcription state and worker detail text;
  - the AI-suggestion request and its enable rules (`requestCoaching`, `retainCoaching`, the `disabled` conditions).

  They move into the four-row layout (§4.6) but keep their behaviour.
- **Audience Q&A:** entry and return are unchanged.
- **Home:** the stats panel visuals are unchanged. Only a transparent tap target is added above the ring.

---

## 3. Shared logic (`domain/analysis.ts`)

### 3.1 Grade colours

Add these constants and export them. The fills and ring gradients are literal because they are the same in both themes. The label ink uses theme colours.

| key | label | fill (tiles, legend dots) | ring gradient (top-left → bottom) | label ink |
|---|---|---|---|---|
| `green` | Strong | `#3FD9A4` | `#9AF7D6 → #0EA877` | `c.good` |
| `yellow` | Good | `#FFD866` | `#FFF4B0 → #F5C518` | `c.gold` |
| `orange` | Needs work | `#FF9A3D` | `#FFE58C → #FF8A1E` | `c.warnAlt` |
| `red` | Weak | `#FF6B5E` | `#FF9A7C → #EC2A35` | `c.badAlt` |

- Text on a grade fill is always `#14161D`, in both themes.
- Order everywhere is green, yellow, orange, red.

### 3.2 Slide score and grade

Add `slideGrade(slide, ctx)`. Use the inputs the screens already have:
- `times`, `targets`
- `lines` (`model.lines`)
- `points` (`model.points`)
- `ai` (`model.ai`)
- `haveText`: `deck.text === 'ready'`
- `pending`: whether the take that supplies the slide is still transcribing. Use the same test as `ReviewScreen`: `partId && !model.transcripts.has(partId) && model.stages.get(partId) !== 'no_speech'`.

```
t = times[i]
if t <= 0                → { key: 'none' }        // not reached
if pending(i)            → { key: 'pending' }     // see §11
g       = targets[i] > 0 ? targets[i] : t
text    = slideText(lines, i)
fillers = fillerTotal(text)
pts     = haveText ? scorablePoints(points[i] ?? []) : []
missed  = pts.filter(p => !covers(text, p)).length
spilled = lines.some(l => l.slide === i && l.edge === 1) || lines.some(l => l.slide === i + 1 && l.edge === -1)
aiCount = min(2, ai.filter(s => s.slide === i).length)
notes   = (missed > 0 ? 1 : 0) + (spilled ? 1 : 0) + aiCount
score   = 100
        − min(40, |t − g| / g × 60)
        − min(24, fillers × 6)
        − (pts.length ? missed / pts.length × 30 : 0)
        − 8 × notes
key     = score >= 85 ? 'green' : score >= 70 ? 'yellow' : score >= 55 ? 'orange' : 'red'
percent = clamp(round(score), 0, 100)
```

`notes` matches the prototype: every finding except the filler row counts. "Not said" counts both in `missed` and in `notes`; the prototype does the same.

### 3.3 The four feedback rows

Add `feedbackRows(slide, ctx)`. It always returns **4 rows, in this order**, each with a fixed icon. These replace the variable list built from `slideVerdict(...).row` plus `findingsFor(...)`.

| # | icon | text when there is something to fix | otherwise |
|---|---|---|---|
| 1 Time | `i-clock` | `ov ≥ 15`: `"0:19 over this slide’s 0:30"`; `ov ≤ −15`: `"0:16 under this slide’s 0:40"`. Same wording as `slideVerdict`. | `Spot On!` |
| 2 Fillers | `i-bubble` | Most frequent filler with at least 2 uses on the slide: `"“basically” 3 times on this slide"`. Same rule as the filler line of `findingsFor`. | `Spot On!` |
| 3 Said | `i-flag` | First scorable point not covered: `"Not said: “Limited access to external feedback”"` | `Spot On!` |
| 4 Delivery | `i-wave` | The first of: spill (`"Moved to slide 6 mid-sentence"`); then the first AI suggestion for the slide, any category, using its `observation` | `Spot On!` |

Special states:
- **Not reached:** row 1 says `"Not reached in this run"`, and rows 2–4 say `"—"`.
- **Transcript pending:**
  - Row 1 behaves as normal.
  - Row 2 says `(worker.detail || 'Transcribing') + '…'` while `worker?.stage === 'processing'`, otherwise `"Transcript pending"`.
  - Rows 3 and 4 say `"—"`.
  - Rows 2–4 use `c.secondary`.
- **No slide text** (`!haveText`): row 3 says `"No slide text to check"` in `c.secondary`.

The issue count for the ring stat row (§4.2) is `(row 3 has a finding ? 1 : 0) + (row 4 has a finding ? 1 : 0)`.

### 3.4 Run positions

`runStarts(times)` already exists in `domain/run.ts`. A slide's span in the merged run is `[starts[i], starts[i] + times[i])` in seconds.

---

## 4. Review page

Reference images:
- `review-dark-slide5.png`
- `review-dark-slide7-spot-on.png`
- `review-light-slide6-playing.png`

### 4.1 Frame map (portrait 390 × 844)

| Element | x, y, w, h | Notes |
|---|---|---|
| Header (title, run label) | left 40, right 40, top 50 | Unchanged |
| Content column | left 16, right 16, top **140**, bottom **144** (ends at y 700) | Vertical stack, **gap 18** |
| Slide ring row | 16, 140, 358, 120 | §4.2 |
| Times per slide | 16, 278, 358, 123 | Header 17 at y 278; bars at y 303, h 80; numbers at y 387, h 14. Otherwise unchanged. |
| Slide card | 16, 419, 358, **281** | Fixed size, never grows with content. §4.4 |
| Full review button | 16, **718**, 358, **58** | Absolute: `left 16, right 16, bottom 68`. §4.5 |
| Hint row | existing `HintRow` (bottom 30, h 18) | §4.7 |

The gaps are fixed: 140 → 260 (ring row), 18, 278 → 401, 18, 419 → 700, 18, 718 → 776.

### 4.2 Slide ring row (16, 140, 358, 120)

- **Row:** horizontal padding 12, gap 18, items centred vertically. The ring sits at (28, 140, 120, 120), and the right column at x 166, width 196.
- **Ring:** the same geometry as Home's `StatsPanel` ring:
  - `Svg` 120 × 120, `viewBox 0 0 128 128`;
  - track: circle `r 55`, `strokeWidth 13`, stroke `c.track`;
  - arc: same circle with a gradient stroke (`x1 0, y1 0, x2 0.35, y2 1`), `strokeLinecap round`, `strokeDasharray 345.58`, `strokeDashoffset 345.58 × (1 − percent/100)`, rotated −90° about (64, 64);
  - animate `strokeDashoffset` over **450 ms** with `EASE_SCREEN` when the selected slide changes;
  - arc gradient = the grade's ring gradient (§3.1).

  Factor Home's ring into a shared `ScoreRing` component so all three rings are identical.
- **Ring centre text:**
  - percent `percent + '%'`: `F.display` 30, line height 31, letter spacing −0.8, `c.text`, tabular figures;
  - grade label under it (Strong, Good, Needs work, Weak): `F.semibold` 11, line height 12, letter spacing 0.3, margin-top 4, colour = the grade's label ink.
- **Right column:**
  - Label `"Slide 5 of 18"`: `F.semibold` 14, `c.secondary`, one line, at y 141.5.
  - Then margin-top 14 and three stat rows at y 172.5, 204.5 and 236.5 (each 22 tall, gap 10).
  - Each stat row: `UIIcon` 22, gap 8, value in `F.display` 18 (line height 20) `c.text`, unit in `F.medium` 13.

  | icon | value | unit | unit colour |
  |---|---|---|---|
  | `i-clock` | `fmt(t)` | `"of 0:30 target"` | `c.warn` when `ov ≥ 15`, else `c.secondary` |
  | `i-bubble` | filler count on the slide | `"filler"` / `"fillers"` | `c.secondary` |
  | `i-flag` | issue count (§3.3) | `"issue flagged"` / `"issues flagged"` | `c.secondary` |
- **States:**
  - **Not reached:** arc opacity 0, percent `"—"`, label `"Not reached"` in `c.secondary`, values `"—"`, rows at opacity 0.45.
  - **Pending:** arc opacity 0, percent `"…"`, label `"Transcribing"` in `c.secondary`. The time row is normal; the filler and issue rows show `"—"` at 0.45.

### 4.3 Times per slide

Unchanged; only its y position moves (§2). Update the pan exclusion band in `onMoveShould` and keep the rest of the condition:
- old: `!(y > 330 && y < 440 && Math.abs(g.dx) > 4)`
- new: **`!(y > 296 && y < 404 && Math.abs(g.dx) > 4)`**, the bar and number area.

Horizontal finger drags across the bars must still not start the vertical gesture.

### 4.4 Slide card (16, 419, 358, 281), fixed size

- **Card:**
  - padding 12 vertical, 14 horizontal;
  - `borderWidth 1` `c.hair`, `borderRadius 20`, background `c.surface06`;
  - vertical flex with **`justifyContent: 'space-between'`**.

  Content order:
  1. **Preview row**, starting at y 432 (13 below the card top, counting the border):
     - `MiniSlide` at **170 × 96**, radius **12**: (31, 432, 170, 96). This uses its `big` style because `width > 150`.
     - Gap 14, then the text column (x 215, width 144), centred vertically on the preview:
       - `"Slide 5"`: `F.semibold` 12, `c.secondary`.
       - Title: `F.display` **17**, line height 19.5, `c.text`, **up to 2 lines** with ellipsis. Previously it was 18 and one line.
       - Time row, margin-top 6: `"0:49 of 0:30"` in `F.semibold` 13 `c.text`, tabular, then the verdict `Pill` with gap 8. The row may wrap: column gap 8, row gap 4.
  2. **Playback strip:** (31, 540.5, 328, 28), §4.4.1.
  3. **Four feedback rows:** (31, 581, 328, 106). The rows sit at y 581, 609, 637 and 665, each 22 tall with gap 6, ending 13 above the card's bottom edge.

  The three blocks are separated by about 12.5 each, which `space-between` gives automatically. Do not add margins.
- **Feedback row:**
  - `UIIcon` 22, gap 10, text on a single line (`numberOfLines={1}`, ellipsis);
  - normal text: `F.regular` 13, line height 16.9, `c.body`;
  - `Spot On!`: **`F.bold` 13, `c.good`**.

  Keep `IconRow` for normal rows. Add a `spot` or `tone` prop rather than a second component.

#### 4.4.1 Playback strip (slide audio)

| Part | Frame | Spec |
|---|---|---|
| Play / pause | 24, 540.5, 28, 28 | Transparent `Pressable` at margin-left −7, so the triangle lines up with the card's text. `Glyph` `p-play` or `p-pause`, size 18, colour `c.text`. |
| Progress bar | 58, 551.5, 261, 6 | Gap 6 on each side, flex 1, height 6, radius 3, background `c.ink18`. The fill is the same height, `c.text`, `width = progress × 100%`. |
| Time | 325, 547.5, 34, 14 | `minWidth 34`, right-aligned. `F.medium` 12, `c.tertiary`, tabular. Idle: `fmt(t)`. Playing or paused: `fmt(elapsed) + ' / ' + fmt(t)`. |

- **What it plays:** the selected slide's audio, `run.parts[s].segments` with `uri = audioOf(part.attemptId)`. Key: `` `slide:${deck.id}:${s}` ``, the same key Rehearse uses.
- **Taps:**
  - From idle, it starts.
  - While playing, a tap pauses and keeps the fill.
  - While paused, a tap resumes.

  This matches `useSegmentPlayer.playSegments` toggle behaviour (§11).
- **It stops when:**
  - the selected slide changes (bar tap, or a new `nav.sel`);
  - the screen becomes inactive or unmounts;
  - the app leaves the foreground (already handled by `useSegmentPlayer`).
- **Disabled states:**
  - **Not reached:** the strip is at opacity 0.4 and the button is disabled.
  - **No audio on the phone:** the time label shows "No audio" for 3 s, then returns to normal. The play button stays enabled so the user can retry.

### 4.5 Full review button (16, 718, 358, 58)

- **Container:**
  - `Pressable`, absolutely positioned at `left 16, right 16, bottom 68`, height 58;
  - padding 10 vertical, 12 horizontal;
  - `borderWidth 1` `c.hair`, `borderRadius 18`, background `c.surface06`;
  - horizontal row, gap 12, centred vertically.
- **Icon:** `GradeGrid` 36 × 36 at (29, 729). It is four rounded squares in the grade fills (`docs/assets/interface/icons/full-review-grades.svg`):
  - viewBox 48;
  - squares 18.5 × 18.5, `rx 6`, at (4, 4), (25.5, 4), (4, 25.5), (25.5, 25.5);
  - colours green, yellow, orange, red.

  This is a new small component, because `UIIcon` only draws stroked line icons.
- **Text column** (flex 1):
  - title `"Full review"`: `F.display` 16, line height 19.2, `c.text`;
  - then margin-top 4, the grade-count row at y 752.6, height 12, gap 10:
    - for each of green, yellow, orange, red: a dot (8 × 8, radius 4, grade fill), gap 4, the count in `F.bold` 12 `c.text`, tabular.
- **Chevron:** 20 × 20 at (341, 737), from `docs/assets/interface/icons/chevron-right.svg`. Path `M9.5 5.5 L16 12 L9.5 18.5` in a 24 box, stroke `c.secondary`, width 2.6, round caps and joins.
- **Counts:**
  - green, yellow, orange and red over all slides;
  - `none` and `pending` are not counted.
- **Hidden** when there is no run. In practice Review already needs a run.
- **Accessibility label:** `"Full review: 11 strong, 3 good, 2 needs work, 2 weak slides"`.
- **Action:** §8.

### 4.6 Where the existing extras go

- **Pending transcription** shows inside rows 2–4 (§3.3). Remove the separate fifth "Transcript pending" row.
- **AI suggestions request.** Previously this was a fifth tappable row. It moves to the right end of **row 4 (Delivery)**. This is a proposal (§11).
  - When the existing enable rules allow a request, row 4 shows a trailing text button `"Ask AI"` in `F.semibold` 12 `c.info`, with a hit area of at least 44 × 28.
  - While a request is running or has a notice, row 4's text becomes `coach.notice || coach.label` in `c.secondary`, and the button is hidden.
  - When suggestions arrive, the first one appears as row 4's text (§3.3).
  - The row stays one line and 22 tall in every state.

### 4.7 Hint row

| From | Hints |
|---|---|
| Opened from Rehearse or Audience Q&A (`nav.from !== 'full'`) | `h-dn` "Back to slides" (nudge down) · `h-up` "Audience Q&A" (nudge up) |
| Opened from Full review (`nav.from === 'full'`) | `h-dn` "Full review" (nudge down) · `h-up` "Audience Q&A" (nudge up) |

---

## 5. Full review page (new screen `'full'`)

Reference images:
- `full-review-dark-idle.png`
- `full-review-dark-slide8-playing.png`
- `full-review-light-whole-run-playing.png`
- `full-review-dark-24-slides.png`

### 5.1 Frame map

| Element | x, y, w, h | Notes |
|---|---|---|
| Background | `PageSurface hue={deck.hue}` | Same as Review |
| Header | left 40, right 40, top 50 | Same styles as Review. Title: `deck.title`. Label: `"Full review · " + runLabel(run, now, relativeDay)`. |
| Content column | left 16, right 16, top **140**, bottom **68** (ends at y 776) | Vertical stack, **gap 18** |
| Ring row | 16, 140, 358, 120 | §5.2. Same position as Review's ring. |
| Whole run | 16, 278, 358, 55 | Header at y 278 (h 17), controls row at y 301 (h 32). §5.3 |
| Transcript | 16, 343, 358, flex (≈ 332 for an 18-slide deck) | `marginTop −8`, so the gap is 10. §5.4 |
| Slides | 16, 693, 358, 83 | Header at y 693 (h 17), card at y 718 (h 58). §5.5 |
| Hint row | existing `HintRow` | §5.6 |

The slides card sits on the same line (718–776) as Review's Full review button. That alignment is intentional, so keep it.

### 5.2 Ring row (16, 140, 358, 120)

- **Ring:** the same `ScoreRing` as Review, showing the deck's **points-said %**. That is the same value and the same states as Home's `StatsPanel`:
  - `model.stats.coverage`;
  - gradient mint at ≥ 90, amber at ≥ 75, otherwise red;
  - label "On point", "Almost there" or "Needs work" in `c.good`, `c.warnAlt` or `c.badAlt`;
  - `"…"` / `"Transcribing"` while pending;
  - `"—"` / `"No speech"` or `"No slide text"` as on Home.
- **Right column:** no label line. Four stat rows, centred vertically, at y 141, 173, 205 and 237 (each 22 tall, gap 10). Same row style as §4.2.

| # | icon | value | unit | unit colour |
|---|---|---|---|---|
| 1 | `i-clock` | `fmt(total)` | `over > 3` → `"2:47 over"`; `over < −3` → `"1:10 under"`; else `"on target"`, where `over = total − run.targetSum` | `c.warn` / `c.info` / `c.good` |
| 2 | `i-faster` when `run.delta < 0`, `i-slower` otherwise | `fmt(abs(run.delta))` | `"faster than last"` / `"slower than last"` | `c.good` / `c.warnAlt` |
| 2 (no delta) | `i-slides` | `said + '/' + total`, or `'—/' + total` | `"points said"` | `c.secondary`; the row is at 0.45 when coverage is null |
| 3 | `i-bubble` | `stats.fpm.toFixed(1)` or `"—"` | `"fillers / min"` | `c.secondary`; the row is at 0.45 when null |
| 4 | `i-gauge` | `stats.wpm` or `"—"` | `"wpm · steady"`, or just `"wpm"` | `c.secondary`; the row is at 0.45 when null |

Row 2 shows the delta row when `run.delta != null && abs(run.delta) >= 1`. Otherwise it shows the points row.

### 5.3 Whole run (16, 278, 358, 55)

- **Header row** (y 278, h 17): the two texts are aligned on their baselines with `space-between`, gap 8.
  - **Left:** `F.bold` 14 `c.text`, one line, ellipsis.
    - Idle: `"Whole run"`.
    - Playing or paused: `"Slide 8 · System architecture"`, the slide under the playhead.
  - **Right:** `F.medium` 12 `c.tertiary`, tabular.
    - Idle: `"Tap a section to hear it"`.
    - Whole run playing: `fmt(pos) + ' / ' + fmt(total)`.
    - One slide playing: `fmt(pos − start_i) + ' / ' + fmt(times[i])`.
- **Controls row** (y 301, h 32): margin-top 6, gap 6, items centred vertically.
  - **Play button:** (4, 301, 32, 32) at margin-left −12.
    - Transparent `Pressable` with no circle and no border. The prototype's earlier white circle is gone.
    - `Glyph` `p-play` or `p-pause`, size 20, colour `c.text`.
  - **Section bar:** (42, 303, 332, 28).
    - Flex 1; its hit height is 28.
    - **One section per reached slide** (`times[i] > 0`), in slide order. Each section is a `Pressable` with `flex: times[i]`, `flexBasis 0`, `minWidth 0` and height 28.
    - Inside each section: a bar 6 tall, radius 3, horizontal margin 1 (2 between sections), background `c.ink18`, `overflow hidden`.
    - The section's fill is absolutely positioned from the left, `c.text`, `width = fill × 100%`.
    - **No grade colours in this bar.** Colour belongs to the slide strip only.
    - There is no separate playhead marker; the fill edge shows the position.
- **Fill per section:**
  - idle: 0;
  - whole run playing: `clamp((pos − start_i) / times[i], 0, 1)`;
  - one slide playing: that slide's own progress, with every other section at 0 and opacity **0.35**.
- **Taps:**
  - Play button: idle starts the whole run; while playing it pauses; while paused it resumes.
  - A section: plays that slide only. If that slide is already the current playback, the tap pauses or resumes it instead.
  - Starting any new playback replaces the current one.
- **Accessibility labels:**
  - play button: `"Play the whole run, 12:47"` or `"Pause"`;
  - each section: `"Play slide 5, Problem, 0:49"` or `"Pause slide 5"`.

### 5.4 Transcript (16, 343, 358, flex)

- **Container:** a vertical `ScrollView`.
  - It takes all the space between the Whole run block and the Slides header: flex 1, `marginTop −8`, so the visual gap is 10.
  - Content padding 8 vertical, row gap 6, no border and no background.
  - The prototype fades the top and bottom 14. Do this only if a masking component is already in the project. Otherwise skip the fade and **do not add a dependency for it**.
- **Rows:** every line in `model.lines` for reached slides, sorted by `t`.
  - Row: horizontal, gap 10, aligned to the top.
  - **Slide badge:** 20 × 18, radius 6, margin-top 1, background `c.ink14`, text in `F.display` 10.5 `c.body`, centred, line height 18.
    - It shows `slide + 1` on the **first line of each slide**.
    - On later lines of the same slide it is an empty spacer of the same size.
    - The badge has **no grade colour**.
  - **Text:** flex 1, `F.medium` 13.5, line height 20.
    - Idle: all lines `c.body`.
    - During playback: the current line is **`F.semibold` `c.strong`**, and all other lines are `c.secondary`.
    - Animate the colour over 200 ms if it is cheap. If not, skip the animation.
- **The current line** is the last line with `line.t ≤ pos`, inside the range being played. When one slide is playing, only that slide's lines can be current.
- **Following:**
  - Each time the current line changes, scroll so the line is centred: `y = rowY − (viewportH − rowH) / 2`, clamped at 0, animated. Measure each row's `y` with `onLayout`.
  - Do not auto-scroll while the user is dragging the list (`onScrollBeginDrag` to `onMomentumScrollEnd`).
- **Empty states**, as a single row of `c.secondary` text without a badge:
  - transcript pending: `"Transcribing… the transcript appears here"`;
  - no speech in the run: `"No speech detected in this run"`.
- The transcript is read-only on this page. Editing stays on Rehearse.

### 5.5 Slides (16, 693, 358, 83)

- **Header row** (y 693, h 17): `space-between`, centred vertically.
  - **Left:** `"Slides"` in `F.bold` 14 `c.text`.
  - **Right:** the legend, four items with gap 9. Each item, with an inner gap of 4:
    - a dot, 8 × 8, radius 4, grade fill;
    - the count in `F.bold` 11.5 `c.text` (the prototype uses weight 800, which is not loaded);
    - the label in `F.semibold` 11.5 `c.secondary`.

    Example: `● 11 Strong  ● 3 Good  ● 2 Needs work  ● 2 Weak`.
- **Card** (16, 718, 358, 58): margin-top 8, height **58**, `borderWidth 1` `c.hair`, `borderRadius 18`, background `c.surface06`, `overflow hidden`.
- **Strip:** a horizontal `ScrollView` filling the card.
  - `showsHorizontalScrollIndicator={false}`.
  - Content padding horizontal 8, gap 8, items centred vertically.
  - The first tile is at (25, 726), and tiles step every 50.
  - The prototype fades the left and right 10. Treat that the same way as the transcript fade (§5.4).
- **Tile:** one per slide, including slides that were not reached.
  - Size **42 × 42**, radius **11**, column layout, centred, gap 2.
  - Number: `F.display` 15, line height 15.
  - Time: `F.semibold` 9.5, opacity 0.72, tabular.
  - Graded slide: background = grade fill, text `#14161D`, time `fmt(times[i])`.
  - Not reached: background `c.ink08`, text `c.secondary`, time `"—"`.
  - Pending: background `c.ink08`, text `c.secondary`, time `fmt(times[i])`.
  - **Current slide** while playing or paused: draw an outline as an absolutely positioned `View` at inset −4, with `borderWidth 2`, `borderColor c.strong` and radius 15, so there is a 2-unit gap between the tile and the outline. It fits inside the 58-high card because 7 units are free above and below the tile.
- **Tap a tile:** open that slide on Review (§8).
  - Accessibility label: `"Slide 5, Problem, 0:49, weak. Open its review"`, or `"… not reached …"`.
- **Following:** when the slide under the playhead changes, scroll the strip so that tile is centred horizontally, animated. Skip this while the user is dragging the strip.

### 5.6 Hint row

| From | Hints |
|---|---|
| Opened from Home (`nav.from === 'home'`) | `h-dn` "Back" (nudge down) · `h-tap` "Tap a slide to review it" |
| Opened from Review (`nav.from === 'review'`) | `h-dn` "Back to review" (nudge down) · `h-tap` "Tap a slide to review it" |

### 5.7 Gestures

- **Swipe down to go back:** use the same `PanView` setup, fade and thresholds as Review (`BACK_T`, `BACK_FADE_Y`, the in-place opacity fade). There is no upward gesture.
- **`onMoveShould`:** claim only vertical moves (`|dy| > 8 && |dy| > |dx|`) that **start outside**:
  - the transcript list (y 343 to its bottom; use its `onLayout` frame);
  - the section bar (y 301–333);
  - the slide strip card (y 718–776).
- **Android back:** the same as swipe down (`useBack`).

---

## 6. Playback engine

Use the existing `useSegmentPlayer` (expo-audio) on both pages. Do **not** use text-to-speech; the prototype's speech was only a stand-in for real audio.

1. **Hook change.** `useSegmentPlayer` must also return `elapsedMs`:
   - the sum of the lengths of the finished segments, plus `pos − segment.startMs` for the current one;
   - update it on the same 50 ms timer as `progress`.

   This is the only change to the hook. Existing callers keep working.
2. **Whole run.**
   - For each reached slide `i` in order with `part = run.parts[i]` and `uri = audioOf(part.attemptId)`: if `uri` is non-null, add `part.segments.map(s => ({ uri, ...s }))`, and record a plan entry `{ slide: i, runStart: starts[i], durMs: times[i] × 1000 }`.
   - Slides with no audio on the phone are skipped.
   - Key: `` `run:${deck.id}` ``.
   - **Position:** map `elapsedMs` onto the run by walking the plan entries in order. Subtract each entry's `durMs` until the remainder fits; then `pos = runStart + remainder / 1000`.
   - If no slide has audio, nothing plays. The header's right text shows `"Audio for this run isn’t on this phone"` in `c.tertiary` for 3 s.
3. **One slide.**
   - Key: `` `slide:${deck.id}:${i}` ``.
   - Segments: `part.segments` with that slide's `uri`.
   - Position: `pos = starts[i] + elapsedMs / 1000`.
   - No audio: show `"Audio for this slide isn’t on this phone"` for 3 s.
4. **Paused state.**
   - `useSegmentPlayer` reports `paused`. Show `p-play` while paused or idle, and `p-pause` while playing.
   - While paused, keep the fill, the current-line highlight and the tile outline.
5. **Stop** playback (`player.stop()`):
   - when the screen becomes inactive or unmounts;
   - when Review's selected slide changes;
   - before any navigation from the screen.

---

## 7. Home: the % ring opens Full review

- In `HomeScreen`, inside the `homeControls` layer and **after** `<StatsPanel/>`, add a transparent `Pressable`:
  - absolute at (**28, 555, 120, 120**), `borderRadius 60`, `zIndex 4`;
  - over the ring only, not the stat rows.

  `StatsPanel` itself stays `pointerEvents="none"`.
- Render it only when the front deck has a run: `getDeckState(deck.id).run`, the same state `StatsPanel` reads through `cachedHomeModel`.
- **On press:**
  - Do nothing while the carousel is between decks (`abs(p − round(p)) ≥ 0.2`), while a vertical pull is active (`vy ≠ 0`), or while the icon picker or credits are open.
  - Otherwise call `go('full', { nav: 'fade', deckId: front.id, from: 'home' })`.
- **Accessibility label:** `"Full review of OutLoud Project Proposal: 91% of slide points said"`, or `"Full review of …"` when coverage is null.
- The carousel gesture area ends at y 550, so it does not overlap the ring. No gesture changes are needed.

## 8. Navigation

1. **`shared.ts`:**
   - Add `'full'` to `ScreenName`.
   - Add `from: ScreenName | null` to `NavState`. The initial Home layer in `AppShell` gets `from: null`.
2. **`AppShell.go`:**
   - **Pushing a new layer:** set `from` from `patch.from ?? null`. Do **not** inherit it from the layer underneath.
   - **Returning to an existing layer:** keep that layer's own `from` unless the patch includes `from`.
   - **`LayerScreen`:** map `'full'` to `<FullReviewScreen active={active} />`.
   - **Ambient glow:** `DeckGlow` already uses `isCurrent` for non-Home screens, so it works for `'full'` with no change.
3. **Entry points and targets:**

| Action | Call |
|---|---|
| Home % ring | `go('full', { nav: 'fade', deckId, from: 'home' })` |
| Review → Full review button, when `nav.from === 'full'` | `go('full', { deckId })`. This returns to the Full review layer underneath; do not pass `from`. |
| Review → Full review button, otherwise | `go('full', { nav: 'fade', deckId, from: 'review' })` |
| Full review → back, when `nav.from === 'review'` | `go('review', { deckId })`. This reveals the Review underneath with its slide unchanged. |
| Full review → back, otherwise | `go('home')` |
| Full review → tile `i`, when `nav.from === 'review'` | `go('review', { deckId, sel: i })`. This returns to the Review underneath on slide `i`. |
| Full review → tile `i`, otherwise | `go('review', { nav: 'fade', deckId, sel: i, from: 'full' })` |
| Review → back, when `nav.from === 'full'` | `go('full', { deckId })` |
| Review → back, otherwise | Unchanged (`toSlides`) |
| Rehearse → Review, after a run or via the Review button | Unchanged, except pass `from: null` explicitly |

4. **Keep Review's slide in sync.** `ReviewScreen` initialises `sel` from `nav.sel` once. Add an effect that sets `sel` whenever `nav.sel` changes, clamped to `0 … n−1`. Returning to an existing Review layer with a new `sel` must show that slide.
5. **The stack stays shallow:**
   - Home → Full → Review(slide), or
   - Rehearse → Review → Full (→ back to Review).

   There are no loops, because Full and Review only ever return to the layer beneath them.

---

## 9. Accessibility summary

- **Review ring row:** one element, `"Slide 5 of 18: 12%, Weak"`.
- **Review playback strip:** `"Play slide 5, 0:49"`, `"Pause slide 5"`, or `"Slide 5 was not reached"`.
- **Labels from earlier sections:**
  - Full review button, §4.5;
  - Whole run controls, §5.3;
  - tiles, §5.5;
  - Home ring, §7.
- **The transcript list** is a normal `ScrollView`. Each row is read as `"Slide 5. <text>"` on its first line, and as just the text after that.

## 10. Tests to add

In `mobile/tests/`, using the same loader as `redesign-domain.test.mjs`:

- **`slideGrade`:**
  - a not-reached slide gives `'none'`;
  - a slide exactly on target with no fillers or issues scores 100, `'green'`;
  - the time penalty caps at 40, and the filler penalty caps at 24;
  - each "note" (missing point, spill, AI suggestion) removes 8;
  - the boundaries 85, 70 and 55 map to green, yellow, orange and red.
- **`feedbackRows`:**
  - always 4 rows, in the fixed icon order;
  - `"Spot On!"` when a row has nothing to fix;
  - the not-reached, pending and no-slide-text texts;
  - an AI suggestion lands in row 4;
  - an AI "audience" suggestion with icon `i-bubble` never replaces the filler row.
- **Run position mapping (§6.2):**
  - with all slides present;
  - when a slide's audio is missing, the following slides still map to their true run positions.

## 11. Rules the prototype does not cover (proposals, not yet confirmed by JJ)

1. **Pause and resume instead of stop.** Real runs are minutes long, so a second tap pauses and keeps the position (`useSegmentPlayer` toggle). The prototype stopped instead, because its simulated audio was short.
2. **Pending transcripts:**
   - the slide's grade is `'pending'`: a neutral tile, not counted in the legend;
   - the rings show `"…"` with "Transcribing";
   - the rows show the transcription status.

   Without this, a slide would show "Spot On!" before its words are known.
3. **AI suggestions request** is a trailing "Ask AI" button in row 4 (§4.6), so the card stays four rows.
4. **No slide text:** row 3 reads "No slide text to check" instead of claiming "Spot On!".
5. **Missing audio** shows short notes (§6). Whole-run playback skips slides whose audio is not on the phone.
6. **Edge fades** on the transcript and strip are optional; do not add a dependency for them.

---

## 12. Checklist

**Review**
- [ ] The total, chips, tip, Strongest/Needs-most-work tiles and filler chips are gone.
- [ ] The ring row at (16, 140, 358, 120): the ring arc uses the grade gradient and animates over 450 ms; the label reads "Slide N of M"; there are 3 stat rows.
- [ ] "Times per slide" is unchanged, at y 278. The pan exclusion band is now 296–404.
- [ ] The slide card is fixed at (16, 419, 358, 281):
  - preview 170 × 96, radius 12;
  - title 17, up to 2 lines;
  - playback strip at y 540.5;
  - exactly 4 rows at y 581, 609, 637 and 665;
  - "Spot On!" in `F.bold` `c.good`;
  - rows are one line each.
- [ ] The playback strip plays, pauses and resumes the selected slide, and stops on slide change, navigation and background.
- [ ] The Full review button is at (16, 718, 358, 58), with the grade grid, title, counts and chevron.
- [ ] The hint row changes with `nav.from`.
- [ ] Pending, not-reached, no-slide-text and AI-request states keep the card size.

**Full review**
- [ ] The screen is registered as `'full'`. The header label starts with "Full review ·".
- [ ] The ring row is in the same place as Review's, shows coverage like Home, and has 4 stat rows (the delta row, or the points row when there is no delta).
- [ ] Whole run:
  - borderless triangle button at (4, 301, 32, 32);
  - grey section bar 6 tall that fills as it plays;
  - one-slide playback dims the other sections to 0.35;
  - header texts as in §5.3.
- [ ] The transcript list sits between y 343 and the Slides header, with plain number badges. The current line is semibold `c.strong` and stays centred while playing.
- [ ] Slides:
  - header and legend at y 693;
  - card at (16, 718, 358, 58);
  - 42 × 42 tiles in grade fills, scrolling sideways, outlined while current, following playback;
  - a tap opens Review on that slide.
- [ ] Back and tile navigation follow §8, with no loops.

**Home**
- [ ] The ring tap target at (28, 555, 120, 120) opens Full review for the front deck, and only when it has a run.

**Both**
- [ ] Dark and light themes use palette colours. Only the grade fills, ring gradients and `#14161D` are literal.
- [ ] `npm run check` passes, and the new tests are added.

## 13. Reference images (`docs/assets/interface/references/review-full-review/`)

These are rendered from the prototype at 2× (780 × 1688 pixels for the 390 × 844 frame). The content is the prototype's sample data, so compare layout, sizes, colours and states, not the words.

| File | Shows |
|---|---|
| `review-dark-slide5.png` | Review, a slide with issues: 12% Weak, all four rows have findings |
| `review-dark-slide7-spot-on.png` | Review, a mostly clean slide: three rows "Spot On!", one "Not said" |
| `review-light-slide6-playing.png` | Review in light mode, the slide playback strip partway through |
| `full-review-dark-idle.png` | Full review, idle |
| `full-review-dark-slide8-playing.png` | Full review, one slide playing: other sections dimmed, header shows slide time |
| `full-review-light-whole-run-playing.png` | Full review in light mode, whole run playing, current transcript line highlighted, current tile outlined |
| `full-review-dark-24-slides.png` | Full review for a 24-slide deck, delta row "slower than last" |
| `home-dark-ring-entry.png` | Home: the ring that opens Full review |

Icons: `docs/assets/interface/icons/full-review-grades.svg` and `docs/assets/interface/icons/chevron-right.svg`.

## 14. Handoff

This is a single implementation pass; there is no review round.

- Log the prompt and the work in `docs/ai-collaboration-prompts-iteration-2.md`, as `AGENTS.md` requires.
- In that entry, list every place where the implementation differs from this spec and why. Include any §11 proposal that was changed.
- Report the checks that were run and anything left unverified, such as device playback or light mode on a device.
- Optional: save device screenshots under the §13 file names in `docs/evidence/iteration-2/interface/review-full-review/` so the result can be compared with the references.

## 15. Prompt for Codex

```text
Implement the redesigned Review page and the new Full review screen in one pass, exactly as specified in docs/review-and-full-review-spec.md.

Read first:
- AGENTS.md and mobile/AGENTS.md.
- The whole spec.
- The reference renders in `docs/assets/interface/references/review-full-review/`. They are the target images from the design prototype; compare layout, sizes, colours and states, not the sample text.
- The icons `docs/assets/interface/icons/full-review-grades.svg` and `docs/assets/interface/icons/chevron-right.svg`.

Build:
1. Domain (§3): grade colours, slideGrade and feedbackRows in mobile/src/domain/analysis.ts.
2. Playback (§6): add elapsedMs to useSegmentPlayer. Play the real recorded audio (audioOf with the run.parts segments). Do not use text-to-speech.
3. Review (§4): rebuild mobile/src/screens/ReviewScreen.tsx to the frame map in §4.1:
   - the slide score ring row;
   - the unchanged "Times per slide" block at y 278;
   - the fixed-size slide card with the 170×96 preview, the slide playback strip and exactly four feedback rows ("Spot On!" when a row is clean);
   - the Full review button at (16, 718, 358, 58).
   Remove the total time, run chips, tip, Strongest/Needs most work tiles and filler chips from the screen, but keep their domain functions.
4. Full review (§5): a new screen 'full' in mobile/src/screens/FullReviewScreen.tsx, built to the frame map in §5.1:
   - the ring row;
   - the Whole run player with the section bar;
   - the scrolling transcript that follows playback;
   - the sideways slide strip.
5. Home (§7): a transparent tap target over the % ring that opens Full review.
6. Navigation (§8):
   - add 'full' to ScreenName and add NavState.from;
   - add the AppShell routing and the back and tile rules;
   - keep Review's selected slide in sync with nav.sel.

Rules:
- Everything in §2 stays as it is, especially:
  - the "Times per slide" block (only its y moves);
  - the existing back and forward fades;
  - the Q&A gesture;
  - MiniSlide's real page images;
  - the transcription and AI-coaching behaviour.
- Use the theme palette colours (c.*). The only literal colours are the grade fills, the ring gradients and #14161D.
- Implement the §11 proposals as written unless they conflict with existing behaviour; record any change.
- Add no new dependencies. Skip the optional edge fades if there is no masking component.
- Do not commit or push.

Finish:
- Add the §10 tests and run npm run check; fix any failures.
- Build and install on the device. Check both pages in dark and light mode, including whole-run and single-slide playback.
- Log this prompt and the work in docs/ai-collaboration-prompts-iteration-2.md as AGENTS.md requires. List any deviation from the spec and anything you could not verify.
```
