// AI-generated with Claude (Anthropic), integrated by OpenAI Codex, Iteration 4 (2026-11-21).
// "How OutLoud works": the eight-page guide from the design prototype (project/App.dc.html), drawn 1:1 in the
// 390 × 844 frame. Fixed header; the pages slide as one strip; dots and hints stay put. Swipe sideways between
// pages, swipe down (or Back, or "Got it" on the last page) to close. It opens by itself once, on first launch.
import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue,
  withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Txt, useFrame } from '../design/frame';
import { Glyph, PresentationIcon, UIIcon, type GlyphName } from '../design/icons';
import { useAppLanguage, useUiText } from '../design/language';
import { LanguageToggle } from '../design/LanguageToggle';
import { ThemeToggle } from '../design/ThemeToggle';
import { EASE_SCREEN, F } from '../design/tokens';
import { useTheme } from '../design/theme';

/** Header topic, page title and the words under the card, in prototype order. */
export const TUTORIAL_PAGES: readonly { topic: string; title: string; body: string }[] = [
  { topic: 'Gestures', title: 'Spin, tap, pull', body: 'Your presentations sit in one row on Home. Most things work by gesture, and the hints along the bottom of each screen show which ones work there.' },
  { topic: 'Add', title: 'Add a presentation', body: 'Pull up on Home and choose a PDF of your slides. OutLoud reads every slide, then asks how long you have and who’s listening.' },
  { topic: 'Rehearse', title: 'Rehearse out loud', body: 'Tap the red button and talk through your slides. Swipe the card to move on; every slide is timed. Tap again to stop. Turn your phone sideways for a bigger slide.' },
  { topic: 'Your score', title: 'Your score on Home', body: 'The % is how many of your slide points you said in the last run. Its colour is the grade. Below it: critical (red) slides, your time against the target, and your pace.' },
  { topic: 'Review', title: 'Every slide, colour coded', body: 'Review scores each slide out of 100 and colours it. Work on the red and orange slides first.' },
  { topic: 'Slide review', title: 'One slide up close', body: 'Tap a slide to see its review. The ring scores that slide. Four tiles check time, fillers, key points and delivery; tap one for detail.' },
  { topic: 'Listen back', title: 'Hear yourself back', body: 'Play back your run and the transcript follows along, line by line, so you can hear where you rushed or drifted.' },
  { topic: 'Q&A', title: 'Practise the Q&A', body: 'On Review, swipe up for Audience Q&A. A simulated panel asks questions drawn from your slides. Answer out loud and get a verdict.' },
];
const N = TUTORIAL_PAGES.length;
const W = 390;
// OpenAI Codex, 2026-11-23: give the tutorial content more space below the fixed language switch.
const CONTENT_OFFSET = 12;

// The prototype's own colours for this screen (its --t1 … --bad variables), so both themes match it exactly.
const GUIDE = {
  dark: { bg: '#121111', t1: '#F9F9F9', t2: '#E8E5E5', t3: '#D8D3D3', t4: '#C6C1C1', tm: '#A8A3A3', tm2: '#8F8A8A',
    meta: 'rgba(255,255,255,0.62)', track: '#2A2727', dotOff: '#4A4545', hair: 'rgba(255,255,255,0.1)',
    s06: 'rgba(255,255,255,0.06)', s08: 'rgba(255,255,255,0.08)', s10: 'rgba(255,255,255,0.1)', s12: 'rgba(255,255,255,0.12)',
    b14: 'rgba(255,255,255,0.14)', b30: 'rgba(255,255,255,0.3)', b50: 'rgba(255,255,255,0.5)', i18: 'rgba(255,255,255,0.18)',
    ok: '#3FD9A4', warn: '#FF9A3D', bad: '#FF6B5E', gold: '#FFD866' },
  light: { bg: '#F9F9F9', t1: '#121111', t2: '#2B2828', t3: '#3D3939', t4: '#4E4A4A', tm: '#5E5959', tm2: '#767171',
    meta: 'rgba(18,17,17,0.58)', track: 'rgba(18,17,17,0.09)', dotOff: 'rgba(18,17,17,0.2)', hair: 'rgba(18,17,17,0.1)',
    s06: 'rgba(255,255,255,0.55)', s08: 'rgba(255,255,255,0.68)', s10: 'rgba(255,255,255,0.78)', s12: 'rgba(255,255,255,0.88)',
    b14: 'rgba(18,17,17,0.12)', b30: 'rgba(18,17,17,0.24)', b50: 'rgba(18,17,17,0.42)', i18: 'rgba(18,17,17,0.15)',
    ok: '#08875C', warn: '#B35400', bad: '#C2392C', gold: '#946300' },
} as const;
type P = { [K in keyof typeof GUIDE.dark]: string };
/** Tile and swatch colours on page 5 are fixed in both themes. */
const GRADE = { strong: '#3FD9A4', good: '#FFD866', work: '#FF9A3D', weak: '#FF6B5E' };
const SNAP = Easing.bezier(0.25, 1, 0.5, 1);

// ── Looping demo animations (the prototype's olTut* keyframes) ──────────────────
type Key = readonly (readonly [number, number])[];
/** CSS-style keyframes: `mode` 0 linear, 1 ease-in-out, 2 ease-out, 3 step-end; easing applies per segment. */
function keyed(t: number, keys: Key, mode: 0 | 1 | 2 | 3): number {
  'worklet';
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0] || (t === keys[i][0] && i === keys.length - 1)) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i];
      if (mode === 3) return va;
      const p = b === a ? 1 : (t - a) / (b - a);
      const e = mode === 1 ? p * p * (3 - 2 * p) : mode === 2 ? 1 - (1 - p) * (1 - p) : p;
      return va + (vb - va) * e;
    }
  }
  return keys[keys.length - 1][1];
}
const SWIPE_X: Key = [[0, 56], [0.12, 56], [0.55, -56], [0.68, -56], [1, -56]];
const SWIPE_O: Key = [[0, 0], [0.12, 1], [0.55, 1], [0.68, 0], [1, 0]];
const CAR_X: Key = [[0, 0], [0.14, 0], [0.55, -20], [0.78, 0], [1, 0]];
const FILL_W: Key = [[0, 0], [0.75, 1], [1, 1]];
const LINES_Y: Key = [[0, 0], [0.2, 30], [0.4, 60], [0.6, 90], [0.8, 120], [1, 120]];
const NUDGE_UP: Key = [[0, 2], [0.5, -3], [1, 2]];
const NUDGE_DOWN: Key = [[0, -2], [0.5, 3], [1, -2]];
const RAMP: Key = [[0, 0], [1, 1]];

type Clocks = { car: SharedValue<number>; pulse: SharedValue<number>; fill: SharedValue<number>; play: SharedValue<number>;
  nudge: SharedValue<number>; still: boolean };
function useLoop(ms: number, run: boolean) {
  const t = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(t);
    t.set(0);
    if (!run) return;
    t.set(withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [ms, run, t]);
  return t;
}

/** Translucent finger dot that slides right to left across the card (olTutSwipe, 2.6 s). */
function SwipeDot({ k, top, p }: { k: Clocks; top: number; p: P }) {
  const style = useAnimatedStyle(() => k.still ? { opacity: 0 }
    : { opacity: keyed(k.car.value, SWIPE_O, 1), transform: [{ translateX: keyed(k.car.value, SWIPE_X, 1) }] });
  return <Animated.View pointerEvents="none" style={[s.swipeDot, { top, borderColor: p.b50, backgroundColor: p.s12 }, style]} />;
}
/** Content that drifts 20 px left and back in time with the swipe dot (olTutCar). */
function Drift({ k, style, children }: { k: Clocks; style: object; children: ReactNode }) {
  const drift = useAnimatedStyle(() => ({ transform: [{ translateX: k.still ? 0 : keyed(k.car.value, CAR_X, 1) }] }));
  return <Animated.View style={[style, drift]}>{children}</Animated.View>;
}
/** A ring that grows and fades out from its target, every 1.8 s (olTutPulse). */
function Pulse({ k, style }: { k: Clocks; style: object }) {
  const pulse = useAnimatedStyle(() => k.still ? { opacity: 0.5 } : {
    opacity: 0.9 * (1 - keyed(k.pulse.value, RAMP, 2)),
    transform: [{ scale: 0.92 + 0.38 * keyed(k.pulse.value, RAMP, 2) }],
  });
  return <Animated.View pointerEvents="none" style={[style, pulse]} />;
}
/** A progress fill: `kind` fill repeats 0 → 100% over 3.2 s, play runs linearly over 10 s. */
function Fill({ k, kind, rest, style }: { k: Clocks; kind: 'fill' | 'play'; rest: number; style: object }) {
  const width = useAnimatedStyle(() => ({ width: `${100 * (k.still ? rest
    : kind === 'fill' ? keyed(k.fill.value, FILL_W, 1) : k.play.value)}%` }));
  return <Animated.View style={[s.fill, style, width]} />;
}
function Nudge({ k, up, children }: { k: Clocks; up: boolean; children: ReactNode }) {
  const nudge = useAnimatedStyle(() => ({ transform: [{ translateY: k.still ? 0 : keyed(k.nudge.value, up ? NUDGE_UP : NUDGE_DOWN, 1) }] }));
  return <Animated.View style={nudge}>{children}</Animated.View>;
}
/** The transcript highlight steps down one line every 2 s, in time with the play bar (olTutLines). */
function LineHighlight({ k, p }: { k: Clocks; p: P }) {
  const step = useAnimatedStyle(() => ({ transform: [{ translateY: k.still ? 0 : keyed(k.play.value, LINES_Y, 3) }] }));
  return <Animated.View style={[s.lineHighlight, { backgroundColor: p.s10 }, step]} />;
}

// ── Small drawings ────────────────────────────────────────────────────────────
function PdfIcon({ size, color }: { size: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M7 2.5h7l4.5 4.5v13A1.5 1.5 0 0 1 17 21.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5Z M14 2.5V7h4.5" fill="none"
      stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    <SvgText x={12} y={16.6} fontSize={5.6} fontFamily={F.bold} textAnchor="middle" letterSpacing={0.2} fill={color}>PDF</SvgText>
  </Svg>;
}
function WarnIcon({ size, color }: { size: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 3.6 L21.2 19.8 H2.8 Z M12 9.6 V14" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={17.1} r={1.2} fill={color} />
  </Svg>;
}
function MicIcon() {
  return <Svg width={26} height={26} viewBox="0 0 24 24">
    <Rect x={9} y={3} width={6} height={11} rx={3} fill="#FFFFFF" />
    <Path d="M5.5 11 A6.5 6.5 0 0 0 18.5 11" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
    <Path d="M12 17.5 V20.5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
  </Svg>;
}
const Divider = ({ top, p }: { top: number; p: P }) => <View style={[s.divider, { top, backgroundColor: p.hair }]} />;
function Pill({ icon, text, p }: { icon: GlyphName; text: string; p: P }) {
  return <View style={[s.pill, { borderColor: p.hair, backgroundColor: p.s08 }]}>
    <Glyph name={icon} size={16} color={p.t2} /><Txt style={[s.pillText, { color: p.t2 }]}>{text}</Txt>
  </View>;
}

// ── The eight cards ───────────────────────────────────────────────────────────
function GesturesCard({ k, p }: { k: Clocks; p: P }) {
  const rows: [GlyphName, string, string][] = [['h-spin', 'Spin', 'Browse your presentations'], ['h-tap', 'Tap', 'Open one'],
    ['h-hold', 'Hold', 'Change its icon'], ['h-up', 'Pull up', 'Add a presentation'], ['h-dn', 'Pull down', 'Delete one (you can undo)']];
  return <>
    <Drift k={k} style={s.iconRow}>
      <PresentationIcon icon="rocket" hue="lilac" size={52} sheen={false} style={[s.at, { left: 34, top: 24, opacity: 0.4 }]} />
      <PresentationIcon icon="cap" hue="lilac" size={84} style={[s.at, { left: 128, top: 4 }]} />
      <PresentationIcon icon="chart" hue="lilac" size={52} sheen={false} style={[s.at, { left: 254, top: 24, opacity: 0.4 }]} />
    </Drift>
    <View style={[s.centre, { top: 112 }]}>
      <Txt style={[s.deckTitle, { color: p.t1 }]}>Thesis defence</Txt>
      <Txt style={[s.deckMeta, { color: p.meta }]}>18 slides · 15 min</Txt>
    </View>
    <SwipeDot k={k} top={46} p={p} />
    <Divider top={160} p={p} />
    <View style={s.gestureRows}>{rows.map(([icon, label, detail]) => <View key={label} style={s.gestureRow}>
      <Glyph name={icon} size={20} color={p.t1} />
      <Txt style={[s.gestureLabel, { color: p.t1 }]}>{label}</Txt>
      <Txt numberOfLines={1} style={[s.gestureDetail, { color: p.tm }]}>{detail}</Txt>
    </View>)}</View>
  </>;
}

const TICKS = Array.from({ length: 31 }, (_, i) => i);
function AddCard({ k, p }: { k: Clocks; p: P }) {
  return <>
    <View style={[s.row, s.fileRow]}>
      <View style={[s.fileBox, { borderColor: p.hair, backgroundColor: p.s10 }]}><PdfIcon size={28} color={p.tm} /></View>
      <View style={s.grow}>
        <Txt style={[s.fileName, { color: p.t1 }]}>Pitch deck.pdf</Txt>
        <Txt style={[s.fileMeta, { color: p.tm }]}>14 pages</Txt>
      </View>
      <View style={[s.row, { gap: 4 }]}>
        <Nudge k={k} up><Glyph name="h-up" size={16} color={p.tm} /></Nudge>
        <Txt style={[s.small, { color: p.tm }]}>Pull up</Txt>
      </View>
    </View>
    <View style={[s.band, { top: 88 }]}>
      <Txt style={[s.small, { color: p.tm }]}>Reading every slide…</Txt>
      <View style={[s.bar, { height: 6, marginTop: 8, backgroundColor: p.track }]}><Fill k={k} kind="fill" rest={0.64} style={{ borderRadius: 3, backgroundColor: p.t1 }} /></View>
    </View>
    <Divider top={134} p={p} />
    <View style={[s.centre, { top: 146 }]}>
      <Txt style={[s.small, { color: p.tm }]}>How long is it?</Txt>
      <Txt style={[s.bigTime, { color: p.t1 }]}>10:00</Txt>
    </View>
    <View style={s.ruler}>
      {TICKS.map(i => <View key={i} style={[s.tick, i % 5 === 0 ? { top: 10, height: 16, backgroundColor: p.b50 } : { top: 17, height: 9, backgroundColor: p.b30 }, { left: 19 + i * 10 }]} />)}
      <View style={[s.tick, { left: 169, top: -2, height: 30, backgroundColor: p.t1 }]} />
    </View>
    <View style={[s.centre, { top: 246 }]}>
      <Txt style={[s.small, { color: p.tm }]}>Who’s listening?</Txt>
      <View style={[s.row, s.chipRow, { gap: 8 }]}>{['Students', 'Clients', 'Colleagues'].map(name => {
        const on = name === 'Clients';
        return <View key={name} style={[s.audience, { borderColor: on ? p.t1 : p.b14, backgroundColor: on ? p.t1 : p.s08 }]}>
          <Txt style={[s.audienceText, { color: on ? p.bg : p.t2 }]}>{name}</Txt></View>;
      })}</View>
    </View>
  </>;
}

function RehearseCard({ k, p }: { k: Clocks; p: P }) {
  return <>
    <Drift k={k} style={s.slideCard}>
      <View style={s.slideFace}>
        <Txt style={s.slideKicker}>Pitch deck</Txt>
        <Txt style={s.slideTitle}>Market size</Txt>
        <View style={s.slideRule} />
        {['12M students present every term', 'Most rehearse with no feedback'].map((line, i) => <View key={line} style={[s.bullet, i === 0 && { marginTop: 3 }]}>
          <View style={s.bulletMark} /><Txt style={s.bulletText}>{line}</Txt></View>)}
      </View>
    </Drift>
    <SwipeDot k={k} top={36} p={p} />
    <View style={[s.band, { top: 164 }]}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Txt style={[s.slideNo, { color: p.t1 }]}>Slide 3</Txt>
        <Txt style={[s.slideClock, { color: p.tm }]}>0:42 of 1:00</Txt>
      </View>
      <View style={[s.bar, { height: 5, marginTop: 7, backgroundColor: p.track }]}><View style={[s.fill, { width: '70%', borderRadius: 3, backgroundColor: p.t1 }]} /></View>
    </View>
    <View style={s.record}>
      <Pulse k={k} style={s.recordRing} />
      <View style={s.recordButton}><MicIcon /></View>
    </View>
    <View style={[s.row, s.recordHints]}>{([['h-tap', 'Tap to record'], ['h-spin', 'Next slide'], ['h-hold', 'Redo all']] as const).map(([icon, text]) =>
      <View key={text} style={[s.row, { gap: 4 }]}><Glyph name={icon} size={16} color={p.tm} /><Txt style={[s.tiny, { color: p.tm }]}>{text}</Txt></View>)}</View>
  </>;
}

function ScoreCard({ k, p }: { k: Clocks; p: P }) {
  const stats: [string, string, boolean][] = [['2', 'critical', true], ['12:47', 'of 10:00', false], ['148', 'wpm', false]];
  const grades: [string, string, string][] = [[p.ok, 'Strong', '85% or more'], [p.gold, 'Good', '70–84%'], [p.warn, 'Needs work', '55–69%'], [p.bad, 'Weak', 'Under 55%']];
  return <>
    <View style={s.score}>
      <Pulse k={k} style={[s.scoreRing, { borderColor: p.b50 }]} />
      <View style={[StyleSheet.absoluteFill, s.middle]}><View style={[s.row, { alignItems: 'baseline' }]}>
        <Txt style={[s.scoreValue, { color: p.ok }]}>91</Txt><Txt style={[s.scoreUnit, { color: p.ok }]}>%</Txt>
      </View></View>
    </View>
    <View style={[s.row, s.stats]}>{stats.map(([value, label, warn], i) => <View key={label}
      style={[s.stat, i === 1 && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: p.hair }]}>
      <View style={[s.row, { height: 22, gap: 5 }]}>{warn && <WarnIcon size={18} color={p.bad} />}<Txt style={[s.statValue, { color: p.t1 }]}>{value}</Txt></View>
      <Txt style={[s.statLabel, { color: p.tm }]}>{label}</Txt>
    </View>)}</View>
    <Divider top={160} p={p} />
    <View style={s.legend}>{grades.map(([color, label, range]) => <View key={label} style={[s.row, s.legendRow]}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Txt style={[s.legendLabel, s.grow, { color: p.t1 }]}>{label}</Txt>
      <Txt style={[s.legendRange, { color: p.tm }]}>{range}</Txt>
    </View>)}</View>
    <View style={[s.pillLine, { top: 300 }]}><Pill icon="h-tap" text="Tap the score for Review" p={p} /></View>
  </>;
}

const TILES: [string, string][] = [[GRADE.strong, '0:48'], [GRADE.strong, '1:02'], [GRADE.good, '1:12'], [GRADE.weak, '2:05'], [GRADE.work, '1:31'], [GRADE.strong, '0:55']];
function ReviewCard({ k, p }: { k: Clocks; p: P }) {
  const swatches: [string, string, string][] = [[GRADE.strong, 'Strong', '85–100'], [GRADE.good, 'Good', '70–84'], [GRADE.work, 'Needs work', '55–69'], [GRADE.weak, 'Weak', 'Under 55']];
  return <>
    <View style={[s.row, s.band, { top: 18, justifyContent: 'space-between' }]}>
      <Txt style={[s.label13, { color: p.t1 }]}>Slides</Txt>
      <Txt style={[s.label13, { fontFamily: F.medium, color: p.tm }]}>Score out of 100</Txt>
    </View>
    <View style={[s.row, s.tileStrip, { borderColor: p.hair, backgroundColor: p.s06 }]}>{TILES.map(([color, time], i) => <View key={i} style={[s.tile, { backgroundColor: color }]}>
      {i === 3 && <Pulse k={k} style={[s.tileRing, { borderColor: p.b50 }]} />}
      <Txt style={s.tileNo}>{i + 1}</Txt><Txt style={s.tileTime}>{time}</Txt>
    </View>)}</View>
    <View style={s.swatches}>{swatches.map(([color, label, range]) => <View key={label} style={[s.row, s.swatchRow]}>
      <View style={[s.swatch, { backgroundColor: color }]} />
      <Txt style={[s.swatchLabel, s.grow, { color: p.t1 }]}>{label}</Txt>
      <Txt style={[s.swatchRange, { color: p.tm }]}>{range}</Txt>
    </View>)}</View>
    <View style={[s.pillLine, { top: 278 }]}><Pill icon="h-tap" text="Tap a tile to open that slide" p={p} /></View>
  </>;
}

const RING_C = 2 * Math.PI * 55;
function SlideCard({ p }: { p: P }) {
  const tiles: ['i-clock' | 'i-bubble' | 'i-flag' | 'i-wave', string, string, boolean][] = [
    ['i-clock', 'Time', '0:12 over this slide’s 1:00', false], ['i-bubble', 'Fillers', 'Spot On!', true],
    ['i-flag', 'What you said', 'Not said: “pricing tiers”', false], ['i-wave', 'Delivery', 'Spot On!', true]];
  return <>
    <View style={s.ring}>
      <Svg width={92} height={92} viewBox="0 0 128 128">
        <Defs><LinearGradient id="tutorialRingYellow" x1="0" y1="0" x2="0.35" y2="1"><Stop offset="0" stopColor="#FFF4B0" /><Stop offset="1" stopColor="#F5C518" /></LinearGradient></Defs>
        <Circle cx={64} cy={64} r={55} fill="none" stroke={p.track} strokeWidth={13} />
        <Circle cx={64} cy={64} r={55} fill="none" stroke="url(#tutorialRingYellow)" strokeWidth={13} strokeLinecap="round"
          strokeDasharray={`${RING_C.toFixed(2)}`} strokeDashoffset={(RING_C * 0.22).toFixed(2)} transform="rotate(-90 64 64)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.middle]}>
        <Txt style={[s.ringValue, { color: p.t1 }]}>78%</Txt>
        <Txt style={[s.ringGrade, { color: p.gold }]}>Good</Txt>
      </View>
    </View>
    <View style={s.slideHead}>
      <Txt numberOfLines={1} style={[s.slideName, { color: p.tm }]}>Slide 3 · Market size</Txt>
      <View style={[s.row, { gap: 8, marginTop: 10 }]}>
        <Txt style={[s.slideTime, { color: p.t1 }]}>1:12</Txt>
        <View style={[s.over, { backgroundColor: 'rgba(255,122,107,0.18)' }]}><Txt style={[s.overText, { color: p.bad }]}>+0:12</Txt></View>
      </View>
    </View>
    <Divider top={128} p={p} />
    <View style={s.checks}>{tiles.map(([icon, label, value, good]) => <View key={label} style={[s.row, s.check]}>
      <UIIcon name={icon} size={22} color={p.tm} />
      <View style={s.shrink}>
        <Txt style={[s.checkLabel, { color: p.tm2 }]}>{label}</Txt>
        <Txt numberOfLines={1} style={[s.checkValue, good ? { fontFamily: F.bold, color: p.ok } : { color: p.t2 }]}>{value}</Txt>
      </View>
    </View>)}</View>
  </>;
}

const LINES: [string, string][] = [['3', 'So who actually rehearses out loud?'], ['3', 'Um, most students just read their notes.'],
  ['4', 'Here’s the market: twelve million students.'], ['4', 'Every one of them presents each term.'], ['5', 'And, like, almost none get feedback.']];
function ListenCard({ k, p }: { k: Clocks; p: P }) {
  return <>
    <View style={[s.row, s.band, { top: 20, justifyContent: 'space-between' }]}>
      <Txt style={[s.label13, { color: p.t1 }]}>Whole run</Txt>
      <Txt style={[s.runTime, { color: p.tm2 }]}>9:58</Txt>
    </View>
    <View style={[s.row, s.player]}>
      <Glyph name="p-pause" size={18} color={p.t1} />
      <View style={[s.bar, s.grow, { height: 6, backgroundColor: p.i18 }]}><Fill k={k} kind="play" rest={0.4} style={{ backgroundColor: p.t1 }} /></View>
    </View>
    <View style={s.lines}>
      <LineHighlight k={k} p={p} />
      {LINES.map(([slide, text], i) => <View key={i} style={[s.row, s.line]}>
        <View style={[s.lineBadge, { backgroundColor: p.s12 }]}><Txt style={[s.lineBadgeText, { color: p.t2 }]}>{slide}</Txt></View>
        <Txt numberOfLines={1} style={[s.lineText, { color: p.t2 }]}>{text}</Txt>
      </View>)}
    </View>
    <Divider top={242} p={p} />
    <View style={s.where}>{[['Whole run', 'on Full review'], ['One slide', 'on its review']].map(([what, where]) => <View key={what} style={[s.row, { gap: 8 }]}>
      <Glyph name="p-play" size={14} color={p.t1} />
      <Txt style={[s.whereText, { fontFamily: F.bold, color: p.t1 }]}>{what}</Txt>
      <Txt style={[s.whereText, { color: p.tm }]}>{where}</Txt>
    </View>)}</View>
  </>;
}

function QACard({ p }: { p: P }) {
  const verdicts: [string, string, string][] = [['Answered', 'rgba(63,217,164,0.16)', p.ok], ['Partly answered', 'rgba(255,181,71,0.16)', p.warn], ['Too short', 'rgba(255,122,107,0.18)', p.bad]];
  return <>
    <View style={[s.row, s.band, { top: 20, gap: 11 }]}>
      <View style={[s.avatar, { borderColor: p.hair, backgroundColor: p.s10 }]}><Txt style={[s.avatarText, { color: p.t1 }]}>P1</Txt></View>
      <View style={s.shrink}>
        <Txt style={[s.panelist, { color: p.t1 }]}>First panelist</Txt>
        <Txt style={[s.panelistMeta, { color: p.tm }]}>Slide 4 · Problem</Txt>
      </View>
    </View>
    <Txt style={[s.band, s.question, { top: 70, color: p.t1 }]}>What will OutLoud measure that a stopwatch can’t?</Txt>
    <View style={[s.band, { top: 128, gap: 6 }]}>{[['0:02', 'A stopwatch only gives you the total.'], ['0:18', 'It also checks what you said against the slide.']].map(([at, text]) =>
      <View key={at} style={[s.row, { gap: 8 }]}>
        <Txt style={[s.answer, { color: p.tm2 }]}>{at}</Txt>
        <Txt numberOfLines={1} style={[s.answer, s.shrink, { color: p.t3 }]}>{text}</Txt>
      </View>)}</View>
    <View style={[s.row, s.band, { top: 186, gap: 10 }]}>
      <View style={[s.row, s.verdict]}><UIIcon name="i-check" size={20} color={p.tm} /><Txt style={[s.verdictText, { color: p.ok }]}>Answered</Txt></View>
      <Txt numberOfLines={1} style={[s.answer, s.shrink, { color: p.t2 }]}>You named three things.</Txt>
    </View>
    <Divider top={236} p={p} />
    <View style={[s.centre, { top: 250 }]}>
      <Txt style={[s.small, { color: p.tm }]}>Every answer gets a verdict</Txt>
      <View style={[s.row, s.chipRow, { gap: 6 }]}>{verdicts.map(([text, bg, color]) => <View key={text} style={[s.row, s.verdictChip, { backgroundColor: bg }]}>
        <View style={[s.verdictDot, { backgroundColor: color }]} /><Txt style={[s.verdictChipText, { color }]}>{text}</Txt>
      </View>)}</View>
    </View>
  </>;
}

const CARDS = [GesturesCard, AddCard, RehearseCard, ScoreCard, ReviewCard, SlideCard, ListenCard, QACard] as const;

// ── Pages, dots and the overlay ───────────────────────────────────────────────
const GuidePage = memo(function GuidePage({ index, current, x, k, p, onDone }: { index: number; current: boolean; x: SharedValue<number>;
  k: Clocks; p: P; onDone: () => void }) {
  const Card = CARDS[index];
  const page = TUTORIAL_PAGES[index];
  const language = useAppLanguage();
  const ui = useUiText();
  // Neighbours stay at 20% while you drag; the page being reached comes up to full as it arrives.
  const fade = useAnimatedStyle(() => ({ opacity: Math.max(0.2, 1 - Math.abs(index + x.value / W) * 0.8) }));
  return <Animated.View accessibilityLabel={language === 'ko' ? `${N}개 중 ${index + 1}: ${ui(page.title)}` : `${index + 1} of ${N}: ${page.title}`} accessibilityElementsHidden={!current}
    importantForAccessibility={current ? 'auto' : 'no-hide-descendants'} pointerEvents={current ? 'box-none' : 'none'}
    style={[s.page, { left: index * W }, fade]}>
    <View pointerEvents="none" style={[s.card, { borderColor: p.hair, backgroundColor: p.s06 }]}>
      <View style={s.cardBody}><Card k={k} p={p} /></View>
    </View>
    <View pointerEvents="none" style={s.words}>
      <Txt style={[s.title, { color: p.t1 }]}>{page.title}</Txt>
      <Txt style={[s.body, { color: p.t4 }]}>{page.body}</Txt>
    </View>
    {index === N - 1 && <>
      <Pressable accessibilityRole="button" accessibilityLabel={ui('Got it')} onPress={onDone} style={[s.done, { backgroundColor: p.t1 }]}>
        <Txt style={[s.doneText, { color: p.bg }]}>Got it</Txt>
      </Pressable>
      <Txt style={[s.again, { color: p.tm }]}>Tap OutLoud on Home to see this again</Txt>
    </>}
  </Animated.View>;
});

function Dot({ on, p, still }: { on: boolean; p: P; still: boolean }) {
  const width = useSharedValue(on ? 18 : 6);
  useEffect(() => { width.set(withTiming(on ? 18 : 6, { duration: still ? 0 : 250, easing: EASE_SCREEN })); }, [on, still, width]);
  const style = useAnimatedStyle(() => ({ width: width.value }));
  return <Animated.View style={[s.dot, { backgroundColor: on ? p.t1 : p.dotOff }, style]} />;
}

/**
 * `cover` is how much the guide covers Home (0–1): it rises in over 460 ms and Home fades out under it; on close
 * it slides down and Home fades back in. `closing` lets Back run the same exit.
 */
export function TutorialOverlay({ page, onPage, onClose, cover, closing, showAppearanceControls }: { page: number; onPage: (page: number) => void;
  onClose: () => void; cover: SharedValue<number>; closing: boolean; showAppearanceControls: boolean }) {
  const { mode } = useTheme();
  const language = useAppLanguage();
  const ui = useUiText();
  const p = GUIDE[mode];
  const frame = useFrame();
  const reduced = useReducedMotion();
  const still = !!reduced;
  const car = useLoop(2600, !still), pulse = useLoop(1800, !still), fill = useLoop(3200, !still);
  const play = useLoop(10000, !still), nudge = useLoop(1600, !still);
  const k = useMemo<Clocks>(() => ({ car, pulse, fill, play, nudge, still }), [car, pulse, fill, play, nudge, still]);
  const x = useSharedValue(-page * W);   // strip offset; page k is centred at -k * 390
  const dy = useSharedValue(0);           // downward drag, after the prototype's rubber band past 160
  const leaving = useSharedValue(0);
  const left = useRef(false);

  useEffect(() => {
    cover.set(withTiming(1, { duration: still ? 0 : 460, easing: EASE_SCREEN }));
  }, [cover, still]);
  // Never leave Home hidden if the guide goes away some other way.
  useEffect(() => () => { cancelAnimation(cover); cover.set(0); }, [cover]);
  const leave = () => {
    if (left.current) return;
    left.current = true;
    leaving.set(1);
    dy.set(withTiming(520, { duration: still ? 0 : 320, easing: EASE_SCREEN }));
    cover.set(withTiming(0, { duration: still ? 0 : 280, easing: Easing.out(Easing.quad) }, done => { if (done) runOnJS(onClose)(); }));
  };
  useEffect(() => { if (closing) leave(); });
  const go = (next: number) => {
    const to = Math.max(0, Math.min(N - 1, next));
    x.set(withTiming(-to * W, { duration: still ? 0 : 380, easing: SNAP }));
    if (to !== page) onPage(to);
  };

  const stage = useAnimatedStyle(() => ({
    opacity: cover.value * (leaving.value ? 1 : Math.max(0.15, 1 - dy.value / 260)),
    transform: [{ translateY: (leaving.value ? 0 : (1 - cover.value) * 80) + dy.value * 0.55 }],
  }));
  const strip = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // Compact phones (760 tall): the 844 layout is drawn at 90%; the hints keep their size at the usual compact inset.
  const fit = frame.compact ? { top: (760 - 844) / 2, transform: [{ scale: 760 / 844 }] } : null;
  const last = page === N - 1;
  const gestureScale = frame.s * (frame.compact ? 760 / 844 : 1);
  // OpenAI Codex, Iteration 4 (2026-11-21): own the whole tutorial with the native pan handler used by Home.
  const pan = usePanGesture({
    enabled: !closing,
    minDistance: 8,
    onActivate: () => { cancelAnimation(x); cancelAnimation(dy); },
    onUpdate: e => {
      const tx = e.translationX / gestureScale, ty = e.translationY / gestureScale;
      if (Math.abs(tx) > Math.abs(ty)) {
        const edge = (tx > 0 && page === 0) || (tx < 0 && page === N - 1);
        x.set(-page * W + (edge ? tx * 0.3 : tx));
        dy.set(0);
      } else if (ty > 0) {
        x.set(-page * W);
        dy.set(ty > 160 ? 160 + (ty - 160) * 0.5 : ty);
      }
    },
    onDeactivate: e => {
      const tx = e.translationX / gestureScale, ty = e.translationY / gestureScale;
      if (!e.canceled && Math.abs(tx) > Math.abs(ty) && Math.abs(tx) > 60) {
        const to = Math.max(0, Math.min(N - 1, page + (tx < 0 ? 1 : -1)));
        x.set(withTiming(-to * W, { duration: still ? 0 : 380, easing: SNAP }));
        if (to !== page) runOnJS(onPage)(to);
      } else if (!e.canceled && ty > 110 && ty > Math.abs(tx)) {
        runOnJS(leave)();
      } else {
        x.set(withTiming(-page * W, { duration: still ? 0 : 380, easing: SNAP }));
        dy.set(withTiming(0, { duration: still ? 0 : 320, easing: EASE_SCREEN }));
      }
    },
  });

  return <GestureDetector gesture={pan}><Animated.View collapsable={false} accessibilityViewIsModal
    style={[StyleSheet.absoluteFill, s.overlay]}>
    <Animated.View style={[StyleSheet.absoluteFill, stage]}>
      <View style={[s.frame, fit]} pointerEvents="box-none">
        <View pointerEvents="none" style={s.header}>
          <Txt numberOfLines={1} style={[s.heading, { color: p.t1 }]}>How OutLoud works</Txt>
          <Txt numberOfLines={1} style={[s.topic, { color: p.tm }]}>{language === 'ko' ? `${N}개 중 ${page + 1} · ${ui(TUTORIAL_PAGES[page].topic)}` : `${page + 1} of ${N} · ${TUTORIAL_PAGES[page].topic}`}</Txt>
        </View>
        <Animated.View accessibilityLabel={ui('How OutLoud works')} style={[s.strip, strip]} pointerEvents="box-none">
          {TUTORIAL_PAGES.map((_, i) => <GuidePage key={i} index={i} current={i === page} x={x} k={k} p={p} onDone={leave} />)}
        </Animated.View>
        <View pointerEvents="none" style={s.dots}>{TUTORIAL_PAGES.map((_, i) => <Dot key={i} on={i === page} p={p} still={still} />)}</View>
      </View>
      {showAppearanceControls && <>
        <LanguageToggle />
        <ThemeToggle />
      </>}
      <View style={[s.hints, frame.compact && { bottom: 12 }]} pointerEvents="box-none">
        {!last && <Pressable accessibilityRole="button" accessibilityLabel={ui('Next page')} onPress={() => go(page + 1)} hitSlop={13} style={s.hint}>
          <Glyph name="h-spin" size={18} color={p.tm} /><Txt style={[s.hintText, { color: p.tm }]}>Swipe for more</Txt>
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={ui('Close tutorial')} onPress={leave} hitSlop={13} style={s.hint}>
          <Nudge k={k} up={false}><Glyph name="h-dn" size={18} color={p.tm} /></Nudge><Txt style={[s.hintText, { color: p.tm }]}>Swipe down to close</Txt>
        </Pressable>
      </View>
    </Animated.View>
  </Animated.View></GestureDetector>;
}

const tab = ['tabular-nums'] as ['tabular-nums'];
const s = StyleSheet.create({
  overlay: { zIndex: 55, backgroundColor: 'transparent' },
  frame: { position: 'absolute', left: 0, top: 0, width: W, height: 844 },
  header: { position: 'absolute', left: 40, right: 40, top: 50 + CONTENT_OFFSET, alignItems: 'center' },
  heading: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3 },
  topic: { marginTop: 3, fontFamily: F.medium, fontSize: 13 },
  strip: { position: 'absolute', left: 0, top: CONTENT_OFFSET, width: W * N, height: 760 },
  page: { position: 'absolute', top: 0, width: W, height: 760 },
  card: { position: 'absolute', left: 24, right: 24, top: 116, height: 384, borderWidth: 1, borderRadius: 26, overflow: 'hidden' },
  cardBody: { position: 'absolute', left: 0, right: 0, top: 30, bottom: 0 },
  words: { position: 'absolute', left: 30, right: 30, top: 528, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 24, lineHeight: 27.6, letterSpacing: -0.5, textAlign: 'center' },
  body: { marginTop: 10, fontFamily: F.medium, fontSize: 15, lineHeight: 22.05, textAlign: 'center' },
  // OpenAI Codex, 2026-11-23: balance whitespace around the button without moving the last page's text or footer.
  done: { position: 'absolute', left: 125, top: 655, width: 140, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: F.display, fontSize: 16 },
  again: { position: 'absolute', left: 30, right: 30, top: 722, fontFamily: F.medium, fontSize: 14.5, textAlign: 'center' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 74, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  hints: { position: 'absolute', left: 0, right: 0, bottom: 30, height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontFamily: F.medium, fontSize: 13 },
  // Shared pieces inside the cards (positions are inside the card, below its 30 px top inset).
  at: { position: 'absolute' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1, minWidth: 0 },
  middle: { alignItems: 'center', justifyContent: 'center' },
  centre: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  band: { position: 'absolute', left: 20, right: 20 },
  divider: { position: 'absolute', left: 20, right: 20, height: 1 },
  small: { fontFamily: F.semibold, fontSize: 12 },
  tiny: { fontFamily: F.semibold, fontSize: 11.5 },
  label13: { fontFamily: F.bold, fontSize: 13 },
  bar: { position: 'relative', borderRadius: 3, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  swipeDot: { position: 'absolute', left: 153, width: 34, height: 34, borderWidth: 2, borderRadius: 17, boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.22)' },
  pillLine: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 13, borderWidth: 1, borderRadius: 999 },
  pillText: { fontFamily: F.semibold, fontSize: 12.5 },
  chipRow: { justifyContent: 'center', marginTop: 10 },
  // 1 Gestures
  iconRow: { position: 'absolute', left: 0, right: 0, top: 18, height: 92 },
  deckTitle: { fontFamily: F.display, fontSize: 15, lineHeight: 16.5, textAlign: 'center' },
  deckMeta: { marginTop: 3, fontFamily: F.semibold, fontSize: 11.5 },
  gestureRows: { position: 'absolute', left: 22, right: 18, top: 172, gap: 4 },
  gestureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 26 },
  gestureLabel: { width: 70, fontFamily: F.bold, fontSize: 13.5 },
  gestureDetail: { flexShrink: 1, fontFamily: F.medium, fontSize: 13.5 },
  // 2 Add
  fileRow: { position: 'absolute', left: 20, right: 20, top: 20, gap: 12 },
  fileBox: { width: 50, height: 50, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fileName: { fontFamily: F.bold, fontSize: 15 },
  fileMeta: { marginTop: 2, fontFamily: F.medium, fontSize: 12 },
  bigTime: { marginTop: 4, fontFamily: F.display, fontSize: 34, lineHeight: 34, letterSpacing: -1, fontVariant: tab },
  ruler: { position: 'absolute', left: 0, right: 0, top: 200, height: 30 },
  tick: { position: 'absolute', width: 2, borderRadius: 1 },
  audience: { paddingVertical: 6, paddingHorizontal: 11, borderWidth: 1, borderRadius: 999 },
  audienceText: { fontFamily: F.semibold, fontSize: 12.5 },
  // 3 Rehearse
  slideCard: { position: 'absolute', left: 20, right: 20, top: 18, height: 132 },
  slideFace: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 18, gap: 5,
    experimental_backgroundImage: 'linear-gradient(135deg, #4677FF 0%, #1F3BD6 100%)', boxShadow: 'inset 0px 1px 0px rgba(255, 255, 255, 0.2)' },
  slideKicker: { fontFamily: F.bold, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' },
  slideTitle: { fontFamily: F.display, fontSize: 19, lineHeight: 20.9, letterSpacing: -0.3, color: '#FFFFFF' },
  slideRule: { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  bullet: { flexDirection: 'row', gap: 7 },
  bulletMark: { width: 5, height: 5, marginTop: 5, borderRadius: 1.5, backgroundColor: '#FFFFFF' },
  bulletText: { fontFamily: F.regular, fontSize: 11.5, lineHeight: 14.4, color: '#FFFFFF' },
  slideNo: { fontFamily: F.bold, fontSize: 12.5 },
  slideClock: { fontFamily: F.medium, fontSize: 12.5, fontVariant: tab },
  record: { position: 'absolute', left: 139, top: 206, width: 62, height: 62 },
  recordRing: { position: 'absolute', left: 0, top: 0, width: 62, height: 62, borderWidth: 2, borderRadius: 31, borderColor: 'rgba(255,87,71,0.6)' },
  recordButton: { position: 'absolute', left: 0, top: 0, width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center',
    experimental_backgroundImage: 'radial-gradient(circle at 34% 28%, #FFB49E 0%, #FF5747 40%, #DD1C2C 100%)',
    boxShadow: '0px 10px 20px rgba(236, 42, 53, 0.35), inset 0px -6px 10px rgba(110, 0, 12, 0.28), inset 0px 4px 8px rgba(255, 255, 255, 0.35)' },
  recordHints: { position: 'absolute', left: 0, right: 0, top: 290, justifyContent: 'center', gap: 12 },
  // 4 Score
  score: { position: 'absolute', left: 96, top: 4, width: 150, height: 76 },
  scoreRing: { position: 'absolute', left: 0, top: 0, width: 150, height: 76, borderWidth: 2, borderRadius: 38 },
  scoreValue: { fontFamily: F.display, fontSize: 52, lineHeight: 52, letterSpacing: -1.6, fontVariant: tab },
  scoreUnit: { marginLeft: 2, fontFamily: F.display, fontSize: 22, lineHeight: 22 },
  stats: { position: 'absolute', left: 14, right: 14, top: 100 },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statValue: { fontFamily: F.display, fontSize: 20, lineHeight: 20, fontVariant: tab },
  statLabel: { fontFamily: F.medium, fontSize: 13, lineHeight: 13 },
  legend: { position: 'absolute', left: 22, right: 22, top: 172, gap: 6 },
  legendRow: { gap: 10, height: 24 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontFamily: F.bold, fontSize: 13.5 },
  legendRange: { fontFamily: F.medium, fontSize: 13.5, fontVariant: tab },
  // 5 Review
  tileStrip: { position: 'absolute', left: 20, right: 20, top: 44, height: 58, borderWidth: 1, borderRadius: 18, gap: 8, paddingHorizontal: 8 },
  tile: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tileRing: { position: 'absolute', left: -5, top: -5, width: 50, height: 50, borderWidth: 2, borderRadius: 15 },
  tileNo: { fontFamily: F.display, fontSize: 14, lineHeight: 14, color: '#14161D' },
  tileTime: { fontFamily: F.semibold, fontSize: 9, lineHeight: 9, opacity: 0.72, color: '#14161D', fontVariant: tab },
  swatches: { position: 'absolute', left: 22, right: 22, top: 122, gap: 8 },
  swatchRow: { gap: 12, height: 28 },
  swatch: { width: 24, height: 24, borderRadius: 7 },
  swatchLabel: { fontFamily: F.bold, fontSize: 14 },
  swatchRange: { fontFamily: F.medium, fontSize: 14, fontVariant: tab },
  // 6 Slide review
  ring: { position: 'absolute', left: 20, top: 20, width: 92, height: 92 },
  ringValue: { fontFamily: F.display, fontSize: 24, lineHeight: 24, letterSpacing: -0.6, fontVariant: tab },
  ringGrade: { marginTop: 3, fontFamily: F.semibold, fontSize: 10, lineHeight: 10, letterSpacing: 0.3 },
  slideHead: { position: 'absolute', left: 128, right: 14, top: 30 },
  slideName: { fontFamily: F.semibold, fontSize: 12.5 },
  slideTime: { fontFamily: F.display, fontSize: 22, lineHeight: 22, fontVariant: tab },
  over: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999 },
  overText: { fontFamily: F.bold, fontSize: 12 },
  checks: { position: 'absolute', left: 22, right: 18, top: 140, gap: 6 },
  check: { gap: 12, height: 38 },
  checkLabel: { fontFamily: F.bold, fontSize: 10.5, letterSpacing: 0.4, textTransform: 'uppercase' },
  checkValue: { marginTop: 2, fontFamily: F.medium, fontSize: 13.5 },
  // 7 Listen back
  runTime: { fontFamily: F.medium, fontSize: 12, fontVariant: tab },
  player: { position: 'absolute', left: 14, right: 20, top: 40, gap: 6 },
  lines: { position: 'absolute', left: 12, right: 12, top: 76, height: 150 },
  lineHighlight: { position: 'absolute', left: 0, right: 0, top: 0, height: 30, borderRadius: 10 },
  line: { gap: 10, height: 30, paddingHorizontal: 8 },
  lineBadge: { width: 20, height: 18, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  lineBadgeText: { fontFamily: F.display, fontSize: 10.5, lineHeight: 18, textAlign: 'center' },
  lineText: { flexShrink: 1, fontFamily: F.medium, fontSize: 13 },
  where: { position: 'absolute', left: 22, right: 18, top: 258, gap: 10 },
  whereText: { fontFamily: F.medium, fontSize: 12.5 },
  // 8 Q&A
  avatar: { width: 36, height: 36, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.display, fontSize: 13 },
  panelist: { fontFamily: F.bold, fontSize: 14 },
  panelistMeta: { marginTop: 1, fontFamily: F.medium, fontSize: 11.5 },
  question: { fontFamily: F.display, fontSize: 17, lineHeight: 22.1, letterSpacing: -0.2 },
  answer: { fontFamily: F.medium, fontSize: 12.5, fontVariant: tab },
  verdict: { gap: 5, paddingVertical: 3, paddingLeft: 4, paddingRight: 11, borderRadius: 999, backgroundColor: 'rgba(63,217,164,0.16)' },
  verdictText: { fontFamily: F.bold, fontSize: 13 },
  verdictChip: { gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  verdictDot: { width: 6, height: 6, borderRadius: 3 },
  verdictChipText: { fontFamily: F.bold, fontSize: 11.5 },
});
