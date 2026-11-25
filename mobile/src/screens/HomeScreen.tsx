// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode carousel: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-081
// Performance and add-preview changes with OpenAI Codex, Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OpenAI Codex follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-049
// OpenAI Codex shorter Home ground shadows: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-088
// OpenAI Codex Home float and shaped shadows: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-096
// OpenAI Codex lighter dark Home shadows: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-097
// OpenAI Codex supplied launcher mark and credits: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-104
// OpenAI Codex transparent Home overlays: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-104
// OpenAI Codex import setup background correction: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-108
// OpenAI Codex import-ring geometry: docs/ai-collaboration-prompts-iteration-2.md#centre-pdf-import-ring
// OpenAI Codex compact carousel visibility: docs/ai-collaboration-prompts-iteration-2.md#show-neighbouring-home-presentations
// OpenAI Codex UI-thread carousel gesture: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-109
// OpenAI Codex supplied delete icon: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-110
// OpenAI Codex continuous Home glow and responsive navigation: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-114
// OpenAI Codex stationary back crossfade: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-119
// OutLoud redesign: Home (SPEC §4.1) and the icon picker (§4.2).
// OpenAI Codex Review and Full review: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-122
// OpenAI Codex stable import hue: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-123
// OpenAI Codex supplied stopwatch brand: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-126
// The carousel stays mounted for the Add handoff and is hidden during PDF import.
// Claude prototype guide integrated by OpenAI Codex, Iteration 4 (2026-11-21): eight tutorial pages with native swipes.
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GestureDetector, useLongPressGesture, usePanGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue,
  withTiming, cancelAnimation, useAnimatedProps, useDerivedValue, useReducedMotion, withRepeat, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Txt, useFrame } from '../design/frame';
import { PresentationIcon } from '../design/icons';
import { PanView, type PanHandlers } from '../design/PanView';
import { C, DECK_COLORS, F, HUES } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { ThemeToggle } from '../design/ThemeToggle';
import { LanguageToggle } from '../design/LanguageToggle';
import { HintRow, UndoToast } from '../design/ui';
import { useUiText } from '../design/language';
import { writeStored } from '../services/storage';
import { BACK_FADE_Y, coverFlow, homeCarouselRelease, HOLD_MS, PULL_T, PX_PER_CARD, rubber } from '../domain/gestures';
import { ICONS, pickHue, type HueName, type IconId } from '../domain/hues';
import { mod, nearestSlot, pad2 } from '../domain/format';
import { HomeFeedbackStats } from './HomeFeedbackStats';
import { ANALYZE_ICON_SCALE, CAROUSEL_TOP, deckIconSize, HOME_TITLE_BLENDED, homeSlideCountReveal, homeTitleReveal, ORIGIN_Y, SLOT_H, SLOT_TOP, SLOT_W } from './homeGeometry';
import { getDeckState, setHidden, setHue, setIcon, useStore, visibleDecks, type Presentation } from '../features/presentations/store';
import { savedAttempts } from '../features/recording/storage';
import { pdfService } from '../features/pdf/service';
import { hasSeenTutorial, TUTORIAL_SEEN, useBack, useHomeShell } from './shared';
import { TutorialOverlay } from './HomeTutorial';
import { STORE_MODE } from '../services/apiConfig';
import { storePrivacy, subscribePrivacy } from '../services/storePrivacy';
import { useStorePrivacyPrompt } from './storePrivacyDialog';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const FAST_SPIN_CARDS_PER_SECOND = 6;
type CarouselFocus = { front: number; motion: 'idle' | 'slow' | 'fast' };
export const HomeScreen = memo(function HomeScreen({ mode, showCoveredChrome = false, uploadLook, readingPdf = false, onFrontDeckChange }: {
  mode: 'home' | 'upload' | 'rehearse' | 'covered'; showCoveredChrome?: boolean; uploadLook: { hue: HueName; order: number } | null;
  readingPdf?: boolean;
  onFrontDeckChange?: (id: string | null) => void;
}) {
  const ui = useUiText();
  const privacy = useSyncExternalStore(subscribePrivacy, storePrivacy.read);
  const { show: showStorePrivacy, dialog: storePrivacyDialog } = useStorePrivacyPrompt();
  const openWithPrivacy = useCallback((next: () => void) => {
    if (STORE_MODE && (!privacy || privacy === 'expired')) showStorePrivacy(next);
    else next();
  }, [privacy, showStorePrivacy]);
  const { c } = useTheme();
  const { go, home } = useHomeShell();
  const frame = useFrame();
  const snapshot = useStore(s => s);
  const decks = useMemo(() => visibleDecks(snapshot), [snapshot]);
  const n = decks.length;
  const [{ front, motion }, setFocus] = useState<CarouselFocus>(() => ({ front: Math.round(home.p.value), motion: 'idle' }));
  const spinning = useSharedValue(false);
  const fastSpinning = useSharedValue(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pickerClosing, setPickerClosing] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [tutorialSeen, setTutorialSeen] = useState(hasSeenTutorial);
  const [tutorialPage, setTutorialPage] = useState<number | null>(mode === 'home' && !tutorialSeen ? 0 : null);
  const [tutorialClosing, setTutorialClosing] = useState(false);
  const tutorialCover = useSharedValue(0);
  const [undo, setUndo] = useState<{ deck: Presentation; at: number } | null>(null);
  const [pullLabel, setPullLabel] = useState<'' | 'add' | 'addPast' | 'del' | 'delPast' | 'keep'>('');
  const newHue = useMemo(() => mode === 'upload' && uploadLook
    ? uploadLook.hue : pickHue(decks.map(deck => deck.hue)), [mode, uploadLook, decks]);
  const newOrder = mode === 'upload' && uploadLook ? uploadLook.order : n + 1;
  const tutorialOpen = tutorialPage !== null;
  const uncoveredHome = mode === 'home' && !pickerFor && !creditsOpen;
  const active = uncoveredHome && !tutorialOpen;
  useEffect(() => {
    if (!STORE_MODE || !active || !tutorialSeen || privacy !== null) return;
    const offer = () => { if (storePrivacy.read() === null) showStorePrivacy(); };
    const state = AppState.addEventListener('change', next => { if (next === 'active') offer(); });
    if (AppState.currentState === 'active') offer();
    return () => state.remove();
  }, [active, privacy, showStorePrivacy, tutorialSeen]);
  const showHomeChrome = (mode !== 'covered' || showCoveredChrome) && !pickerFor && !readingPdf;
  const tutorialAppearance = tutorialOpen && !tutorialSeen;
  const appearanceEnabled = active || (uncoveredHome && tutorialAppearance);
  const reducedMotion = useReducedMotion();
  const creditsOpacity = useSharedValue(0);
  useEffect(() => {
    creditsOpacity.set(reducedMotion ? Number(creditsOpen) : withTiming(Number(creditsOpen), { duration: 220 }));
  }, [creditsOpen, creditsOpacity, reducedMotion]);
  const creditsFade = useAnimatedStyle(() => ({ opacity: creditsOpacity.value }));
  const floatEnabled = !reducedMotion && (uncoveredHome || mode === 'rehearse' || mode === 'upload');
  const floatPaused = tutorialOpen || mode === 'rehearse' || mode === 'upload';
  const openTutorial = () => { setTutorialClosing(false); setTutorialPage(0); };
  const closeTutorial = () => {
    setTutorialPage(null);
    setTutorialClosing(false);
    setTutorialSeen(true);
    try { writeStored(TUTORIAL_SEEN, true); } catch { /* Reopen automatically next launch. */ }
  };
  const floatPhase = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(floatPhase);
    if (!floatEnabled) {
      floatPhase.set(0);
      return;
    }
    // Keep background icons at their paused height while an overlay covers Home.
    if (floatPaused) return;
    const phase = floatPhase.get();
    floatPhase.set(withRepeat(withTiming(phase + 2 * Math.PI, { duration: 4200, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(floatPhase);
  }, [floatEnabled, floatPaused, floatPhase]);

  useAnimatedReaction((): CarouselFocus => {
    const motion = spinning.value ? fastSpinning.value ? 'fast' : 'slow' : 'idle';
    const position = home.p.value;
    // Five slots already cover both visible neighbours for a two-card window.
    const front = motion === 'fast' ? Math.round(position / 2) * 2 : Math.round(position);
    return { front: n > 5 ? front : n ? mod(front, n) : 0, motion };
  }, (value, previous) => {
    if (value.front !== previous?.front || value.motion !== previous?.motion) runOnJS(setFocus)(value);
  }, [n]);
  useEffect(() => {
    if (mode !== 'home') spinning.set(false);
  }, [mode, spinning]);
  const shown = n ? mod(front, n) : 0;

  const settle = useCallback((target: number) => {
    const dist = Math.abs(target - home.p.value);
    fastSpinning.set(false);
    spinning.set(true);
    home.p.set(withTiming(target, { duration: Math.min(820, 340 + dist * 150), easing: Easing.out(Easing.cubic) }, finished => {
      if (finished) spinning.value = false;
    }));
  }, [fastSpinning, home.p, spinning]);

  const openFront = useCallback(() => {
    const deck = decks[mod(Math.round(home.p.value), Math.max(1, n))];
    if (deck) openWithPrivacy(() => go('rehearse', { nav: 'fade', deckId: deck.id, slide: 0, from: 'home' }));
  }, [decks, go, home.p, n, openWithPrivacy]);
  const openAdd = useCallback(() => {
    openWithPrivacy(() => {
      const position = home.p.get();
      const target = Math.round(position);
      if (position !== target) settle(target);
      home.gap.set(1);
      home.uploadReturn.set(0);
      go('upload', { nav: 'fade' });
    });
  }, [go, home.gap, home.p, home.uploadReturn, openWithPrivacy, settle]);

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
    spinning.set(false);
    home.p.set(nf); home.vy.set(withTiming(0, { duration: 220 }));
    if (undoTimer.current) { clearTimeout(undoTimer.current); if (undo) finalize(undo.deck); }
    setUndo({ deck, at: Date.now() });
    undoTimer.current = setTimeout(() => { setUndo(null); finalize(deck); }, 4500);
  }, [decks, finalize, home.p, home.vy, n, spinning, undo]);
  const undoDelete = useCallback(() => {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setHidden(undo.deck.id, false);
    spinning.set(false);
    home.p.set(indexOfDeck(undo.deck.id));
    setUndo(null);
  }, [home.p, spinning, undo]);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // Motion stays on the UI thread; React updates content when the card window moves.
  const dragStart = useSharedValue(0);
  const dragAxis = useSharedValue(0); // 1 = horizontal, 2 = vertical
  const holdArmed = useSharedValue(false);
  const holdDone = useSharedValue(false);
  const labelStage = useSharedValue(0);
  const local = (absoluteX: number, absoluteY: number) => ({ x: (absoluteX - frame.left) / frame.s, y: (absoluteY - frame.top) / frame.s - 150 });
  /** Which item a tap at (x, y) in carousel coordinates hit, front first. */
  const hitSlot = (x: number, y: number) => {
    if (!n) return x > 65 && x < 325 && y > SLOT_TOP && y < SLOT_TOP + SLOT_H ? -1 : null;
    const p = home.p.value;
    const order = adjacentDecks(Math.round(p), n).map(j => ({ j, f: coverFlow(j, p, n, 0) }))
      .filter(o => o.f.live).sort((a, b) => b.f.z - a.f.z);
    for (const { j, f } of order) {
      // The side icon reaches inside the front slot's empty edge; keep that edge tappable.
      const half = (j === mod(Math.round(home.p.value), n) && y > SLOT_TOP + 80 ? 110 : SLOT_W / 2) * f.scale * Math.cos((f.rotateY * Math.PI) / 180);
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
    setPickerClosing(false);
    setPickerFor(deck.id);
    home.picker.set(withTiming(1, { duration: 420 }));
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
      home.press.value = withTiming(1, { duration: 100 });
    },
    onUpdate: e => {
      // Android can activate a Pan with zero translation. Choose the direction
      // from the first movement update instead of defaulting to horizontal.
      if (!dragAxis.value) {
        if (Math.abs(e.translationX) < 2 && Math.abs(e.translationY) < 2) return;
        dragAxis.value = Math.abs(e.translationX) >= Math.abs(e.translationY) ? 1 : 2;
        cancelAnimation(home.p);
        fastSpinning.value = false;
        spinning.value = dragAxis.value === 1 && n > 0;
        if (dragAxis.value === 1) {
          // The initial gesture movement is already included in translationX.
          dragStart.value = home.p.value + e.translationX / frame.s / PX_PER_CARD;
        }
      }
      if (dragAxis.value === 1) {
        if (n > 5 && Math.abs(e.velocityX) > FAST_SPIN_CARDS_PER_SECOND * frame.s * PX_PER_CARD) fastSpinning.value = true;
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
      const adding = dragAxis.value === 2 && !e.canceled && !wasDeleted && pulled <= -PULL_T * 0.98;
      holdArmed.value = false;
      cancelAnimation(home.hold);
      home.hold.value = 0;
      home.press.value = withTiming(1, { duration: 120 });
      home.vy.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.exp) });
      if (labelStage.value) runOnJS(setPullLabel)('');
      labelStage.value = 0;
      if (dragAxis.value === 1 && n) {
        const velocity = e.canceled ? 0 : -e.velocityX / frame.s / PX_PER_CARD;
        if (n > 5 && Math.abs(velocity) > FAST_SPIN_CARDS_PER_SECOND) fastSpinning.value = true;
        const { target, duration } = homeCarouselRelease(home.p.value, velocity);
        home.p.value = withTiming(target, { duration, easing: Easing.out(Easing.cubic) }, finished => {
          if (finished) spinning.value = false;
        });
      } else if (adding) {
        runOnJS(openAdd)();
      }
      dragAxis.value = 0;
      if (floatEnabled && !floatPaused) floatPhase.value = withRepeat(withTiming(floatPhase.value + 2 * Math.PI, { duration: 4200, easing: Easing.linear }), -1, false);
    },
  });
  const longPress = useLongPressGesture({
    enabled: active, minDuration: 550, maxDistance: 8,
    onBegin: () => { home.press.value = withTiming(0.93, { duration: 180 }); },
    onActivate: e => { home.press.value = withTiming(1, { duration: 180 }); runOnJS(onLongPress)(e.absoluteX, e.absoluteY); },
    onFinalize: () => { home.press.value = withTiming(1, { duration: 180 }); },
  });
  const tap = useTapGesture({
    // OpenAI Codex, 2026-11-19: confirm a card tap before opening its presentation.
    enabled: active, maxDistance: 8,
    onBegin: () => { home.press.value = withTiming(0.93, { duration: 100 }); },
    onActivate: e => { runOnJS(onTap)(e.absoluteX, e.absoluteY); },
    onFinalize: () => { home.press.value = withTiming(1, { duration: 220 }); },
  });
  const carouselGesture = useSimultaneousGestures(pan, longPress, tap);

  useBack(mode === 'home' && (creditsOpen || !!pickerFor || tutorialPage !== null), () => {
    if (creditsOpen) setCreditsOpen(false);
    else if (tutorialPage !== null) setTutorialClosing(true);
    else closePicker();
    return true;
  });
  // OpenAI Codex picker fade: docs/ai-collaboration-prompts-iteration-2.md#fade-icon-picker-on-downward-return--november-20-2026
  // Keep the picker mounted until its return fade completes.
  function closePicker() {
    setPickerClosing(true);
    home.picker.set(withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) }, done => {
      if (done) runOnJS(setPickerFor)(null);
    }));
  }

  const frontDeck = n ? decks[shown] : null;
  const frontId = frontDeck?.id ?? null;
  // Prepare scores and cues for the deck the user stops on.
  useEffect(() => {
    if (mode === 'home' && motion === 'idle') onFrontDeckChange?.(frontId);
  }, [mode, motion, onFrontDeckChange, frontId]);
  const openFullReview = () => {
    if (mode !== 'home' || pickerFor || creditsOpen || Math.abs(home.p.value - Math.round(home.p.value)) >= 0.2 || home.vy.value !== 0) return;
    const deck = decks[mod(Math.round(home.p.value), Math.max(1, n))];
    if (deck && getDeckState(deck.id).run) go('full', { nav: 'fade', deckId: deck.id, from: 'home' });
  };
  const setupDim = useAnimatedStyle(() => ({ opacity: (1 - 0.96 * home.setup.value) * (1 - tutorialCover.value) }));
  // Fade the Home backdrop back into focus with the picker instead of snapping its blur off.
  const pickerBackdrop = useAnimatedStyle(() => ({
    filter: home.picker.value > 1 / 36 ? [{ blur: 18 * home.picker.value }] : [],
  }));
  // Keep the cards' depth blur and dim them continuously instead of applying a second blur at rest.
  const homeLayer = useAnimatedStyle(() => ({ opacity: 1 - 0.69 * home.uploadBlur.value }));
  const homeControls = useAnimatedStyle(() => ({ opacity: 1 - home.uploadBlur.value }));
  const homeHeaderMotion = useAnimatedStyle(() => ({
    opacity: mode === 'rehearse' ? Math.max(0, ((home.titleReturn?.value ?? 0) - 0.35) / 0.65) : 1,
  }));
  const homeAppearanceMotion = useAnimatedStyle(() => {
    if (mode === 'rehearse') return { opacity: Math.max(0, ((home.titleReturn?.value ?? 0) - 0.35) / 0.65) };
    const cover = tutorialOpen && !tutorialAppearance ? tutorialCover.value : 0;
    return { opacity: Math.max(0, 1 - Math.max(cover, home.uploadBlur.value) / 0.75) };
  });
  const homeBottomMotion = useAnimatedStyle(() => {
    const cover = tutorialOpen ? tutorialCover.value : mode === 'rehearse' ? 1 - (home.titleReturn?.value ?? 0) : home.uploadBlur.value;
    return { opacity: Math.max(0, 1 - 2 * cover) };
  });
  const underUpload = mode === 'upload';
  // Reuse the outer card after it leaves the screen. Use logical positions for keys
  // so crossing the wrap point never forces the other physical views to remount.
  const slotCount = Math.min(n, 5);
  const windowStart = front - Math.floor(slotCount / 2);
  const visibleSlots = Array.from({ length: slotCount }, (_, key) =>
    mod(windowStart + mod(key - windowStart, slotCount), n));
  const visibleStats = n && motion !== 'fast' ? [...new Set([shown, mod(shown - 1, n), mod(shown + 1, n)])] : [];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={mode === 'home' ? 'box-none' : 'none'}
      accessibilityElementsHidden={mode !== 'home'} importantForAccessibility={mode === 'home' ? 'auto' : 'no-hide-descendants'}>
      <Animated.View pointerEvents={tutorialPage !== null ? 'none' : 'box-none'}
        accessibilityElementsHidden={creditsOpen || tutorialPage !== null}
        importantForAccessibility={creditsOpen || tutorialPage !== null ? 'no-hide-descendants' : 'auto'}
        style={[StyleSheet.absoluteFill, pickerFor ? pickerBackdrop : creditsOpen ? styles.overlayBlur : null, setupDim]}>
      {!underUpload && <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, homeHeaderMotion]}>
        <Pressable accessibilityRole="button" accessibilityLabel={ui("How OutLoud works")} onPress={openTutorial} onLongPress={() => setCreditsOpen(true)}
          style={styles.logo}><Txt style={styles.logoText}>OutLoud</Txt></Pressable>
      </Animated.View>}
      <GestureDetector gesture={carouselGesture}><Animated.View style={[styles.carousel, homeLayer, readingPdf && styles.hiddenCarousel]}
        accessible accessibilityRole="adjustable" accessibilityLabel={ui(motion === 'fast' ? 'Spin'
          : frontDeck ? `${frontDeck.title}, ${frontDeck.pageCount} slides` : 'No presentations yet')}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate', label: ui('Open') }, { name: 'longpress', label: ui('Choose icon') },
          { name: 'add', label: ui('Add presentation') }, { name: 'delete', label: ui('Delete presentation') }]}
        onAccessibilityAction={e => {
          const a = e.nativeEvent.actionName;
          if (a === 'increment') settle(Math.round(home.p.value) + 1);
          else if (a === 'decrement') settle(Math.round(home.p.value) - 1);
          else if (a === 'activate') openFront();
          else if (a === 'longpress' && n) {
            setPickerClosing(false);
            setPickerFor(decks[mod(Math.round(home.p.get()), n)].id);
            home.picker.set(withTiming(1, { duration: 420 }));
          }
          else if (a === 'add') openAdd();
          else if (a === 'delete') deleteFront();
        }}>
        {visibleSlots.map((j, slot) => <Slot key={slot} deck={decks[j]} j={j} n={n} home={home}
          spinning={spinning} floatPhase={floatPhase} floatEnabled={floatEnabled} compact={frame.compact}
          showCaption={!readingPdf} rehearsalUnderlay={mode === 'rehearse'} />)}
      </Animated.View></GestureDetector>
      {!underUpload && <View pointerEvents="none" style={styles.ghostLayer}>
        <Ghost home={home} hue={newHue} order={newOrder} alwaysVisible={!n} />
      </View>}
      {mode !== 'upload' && <Animated.View pointerEvents={mode === 'home' ? 'box-none' : 'none'} style={[StyleSheet.absoluteFill, homeControls]}>
        <PullIndicator home={home} label={pullLabel} />
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, homeBottomMotion]}>
          {visibleStats.map(index => <HomeFeedbackStats key={decks[index].id} deckId={decks[index].id} index={index} count={n}
            home={home} active={mode === 'home' && motion === 'idle' && index === shown} onOpenReview={openFullReview} />)}
        </Animated.View>
        {undo && <UndoToast text={`Deleted “${undo.deck.title}”`} onUndo={undoDelete} />}
      </Animated.View>}
      </Animated.View>
      {showHomeChrome && !creditsOpen && <Animated.View
        testID="home-hints" pointerEvents="none" accessibilityElementsHidden={!active}
        importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        style={[StyleSheet.absoluteFill, homeBottomMotion]}>
        <HomeHints empty={!n} />
      </Animated.View>}
      {pickerFor && <IconPicker deckId={pickerFor} closing={pickerClosing} onClose={closePicker} />}
      {tutorialPage !== null && <TutorialOverlay page={tutorialPage} onPage={setTutorialPage} onClose={closeTutorial}
        cover={tutorialCover} closing={tutorialClosing} />}
      {showHomeChrome && <Animated.View
        testID="home-appearance" pointerEvents={appearanceEnabled ? 'box-none' : 'none'}
        accessibilityElementsHidden={!appearanceEnabled} importantForAccessibility={appearanceEnabled ? 'auto' : 'no-hide-descendants'}
        style={[StyleSheet.absoluteFill, creditsOpen && styles.overlayBlur, tutorialAppearance && styles.tutorialAppearance,
          homeAppearanceMotion]}>
        <LanguageToggle />
        <ThemeToggle />
      </Animated.View>}
      <Animated.View pointerEvents={creditsOpen ? 'auto' : 'none'} accessibilityElementsHidden={!creditsOpen}
        importantForAccessibility={creditsOpen ? 'yes' : 'no-hide-descendants'} accessibilityViewIsModal={creditsOpen}
        style={[styles.creditsOverlay, creditsFade]}>
        <Pressable accessibilityRole="button" accessibilityLabel={ui("Close credits")} onPress={() => setCreditsOpen(false)} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.creditNames}>
          {['박서연', '전인준', '최재원', '현주영'].map(name => <Txt verbatim key={name} style={[styles.creditName, { color: c.strong }]}>{name}</Txt>)}
        </View>
        {creditsOpen && STORE_MODE && <Pressable accessibilityRole="button"
          onPress={() => showStorePrivacy()} style={styles.creditPrivacy}>
          <Txt style={[styles.creditPrivacyText, { color: c.text }]}>Online coaching settings</Txt>
        </Pressable>}
      </Animated.View>
      {storePrivacyDialog}
    </View>
  );
});
function adjacentDecks(center: number, count: number) {
  return count ? [...new Set([-2, -1, 0, 1, 2].map(offset => mod(center + offset, count)))].sort((a, b) => a - b) : [];
}
function indexOfDeck(id: string) { return Math.max(0, visibleDecks().findIndex(d => d.id === id)); }

// ── One carousel item: title, meta, icon, ground shadow ──────────────────────
const Slot = memo(function Slot({ deck, j, n, home, spinning, floatPhase, floatEnabled, compact, showCaption, rehearsalUnderlay }: {
  deck: Presentation; j: number; n: number; home: import('./shared').HomeShared;
  spinning: SharedValue<boolean>; floatPhase: SharedValue<number>; floatEnabled: boolean; compact: boolean; showCaption: boolean; rehearsalUnderlay: boolean;
}) {
  // A memoized slot must subscribe to theme changes to refresh its text styles.
  const { mode, c } = useTheme();
  const flow = useDerivedValue(() => coverFlow(j, home.p.value, n, spreadOf(home)));
  const selected = useDerivedValue(() => mod(Math.round(home.p.value), n) === j);
  const outer = useAnimatedStyle(() => {
    const f = flow.value;
    const front = Math.abs(f.dd) < 0.5 && n > 1;
    const deletePull = Math.max(0, home.vy.value);
    const pull = Math.min(1, deletePull / PULL_T);
    const del = front ? (home.hold.value > 0 ? 0.3 + 0.7 * home.hold.value : pull * 0.3) : 0;
    const sc = f.scale * (1 - del * 0.12);
    const jit = front && home.hold.value > 0.5 ? Math.sin(home.hold.value * 94) * (home.hold.value - 0.5) * 3.2 : 0;
    return {
      zIndex: f.z,
      transform: [{ translateY: deletePull * 0.35 + (ORIGIN_Y - SLOT_FULL_H / 2) * (1 - sc) }, { translateX: f.x }, { scale: sc }, { rotate: jit + 'deg' }],
    };
  });
  const body = useAnimatedStyle(() => {
    const f = flow.value;
    const front = Math.abs(f.dd) < 0.5 && n > 1;
    const pull = home.vy.value > 0 ? Math.min(1, home.vy.value / PULL_T) : 0;
    const del = front ? (home.hold.value > 0 ? 0.3 + 0.7 * home.hold.value : pull * 0.3) : 0;
    return {
      opacity: f.opacity * (mode === 'light' ? 1 : f.brightness) * (1 - del * 0.45),
      // OpenAI Codex integrated supplied card blur: docs/ai-collaboration-prompts-iteration-2.md#widen-and-blur-home-carousel--november-20-2026
      // Side cards (title and icon) blur with their distance from the front; sharp at the front.
      // Skip the native filter while cards move so Android can composite their transforms.
      filter: !spinning.value && f.blur > 0.5 ? [{ blur: f.blur }] : [],
      transform: [{ perspective: 700 }, { rotateY: f.rotateY + 'deg' }],
    };
  });
  const icon = useAnimatedStyle(() => {
    return {
      opacity: rehearsalUnderlay && selected.value ? Math.max(0, ((home.titleReturn?.value ?? 0) - 0.82) / 0.18) : 1,
      transform: [
        { translateY: floatEnabled ? -floatLift(home, floatPhase.value, j) : 0 },
        { scale: selected.value ? home.press.value : 1 },
      ],
    };
  });
  const shadow = useAnimatedStyle(() => {
    const f = flow.value;
    return { opacity: f.shadowOpacity, transform: [{ scaleX: f.shadowScale }] };
  });
  const labelReveal = useDerivedValue(() => {
    // The fresh rehearsal can reset its return value while Home is still onscreen.
    if (!rehearsalUnderlay) return { title: 1, slideCount: 1 };
    const progress = home.titleReturn?.value ?? 1;
    if (selected.value) {
      return { title: homeTitleReveal(progress), slideCount: homeSlideCountReveal(progress) };
    }
    // Adjacent labels can overlap the wider moving title until it has faded.
    const opacity = Math.max(0, Math.min(1, (progress - HOME_TITLE_BLENDED) / (1 - HOME_TITLE_BLENDED)));
    return { title: opacity, slideCount: opacity };
  });
  const titleHandoff = useAnimatedStyle(() => ({ opacity: labelReveal.value.title }));
  const slideCountHandoff = useAnimatedStyle(() => ({ opacity: labelReveal.value.slideCount }));
  const addCaption = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - 2 * Math.max(home.uploadBlur.value, home.analyzing.value, home.setup.value)),
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.slot, outer]}>
      <Animated.View style={[styles.item, body]}>
        {showCaption && <Animated.View testID="home-card-caption" style={[styles.slotCopy, addCaption]}>
          <Animated.View style={titleHandoff}>
            <Txt verbatim numberOfLines={2} style={[styles.title, mode === 'light' && { color: c.text }]}>{deck.title}</Txt>
          </Animated.View>
          <Animated.View style={slideCountHandoff}>
            <Txt style={styles.meta}>{(deck.pageCount || '—') + ' slides · ' + pad2(j + 1)}</Txt>
          </Animated.View>
        </Animated.View>}
        <Animated.View renderToHardwareTextureAndroid style={[styles.icon, icon]}>
          <PresentationIcon icon={deck.icon} hue={deck.hue} size={deckIconSize(compact)} />
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
    Math.min(1, Math.max(0, home.vy.value) / 12),
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

/** The Upload draws its own fixed wordmark and icon while Home dims underneath. */
export function UploadArtwork({ home, hue, followCarousel }: { home: import('./shared').HomeShared; hue: HueName; followCarousel: boolean }) {
  return <View testID="upload-artwork" pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={styles.logo}><Txt style={styles.logoText}>OutLoud</Txt></View>
    <View style={styles.ghostLayer}>
      <Ghost home={home} hue={hue} alwaysVisible={!followCarousel} />
    </View>
  </View>;
}

/** The "New presentation" item that grows into the gap while pulling up, and on Upload. */
function Ghost({ home, hue, order, alwaysVisible }: { home: import('./shared').HomeShared; hue: HueName; order?: number; alwaysVisible: boolean }) {
  const { mode, c } = useTheme();
  const compact = useFrame().compact;
  const style = useAnimatedStyle(() => {
    const spread = alwaysVisible ? 1 : spreadOf(home);
    const gsc = (0.6 + 0.4 * Math.min(1, spread)) * (home.analyzing.value ? 1 - (1 - ANALYZE_ICON_SCALE) * home.analyzing.value : 1);
    // Add keeps this icon on screen while Home's drag offset settles.
    return { opacity: spread * spread,
      transform: [{ translateY: (ORIGIN_Y - SLOT_FULL_H / 2) * (1 - gsc) }, { scale: gsc }] };
  });
  // OpenAI Codex import-ring fix: docs/ai-collaboration-prompts-iteration-2.md#centre-pdf-import-ring
  const groundFade = useAnimatedStyle(() => ({ opacity: 1 - home.analyzing.value }));
  const previewCopy = useAnimatedStyle(() => ({ opacity: Math.min(1, (1 - spreadOf(home)) / 0.24) }));
  return (
    <Animated.View pointerEvents="none" style={[styles.slot, { zIndex: 300 }, style]}>
      <View style={styles.item}>
        {order !== undefined && <Animated.View style={[styles.slotCopy, previewCopy]}>
          <Txt numberOfLines={2} style={[styles.title, mode === 'light' && { color: c.text }]}>New presentation</Txt>
          <Txt style={styles.meta}>{'New · ' + pad2(order)}</Txt>
        </Animated.View>}
        <View style={styles.icon}><PresentationIcon icon="present" hue={hue} size={deckIconSize(compact)} /></View>
      </View>
      <Animated.View style={[styles.ground, groundFade]}><GroundShadow icon="present" /></Animated.View>
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

function HomeHints({ empty }: { empty: boolean }) {
  return (
    <HintRow gap={16} hints={empty ? [{ icon: 'h-tap', text: 'Tap to add' }, { icon: 'h-up', text: 'Add' }]
      : [{ icon: 'h-spin', text: 'Spin' }, { icon: 'h-tap', text: 'Open' }, { icon: 'h-hold', text: 'Icon' }, { icon: 'h-up', text: 'Add' }, { icon: 'h-dn', text: 'Delete' }]} />
  );
}

// ── Icon picker (SPEC §4.2) ──────────────────────────────────────────────────
function IconPicker({ deckId, closing, onClose }: { deckId: string; closing: boolean; onClose: () => void }) {
  const ui = useUiText();
  const { c } = useTheme();
  const { home } = useHomeShell();
  const deck = useStore(s => s.decks.find(d => d.id === deckId) ?? null);
  const frame = useFrame();
  const dy = useSharedValue(0);
  const fadeY = useSharedValue(0);
  const drag: PanHandlers = {
    onMoveShould: (_e, gs) => gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onMove: (_e, gs) => { const y = Math.max(0, gs.dy / frame.s); dy.set(y); fadeY.set(Math.min(BACK_FADE_Y, y)); },
    onRelease: () => {
      if (dy.get() > 110) {
        // OpenAI Codex picker fade: docs/ai-collaboration-prompts-iteration-2.md#fade-icon-picker-on-downward-return--november-20-2026
        // Fade the picker contents during the downward return; the footer hint stays fixed.
        fadeY.set(withTiming(BACK_FADE_Y, { duration: 460, easing: Easing.out(Easing.cubic) }));
        dy.set(withTiming(Math.max(300, dy.get()), { duration: 460, easing: Easing.out(Easing.cubic) }));
        onClose();
      } else {
        dy.set(withTiming(0, { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
        fadeY.set(withTiming(0, { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
      }
    },
    onTerminate: () => { dy.set(withTiming(0, { duration: 420 })); fadeY.set(withTiming(0, { duration: 420 })); },
  };
  const overlay = useAnimatedStyle(() => ({ opacity: Math.min(home.picker.value, Math.max(0, 1 - fadeY.value / BACK_FADE_Y)) }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: dy.value }] }));
  // OpenAI Codex, 2026-11-20: start the picker fade at the top on drag and on tap/Back close.
  const exit = useDerivedValue(() => Math.max(fadeY.value / BACK_FADE_Y, closing ? 1 - home.picker.value : 0));
  const topFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - exit.value / 0.36) }));
  const middleFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.max(0, exit.value - 0.08) / 0.58) }));
  const lowerFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.max(0, exit.value - 0.25) / 0.75) }));
  if (!deck) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, overlay]}>
      <Pressable accessibilityLabel={ui("Close icon picker")} onPress={onClose} style={StyleSheet.absoluteFill} />
      <PanView accessibilityViewIsModal style={[styles.sheet, sheet]} {...drag}>
        <Animated.View style={[{ paddingHorizontal: 40, alignItems: 'center' }, topFade]} pointerEvents="none">
          <Txt style={styles.pickTitle}>Choose an icon</Txt>
          <Txt verbatim numberOfLines={1} style={styles.pickSub}>{deck.title}</Txt>
        </Animated.View>
        <Animated.View style={[styles.preview, topFade]} pointerEvents="none"><PresentationIcon icon={deck.icon} hue={deck.hue} size={104} /></Animated.View>
        <Animated.View style={[styles.swatches, middleFade]}>
          {(Object.keys(DECK_COLORS) as (keyof typeof DECK_COLORS)[]).map(name => {
            const selected = name === deck.hue;
            const swatch = DECK_COLORS[name].swatch;
            const hue = name as HueName;
            return <Pressable key={name} accessibilityRole="button" accessibilityLabel={ui(`${name} colour`)} accessibilityState={{ selected }}
              onPress={() => setHue(deck.id, hue)} style={styles.swatchHit}>
              <View style={styles.swatchOuter}>
                {selected && <View pointerEvents="none" style={[styles.swatchRing, { borderColor: HUES[deck.hue].accent }]} />}
                <View style={[styles.swatch, { backgroundColor: swatch }]} />
              </View>
            </Pressable>;
          })}
        </Animated.View>
        <Animated.View style={[styles.grid, lowerFade]}>
          {ICONS.map(([id, name]) => {
            const sel = id === deck.icon;
            return (
              <Pressable key={id} accessibilityRole="button" accessibilityLabel={ui(name + (sel ? ', current icon' : ''))} accessibilityState={{ selected: sel }}
                onPress={() => setIcon(deck.id, id as IconId)}
                style={[styles.tile, { backgroundColor: sel ? HUES[deck.hue].glow : c.surface06, borderColor: sel ? DECK_COLORS[deck.hue as keyof typeof DECK_COLORS]?.swatch ?? c.accent : c.line }, sel && { borderWidth: 2 }]}>
                <PresentationIcon icon={id} hue={deck.hue} size={34} />
              </Pressable>
            );
          })}
        </Animated.View>
      </PanView>
      </Animated.View>
      {/* OpenAI Codex, 2026-11-20: keep the bottom gesture cue fixed during picker fade and drag. */}
      <HintRow gap={6} hints={[{ icon: 'h-dn', text: 'Swipe down to close', nudge: 'down' }]} />
    </View>
  );
}

const styles = createThemedStyles({
  overlayBlur: { filter: [{ blur: 18 }] },
  logo: { position: 'absolute', left: 0, right: 0, top: 57, height: 36, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: F.display, fontSize: 26, lineHeight: 27, letterSpacing: -0.5, color: C.text },
  // OpenAI Codex header alignment: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-106
  tutorialAppearance: { zIndex: 56 },
  creditsOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, alignItems: 'center', justifyContent: 'center' },
  creditNames: { alignItems: 'center', gap: 16 },
  creditPrivacy: { minHeight: 44, marginTop: 24, justifyContent: 'center', paddingHorizontal: 16 },
  creditPrivacyText: { fontFamily: F.semibold, fontSize: 16, textAlign: 'center' },
  creditName: { fontSize: 27, lineHeight: 40, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  carousel: { position: 'absolute', left: 0, top: CAROUSEL_TOP, width: 390, height: 400, zIndex: 1 },
  hiddenCarousel: { display: 'none' },
  ghostLayer: { position: 'absolute', left: 0, top: CAROUSEL_TOP, width: 390, height: 400, zIndex: 2 },
  slot: { position: 'absolute', left: 65, top: SLOT_TOP, width: SLOT_W, height: SLOT_FULL_H },
  item: { width: SLOT_W, height: SLOT_H, alignItems: 'center' },
  slotCopy: { alignItems: 'center' },
  title: { width: 244, textAlign: 'center', fontFamily: F.display, fontSize: 22, lineHeight: 23.8, letterSpacing: -0.4, color: C.text },
  meta: { marginTop: 4, fontFamily: F.semibold, fontSize: 13.5, letterSpacing: 0.2, color: 'rgba(255, 255, 255, 0.62)' },
  icon: { marginTop: 'auto' },
  ground: { marginTop: 16, width: GROUND_W, height: 24, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  pullAdd: { position: 'absolute', left: 0, right: 0, top: 508, zIndex: 4, alignItems: 'center' },
  pullDel: { position: 'absolute', left: 0, right: 0, top: 96, zIndex: 4, alignItems: 'center', gap: 6 },
  binWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  pullText: { fontFamily: F.semibold, fontSize: 13.5, color: C.text },
  stats: { position: 'absolute', left: 28, right: 28, top: 547, height: 136, zIndex: 3, flexDirection: 'row', alignItems: 'center', gap: 18 },
  fullReviewRingTarget: { position: 'absolute', left: 88, top: 548, width: 214, height: 76, borderRadius: 40, zIndex: 4 },
  ringBox: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  pct: { fontFamily: F.display, fontSize: 30, lineHeight: 31, letterSpacing: -0.8, color: C.text, fontVariant: ['tabular-nums'] },
  unit: { marginTop: 4, fontFamily: F.semibold, fontSize: 13.5, lineHeight: 16, letterSpacing: 0.3 },
  statHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statLabel: { flexShrink: 1, fontFamily: F.semibold, fontSize: 14, color: C.secondary },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaText: { fontFamily: F.bold, fontSize: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statVal: { fontFamily: F.display, fontSize: 18, lineHeight: 20, color: C.text, fontVariant: ['tabular-nums'] },
  statUnit: { flexShrink: 1, fontFamily: F.medium, fontSize: 14, color: C.secondary },
  sheet: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingTop: 46, backgroundColor: C.bg },
  pickTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 22, color: C.text },
  pickSub: { marginTop: 3, fontFamily: F.medium, fontSize: 14.5, color: C.secondary },
  preview: { position: 'absolute', top: 106, left: 143, width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  swatches: { position: 'absolute', top: 232, left: 40, right: 40, height: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  swatchHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  swatchOuter:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  swatchRing:{position:'absolute',left:0,right:0,top:0,bottom:0,borderWidth:2,borderRadius:20},
  swatch: { width: 34, height: 34, borderRadius: 17 },
  grid: { position: 'absolute', top: 292, left: 24, right: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: 80, height: 64, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
