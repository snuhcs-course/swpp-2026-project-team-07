import { IncrementalCaptureHost } from '../features/recording/IncrementalCaptureHost';
import { SelectedPreparationHost } from '../features/localization/SelectedPreparationHost';
// Scribe migration: OpenAI Codex, Iteration 2 (2026-10-16); see active collaboration log.
// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode ambient: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-081
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OpenAI Codex follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-047
// OutLoud redesign: one stage for every screen, as in the design prototype.
// The ambient glow and the Home carousel persist across screens so Upload can blur
// the carousel behind it.
// OpenAI Codex immediate navigation: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-111
// OpenAI Codex landscape follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-053
// OpenAI Codex portrait-only correction: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-080
// OpenAI Codex faster presentation exit: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-112
// OpenAI Codex continuous Home glow and responsive navigation: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-114
// OpenAI Codex stationary forward page fades: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-120
// OpenAI Codex Full review routing: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-122
// OpenAI Codex stable import hue: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-123
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Frame, Txt } from '../design/frame';
import { STORE_MODE } from '../services/apiConfig';
import { dismissBudgetNotice, getBudgetNotice, subscribeBudget } from '../services/storeBudget';
import { useTheme } from '../design/theme';
import { Dialog, GlowLayer } from '../design/ui';
import { carouselGlowWeight } from '../domain/gestures';
import { uploadGlowReturn } from './homeGeometry';
import type { HueName } from '../domain/hues';
import { runAttemptIds } from '../domain/run';
import { AnalysisHost, stageOf, usePlaybackIds, useWorkers } from '../features/rehearsal/analysis';
import { DefaultRequirementsHost } from '../features/presentations/DefaultRequirementsHost';
import { InitialQaHost } from '../features/qa/InitialQaHost';
import { InitialFeedbackHost } from '../features/feedback/InitialFeedbackHost';
// Claude Code, prompted by Seoyeon (2026-11-15): starts feedback v3 right after transcription.
import { FeedbackV3Host } from '../features/feedback/FeedbackV3Host';
import { InitialPresentationScoreHost } from '../features/feedback/InitialPresentationScoreHost';
import { CoachHost, useCoaches } from '../features/rehearsal/coaching';
import { getDeckState, loadPresentations, nextHue, useStore, visibleDecks } from '../features/presentations/store';
import { HomeScreen } from './HomeScreen';
import { UploadScreen } from './UploadScreen';
import { RehearseScreen } from './RehearseScreen';
import { ReviewScreen } from './ReviewScreen';
import { ListenBackKaraokeScreen } from './ListenBackKaraokeScreen';
import { OverviewScreen } from './OverviewScreen';
import { CompareScreen } from './CompareScreen';
import { QAScreen } from './QAScreen';
import { WaitScreen } from './WaitScreen';
import { FeedbackScreen } from './FeedbackScreen';
import { HomeContext, ShellContext, type Go, type HomeShared, type NavState } from './shared';

export function AppShell() {
  useTheme();
  const [frontDeck, setFrontDeck] = useState<string | null>(null);
  const [stack, setStack] = useState<{ layers: NavState[]; epoch: number }>({
    layers: [{ screen: 'home', nav: null, deckId: null, slide: 0, sel: 0, from: null, visit: 0 }],
    epoch: 0,
  });
  const { layers, epoch } = stack;
  const stackRef = useRef(stack);
  const visitRef = useRef(0);
  const [retiredRehearse, setRetiredRehearse] = useState<NavState | null>(null);
  const [fullscreenLandscape, setFullscreenLandscape] = useState(false);
  const [uploadLook, setUploadLook] = useState<{ hue: HueName; order: number } | null>(null);
  const [readingPdf, setReadingPdf] = useState(false);
  const p = useSharedValue(0), vy = useSharedValue(0), gap = useSharedValue(0), hold = useSharedValue(0);
  const uploadBlur = useSharedValue(0), analyzing = useSharedValue(0), setup = useSharedValue(0);
  const uploadReturn = useSharedValue(0);
  const press = useSharedValue(1), picker = useSharedValue(0);
  const titleReturn = useSharedValue(1);
  const footerExit = useSharedValue({ epoch: -1, progress: 0 });
  const home = useMemo<HomeShared>(() => ({
    p, vy, gap, hold, uploadBlur, uploadReturn, analyzing, setup, press, picker, titleReturn,
  }), [p, vy, gap, hold, uploadBlur, uploadReturn, analyzing, setup, press, picker, titleReturn]);
  const go: Go = useCallback((screen, patch) => {
    const { layers: previous, epoch: previousEpoch } = stackRef.current;
    const top = previous[previous.length - 1];
    if (screen === 'home') titleReturn.set(1);
    else if (screen === 'rehearse' || top.screen === 'rehearse') titleReturn.set(0);
    if (screen === 'upload' && top.screen !== 'upload') {
      setUploadLook({ hue: nextHue(), order: visibleDecks().length + 1 });
      setReadingPdf(false);
    }
    if (top.screen === 'rehearse' && screen === 'home') setRetiredRehearse(top);
    else setRetiredRehearse(null);
    const existing = previous.findLastIndex(layer => layer.screen === screen &&
      (screen === 'home' || layer.deckId === (patch?.deckId ?? top.deckId)));
    let next: NavState[];
    if (existing >= 0) {
      // Returning reveals the mounted page underneath, including its local state.
      next = [...previous.slice(0, existing), { ...previous[existing], ...patch, screen, nav: null,
        swipeFrom: screen === 'review' ? patch?.swipeFrom : undefined }];
    } else {
      // A newly pushed page fades over its mounted underlay; returning to an existing page does not re-enter.
      const layer: NavState = { ...top, ...patch, screen, nav: 'fade', from: patch?.from ?? null,
        swipeFrom: screen === 'review' ? patch?.swipeFrom : undefined, visit: ++visitRef.current };
      // Import setup and resolved comparison must not sit behind their next page.
      next = (top.screen === 'upload' && screen === 'rehearse') || (top.screen === 'compare' && screen === 'review')
        ? [...previous.slice(0, -1), layer] : [...previous, layer];
    }
    if (screen === 'review' && patch?.sel !== undefined) {
      next = next.map(layer => layer.screen === 'rehearse' ? { ...layer, slide: patch.sel! } : layer);
    }
    // Keep the visible footer's progress until React commits this navigation.
    const updated = { layers: next, epoch: previousEpoch + 1 };
    stackRef.current = updated;
    setStack(updated);
  }, [titleReturn]);
  useEffect(() => {
    void loadPresentations();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void loadPresentations(); });
    return () => sub.remove();
  }, []);
  const nav = layers[layers.length - 1];
  const ctx = useMemo(() => ({ go, nav, home, setFullscreenLandscape }), [go, nav, home]);
  const homeCtx = useMemo(() => ({ go, home }), [go, home]);
  const s = nav.screen;
  useEffect(() => {
    if (s !== 'upload') uploadReturn.set(0);
  }, [s, uploadReturn]);
  useEffect(()=>{
    // Rehearsal chooses portrait or explicit landscape fullscreen itself. Keep
    // the shell from silently unlocking sensor-driven rotation underneath it.
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(()=>undefined);
  },[s]);
  useEffect(() => {
    if (s !== 'home' || !retiredRehearse) return;
    // Keep the moved PDF tree hidden until Home has painted, then release it.
    let nextFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => setRetiredRehearse(null));
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(nextFrame); };
  }, [s, retiredRehearse]);
  // In explicit landscape fullscreen the Home carousel must not show through
  // the safe-area gutters around Frame's scaled landscape canvas.
  // OpenAI Codex, 2026-11-19: Wait and Full Review fade down to Home, not through a stale intermediate page.
  const fullOverRehearse = s === 'full' && nav.from === 'rehearse';
  const fullOverHome = s === 'full' && !fullOverRehearse;
  const homeVisible = (layers.length <= 2 || s === 'wait' || fullOverHome) && !(s === 'rehearse' && fullscreenLandscape);
  const homeMode = s === 'home' || s === 'upload' || (s === 'rehearse' && homeVisible) ? s : 'covered';
  // Keep the carousel ready for the back swipe without drawing through the resting presentation.
  const homeReveal = useAnimatedStyle(() => ({ opacity: homeMode === 'rehearse' && titleReturn.value <= 0 ? 0 : 1 }));
  const ambientMode = fullOverHome ? 'home' : homeMode;
  const background = ambientMode === 'covered' ? null : <Ambient screen={ambientMode} home={home} uploadHue={uploadLook?.hue ?? null} />;
  const visibleLayers = layers.slice(1);
  const entryUnderlay = s === 'wait' || fullOverHome ? null : layers.at(-2) ?? null;
  // Slide Review and Overall Review can return directly to the selected presentation.
  const underlay = s === 'review' || fullOverRehearse
    ? visibleLayers.findLast(layer => layer.screen === 'rehearse' && layer.deckId === nav.deckId) ?? null
    : entryUnderlay;
  // Keep the opening page in the crossfade, then expose the actual return destination on drag.
  const entryArtwork = useAnimatedStyle(() => {
    const exit = footerExit.value;
    return { opacity: exit.epoch === epoch && exit.progress > 0 ? 0 : 1 };
  });
  const footerHandoff = { exit: footerExit, epoch, underlay };
  const renderedLayers = retiredRehearse && !visibleLayers.some(layer => layer.visit === retiredRehearse.visit)
    ? [...visibleLayers, retiredRehearse] : visibleLayers;
  return (
    <ShellContext.Provider value={ctx}>
      <HomeContext.Provider value={homeCtx}>
      <SelectedPreparationHost deckId={s === 'home' ? frontDeck : s === 'upload' ? null : nav.deckId} />
      <Frame background={background} landscape={s === 'rehearse' && fullscreenLandscape}>
        <Animated.View style={[homeVisible ? styles.page : styles.hiddenPage, homeReveal]}>
          <HomeScreen mode={homeMode} showCoveredChrome={fullOverHome} uploadLook={uploadLook}
            readingPdf={s === 'upload' && readingPdf} onFrontDeckChange={setFrontDeck} />
        </Animated.View>
        {renderedLayers.map(layer => {
          const active = layer.visit === nav.visit;
          const retired = s === 'home' && layer.visit === retiredRehearse?.visit;
          const entryOnly = layer.visit === entryUnderlay?.visit && layer.visit !== underlay?.visit;
          const visible = active || entryOnly || layer.visit === underlay?.visit;
          return <Animated.View key={layer.visit} style={visible && !retired ? [styles.page, !active && layer.screen === 'rehearse' && styles.clippedUnderlay, entryOnly && entryArtwork] : styles.hiddenPage} pointerEvents={active ? 'auto' : 'none'}
            accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
            <ShellContext.Provider value={{ go, nav: layer, home, footerHandoff, setFullscreenLandscape }}>
              <LayerScreen screen={layer.screen} active={active} uploadLook={uploadLook} onReadingPdf={setReadingPdf} />
            </ShellContext.Provider>
          </Animated.View>;
        })}
        <Prompts />
        {STORE_MODE && <BudgetNotice />}
      </Frame>
      <Workers />
      <IncrementalCaptureHost />
      <CoachHost />
      <DefaultRequirementsHost />
      <InitialFeedbackHost />
      <FeedbackV3Host />
      <InitialPresentationScoreHost openedDeckId={['rehearse','review','wait','full','listen','feedback'].includes(s)?nav.deckId:null} />
      <InitialQaHost />
      </HomeContext.Provider>
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFill },
  clippedUnderlay: { overflow: 'hidden' },
  hiddenPage: { ...StyleSheet.absoluteFill, display: 'none' },
  budgetNotice: { position: 'absolute', bottom: 60, left: 20, right: 20, zIndex: 120, padding: 16, borderWidth: 1, borderRadius: 14 },
  dismissNotice: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 12 },
});

function BudgetNotice() {
  const notice = useSyncExternalStore(subscribeBudget, getBudgetNotice);
  const { c } = useTheme();
  if (!notice) return null;
  return <View style={[styles.budgetNotice, { backgroundColor: c.bg, borderColor: c.track }]}>
    <Txt accessibilityRole="alert" style={{ color: c.text }}>{notice}</Txt>
    <Pressable accessibilityRole="button" onPress={dismissBudgetNotice} style={styles.dismissNotice}><Txt style={{ color: c.strong }}>OK</Txt></Pressable>
  </View>;
}

function LayerScreen({ screen, active, uploadLook, onReadingPdf }: {
  screen: NavState['screen']; active: boolean; uploadLook: { hue: HueName; order: number } | null; onReadingPdf: (value: boolean) => void;
}) {
  if (screen === 'upload') return <UploadScreen hue={uploadLook?.hue} empty={uploadLook?.order === 1} onReadingPdf={onReadingPdf} />;
  if (screen === 'rehearse') return <RehearseScreen active={active} />;
  if (screen === 'review') return <ReviewScreen active={active} />;
  if (screen === 'wait') return <WaitScreen active={active} />;
  if (screen === 'full') return <OverviewScreen active={active} />;
  if (screen === 'listen') return <ListenBackKaraokeScreen active={active} />;
  if (screen === 'feedback') return <FeedbackScreen active={active} />;
  if (screen === 'compare') return <CompareScreen />;
  if (screen === 'qa') return <QAScreen active={active} />;
  return null;
}

/** Takes that still need upload or transcription, for every presentation (runs and pending compares). */
function Workers() {
  const version = useStore(s => s.version);
  const playbackIds = usePlaybackIds();
  const ids = useMemo(() => {
    void version;
    const out: string[] = [...playbackIds];
    for (const deck of visibleDecks()) {
      const st = getDeckState(deck.id);
      out.push(...runAttemptIds(st.run));
      if (st.compare) out.push(...runAttemptIds(st.compare.next), ...runAttemptIds(st.compare.prev));
    }
    return [...new Set(out)].filter(id => !['done', 'no_speech', 'missing'].includes(stageOf(id)));
  }, [version, playbackIds]);
  return <AnalysisHost ids={ids} />;
}

/** First-use disclosures and charge acknowledgements raised by background work. */
function Prompts() {
  const workers = useWorkers();
  const coaches = useCoaches();
  const analysis = [...workers.values()].find(w => w.prompt);
  const coach = [...coaches.values()].find(c => c.prompt);
  if (analysis) {
    const disclosure = analysis.prompt === 'disclosure';
    const continueAll = () => {
      // One OK covers every take waiting for the same first-use disclosure.
      if (disclosure) { for (const w of workers.values()) if (w.prompt === 'disclosure') w.continuePrompt?.(); }
      else analysis.continuePrompt?.();
    };
    return (
      <Dialog icon="i-mic" tone="neutral" title={disclosure ? 'Transcribe with ElevenLabs?' : 'Retry may charge again'}
        body={disclosure
          ? 'Transcription sends your saved audio and vocabulary hints extracted from the recorded slides through your OutLoud server to ElevenLabs for Scribe v2 transcription. Audio and results stay available on this phone. Continue to allow automatic transcription after future recordings, or Cancel.'
          : 'The previous transcription request may already have been charged. Retrying may send the audio again and incur another charge. There is no guarantee of exactly one provider request.'}
        confirm="Continue" onConfirm={continueAll} onCancel={() => analysis.cancelPrompt?.()} />
    );
  }
  if (coach?.prompt) {
    const p = coach.prompt;
    return (
      <Dialog icon="i-chart" tone="neutral" title={p.kind === 'disclosure' ? 'AI suggestions from ' + p.provider + '?' : 'Request again?'}
        body={p.kind === 'disclosure'
          ? `AI suggestions send slide images and text, slide descriptions, this take's transcript and audience context through your OutLoud server to ${p.provider} (${p.model}). No audio is sent. Requests may incur provider charges.`
          : 'A previous request may already have been charged. Another request may incur another charge. Continue only if you accept this.'}
        confirm="Continue" onConfirm={() => coach.continuePrompt?.()} onCancel={() => coach.cancelPrompt?.()} />
    );
  }
  return null;
}

/** Ambient hue glow follows the Home carousel continuously. */
function Ambient({ screen, home, uploadHue }: { screen: 'home' | 'upload' | 'rehearse'; home: HomeShared; uploadHue: HueName | null }) {
  const snapshot = useStore(s => s);
  const hues = useMemo(() => visibleDecks(snapshot).map(deck => deck.hue), [snapshot]);
  const distinctHues = useMemo(() => [...new Set(hues)], [hues]);
  const fresh = screen === 'upload' && uploadHue ? uploadHue : nextHue();
  // The glow extends outside the scaled rehearsal canvas, so it needs its own matching fade.
  const reveal = useAnimatedStyle(() => ({ opacity: screen === 'rehearse' ? home.titleReturn.value : 1 }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, reveal]}>
      {distinctHues.map(hue => <DeckGlow key={hue} hue={hue} hues={hues} uploading={screen === 'upload'} home={home} />)}
      <NewGlow hue={fresh} uploading={screen === 'upload'} home={home} empty={!hues.length} />
    </Animated.View>
  );
}
function DeckGlow({ hue, hues, uploading, home }: { hue: HueName; hues: readonly HueName[]; uploading: boolean; home: HomeShared }) {
  const style = useAnimatedStyle(() => {
    const weight = carouselGlowWeight(hues, hue, home.p.value, uploading);
    if (uploading) {
      // The pull already revealed the Add glow. Blend back only when leaving Upload.
      const t = uploadGlowReturn(home.uploadReturn.value);
      return { opacity: weight * t };
    }
    const pull = home.vy.value < 0 ? Math.min(1, -home.vy.value / 90) : 0;
    const hs = Math.max(pull, home.gap.value);
    return { opacity: weight * (1 - hs) };
  });
  return <GlowLayer hue={hue} style={style} />;
}
function NewGlow({ hue, uploading, home, empty }: { hue: HueName; uploading: boolean; home: HomeShared; empty: boolean }) {
  const style = useAnimatedStyle(() => {
    if (empty) return { opacity: 1 };
    if (uploading) return { opacity: 1 - uploadGlowReturn(home.uploadReturn.value) };
    const pull = home.vy.value < 0 ? Math.min(1, -home.vy.value / 90) : 0;
    return { opacity: Math.max(pull, home.gap.value) };
  });
  return <GlowLayer hue={hue} style={style} />;
}
