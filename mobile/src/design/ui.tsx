// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Pre-rendered ambient glow integration with OpenAI Codex, Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: building blocks shared by the screens (design bundle template.html).
import { memo, useEffect, type ComponentProps, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, type SharedValue, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat,
  withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { ChipModel, IconKey } from '../domain/analysis';
import type { HueName } from '../domain/hues';
import { Txt } from './frame';
import { Glyph, type GlyphName, UIIcon } from './icons';
import { C, F, HUES, TONE } from './tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Hint row (SPEC §1.2) ─────────────────────────────────────────────────────
export type Hint = { icon: GlyphName; text: string; nudge?: 'down' | 'up'; onPress?: () => void };
export function HintRow({ hints, gap = 18, style }: { hints: Hint[]; gap?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents={hints.some(h => h.onPress) ? "box-none" : "none"} style={[s.hints, { gap }, style]}>
      {hints.map(h => {
        const content = <>
          {h.nudge ? <Nudge dir={h.nudge}><Glyph name={h.icon} size={18} /></Nudge> : <Glyph name={h.icon} size={18} />}
          <Txt style={s.hintText}>{h.text}</Txt>
        </>;
        const style = [s.hint, { gap: gap === 16 ? 5 : 6 }];
        return h.onPress ? <Pressable key={h.icon + h.text} accessibilityRole="button" accessibilityLabel={h.text}
          onPress={h.onPress} style={[style, { minHeight: 44 }]}>{content}</Pressable>
          : <View key={h.icon + h.text} style={style}>{content}</View>;
      })}
    </View>
  );
}
/** Gentle 1.6 s up/down nudge used on the "swipe down" hint arrows. */
export function Nudge({ dir, children }: { dir: 'down' | 'up'; children: ReactNode }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    v.set(withRepeat(withSequence(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) })), -1));
  }, [reduced, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: dir === 'down' ? -2 + 5 * v.value : 2 - 5 * v.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// ── Chips ────────────────────────────────────────────────────────────────────
export const Chip = memo(function Chip({ chip, size = 13 }: { chip: ChipModel; size?: number }) {
  const tone = TONE[chip.tone];
  return (
    <View style={[s.chip, { backgroundColor: tone.bg }]}>
      <UIIcon name={chip.icon} size={22} />
      <Txt style={{ fontFamily: F.semibold, fontSize: size, color: tone.fg }}>{chip.text}</Txt>
    </View>
  );
});
export function Pill({ text, tone, style }: { text: string; tone: keyof typeof TONE; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.pill, { backgroundColor: TONE[tone].bg }, style]}><Txt style={{ fontFamily: F.bold, fontSize: 12, color: TONE[tone].fg }}>{text}</Txt></View>;
}

/** Icon + text row used for findings and feedback lines. */
export function IconRow({ icon, text, size = 13 }: { icon: IconKey; text: string; size?: number }) {
  return (
    <View style={s.row}>
      <UIIcon name={icon} size={22} style={{ flexShrink: 0 }} />
      <Txt style={{ flex: 1, fontFamily: F.regular, fontSize: size, lineHeight: size * 1.3, color: C.body }}>{text}</Txt>
    </View>
  );
}

// ── Progress ring ────────────────────────────────────────────────────────────
/** Ring around the record button: 112 dp, 4 dp, red gradient progress (0..1). */
export function RecordRing({ progress, visible }: { progress: SharedValue<number>; visible: SharedValue<number> }) {
  const len = 326.73;
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - Math.max(0, Math.min(1, progress.value))), opacity: visible.value }));
  return (
    <Svg width={112} height={112} viewBox="0 0 112 112" style={s.ring} pointerEvents="none">
      <Defs>
        <LinearGradient id="gRedRing" x1="0" y1="0" x2="0.35" y2="1"><Stop offset="0" stopColor="#FF9A7C" /><Stop offset="1" stopColor="#EC2A35" /></LinearGradient>
      </Defs>
      <Circle cx={56} cy={56} r={52} fill="none" stroke={C.track} strokeWidth={4} />
      <AnimatedCircle cx={56} cy={56} r={52} fill="none" stroke="url(#gRedRing)" strokeWidth={4} strokeLinecap="round"
        strokeDasharray={`${len}`} animatedProps={props} transform="rotate(-90 56 56)" />
    </Svg>
  );
}

// ── Red record button and green check (SPEC §2) ──────────────────────────────
export type RecordGlyph = 'mic' | 'redo' | 'stop' | 3 | 2 | 1;
export function RecordButton({ glyph, label, onPress, onPressIn, onPressOut, disabled, green }: {
  glyph: RecordGlyph | 'check'; label: string; onPress: () => void; onPressIn?: () => void; onPressOut?: () => void; disabled?: boolean; green?: boolean;
}) {
  const stops = green ? ['#A8F8DB', '#22C98F', '#0A8F62'] : ['#FFB49E', '#FF5747', '#DD1C2C'];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      android_disableSound style={[s.record, { boxShadow: green
        ? '0px 16px 30px rgba(14, 168, 119, 0.4), inset 0px -8px 14px rgba(0, 70, 44, 0.28), inset 0px 6px 10px rgba(255, 255, 255, 0.35)'
        : '0px 16px 30px rgba(236, 42, 53, 0.4), inset 0px -8px 14px rgba(110, 0, 12, 0.28), inset 0px 6px 10px rgba(255, 255, 255, 0.35)' }]}>
      <Svg width={84} height={84} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={green ? 'gBtnGreen' : 'gBtnRed'} cx="34%" cy="28%" r="97.7%" fx="34%" fy="28%">
            <Stop offset="0" stopColor={stops[0]} /><Stop offset="0.4" stopColor={stops[1]} /><Stop offset="1" stopColor={stops[2]} />
          </RadialGradient>
        </Defs>
        <Circle cx={42} cy={42} r={42} fill={`url(#${green ? 'gBtnGreen' : 'gBtnRed'})`} />
      </Svg>
      <ButtonGlyph glyph={glyph} />
    </Pressable>
  );
}
function ButtonGlyph({ glyph }: { glyph: RecordGlyph | 'check' }) {
  if (glyph === 'mic') return (
    <Svg width={34} height={34} viewBox="0 0 24 24">
      <Rect x={9} y={3} width={6} height={11} rx={3} fill="#FFFFFF" />
      <Path d="M5.5 11 A6.5 6.5 0 0 0 18.5 11" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 17.5 V20.5" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
  if (glyph === 'redo') return <Glyph name="g-redo" size={34} />;
  if (glyph === 'stop') return <View style={s.stop} />;
  if (glyph === 'check') return (
    <Svg width={36} height={36} viewBox="0 0 24 24"><Path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>
  );
  return <Pop key={glyph}><Txt style={s.count}>{glyph}</Txt></Pop>;
}
/** olPop: scale .5 → 1.15 → 1, 320 ms. */
export function Pop({ children, duration = 320 }: { children: ReactNode; duration?: number }) {
  const v = useSharedValue(0);
  useEffect(() => { v.set(withTiming(1, { duration, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })); }, [v, duration]);
  const style = useAnimatedStyle(() => {
    const t = v.value;
    const scale = t < 0.7 ? 0.5 + (t / 0.7) * 0.65 : 1.15 - ((t - 0.7) / 0.3) * 0.15;
    return { opacity: Math.min(1, t / 0.7), transform: [{ scale }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Small round icon button with a caption (Cues, Review, Try again). */
export function RoundButton({ icon, glyph, label, caption, onPress, disabled, active, style }: {
  icon?: IconKey; glyph?: GlyphName; label: string; caption: string; onPress: () => void; disabled?: boolean; active?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.roundWrap, { opacity: disabled ? 0.35 : 1 }, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, selected: !!active }} disabled={disabled}
        onPress={onPress} style={[s.round, active && { backgroundColor: 'rgba(255, 216, 102, 0.18)', borderColor: 'rgba(255, 216, 102, 0.45)' }]}>
        {icon ? <UIIcon name={icon} size={28} /> : glyph ? <Glyph name={glyph} size={26} /> : null}
      </Pressable>
      <Txt numberOfLines={1} style={s.roundCaption}>{caption}</Txt>
    </View>
  );
}

// ── Waveform ─────────────────────────────────────────────────────────────────
export const IDLE_WAVE: number[] = Array.from({ length: 28 }, () => 4);
export const Waveform = memo(function Waveform({ bars, live }: { bars: readonly number[]; live: boolean }) {
  return (
    <View pointerEvents="none" style={s.wave}>
      {bars.map((h, i) => (
        <View key={i} style={{ width: 4, height: Math.round(h), borderRadius: 2,
          backgroundColor: !live ? 'rgba(255, 255, 255, 0.18)' : i >= bars.length - 5 ? '#FF5A4E' : 'rgba(255, 255, 255, 0.45)' }} />
      ))}
    </View>
  );
});

// ── Confetti burst after a take (1.5 s) ──────────────────────────────────────
const BURST_COLORS = [['#7CC2FF', '#2D5BFF'], ['#C9A8FF', '#6A3BF0'], ['#9AF7D6', '#0EA877'], ['#FFE58C', '#FF8A1E'], ['#FFB7E0', '#E23D8D'], ['#FF9A7C', '#EC2A35']];
const BURST = Array.from({ length: 20 }, (_, i) => ({
  a: -Math.PI / 2 + (i / 19 - 0.5) * Math.PI * 1.7 + (Math.random() - 0.5) * 0.25,
  d: 110 + Math.random() * 150, sz: 10 + Math.round(Math.random() * 12), c: BURST_COLORS[i % BURST_COLORS.length],
  round: i % 3 !== 0, spin: (Math.random() - 0.5) * 360,
}));
export function Confetti({ origin = { x: 195, y: 716 } }: { origin?: { x: number; y: number } }) {
  const t = useSharedValue(0);
  useEffect(() => { t.set(withTiming(1, { duration: 950, easing: Easing.linear })); }, [t]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {BURST.map((b, i) => <Particle key={i} b={b} t={t} origin={origin} />)}
    </View>
  );
}
function Particle({ b, t, origin }: { b: (typeof BURST)[number]; t: SharedValue<number>; origin: { x: number; y: number } }) {
  const style = useAnimatedStyle(() => {
    const k = t.value, ez = 1 - Math.pow(1 - k, 3);
    return {
      opacity: 1 - k * k,
      transform: [{ translateX: origin.x + Math.cos(b.a) * b.d * ez - b.sz / 2 }, { translateY: origin.y + Math.sin(b.a) * b.d * ez + 70 * k * k - b.sz / 2 },
        { rotate: b.spin * k + 'deg' }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: b.sz, height: b.sz, borderRadius: b.round ? b.sz / 2 : b.sz * 0.3, overflow: 'hidden' }, style]}>
      <Svg width={b.sz} height={b.sz}><Defs><LinearGradient id={'cf' + b.c[0].slice(1)} x1="0.2" y1="0" x2="0.8" y2="1"><Stop offset="0" stopColor={b.c[0]} /><Stop offset="1" stopColor={b.c[1]} /></LinearGradient></Defs>
        <Rect width={b.sz} height={b.sz} fill={`url(#cf${b.c[0].slice(1)})`} /></Svg>
    </Animated.View>
  );
}

// ── Dialog (redo confirm and the few essential prompts) ──────────────────────
export function Dialog({ title, body, confirm, cancel = 'Cancel', onConfirm, onCancel, icon = 'redo', tone = 'red' }: {
  title: string; body: string; confirm: string; cancel?: string | null; onConfirm: () => void; onCancel: () => void; icon?: 'redo' | IconKey; tone?: 'red' | 'neutral';
}) {
  const v = useSharedValue(0);
  useEffect(() => { v.set(withTiming(1, { duration: 260, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })); }, [v]);
  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value * 1.3) }));
  const card = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * 12 }, { scale: 0.94 + 0.06 * v.value }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, scrim]}>
        <Pressable accessibilityLabel={cancel ?? 'Close'} onPress={onCancel} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.62)' }]} />
      </Animated.View>
      <Animated.View accessibilityRole="alert" accessibilityViewIsModal style={[s.dialog, card]}>
        {icon === 'redo' ? (
          <View style={[s.dialogIcon, { boxShadow: '0px 10px 20px rgba(236, 42, 53, 0.35)' }]}>
            <Svg width={52} height={52} style={StyleSheet.absoluteFill}>
              <Defs><RadialGradient id="gDlgRed" cx="34%" cy="28%" r="97.7%" fx="34%" fy="28%"><Stop offset="0" stopColor="#FFB49E" /><Stop offset="0.4" stopColor="#FF5747" /><Stop offset="1" stopColor="#DD1C2C" /></RadialGradient></Defs>
              <Circle cx={26} cy={26} r={26} fill="url(#gDlgRed)" />
            </Svg>
            <Glyph name="g-redo" size={26} />
          </View>
        ) : <View style={{ alignItems: 'center' }}><UIIcon name={icon} size={52} /></View>}
        <Txt style={s.dialogTitle}>{title}</Txt>
        <Txt style={s.dialogBody}>{body}</Txt>
        <View style={s.dialogRow}>
          {cancel !== null && <Pressable accessibilityRole="button" onPress={onCancel} style={s.dialogCancel}><Txt style={s.dialogBtnText}>{cancel}</Txt></Pressable>}
          <Pressable accessibilityRole="button" onPress={onConfirm} style={[s.dialogConfirm, tone === 'neutral' && { backgroundColor: 'rgba(255, 255, 255, 0.92)' }]}>
            {tone === 'red' && <Svg style={StyleSheet.absoluteFill}><Defs><LinearGradient id="gDlgBtn" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FF5747" /><Stop offset="1" stopColor="#DD1C2C" /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#gDlgBtn)" /></Svg>}
            <Txt style={[s.dialogBtnText, { color: tone === 'neutral' ? '#14161D' : '#FFFFFF' }]}>{confirm}</Txt>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Undo toast ───────────────────────────────────────────────────────────────
export function UndoToast({ text, onUndo }: { text: string; onUndo: () => void }) {
  return (
    <View style={s.toastWrap} pointerEvents="box-none">
      <View accessibilityRole="alert" style={s.toast}>
        <Txt numberOfLines={1} style={s.toastText}>{text}</Txt>
        <Pressable accessibilityRole="button" onPress={onUndo} style={s.undo}><Txt style={s.undoText}>Undo</Txt></Pressable>
      </View>
    </View>
  );
}

// ── Ambient glow (SPEC §2) ───────────────────────────────────────────────────
export const GlowLayer = memo(function GlowLayer({ hue, style }: { hue: HueName; style?: ComponentProps<typeof Animated.View>['style'] }) {
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Image source={require('../../assets/outloud-glow.png')} resizeMode="stretch"
        style={[StyleSheet.absoluteFill, { tintColor: `rgb(${HUES[hue].rgb})` }]} />
    </Animated.View>
  );
});

/** Linear 135° slide-face gradient, as an absolute fill. */
export function FaceFill({ hue, radius = 0, id }: { hue: HueName; radius?: number; id: string }) {
  const [a, b] = HUES[hue].face;
  return (
    <Svg style={[StyleSheet.absoluteFill, { borderRadius: radius }]} preserveAspectRatio="none">
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={a} /><Stop offset="1" stopColor={b} /></LinearGradient></Defs>
      <Rect width="100%" height="100%" rx={radius} ry={radius} fill={`url(#${id})`} />
    </Svg>
  );
}

const s = StyleSheet.create({
  hints: { position: 'absolute', left: 0, right: 0, bottom: 30, height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center' },
  hintText: { fontFamily: F.medium, fontSize: 13, color: C.secondary },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 3, paddingBottom: 3, paddingLeft: 4, paddingRight: 11, borderRadius: 999 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ring: { position: 'absolute', left: 139, top: 660 },
  record: { position: 'absolute', left: 153, top: 674, width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  stop: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFFFF' },
  count: { fontFamily: F.displayHeavy, fontSize: 40, lineHeight: 44, color: '#FFFFFF' },
  roundWrap: { position: 'absolute', top: 690, width: 52, alignItems: 'center', gap: 6 },
  round: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)', backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center' },
  roundCaption: { fontFamily: F.semibold, fontSize: 11, color: C.secondary, width: 90, textAlign: 'center' },
  wave: { position: 'absolute', left: 0, right: 0, top: 618, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  dialog: { position: 'absolute', left: 32, right: 32, top: 286, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 18, borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 26, backgroundColor: C.dialog, boxShadow: '0px 30px 60px rgba(0, 0, 0, 0.55)' },
  dialogIcon: { width: 52, height: 52, borderRadius: 26, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dialogTitle: { marginTop: 14, fontFamily: F.display, fontSize: 20, lineHeight: 24, color: C.text, textAlign: 'center' },
  dialogBody: { marginTop: 8, fontFamily: F.regular, fontSize: 14, lineHeight: 20.3, color: C.secondary, textAlign: 'center' },
  dialogRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  dialogCancel: { flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center' },
  dialogConfirm: { flex: 1, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  dialogBtnText: { fontFamily: F.bold, fontSize: 15, color: C.text },
  toastWrap: { position: 'absolute', left: 0, right: 0, top: 98, zIndex: 5, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6, paddingBottom: 6, paddingRight: 6, paddingLeft: 16, borderWidth: 1,
    borderColor: C.toastBorder, borderRadius: 999, backgroundColor: C.toast },
  toastText: { maxWidth: 200, fontFamily: F.semibold, fontSize: 14, color: C.text },
  undo: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.yellow },
  undoText: { fontFamily: F.bold, fontSize: 14, color: '#14161D' },
});
