// OpenAI Codex review routing: docs/ai-collaboration-prompts-iteration-2.md#first-recording-review-navigation-october-16-2026
// OpenAI Codex reliability fixes: docs/ai-collaboration-prompts-iteration-2.md#cue-and-feedback-reliability-october-16-2026
// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration-prompts-iteration-2.md#finger-linked-page-fade-october-15-2026
// OpenAI Codex time/audience setup: docs/ai-collaboration-prompts-iteration-2.md#presentation-time-and-audience-setup-october-15-2026
// OpenAI Codex light-mode rehearsal: docs/ai-collaboration-prompts-iteration-2.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OpenAI Codex Review entry navigation: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#transcript-header-playback-october-14-2026
// OutLoud redesign: Rehearse (SPEC §4.4) with transcript corrections (§5.4).
// OpenAI Codex landscape follow-up: docs/ai-collaboration-prompts-iteration-2.md#landscape-rehearsal-implementation-october-15-2026
// OpenAI Codex portrait-only correction: docs/ai-collaboration-prompts-iteration-2.md#portrait-only-pdf-rotation-correction-october-15-2026
// OpenAI Codex rotate-icon update: docs/ai-collaboration-prompts-iteration-2.md#rotate-button-icon-update-october-15-2026
// OpenAI Codex rotated timer follow-up: docs/ai-collaboration-prompts-iteration-2.md#rotate-button-icon-update-october-15-2026
// OpenAI Codex stable bottom hints: docs/ai-collaboration-prompts-iteration-2.md#rotate-button-icon-update-october-15-2026
// OpenAI Codex sideways timer digits: docs/ai-collaboration-prompts-iteration-2.md#rotated-timer-text-orientation-october-15-2026
// OpenAI Codex rotated Home hint: docs/ai-collaboration-prompts-iteration-2.md#rotated-home-hint-visibility-october-15-2026
// OpenAI Codex rotated slide corners: docs/ai-collaboration-prompts-iteration-2.md#rotated-slide-corner-navigation-october-15-2026
// OpenAI Codex smooth PDF rotation: docs/ai-collaboration-prompts-iteration-2.md#smooth-pdf-view-rotation-october-15-2026
// OpenAI Codex static Home hint: docs/ai-collaboration-prompts-iteration-2.md#static-rehearse-home-arrow-october-15-2026
// OpenAI Codex sideways redo glyph: docs/ai-collaboration-prompts-iteration-2.md#sideways-redo-glyph-october-15-2026
// OpenAI Codex orbiting sideways captions: docs/ai-collaboration-prompts-iteration-2.md#sideways-control-captions-october-15-2026
// OpenAI Codex sideways waveform and counter: docs/ai-collaboration-prompts-iteration-2.md#sideways-waveform-and-slide-counter-october-15-2026
// OpenAI Codex Review bars: docs/ai-collaboration-prompts-iteration-2.md#rehearse-review-bars-icon-october-15-2026
// OpenAI Codex centered redo hint: docs/ai-collaboration-prompts-iteration-2.md#centered-rehearse-redo-hint-october-15-2026
// OpenAI Codex smooth Review/Time handoff: docs/ai-collaboration-prompts-iteration-2.md#smooth-review-time-rotation-october-15-2026
// OpenAI Codex idle timer contrast: docs/ai-collaboration-prompts-iteration-2.md#idle-rehearse-timer-contrast-october-15-2026
// OpenAI Codex faster Home return: docs/ai-collaboration-prompts-iteration-2.md#home-carousel-and-return-transition-performance-october-15-2026
// OpenAI Codex faster presentation exit: docs/ai-collaboration-prompts-iteration-2.md#presentation-to-home-pause-october-15-2026
// OpenAI Codex immediate recording completion: docs/ai-collaboration-prompts-iteration-2.md#continuous-carousel-color-and-navigation-responsiveness-october-15-2026
// OpenAI Codex forward-only live recording: docs/ai-collaboration-prompts-iteration-2.md#forward-only-recording-slide-navigation-october-15-2026
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { PanView, type PanHandlers } from '../design/PanView';
import { CARD_H, CARD_W, SlideCard } from '../design/SlideCard';
import { C, EASE_SCREEN, EASE_SNAP, F } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { Chip, Confetti, Dialog, HintRow, IDLE_WAVE, OrbitalCaption, PageSurface, RecordButton, RecordRing, RoundButton, Waveform, type Hint, type RecordGlyph } from '../design/ui';
import { paceChip } from '../domain/analysis';
import { fmt } from '../domain/format';
import { BACK_FADE_Y, BACK_T, CARD_STEP, decideRelease } from '../domain/gestures';
import { reviewDestination, runAttemptIds, takeVisits } from '../domain/run';
import { CaptureEngine, type CaptureHandle } from '../features/rehearsal/CaptureEngine';
import { audioOf } from '../features/rehearsal/analysis';
import { commitTake } from '../features/rehearsal/takes';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { ensurePages, ensureSlideText } from '../features/presentations/importer';
import { bump, getDeckState, useStore, visibleDecks } from '../features/presentations/store';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { savedAttempts, type SavedAttempt } from '../features/recording/storage';
import { CueGuidancePanel } from '../features/presentations/CueGuidancePanel';
import { useSlideProfiles } from '../features/presentations/useSlideProfiles';
import type { ProfileState } from '../features/presentations/slideProfiles';
import { API_URL } from '../services/api';
import { defaultRequirementsPending } from '../features/presentations/defaultRequirements';
import { requirementsPending, readRequirementsDraft } from '../features/presentations/requirementsDraft';
import { getRequirementsVersion, subscribeRequirements } from '../features/presentations/requirementsStore';
import { PresentationRequirementsEditor } from './PresentationSetup';
import { TakePlayback } from './TakePlayback';
import { useBack, useShell } from './shared';

type Phase = 'idle' | 'count' | 'starting' | 'recording' | 'stopping' | 'burst';
const locksPreviousSlide = (phase: Phase) => phase === 'starting' || phase === 'stopping';
const freezesSlideNavigation = (phase: Phase) => phase === 'starting' || phase === 'stopping';
const SPEECH_DB = -38;
// OpenAI Codex follow-up (2026-10-15): whole-presentation redo hold; see the Iteration 2 prompt log.
const REDO_HOLD_MS = 3000;
const PDF_ROTATE_MS = 360;
const CONTROL_SWAP_MS = 520;

/** Live take metrics. Updated by the meter (~14×/s); only the readout subscribes to every change. */
type Live = { E: number; slideStart: number; recStart: number; spoken: boolean[]; speech: number[]; wave: number[]; lastMeter: number };
type LiveStore = { get(): Live; set(next: Live): void; subscribe(f: () => void): () => void };
function createLive(): LiveStore {
  let state: Live = { E: 0, slideStart: 0, recStart: 0, spoken: [], speech: [], wave: IDLE_WAVE, lastMeter: 0 };
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(next) { state = next; subs.forEach(f => f()); },
    subscribe(f) { subs.add(f); return () => { subs.delete(f); }; },
  };
}

export const RehearseScreen = memo(function RehearseScreen({ active = true }: { active?: boolean }) {
  const { go, nav } = useShell();
  const model = useDeckModel(nav.deckId);
  useEffect(() => {
    if (!nav.deckId) return;
    // A pending redo requires an explicit keep-or-overwrite decision.
    const pending = getDeckState(nav.deckId).compare;
    if (pending) {
      go('compare', { nav: 'fade', deckId: nav.deckId, sel: pending.next.sel });
      return;
    }
    void ensurePages(nav.deckId).catch(() => undefined);
    void ensureSlideText(nav.deckId);
  }, [go, nav.deckId]);
  if (!model || !model.n) return <Enter kind={nav.nav}><Txt style={styles.loading}>{model ? 'Preparing slides…' : ''}</Txt></Enter>;
  return <Rehearse model={model} active={active} />;
});

function Rehearse({ model, active }: { model: DeckModel; active: boolean }) {
  useTheme();
  const { go, nav, home } = useShell();
  const frame = useFrame();
  useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const [setupOpen, setSetupOpen] = useState(false);
  const [pdfRotated, setPdfRotated] = useState(false);
  const pdfRotatedRef = useRef(false);
  const [pdfRotating, setPdfRotating] = useState(false);
  const pdfRotation = useSharedValue(0);
  const controlSwap = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const cardStep = CARD_STEP;
  const { deck, n, state } = model;
  const run = state.run;
  const [slide, setSlideState] = useState(() => Math.max(0, Math.min(n - 1, nav.slide)));
  const slideRef = useRef(slide);
  const [phase, setPhaseState] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const isPreviousLocked = useCallback(() => locksPreviousSlide(phaseRef.current), []);
  const isNavigationFrozen = useCallback(() => freezesSlideNavigation(phaseRef.current), []);
  const [count, setCount] = useState(3);
  const [redoAsk, setRedoAsk] = useState<false | 'slide' | 'all'>(false);
  const [error, setError] = useState('');
  const [recoveryId, setRecoveryId] = useState<string | null>(null);
  const [recoveryCursor, setRecoveryCursor] = useState(0);
  const [engineKey, setEngineKey] = useState(0);
  const [burst, setBurst] = useState<{ total: number; compare: boolean } | null>(null);
  const engine = useRef<CaptureHandle>(null);
  const fullRedo = useRef(false);
  const longFired = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);
  const [live] = useState(createLive);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const profiles = useSlideProfiles(deck.id, n, active);
  const [cueRetryAsk, setCueRetryAsk] = useState<ProfileState | null>(null);
  const ringP = useSharedValue(0), ringV = useSharedValue(0);
  const trackX = useSharedValue(-slide * CARD_STEP);
  useEffect(() => {
    cancelAnimation(trackX);
    trackX.set(-slideRef.current * cardStep);
  }, [cardStep, trackX]);
  const backDy = useSharedValue(0);
  const backExiting = useRef(false);
  const player = useSegmentPlayer();
  const stopPlayback = player.stop;
  const openReview = useCallback((takes: number, selected: number, comparing: boolean, transition: 'fade' | 'rise') => {
    stopPlayback();
    const destination = comparing ? 'compare' : reviewDestination(takes);
    go(destination, { nav: transition, deckId: deck.id, sel: selected, slide: selected,
      from: destination === 'full' ? 'rehearse' : null });
  }, [deck.id, go, stopPlayback]);
  const openSetup = useCallback(() => { if (active && phaseRef.current === 'idle') { stopPlayback(); setSetupOpen(true); } }, [active, stopPlayback]);
  useEffect(() => {
    if (active && nav.editRequirements && phaseRef.current === 'idle') {
      openSetup(); go('rehearse', { editRequirements: false });
    }
  }, [active, nav.editRequirements, go, openSetup]);
  useEffect(() => { if (!active) stopPlayback(); }, [active, stopPlayback]);
  // The page stays mounted beneath Review/Compare. Clear its brief completion
  // state after it is covered so returning to it can start another recording.
  useEffect(() => {
    // Also reset on immediate reactivation if the covered-page frame was
    // cancelled by a very fast swipe back.
    if (phaseRef.current !== 'burst') return;
    const frameId = requestAnimationFrame(() => {
      phaseRef.current = 'idle';
      setPhaseState('idle');
      setBurst(null);
    });
    return () => cancelAnimationFrame(frameId);
  }, [active]);
  const storeVersion = useStore(s => s.version);
  // Only an interrupted capture is surfaced here; selected and rejected takes
  // do not become a second history row above the clock.
  const recoveryAttempts = useMemo(() => {
    void storeVersion;
    const selected = new Set(runAttemptIds(run));
    if (state.compare) selected.add(state.compare.attemptId);
    return savedAttempts(deck.id).filter(a => (a.state === 'interrupted' || a.state === 'capturing') &&
      !selected.has(a.id) && !state.discarded.includes(a.id));
  }, [deck.id, run, state.compare, state.discarded, storeVersion]);
  const recoveryAttempt = recoveryAttempts[recoveryCursor % recoveryAttempts.length] ?? null;
  const closeRecovery = () => { setRecoveryId(null); setRecoveryCursor(i => i + 1); };

  const hasTake = useCallback((i: number) => !!run?.parts[i], [run]);
  const anyTake = !!run;
  const recording = phase === 'recording' || phase === 'stopping';

  // ── Slides ────────────────────────────────────────────────────────────────
  /** jump: land instantly (tick strip); animate: settle like a swipe (corners); keep: the track is already moving. */
  const goSlide = useCallback((i: number, mode: 'jump' | 'animate' | 'keep') => {
    const to = Math.max(0, Math.min(n - 1, i));
    if (isNavigationFrozen() || (to < slideRef.current && isPreviousLocked())) {
      cancelAnimation(trackX);
      trackX.set(-slideRef.current * cardStep);
      return;
    }
    if (mode === 'animate') {
      const ms = Math.round(Math.max(170, Math.min(300, 150 + Math.abs(-to * cardStep - trackX.get()) * 0.36)));
      trackX.set(withTiming(-to * cardStep, { duration: ms, easing: EASE_SNAP }));
    } else if (mode === 'jump') { cancelAnimation(trackX); trackX.set(-to * cardStep); }
    if (to === slideRef.current) return;
    player.stop();
    if (phaseRef.current === 'recording') {
      engine.current?.slideChanged(to);
      live.set({ ...live.get(), slideStart: live.get().E });
    }
    slideRef.current = to;
    setSlideState(to);
    setPlaybackNotice(null);
  }, [cardStep, isNavigationFrozen, isPreviousLocked, live, n, player, trackX]);
  const routeSlideRef = useRef({ active: false, slide: nav.slide });
  useEffect(() => {
    const previous = routeSlideRef.current;
    routeSlideRef.current = { active, slide: nav.slide };
    if (previous.slide !== nav.slide || (active && !previous.active)) goSlide(nav.slide, 'jump');
    else if (!active) backDy.set(0);
  }, [active, backDy, goSlide, nav.slide]);

  // ── Recording ─────────────────────────────────────────────────────────────
  const stopCount = () => { if (countTimer.current) { clearInterval(countTimer.current); countTimer.current = null; } };
  const hideRing = () => { cancelAnimation(ringP); ringV.set(withTiming(0, { duration: 200 })); };
  const startRec = useCallback(async () => {
    setPhase('starting');
    setError('');
    try {
      await engine.current?.start(() => slideRef.current);
      const cur = slideRef.current;
      // A whole redo replaces every slide; otherwise the start slide always counts as spoken.
      const spoken: boolean[] = Array(n).fill(fullRedo.current);
      spoken[cur] = true;
      live.set({ E: 0, slideStart: 0, recStart: cur, spoken, speech: Array(n).fill(0), wave: Array(28).fill(6), lastMeter: Date.now() });
      ringP.set(0); ringV.set(1);
      setPhase('recording');
    } catch (e) {
      fullRedo.current = false;
      hideRing();
      setError(e instanceof Error ? e.message : 'Could not start recording.');
      bump();
      setEngineKey(k => k + 1);
      setPhase('idle');
    }
  }, [live, n, ringP, ringV]); // eslint-disable-line react-hooks/exhaustive-deps
  const beginCount = useCallback(() => {
    player.stop();
    setRedoAsk(false);
    setError('');
    setPhase('count'); setCount(3);
    ringV.set(1); ringP.set(1);
    ringP.set(withTiming(0, { duration: 3000, easing: Easing.linear }));
    const t0 = Date.now();
    stopCount();
    countTimer.current = setInterval(() => {
      const el = Date.now() - t0;
      if (el >= 3000) { stopCount(); void startRec(); return; }
      setCount(c => { const next = 3 - Math.floor(el / 1000); if (next !== c) void Haptics.selectionAsync().catch(() => undefined); return next; });
    }, 50);
  }, [player, ringP, ringV, startRec]);
  useEffect(() => () => stopCount(), []);

  const stopRec = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;
    setPhase('stopping');
    try {
      const take = await engine.current!.stop();
      const whole = fullRedo.current;
      fullRedo.current = false;
      const { run: next, compare } = commitTake(deck, take, live.get().spoken, whole, model.stats?.coverage ?? null);
      hideRing();
      setBurst({ total: take.durationMs / 1000, compare: !!compare });
      setPhase('burst');
      openReview(next.takeNo, next.sel, !!compare, compare ? 'rise' : 'fade');
    } catch (e) {
      fullRedo.current = false;
      hideRing();
      setError(e instanceof Error ? e.message : 'The recording could not be saved.');
      bump();
      setEngineKey(k => k + 1);
      setPhase('idle');
    }
  }, [deck, live, model.stats?.coverage, openReview]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMeter = useCallback((db: number, ms: number) => {
    const L = live.get(), now = Date.now();
    const dt = Math.min(200, now - L.lastMeter);
    const cur = slideRef.current, E = ms / 1000;
    const speech = L.speech.slice(), spoken = L.spoken.slice();
    // A slide counts as spoken on after 0.7 s of speech-level audio on it.
    if (db > SPEECH_DB) { speech[cur] = (speech[cur] || 0) + dt; if (speech[cur] >= 700) spoken[cur] = true; }
    const level = Math.max(0, Math.min(1, (db + 60) / 50));
    live.set({ ...L, E, lastMeter: now, speech, spoken, wave: [...L.wave.slice(1), 6 + level * 24] });
    let rem = 0;
    for (let i = L.recStart; i < n; i++) rem += deck.targets[i] ?? 0;
    ringP.set(withTiming(Math.min(1, E / Math.max(1, rem)), { duration: 80 }));
  }, [deck.targets, live, n, ringP]);

  const toggleRec = useCallback(() => {
    if (longFired.current) { longFired.current = false; return; }
    const p = phaseRef.current;
    if (p === 'recording') { void stopRec(); return; }
    if (p === 'burst' || p === 'starting' || p === 'stopping') return;
    if (p === 'count') { stopCount(); hideRing(); fullRedo.current = false; setPhase('idle'); return; }
    if (hasTake(slideRef.current)) { player.stop(); setRedoAsk('slide'); return; }
    beginCount();
  }, [beginCount, hasTake, player, stopRec]); // eslint-disable-line react-hooks/exhaustive-deps
  const recDown = useCallback(() => {
    longFired.current = false;
    if (phaseRef.current !== 'idle' || redoAsk || !anyTake) return;
    ringV.set(1); ringP.set(0);
    ringP.set(withTiming(1, { duration: REDO_HOLD_MS, easing: Easing.linear }));
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      longFired.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      player.stop();
      hideRing();
      setRedoAsk('all');
    }, REDO_HOLD_MS);
  }, [anyTake, player, redoAsk, ringP, ringV]); // eslint-disable-line react-hooks/exhaustive-deps
  const recUp = useCallback(() => {
    if (!holdTimer.current) return;
    clearTimeout(holdTimer.current); holdTimer.current = null;
    if (phaseRef.current === 'idle') hideRing();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const confirmRedo = () => {
    if (redoAsk === 'all') { fullRedo.current = true; goSlide(0, 'jump'); }
    setRedoAsk(false);
    beginCount();
  };
  const cancelRedo = () => { fullRedo.current = false; setRedoAsk(false); };

  // The permanent Cues header keeps selected-slide audio playback.
  const playSlide = () => {
    if (phaseRef.current !== 'idle') return;
    const part = run?.parts[slideRef.current];
    if (!part) return;
    const uri = audioOf(part.attemptId);
    if (!uri) { setPlaybackNotice('Audio for this slide isn’t on this phone'); return; }
    setPlaybackNotice(null);
    void player.playSegments(`slide:${deck.id}:${slideRef.current}`, part.segments.map(segment => ({ uri, ...segment })));
  };

  // ── Back (swipe down / system Back) ───────────────────────────────────────
  const canGoBack = !pdfRotated && phase === 'idle' && !redoAsk && !recoveryId;
  const rotate = useCallback(() => {
    cancelAnimation(trackX);
    trackX.set(-slideRef.current * CARD_STEP);
    const next = !pdfRotatedRef.current;
    pdfRotatedRef.current = next;
    setPdfRotated(next);
    if (reducedMotion) {
      pdfRotation.set(next ? 1 : 0);
      controlSwap.set(next ? 1 : 0);
      setPdfRotating(false);
      return;
    }
    setPdfRotating(true);
    controlSwap.set(withTiming(next ? 1 : 0, { duration: CONTROL_SWAP_MS, easing: Easing.inOut(Easing.cubic) }));
    pdfRotation.set(withTiming(next ? 1 : 0, { duration: PDF_ROTATE_MS, easing: Easing.bezier(0.22, 1, 0.36, 1) }, finished => {
      if (finished) runOnJS(setPdfRotating)(false);
    }));
  }, [controlSwap, pdfRotation, reducedMotion, trackX]);
  const leave = useCallback(() => {
    player.stop();
    const decks = visibleDecks();
    const index = decks.findIndex(d => d.id === deck.id);
    const count = decks.length;
    if (index >= 0 && count) home.p.set(Math.round((home.p.get() - index) / count) * count + index);
    go('home', { nav: null });
  }, [deck.id, go, home.p, player]);
  const inExcluded = (e: GestureResponderEvent) => {
    const y = (e.nativeEvent.pageY - frame.top) / frame.s;
    return (y > 326 && y < 512) || y > 652;
  };
  const back: PanHandlers = {
    onMoveShould: (e, g) => !backExiting.current && canGoBack && g.dy > 8 && g.dy > Math.abs(g.dx) && !inExcluded(e),
    onMove: (_e, g) => { backDy.set(Math.min(BACK_FADE_Y, Math.max(0, g.dy / frame.s))); },
    onRelease: () => {
      if (backDy.get() > BACK_T) {
        backExiting.current = true;
        backDy.set(withTiming(BACK_FADE_Y, { duration: 220, easing: EASE_SCREEN }, finished => {
          if (finished) runOnJS(leave)();
        }));
      } else backDy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
    },
    onTerminate: () => { if (!backExiting.current) backDy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN })); },
  };
  useBack(active, () => {
    if (setupOpen) { setSetupOpen(false); return true; }
    if (pdfRotated) { rotate(); return true; }
    if (recoveryId) { closeRecovery(); return true; }
    if (redoAsk) { cancelRedo(); return true; }
    if (phaseRef.current !== 'idle') return true;
    leave(); return true;
  });
  const screen = useAnimatedStyle(() => ({
    // Keep the page still while its already-mounted Home underlay comes into view.
    opacity: Math.max(0, 1 - backDy.value / BACK_FADE_Y),
  }));
  const counterMotion = useAnimatedStyle(() => {
    const angle = pdfRotation.value * Math.PI / 2;
    return { transform: [
      { translateX: 170 * Math.sin(angle) },
      { translateY: 270 * (1 - Math.cos(angle)) },
      { rotate: `${90 * pdfRotation.value}deg` },
    ] };
  });
  const reviewMotion = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - controlSwap.value / 0.62) }));
  const timeMotion = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (controlSwap.value - 0.38) / 0.62)) }));

  // ── View model ────────────────────────────────────────────────────────────
  const cur = slide;
  const take = !recording && hasTake(cur);
  const glyph: RecordGlyph = phase === 'count' ? (count as 3 | 2 | 1) : recording ? 'stop' : take ? 'redo' : 'mic';
  const btnLabel = phase === 'count' ? `Starting in ${count}. Tap to cancel` : recording ? 'Stop recording'
    : (take ? 'Redo slide ' + (cur + 1) : 'Record slide ' + (cur + 1)) + (anyTake ? '. Hold 3 seconds to redo the whole presentation' : '');
  const idleHint: Hint = take ? { icon: 'h-hold', text: 'Hold to redo all' } : { icon: 'h-tap', text: 'Tap to record' };
  const homeHint: Hint = { icon: 'h-dn', text: 'Home', hidden: pdfRotated };
  const showIdleHints = phase !== 'count' && !recording && phase !== 'burst';
  const hints: Hint[] = phase === 'count' ? [{ icon: 'h-tap', text: 'Tap to cancel' }]
    : recording ? [{ icon: 'h-tap', text: 'Tap to stop' }, { icon: 'h-spin', text: 'Swipe slides' }]
      : phase === 'burst' ? [{ icon: 'h-tap', text: burst?.compare ? 'Comparing takes' : 'Opening review' }]
        : [idleHint, homeHint];
  const partId = run?.parts[cur]?.attemptId;
  const recovered = (attempt: SavedAttempt) => {
    const visits = takeVisits(attempt.recording.slide_events, attempt.recording.duration_ms);
    // Checkpoints know which slides were visited, but cannot prove speech on them.
    // Keep the normal capture's start-slide rule and preserve existing audio on
    // other visited slides unless they had no source yet.
    const spoken = Array.from({ length: n }, (_, i) => i === visits[0]?.slide);
    const { run: next, compare } = commitTake(deck, {
      attemptId: attempt.id, durationMs: attempt.recording.duration_ms, events: attempt.recording.slide_events,
    }, spoken, false, model.stats?.coverage ?? null);
    setRecoveryId(null);
    openReview(next.takeNo, next.sel, !!compare, 'fade');
  };

  return (
    <Enter kind={nav.nav}>
      <CaptureEngine key={engineKey} ref={engine} deck={deck} audience={deck.audience ?? ''} onMeter={onMeter}
        onInterrupted={m => { setError(m); bump(); }} onMustStop={() => { void stopRec(); }} />
      <PanView style={StyleSheet.absoluteFill} {...back} pointerEvents={setupOpen ? 'none' : 'auto'}
        accessibilityElementsHidden={setupOpen} importantForAccessibility={setupOpen ? 'no-hide-descendants' : 'auto'}>
        <Animated.View style={[StyleSheet.absoluteFill, screen]}>
          <PageSurface hue={deck.hue} />
          <View style={styles.header} pointerEvents="none">
            <Txt numberOfLines={1} style={styles.deckTitle}>{deck.title}</Txt>
          </View>
          <Animated.View pointerEvents="none" style={[styles.counterWrap, counterMotion]}>
            <Txt style={styles.counter}>{'Slide ' + (cur + 1) + ' of ' + n}</Txt>
          </Animated.View>
          {active && phase === 'idle' && !pdfRotated && !pdfRotating && !setupOpen && <Pressable accessibilityRole="button"
            accessibilityLabel="Edit presentation time and audience" onPress={openSetup} style={styles.editRequirements} hitSlop={{ left: 12, right: 12, top: 2 }}>
            <Txt style={styles.editLabel}>Edit time &amp; audience</Txt>
          </Pressable>}
          <SlideTrack model={model} slide={cur} trackX={trackX} onSlide={goSlide}
            previousLocked={locksPreviousSlide(phase)} isPreviousLocked={isPreviousLocked}
            navigationFrozen={freezesSlideNavigation(phase)} isNavigationFrozen={isNavigationFrozen}
            rotated={pdfRotated} rotating={pdfRotating} rotation={pdfRotation} />
          {!pdfRotated && <>
          <TickStrip n={n} cur={cur} disabled={freezesSlideNavigation(phase)} onPick={i => goSlide(i, 'jump')} />
          <CueGuidancePanel state={profiles.value} slide={cur} error={profiles.error} busy={profiles.busy}
            canPlayback={phase === 'idle' && !!partId && !!audioOf(partId)}
            slidePlaying={player.playingKey === `slide:${deck.id}:${cur}` && !player.paused}
            requirementsNotice={requirementsPending(deck.id, API_URL) ? (readRequirementsDraft(deck.id, API_URL)?.conflict ? 'Presentation choices conflict · tap the title to resolve' : 'Presentation choices saved on phone · sync pending. Targets use last synchronized time.') : defaultRequirementsPending(deck.id, API_URL) ? 'Presentation requirements · sync pending' : null}
            onPlaySlide={playSlide} playbackNotice={player.error || playbackNotice || (partId && !audioOf(partId) ? 'Audio for this slide isn’t on this phone' : null)}
            onRecover={action => {
              if (action === 'refresh') profiles.refresh();
              else if (action === 'confirm') setCueRetryAsk(profiles.value);
              else void profiles.recover();
            }} />
          <Readout live={live} phase={phase} cur={cur} take={take} deck={deck} burst={burst} error={error}
            recoveryCount={recoveryAttempts.length} recoveryNumber={recoveryAttempts.length ? recoveryCursor % recoveryAttempts.length + 1 : 0}
            onRecovery={() => recoveryAttempt && setRecoveryId(recoveryAttempt.id)} />
          </>}
          {pdfRotated && <>
            <RotatedReadout phase={phase} error={error} burst={burst}
              recoveryCount={recoveryAttempts.length} onRecovery={() => recoveryAttempt && setRecoveryId(recoveryAttempt.id)} />
            <RotatedWaveform live={live} phase={phase} />
          </>}
          <RoundButton glyph={pdfRotated ? 'h-portrait' : 'h-landscape'} active={pdfRotated}
            label={pdfRotated ? 'Return the PDF to normal view' : 'Rotate only the PDF for a bigger view'}
            caption="Rotate" captionRotation={controlSwap} onPress={rotate} style={{ left: 49 }} />
          <Animated.View pointerEvents={pdfRotated ? 'none' : 'box-none'} accessibilityElementsHidden={pdfRotated}
            importantForAccessibility={pdfRotated ? 'no-hide-descendants' : 'auto'} style={[styles.rightControlLayer, reviewMotion]}>
            <RoundButton glyph="h-review-bars" label={reviewDestination(state.takes) === 'full' ? 'Review full presentation' : 'Review current slide'} caption="Review" captionRotation={controlSwap}
              disabled={!run || recording || phase === 'count'}
              onPress={() => run && openReview(state.takes, cur, !!state.compare, 'rise')}
              style={{ left: 0, top: 0 }} />
          </Animated.View>
          <Animated.View pointerEvents="none" accessibilityElementsHidden={!pdfRotated}
            importantForAccessibility={!pdfRotated ? 'no-hide-descendants' : 'auto'} style={[styles.rightControlLayer, timeMotion]}>
            <RotatedTimer live={live} phase={phase} rotation={controlSwap} active={pdfRotated} />
          </Animated.View>
          <RecordRing progress={ringP} visible={ringV} />
          <RecordButton glyph={glyph} glyphRotation={pdfRotation} label={btnLabel} onPress={toggleRec} onPressIn={recDown} onPressOut={recUp} disabled={phase === 'starting' || phase === 'stopping'} />
          <HintRow hints={showIdleHints ? [idleHint] : hints} />
          {showIdleHints && <HintRow hints={[homeHint]} style={styles.homeHintRight} />}
        </Animated.View>
      </PanView>
      {setupOpen && <View style={StyleSheet.absoluteFill}><PageSurface hue={deck.hue} /><PresentationRequirementsEditor deck={deck} active={active}
        onSaved={() => setSetupOpen(false)} onBackPan={{ onMoveShould: (_e, g) => g.dy > 12 && g.dy > Math.abs(g.dx), onRelease: (_e, g) => { if (g.dy > BACK_T) setSetupOpen(false); } }} /></View>}
      {redoAsk && (
        <Dialog title={redoAsk === 'all' ? 'Redo the whole presentation?' : 'Redo slide ' + (cur + 1) + '?'}
          body={redoAsk === 'all' ? 'Recording starts again from slide 1. When you stop, you can compare it with your current run and keep either one.'
            : 'Your recording and transcript for slide ' + (cur + 1) + ' will be replaced. You can compare the takes and keep the old one.'}
          confirm={redoAsk === 'all' ? 'Redo all' : 'Redo'} onConfirm={confirmRedo} onCancel={cancelRedo}
          />
      )}
      {cueRetryAsk && <Dialog title="Retry AI cues?" body="The previous provider request has an uncertain outcome. Retrying may incur another charge."
        confirm="Retry" onConfirm={() => { const captured = cueRetryAsk; setCueRetryAsk(null); void profiles.recover(true, captured); }} onCancel={() => setCueRetryAsk(null)} />}
      {phase === 'burst' && <Confetti />}
      {recoveryId && <TakePlayback id={recoveryId} deck={deck} initialSlide={cur}
        onClose={closeRecovery} onRecovered={recovered} />}
    </Enter>
  );
}

// Updated PDF and slide limits by OpenAI Codex, Iteration 2 (2026-10-14).
// ── Slide carousel (render nearby slides on the track) ────────────────────
const SlideTrack = memo(function SlideTrack({ model, slide, trackX, onSlide, previousLocked, isPreviousLocked, navigationFrozen, isNavigationFrozen, rotated, rotating, rotation }: {
  model: DeckModel; slide: number; trackX: SharedValue<number>; onSlide: (i: number, mode: 'jump' | 'animate' | 'keep') => void;
  previousLocked: boolean; isPreviousLocked: () => boolean;
  navigationFrozen: boolean; isNavigationFrozen: () => boolean;
  rotated: boolean; rotating: boolean; rotation: SharedValue<number>;
}) {
  const { deck, n } = model;
  const step = CARD_STEP;
  const frame = useFrame();
  const g = useRef<{ base: number; x: number; lastT: number; vel: number; caught: boolean } | null>(null);
  useEffect(() => { g.current = null; }, [rotated]);
  const responder: PanHandlers = {
    // In the enlarged view the slide itself turns; the phone and controls stay upright.
    disabled: rotating || navigationFrozen,
    onStartShould: () => Math.abs(trackX.get() + slide * step) > 1,
    onMoveShould: (_e, gs) => rotated
      ? Math.abs(gs.dy) > 5 && Math.abs(gs.dy) >= Math.abs(gs.dx)
      : Math.abs(gs.dx) > 5 && Math.abs(gs.dx) >= Math.abs(gs.dy),
    onGrant: () => {
      cancelAnimation(trackX);
      const base = trackX.get() + slide * step;
      g.current = { base, x: base, lastT: Date.now(), vel: 0, caught: Math.abs(base) > 1 };
    },
    onMove: (_e, gs) => {
      const s = g.current;
      if (!s) return;
      const raw = s.base + (rotated ? gs.dy : gs.dx) / frame.s / (rotated ? 1.35 : 1);
      const edge = (raw > 0 && slide === 0) || (raw < 0 && slide === n - 1);
      s.x = isNavigationFrozen() || (raw > 0 && isPreviousLocked()) ? 0 : edge ? raw * 0.32 : raw;
      s.vel = (rotated ? gs.vy : gs.vx) / frame.s / (rotated ? 1.35 : 1); s.lastT = Date.now();
      trackX.set(-slide * step + s.x);
    },
    onRelease: () => release(),
    onTerminate: () => release(),
    onTerminationRequest: () => false,
  };
  function release() {
    const s = g.current;
    g.current = null;
    if (!s) return;
    const vel = Date.now() - s.lastT < 90 ? s.vel : 0;
    const { dir, ms } = decideRelease({ x: s.x, base: s.base, vel, step, slide, n });
    const allowedDir = isNavigationFrozen() || (dir < 0 && isPreviousLocked()) ? 0 : dir;
    const to = slide + allowedDir;
    trackX.set(withTiming(-to * step, { duration: ms, easing: EASE_SNAP }));
    // The counter, tick strip and transcript switch on release, not when the card lands.
    if (allowedDir) onSlide(to, 'keep');
  }
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: trackX.value }] }));
  // Keep the card's diagonal inside the stage halfway through the turn.
  const slidePosition = useAnimatedStyle(() => ({
    transform: [{ translateY: 138 * rotation.value + 10 * Math.sin(Math.PI * rotation.value) }],
  }));
  const slideRotation = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${90 * rotation.value}deg` },
      { scale: 1 + 0.35 * rotation.value - 0.22 * Math.sin(Math.PI * rotation.value) },
    ],
  }));
  const prev = () => onSlide(slide - 1, 'animate'), next = () => onSlide(slide + 1, 'animate');
  return (
    <View style={styles.slideStage} pointerEvents="box-none">
      <Animated.View style={[styles.slidePosition, slidePosition]} pointerEvents="box-none">
        <PanView style={[styles.slideZoom, slideRotation]} {...responder}
          accessible accessibilityRole="adjustable" accessibilityLabel={`Slide ${slide + 1} of ${n}: ${deck.slides[slide]?.title ?? ''}`}
          accessibilityActions={navigationFrozen ? [] : previousLocked ? [{ name: 'increment' }] : [{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => { if (rotating || isNavigationFrozen()) return; if (e.nativeEvent.actionName === 'increment') next(); else if (!isPreviousLocked()) prev(); }}>
          <Animated.View style={[styles.track, track]}>
            {Array.from({ length: Math.min(n - 1, slide + 2) - Math.max(0, slide - 2) + 1 }, (_, offset) => Math.max(0, slide - 2) + offset).map(i => (
              <View key={i} style={[styles.cardSlot, { left: i * step }]}>
                <SlideCard hue={deck.hue} page={deck.pages[i]} deckTitle={deck.title} title={deck.slides[i]?.title ?? 'Slide ' + (i + 1)}
                  points={deck.slides[i]?.points ?? []} num={i + 1} foldL={false} foldR={i < n - 1} shadow={!rotated} />
              </View>
            ))}
          </Animated.View>
        </PanView>
      </Animated.View>
      {!rotating && !navigationFrozen && !previousLocked && rotated && slide > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Previous slide, ${slide}: ${deck.slides[slide - 1]?.title ?? ''}`}
        onPress={prev} style={[styles.rotatedCorner, { top: 0 }]} />}
      {!rotating && !navigationFrozen && rotated && slide < n - 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Next slide, ${slide + 2}: ${deck.slides[slide + 1]?.title ?? ''}`}
        onPress={next} style={[styles.rotatedCorner, { bottom: 0 }]} />}
      {!rotating && !navigationFrozen && !previousLocked && !rotated && slide > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Previous slide, ${slide}: ${deck.slides[slide - 1]?.title ?? ''}`}
        onPress={prev} style={[styles.corner, { left: 16, top: 16 + CARD_H - 60 }]} />}
      {!rotating && !navigationFrozen && !rotated && slide < n - 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Next slide, ${slide + 2}: ${deck.slides[slide + 1]?.title ?? ''}`}
        onPress={next} style={[styles.corner, { right: 16, top: 16 + CARD_H - 60 }]} />}
    </View>
  );
});

/** Elapsed rehearsal time takes Review's place while only the PDF is rotated. */
function RotatedTimer({ live, phase, rotation, active }: { live: LiveStore; phase: Phase; rotation: SharedValue<number>; active: boolean }) {
  const { c } = useTheme();
  const elapsed = useSyncExternalStore(live.subscribe, () => active ? fmt(live.get().E) : '0:00');
  const shown = phase === 'recording' || phase === 'stopping' || phase === 'burst' ? elapsed : '0:00';
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`Elapsed rehearsal time ${shown}`} style={styles.rotatedTimerWrap}>
      <View style={styles.rotatedTimerFace}>
        <Txt style={[styles.rotatedTimerText, { color: phase === 'idle' || phase === 'count' || phase === 'starting' ? c.strong : c.text }]}>{shown}</Txt>
      </View>
      <OrbitalCaption text="Time" rotation={rotation} />
    </View>
  );
}

/** Compact recovery/completion status below the sideways PDF. */
function RotatedReadout({ phase, error, burst, recoveryCount, onRecovery }: {
  phase: Phase; error: string; burst: { total: number } | null;
  recoveryCount: number; onRecovery: () => void;
}) {
  const { c } = useTheme();
  const text = error || (recoveryCount && phase === 'idle' ? 'Recording interrupted · tap to inspect' :
    phase === 'burst' && burst ? `Run complete · ${fmt(burst.total)}` : null);
  if (!text) return null;
  return <Txt numberOfLines={1} accessibilityRole={recoveryCount && phase === 'idle' ? 'button' : 'text'}
    onPress={recoveryCount && phase === 'idle' ? onRecovery : undefined}
    style={[styles.rotatedStatus, { color: error || recoveryCount ? c.bad : c.text }]}>{text}</Txt>;
}

function RotatedWaveform({ live, phase }: { live: LiveStore; phase: Phase }) {
  const wave = useSyncExternalStore(live.subscribe, () => live.get().wave);
  const recording = phase === 'recording' || phase === 'stopping';
  return <Waveform bars={recording ? wave : IDLE_WAVE} live={recording} />;
}

function TickStrip({ n, cur, disabled, onPick }: { n: number; cur: number; disabled: boolean; onPick: (i: number) => void }) {
  const { c } = useTheme();
  const frame = useFrame();
  const pickAt = (e: GestureResponderEvent) => {
    const x = (e.nativeEvent.pageX - frame.left) / frame.s - 16;
    onPick(Math.max(0, Math.min(n - 1, Math.floor((x / 358) * n))));
  };
  const responder: PanHandlers = {
    onStartShould: () => true, onMoveShould: () => true,
    onGrant: pickAt, onMove: pickAt, onTerminationRequest: () => false,
  };
  const ticks = Math.min(n, 48);
  const active = Math.floor((cur * ticks) / n);
  return (
    <PanView style={styles.strip} {...responder} disabled={disabled}>
      {Array.from({ length: ticks }, (_, i) => (
        <View key={i} accessible accessibilityRole="button" accessibilityLabel={'Go near slide ' + (Math.floor((i * n) / ticks) + 1)}
          style={{ flex: 1, height: i === active ? 12 : 6, borderRadius: 3, backgroundColor: i === active ? c.strong : i < active ? c.ink55 : c.ink16 }} />
      ))}
    </PanView>
  );
}

// ── Timer, slide time, pace chip and waveform (re-render ~10×/s while recording) ──
function Readout({ live, phase, cur, take, deck, burst, error, recoveryCount, recoveryNumber, onRecovery }: {
  live: LiveStore; phase: Phase; cur: number; take: boolean; deck: DeckModel['deck']; burst: { total: number } | null; error: string;
  recoveryCount: number; recoveryNumber: number; onRecovery: () => void;
}) {
  const { c } = useTheme();
  const L = useSyncExternalStore(live.subscribe, live.get);
  const recording = phase === 'recording' || phase === 'stopping';
  const target = deck.targets[cur] ?? 0;
  if (recording) {
    const onSlide = L.E - L.slideStart;
    const pace = paceChip(L.E, cur, L.recStart, deck.targets);
    return <>
      <View style={styles.paceWrap} pointerEvents="none"><Chip chip={pace} size={14} /></View>
      <Txt style={[styles.big, { color: c.text }]}>{fmt(L.E)}</Txt>
      <Txt style={[styles.line, { color: onSlide > target ? c.coralText : c.secondary }]}>{'Slide ' + (cur + 1) + ' · ' + fmt(onSlide) + ' of ' + fmt(target)}</Txt>
      <Waveform bars={L.wave} live />
    </>;
  }
  const recovery = recoveryCount > 0;
  const line = recovery && phase === 'idle' ? 'Recording interrupted' + (recoveryCount > 1 ? ` ${recoveryNumber} of ${recoveryCount}` : '') + ' · tap to inspect' : error ? error : phase === 'count' ? 'Get ready…' : phase === 'burst' ? 'Run complete'
    : take ? 'Redo slide ' + (cur + 1) : cur === 0 ? 'Full run · target ' + fmt(deck.target) : 'Record slide ' + (cur + 1);
  return <>
    <Txt style={[styles.big, { color: phase === 'burst' ? c.text : c.strong }]}>{phase === 'burst' && burst ? fmt(burst.total) : '0:00'}</Txt>
    <Txt numberOfLines={2} accessibilityRole={recovery && phase === 'idle' ? 'button' : 'text'}
      accessibilityLabel={recovery && phase === 'idle' ? 'Open interrupted recording for recovery' : undefined}
      onPress={recovery && phase === 'idle' ? onRecovery : undefined}
      style={[styles.line, { color: error || recovery ? c.bad : c.secondary }]}>{line}</Txt>
    <Waveform bars={IDLE_WAVE} live={false} />
  </>;
}

const styles = createThemedStyles({
  homeHintRight: { left: 244, right: 0 },
  loading: { position: 'absolute', top: 400, left: 0, right: 0, textAlign: 'center', fontFamily: F.medium, fontSize: 14, color: C.secondary },
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  deckTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  counterWrap: { position: 'absolute', left: 120, top: 75, width: 150, height: 18, alignItems: 'center', justifyContent: 'center' },
  counter: { fontFamily: F.medium, fontSize: 13, color: C.secondary },
  editRequirements: { position: 'absolute', left: 96, right: 96, top: 96, height: 20, alignItems: 'center', justifyContent: 'center' },
  editLabel: { fontFamily: F.semibold, fontSize: 11, lineHeight: 14, color: C.secondary },
  slideStage: { position: 'absolute', left: 0, top: 100, width: 390, height: 510, overflow: 'hidden' },
  slidePosition: { position: 'absolute', left: 16, top: 16, width: CARD_W, height: CARD_H },
  slideZoom: { width: CARD_W, height: CARD_H, overflow: 'hidden' },
  rotatedStatus: { position: 'absolute', left: 20, right: 20, top: 622, textAlign: 'center',
    fontFamily: F.semibold, fontSize: 13 },
  rightControlLayer: { position: 'absolute', top: 690, left: 289, width: 52, height: 90 },
  rotatedTimerWrap: { position: 'absolute', top: 0, left: 0, width: 52, alignItems: 'center', gap: 6 },
  rotatedTimerFace: { width: 52, height: 52, borderRadius: 26, borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)', backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center' },
  rotatedTimerText: { fontFamily: F.bold, fontSize: 13, fontVariant: ['tabular-nums'], color: C.text,
    transform: [{ rotate: '90deg' }] },
  track: { position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H },
  cardSlot: { position: 'absolute', top: 0, width: CARD_W, height: CARD_H },
  corner: { position: 'absolute', width: 60, height: 60 },
  rotatedCorner: { position: 'absolute', left: 55, width: 76, height: 76 },
  strip: { position: 'absolute', left: 16, right: 16, top: 330, height: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  paceWrap: { position: 'absolute', left: 0, right: 0, top: 512, alignItems: 'center' },
  big: { position: 'absolute', left: 0, right: 0, top: 548, textAlign: 'center', fontFamily: F.display, fontSize: 42, lineHeight: 44, letterSpacing: -1.3, fontVariant: ['tabular-nums'] },
  line: { position: 'absolute', left: 30, right: 30, top: 596, textAlign: 'center', fontFamily: F.semibold, fontSize: 14 },
});
