import { useDisplayTranslation } from '../features/localization/useDisplayTranslation';
import { displayProfileCues, translatedProfile } from '../features/localization/generatedProse';
import { useUiText } from '../design/language';
import { LiveFeedbackPanel } from '../features/recording/LiveFeedbackPanel';
import { captureVersion, readCapture, subscribeCaptures } from '../features/recording/incremental';
// OpenAI Codex review routing: docs/ai-collaboration/prompt-logs/seoyeon/iteration-2.md#record-137
// OpenAI Codex reliability fixes: docs/ai-collaboration/prompt-logs/unattributed/iteration-2.md#record-138
// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-117
// OpenAI Codex time/audience setup: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-107
// OpenAI Codex removes the edit-settings button backdrop.
// OpenAI Codex light-mode rehearsal: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-081
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OpenAI Codex follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-047
// OpenAI Codex Review entry navigation: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-122
// OpenAI Codex follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-048
// OutLoud redesign: Rehearse (SPEC §4.4) with transcript corrections (§5.4).
// OpenAI Codex landscape follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-053
// OpenAI Codex portrait-only correction: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-080
// OpenAI Codex rotate-icon update: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-082
// OpenAI Codex rotated timer follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-082
// OpenAI Codex stable bottom hints: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-082
// OpenAI Codex sideways timer digits: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-084
// OpenAI Codex rotated Home hint: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-085
// OpenAI Codex rotated slide corners: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-086
// OpenAI Codex smooth PDF rotation: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-089
// OpenAI Codex static Home hint: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-090
// OpenAI Codex sideways redo glyph: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-091
// OpenAI Codex orbiting sideways captions: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-092
// OpenAI Codex sideways waveform and counter: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-093
// OpenAI Codex Review bars: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-094
// OpenAI Codex centered redo hint: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-098
// OpenAI Codex smooth Review/Time handoff: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#i2-smooth-reviewtime-rotation-october-15-2026
// OpenAI Codex idle timer contrast: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-102
// OpenAI Codex faster Home return: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-109
// OpenAI Codex faster presentation exit: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-112
// OpenAI Codex immediate recording completion: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-114
// OpenAI Codex forward-only live recording: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-125
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Image, Pressable, StyleSheet, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { Enter, FrameContext, Txt, useFrame, useFrameLayout, type FrameInfo } from '../design/frame';
import { PresentationIcon, UIIcon } from '../design/icons';
import { PanView, type PanHandlers } from '../design/PanView';
import { CARD_H, CARD_W, MiniSlide, SlideCard } from '../design/SlideCard';
import { C, EASE_SCREEN, EASE_SNAP, F, FRAME_W, HOME_HEADER_CONTROL } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { Chip, Confetti, Dialog, HintRow, IDLE_WAVE, PageSurface, RecordButton, RecordRing, RoundButton, Waveform, type Hint, type RecordGlyph } from '../design/ui';
import { paceChip } from '../domain/analysis';
import { fmt } from '../domain/format';
import { BACK_FADE_Y, BACK_T, CARD_STEP, decideRelease } from '../domain/gestures';
import { reviewDestination, runAttemptIds, takeVisits } from '../domain/run';
import { CaptureEngine, type CaptureHandle } from '../features/rehearsal/CaptureEngine';
import { commitTake } from '../features/rehearsal/takes';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { ensurePages, ensureSlideText } from '../features/presentations/importer';
import { bump, getDeckState, useStore, visibleDecks } from '../features/presentations/store';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { savedAttempts, type SavedAttempt } from '../features/recording/storage';
import { CueGuidancePanel } from '../features/presentations/CueGuidancePanel';
import { useSlideProfiles } from '../features/presentations/useSlideProfiles';
import { slideProfileAt, type ProfileState } from '../features/presentations/slideProfiles';
import { onlineAllowed } from '../services/storePrivacy';
import { getRequirementsVersion, subscribeRequirements } from '../features/presentations/requirementsStore';
import { PresentationRequirementsEditor, PresentationSetupHint } from './PresentationSetup';
import { LandscapeRehearse } from './LandscapeRehearse';
import { TakePlayback } from './TakePlayback';
import { useBack, useShell } from './shared';
import { usePageFooter } from './pageFooter';
import { CAROUSEL_TOP, HOME_TITLE_LANDING, SLOT_H, SLOT_TOP, deckIconSize, homeTitleReveal } from './homeGeometry';
import { landscapeSlideRect, slideRotationPose, type SlideRect } from './slideRotation';

type Phase = 'idle' | 'count' | 'starting' | 'recording' | 'stopping' | 'burst';
const locksPreviousSlide = (phase: Phase) => phase === 'starting' || phase === 'stopping';
const freezesSlideNavigation = (phase: Phase) => phase === 'starting' || phase === 'stopping';
const SPEECH_DB = -38;
// OpenAI Codex follow-up (2026-10-15): whole-presentation redo hold; see the Iteration 2 prompt log.
const REDO_HOLD_MS = 1500;
const OPEN_MS = 160;
const OPEN_FROM_HOME_MS = 260;
const RETURN_MS = 300;
const RETURN_RESET_MS = 180;
const CHROME_RETURN_FRACTION = 0.4;
const ROTATE_MS = 240;
const ROTATION_IMAGE_GRACE_MS = 200;
const HEADER_TOP = 50;
const SLIDE_STAGE_TOP = 100;
const SLIDE_STAGE_HEIGHT = 510;
const SLIDE_TOP = 16;
const HOME_SLOT_TOP = CAROUSEL_TOP + SLOT_TOP;
const HOME_ICON_BOTTOM = HOME_SLOT_TOP + SLOT_H;
type Rotation = {
  landscape: boolean; slide: number; pose: ReturnType<typeof slideRotationPose>; imageUri?: string;
  portraitLanding?: { frame: FrameInfo; position: ViewStyle };
};
type RotationLanding = { uri?: string; ready: boolean; finish?: () => void };

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
  }, [go, nav.deckId]);
  if (!model || !model.n) return <>
    <PageSurface fullBleed />
    {model && <Enter kind={nav.nav} duration={OPEN_MS}><Txt style={styles.loading}>Preparing slides…</Txt></Enter>}
  </>;
  return <Rehearse model={model} active={active} />;
});

function Rehearse({ model, active }: { model: DeckModel; active: boolean }) {
  const ui = useUiText();
  const { c } = useTheme();
  const { go, nav, home, setFullscreenLandscape } = useShell();
  const frame = useFrame();
  const reducedMotion = useReducedMotion();
  const openingPage = active && !!nav.nav && !reducedMotion;
  const openingFromHome = openingPage && nav.from === 'home';
  const [pdfRotated, setPdfRotated] = useState(false);
  const [fullscreenCues, setFullscreenCues] = useState(false);
  const [rotation, setRotation] = useState<Rotation | null>(null);
  const rotationLanding = useRef<RotationLanding | null>(null);
  const rotationProgress = useSharedValue(0);
  const portraitLayout = useFrameLayout();
  const landscapeLayout = useFrameLayout(true);
  const lastPortraitLayout = useRef<typeof portraitLayout | null>(null);
  const rotating = active && !!rotation;
  const showLandscape = pdfRotated && active;
  const preparingLandscape = rotating && rotation?.landscape && !!rotation.imageUri;
  const portraitLanding = rotating ? rotation?.portraitLanding : undefined;
  const portraitFrame = portraitLanding?.frame ?? frame;
  const portraitReveal = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, (rotationProgress.value - 0.62) / 0.32)) }));
  const rotationBackdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, rotationProgress.value / 0.8) }));
  const finishRotation = useCallback((landscape: boolean) => {
    setFullscreenCues(false);
    setPdfRotated(landscape);
    setFullscreenLandscape(landscape);
    setRotation(null);
    rotationLanding.current = null;
  }, [setFullscreenLandscape]);
  const onLandscapePreviewSettled = useCallback((uri: string) => {
    const landing = rotationLanding.current;
    if (!landing || landing.uri !== uri) return;
    landing.ready = true;
    landing.finish?.();
  }, []);
  useEffect(() => {
    const landing = rotationLanding.current;
    if (!rotation || !landing) return;
    let cancelled = false;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (!cancelled && rotationLanding.current === landing) finishRotation(rotation.landscape);
    };
    const motionEnded = () => {
      if (cancelled) return;
      if (!landing.uri || landing.ready) finish();
      else {
        // The animated frame remains visible until the same native image can take over.
        landing.finish = finish;
        wait = setTimeout(finish, ROTATION_IMAGE_GRACE_MS);
      }
    };
    rotationProgress.set(withTiming(1, { duration: ROTATE_MS, easing: EASE_SCREEN }, finished => {
      if (finished) runOnJS(motionEnded)();
    }));
    return () => {
      cancelled = true;
      clearTimeout(wait);
      cancelAnimation(rotationProgress);
    };
  }, [finishRotation, rotation, rotationProgress]);
  useEffect(()=>{ if(active) void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(()=>undefined); },[active]);
  useEffect(()=>()=>setFullscreenLandscape(false),[setFullscreenLandscape]);
  useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupHintVisible, setSetupHintVisible] = useState(true);
  const [cueSheetOpen, setCueSheetOpen] = useState(false);
  const [cueCloseRequest, setCueCloseRequest] = useState(0);
  const pdfRotation = useSharedValue(0);
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
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [showLiveFeedback, setShowLiveFeedback] = useState(false);
  const [preferIncremental, setPreferIncremental] = useState(true);
  useSyncExternalStore(subscribeCaptures, captureVersion);
  const liveCapture = captureId ? readCapture(captureId) : null;
  const [burst, setBurst] = useState<{ total: number; compare: boolean } | null>(null);
  const engine = useRef<CaptureHandle>(null);
  const fullRedo = useRef(false);
  const longFired = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);
  const [live] = useState(createLive);
  const profiles = useSlideProfiles(deck.id, n, active, deck);
  const serverRefreshing = profiles.refreshing;
  const refreshDisabled = serverRefreshing || profiles.busy || (!profiles.available && profiles.syncing);
  const refreshRotation = useSharedValue(0);
  useEffect(() => {
    refreshRotation.set(0);
    if (!active || pdfRotated || reducedMotion || !serverRefreshing) return;
    refreshRotation.set(withRepeat(withTiming(360, { duration: 850, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(refreshRotation);
  }, [active, pdfRotated, reducedMotion, refreshRotation, serverRefreshing]);
  const refreshIconMotion = useAnimatedStyle(() => ({ transform: [{ rotate: `${refreshRotation.value}deg` }] }));
  const { value: translatedSlide, missing, unavailableFields } = useDisplayTranslation(active, scope => {
    const saved = profiles.value;
    if (!saved?.descriptions || !saved.description_set_id || saved.state !== 'completed' || saved.stale) return null;
    const current = slideProfileAt(saved, slide);
    return current ? translatedProfile(current, scope('profiles', saved.description_set_id, String(saved.description_revision))) : null;
  });
  const savedProfiles = profiles.value;
  // The cue panels render one slide. Keep the complete profiles in the cache.
  const displayProfiles = translatedSlide && savedProfiles?.descriptions
    ? { ...savedProfiles, descriptions: { slides: [displayProfileCues(translatedSlide, missing, unavailableFields)] } }
    : savedProfiles;
  const profilesAvailable = profiles.available;
  const cueConnectionMessage = profilesAvailable ? 'Checking AI cues…' : 'Connecting for cues…';
  const completedCues = displayProfiles?.state === 'completed' && !displayProfiles.stale;
  const landscapeCueStatus = (completedCues ? '' : profiles.error) || (!displayProfiles ? cueConnectionMessage : undefined);
  useEffect(() => {
    // The cue hook links a local PDF first. Once its mapping is saved, text
    // recovery can reuse that server deck without a competing upload.
    if (active && profilesAvailable && deck.text === 'pending') void ensureSlideText(deck.id);
  }, [active, deck.id, deck.text, profilesAvailable]);
  const [cueRetryAsk, setCueRetryAsk] = useState<ProfileState | null>(null);
  const [refreshAsk, setRefreshAsk] = useState(false);
  const ringP = useSharedValue(0), ringV = useSharedValue(0);
  const trackX = useSharedValue(-slide * CARD_STEP);
  useEffect(() => {
    cancelAnimation(trackX);
    trackX.set(-slideRef.current * cardStep);
  }, [cardStep, trackX]);
  const pageOpen = useSharedValue(openingPage ? 0 : 1);
  const closingToHome = useSharedValue(false);
  const [openingControls, setOpeningControls] = useState(openingPage);
  const [returning, setReturning] = useState(false);
  const controlsBlocked = openingControls || returning || rotating;
  useEffect(() => {
    if (!active) { closingToHome.set(false); return; }
    const decks=visibleDecks(),index=decks.findIndex(value=>value.id===deck.id);
    if(index>=0&&decks.length)home.p.set(Math.round((home.p.get()-index)/decks.length)*decks.length+index);
    home.titleReturn?.set(0);
  }, [active, closingToHome, deck.id, home.p, home.titleReturn]);
  useEffect(() => {
    if (!openingControls) return;
    const duration = openingFromHome ? OPEN_FROM_HOME_MS : openingPage ? OPEN_MS : 0;
    pageOpen.set(withTiming(1, { duration, easing: EASE_SCREEN }, finished => {
      if (finished) runOnJS(setOpeningControls)(false);
    }));
    return () => cancelAnimation(pageOpen);
  }, [openingControls, openingFromHome, openingPage, pageOpen]);
  const setupDy = useSharedValue(0);
  const setupMotion = useAnimatedStyle(() => ({opacity:Math.max(0,1-setupDy.value/BACK_FADE_Y),transform:[{translateY:setupDy.value*0.15}]}));
  const backExiting = useRef(false);
  const touchStartedDuringOpening = useRef(false);
  const player = useSegmentPlayer();
  const stopPlayback = player.stop;
  // OpenAI Codex, 2026-11-19: reserve Wait for the first after-Stop handoff; reopening a saved take goes to its review.
  const openReview = useCallback((takes: number, selected: number, comparing: boolean, transition: 'fade' | 'rise', incremental = false, afterStop = false) => {
    stopPlayback();
    const destination = comparing ? 'compare' : incremental || !onlineAllowed() ? 'full' : afterStop && takes === 1 ? 'wait' : reviewDestination(takes);
    go(destination, { nav: transition, deckId: deck.id, sel: selected, slide: selected,
      from: destination === 'full' || destination === 'wait' || destination === 'review' ? 'rehearse' : null });
  }, [deck.id, go, stopPlayback]);
  const openOverallReview = useCallback((selected: number) => {
    stopPlayback();
    go('full', { nav: 'rise', deckId: deck.id, sel: selected, slide: selected, from: 'rehearse' });
  }, [deck.id, go, stopPlayback]);
  const openSetup = useCallback(() => { if (active && phaseRef.current === 'idle') { stopPlayback(); setupDy.set(80); setSetupOpen(true);setupDy.set(withTiming(0,{duration:460,easing:EASE_SCREEN})); } }, [active, setupDy, stopPlayback]);
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
  // Settings offers recovery for interrupted captures that are not already in a take.
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
  }, [cardStep, isNavigationFrozen, isPreviousLocked, live, n, player, trackX]);
  const routeSlideRef = useRef({ active: false, slide: nav.slide });
  useEffect(() => {
    const previous = routeSlideRef.current;
    routeSlideRef.current = { active, slide: nav.slide };
    if (previous.slide !== nav.slide || (active && !previous.active)) goSlide(nav.slide, 'jump');
  }, [active, goSlide, nav.slide]);

  // ── Recording ─────────────────────────────────────────────────────────────
  const stopCount = () => { if (countTimer.current) { clearInterval(countTimer.current); countTimer.current = null; } };
  const hideRing = () => { cancelAnimation(ringP); ringV.set(withTiming(0, { duration: 200 })); };
  const startRec = useCallback(async (liveFeedback?: Promise<boolean>) => {
    setPhase('starting');
    setError('');
    try {
      setCaptureId(null);
      await engine.current?.start(() => slideRef.current, liveFeedback);
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
    // OpenAI Codex, 2026-11-23: check server capability during the countdown; start the microphone after it.
    const liveFeedback = engine.current?.checkLiveFeedback();
    setPhase('count'); setCount(3);
    ringV.set(1); ringP.set(1);
    ringP.set(withTiming(0, { duration: 3000, easing: Easing.linear }));
    const t0 = Date.now();
    stopCount();
    countTimer.current = setInterval(() => {
      const el = Date.now() - t0;
      if (el >= 3000) { stopCount(); void startRec(liveFeedback); return; }
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
      // OpenAI Codex, 2026-11-02: remount the single-use engine after success; see docs/ai-collaboration/README.md#prompt-logs.
      setEngineKey(k => k + 1);
      hideRing();
      setBurst({ total: take.durationMs / 1000, compare: !!compare });
      setPhase('burst');
      setShowLiveFeedback(false);
      openReview(next.takeNo, next.sel, !!compare, compare ? 'rise' : 'fade', !!readCapture(take.attemptId), true);
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

  // ── Back (swipe down / system Back) ───────────────────────────────────────
  const canGoBack = active && !pdfRotated && phase === 'idle' && !redoAsk && !recoveryId;
  const rotate = (landscapePreview?: SlideRect) => {
    if (!active || rotationLanding.current || controlsBlocked) return;
    cancelAnimation(trackX);
    const slide = slideRef.current;
    trackX.set(-slide * CARD_STEP);
    recUp();
    if (reducedMotion) { finishRotation(!pdfRotated); return; }

    // Keep the portrait insets captured before full screen hid the status bar.
    if (!pdfRotated) lastPortraitLayout.current = portraitLayout;
    const cached = lastPortraitLayout.current;
    const portrait = cached && cached.width === portraitLayout.width && cached.height === portraitLayout.height ? cached : portraitLayout;
    const portraitPreview = { left: 16, top: SLIDE_STAGE_TOP + SLIDE_TOP, width: CARD_W, height: portrait.info.compact ? 170 : CARD_H };
    const fullPreview = landscapePreview ?? landscapeSlideRect(landscapeLayout.info.width, landscapeLayout.info.height);
    const pose = pdfRotated
      ? slideRotationPose(landscapeLayout, portrait, fullPreview, portraitPreview, deck.pages[slide])
      : slideRotationPose(portrait, landscapeLayout, portraitPreview, fullPreview, deck.pages[slide]);
    let portraitLanding: Rotation['portraitLanding'];
    if (pdfRotated) {
      // Stage the actual portrait UI upright in the current landscape canvas.
      const canvas = { left: 0, top: 0, width: portrait.designW, height: portrait.designH };
      const landing = slideRotationPose(landscapeLayout, portrait, canvas, canvas);
      portraitLanding = {
        frame: portrait.info,
        position: { position: 'absolute', ...canvas, transform: [
          { translateX: landing.dx }, { translateY: landing.dy }, { rotate: `${landing.angle}deg` }, { scale: landing.scaleX },
        ] },
      };
    }
    const imageUri = !pdfRotated ? deck.pages[slide]?.uri : undefined;
    rotationLanding.current = { uri: imageUri, ready: false };
    rotationProgress.set(0);
    setRotation({ landscape: !pdfRotated, slide, pose, imageUri, portraitLanding });
  };
  const leave = useCallback(() => {
    player.stop();
    home.titleReturn?.set(1);
    const decks = visibleDecks();
    const index = decks.findIndex(d => d.id === deck.id);
    const count = decks.length;
    if (index >= 0 && count) home.p.set(Math.round((home.p.get() - index) / count) * count + index);
    go('home', { nav: null });
  }, [deck.id, go, home.p, home.titleReturn, player]);
  const beginReturn = () => {
    closingToHome.set(true);
    setReturning(true);
  };
  const resetReturn = () => {
    home.titleReturn.set(withTiming(0, { duration: reducedMotion ? 0 : RETURN_RESET_MS, easing: EASE_SCREEN }, finished => {
      if (!finished) return;
      closingToHome.value = false;
      runOnJS(setReturning)(false);
    }));
  };
  const finishBack = () => {
    if (backExiting.current) return;
    backExiting.current = true;
    if (reducedMotion) { leave(); return; }
    beginReturn();
    home.titleReturn.set(withTiming(1, { duration: RETURN_MS, easing: EASE_SCREEN }, finished => {
      if (finished) runOnJS(leave)();
    }));
  };
  const back: PanHandlers = {
    // OpenAI Codex, 2026-11-19: finish the finger-tracked close at a readable pace.
    onStartShouldCapture: (_e, g) => {
      // A child can claim the touch before it bubbles. Record when it began in capture.
      if (g.numberActiveTouches === 1) touchStartedDuringOpening.current = openingControls;
      return false;
    },
    onMoveShouldCapture: (_e, g) =>
      !controlsBlocked && !touchStartedDuringOpening.current && !cueSheetOpen &&
      !backExiting.current && canGoBack && g.dy > 8 && g.dy > Math.abs(g.dx),
    // An idle vertical swipe can start on a cue card or footer. If it
    // started on Record, release its hold before navigating away.
    onGrant: () => { recUp(); beginReturn(); },
    onMove: (_e, g) => {
      if (!backExiting.current) home.titleReturn.set(Math.max(0, Math.min(1, g.dy / frame.s / BACK_FADE_Y)));
    },
    onRelease: () => {
      if (backExiting.current) return;
      if (home.titleReturn.get() * BACK_FADE_Y > BACK_T) finishBack();
      else resetReturn();
    },
    onTerminate: () => { if (!backExiting.current) resetReturn(); },
  };
  const closeSetup = () => setupDy.set(withTiming(BACK_FADE_Y,{duration:460,easing:EASE_SCREEN},done=>{if(done)runOnJS(setSetupOpen)(false);}));
  useBack(active, () => {
    if (setupOpen) { closeSetup(); return true; }
    if (cueSheetOpen) { setCueSheetOpen(false); setCueCloseRequest(value => value + 1); return true; }
    // Fullscreen is an explicit player mode. Only its upper-left control exits.
    if (pdfRotated || rotationLanding.current) return true;
    if (recoveryId) { closeRecovery(); return true; }
    if (redoAsk) { cancelRedo(); return true; }
    if (refreshAsk) { setRefreshAsk(false); return true; }
    if (openingControls || phaseRef.current !== 'idle') return true;
    finishBack(); return true;
  });
  // At entrance the shared value may still hold Home's completed return.
  const progressToHome = useDerivedValue(() => active && !reducedMotion && closingToHome.value ? home.titleReturn.value : 0);
  const cardProgress = useDerivedValue(() => (openingFromHome ? pageOpen.value : 1) * (1 - progressToHome.value));
  const surfaceMotion = useAnimatedStyle(() => ({ opacity: 1 - progressToHome.value }));
  const screen = useAnimatedStyle(() => ({ opacity: openingFromHome ? 1 : 0.55 + 0.45 * pageOpen.value }));
  // Copy just the picked card's identity onto the opaque page. The rest of Home stays underneath.
  const iconSize = deckIconSize(frame.compact);
  const titleMotion = useAnimatedStyle(() => {
    const toHome = progressToHome.value;
    const remaining = Math.max(1 - cardProgress.value, Math.min(1, toHome / HOME_TITLE_LANDING));
    return {
      opacity: 1 - homeTitleReveal(toHome),
      transform: [{ translateY: (HOME_SLOT_TOP - HEADER_TOP + 2.4) * remaining }, { scale: 1 + (22 / 18 - 1) * remaining }],
    };
  });
  const iconEntrance = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - pageOpen.value / 0.48),
  }));
  const chromeMotion = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progressToHome.value / CHROME_RETURN_FRACTION) *
      (openingFromHome ? Math.max(0, (pageOpen.value - 0.64) / 0.36) : 1),
  }));
  const counterMotion = useAnimatedStyle(() => ({
    // Keep the counter clear of the path the moving title crosses.
    opacity: Math.max(0, 1 - progressToHome.value / 0.06) *
      (openingFromHome ? Math.max(0, (pageOpen.value - 0.9) / 0.1) : 1),
  }));
  // Home's stats and hints fade in after the rehearsal footer and readout fade out.
  const bottomMotion = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - 2 * progressToHome.value) *
      (openingFromHome ? Math.max(0, (pageOpen.value - 0.64) / 0.36) : 1),
  }));
  const footer = usePageFooter(active);

  // ── View model ────────────────────────────────────────────────────────────
  const cur = slide;
  const take = !recording && hasTake(cur);
  const starting = phase === 'starting';
  const glyph: RecordGlyph = starting ? 1 : phase === 'count' ? (count as 3 | 2 | 1) : recording ? 'stop' : take ? 'redo' : 'mic';
  const btnLabel = phase === 'count' ? `Starting in ${count}. Tap to cancel` : starting ? 'Starting recorder…' : recording ? 'Stop recording'
    : (take ? 'Redo slide ' + (cur + 1) : 'Record slide ' + (cur + 1)) + (anyTake ? '. Hold 1.5 seconds to redo the whole presentation' : '');
  const idleHint: Hint = take ? { icon: 'h-hold', text: 'Hold to redo all' } : { icon: 'h-tap', text: 'Tap to record' };
  const homeHint: Hint = { icon: 'h-dn', text: 'Home' };
  const hints: Hint[] = phase === 'count' ? [{ icon: 'h-tap', text: 'Tap to cancel' }]
    : starting ? [] : recording ? [{ icon: 'h-tap', text: 'Tap to stop' }, { icon: 'h-spin', text: 'Swipe slides' }]
      : phase === 'burst' ? [{ icon: 'h-tap', text: burst?.compare ? 'Comparing takes' : 'Opening review' }]
        : [idleHint, homeHint];
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
    openReview(next.takeNo, next.sel, !!compare, 'fade', false, true);
  };

  const captureEngine = <CaptureEngine preferIncremental={preferIncremental} onStarted={setCaptureId} key={engineKey} ref={engine} deck={deck} audience={deck.audience ?? ''} onMeter={onMeter}
    onInterrupted={bump} onMustStop={() => { void stopRec(); }} />;

  // The capture owner stays at the same React position when the visual layout changes.
  return <>
    {captureEngine}
    {showLiveFeedback && captureId && <LiveFeedbackPanel id={captureId} landscape={pdfRotated} close={() => setShowLiveFeedback(false)} />}
    <View pointerEvents={rotating ? 'none' : 'box-none'} accessibilityElementsHidden={rotating}
      importantForAccessibility={rotating ? 'no-hide-descendants' : 'auto'} style={StyleSheet.absoluteFill}>
    {(showLandscape || preparingLandscape) && <LandscapeRehearse model={model} live={live} slide={cur} phase={phase} glyph={glyph} btnLabel={btnLabel}
        recording={recording} take={take} disabled={phase==='starting'||phase==='stopping'} onRecord={toggleRec} onRecordDown={recDown} onRecordUp={recUp}
        ringProgress={ringP} ringVisible={ringV}
        onExit={rotate} onPrevious={()=>goSlide(cur-1,'animate')} onNext={()=>goSlide(cur+1,'animate')}
        cueState={displayProfiles} cueBusy={profiles.busy} cueStatus={landscapeCueStatus} onCueRecovery={()=>profiles.refresh()}
        onReview={()=>recording && liveCapture ? setShowLiveFeedback(true) : run && (state.compare ? openReview(state.takes,cur,true,'rise') : openOverallReview(cur))}
        comparePending={!!state.compare}
        reviewEnabled={recording ? !!liveCapture : !!run && phase === 'idle'} liveFeedback={recording && !!liveCapture}
        redoAsk={redoAsk} onConfirmRedo={confirmRedo} onCancelRedo={cancelRedo}
        cues={fullscreenCues} onCuesChange={setFullscreenCues} rotationFade={rotating && !preparingLandscape ? rotationProgress : undefined}
        preparingFrame={preparingLandscape ? landscapeLayout.info : undefined} onPreviewSettled={onLandscapePreviewSettled} />}
    {rotating && rotation && <Animated.View pointerEvents="none" testID="rotation-backdrop"
      style={[{ position: 'absolute', ...rotation.pose.viewport, backgroundColor: rotation.landscape ? '#000000' : c.bg }, rotationBackdrop]} />}
    {(!showLandscape || portraitLanding) && <Animated.View
      style={portraitLanding ? [portraitLanding.position, portraitReveal] : styles.settledPortrait} testID="presentation-page">
      <FrameContext.Provider value={portraitFrame}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, surfaceMotion]} testID="presentation-surface">
        <PageSurface hue={deck.hue} fullBleed />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, screen]}>
      <PanView style={StyleSheet.absoluteFill} {...back} pointerEvents={setupOpen ? 'none' : 'auto'}
        accessibilityElementsHidden={setupOpen || controlsBlocked} importantForAccessibility={setupOpen || controlsBlocked ? 'no-hide-descendants' : 'auto'}>
        <Animated.View pointerEvents={controlsBlocked ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, chromeMotion]}>
          <Pressable accessibilityRole="button" accessibilityLabel={ui("Edit presentation time and audience")}
            accessibilityHint={ui("Open presentation time and audience settings")}
            accessibilityState={{ disabled: !active || phase !== 'idle' }} disabled={!active || phase !== 'idle'}
            onPress={openSetup} style={[styles.headerControl, styles.editRequirements]} hitSlop={8}>
            <UIIcon name="i-sliders" size={24} color={c.text} />
          </Pressable>
          {/* OpenAI Codex, 2026-11-21: refresh links an unmapped PDF and checks cues; initial analysis may start, while failed provider retries stay in Cues. */}
          <Pressable accessibilityRole="button" accessibilityLabel={ui("Refresh with server")}
            accessibilityHint={ui("Reconnect this PDF and check its AI cues. First-time analysis may start; retry failed analysis from Cues.")}
            accessibilityState={{ disabled: !active || phase !== 'idle' || refreshDisabled, busy: serverRefreshing }}
            disabled={!active || phase !== 'idle' || refreshDisabled}
            onPress={() => { void Haptics.selectionAsync().catch(() => undefined); setRefreshAsk(true); }}
            style={({ pressed }) => [styles.headerControl, styles.refreshControl, { opacity: pressed ? 0.5 : 1 }]} hitSlop={8}>
            <Animated.View style={refreshIconMotion}>
              <UIIcon name="i-loop" size={23} color={serverRefreshing ? c.muted2 : c.text} />
            </Animated.View>
          </Pressable>
          <Animated.View pointerEvents="box-none" style={[styles.counterWrap, { left: 65, width: 260, height: 32 }, counterMotion]}>
            <Pressable accessibilityRole="button" accessibilityLabel={ui("Toggle feedback during presentation")}
              accessibilityHint={ui(preferIncremental ? 'Live feedback selected. Switch to feedback after Stop.' : 'Feedback after Stop selected. Switch to live feedback.')}
              disabled={phase !== 'idle'} onPress={() => setPreferIncremental(v => !v)} hitSlop={8}
              style={[StyleSheet.absoluteFill, styles.counterCenter]}>
              <Txt style={styles.counter}>{`Slide ${cur + 1} of ${n}${phase === 'idle' ? preferIncremental ? ' · Live feedback' : ' · After Stop' : ''}`}</Txt>
            </Pressable>
          </Animated.View>
          <TickStrip n={n} cur={cur} disabled={freezesSlideNavigation(phase)} onPick={i => goSlide(i, 'jump')} />
          <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, bottomMotion]}>
            <Readout live={live} phase={phase} cur={cur} take={take} deck={deck} burst={burst} error={error} />
          </Animated.View>
          <RoundButton glyph="h-landscape" active={pdfRotated}
            label="Open full-screen landscape player" caption="Rotate" onPress={() => rotate()} style={{ left: 49 }} />
          <View pointerEvents="box-none" style={[styles.rightControlLayer, portraitFrame.compact && { top: 621 }]}>
            <RoundButton glyph="h-review-bars" label={recording && liveCapture ? 'Feedback so far' : state.compare ? 'Compare takes' : 'Review overall feedback'} caption={recording && liveCapture ? 'Feedback' : state.compare ? 'Compare' : 'Review'}
              disabled={recording ? !liveCapture : !run || phase !== 'idle'}
              onPress={() => recording && liveCapture ? setShowLiveFeedback(true) : run && (state.compare ? openReview(state.takes,cur,true,'rise') : openOverallReview(cur))}
              style={{ left: 0, top: 0 }} />
          </View>
          <RecordRing progress={ringP} visible={ringV} style={styles.recordSpacing} />
          <RecordButton glyph={glyph} label={btnLabel} onPress={toggleRec} onPressIn={recDown} onPressOut={recUp}
            style={styles.recordSpacing}
            accessibilityActions={anyTake ? [{ name: 'redoAllSlides', label: ui('Redo all slides') }] : undefined}
            onAccessibilityAction={event => {
              if (event.nativeEvent.actionName !== 'redoAllSlides' || !anyTake || phaseRef.current !== 'idle' || redoAsk) return;
              player.stop();
              setRedoAsk('all');
            }}
            disabled={phase === 'starting' || phase === 'stopping'} />
        </Animated.View>
        <SlideTrack model={model} slide={cur} trackX={trackX} onSlide={goSlide}
          previousLocked={locksPreviousSlide(phase)} isPreviousLocked={isPreviousLocked}
          navigationFrozen={freezesSlideNavigation(phase)} isNavigationFrozen={isNavigationFrozen}
          rotated={false} rotating={false} rotation={pdfRotation}
          opening={controlsBlocked} closingToHome={closingToHome} cardProgress={cardProgress} progressToHome={progressToHome}
          rotationFade={rotating && !portraitLanding ? rotationProgress : undefined} hidePreview={!!portraitLanding} />
        {openingFromHome && openingControls && <Animated.View pointerEvents="none" accessible={false}
          testID="presentation-launch-icon" style={[styles.launchIcon, { left: (FRAME_W - iconSize) / 2, top: HOME_ICON_BOTTOM - iconSize }, iconEntrance]}>
          <PresentationIcon icon={deck.icon} hue={deck.hue} size={iconSize} />
        </Animated.View>}
        <Animated.View pointerEvents="none" testID="presentation-title" style={[styles.header, titleMotion]}>
          <Txt verbatim numberOfLines={1} style={styles.deckTitle}>{deck.title}</Txt>
        </Animated.View>
        <Animated.View pointerEvents={controlsBlocked ? 'none' : 'box-none'} style={[StyleSheet.absoluteFill, chromeMotion]}>
          <CueGuidancePanel key={cueCloseRequest} state={displayProfiles} slide={cur} error={profiles.error} busy={profiles.busy || profiles.syncing} requesting={profiles.busy}
            onSheetOpenChange={setCueSheetOpen}
            connectionMessage={cueConnectionMessage}
            onRecover={action => {
              if (action === 'refresh') profiles.refresh();
              else if (action === 'confirm') setCueRetryAsk(profiles.value);
              else void profiles.recover();
            }} />
        </Animated.View>
      </PanView>
      {setupOpen && <Animated.View style={[StyleSheet.absoluteFill,setupMotion]}><PageSurface hue={deck.hue} /><PresentationRequirementsEditor deck={deck} active={active}
        fixedHint onHintVisibilityChange={setSetupHintVisible}
        onReviewSavedRecording={recoveryAttempt ? () => { setSetupOpen(false); setRecoveryId(recoveryAttempt.id); } : undefined}
        onSaved={() => setSetupOpen(false)} onBackPan={{ onMoveShould: (_e, g) => g.dy > 12 && g.dy > Math.abs(g.dx), onMove:(_e,g)=>setupDy.set(Math.max(0,Math.min(BACK_FADE_Y,g.dy/frame.s))),onRelease: (_e, g) => { if (g.dy > BACK_T) closeSetup();else setupDy.set(withTiming(0,{duration:360,easing:EASE_SCREEN})); },onTerminate:()=>setupDy.set(withTiming(0,{duration:360,easing:EASE_SCREEN})) }} /></Animated.View>}
      {redoAsk && <Dialog title={redoAsk==='all'?'Redo all slides?':`Redo slide ${cur+1}?`}
        body={redoAsk==='all'?'Your current take stays, so you can compare and keep either one.':'Your old take stays, so you can compare.'}
        confirm={redoAsk==='all'?'Redo all':`Redo slide ${cur+1}`} onConfirm={confirmRedo} onCancel={cancelRedo} />}
      {cueRetryAsk && <Dialog title="Retry AI cues?" body="The previous provider request has an uncertain outcome. Retrying may incur another charge."
        confirm="Retry" onConfirm={() => { const captured = cueRetryAsk; setCueRetryAsk(null); void profiles.recover(true, captured); }} onCancel={() => setCueRetryAsk(null)} />}
      {refreshAsk && <Dialog title="Refresh with server?" body="Reconnect this presentation and check its latest AI cues. If this PDF is not linked yet, it may be uploaded for analysis."
        confirm="Refresh" icon="i-loop" tone="neutral" onConfirm={() => { setRefreshAsk(false); if (phaseRef.current === 'idle' && !refreshDisabled) profiles.refresh(); }} onCancel={() => setRefreshAsk(false)} />}
      {phase === 'burst' && <Confetti />}
      {recoveryId && <TakePlayback id={recoveryId} deck={deck} initialSlide={cur}
        onClose={closeRecovery} onRecovered={recovered} />}
      {active&&setupOpen&&setupHintVisible&&<PresentationSetupHint />}
      {footer.visible&&(!pdfRotated||portraitLanding)&&!setupOpen&&!redoAsk&&!cueRetryAsk&&!refreshAsk&&!recoveryId&&!showLiveFeedback&&!cueSheetOpen&&
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, active ? bottomMotion : footer.style]}>
          <HintRow hints={hints} />
        </Animated.View>}
      </Animated.View>
      </FrameContext.Provider>
    </Animated.View>}
    {rotating && rotation && <RotatingSlide rotation={rotation} model={model} progress={rotationProgress} />}
    </View>
  </>;
}

function RotatingSlide({ rotation, model, progress }: { rotation: Rotation; model: DeckModel; progress: SharedValue<number> }) {
  const { pose, slide } = rotation;
  const { from, dx, dy, angle, scaleX, scaleY } = pose;
  const page = model.deck.pages[slide];
  const preview = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value / 0.1),
    transform: [
      { translateX: dx * progress.value },
      { translateY: dy * progress.value },
      { rotate: `${angle * progress.value}deg` },
      { scaleX: 1 + (scaleX - 1) * progress.value },
      { scaleY: 1 + (scaleY - 1) * progress.value },
    ],
  }));
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    testID="rotation-preview" style={[{ position: 'absolute', ...from }, preview]}>
      {page ? <Image source={{ uri: page.uri }} resizeMode="contain" fadeDuration={0} style={StyleSheet.absoluteFill} />
        : <MiniSlide hue={model.deck.hue} title={model.deck.slides[slide]?.title ?? ''} width={from.width} height={from.height} radius={6} />}
  </Animated.View>;
}

// Updated PDF and slide limits by OpenAI Codex, Iteration 2 (2026-10-14).
// ── Slide carousel (render nearby slides on the track) ────────────────────
const SlideTrack = memo(function SlideTrack({ model, slide, trackX, onSlide, previousLocked, isPreviousLocked, navigationFrozen, isNavigationFrozen, rotated, rotating, rotation, opening, closingToHome, cardProgress, progressToHome, rotationFade, hidePreview }: {
  model: DeckModel; slide: number; trackX: SharedValue<number>; onSlide: (i: number, mode: 'jump' | 'animate' | 'keep') => void;
  previousLocked: boolean; isPreviousLocked: () => boolean;
  navigationFrozen: boolean; isNavigationFrozen: () => boolean;
  rotated: boolean; rotating: boolean; rotation: SharedValue<number>;
  opening: boolean; closingToHome: SharedValue<boolean>;
  cardProgress: Readonly<Pick<SharedValue<number>, 'value'>>;
  progressToHome: Readonly<Pick<SharedValue<number>, 'value'>>;
  rotationFade?: SharedValue<number>;
  hidePreview: boolean;
}) {
  const ui = useUiText();
  const { deck, n } = model;
  const { c } = useTheme();
  const step = CARD_STEP;
  const frame = useFrame();
  const cardHeight = frame.compact ? 170 : CARD_H;
  const stageCenter = SLIDE_STAGE_TOP + SLIDE_STAGE_HEIGHT / 2;
  const cardCenter = SLIDE_STAGE_TOP + SLIDE_TOP + cardHeight / 2;
  const homeIconCenter = HOME_ICON_BOTTOM - deckIconSize(frame.compact) / 2;
  const initialScale = 0.25;
  const homeOffset = homeIconCenter - (stageCenter + (cardCenter - stageCenter) * initialScale);
  const cardMotion = useAnimatedStyle(() => {
    const progress = cardProgress.value;
    return {
      opacity: hidePreview ? 0 : Math.max(0, Math.min(1, progress / 0.62, (0.88 - progressToHome.value) / 0.22, 1 - (rotationFade?.value ?? 0) / 0.1)),
      transform: [{ translateY: homeOffset * (1 - progress) }, { scale: initialScale + (1 - initialScale) * progress }],
    };
  });
  const arrowMotion = useAnimatedStyle(() => {
    const toHome = progressToHome.value;
    const progress = toHome > 0 ? 1 : cardProgress.value;
    return {
      opacity: Math.max(0, Math.min(1, progress / 0.62, 1 - toHome / CHROME_RETURN_FRACTION, 1 - (rotationFade?.value ?? 0) / 0.1)),
      transform: [{ translateY: homeOffset * (1 - progress) }, { scale: initialScale + (1 - initialScale) * progress }],
    };
  });
  const g = useRef<{ base: number; x: number; lastT: number; vel: number; caught: boolean } | null>(null);
  const touchStartedDuringOpening = useRef(false);
  useEffect(() => { g.current = null; }, [rotated]);
  const responder: PanHandlers = {
    // In the enlarged view the slide itself turns; the phone and controls stay upright.
    disabled: rotating || navigationFrozen,
    onStartShouldCapture: (_e, gs) => {
      if (gs.numberActiveTouches === 1) touchStartedDuringOpening.current = opening || closingToHome.get();
      return false;
    },
    onStartShould: () =>
      !opening && !touchStartedDuringOpening.current && Math.abs(trackX.get() + slide * step) > 1,
    onMoveShould: (_e, gs) =>
      !opening && !touchStartedDuringOpening.current && (rotated
        ? Math.abs(gs.dy) > 5 && Math.abs(gs.dy) >= Math.abs(gs.dx)
        : Math.abs(gs.dx) > 5 && Math.abs(gs.dx) >= Math.abs(gs.dy)),
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
    <Animated.View testID="presentation-slide-track" style={[StyleSheet.absoluteFill, cardMotion]} pointerEvents={opening ? 'none' : 'box-none'}>
      <Animated.View style={[styles.slidePosition, frame.compact && { height: cardHeight }, slidePosition]} pointerEvents="box-none">
        <PanView style={[styles.slideZoom, frame.compact && { height: cardHeight }, slideRotation]} {...responder}
          accessible accessibilityRole="adjustable" accessibilityLabel={ui(`Slide ${slide + 1} of ${n}: ${deck.slides[slide]?.title ?? ''}`)}
          accessibilityActions={navigationFrozen ? [] : previousLocked ? [{ name: 'increment' }] : [{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => { if (rotating || isNavigationFrozen()) return; if (e.nativeEvent.actionName === 'increment') next(); else if (!isPreviousLocked()) prev(); }}>
          <Animated.View style={[styles.track, frame.compact && { height: cardHeight }, track]}>
            {Array.from({ length: Math.min(n - 1, slide + 2) - Math.max(0, slide - 2) + 1 }, (_, offset) => Math.max(0, slide - 2) + offset).map(i => (
              <View key={i} style={[styles.cardSlot, frame.compact && { height: cardHeight }, { left: i * step }]}>
                <SlideCard hue={deck.hue} page={deck.pages[i]} deckTitle={deck.title} title={deck.slides[i]?.title ?? ui('Slide ' + (i + 1))}
                  points={deck.slides[i]?.points ?? []} num={i + 1} foldL={false} foldR={false} shadow={!rotated && !deck.pages[i]} />
              </View>
            ))}
          </Animated.View>
        </PanView>
      </Animated.View>
    </Animated.View>
    <Animated.View testID="presentation-slide-arrows" style={[StyleSheet.absoluteFill, arrowMotion]} pointerEvents={opening ? 'none' : 'box-none'}>
      {!rotating && !navigationFrozen && !previousLocked && rotated && slide > 0 && <Pressable accessibilityRole="button" accessibilityLabel={ui(`Previous slide, ${slide}: ${deck.slides[slide - 1]?.title ?? ''}`)}
        onPress={prev} style={[styles.rotatedCorner, { top: 0 }]} />}
      {!rotating && !navigationFrozen && rotated && slide < n - 1 && <Pressable accessibilityRole="button" accessibilityLabel={ui(`Next slide, ${slide + 2}: ${deck.slides[slide + 1]?.title ?? ''}`)}
        onPress={next} style={[styles.rotatedCorner, { bottom: 0 }]} />}
      {/* OpenAI Codex, 2026-11-21: visible side arrows replace the folded-corner tap zones in portrait preview. */}
      {!rotated && <>
        <Pressable accessibilityRole="button" accessibilityLabel={ui(slide===0?'Previous slide':`Previous slide, ${slide}: ${deck.slides[slide - 1]?.title ?? ''}`)}
          disabled={rotating || navigationFrozen || previousLocked || slide === 0} onPress={prev}
          style={[styles.previewArrow, { left: 4, top: 16 + cardHeight / 2 - 24, opacity: slide === 0 || previousLocked ? 0.4 : 1 }]}>
          <PreviewChevron left color={c.text} outline={c.bg} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={ui(slide===n-1?'Next slide':`Next slide, ${slide + 2}: ${deck.slides[slide + 1]?.title ?? ''}`)}
          disabled={rotating || navigationFrozen || slide === n - 1} onPress={next}
          style={[styles.previewArrow, { right: 4, top: 16 + cardHeight / 2 - 24, opacity: slide === n - 1 ? 0.4 : 1 }]}>
          <PreviewChevron color={c.text} outline={c.bg} />
        </Pressable>
      </>}
    </Animated.View>
    </View>
  );
});

function PreviewChevron({ left = false, color, outline }: { left?: boolean; color: string; outline: string }) {
  const d = left ? 'M14.5 5.5 L8 12 L14.5 18.5' : 'M9.5 5.5 L16 12 L9.5 18.5';
  return <Svg width={30} height={30} viewBox="0 0 24 24">
    <Path d={d} fill="none" stroke={outline} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

function TickStrip({ n, cur, disabled, onPick }: { n: number; cur: number; disabled: boolean; onPick: (i: number) => void }) {
  const ui = useUiText();
  const { c } = useTheme();
  const frame = useFrame();
  const pickAt = (e: GestureResponderEvent) => {
    const x = (e.nativeEvent.pageX - frame.left) / frame.s - 16;
    onPick(Math.max(0, Math.min(n - 1, Math.floor((x / 358) * n))));
  };
  const gesture = useRef<'tap' | 'scrub' | 'vertical'>('tap');
  const responder: PanHandlers = {
    onStartShould: () => true,
    onGrant: () => { gesture.current = 'tap'; },
    onMove: (e, g) => {
      const dx = Math.abs(g.dx), dy = Math.abs(g.dy);
      if (gesture.current === 'tap' && Math.max(dx, dy) > 5) {
        gesture.current = dx >= dy ? 'scrub' : 'vertical';
      }
      if (gesture.current === 'scrub') pickAt(e);
    },
    onRelease: e => { if (gesture.current === 'tap') pickAt(e); },
    onTerminationRequest: () => gesture.current !== 'scrub',
  };
  const ticks = Math.min(n, 48);
  const active = Math.floor((cur * ticks) / n);
  return (
    <PanView style={[styles.strip, frame.compact && { top: 286 }]} {...responder} disabled={disabled}>
      {Array.from({ length: ticks }, (_, i) => (
        <View key={i} accessible accessibilityRole="button" accessibilityLabel={ui('Go near slide ' + (Math.floor((i * n) / ticks) + 1))}
          style={{ flex: 1, height: i === active ? 12 : 6, borderRadius: 3, backgroundColor: i === active ? c.strong : i < active ? c.ink55 : c.ink16 }} />
      ))}
    </PanView>
  );
}

// ── Timer, slide time, pace chip and waveform (re-render ~10×/s while recording) ──
function Readout({ live, phase, cur, take, deck, burst, error }: {
  live: LiveStore; phase: Phase; cur: number; take: boolean; deck: DeckModel['deck']; burst: { total: number } | null; error: string;
}) {
  const { c } = useTheme();
  const frame = useFrame();
  const L = useSyncExternalStore(live.subscribe, live.get);
  const recording = phase === 'recording' || phase === 'stopping';
  const target = deck.targets[cur] ?? 0;
  if (recording) {
    const onSlide = L.E - L.slideStart;
    const pace = paceChip(L.E, cur, L.recStart, deck.targets);
    return <>
      <View style={[styles.paceWrap, frame.compact && { top: 466 }]} pointerEvents="none"><Chip chip={pace} size={14} /></View>
      <Txt style={[styles.big, frame.compact && { top: 490 }, { color: c.text }]}>{fmt(L.E)}</Txt>
      <Txt style={[styles.line, frame.compact && { top: 546 }, { color: onSlide > target ? c.coralText : c.secondary }]}>{'Slide ' + (cur + 1) + ' · ' + fmt(onSlide) + ' of ' + fmt(target)}</Txt>
      <Waveform bars={L.wave} live smooth />
    </>;
  }
  const line = error ? error : phase === 'count' ? 'Get ready…' : phase === 'starting' ? 'Starting recorder…' : phase === 'burst' ? 'Run complete'
    : take ? 'Redo slide ' + (cur + 1) : cur === 0 ? 'Full run · target ' + fmt(deck.target) : 'Record slide ' + (cur + 1);
  return <>
    <Txt style={[styles.big, frame.compact && { top: 490 }, { color: phase === 'burst' ? c.text : c.strong }]}>{phase === 'burst' && burst ? fmt(burst.total) : '0:00'}</Txt>
    <Txt numberOfLines={2} style={[styles.line, frame.compact && { top: 546 }, { color: error ? c.bad : c.secondary }]}>{line}</Txt>
    <Waveform bars={IDLE_WAVE} live={false} />
  </>;
}

const styles = createThemedStyles({
  settledPortrait: { ...StyleSheet.absoluteFill, opacity: 1 },
  redoScrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  redoSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 328, paddingTop: 12, paddingHorizontal: 24, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, alignItems: 'stretch' },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.muted2, marginBottom: 22 },
  redoTitle: { fontFamily: F.display, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  redoBody: { marginTop: 8, fontFamily: F.medium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  redoConfirm: { minHeight: 52, marginTop: 22, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  redoCancel: { minHeight: 48, marginTop: 8, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  redoButtonText: { fontFamily: F.semibold, fontSize: 14 },
  redoHint: { marginTop: 7, fontFamily: F.medium, fontSize: 13.5, textAlign: 'center' },
  loading: { position: 'absolute', top: 400, left: 0, right: 0, textAlign: 'center', fontFamily: F.medium, fontSize: 14, color: C.secondary },
  header: { position: 'absolute', left: 64, right: 64, top: HEADER_TOP, alignItems: 'center' },
  deckTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  launchIcon: { position: 'absolute' },
  counterWrap: { position: 'absolute', left: 120, top: 75, width: 150, height: 18, alignItems: 'center', justifyContent: 'center' },
  counterCenter: { alignItems: 'center', justifyContent: 'center' },
  counter: { fontFamily: F.medium, fontSize: 13.5, color: C.secondary },
  // OpenAI Codex, 2026-11-24: match the Home header controls' vertical position.
  headerControl: { position: 'absolute', ...HOME_HEADER_CONTROL, alignItems: 'center', justifyContent: 'center' },
  editRequirements: { left: 16, zIndex: 20 },
  refreshControl: { right: 16 },
  slideStage: { position: 'absolute', left: 0, top: SLIDE_STAGE_TOP, width: FRAME_W, height: SLIDE_STAGE_HEIGHT, overflow: 'hidden' },
  slidePosition: { position: 'absolute', left: 16, top: SLIDE_TOP, width: CARD_W, height: CARD_H },
  slideZoom: { width: CARD_W, height: CARD_H, overflow: 'hidden' },
  rotatedStatus: { position: 'absolute', left: 20, right: 20, top: 622, textAlign: 'center',
    fontFamily: F.semibold, fontSize: 13.5 },
  rightControlLayer: { position: 'absolute', top: 690, left: 289, width: 52, height: 90 },
  // OpenAI Codex, 2026-11-23: give the waveform room while keeping the ring centered on the button.
  recordSpacing: { transform: [{ translateY: 8 }] },
  rotatedTimerWrap: { position: 'absolute', top: 0, left: 0, width: 52, alignItems: 'center', gap: 6 },
  rotatedTimerFace: { width: 52, height: 52, borderRadius: 26, borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)', backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center', justifyContent: 'center' },
  rotatedTimerText: { fontFamily: F.bold, fontSize: 13.5, fontVariant: ['tabular-nums'], color: C.text,
    transform: [{ rotate: '90deg' }] },
  track: { position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H },
  cardSlot: { position: 'absolute', top: 0, width: CARD_W, height: CARD_H },
  previewArrow: { position: 'absolute', width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  rotatedCorner: { position: 'absolute', left: 55, width: 76, height: 76 },
  strip: { position: 'absolute', left: 16, right: 16, top: 330, height: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  paceWrap: { position: 'absolute', left: 0, right: 0, top: 512, alignItems: 'center' },
  big: { position: 'absolute', left: 0, right: 0, top: 536, textAlign: 'center', fontFamily: F.display, fontSize: 52, lineHeight: 56, letterSpacing: -1.3, fontVariant: ['tabular-nums'] },
  line: { position: 'absolute', left: 30, right: 30, top: 592, textAlign: 'center', fontFamily: F.semibold, fontSize: 14.5, lineHeight: 19 },
});
