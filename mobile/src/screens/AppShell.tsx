// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode ambient: docs/ai-collaboration-prompts-iteration-2.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OutLoud redesign: one stage for every screen, as in the design prototype.
// The ambient glow and the Home carousel persist across screens so Upload can blur
// the carousel behind it.
// OpenAI Codex immediate navigation: docs/ai-collaboration-prompts-iteration-2.md#remove-page-transitions-and-reduce-home-lag-october-15-2026
// OpenAI Codex landscape follow-up: docs/ai-collaboration-prompts-iteration-2.md#landscape-rehearsal-implementation-october-15-2026
// OpenAI Codex portrait-only correction: docs/ai-collaboration-prompts-iteration-2.md#portrait-only-pdf-rotation-correction-october-15-2026
// OpenAI Codex faster presentation exit: docs/ai-collaboration-prompts-iteration-2.md#presentation-to-home-pause-october-15-2026
// OpenAI Codex continuous Home glow and responsive navigation: docs/ai-collaboration-prompts-iteration-2.md#continuous-carousel-color-and-navigation-responsiveness-october-15-2026
// OpenAI Codex stationary forward page fades: docs/ai-collaboration-prompts-iteration-2.md#stationary-forward-page-fades-october-15-2026
// OpenAI Codex Full review routing: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// OpenAI Codex stable import hue: docs/ai-collaboration-prompts-iteration-2.md#stable-presentation-import-colour-october-15-2026
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Enter, Frame } from '../design/frame';
import { useTheme } from '../design/theme';
import { Dialog, GlowLayer } from '../design/ui';
import { mod } from '../domain/format';
import type { HueName } from '../domain/hues';
import { runAttemptIds } from '../domain/run';
import { AnalysisHost, stageOf, usePlaybackIds, useWorkers } from '../features/rehearsal/analysis';
import { DefaultRequirementsHost } from '../features/presentations/DefaultRequirementsHost';
import { InitialQaHost } from '../features/qa/InitialQaHost';
import { InitialFeedbackHost } from '../features/feedback/InitialFeedbackHost';
import { CoachHost, useCoaches } from '../features/rehearsal/coaching';
import { deckById, getDeckState, loadPresentations, nextHue, useStore, visibleDecks } from '../features/presentations/store';
import { HomeScreen } from './HomeScreen';
import { UploadScreen } from './UploadScreen';
import { RehearseScreen } from './RehearseScreen';
import { ReviewScreen } from './ReviewScreen';
import { FullReviewScreen } from './FullReviewScreen';
import { CompareScreen } from './CompareScreen';
import { QAScreen } from './QAScreen';
import { HomeContext, ShellContext, type Go, type HomeShared, type NavState } from './shared';

export function AppShell() {
  useTheme();
  const [layers, setLayers] = useState<NavState[]>([{ screen: 'home', nav: null, deckId: null, slide: 0, sel: 0, from: null, visit: 0 }]);
  const layersRef = useRef(layers);
  const visitRef = useRef(0);
  const [retiredRehearse, setRetiredRehearse] = useState<NavState | null>(null);
  const [uploadLook, setUploadLook] = useState<{ hue: HueName; order: number } | null>(null);
  const p = useSharedValue(0), vy = useSharedValue(0), gap = useSharedValue(0), hold = useSharedValue(0);
  const uploadBlur = useSharedValue(0), analyzing = useSharedValue(0), setup = useSharedValue(0);
  const press = useSharedValue(1), picker = useSharedValue(0);
  const home = useMemo<HomeShared>(() => ({
    p, vy, gap, hold, uploadBlur, analyzing, setup, press, picker,
  }), [p, vy, gap, hold, uploadBlur, analyzing, setup, press, picker]);
  const go: Go = useCallback((screen, patch) => {
    const previous = layersRef.current;
    const top = previous[previous.length - 1];
    if (screen === 'upload' && top.screen !== 'upload') {
      setUploadLook({ hue: nextHue(), order: visibleDecks().length + 1 });
    }
    if (top.screen === 'rehearse' && screen === 'home') setRetiredRehearse(top);
    else setRetiredRehearse(null);
    const existing = previous.findLastIndex(layer => layer.screen === screen &&
      (screen === 'home' || layer.deckId === (patch?.deckId ?? top.deckId)));
    let next: NavState[];
    if (existing >= 0) {
      // Returning reveals the mounted page underneath, including its local state.
      next = [...previous.slice(0, existing), { ...previous[existing], ...patch, screen, nav: null }];
    } else {
      // A newly pushed page fades over its mounted underlay; returning to an existing page does not re-enter.
      const layer: NavState = { ...top, ...patch, screen, nav: 'fade', from: patch?.from ?? null, visit: ++visitRef.current };
      // Import setup is finished; its temporary layer should not sit behind Rehearse.
      next = top.screen === 'upload' && screen === 'rehearse'
        ? [...previous.slice(0, -1), layer] : [...previous, layer];
    }
    if (screen === 'review' && patch?.sel !== undefined) {
      next = next.map(layer => layer.screen === 'rehearse' ? { ...layer, slide: patch.sel! } : layer);
    }
    layersRef.current = next;
    setLayers(next);
  }, []);
  useEffect(() => {
    void loadPresentations();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void loadPresentations(); });
    return () => sub.remove();
  }, []);
  const nav = layers[layers.length - 1];
  const ctx = useMemo(() => ({ go, nav, home }), [go, nav, home]);
  const homeCtx = useMemo(() => ({ go, home }), [go, home]);
  const s = nav.screen;
  useEffect(() => {
    if (s !== 'home' || !retiredRehearse) return;
    // Keep the moved PDF tree hidden until Home has painted, then release it.
    let nextFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => setRetiredRehearse(null));
    });
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(nextFrame); };
  }, [s, retiredRehearse]);
  const homeMode = s === 'home' ? 'home' : s === 'upload' ? 'upload' : 'covered';
  const homeVisible = layers.length <= 2;
  const visibleLayers = layers.slice(1);
  const underlayVisit = layers.length > 1 ? layers[layers.length - 2].visit : null;
  const renderedLayers = retiredRehearse && !visibleLayers.some(layer => layer.visit === retiredRehearse.visit)
    ? [...visibleLayers, retiredRehearse] : visibleLayers;
  return (
    <ShellContext.Provider value={ctx}>
      <HomeContext.Provider value={homeCtx}>
      <Frame background={homeVisible ? <Ambient screen={s} deckId={nav.deckId} home={home} uploadHue={uploadLook?.hue ?? null} /> : null}>
        <Enter kind={null} style={homeVisible ? undefined : styles.hiddenPage}>
          <HomeScreen mode={homeMode} uploadLook={uploadLook} />
        </Enter>
        {renderedLayers.map(layer => {
          const active = layer.visit === nav.visit;
          const retired = s === 'home' && layer.visit === retiredRehearse?.visit;
          const visible = active || layer.visit === underlayVisit;
          return <View key={layer.visit} style={visible && !retired ? styles.page : styles.hiddenPage} pointerEvents={active ? 'auto' : 'none'}
            accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
            <ShellContext.Provider value={{ go, nav: layer, home }}>
              <LayerScreen screen={layer.screen} active={active} />
            </ShellContext.Provider>
          </View>;
        })}
        <Prompts />
      </Frame>
      <Workers />
      <CoachHost />
      <DefaultRequirementsHost />
      <InitialFeedbackHost />
      <InitialQaHost />
      </HomeContext.Provider>
    </ShellContext.Provider>
  );
}

const styles = StyleSheet.create({
  page: { ...StyleSheet.absoluteFill },
  hiddenPage: { ...StyleSheet.absoluteFill, display: 'none' },
});

function LayerScreen({ screen, active }: { screen: NavState['screen']; active: boolean }) {
  if (screen === 'upload') return <UploadScreen />;
  if (screen === 'rehearse') return <RehearseScreen active={active} />;
  if (screen === 'review') return <ReviewScreen active={active} />;
  if (screen === 'full') return <FullReviewScreen active={active} />;
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
      <Dialog icon="i-mic" tone="neutral" title={disclosure ? 'Transcribe with OpenAI?' : 'Retry may charge again'}
        body={disclosure
          ? 'Transcription sends your saved audio through your OutLoud server to OpenAI for hosted Whisper transcription. Audio and results stay available on this phone. Continue to allow automatic transcription after future recordings, or Cancel.'
          : 'The previous OpenAI request may already have been charged. Retrying may send the audio again and incur another charge. There is no guarantee of exactly one provider request.'}
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
function Ambient({ screen, deckId, home, uploadHue }: { screen: NavState['screen']; deckId: string | null; home: HomeShared; uploadHue: HueName | null }) {
  const decks = useStore(s => visibleDecks(s));
  const n = decks.length;
  const fresh = screen === 'upload' && uploadHue ? uploadHue : nextHue();
  const current = deckById(deckId);
  const hueSlots = new Map<HueName, number[]>();
  decks.forEach((deck, index) => {
    const slots = hueSlots.get(deck.hue) ?? [];
    slots.push(index);
    hueSlots.set(deck.hue, slots);
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[...hueSlots].map(([hue, indices]) => <DeckGlow key={hue} hue={hue} indices={indices} n={n} screen={screen} isCurrent={current?.hue === hue} home={home} />)}
      {(screen === 'upload' || !decks.some(d => d.hue === fresh)) && <NewGlow hue={fresh} screen={screen} home={home} empty={!n} />}
    </View>
  );
}
function DeckGlow({ hue, indices, n, screen, isCurrent, home }: { hue: HueName; indices: number[]; n: number; screen: NavState['screen']; isCurrent: boolean; home: HomeShared }) {
  const style = useAnimatedStyle(() => {
    if (screen === 'home' || screen === 'upload') {
      if (screen === 'upload') {
        const t = Math.min(1, ((1 - home.uploadBlur.value) * 260) / 220);
        let front = false;
        for (const i of indices) {
          if (Math.abs(mod(i - home.p.value + n / 2, n) - n / 2) < 0.5) { front = true; break; }
        }
        return { opacity: front ? t : 0 };
      }
      const pull = home.vy.value < 0 ? Math.min(1, -home.vy.value / 90) : 0;
      const hs = Math.max(pull, home.gap.value);
      let weight = 0;
      for (const i of indices) {
        const a = Math.abs(mod(i - home.p.value + n / 2, n) - n / 2);
        if (a < 1) {
          const k = 1 - a;
          weight += k * k * (3 - 2 * k);
        }
      }
      return { opacity: Math.min(1, weight) * (1 - hs) };
    }
    return { opacity: isCurrent ? 1 : 0 };
  });
  return <GlowLayer hue={hue} style={style} />;
}
function NewGlow({ hue, screen, home, empty }: { hue: HueName; screen: NavState['screen']; home: HomeShared; empty: boolean }) {
  const style = useAnimatedStyle(() => {
    if (screen === 'upload') return { opacity: 1 - Math.min(1, ((1 - home.uploadBlur.value) * 260) / 220) };
    if (screen !== 'home') return { opacity: 0 };
    const pull = home.vy.value < 0 ? Math.min(1, -home.vy.value / 90) : 0;
    return { opacity: empty ? 1 : Math.max(pull, home.gap.value) };
  });
  return <GlowLayer hue={hue} style={style} />;
}
