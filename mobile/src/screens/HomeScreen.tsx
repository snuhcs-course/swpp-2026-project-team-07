// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode carousel: docs/ai-collaboration/iteration-2/prompt-log.md#guide-based-light-mode-october-15-2026
// Performance and add-preview changes with OpenAI Codex, Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration/iteration-2/prompt-log.md#home-idle-motion-removal-october-14-2026
// OpenAI Codex shorter Home ground shadows: docs/ai-collaboration/iteration-2/prompt-log.md#shorter-home-icon-shadows-october-15-2026
// OpenAI Codex Home float and shaped shadows: docs/ai-collaboration/iteration-2/prompt-log.md#home-icon-float-and-shaped-shadows-october-15-2026
// OpenAI Codex lighter dark Home shadows: docs/ai-collaboration/iteration-2/prompt-log.md#lighter-dark-home-shadows-october-15-2026
// OpenAI Codex supplied launcher mark and credits: docs/ai-collaboration/iteration-2/prompt-log.md#supplied-icon-and-home-credits-october-15-2026
// OpenAI Codex transparent Home overlays: docs/ai-collaboration/iteration-2/prompt-log.md#supplied-icon-and-home-credits-october-15-2026
// OpenAI Codex import setup background correction: docs/ai-collaboration/iteration-2/prompt-log.md#minimal-status-icons-october-15-2026
// OpenAI Codex UI-thread carousel gesture: docs/ai-collaboration/iteration-2/prompt-log.md#home-carousel-and-return-transition-performance-october-15-2026
// OpenAI Codex supplied delete icon: docs/ai-collaboration/iteration-2/prompt-log.md#home-delete-presentation-icon-october-15-2026
// OpenAI Codex continuous Home glow and responsive navigation: docs/ai-collaboration/iteration-2/prompt-log.md#continuous-carousel-color-and-navigation-responsiveness-october-15-2026
// OpenAI Codex stationary back crossfade: docs/ai-collaboration/iteration-2/prompt-log.md#stationary-back-crossfade-october-15-2026
// OutLoud redesign: Home (SPEC §4.1) and the icon picker (§4.2).
// OpenAI Codex Review and Full review: docs/ai-collaboration/iteration-2/prompt-log.md#review-and-full-review-redesign-october-15-2026
// OpenAI Codex stable import hue: docs/ai-collaboration/iteration-2/prompt-log.md#stable-presentation-import-colour-october-15-2026
// OpenAI Codex supplied stopwatch brand: docs/ai-collaboration/iteration-2/prompt-log.md#stopwatch-brand-icon-october-16-2026
// The carousel stays mounted behind Upload, which blurs it and opens a gap for the new item.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GestureDetector, useLongPressGesture, usePanGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue,
  withTiming, cancelAnimation, useAnimatedProps, useDerivedValue, useReducedMotion, withRepeat, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Txt, useFrame } from '../design/frame';
import { PresentationIcon, UIIcon } from '../design/icons';
import { PanView, type PanHandlers } from '../design/PanView';
import { C, F } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { ThemeToggle } from '../design/ThemeToggle';
import { ScoreRing } from '../design/ScoreRing';
import { HintRow, UndoToast } from '../design/ui';
import { coverFlow, HOLD_MS, PULL_T, PX_PER_CARD, rubber } from '../domain/gestures';
import { ICONS, type HueName, type IconId } from '../domain/hues';
import { mod, nearestSlot, pad2, relativeDay } from '../domain/format';
import { deckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { getDeckState, nextHue, setHidden, setIcon, useStore, visibleDecks, type Presentation } from '../features/presentations/store';
import { savedAttempts } from '../features/recording/storage';
import { pdfService } from '../features/pdf/service';
import { useBack, useHomeShell } from './shared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SLOT_W = 260, SLOT_H = 223, SLOT_TOP = 61, ORIGIN_Y = 111;
export const HomeScreen = memo(function HomeScreen({ mode, uploadLook }: { mode: 'home' | 'upload' | 'covered'; uploadLook: { hue: HueName; order: number } | null }) {
  const { c } = useTheme();
  const { go, home } = useHomeShell();
  const frame = useFrame();
  const decks = useStore(s => visibleDecks(s));
  const storeVersion = useStore(s => s.version);
  const n = decks.length;
  const [front, setFront] = useState(() => (n ? mod(Math.round(home.p.value), n) : 0));
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [undo, setUndo] = useState<{ deck: Presentation; at: number } | null>(null);
  const [pullLabel, setPullLabel] = useState<'' | 'add' | 'addPast' | 'del' | 'delPast' | 'keep'>('');
  const newHue = mode === 'upload' && uploadLook ? uploadLook.hue : nextHue();
  const newOrder = mode === 'upload' && uploadLook ? uploadLook.order : n + 1;
  const active = mode === 'home' && !pickerFor && !creditsOpen;
  const reducedMotion = useReducedMotion();
  const creditsOpacity = useSharedValue(0);
  useEffect(() => {
    creditsOpacity.set(reducedMotion ? Number(creditsOpen) : withTiming(Number(creditsOpen), { duration: 220 }));
  }, [creditsOpen, creditsOpacity, reducedMotion]);
  const creditsFade = useAnimatedStyle(() => ({ opacity: creditsOpacity.value }));
  const floatEnabled = active && !reducedMotion;
  const floatPhase = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(floatPhase);
    floatPhase.set(0);
    if (!floatEnabled) return;
    floatPhase.set(withRepeat(withTiming(2 * Math.PI, { duration: 4200, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(floatPhase);
  }, [floatEnabled, floatPhase]);

  useAnimatedReaction(() => (n ? mod(Math.round(home.p.value), n) : 0), (f, prev) => { if (f !== prev) runOnJS(setFront)(f); }, [n]);
  // The reaction re-syncs when n changes; until then keep the index in range.
  const shown = n ? Math.min(front, n - 1) : 0;

  const settle = useCallback((target: number) => {
    const dist = Math.abs(target - home.p.value);
    home.p.set(withTiming(target, { duration: Math.min(560, 230 + dist * 90), easing: Easing.out(Easing.cubic) }));
  }, [home.p]);

  const openFront = useCallback(() => {
    const deck = decks[mod(Math.round(home.p.value), Math.max(1, n))];
    if (deck) go('rehearse', { nav: 'fade', deckId: deck.id, slide: 0 });
  }, [decks, go, home.p, n]);
  const openAdd = useCallback(() => {
    settle(Math.round(home.p.value));
    home.gap.set(1);
    // OpenAI Codex page fade: docs/ai-collaboration/iteration-2/prompt-log.md#smooth-page-fades-october-15-2026
    go('upload', { nav: 'fade' });
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

  // The drag path stays on the UI thread; JS runs only for a tap, icon picker,
  // add/delete action, or a change in the pull hint's wording.
  const dragStart = useSharedValue(0);
  const dragAxis = useSharedValue(0); // 1 = horizontal, 2 = vertical
  const holdArmed = useSharedValue(false);
  const holdDone = useSharedValue(false);
  const labelStage = useSharedValue(0);
  const local = (absoluteX: number, absoluteY: number) => ({ x: (absoluteX - frame.left) / frame.s, y: (absoluteY - frame.top) / frame.s - 150 });
  /** Which item a tap at (x, y) in carousel coordinates hit, front first. */
  const hitSlot = (x: number, y: number) => {
    if (!n) return x > 65 && x < 325 && y > SLOT_TOP && y < SLOT_TOP + SLOT_H ? -1 : null;
    const order = decks.map((_, j) => ({ j, f: coverFlow(j, home.p.value, n, 0) })).filter(o => o.f.live).sort((a, b) => b.f.z - a.f.z);
    for (const { j, f } of order) {
      const half = (SLOT_W / 2) * f.scale * Math.cos((f.rotateY * Math.PI) / 180);
      if (Math.abs(x - (195 + f.x)) < half && y > SLOT_TOP && y < SLOT_TOP + SLOT_H) return j;
    }
    return null;
  };
  const onTap = (absoluteX: number, absoluteY: number) => {
    const { x, y } = local(absoluteX, absoluteY);
    const slot = hitSlot(x, y);
    if (!n) { if (slot === -1) openAdd(); return; }
    if (slot === null) return;
    const selected = mod(Math.round(home.p.value), n);
    if (slot === selected) openFront();
    else settle(nearestSlot(home.p.value, slot, n));
  };
  const onLongPress = (absoluteX: number, absoluteY: number) => {
    if (!n || Math.abs(home.p.value - Math.round(home.p.value)) >= 0.05) return;
    const { x, y } = local(absoluteX, absoluteY);
    const selected = mod(Math.round(home.p.value), n);
    if (hitSlot(x, y) !== selected) return;
    const deck = decks[selected];
    if (!deck) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setPickerFor(deck.id);
    home.picker.set(withTiming(1, { duration: 220 }));
  };
  const pan = usePanGesture({
    enabled: active,
    minDistance: 8,
    onBegin: () => {
      dragAxis.value = 0;
      holdArmed.value = false;
      holdDone.value = false;
      labelStage.value = 0;
    },
    onActivate: () => {
      cancelAnimation(floatPhase);
      floatPhase.value = 0;
      home.press.value = withTiming(1, { duration: 100 });
    },
    onUpdate: e => {
      // Android can activate a Pan with zero translation. Choose the direction
      // from the first movement update instead of defaulting to horizontal.
      if (!dragAxis.value) {
        if (Math.abs(e.translationX) < 2 && Math.abs(e.translationY) < 2) return;
        dragAxis.value = Math.abs(e.translationX) >= Math.abs(e.translationY) ? 1 : 2;
        cancelAnimation(home.p);
        if (dragAxis.value === 1) {
          // The initial gesture movement is already included in translationX.
          dragStart.value = home.p.value + e.translationX / frame.s / PX_PER_CARD;
        }
      }
      if (dragAxis.value === 1) {
        if (n) home.p.value = dragStart.value - e.translationX / frame.s / PX_PER_CARD;
        return;
      }
      if (dragAxis.value !== 2) return;
      const v = rubber(e.translationY / frame.s, PULL_T, 0.3);
      home.vy.value = v;
      const stage = v < -4 ? (v <= -PULL_T * 0.98 ? -2 : -1) : v > 4 ? (n <= 1 ? 3 : v >= PULL_T * 0.98 ? 2 : 1) : 0;
      if (stage !== labelStage.value) {
        labelStage.value = stage;
        runOnJS(setPullLabel)(stage === -2 ? 'addPast' : stage === -1 ? 'add' : stage === 1 ? 'del' : stage === 2 ? 'delPast' : stage === 3 ? 'keep' : '');
      }
      if (v >= PULL_T * 0.98 && n > 1 && !holdArmed.value && !holdDone.value) {
        holdArmed.value = true;
        home.hold.value = 0;
        home.hold.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, finished => {
          if (finished && holdArmed.value) {
            holdDone.value = true;
            holdArmed.value = false;
            home.hold.value = 0;
            runOnJS(deleteFront)();
          }
        });
      } else if (v < PULL_T * 0.98 && holdArmed.value) {
        holdArmed.value = false;
        cancelAnimation(home.hold);
        home.hold.value = 0;
      }
    },
    onDeactivate: e => {
      const pulled = home.vy.value;
      const wasDeleted = holdDone.value;
      holdArmed.value = false;
      cancelAnimation(home.hold);
      home.hold.value = 0;
      home.press.value = withTiming(1, { duration: 120 });
      home.vy.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.exp) });
      if (labelStage.value) runOnJS(setPullLabel)('');
      labelStage.value = 0;
      if (dragAxis.value === 1 && n) {
        const velocity = e.canceled ? 0 : -e.velocityX / frame.s / PX_PER_CARD;
        const target = Math.round(home.p.value + Math.max(-8, Math.min(8, velocity * 0.35)));
        const distance = Math.abs(target - home.p.value);
        home.p.value = withTiming(target, { duration: Math.min(560, 230 + distance * 90), easing: Easing.out(Easing.cubic) });
      } else if (dragAxis.value === 2 && !e.canceled && !wasDeleted && pulled <= -PULL_T * 0.98) {
        runOnJS(openAdd)();
      }
      dragAxis.value = 0;
      if (floatEnabled) floatPhase.value = withRepeat(withTiming(2 * Math.PI, { duration: 4200, easing: Easing.linear }), -1, false);
    },
  });
  const longPress = useLongPressGesture({
    enabled: active, minDuration: 550, maxDistance: 8,
    onBegin: () => { home.press.value = withTiming(0.93, { duration: 180 }); },
    onActivate: e => { home.press.value = withTiming(1, { duration: 180 }); runOnJS(onLongPress)(e.absoluteX, e.absoluteY); },
    onFinalize: () => { home.press.value = withTiming(1, { duration: 180 }); },
  });
  const tap = useTapGesture({
    enabled: active, maxDistance: 8,
    onActivate: e => { runOnJS(onTap)(e.absoluteX, e.absoluteY); },
  });
  const carouselGesture = useSimultaneousGestures(pan, longPress, tap);

  useBack(mode === 'home' && (creditsOpen || !!pickerFor), () => {
    if (creditsOpen) setCreditsOpen(false);
    else closePicker();
    return true;
  });
  function closePicker() { home.picker.set(withTiming(0, { duration: 220 })); setPickerFor(null); }

  const frontDeck = n ? decks[shown] : null;
  const frontModel = frontDeck ? cachedHomeModel(frontDeck, storeVersion) : null;
  const openFullReview = () => {
    if (mode !== 'home' || pickerFor || creditsOpen || Math.abs(home.p.value - Math.round(home.p.value)) >= 0.2 || home.vy.value !== 0) return;
    const deck = decks[mod(Math.round(home.p.value), Math.max(1, n))];
    if (deck && getDeckState(deck.id).run) go('full', { nav: 'fade', deckId: deck.id, from: 'home' });
  };
  const setupDim = useAnimatedStyle(() => ({ opacity: 1 - 0.96 * home.setup.value }));
  const homeLayer = useAnimatedStyle(() => {
    // A live blur forces Android to upload the entire moving carousel as a bitmap.
    // Dim only the existing cards; the new icon remains crisp above them.
    return { opacity: 1 - 0.58 * home.uploadBlur.value };
  });
  // Keep controls mounted so they appear gradually when Upload fades back to Home.
  const homeControls = useAnimatedStyle(() => ({ opacity: 1 - home.uploadBlur.value }));
  const visibleSlots = decks.map((deck, j) => ({ deck, j })).filter(({ j }) =>
    Math.min(mod(j - shown, n || 1), mod(shown - j, n || 1)) <= 2);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={mode === 'home' ? 'box-none' : 'none'}
      accessibilityElementsHidden={mode !== 'home'} importantForAccessibility={mode === 'home' ? 'auto' : 'no-hide-descendants'}>
      <Animated.View pointerEvents="box-none" accessibilityElementsHidden={creditsOpen} importantForAccessibility={creditsOpen ? 'no-hide-descendants' : 'auto'}
        style={[StyleSheet.absoluteFill, pickerFor || creditsOpen ? styles.overlayBlur : null, setupDim]}>
      <View pointerEvents="none" style={styles.logo}><Txt style={styles.logoText}>OutLoud</Txt></View>
      <Animated.View pointerEvents={mode === 'home' ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, homeControls]}>
        {!pickerFor && <Pressable accessibilityRole="button" accessibilityLabel="About OutLoud" onPress={() => setCreditsOpen(true)}
          style={styles.brandMarkButton}><BrandMark color={c.strong} /></Pressable>}
        {!pickerFor && <ThemeToggle />}
      </Animated.View>
      <GestureDetector gesture={carouselGesture}><Animated.View style={[styles.carousel, homeLayer, mode === 'upload' && styles.addBlur]}
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
        {visibleSlots.map(({ deck, j }) => <Slot key={deck.id} deck={deck} j={j} n={n} home={home}
          floatPhase={floatPhase} floatEnabled={floatEnabled} isFront={j === shown} />)}
      </Animated.View></GestureDetector>
      <View pointerEvents="none" style={styles.ghostLayer}>
        <Ghost home={home} hue={newHue} order={newOrder} empty={!n} />
      </View>
      <Animated.View pointerEvents={mode === 'home' ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, homeControls]}>
        <PullIndicator home={home} label={pullLabel} />
        <StatsPanel deck={frontDeck} home={home} />
        {frontDeck && frontModel?.state.run && <Pressable accessibilityRole="button"
          accessibilityLabel={`Full review of ${frontDeck.title}${frontModel.stats?.coverage == null ? '' : `: ${frontModel.stats.coverage}% of slide points said`}`}
          onPress={openFullReview} style={styles.fullReviewRingTarget} />}
        <Dots n={n} front={shown} />
        <HomeHints home={home} empty={!n} />
        {undo && <UndoToast text={`Deleted “${undo.deck.title}”`} onUndo={undoDelete} />}
      </Animated.View>
      </Animated.View>
      {pickerFor && <IconPicker deckId={pickerFor} onClose={closePicker} />}
      <Animated.View pointerEvents={creditsOpen ? 'auto' : 'none'} accessibilityElementsHidden={!creditsOpen}
        importantForAccessibility={creditsOpen ? 'yes' : 'no-hide-descendants'} accessibilityViewIsModal={creditsOpen}
        style={[styles.creditsOverlay, creditsFade]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close credits" onPress={() => setCreditsOpen(false)} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.creditNames}>
          {['박서연', '전인준', '최재원', '현주영'].map(name => <Txt key={name} style={[styles.creditName, { color: c.strong }]}>{name}</Txt>)}
        </View>
      </Animated.View>
    </View>
  );
});
/** The supplied stopwatch mark without its dark tile, cropped for the Home header. */
function BrandMark({ color }: { color: string }) {
  return <Svg width={31} height={31} viewBox="26 22 63 62" accessibilityElementsHidden>
    <G transform="translate(54 54) scale(0.94) translate(-54 -54)">
      <Rect x={51} y={27} width={6} height={8} fill={color} />
      <Rect x={44.5} y={23.6} width={19} height={7} rx={2.6} fill={color} />
      <Circle cx={54} cy={59.1} r={22} fill="none" stroke={color} strokeWidth={6.5} />
      <Path d="M49.43 80.62 Q39 79.6 30 82 Q35.2 74.5 32.75 64.79 A22 22 0 0 0 49.43 80.62 Z"
        fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M54 59.1 L54 44.1 A15 15 0 1 0 69 59.1 Z" fill="#FF5A26" />
      <Path d="M70.92 34.94 L73.50 31.25 M79.55 44.35 L83.44 42.10 M83.39 56.53 L87.87 56.14"
        fill="none" stroke={color} strokeWidth={4.2} strokeLinecap="round" />
    </G>
  </Svg>;
}
function indexOfDeck(id: string) { return Math.max(0, visibleDecks().findIndex(d => d.id === id)); }

// ── One carousel item: title, meta, icon, ground shadow ──────────────────────
const Slot = memo(function Slot({ deck, j, n, home, floatPhase, floatEnabled, isFront }: {
  deck: Presentation; j: number; n: number; home: import('./shared').HomeShared;
  floatPhase: SharedValue<number>; floatEnabled: boolean; isFront: boolean;
}) {
  // A memoized slot must subscribe to theme changes to refresh its text styles.
  const { mode, c } = useTheme();
  const flow = useDerivedValue(() => coverFlow(j, home.p.value, n, spreadOf(home)));
  const outer = useAnimatedStyle(() => {
    const f = flow.value;
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
    const f = flow.value;
    const front = Math.abs(f.dd) < 0.5 && n > 1;
    const pull = home.vy.value > 0 ? Math.min(1, home.vy.value / PULL_T) : 0;
    const del = front ? (home.hold.value > 0 ? 0.3 + 0.7 * home.hold.value : pull * 0.3) : 0;
    return {
      opacity: f.opacity * (mode === 'light' ? 1 : f.brightness) * (1 - del * 0.45),
      transform: [{ perspective: 700 }, { rotateY: f.rotateY + 'deg' }],
    };
  });
  const icon = useAnimatedStyle(() => ({ transform: [
    { translateY: floatEnabled ? -floatLift(home, floatPhase.value, j) : 0 },
    { scale: isFront ? home.press.value : 1 },
  ] }));
  const shadow = useAnimatedStyle(() => {
    const f = flow.value;
    return { opacity: f.shadowOpacity, transform: [{ scaleX: f.shadowScale }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.slot, outer]}>
      <Animated.View style={[styles.item, body]}>
        <Txt numberOfLines={2} style={[styles.title, mode === 'light' && { color: c.strong }]}>{deck.title}</Txt>
        <Txt style={styles.meta}>{(deck.pageCount || '—') + ' slides · ' + pad2(j + 1)}</Txt>
        <Animated.View renderToHardwareTextureAndroid style={[styles.icon, icon]}>
          <PresentationIcon icon={deck.icon} hue={deck.hue} size={146} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.ground, shadow]}><GroundShadow icon={deck.icon} /></Animated.View>
    </Animated.View>
  );
});
const SLOT_FULL_H = SLOT_H + 16 + 24;
const GROUND_W = 150;
const SHADOW_SIZE: Record<IconId, readonly [number, number]> = {
  present: [150, 24], chart: [136, 22], growth: [142, 23], money: [148, 23], bulb: [110, 19],
  rocket: [118, 20], cap: [148, 24], book: [138, 22], flask: [116, 19], atom: [146, 23],
  globe: [142, 23], computer: [144, 23], math: [142, 23], megaphone: [132, 21], team: [140, 22],
  heart: [140, 22], briefcase: [144, 23], target: [142, 23], calendar: [138, 22], palette: [140, 22],
};
function floatLift(home: import('./shared').HomeShared, phase: number, index: number) {
  'worklet';
  const dragging = Math.max(
    Math.min(1, Math.abs(home.vy.value) / 12),
    Math.min(1, Math.abs(home.p.value - Math.round(home.p.value)) / 0.08),
    Math.min(1, (1 - home.press.value) / 0.05),
    home.hold.value,
  );
  return 2.5 * (1 - Math.cos(phase + index * 0.65)) * (1 - dragging);
}
function spreadOf(home: import('./shared').HomeShared) {
  'worklet';
  const pull = home.vy.value < 0 ? Math.min(1, -home.vy.value / PULL_T) : 0;
  return Math.max(pull, home.gap.value, home.uploadBlur.value > 0 ? home.uploadBlur.value : 0);
}
function GroundShadow({ icon }: { icon: IconId }) {
  const { mode } = useTheme();
  const [width, height] = SHADOW_SIZE[icon];
  // Android SVG stops need opacity separate from the color for consistent strength.
  const color = mode === 'light' ? '#15171E' : '#000000';
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id="gGround" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={mode === 'light' ? 0.14 : 0.34} />
          <Stop offset="0.55" stopColor={color} stopOpacity={mode === 'light' ? 0.06 : 0.15} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill="url(#gGround)" />
    </Svg>
  );
}

/** The "New presentation" item that grows into the gap while pulling up, and on Upload. */
function Ghost({ home, hue, order, empty }: { home: import('./shared').HomeShared; hue: HueName; order: number; empty: boolean }) {
  const { mode, c } = useTheme();
  const style = useAnimatedStyle(() => {
    const spread = empty ? Math.max(1, spreadOf(home)) : spreadOf(home);
    const gsc = (0.6 + 0.4 * Math.min(1, spread)) * (home.analyzing.value ? 1 - 0.42 * home.analyzing.value : 1);
    return { opacity: spread > 0.01 ? Math.min(1, spread * 2.5) : 0, transform: [{ translateY: home.vy.value * 0.35 - (ORIGIN_Y - SLOT_FULL_H / 2) * (1 - gsc) * -1 }, { scale: gsc }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.slot, { zIndex: 300 }, style]}>
      <View style={styles.item}>
        <Txt numberOfLines={2} style={[styles.title, mode === 'light' && { color: c.strong }]}>
          New presentation
        </Txt>
        <Txt style={styles.meta}>{'New · ' + pad2(order)}</Txt>
        <View style={styles.icon}><PresentationIcon icon="present" hue={hue} size={146} /></View>
      </View>
      <View style={styles.ground}><GroundShadow icon="present" /></View>
    </Animated.View>
  );
}

// ── Pull up to add / pull down and hold to delete ────────────────────────────
function PullIndicator({ home, label }: { home: import('./shared').HomeShared; label: string }) {
  const { c, mode } = useTheme();
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
          <AnimatedCircle cx={36} cy={36} r={33} fill="none" stroke={c.border12} strokeWidth={3} animatedProps={track} />
          <AnimatedCircle cx={36} cy={36} r={33} fill="none" stroke="url(#gRedDel)" strokeWidth={3} strokeLinecap="round" strokeDasharray="207.35" transform="rotate(-90 36 36)" animatedProps={ring} />
        </Svg>
        <Animated.View style={[bin, { filter: [{ dropShadow: { offsetX: 0, offsetY: 10, standardDeviation: 14, color: 'rgba(236, 42, 53, 0.35)' } }] }]}>
          <Svg width={35.2} height={35.2} viewBox="0 0 300 300" accessible={false}>
            <Path d="M113 61 V54 C113 34 129 22 150 22 C171 22 187 34 187 54 V61"
              fill="none" stroke={mode === 'dark' ? '#FFFFFF' : '#000000'} strokeWidth={29} strokeLinecap="round" />
            <Rect x={34} y={60} width={232} height={30} rx={11} fill={mode === 'dark' ? '#FFFFFF' : '#000000'} />
            <Path d="M68 104 L80 220 Q83 257 121 257 H179 Q217 257 220 220 L232 104"
              fill="none" stroke={mode === 'dark' ? '#FFFFFF' : '#000000'} strokeWidth={31} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </View>
      <Txt style={styles.pullText}>{label.startsWith('del') || label === 'keep' ? text : ''}</Txt>
    </Animated.View>
  </>;
}

// ── Stats panel for the front presentation ───────────────────────────────────
const homeModelCache = new Map<string, { deck: Presentation; version: number; model: DeckModel }>();
function cachedHomeModel(deck: Presentation, version: number): DeckModel {
  const cached = homeModelCache.get(deck.id);
  if (cached?.deck === deck && cached.version === version) return cached.model;
  const model = deckModel(deck, getDeckState(deck.id));
  homeModelCache.delete(deck.id);
  homeModelCache.set(deck.id, { deck, version, model });
  if (homeModelCache.size > 8) homeModelCache.delete(homeModelCache.keys().next().value!);
  return model;
}
const StatsPanel = memo(function StatsPanel({ deck, home }: { deck: Presentation | null; home: import('./shared').HomeShared }) {
  const { c } = useTheme();
  const version = useStore(s => s.version);
  const model = useMemo(() => (deck ? cachedHomeModel(deck, version) : null), [deck, version]);
  const style = useAnimatedStyle(() => {
    const addOp = Math.min(1, Math.abs(home.vy.value) / PULL_T);
    const frac = Math.abs(home.p.value - Math.round(home.p.value));
    return { opacity: (home.vy.value < 0 ? 1 - Math.min(1, addOp * 1.6) * 0.9 : 1) * Math.max(0, 1 - frac * 2.4) };
  });
  if (!deck || !model) return null;
  const st = model.stats, run = model.state.run;
  let pct = '—', unit = 'No runs yet', unitColor = c.secondary, grad: [string, string] = ['#9AF7D6', '#0EA877'], label = 'Not rehearsed yet';
  let delta: { text: string; up: boolean } | null = null;
  const rows: { icon: 'i-slides' | 'i-bubble' | 'i-gauge'; val: string; unit: string; op: number }[] = [];
  const totalPts = model.points.reduce((a, p) => a + p.length, 0);
  if (run && st) {
    label = 'Last run · ' + (relativeDay(run.createdAt) || 'Earlier');
    if (st.coverage != null) {
      pct = st.coverage + '%';
      unit = st.coverage >= 90 ? 'On point' : st.coverage >= 75 ? 'Almost there' : 'Needs work';
      unitColor = st.coverage >= 90 ? c.good : st.coverage >= 75 ? c.warnAlt : c.badAlt;
      grad = st.coverage >= 90 ? ['#9AF7D6', '#0EA877'] : st.coverage >= 75 ? ['#FFE58C', '#FF8A1E'] : ['#FF9A7C', '#EC2A35'];
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
      <ScoreRing id="gHomeScore" percent={st?.coverage ?? null} value={pct} label={unit} labelColor={unitColor} gradient={grad} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.statHead}>
          <Txt numberOfLines={1} style={styles.statLabel}>{label}</Txt>
          {delta && <View style={styles.delta}><UIIcon name={delta.up ? 'i-faster' : 'i-slower'} size={18} /><Txt style={[styles.deltaText, { color: delta.up ? c.good : c.warnAlt }]}>{delta.text}</Txt></View>}
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
});

function Dots({ n, front }: { n: number; front: number }) {
  const { c } = useTheme();
  return (
    <View pointerEvents="none" style={styles.dots}>
      {Array.from({ length: Math.max(1, n) }, (_, i) => <View key={i} style={{ width: i === front ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === front ? c.text : c.dotOff }} />)}
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
  const { c } = useTheme();
  const deck = useStore(s => s.decks.find(d => d.id === deckId) ?? null);
  const frame = useFrame();
  const dy = useSharedValue(0);
  const enter = useSharedValue(0);
  useEffect(() => { enter.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })); }, [enter]);
  const drag: PanHandlers = {
    onMoveShould: (_e, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onMove: (_e, gs) => { dy.set(Math.max(0, gs.dy / frame.s)); },
    onRelease: () => { if (dy.get() > 110) onClose(); else dy.set(withTiming(0, { duration: 300, easing: Easing.bezier(0.2, 0.8, 0.2, 1) })); },
    onTerminate: () => { dy.set(withTiming(0, { duration: 300 })); },
  };
  const sheet = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: dy.value }] }));
  if (!deck) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
      <Pressable accessibilityLabel="Close icon picker" onPress={onClose} style={StyleSheet.absoluteFill} />
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
                style={styles.tile}>
                <PresentationIcon icon={id} hue={deck.hue} size={48} />
                {sel && <View pointerEvents="none" style={[styles.selectedDot, { backgroundColor: c.strong }]} />}
              </Pressable>
            );
          })}
        </View>
      </PanView>
      <HintRow gap={6} hints={[{ icon: 'h-dn', text: 'Swipe down to close', nudge: 'down' }]} />
    </View>
  );
}

const styles = createThemedStyles({
  overlayBlur: { filter: [{ blur: 18 }] },
  addBlur: { filter: [{ blur: 8 }] },
  logo: { position: 'absolute', left: 0, right: 0, top: 57, height: 36, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: F.display, fontSize: 26, lineHeight: 27, letterSpacing: -0.5, color: C.text },
  // OpenAI Codex header alignment: docs/ai-collaboration/iteration-2/prompt-log.md#home-header-vertical-alignment-october-15-2026
  brandMarkButton: { position: 'absolute', left: 14, top: 53, width: 44, height: 44, zIndex: 40, alignItems: 'center', justifyContent: 'center' },
  creditsOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  creditNames: { alignItems: 'center', gap: 16 },
  creditName: { fontSize: 27, lineHeight: 40, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  carousel: { position: 'absolute', left: 0, top: 150, width: 390, height: 400, zIndex: 1 },
  ghostLayer: { position: 'absolute', left: 0, top: 150, width: 390, height: 400, zIndex: 2 },
  slot: { position: 'absolute', left: 65, top: SLOT_TOP, width: SLOT_W, height: SLOT_FULL_H },
  item: { width: SLOT_W, height: SLOT_H, alignItems: 'center' },
  title: { width: 244, textAlign: 'center', fontFamily: F.display, fontSize: 22, lineHeight: 23.8, letterSpacing: -0.4, color: C.text },
  meta: { marginTop: 4, fontFamily: F.semibold, fontSize: 12, letterSpacing: 0.2, color: 'rgba(255, 255, 255, 0.62)' },
  icon: { marginTop: 'auto' },
  ground: { marginTop: 16, width: GROUND_W, height: 24, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  pullAdd: { position: 'absolute', left: 0, right: 0, top: 508, zIndex: 4, alignItems: 'center' },
  pullDel: { position: 'absolute', left: 0, right: 0, top: 96, zIndex: 4, alignItems: 'center', gap: 6 },
  binWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  pullText: { fontFamily: F.semibold, fontSize: 13, color: C.text },
  stats: { position: 'absolute', left: 28, right: 28, top: 547, height: 136, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 18 },
  fullReviewRingTarget: { position: 'absolute', left: 28, top: 555, width: 120, height: 120, borderRadius: 60, zIndex: 4 },
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
  tile: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  selectedDot: { position: 'absolute', bottom: 0, width: 6, height: 6, borderRadius: 3 },
});
