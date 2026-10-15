// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OutLoud redesign: one stage for every screen, as in the design prototype.
// The ambient glow and the Home carousel persist across screens, so transitions never flash
// black and Upload can blur the carousel behind it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Frame } from '../design/frame';
import { Dialog, GlowLayer } from '../design/ui';
import { mod } from '../domain/format';
import type { HueName } from '../domain/hues';
import { runAttemptIds } from '../domain/run';
import { AnalysisHost, stageOf, usePlaybackIds, useWorkers } from '../features/rehearsal/analysis';
import { InitialFeedbackHost } from '../features/feedback/InitialFeedbackHost';
import { CoachHost, useCoaches } from '../features/rehearsal/coaching';
import { deckById, getDeckState, loadPresentations, nextHue, useStore, visibleDecks } from '../features/presentations/store';
import { HomeScreen } from './HomeScreen';
import { UploadScreen } from './UploadScreen';
import { RehearseScreen } from './RehearseScreen';
import { ReviewScreen } from './ReviewScreen';
import { CompareScreen } from './CompareScreen';
import { QAScreen } from './QAScreen';
import { ShellContext, type Go, type HomeShared, type NavState } from './shared';

export function AppShell() {
  const [nav, setNav] = useState<NavState>({ screen: 'home', nav: 'fade', deckId: null, slide: 0, sel: 0 });
  const home: HomeShared = {
    p: useSharedValue(0), vy: useSharedValue(0), gap: useSharedValue(0), hold: useSharedValue(0),
    uploadBlur: useSharedValue(0), analyzing: useSharedValue(0), press: useSharedValue(1), picker: useSharedValue(0),
  };
  const go: Go = useCallback((screen, patch) => {
    setNav(prev => ({ ...prev, ...patch, screen, nav: patch?.nav === undefined ? 'fade' : patch.nav }));
  }, []);
  useEffect(() => {
    void loadPresentations();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void loadPresentations(); });
    return () => sub.remove();
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctx = useMemo(() => ({ go, nav, home }), [go, nav]);
  const s = nav.screen;
  return (
    <ShellContext.Provider value={ctx}>
      <Frame background={<Ambient screen={s} deckId={nav.deckId} home={home} />}>
        {(s === 'home' || s === 'upload') && <HomeScreen mode={s} />}
        {s === 'upload' && <UploadScreen />}
        {s === 'rehearse' && <RehearseScreen key={'r' + nav.deckId} />}
        {s === 'review' && <ReviewScreen />}
        {s === 'compare' && <CompareScreen />}
        {s === 'qa' && <QAScreen />}
        <Prompts />
      </Frame>
      <Workers />
      <CoachHost />
      <InitialFeedbackHost />
    </ShellContext.Provider>
  );
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

/** Ambient hue glow (SPEC §2): cross-fades with the carousel and stays behind every screen. */
function Ambient({ screen, deckId, home }: { screen: NavState['screen']; deckId: string | null; home: HomeShared }) {
  const decks = useStore(s => visibleDecks(s));
  const n = decks.length;
  const fresh = nextHue();
  const current = deckById(deckId);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {decks.map((d, i) => <DeckGlow key={d.id} hue={d.hue} i={i} n={n} screen={screen} isCurrent={current?.id === d.id} home={home} />)}
      {!decks.some(d => d.hue === fresh) && <NewGlow hue={fresh} screen={screen} home={home} empty={!n} />}
    </View>
  );
}
function DeckGlow({ hue, i, n, screen, isCurrent, home }: { hue: HueName; i: number; n: number; screen: NavState['screen']; isCurrent: boolean; home: HomeShared }) {
  const style = useAnimatedStyle(() => {
    if (screen === 'home' || screen === 'upload') {
      const dd = mod(i - home.p.value + n / 2, n) - n / 2, a = Math.abs(dd);
      if (screen === 'upload') {
        const t = Math.min(1, ((1 - home.uploadBlur.value) * 260) / 220);
        const front = a < 0.5;
        return { opacity: front ? t : 0 };
      }
      const pull = home.vy.value < 0 ? Math.min(1, -home.vy.value / 90) : 0;
      const hs = Math.max(pull, home.gap.value);
      if (a >= 1) return { opacity: 0 };
      const k = 1 - a;
      return { opacity: k * k * (3 - 2 * k) * (1 - hs) };
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
