// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Performance and add-preview changes with OpenAI Codex, Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#home-idle-motion-removal-october-14-2026
// OutLoud redesign: Home (SPEC §4.1) and the icon picker (§4.2).
// The carousel stays mounted behind Upload, which blurs it and opens a gap for the new item.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue,
  withTiming, cancelAnimation, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { Txt, useFrame } from '../design/frame';
import { PresentationIcon, UIIcon } from '../design/icons';
import { PanView, type PanHandlers } from '../design/PanView';
import { C, F } from '../design/tokens';
import { HintRow, UndoToast } from '../design/ui';
import { coverFlow, HOLD_MS, PULL_T, PX_PER_CARD, rubber } from '../domain/gestures';
import { ICONS, type HueName, type IconId } from '../domain/hues';
import { mod, nearestSlot, pad2, relativeDay } from '../domain/format';
import { deckModel } from '../features/presentations/useDeckModel';
import { getDeckState, nextHue, setHidden, setIcon, useStore, visibleDecks, type Presentation } from '../features/presentations/store';
import { savedAttempts } from '../features/recording/storage';
import { pdfService } from '../features/pdf/service';
import { useBack, useShell } from './shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SLOT_W = 260, SLOT_H = 223, SLOT_TOP = 61, ORIGIN_Y = 111;

export function HomeScreen({ mode }: { mode: 'home' | 'upload' }) {
  const { go, home } = useShell();
  const frame = useFrame();
  const decks = useStore(s => visibleDecks(s));
  const n = decks.length;
  const [front, setFront] = useState(() => (n ? mod(Math.round(home.p.value), n) : 0));
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ deck: Presentation; at: number } | null>(null);
  const [pullLabel, setPullLabel] = useState<'' | 'add' | 'addPast' | 'del' | 'delPast' | 'keep'>('');
  const newHue = nextHue();
  const newOrder = n + 1;
  const active = mode === 'home' && !pickerFor;

  useAnimatedReaction(() => (n ? mod(Math.round(home.p.value), n) : 0), (f, prev) => { if (f !== prev) runOnJS(setFront)(f); }, [n]);
  // The reaction re-syncs when n changes; until then keep the index in range.
  const shown = n ? Math.min(front, n - 1) : 0;

  const settle = useCallback((target: number) => {
    const dist = Math.abs(target - home.p.value);
    home.p.set(withTiming(target, { duration: Math.min(900, 320 + dist * 140), easing: Easing.out(Easing.exp) }));
  }, [home.p]);

  const openFront = useCallback(() => {
    const deck = decks[mod(Math.round(home.p.value), Math.max(1, n))];
    if (deck) go('rehearse', { nav: 'fade', deckId: deck.id, slide: 0 });
  }, [decks, go, home.p, n]);
  const openAdd = useCallback(() => {
    settle(Math.round(home.p.value));
    home.gap.set(1);
    go('upload', { nav: null });
  }, [go, home.gap, home.p, settle]);

  // ── Delete with undo ──
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalize = useCallback((deck: Presentation) => {
    // Keep files that saved rehearsals still need; otherwise remove the app's PDF copy.
    try { if (!savedAttempts(deck.id).length) void pdfService.removePdf(deck.id).catch(() => undefined); } catch { /* keep hidden only */ }
  }, []);
  const deleteFront = useCallback(() => {
    if (n <= 1) return;
    const f = mod(Math.round(home.p.value), n), deck = decks[f];
    if (!deck) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    setHidden(deck.id, true);
    const nf = f % (n - 1);
    home.p.set(nf); home.vy.set(withTiming(0, { duration: 220 }));
    if (undoTimer.current) { clearTimeout(undoTimer.current); if (undo) finalize(undo.deck); }
    setUndo({ deck, at: Date.now() });
    undoTimer.current = setTimeout(() => { setUndo(null); finalize(deck); }, 4500);
  }, [decks, finalize, home.p, home.vy, n, undo]);
  const undoDelete = useCallback(() => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setHidden(undo.deck.id, false);
    home.p.set(indexOfDeck(undo.deck.id));
    setUndo(null);
  }, [home.p, undo]);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // ── Gestures (port of homeDown / homeMove / homeUp) ──
  const g = useRef<{ x0: number; y0: number; lastX: number; lastT: number; vel: number; axis: 'x' | 'y' | null; p0: number; slot: number | null } | null>(null);
  const lp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef<'pick' | 'hold' | null>(null);
  const cancelPress = () => { if (lp.current) { clearTimeout(lp.current); lp.current = null; } home.press.set(withTiming(1, { duration: 180 })); };
  const cancelHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } cancelAnimation(home.hold); home.hold.set(0); };
  const local = (e: GestureResponderEvent) => ({ x: (e.nativeEvent.pageX - frame.left) / frame.s, y: (e.nativeEvent.pageY - frame.top) / frame.s - 150 });
  /** Which item a tap at (x, y) in carousel coordinates hit, front first. */
  const hitSlot = (x: number, y: number) => {
    const { n, decks } = latest.current;
    if (!n) return x > 65 && x < 325 && y > SLOT_TOP && y < SLOT_TOP + SLOT_H ? -1 : null;
    const order = decks.map((_, j) => ({ j, f: coverFlow(j, home.p.value, n, 0) })).filter(o => o.f.live).sort((a, b) => b.f.z - a.f.z);
    for (const { j, f } of order) {
      const half = (SLOT_W / 2) * f.scale * Math.cos((f.rotateY * Math.PI) / 180);
      if (Math.abs(x - (195 + f.x)) < half && y > SLOT_TOP && y < SLOT_TOP + SLOT_H) return j;
    }
    return null;
  };
  const latest = useRef({ openFront, openAdd, deleteFront, settle, n, decks });
  useEffect(() => { latest.current = { openFront, openAdd, deleteFront, settle, n, decks }; });

  const responder: PanHandlers = {
    onStartShould: () => true,
    onGrant: e => {
      const { x, y } = local(e);
      const { n: count } = latest.current;
      cancelAnimation(home.p);
      g.current = { x0: e.nativeEvent.pageX, y0: e.nativeEvent.pageY, lastX: e.nativeEvent.pageX, lastT: Date.now(), vel: 0, axis: null, p0: home.p.value, slot: hitSlot(x, y) };
      fired.current = null;
      const f = count ? mod(Math.round(home.p.value), count) : -1;
      if (count && g.current.slot === f && Math.abs(home.p.value - Math.round(home.p.value)) < 0.05) {
        home.press.set(withTiming(0.93, { duration: 180 }));
        lp.current = setTimeout(() => {
          lp.current = null;
          if (g.current?.axis) return;
          fired.current = 'pick';
          home.press.set(withTiming(1, { duration: 180 }));
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          const deck = latest.current.decks[f];
          if (deck) { setPickerFor(deck.id); home.picker.set(withTiming(1, { duration: 220 })); }
        }, 550);
      }
    },
    onMove: e => {
      const s = g.current;
      if (!s || fired.current) return;
      const dx = (e.nativeEvent.pageX - s.x0) / frame.s, dy = (e.nativeEvent.pageY - s.y0) / frame.s;
      if (!s.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        cancelPress();
      }
      if (s.axis === 'x') {
        if (!latest.current.n) return;
        const now = Date.now(), dt = Math.max(8, now - s.lastT);
        const inst = -((e.nativeEvent.pageX - s.lastX) / frame.s) / PX_PER_CARD / (dt / 1000);
        s.vel = s.vel * 0.6 + inst * 0.4; s.lastX = e.nativeEvent.pageX; s.lastT = now;
        home.p.set(s.p0 - dx / PX_PER_CARD);
      } else {
        const v = rubber(dy, PULL_T, 0.3);
        home.vy.set(v);
        if (v >= PULL_T * 0.98) {
          if (!holdTimer.current && latest.current.n > 1) {
            home.hold.set(0);
            home.hold.set(withTiming(1, { duration: HOLD_MS, easing: Easing.linear }));
            holdTimer.current = setTimeout(() => {
              holdTimer.current = null;
              fired.current = 'hold';
              home.hold.set(0);
              latest.current.deleteFront();
            }, HOLD_MS);
          }
        } else if (holdTimer.current) cancelHold();
        setPullLabel(v < -4 ? (v <= -PULL_T * 0.98 ? 'addPast' : 'add') : v > 4 ? (latest.current.n <= 1 ? 'keep' : v >= PULL_T * 0.98 ? 'delPast' : 'del') : '');
      }
    },
    onRelease: () => release(false),
    onTerminate: () => release(true),
    onTerminationRequest: () => !g.current?.axis,
  };

  function release(cancelled: boolean) {
    const s = g.current;
    g.current = null;
    cancelHold(); cancelPress();
    setPullLabel('');
    const vy = home.vy.value;
    home.vy.set(withTiming(0, { duration: 320, easing: Easing.out(Easing.exp) }));
    if (!s || fired.current) { fired.current = null; return; }
    const { n: count } = latest.current;
    if (!s.axis) {
      if (cancelled) return;
      if (!count) { if (s.slot === -1) latest.current.openAdd(); return; }
      if (s.slot === null) return;
      const f = mod(Math.round(home.p.value), count);
      if (s.slot === f) latest.current.openFront();
      else latest.current.settle(nearestSlot(home.p.value, s.slot, count));
      return;
    }
    if (s.axis === 'x') {
      const vel = Date.now() - s.lastT > 120 ? 0 : s.vel;
      latest.current.settle(Math.round(home.p.value + Math.max(-8, Math.min(8, vel * 0.35))));
    } else if (vy <= -PULL_T * 0.98 && !cancelled) {
      latest.current.openAdd();
    }
  }

  useBack(mode === 'home' && !!pickerFor, () => {
    closePicker();
    return true;
  });
  function closePicker() { home.picker.set(withTiming(0, { duration: 220 })); setPickerFor(null); }

  const frontDeck = n ? decks[shown] : null;
  const homeLayer = useAnimatedStyle(() => {
    // A live blur forces Android to upload the entire moving carousel as a bitmap.
    // Dim only the existing cards; the new icon remains crisp above them.
    return { opacity: 1 - 0.58 * home.uploadBlur.value };
  });
  const visibleSlots = decks.map((deck, j) => ({ deck, j })).filter(({ j }) =>
    Math.min(mod(j - shown, n || 1), mod(shown - j, n || 1)) <= 2);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={mode === 'home' ? 'box-none' : 'none'}>
      <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, pickerFor ? styles.pickerBlur : null]}>
      <View pointerEvents="none" style={styles.logo}><Txt style={styles.logoText}>OutLoud</Txt></View>
      <PanView style={[styles.carousel, homeLayer, mode === 'upload' && styles.addBlur]} {...responder} disabled={!active}
        accessible accessibilityRole="adjustable" accessibilityLabel={frontDeck ? `${frontDeck.title}, ${frontDeck.pageCount} slides` : 'No presentations yet'}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate', label: 'Open' }, { name: 'longpress', label: 'Choose icon' },
          { name: 'add', label: 'Add presentation' }, { name: 'delete', label: 'Delete presentation' }]}
        onAccessibilityAction={e => {
          const a = e.nativeEvent.actionName;
          if (a === 'increment') settle(Math.round(home.p.value) + 1);
          else if (a === 'decrement') settle(Math.round(home.p.value) - 1);
          else if (a === 'activate') openFront();
          else if (a === 'longpress' && frontDeck) { setPickerFor(frontDeck.id); home.picker.set(withTiming(1, { duration: 220 })); }
          else if (a === 'add') openAdd();
          else if (a === 'delete') deleteFront();
        }}>
        {visibleSlots.map(({ deck, j }) => <Slot key={deck.id} deck={deck} j={j} n={n} home={home} isFront={j === shown} />)}
      </PanView>
      <View pointerEvents="none" style={styles.ghostLayer}>
        <Ghost home={home} hue={newHue} order={newOrder} empty={!n} />
      </View>
      {mode === 'home' && <>
        <PullIndicator home={home} label={pullLabel} />
        <StatsPanel deck={frontDeck} home={home} />
        <Dots n={n} front={shown} />
        <HomeHints home={home} empty={!n} />
        {undo && <UndoToast text={`Deleted “${undo.deck.title}”`} onUndo={undoDelete} />}
      </>}
      </View>
      {pickerFor && <IconPicker deckId={pickerFor} onClose={closePicker} />}
    </View>
  );
}
function indexOfDeck(id: string) { return Math.max(0, visibleDecks().findIndex(d => d.id === id)); }

// ── One carousel item: title, meta, icon, ground shadow ──────────────────────
const Slot = memo(function Slot({ deck, j, n, home, isFront }: { deck: Presentation; j: number; n: number; home: import('./shared').HomeShared; isFront: boolean }) {
  const outer = useAnimatedStyle(() => {
    const spread = spreadOf(home);
    const f = coverFlow(j, home.p.value, n, spread);
    const front = Math.abs(f.dd) < 0.5 && n > 1;
    const pull = home.vy.value > 0 ? Math.min(1, home.vy.value / PULL_T) : 0;
    const del = front ? (home.hold.value > 0 ? 0.3 + 0.7 * home.hold.value : pull * 0.3) : 0;
    const sc = f.scale * (1 - del * 0.12);
    const jit = front && home.hold.value > 0.5 ? Math.sin(home.hold.value * 94) * (home.hold.value - 0.5) * 3.2 : 0;
    return {
      zIndex: f.z,
      transform: [{ translateY: home.vy.value * 0.35 - (ORIGIN_Y - SLOT_FULL_H / 2) * (1 - sc) * -1 }, { translateX: f.x }, { scale: sc }, { rotate: jit + 'deg' }],
    };
  });
  const body = useAnimatedStyle(() => {
    const f = coverFlow(j, home.p.value, n, spreadOf(home));
    const front = Math.abs(f.dd) < 0.5 && n > 1;
    const pull = home.vy.value > 0 ? Math.min(1, home.vy.value / PULL_T) : 0;
    const del = front ? (home.hold.value > 0 ? 0.3 + 0.7 * home.hold.value : pull * 0.3) : 0;
    return {
      opacity: f.opacity * f.brightness * (1 - del * 0.45),
      transform: [{ perspective: 700 }, { rotateY: f.rotateY + 'deg' }],
    };
  });
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: isFront ? home.press.value : 1 }] }));
  const shadow = useAnimatedStyle(() => {
    const f = coverFlow(j, home.p.value, n, spreadOf(home));
    return { opacity: f.shadowOpacity, transform: [{ scaleX: f.shadowScale }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.slot, outer]}>
      <Animated.View style={[styles.item, body]}>
        <Txt numberOfLines={2} style={styles.title}>{deck.title}</Txt>
        <Txt style={styles.meta}>{(deck.pageCount || '—') + ' slides · ' + pad2(j + 1)}</Txt>
        <Animated.View style={[styles.icon, icon]}><PresentationIcon icon={deck.icon} hue={deck.hue} size={146} /></Animated.View>
      </Animated.View>
      <Animated.View style={[styles.ground, shadow]}><GroundShadow /></Animated.View>
    </Animated.View>
  );
});
const SLOT_FULL_H = SLOT_H + 16 + 24;
function spreadOf(home: import('./shared').HomeShared) {
  'worklet';
  const pull = home.vy.value < 0 ? Math.min(1, -home.vy.value / PULL_T) : 0;
  return Math.max(pull, home.gap.value, home.uploadBlur.value > 0 ? home.uploadBlur.value : 0);
}
function GroundShadow() {
  return (
    <Svg width={210} height={24}>
      <Defs><RadialGradient id="gGround" cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor="#000" stopOpacity={0.6} /><Stop offset="1" stopColor="#000" stopOpacity={0} /></RadialGradient></Defs>
      <Ellipse cx={105} cy={12} rx={105} ry={12} fill="url(#gGround)" />
    </Svg>
  );
}

/** The "New presentation" item that grows into the gap while pulling up, and on Upload. */
function Ghost({ home, hue, order, empty }: { home: import('./shared').HomeShared; hue: HueName; order: number; empty: boolean }) {
  const style = useAnimatedStyle(() => {
    const spread = empty ? Math.max(1, spreadOf(home)) : spreadOf(home);
    const gsc = (0.6 + 0.4 * Math.min(1, spread)) * (home.analyzing.value ? 1 - 0.42 * home.analyzing.value : 1);
    return { opacity: spread > 0.01 ? Math.min(1, spread * 2.5) : 0, transform: [{ translateY: home.vy.value * 0.35 - (ORIGIN_Y - SLOT_FULL_H / 2) * (1 - gsc) * -1 }, { scale: gsc }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.slot, { zIndex: 300 }, style]}>
      <View style={styles.item}>
        <Txt numberOfLines={2} style={styles.title}>New presentation</Txt>
        <Txt style={styles.meta}>{'New · ' + pad2(order)}</Txt>
        <View style={styles.icon}><PresentationIcon icon="present" hue={hue} size={146} /></View>
      </View>
      <View style={styles.ground}><GroundShadow /></View>
    </Animated.View>
  );
}

// ── Pull up to add / pull down and hold to delete ────────────────────────────
function PullIndicator({ home, label }: { home: import('./shared').HomeShared; label: string }) {
  const add = useAnimatedStyle(() => ({ opacity: home.vy.value < -4 ? Math.min(1, -home.vy.value / PULL_T) : 0 }));
  const del = useAnimatedStyle(() => ({ opacity: home.vy.value > 4 ? Math.min(1, home.vy.value / PULL_T) : 0 }));
  const bin = useAnimatedStyle(() => ({ transform: [{ scale: Math.min(1, 0.4 + Math.min(1, home.vy.value / PULL_T) * 0.6) }] }));
  const ring = useAnimatedProps(() => ({ strokeDashoffset: 207.35 * (1 - home.hold.value), opacity: home.hold.value > 0 ? 1 : 0 }));
  const track = useAnimatedProps(() => ({ opacity: home.hold.value > 0 ? 1 : 0 }));
  const text = label === 'add' ? 'Pull up to add a presentation' : label === 'addPast' ? 'Release to add presentation'
    : label === 'del' ? 'Pull down to delete' : label === 'delPast' ? 'Keep holding to delete' : label === 'keep' ? 'Keep at least one presentation' : '';
  return <>
    <Animated.View pointerEvents="none" style={[styles.pullAdd, add]}><Txt style={styles.pullText}>{label.startsWith('add') ? text : ''}</Txt></Animated.View>
    <Animated.View pointerEvents="none" style={[styles.pullDel, del]}>
      <View style={styles.binWrap}>
        <Svg width={72} height={72} viewBox="0 0 72 72" style={StyleSheet.absoluteFill}>
          <Defs><LinearGradient id="gRedDel" x1="0" y1="0" x2="0.35" y2="1"><Stop offset="0" stopColor="#FF9A7C" /><Stop offset="1" stopColor="#EC2A35" /></LinearGradient></Defs>
          <AnimatedCircle cx={36} cy={36} r={33} fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth={3} animatedProps={track} />
          <AnimatedCircle cx={36} cy={36} r={33} fill="none" stroke="url(#gRedDel)" strokeWidth={3} strokeLinecap="round" strokeDasharray="207.35" transform="rotate(-90 36 36)" animatedProps={ring} />
        </Svg>
        <Animated.View style={[bin, { filter: [{ dropShadow: { offsetX: 0, offsetY: 10, standardDeviation: 14, color: 'rgba(236, 42, 53, 0.35)' } }] }]}><UIIcon name="i-trash" size={56} /></Animated.View>
      </View>
      <Txt style={styles.pullText}>{label.startsWith('del') || label === 'keep' ? text : ''}</Txt>
    </Animated.View>
  </>;
}

// ── Stats panel for the front presentation ───────────────────────────────────
function StatsPanel({ deck, home }: { deck: Presentation | null; home: import('./shared').HomeShared }) {
  const version = useStore(s => s.version);
  const model = useMemo(() => (deck ? deckModel(deck, getDeckState(deck.id)) : null), [deck, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => {
    const addOp = Math.min(1, Math.abs(home.vy.value) / PULL_T);
    const frac = Math.abs(home.p.value - Math.round(home.p.value));
    return { opacity: (home.vy.value < 0 ? 1 - Math.min(1, addOp * 1.6) * 0.9 : 1) * Math.max(0, 1 - frac * 2.4) };
  });
  if (!deck || !model) return null;
  const st = model.stats, run = model.state.run;
  const ringLen = 345.58;
  let pct = '—', unit = 'No runs yet', unitColor = C.secondary, grad: [string, string] = ['#9AF7D6', '#0EA877'], off = ringLen, ringOp = 0, label = 'Not rehearsed yet';
  let delta: { text: string; up: boolean } | null = null;
  const rows: { icon: 'i-slides' | 'i-bubble' | 'i-gauge'; val: string; unit: string; op: number }[] = [];
  const totalPts = model.points.reduce((a, p) => a + p.length, 0);
  if (run && st) {
    label = 'Last run · ' + (relativeDay(run.createdAt) || 'Earlier');
    if (st.coverage != null) {
      pct = st.coverage + '%';
      unit = st.coverage >= 90 ? 'On point' : st.coverage >= 75 ? 'Almost there' : 'Needs work';
      unitColor = st.coverage >= 90 ? '#3FD9A4' : st.coverage >= 75 ? '#FFB547' : '#FF7A6B';
      grad = st.coverage >= 90 ? ['#9AF7D6', '#0EA877'] : st.coverage >= 75 ? ['#FFE58C', '#FF8A1E'] : ['#FF9A7C', '#EC2A35'];
      off = ringLen * (1 - st.coverage / 100); ringOp = 1;
      const base = model.state.baselineCoverage;
      if (base != null && base !== st.coverage) delta = { text: (st.coverage > base ? '+' : '−') + Math.abs(st.coverage - base) + '%', up: st.coverage > base };
    } else {
      pct = model.pending ? '…' : '—';
      unit = model.pending ? 'Transcribing' : deck.text === 'ready' ? 'No speech' : 'No slide text';
    }
    rows.push({ icon: 'i-slides', val: st.coverage != null ? st.said + '/' + st.total : '—/' + (totalPts || '—'), unit: 'slide points said', op: st.coverage != null ? 1 : 0.45 });
    rows.push({ icon: 'i-bubble', val: st.fpm != null ? st.fpm.toFixed(1) : '—', unit: 'fillers / min', op: st.fpm != null ? 1 : 0.45 });
    rows.push({ icon: 'i-gauge', val: st.wpm != null ? String(st.wpm) : '—', unit: st.pace ? 'wpm · ' + st.pace : 'wpm', op: st.wpm != null ? 1 : 0.45 });
  } else {
    rows.push({ icon: 'i-slides', val: '—/' + (totalPts || '—'), unit: 'slide points said', op: 0.45 });
    rows.push({ icon: 'i-bubble', val: '—', unit: 'fillers / min', op: 0.45 });
    rows.push({ icon: 'i-gauge', val: '—', unit: 'wpm', op: 0.45 });
  }
  return (
    <Animated.View pointerEvents="none" style={[styles.stats, style]}>
      <View style={styles.ringBox}>
        <Svg width={120} height={120} viewBox="0 0 128 128" style={StyleSheet.absoluteFill}>
          <Defs><LinearGradient id={'gHero' + grad[0].slice(1)} x1="0" y1="0" x2="0.35" y2="1"><Stop offset="0" stopColor={grad[0]} /><Stop offset="1" stopColor={grad[1]} /></LinearGradient></Defs>
          <Circle cx={64} cy={64} r={55} fill="none" stroke={C.track} strokeWidth={13} />
          <Circle cx={64} cy={64} r={55} fill="none" stroke={`url(#gHero${grad[0].slice(1)})`} strokeWidth={13} strokeLinecap="round" strokeDasharray={`${ringLen}`}
            strokeDashoffset={off} opacity={ringOp} transform="rotate(-90 64 64)" />
        </Svg>
        <Txt style={styles.pct}>{pct}</Txt>
        <Txt style={[styles.unit, { color: unitColor }]}>{unit}</Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.statHead}>
          <Txt numberOfLines={1} style={styles.statLabel}>{label}</Txt>
          {delta && <View style={styles.delta}><UIIcon name={delta.up ? 'i-faster' : 'i-slower'} size={18} /><Txt style={[styles.deltaText, { color: delta.up ? '#3FD9A4' : '#FFB547' }]}>{delta.text}</Txt></View>}
        </View>
        <View style={{ gap: 10, marginTop: 14 }}>
          {rows.map(r => (
            <View key={r.icon} style={[styles.statRow, { opacity: r.op }]}>
              <UIIcon name={r.icon} size={22} />
              <Txt style={styles.statVal}>{r.val}</Txt>
              <Txt numberOfLines={1} style={styles.statUnit}>{r.unit}</Txt>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function Dots({ n, front }: { n: number; front: number }) {
  return (
    <View pointerEvents="none" style={styles.dots}>
      {Array.from({ length: Math.max(1, n) }, (_, i) => <View key={i} style={{ width: i === front ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === front ? '#F5F5F7' : '#45464F' }} />)}
    </View>
  );
}
function HomeHints({ home, empty }: { home: import('./shared').HomeShared; empty: boolean }) {
  const style = useAnimatedStyle(() => ({ opacity: home.vy.value < 0 ? 1 - Math.min(1, -home.vy.value / PULL_T) : 1 }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <HintRow gap={16} hints={empty ? [{ icon: 'h-tap', text: 'Tap to add' }, { icon: 'h-up', text: 'Add' }]
        : [{ icon: 'h-spin', text: 'Spin' }, { icon: 'h-tap', text: 'Open' }, { icon: 'h-hold', text: 'Icon' }, { icon: 'h-up', text: 'Add' }, { icon: 'h-dn', text: 'Delete' }]} />
    </Animated.View>
  );
}

// ── Icon picker (SPEC §4.2) ──────────────────────────────────────────────────
function IconPicker({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const deck = useStore(s => s.decks.find(d => d.id === deckId) ?? null);
  const frame = useFrame();
  const dy = useSharedValue(0);
  const enter = useSharedValue(0);
  useEffect(() => { enter.set(withTiming(1, { duration: 360, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })); }, [enter]);
  const drag: PanHandlers = {
    onMoveShould: (_e, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onMove: (_e, gs) => { dy.set(Math.max(0, gs.dy / frame.s)); },
    onRelease: () => { if (dy.get() > 110) onClose(); else dy.set(withTiming(0, { duration: 300, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })); },
    onTerminate: () => { dy.set(withTiming(0, { duration: 300 })); },
  };
  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, enter.value * 1.6) * Math.max(0.2, 1 - dy.value / 320) }));
  const sheet = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: dy.value + (1 - enter.value) * 80 }] }));
  if (!deck) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, scrim]}>
        <Pressable accessibilityLabel="Close icon picker" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8, 8, 12, 0.7)' }]} />
      </Animated.View>
      <PanView accessibilityViewIsModal style={[styles.sheet, sheet]} {...drag}>
        <View style={{ paddingHorizontal: 40, alignItems: 'center' }} pointerEvents="none">
          <Txt style={styles.pickTitle}>Choose an icon</Txt>
          <Txt numberOfLines={1} style={styles.pickSub}>{deck.title}</Txt>
        </View>
        <View style={styles.grid}>
          {ICONS.map(([id, name]) => {
            const sel = id === deck.icon;
            return (
              <Pressable key={id} accessibilityRole="button" accessibilityLabel={name + (sel ? ', current icon' : '')} accessibilityState={{ selected: sel }}
                onPress={() => { setIcon(deck.id, id as IconId); onClose(); }}
                style={[styles.tile, { backgroundColor: sel ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)', borderColor: sel ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.06)' }]}>
                <PresentationIcon icon={id} hue={deck.hue} size={48} />
              </Pressable>
            );
          })}
        </View>
      </PanView>
      <HintRow gap={6} hints={[{ icon: 'h-dn', text: 'Swipe down to close', nudge: 'down' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pickerBlur: { filter: [{ blur: 12 }] },
  addBlur: { filter: [{ blur: 8 }] },
  logo: { position: 'absolute', left: 0, right: 0, top: 51, height: 30, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: F.display, fontSize: 21, lineHeight: 22, letterSpacing: -0.4, color: C.text },
  carousel: { position: 'absolute', left: 0, top: 150, width: 390, height: 400, zIndex: 1 },
  ghostLayer: { position: 'absolute', left: 0, top: 150, width: 390, height: 400, zIndex: 2 },
  slot: { position: 'absolute', left: 65, top: SLOT_TOP, width: SLOT_W, height: SLOT_FULL_H },
  item: { width: SLOT_W, height: SLOT_H, alignItems: 'center' },
  title: { width: 244, textAlign: 'center', fontFamily: F.display, fontSize: 22, lineHeight: 23.8, letterSpacing: -0.4, color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  meta: { marginTop: 4, fontFamily: F.semibold, fontSize: 12, letterSpacing: 0.2, color: 'rgba(255, 255, 255, 0.62)' },
  icon: { marginTop: 'auto' },
  ground: { marginTop: 16, width: 210, height: 24, alignSelf: 'center' },
  pullAdd: { position: 'absolute', left: 0, right: 0, top: 508, zIndex: 4, alignItems: 'center' },
  pullDel: { position: 'absolute', left: 0, right: 0, top: 96, zIndex: 4, alignItems: 'center', gap: 6 },
  binWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  pullText: { fontFamily: F.semibold, fontSize: 13, color: C.text },
  stats: { position: 'absolute', left: 28, right: 28, top: 547, height: 136, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringBox: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  pct: { fontFamily: F.display, fontSize: 30, lineHeight: 31, letterSpacing: -0.8, color: C.text, fontVariant: ['tabular-nums'] },
  unit: { marginTop: 4, fontFamily: F.semibold, fontSize: 11, lineHeight: 12, letterSpacing: 0.3 },
  statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statLabel: { flexShrink: 1, fontFamily: F.semibold, fontSize: 14, color: C.secondary },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaText: { fontFamily: F.bold, fontSize: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statVal: { fontFamily: F.display, fontSize: 18, lineHeight: 20, color: C.text, fontVariant: ['tabular-nums'] },
  statUnit: { flexShrink: 1, fontFamily: F.medium, fontSize: 13, color: C.secondary },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 70, zIndex: 3, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  sheet: { position: 'absolute', left: 0, right: 0, top: 96, bottom: 0 },
  pickTitle: { fontFamily: F.display, fontSize: 22, letterSpacing: -0.4, color: C.text },
  pickSub: { marginTop: 4, fontFamily: F.medium, fontSize: 13, color: C.secondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginTop: 26, marginHorizontal: 20 },
  tile: { width: 80, height: 80, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
