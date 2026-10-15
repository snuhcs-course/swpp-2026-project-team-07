// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#transcript-header-playback-october-14-2026
// OutLoud redesign: Rehearse (SPEC §4.4) with transcript corrections (§5.4).
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph } from '../design/icons';
import { PanView, type PanHandlers } from '../design/PanView';
import { CARD_H, CARD_W, SlideCard } from '../design/SlideCard';
import { C, EASE_SCREEN, EASE_SNAP, F, HUES } from '../design/tokens';
import { Chip, Confetti, Dialog, HintRow, IDLE_WAVE, RecordButton, RecordRing, RoundButton, Waveform, type Hint, type RecordGlyph } from '../design/ui';
import { paceChip } from '../domain/analysis';
import { fmt } from '../domain/format';
import { BACK_T, CARD_STEP, decideRelease } from '../domain/gestures';
import { playbackPieces, visitHeading, type Line } from '../domain/lines';
import { runAttemptIds, takeVisits } from '../domain/run';
import { type ProfileState } from '../features/presentations/slideProfiles';
import { CueGuidancePanel } from '../features/presentations/CueGuidancePanel';
import { useSlideProfiles } from '../features/presentations/useSlideProfiles';
import { CaptureEngine, type CaptureHandle } from '../features/rehearsal/CaptureEngine';
import { audioOf, useWorkers, type Stage } from '../features/rehearsal/analysis';
import { commitTake } from '../features/rehearsal/takes';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { ensurePages, ensureSlideText } from '../features/presentations/importer';
import { bump, getDeckState, updateDeckState, useStore, visibleDecks } from '../features/presentations/store';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { savedAttempts, type SavedAttempt } from '../features/recording/storage';
import { API_URL } from '../services/api';
import { createCorrectionClient, restoreCorrections } from '../features/presentations/correctionStore';
import { useTranscriptCorrections } from '../features/presentations/useTranscriptCorrections';
import { acceptSuggestedCorrection, suggestionActive } from '../features/presentations/transcriptSuggestions';
import { TakePlayback } from './TakePlayback';
import { useBack, useShell } from './shared';

type Phase = 'idle' | 'count' | 'starting' | 'recording' | 'stopping' | 'burst';
const SPEECH_DB = -38;

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

export function RehearseScreen() {
  const { go, nav } = useShell();
  const model = useDeckModel(nav.deckId);
  useEffect(() => {
    if (!nav.deckId) return;
    // A pending redo requires an explicit keep-or-overwrite decision.
    if (getDeckState(nav.deckId).compare) {
      go('compare', { nav: 'fade', deckId: nav.deckId });
      return;
    }
    void ensurePages(nav.deckId).catch(() => undefined);
    void ensureSlideText(nav.deckId);
  }, [go, nav.deckId]);
  if (!model || !model.n) return <Enter kind={nav.nav}><Txt style={styles.loading}>{model ? 'Preparing slides…' : ''}</Txt></Enter>;
  return <Rehearse model={model} />;
}

function Rehearse({ model }: { model: DeckModel }) {
  const { go, nav, home } = useShell();
  const frame = useFrame();
  const { deck, n, lines, state } = model;
  const run = state.run;
  const [slide, setSlideState] = useState(() => Math.max(0, Math.min(n - 1, nav.slide)));
  const slideRef = useRef(slide);
  const [phase, setPhaseState] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const [count, setCount] = useState(3);
  const [redoAsk, setRedoAsk] = useState<false | 'slide' | 'all'>(false);
  const [cues, setCues] = useState(false);
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
  const [live] = useState(createLive);
  const [alt, setAlt] = useState<{ key: string; fi: number } | null>(null);
  const [fixNote, setFixNote] = useState<string | null>(null);
  const ringP = useSharedValue(0), ringV = useSharedValue(0);
  const trackX = useSharedValue(-slide * CARD_STEP);
  const backDy = useSharedValue(0);
  const gone = useSharedValue(0);
  const player = useSegmentPlayer();
  const hue = HUES[deck.hue];
  const storeVersion = useStore(s => s.version);
  const selectedAttempt = run?.parts[slide]?.attemptId ?? null;
  const corrections = useTranscriptCorrections(selectedAttempt, model);
  const profiles = useSlideProfiles(deck.id, n);
  const [cueRetryAsk, setCueRetryAsk] = useState<ProfileState | null>(null);
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
    if (mode === 'animate') {
      const ms = Math.round(Math.max(170, Math.min(300, 150 + Math.abs(-to * CARD_STEP - trackX.get()) * 0.36)));
      trackX.set(withTiming(-to * CARD_STEP, { duration: ms, easing: EASE_SNAP }));
    } else if (mode === 'jump') { cancelAnimation(trackX); trackX.set(-to * CARD_STEP); }
    if (to === slideRef.current) return;
    player.stop();
    if (phaseRef.current === 'recording') {
      engine.current?.slideChanged(to);
      live.set({ ...live.get(), slideStart: live.get().E });
    }
    slideRef.current = to;
    setSlideState(to);
    setAlt(null);
  }, [live, n, player, trackX]);

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
      setCues(false);
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
      setEngineKey(k => k + 1);
      setTimeout(() => {
        if (compare) go('compare', { nav: 'rise', deckId: deck.id });
        else go('review', { nav: 'rise', deckId: deck.id, sel: next.sel });
      }, 1500);
    } catch (e) {
      fullRedo.current = false;
      hideRing();
      setError(e instanceof Error ? e.message : 'The recording could not be saved.');
      bump();
      setEngineKey(k => k + 1);
      setPhase('idle');
    }
  }, [deck, go, live, model.stats?.coverage]); // eslint-disable-line react-hooks/exhaustive-deps

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
    ringP.set(withTiming(1, { duration: 600, easing: Easing.linear }));
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      longFired.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      player.stop();
      hideRing();
      setRedoAsk('all');
    }, 600);
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

  // ── Transcript corrections ────────────────────────────────────────────────
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const note = (text: string) => {
    setFixNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setFixNote(null), 2600);
  };
  const applyAlt = (line: Line, fi: number, value: string) => {
    const f = line.flags[fi];
    if (!lines.some(l => l.key === line.key && l.text === line.text)) { setAlt(null); note('Transcript changed. Select the word again.'); return; }
    if (!f?.range || !f.alts.includes(value)) return;
    try {
      acceptSuggestedCorrection(API_URL, line.audio.attemptId, f.range.first, f.range.last, value, model.transcripts.get(line.audio.attemptId)!);
      player.stop(); setAlt(null); note('Correction saved · feedback may be outdated');
      void createCorrectionClient(API_URL).synchronize(line.audio.attemptId).then(() => corrections.clearSyncError(line.audio.attemptId)).catch(() => note('Saved on phone · sync pending'));
    } catch (e) { setAlt(null); note((e as Error).message); }
  };
  const restoreLine = (line: Line) => {
    if (!line.source) return;
    try {
      restoreCorrections(API_URL, line.audio.attemptId, line.source.first, line.source.last, model.transcripts.get(line.audio.attemptId)!);
      player.stop(); setAlt(null); note('Original transcript restored');
      void createCorrectionClient(API_URL).synchronize(line.audio.attemptId).then(() => corrections.clearSyncError(line.audio.attemptId)).catch(() => note('Restored on phone · sync pending'));
    } catch (e) { note((e as Error).message); }
  };
  const keepFlag = (line: Line, fi: number) => {
    const w = line.flags[fi]?.dismissal ?? line.flags[fi]?.w;
    if (!w) return;
    updateDeckState(deck.id, s => ({ ...s, edits: { ...s.edits, [line.key]: { ...s.edits[line.key], dismissed: [...(s.edits[line.key]?.dismissed || []), w] } } }));
    setAlt(null);
  };
  const moveLine = (line: Line, dir: -1 | 1) => {
    const target = line.slide + dir;
    if (target < 0 || target >= n) return;
    player.stop();
    const origin = line.from ?? line.slide;
    updateDeckState(deck.id, s => {
      const e = { ...s.edits[line.key] };
      if (target === origin) delete e.slide; else e.slide = target;
      return { ...s, fixes: s.fixes + 1, edits: { ...s.edits, [line.key]: e } };
    });
    setAlt(null);
    note('Moved to slide ' + (target + 1));
  };
  const playLine = (line: Line) => {
    if (phaseRef.current !== 'idle') return;
    const uri = audioOf(line.audio.attemptId);
    if (!uri) { note('Audio for this take isn’t on this phone'); return; }
    void player.play(line.key, { uri, startMs: line.audio.startMs, endMs: line.audio.endMs });
  };
  const playSlide = () => {
    if (phaseRef.current !== 'idle') return;
    const part = run?.parts[slideRef.current];
    if (!part) return;
    const uri = audioOf(part.attemptId);
    if (!uri) { note('Audio for this slide isn’t on this phone'); return; }
    void player.playSegments(`slide:${deck.id}:${slideRef.current}`, part.segments.map(segment => ({ uri, ...segment })));
  };

  // ── Back (swipe down / system Back) ───────────────────────────────────────
  const canGoBack = phase === 'idle' && !redoAsk && !recoveryId;
  const leave = useCallback(() => {
    gone.set(1);
    backDy.set(withTiming(520, { duration: 280 }));
    player.stop();
    setTimeout(() => {
      const index = visibleDecks().findIndex(d => d.id === deck.id);
      const count = visibleDecks().length;
      if (index >= 0 && count) home.p.set(Math.round((home.p.get() - index) / count) * count + index);
      go('home', { nav: 'fade' });
    }, 280);
  }, [backDy, deck.id, gone, go, home.p, player]);
  const inExcluded = (e: GestureResponderEvent) => {
    const y = (e.nativeEvent.pageY - frame.top) / frame.s;
    return (y > 326 && y < 512) || y > 652;
  };
  const back: PanHandlers = {
    onMoveShould: (e, g) => canGoBack && g.dy > 8 && g.dy > Math.abs(g.dx) && !inExcluded(e),
    onMove: (_e, g) => { const d = Math.max(0, g.dy / frame.s); backDy.set(d > 160 ? 160 + (d - 160) * 0.5 : d); },
    onRelease: () => { if (backDy.get() > BACK_T) leave(); else backDy.set(withTiming(0, { duration: 320, easing: EASE_SCREEN })); },
    onTerminate: () => { backDy.set(withTiming(0, { duration: 320, easing: EASE_SCREEN })); },
  };
  useBack(true, () => {
    if (recoveryId) { closeRecovery(); return true; }
    if (redoAsk) { cancelRedo(); return true; }
    if (phaseRef.current !== 'idle') return true;
    leave(); return true;
  });
  const screen = useAnimatedStyle(() => ({ opacity: gone.value ? withTiming(0, { duration: 280 }) : Math.max(0.15, 1 - backDy.value / 260), transform: [{ translateY: backDy.value * 0.55 }] }));

  // ── View model ────────────────────────────────────────────────────────────
  const cur = slide;
  const claimed = useSyncExternalStore(live.subscribe, () => !!live.get().spoken[cur]);
  const take = !recording && hasTake(cur);
  const slideLines = lines.filter(l => l.slide === cur);
  const glyph: RecordGlyph = phase === 'count' ? (count as 3 | 2 | 1) : recording ? 'stop' : take ? 'redo' : 'mic';
  const btnLabel = phase === 'count' ? `Starting in ${count}. Tap to cancel` : recording ? 'Stop recording'
    : (take ? 'Redo slide ' + (cur + 1) : 'Record slide ' + (cur + 1)) + (anyTake ? '. Hold to redo the whole presentation' : '');
  const hints: Hint[] = phase === 'count' ? [{ icon: 'h-tap', text: 'Tap to cancel' }]
    : recording ? [{ icon: 'h-tap', text: 'Tap to stop' }, { icon: 'h-spin', text: 'Swipe slides' }]
      : phase === 'burst' ? [{ icon: 'h-tap', text: burst?.compare ? 'Comparing takes' : 'Opening review' }]
        : [take ? { icon: 'h-hold', text: 'Hold to redo all' } : { icon: 'h-tap', text: 'Tap to record' }, { icon: 'h-dn', text: 'Swipe down to go back', nudge: 'down' }];
  const partId = run?.parts[cur]?.attemptId;
  const stage: Stage | null = partId ? model.stages.get(partId) ?? null : null;
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
    if (compare) go('compare', { nav: 'fade', deckId: deck.id });
    else go('review', { nav: 'fade', deckId: deck.id, sel: next.sel });
  };

  return (
    <Enter kind={nav.nav}>
      <CaptureEngine key={engineKey} ref={engine} deck={deck} onMeter={onMeter}
        onInterrupted={m => { setError(m); bump(); }} onMustStop={() => { void stopRec(); }} />
      <PanView style={StyleSheet.absoluteFill} {...back}>
        <Animated.View style={[StyleSheet.absoluteFill, screen]}>
          <View style={styles.header} pointerEvents="none">
            <Txt numberOfLines={1} style={styles.deckTitle}>{deck.title}</Txt>
            <Txt style={styles.counter}>{'Slide ' + (cur + 1) + ' of ' + n}</Txt>
          </View>
          <SlideTrack model={model} slide={cur} trackX={trackX} onSlide={goSlide} />
          <TickStrip n={n} cur={cur} onPick={i => goSlide(i, 'jump')} />
          {!cues ? (
            <TranscriptPanel cur={cur} lines={slideLines} recording={recording} claimed={recording && claimed} stage={stage} partId={partId ?? null}
              accent={hue.accent} n={n} playingKey={player.playingKey} progress={player.progress} positionMs={player.positionMs} playbackUri={player.uri} playbackError={player.error} alt={alt} fixNote={fixNote}
              canPlayback={phase === 'idle'} slidePlaying={player.playingKey === `slide:${deck.id}:${cur}` && !player.paused} onPlaySlide={playSlide}
              onPlay={playLine} onAlt={(l, fi) => { player.stop(); setAlt(a => (a && a.key === l.key && a.fi === fi ? null : { key: l.key, fi })); }}
              onApplyAlt={applyAlt} onKeepFlag={keepFlag} onMove={moveLine} hasRun={!!run} corrections={corrections}
              onRestore={restoreLine} />
          ) : (
            <CueGuidancePanel state={profiles.value} slide={cur} error={profiles.error} busy={profiles.busy}
              onRecover={action => {
                if (action === 'refresh') profiles.refresh();
                else if (action === 'confirm') setCueRetryAsk(profiles.value);
                else void profiles.recover();
              }} />
          )}
          <Readout live={live} phase={phase} cur={cur} take={take} deck={deck} burst={burst} error={error}
            recoveryCount={recoveryAttempts.length} recoveryNumber={recoveryAttempts.length ? recoveryCursor % recoveryAttempts.length + 1 : 0}
            onRecovery={() => recoveryAttempt && setRecoveryId(recoveryAttempt.id)} />
          <RoundButton icon="i-bulb" label="Speaker cues" caption="Cues" active={cues} onPress={() => setCues(c => !c)} style={{ left: 49 }} />
          <RoundButton icon="i-chart" label="Open last review" caption="Review" disabled={!run || recording || phase === 'count'}
            onPress={() => run && go('review', { nav: 'rise', deckId: deck.id, sel: run.sel })} style={{ left: 289 }} />
          <RecordRing progress={ringP} visible={ringV} />
          <RecordButton glyph={glyph} label={btnLabel} onPress={toggleRec} onPressIn={recDown} onPressOut={recUp} disabled={phase === 'starting' || phase === 'stopping'} />
          <HintRow hints={hints} />
        </Animated.View>
      </PanView>
      {redoAsk && (
        <Dialog title={redoAsk === 'all' ? 'Redo the whole presentation?' : 'Redo slide ' + (cur + 1) + '?'}
          body={redoAsk === 'all' ? 'Recording starts again from slide 1. When you stop, you can compare it with your current run and keep either one.'
            : 'Your recording and transcript for slide ' + (cur + 1) + ' will be replaced. You can compare the takes and keep the old one.'}
          confirm={redoAsk === 'all' ? 'Redo all' : 'Redo'} onConfirm={confirmRedo} onCancel={cancelRedo} />
      )}
      {cueRetryAsk && <Dialog title="Retry AI cues?" body="The previous provider request has an uncertain outcome. Retrying may incur another charge."
        confirm="Retry" onConfirm={() => { const captured = cueRetryAsk; setCueRetryAsk(null); void profiles.recover(true, captured); }} onCancel={() => setCueRetryAsk(null)} />}
      {corrections.ask && <Dialog title="Retry transcription suggestions?" body="The previous request has an uncertain outcome. Retrying may incur another charge."
        confirm="Retry" onConfirm={corrections.confirm} onCancel={corrections.cancel} />}
      {phase === 'burst' && <Confetti />}
      {recoveryId && <TakePlayback id={recoveryId} deck={deck} initialSlide={cur}
        onClose={closeRecovery} onRecovered={recovered} />}
    </Enter>
  );
}

// Updated PDF and slide limits by OpenAI Codex, Iteration 2 (2026-10-14).
// ── Slide carousel (render nearby slides on the track) ────────────────────
const SlideTrack = memo(function SlideTrack({ model, slide, trackX, onSlide }: {
  model: DeckModel; slide: number; trackX: SharedValue<number>; onSlide: (i: number, mode: 'jump' | 'animate' | 'keep') => void;
}) {
  const { deck, n } = model;
  const frame = useFrame();
  const g = useRef<{ base: number; x: number; lastT: number; vel: number; caught: boolean } | null>(null);
  const responder: PanHandlers = {
    // Catch a card that is still settling; otherwise claim only horizontal drags.
    onStartShould: () => Math.abs(trackX.get() + slide * CARD_STEP) > 1,
    onMoveShould: (_e, gs) => Math.abs(gs.dx) > 5 && Math.abs(gs.dx) >= Math.abs(gs.dy),
    onGrant: () => {
      cancelAnimation(trackX);
      const base = trackX.get() + slide * CARD_STEP;
      g.current = { base, x: base, lastT: Date.now(), vel: 0, caught: Math.abs(base) > 1 };
    },
    onMove: (_e, gs) => {
      const s = g.current;
      if (!s) return;
      const raw = s.base + gs.dx / frame.s;
      const edge = (raw > 0 && slide === 0) || (raw < 0 && slide === n - 1);
      s.x = edge ? raw * 0.32 : raw;
      s.vel = gs.vx / frame.s; s.lastT = Date.now();
      trackX.set(-slide * CARD_STEP + s.x);
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
    const { dir, ms } = decideRelease({ x: s.x, base: s.base, vel, step: CARD_STEP, slide, n });
    const to = slide + dir;
    trackX.set(withTiming(-to * CARD_STEP, { duration: ms, easing: EASE_SNAP }));
    // The counter, tick strip and transcript switch on release, not when the card lands.
    if (dir) onSlide(to, 'keep');
  }
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: trackX.value }] }));
  const prev = () => onSlide(slide - 1, 'animate'), next = () => onSlide(slide + 1, 'animate');
  return (
    <PanView style={styles.trackBox} {...responder}
      accessible accessibilityRole="adjustable" accessibilityLabel={`Slide ${slide + 1} of ${n}: ${deck.slides[slide]?.title ?? ''}`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => (e.nativeEvent.actionName === 'increment' ? next() : prev())}>
      <Animated.View style={[styles.track, track]}>
        {Array.from({ length: Math.min(n - 1, slide + 2) - Math.max(0, slide - 2) + 1 }, (_, offset) => Math.max(0, slide - 2) + offset).map(i => (
          <View key={i} style={[styles.cardSlot, { left: i * CARD_STEP }]}>
            <SlideCard hue={deck.hue} page={deck.pages[i]} deckTitle={deck.title} title={deck.slides[i]?.title ?? 'Slide ' + (i + 1)}
              points={deck.slides[i]?.points ?? []} num={i + 1} foldL={i > 0} foldR={i < n - 1} />
          </View>
        ))}
      </Animated.View>
      {slide > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Previous slide, ${slide}: ${deck.slides[slide - 1]?.title ?? ''}`} onPress={prev} style={[styles.corner, { left: 0 }]} />}
      {slide < n - 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Next slide, ${slide + 2}: ${deck.slides[slide + 1]?.title ?? ''}`} onPress={next} style={[styles.corner, { right: 0 }]} />}
    </PanView>
  );
});

function TickStrip({ n, cur, onPick }: { n: number; cur: number; onPick: (i: number) => void }) {
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
    <PanView style={styles.strip} {...responder}>
      {Array.from({ length: ticks }, (_, i) => (
        <View key={i} accessible accessibilityRole="button" accessibilityLabel={'Go near slide ' + (Math.floor((i * n) / ticks) + 1)}
          style={{ flex: 1, height: i === active ? 12 : 6, borderRadius: 3, backgroundColor: i === active ? '#FFFFFF' : i < active ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.16)' }} />
      ))}
    </PanView>
  );
}

// ── Transcript panel ─────────────────────────────────────────────────────────
type PanelProps = {
  corrections: ReturnType<typeof useTranscriptCorrections>; onRestore: (l: Line) => void;
  cur: number; n: number; lines: Line[]; recording: boolean; claimed: boolean; stage: Stage | null; partId: string | null; accent: string; hasRun: boolean;
  canPlayback: boolean; slidePlaying: boolean; onPlaySlide: () => void;
  positionMs: number | null; playbackUri: string | null;
  playbackError: string | null;
  playingKey: string | null; progress: number; alt: { key: string; fi: number } | null; fixNote: string | null;
  onPlay: (l: Line) => void;
  onAlt: (l: Line, fi: number) => void; onApplyAlt: (l: Line, fi: number, v: string) => void; onKeepFlag: (l: Line, fi: number) => void; onMove: (l: Line, dir: -1 | 1) => void;
};
function TranscriptPanel(p: PanelProps) {
  const workers = useWorkers();
  const worker = p.partId ? workers.get(p.partId) : undefined;
  const showLines = !(p.recording && p.claimed);
  const lines = showLines ? p.lines : [];
  const correction = p.corrections.state, suggestion = p.corrections.suggestions;
  const syncFailure = p.corrections.syncError || correction?.error;
  const needsSync = !!correction && (!!correction.pending || !!correction.conflict || !!syncFailure);
  const status = correction?.conflict ? 'Correction conflict · choose a version' : syncFailure ||
    (correction?.pending ? 'Saved on phone · sync pending' : p.corrections.notice ||
      (suggestion?.stale ? 'Transcription suggestions outdated · check again' : suggestion?.error?.message ||
        (p.corrections.busy || suggestionActive(suggestion) ? (suggestion?.state === 'waiting_descriptions' ? 'Preparing slide context…' : 'Checking transcription…') :
          suggestion?.state === 'failed' ? 'Transcription check failed · try again' :
            suggestion?.requires_confirmation ? 'Transcription retry needs confirmation' : '')));
  let empty = '';
  let action: (() => void) | undefined;
  if (!lines.length) {
    if (p.recording) empty = 'Listening…';
    else if (p.stage && p.stage !== 'done' && p.stage !== 'no_speech') {
      const s = p.stage;
      empty = s === 'processing' ? (worker?.detail || 'Transcribing') + '…'
        : s === 'uploading' ? 'Uploading your take…'
          : s === 'upload_failed' ? 'Couldn’t upload this take · tap to retry'
            : s === 'failed' ? 'Transcription stopped · tap to retry'
              : s === 'awaiting' ? (worker?.prompt ? 'Waiting for your OK to transcribe' : 'Transcription not started · tap to start')
                : s === 'interrupted' ? 'This take was interrupted. Its audio is kept on this phone.'
                  : s === 'missing' ? 'This take isn’t on this phone' : 'Saved on this phone · uploads when online';
      action = s === 'upload_failed' ? worker?.retryUpload : s === 'failed' ? worker?.retry : s === 'awaiting' && !worker?.prompt ? worker?.analyze : undefined;
    } else if (p.stage === 'no_speech') empty = 'No speech was detected in this take';
    else empty = p.hasRun ? 'Nothing said on this slide in the last run' : 'Your words appear here after you record';
  }
  return <>
    <View style={styles.txHead}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${p.slidePlaying ? 'Pause' : 'Play'} slide ${p.cur + 1} transcript audio`}
        disabled={!p.canPlayback || !p.partId} onPress={p.onPlaySlide} hitSlop={8}>
        <Txt style={styles.txHeadText}>{'Slide ' + (p.cur + 1) + ' transcript'}</Txt>
      </Pressable>
      <View style={styles.txRule} />
      {!!correction && !p.recording && <Pressable accessibilityRole="button" accessibilityLabel="Check transcription for AI correction suggestions"
        disabled={p.corrections.busy || !!correction.conflict || suggestionActive(suggestion)} onPress={() => void p.corrections.generate()} hitSlop={6}>
        <Txt style={[styles.txCheck, (p.corrections.busy || correction.conflict || suggestionActive(suggestion)) && { opacity: 0.5 }]}>Check transcription</Txt>
      </Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel={`${p.slidePlaying ? 'Pause' : 'Play'} slide ${p.cur + 1} recording`}
        disabled={!p.canPlayback || !p.partId} onPress={p.onPlaySlide}
        style={[styles.txPlay, (!p.canPlayback || !p.partId) && { opacity: 0.28 }]}>
        <Glyph name={p.slidePlaying ? 'p-pause' : 'p-play'} size={15} color={p.slidePlaying ? C.text : C.secondary} />
      </Pressable>
    </View>
    <View style={styles.txBox}>
      <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 14, flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!p.recording && (needsSync || !!status || !!suggestion?.dependency?.retry_action) && <View style={{ gap: 6 }}>
          {!!status && <Txt style={styles.txVisit}>{status}</Txt>}
          {needsSync && <View style={styles.alts}>
            {correction?.conflict ? <>
              <Pressable accessibilityRole="button" accessibilityLabel="Use server corrections" onPress={p.corrections.keepServer}><Txt style={styles.altText}>Use server</Txt></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Keep my corrections and synchronize" onPress={p.corrections.keepLocal}><Txt style={styles.altText}>Keep mine</Txt></Pressable>
            </> : <Pressable accessibilityRole="button" accessibilityLabel="Synchronize transcript corrections" disabled={p.corrections.busy} onPress={() => void p.corrections.synchronize()}><Txt style={styles.altText}>Sync corrections</Txt></Pressable>}
          </View>}
          {!!suggestion?.dependency?.retry_action && <Pressable accessibilityRole="button" accessibilityLabel="Retry slide context for transcription suggestions"
            disabled={p.corrections.busy} onPress={() => void p.corrections.retryContext()} style={styles.alts}><Txt style={styles.altText}>Retry slide context</Txt></Pressable>}
        </View>}
        {!p.recording && !!(p.playbackError || p.fixNote) && <Txt style={styles.txVisit}>{p.playbackError ? 'Audio failed · tap Play to retry' : p.fixNote}</Txt>}
        {!lines.length && (
          <Pressable disabled={!action} onPress={action} style={{ flexGrow: 1, justifyContent: 'center' }}>
            <Txt style={[styles.empty, action ? { color: C.secondary } : null]}>{empty}</Txt>
          </Pressable>
        )}
        {lines.map((l, i) => {
          const heading = visitHeading(l, lines[i - 1]);
          const inAudio = p.positionMs !== null && p.playbackUri === audioOf(l.audio.attemptId) && p.positionMs >= l.audio.startMs && p.positionMs < l.audio.endMs;
          const playing = p.playingKey === l.key || (p.slidePlaying && inAudio);
          return <View key={l.key} style={{ gap: 6 }}>
            {heading && <Txt style={styles.txVisit}>{heading}</Txt>}
            <LineRow line={l} {...p} playing={playing} altFi={p.alt?.key === l.key ? p.alt.fi : -1} />
          </View>;
        })}
      </ScrollView>
    </View>
  </>;
}

function LineRow(p: PanelProps & { line: Line; playing: boolean; altFi: number }) {
  const { line } = p;
  const frame = useFrame();
  const dx = useSharedValue(0);
  const [dragX, setDragX] = useState(0);
  const g = useRef<{ axis: 'x' | 'y' | null } | null>(null);
  const responder: PanHandlers = {
    onStartShould: () => !p.recording,
    onGrant: () => { g.current = { axis: null }; },
    onMove: (_e, gs) => {
      const s = g.current;
      if (!s) return;
      const x = gs.dx / frame.s, y = gs.dy / frame.s;
      if (!s.axis) {
        if (Math.abs(x) < 7 && Math.abs(y) < 7) return;
        s.axis = Math.abs(x) > Math.abs(y) ? 'x' : 'y';
      }
      if (s.axis !== 'x') return;
      const edge = (x < 0 && p.cur === 0) || (x > 0 && p.cur === p.n - 1);
      const v = edge ? x * 0.25 : x;
      dx.set(v); setDragX(v);
    },
    onRelease: e => end(false, e),
    onTerminate: () => end(true),
    onTerminationRequest: () => g.current?.axis !== 'x',
  };
  function end(cancelled: boolean, event?: GestureResponderEvent) {
    const s = g.current;
    g.current = null;
    const v = dx.get();
    dx.set(withTiming(0, { duration: 220, easing: EASE_SNAP })); setDragX(0);
    if (!s || cancelled) return;
    if (s.axis === 'x') { if (Math.abs(v) > 90) p.onMove(line, v < 0 ? -1 : 1); return; }
    if (!s.axis && event) p.onPlay(line);
  }
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }] }));
  const toPrev = dragX < 0, target = p.cur + (toPrev ? -1 : 1), canMove = target >= 0 && target < p.n, past = Math.abs(dragX) > 90 && canMove;
  const segs = playbackPieces(p.recording ? { ...line, flags: [] } : line, p.playing && p.playbackUri === audioOf(line.audio.attemptId) ? p.positionMs : null);
  const progress = p.playing && p.positionMs !== null ? Math.max(0, Math.min(1, (p.positionMs - line.audio.startMs) / Math.max(1, line.audio.endMs - line.audio.startMs))) : 0;
  const pct = Math.round(progress * 100);
  return (
    <View style={{ flexShrink: 0 }}>
      <View pointerEvents="none" style={[styles.reveal, { justifyContent: toPrev ? 'flex-end' : 'flex-start', backgroundColor: past ? p.accent : 'rgba(255, 255, 255, 0.08)', opacity: Math.min(1, Math.abs(dragX) / 50) }]}>
        <Txt style={styles.revealText}>{dragX && canMove ? (toPrev ? '← Slide ' + (target + 1) : 'Slide ' + (target + 1) + ' →') : ''}</Txt>
      </View>
      <PanView style={[styles.lineRow, { backgroundColor: p.playing ? undefined : dragX ? '#15151B' : 'transparent' }, row]} {...responder}
        accessible accessibilityRole="button" accessibilityLabel={(p.playing ? 'Stop playback: ' : 'Tap transcript words to play from ' + fmt(line.t) + ': ') + line.text}
        accessibilityActions={[{ name: 'activate' },
          ...(p.cur > 0 ? [{ name: 'movePrev', label: 'Move to slide ' + p.cur }] : []), ...(p.cur < p.n - 1 ? [{ name: 'moveNext', label: 'Move to slide ' + (p.cur + 2) }] : [])]}
        onAccessibilityAction={e => { const a = e.nativeEvent.actionName; if (a === 'activate') p.onPlay(line); else if (a === 'movePrev') p.onMove(line, -1); else if (a === 'moveNext') p.onMove(line, 1); }}>
        {p.playing && (
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Rect x="0" y="0" width={`${pct}%`} height="100%" rx={10} fill="rgba(255, 255, 255, 0.14)" />
            <Rect x={`${pct}%`} y="0" width={`${100 - pct}%`} height="100%" fill="rgba(255, 255, 255, 0.05)" />
          </Svg>
        )}
        <View style={styles.playCol}>
          <Txt style={styles.lineTime}>{fmt(line.t)}</Txt>
        </View>
          <Txt style={[styles.lineText, { color: p.playing ? '#FFFFFF' : C.body }]}>
            {segs.map((sg, i) => sg.fi < 0 ? <Txt key={i} style={sg.active ? { backgroundColor: p.accent, color: '#101014' } : undefined}>{sg.t}</Txt> : (
              <Txt key={i} accessibilityRole="button" accessibilityLabel={'Possibly misheard: ' + line.flags[sg.fi].w + '. Show corrections'} onPress={() => p.onAlt(line, sg.fi)}
                style={[styles.flag, sg.active && { backgroundColor: p.accent, color: '#101014' }]}>{sg.t}</Txt>
            ))}
          </Txt>
      </PanView>
      {line.fixed && !p.recording && <Pressable accessibilityRole="button" accessibilityLabel="Restore original transcript sentence" onPress={() => p.onRestore(line)} style={styles.alts}>
        <Txt style={styles.altText}>Restore original</Txt>
      </Pressable>}
      {p.altFi >= 0 && line.flags[p.altFi] && (
        <View style={styles.alts}>
          <Txt style={styles.altLead}>Did you say</Txt>
          {!!line.flags[p.altFi].reason && <Txt style={styles.txVisit}>{line.flags[p.altFi].reason}</Txt>}
          {line.flags[p.altFi].alts.map(a => (
            <Pressable key={a} accessibilityRole="button" accessibilityLabel={`Replace “${line.flags[p.altFi].w}” with “${a}”`} onPress={() => p.onApplyAlt(line, p.altFi, a)}
              style={[styles.altChip, { borderColor: 'rgba(255, 216, 102, 0.45)', backgroundColor: 'rgba(255, 216, 102, 0.18)' }]}>
              <Txt style={[styles.altText, { color: '#FFE08A' }]}>{a}</Txt>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel={`Keep “${line.flags[p.altFi].w}” as heard`} onPress={() => p.onKeepFlag(line, p.altFi)}
            style={[styles.altChip, { borderColor: 'rgba(255, 255, 255, 0.14)', backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
            <Txt style={[styles.altText, { color: '#C9CBD3' }]}>{'Keep “' + line.flags[p.altFi].w + '”'}</Txt>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Play audio for this transcription suggestion" onPress={() => p.onPlay(line)} style={styles.altChip}>
            <Txt style={styles.altText}>Play audio</Txt>
          </Pressable>
        </View>
      )}
      {!!line.edge && !p.recording && (
        <View style={styles.edge} pointerEvents="none">
          <Glyph name="h-spin" size={14} color="#FFC266" />
          <Txt style={styles.edgeText}>{line.edge < 0 ? 'Said as the slide changed · swipe ← to move to slide ' + p.cur : 'Said as the slide changed · swipe → to move to slide ' + (p.cur + 2)}</Txt>
        </View>
      )}
    </View>
  );
}

// ── Timer, slide time, pace chip and waveform (re-render ~10×/s while recording) ──
function Readout({ live, phase, cur, take, deck, burst, error, recoveryCount, recoveryNumber, onRecovery }: {
  live: LiveStore; phase: Phase; cur: number; take: boolean; deck: DeckModel['deck']; burst: { total: number } | null; error: string;
  recoveryCount: number; recoveryNumber: number; onRecovery: () => void;
}) {
  const L = useSyncExternalStore(live.subscribe, live.get);
  const recording = phase === 'recording' || phase === 'stopping';
  const target = deck.targets[cur] ?? 0;
  if (recording) {
    const onSlide = L.E - L.slideStart;
    const pace = paceChip(L.E, cur, L.recStart, deck.targets);
    return <>
      <View style={styles.paceWrap} pointerEvents="none"><Chip chip={pace} size={14} /></View>
      <Txt style={[styles.big, { color: C.text }]}>{fmt(L.E)}</Txt>
      <Txt style={[styles.line, { color: onSlide > target ? C.coralText : C.secondary }]}>{'Slide ' + (cur + 1) + ' · ' + fmt(onSlide) + ' of ' + fmt(target)}</Txt>
      <Waveform bars={L.wave} live />
    </>;
  }
  const recovery = recoveryCount > 0;
  const line = recovery && phase === 'idle' ? 'Recording interrupted' + (recoveryCount > 1 ? ` ${recoveryNumber} of ${recoveryCount}` : '') + ' · tap to inspect' : error ? error : phase === 'count' ? 'Get ready…' : phase === 'burst' ? 'Run complete'
    : take ? 'Redo slide ' + (cur + 1) : cur === 0 ? 'Full run · ' + (deck.timing.source === 'required' ? 'required ' : 'suggested ') + fmt(deck.target) : 'Record slide ' + (cur + 1);
  return <>
    <Txt style={[styles.big, { color: phase === 'burst' ? C.text : C.dim }]}>{phase === 'burst' && burst ? fmt(burst.total) : '0:00'}</Txt>
    <Txt numberOfLines={2} accessibilityRole={recovery && phase === 'idle' ? 'button' : 'text'}
      accessibilityLabel={recovery && phase === 'idle' ? 'Open interrupted recording for recovery' : undefined}
      onPress={recovery && phase === 'idle' ? onRecovery : undefined}
      style={[styles.line, { color: error || recovery ? C.bad : C.secondary }]}>{line}</Txt>
    <Waveform bars={IDLE_WAVE} live={false} />
  </>;
}

const styles = StyleSheet.create({
  loading: { position: 'absolute', top: 400, left: 0, right: 0, textAlign: 'center', fontFamily: F.medium, fontSize: 14, color: C.secondary },
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  deckTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  counter: { marginTop: 3, fontFamily: F.medium, fontSize: 13, color: C.secondary },
  trackBox: { position: 'absolute', left: 16, top: 116, width: CARD_W, height: CARD_H },
  track: { position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H },
  cardSlot: { position: 'absolute', top: 0, width: CARD_W, height: CARD_H },
  corner: { position: 'absolute', bottom: 0, width: 60, height: 60 },
  strip: { position: 'absolute', left: 16, right: 16, top: 330, height: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  txHead: { position: 'absolute', left: 16, right: 16, top: 364, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 2 },
  txHeadText: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  txRule: { flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  txCheck: { fontFamily: F.semibold, fontSize: 11, color: C.secondary },
  txVisit: { fontFamily: F.semibold, fontSize: 11, color: C.secondary, paddingHorizontal: 8 },
  txPlay: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  txBox: { position: 'absolute', left: 16, right: 16, top: 402, height: 104, overflow: 'hidden' },
  empty: { textAlign: 'center', fontFamily: F.medium, fontSize: 13, color: C.tertiary },
  reveal: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 10 },
  revealText: { fontFamily: F.bold, fontSize: 12, color: '#FFFFFF' },
  lineRow: { flexDirection: 'row', gap: 8, paddingTop: 6, paddingBottom: 6, paddingRight: 8, paddingLeft: 4, borderRadius: 10, overflow: 'hidden' },
  playCol: { width: 34, alignItems: 'center', paddingTop: 3 },
  lineTime: { fontFamily: F.semibold, fontSize: 11, color: C.tertiary, fontVariant: ['tabular-nums'] },
  lineText: { flex: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 19.3 },
  flag: { backgroundColor: 'rgba(255, 216, 102, 0.14)', color: '#FFE08A', textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'rgba(255, 216, 102, 0.85)' },
  alts: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 4, paddingBottom: 4, paddingLeft: 42 },
  altLead: { fontFamily: F.semibold, fontSize: 12, color: C.tertiary },
  altChip: { paddingVertical: 4, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 999 },
  altText: { fontFamily: F.bold, fontSize: 12, color: C.secondary },
  edge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4, paddingLeft: 42 },
  edgeText: { flex: 1, fontFamily: F.semibold, fontSize: 12, color: '#FFC266' },
  paceWrap: { position: 'absolute', left: 0, right: 0, top: 512, alignItems: 'center' },
  big: { position: 'absolute', left: 0, right: 0, top: 548, textAlign: 'center', fontFamily: F.display, fontSize: 42, lineHeight: 44, letterSpacing: -1.3, fontVariant: ['tabular-nums'] },
  line: { position: 'absolute', left: 30, right: 30, top: 596, textAlign: 'center', fontFamily: F.semibold, fontSize: 14 },
});
