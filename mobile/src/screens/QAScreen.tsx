// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration-prompts-iteration-2.md#finger-linked-page-fade-october-15-2026
// OpenAI Codex audience setup: docs/ai-collaboration-prompts-iteration-2.md#presentation-time-and-audience-setup-october-15-2026
// OpenAI Codex light-mode Q&A: docs/ai-collaboration-prompts-iteration-2.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: Audience Q&A (SPEC §4.7, §5.7).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { MiniSlide } from '../design/SlideCard';
import { C, EASE_SCREEN, EASE_SNAP, F, HUES, TONE } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { Dialog, HintRow, IDLE_WAVE, PageSurface, RecordButton, RecordRing, Waveform, type Hint, type RecordGlyph } from '../design/ui';
import type { IconKey } from '../domain/analysis';
import { fmt, quote } from '../domain/format';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { sentences, slideText } from '../domain/lines';
import { AnswerRecorder, type AnswerHandle } from '../features/qa/AnswerRecorder';
import { generateQuestions, judgeAnswer, QaError, type QaResult } from '../features/qa/client';
import { answerKey, hasQaConsent, readQa, saveQa, saveQaConsent, type QaSet, type StoredAnswer } from '../features/qa/store';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { useBack, useShell } from './shared';

const AUDIENCE = 'General audience';

export function QAScreen() {
  const { nav } = useShell();
  const model = useDeckModel(nav.deckId);
  if (!model?.state.run) return null;
  return <QA model={model} />;
}

function QA({ model }: { model: DeckModel }) {
  const { c } = useTheme();
  const { go, nav } = useShell();
  const frame = useFrame();
  const { deck, lines, state } = model;
  const run = state.run!;
  // Questions belong to a run. A newer run gets new questions; older ones stay while it transcribes.
  const [boot] = useState(() => {
    const stored = readQa(deck.id);
    const kept = stored && (stored.runId === run.id || stored.questions.length) ? stored : null;
    const need = !(kept && kept.runId === run.id) && !(kept && kept.questions.length && !model.transcribed);
    return { kept, need, consent: hasQaConsent() };
  });
  const [set, setSet] = useState<QaSet | null>(boot.kept);
  const [load, setLoad] = useState<{ kind: 'idle' | 'consent' | 'loading' | 'error'; message?: string }>(
    () => (!boot.need ? { kind: 'idle' } : boot.consent ? { kind: 'loading' } : { kind: 'consent' }));
  const [i, setI] = useState(0);
  const [part, setPart] = useState<0 | 1>(0);
  const [count, setCount] = useState(0);
  const [rec, setRec] = useState(false);
  const [hear, setHear] = useState<string | null>(null);
  const [recKey, setRecKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<AnswerHandle>(null);
  const [wave, setWave] = useState<number[]>(IDLE_WAVE);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringP = useSharedValue(0), ringV = useSharedValue(0);
  const dx = useSharedValue(0), dy = useSharedValue(0);
  const backExiting = useRef(false);
  const player = useSegmentPlayer();
  const hue = HUES[deck.hue];

  // ── Questions ─────────────────────────────────────────────────────────────
  /** Writes questions from the slide text and this run's transcript; they are cached per presentation. */
  const requestQuestions = useCallback(async (): Promise<QaSet> => {
    const slides = deck.slides.map((s, k) => ({ slide_index: k, title: s.title, transcript: slideText(lines, k) }));
    const audience = deck.audience || AUDIENCE;
    const questions = await generateQuestions(deck, slides, audience);
    const next: QaSet = { runId: run.id, audience, questions, answers: {}, createdAt: new Date().toISOString() };
    saveQa(deck.id, next);
    return next;
  }, [deck, lines, run.id]);
  const showQuestions = (next: QaSet) => { setSet(next); setI(0); setPart(0); setLoad({ kind: 'idle' }); };
  const showQaError = (e: unknown) => {
    const qe = e instanceof QaError ? e : null;
    setLoad({ kind: 'error', message: qe?.code === 'disabled' ? 'Audience Q&A uses the AI feedback provider, which is turned off on this server (FEEDBACK_ENABLED).'
      : qe?.message || 'Questions could not be written. Swipe down and try again later.' });
  };
  // The first load starts in the loading state (see `boot`); later loads set it first.
  useEffect(() => { if (boot.need && boot.consent) requestQuestions().then(showQuestions, showQaError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const regenerate = () => { setLoad({ kind: 'loading' }); requestQuestions().then(showQuestions, showQaError); };

  const qs = set?.questions ?? [];
  const Q = qs[i];
  const key = answerKey(i, part);
  const ans: StoredAnswer | undefined = set?.answers[key];
  const phase: 'ask' | 'rec' | 'review' = rec ? 'rec' : ans ? 'review' : 'ask';
  const last = i === qs.length - 1;

  // ── Speech ────────────────────────────────────────────────────────────────
  const stopSpeak = useCallback(() => { Speech.stop(); setHear(null); }, []);
  const speak = useCallback((text: string, k: string) => {
    if (hear === k) { stopSpeak(); return; }
    Speech.stop(); player.stop();
    setHear(k);
    Speech.speak(text, { onDone: () => setHear(h => (h === k ? null : h)), onStopped: () => setHear(h => (h === k ? null : h)), onError: () => setHear(null) });
  }, [hear, player, stopSpeak]);
  useEffect(() => () => { Speech.stop(); }, []);
  const playAnswer = () => {
    if (!ans) return;
    stopSpeak();
    void player.play('a' + key, { uri: ans.audioUri, startMs: 0, endMs: ans.durationMs });
  };

  // ── Answering ─────────────────────────────────────────────────────────────
  const update = (k: string, a: StoredAnswer) => setSet(prev => {
    if (!prev) return prev;
    const next = { ...prev, answers: { ...prev.answers, [k]: a } };
    saveQa(deck.id, next);
    return next;
  });
  const judge = useCallback(async (k: string, qi: number, p: 0 | 1, a: StoredAnswer) => {
    const q = qs[qi];
    if (!q) return;
    if (a.durationMs < 8000) {
      update(k, { ...a, status: 'done', result: { transcript: { text: '', words: [] }, verdict: 'too_short', did: '', evidence: '', clarify: '', duration_ms: a.durationMs } });
      return;
    }
    update(k, { ...a, status: 'judging', error: undefined });
    try {
      const result: QaResult = await judgeAnswer(deck, { audioUri: a.audioUri, question: p ? q.follow_up : q.question, mainQuestion: q.question, part: p, slideIndex: q.slide_index, durationMs: a.durationMs });
      update(k, { ...a, status: 'done', result });
    } catch (e) {
      update(k, { ...a, status: 'error', error: e instanceof Error ? e.message : 'The answer could not be reviewed.' });
    }
  }, [deck, qs]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopCount = () => { if (countTimer.current) { clearInterval(countTimer.current); countTimer.current = null; } };
  useEffect(() => () => stopCount(), []);
  const startRec = async () => {
    try {
      await recorder.current?.start();
      setWave(Array(28).fill(6));
      setElapsed(0); setRec(true);
      ringP.set(0); ringV.set(1);
    } catch (e) {
      ringV.set(withTiming(0));
      setLoad({ kind: 'error', message: e instanceof Error ? e.message : 'Could not start recording.' });
      setRecKey(k => k + 1);
    }
  };
  const stopRec = async () => {
    if (!recorder.current?.recording()) return;
    const k = key, qi = i, p = part;
    try {
      const { uri, durationMs } = await recorder.current.stop();
      setRec(false); ringV.set(withTiming(0, { duration: 200 })); setRecKey(x => x + 1);
      const a: StoredAnswer = { audioUri: uri, durationMs, status: 'judging', at: new Date().toISOString() };
      update(k, a);
      void judge(k, qi, p, a);
    } catch (e) {
      setRec(false); ringV.set(withTiming(0)); setRecKey(x => x + 1);
      setLoad({ kind: 'error', message: e instanceof Error ? e.message : 'The answer could not be saved.' });
    }
  };
  const toggleRec = () => {
    if (!Q) return;
    if (rec) { void stopRec(); return; }
    if (count) { stopCount(); setCount(0); ringV.set(withTiming(0)); return; }
    stopSpeak(); player.stop();
    setCount(3); ringV.set(1); ringP.set(1);
    ringP.set(withTiming(0, { duration: 3000, easing: Easing.linear }));
    const t0 = Date.now();
    countTimer.current = setInterval(() => {
      const el = Date.now() - t0;
      if (el >= 3000) { stopCount(); setCount(0); void startRec(); return; }
      setCount(c => { const nx = 3 - Math.floor(el / 1000); if (nx !== c) void Haptics.selectionAsync().catch(() => undefined); return nx; });
    }, 50);
  };
  const onMeter = (db: number, ms: number) => {
    const level = Math.max(0, Math.min(1, (db + 60) / 50));
    setWave(w => [...w.slice(1), 6 + level * 24]);
    setElapsed(ms / 1000);
    ringP.set(withTiming(Math.min(1, ms / 1000 / (part ? 60 : 90)), { duration: 80 }));
  };

  // ── Navigation between items and questions ────────────────────────────────
  const goQ = (dir: -1 | 1) => {
    const ni = i + dir;
    if (rec || count || ni < 0 || ni >= qs.length) { dx.set(withTiming(0, { duration: 280, easing: EASE_SNAP })); return; }
    stopSpeak(); player.stop();
    setI(ni);
    setPart(set?.answers[answerKey(ni, 1)] ? 1 : 0);
    dx.set(dir * 80);
    dx.set(withTiming(0, { duration: 280, easing: EASE_SNAP }));
  };
  const back = useCallback(() => {
    if (rec || count) return;
    stopSpeak(); player.stop();
    go('review', { nav: null, deckId: deck.id, sel: nav.sel });
  }, [count, deck.id, go, nav.sel, player, rec, stopSpeak]);
  const g = useRef<'x' | 'y' | null>(null);
  const busy = rec || !!count;
  const pan = {
    onMoveShould: (e: GestureResponderEvent, gs: PanResponderGestureState) => {
      if (busy || backExiting.current) return false;
      const y = (e.nativeEvent.pageY - frame.top) / frame.s;
      if (Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy)) { g.current = 'x'; return true; }
      if (gs.dy > 8 && gs.dy > Math.abs(gs.dx) && !(phase === 'review' && y > 158 && y < 648)) { g.current = 'y'; return true; }
      return false;
    },
    onMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
      if (g.current === 'x') {
        const x = gs.dx / frame.s;
        dx.set((x > 0 && i === 0) || (x < 0 && i === qs.length - 1) ? x * 0.3 : x);
      } else { dy.set(Math.min(BACK_FADE_Y, Math.max(0, gs.dy / frame.s))); }
    },
    onRelease: () => {
      if (g.current === 'x') { if (Math.abs(dx.get()) > 60) goQ(dx.get() < 0 ? 1 : -1); else dx.set(withTiming(0, { duration: 280, easing: EASE_SNAP })); }
      else if (dy.get() > BACK_T) {
        backExiting.current = true;
        dy.set(withTiming(BACK_FADE_Y, { duration: 220, easing: EASE_SCREEN }, finished => {
          if (finished) runOnJS(back)();
        }));
      } else dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
      g.current = null;
    },
    onTerminate: () => { dx.set(withTiming(0)); if (!backExiting.current) dy.set(withTiming(0)); g.current = null; },
  };
  useBack(true, () => { back(); return true; });
  const screen = useAnimatedStyle(() => ({
    // Fade to the Review page already mounted beneath Q&A.
    opacity: Math.max(0, 1 - dy.value / BACK_FADE_Y),
  }));
  const slideStyle = useAnimatedStyle(() => ({ opacity: Math.max(0.2, 1 - Math.abs(dx.value) / 240), transform: [{ translateX: dx.value }] }));
  useEffect(() => () => { cancelAnimation(ringP); }, [ringP]);

  // ── View ──────────────────────────────────────────────────────────────────
  const face = HUES[deck.hue].face;
  const hearing = (k: string) => hear === k;
  const glyph: RecordGlyph = count ? (count as 3 | 2 | 1) : rec ? 'stop' : phase === 'review' ? 'redo' : 'mic';
  const btnLabel = count ? `Starting in ${count}. Tap to cancel` : rec ? 'Stop answering' : phase === 'review' ? (part ? 'Answer the follow-up again' : 'Answer the question again') : (part ? 'Answer the follow-up' : 'Answer the question');
  const hints: Hint[] = count ? [{ icon: 'h-tap', text: 'Tap to cancel' }] : rec ? [{ icon: 'h-tap', text: 'Tap when done' }]
    : [...(last ? [] : [{ icon: 'h-spin' as const, text: 'Next' }]), { icon: 'h-dn', text: 'Back', nudge: 'down' }];
  const result = ans?.status === 'done' ? ans.result : undefined;
  const short = result?.verdict === 'too_short';
  const verdict = !result ? null : short ? { text: 'Too short', tone: TONE.bad, icon: 'i-clock' as IconKey }
    : result.verdict === 'answered' ? { text: 'Answered', tone: TONE.good, icon: 'i-check' as IconKey } : { text: 'Partly answered', tone: TONE.warn, icon: 'i-flag' as IconKey };
  const rows: { icon: IconKey; k: string; t: string }[] = !result ? [] : short ? [
    { icon: 'i-clock', k: 'Did it answer?', t: 'You stopped after ' + fmt((ans?.durationMs ?? 0) / 1000) + ' — not enough to judge.' },
    { icon: 'i-bulb', k: 'Clarify', t: 'Aim for ' + (part ? '30–60' : '60–90') + ' seconds. Tap the red button to try again.' },
  ] : ([
    { icon: result.verdict === 'answered' ? 'i-check' : 'i-flag', k: 'Did it answer?', t: result.did },
    { icon: 'i-chart', k: 'Evidence', t: result.evidence },
    { icon: 'i-bulb', k: 'Clarify', t: result.clarify },
  ] as { icon: IconKey; k: string; t: string }[]).filter(r => r.t);
  const ansLines = result ? sentences(result.transcript).map(s => ({ time: fmt(result.transcript.words[s.first].start_ms / 1000), text: s.text })) : [];

  return (
    <Enter kind={nav.nav}>
      <AnswerRecorder key={recKey} ref={recorder} onMeter={onMeter} onMustStop={() => { void stopRec(); }} />
      <PanView style={StyleSheet.absoluteFill} {...pan}>
        <Animated.View style={[StyleSheet.absoluteFill, screen]}>
          <PageSurface hue={deck.hue} />
          <View style={styles.header} pointerEvents="none">
            <Txt style={styles.title}>Audience Q&amp;A</Txt>
            <Txt style={styles.label}>{Q ? 'Question ' + (i + 1) + ' of ' + qs.length + ' · ' + (set?.audience ?? AUDIENCE) : load.kind === 'loading' ? 'Writing questions from your slides…' : AUDIENCE}</Txt>
          </View>
          {Q && (
            <Animated.View style={[styles.stage, slideStyle]}>
              <View style={styles.panelist} pointerEvents="none">
                <View style={[styles.avatar, { boxShadow: `0px 8px 16px ${hue.glow}` }]}>
                  <Svg style={StyleSheet.absoluteFill}><Defs><LinearGradient id={'qaFace' + deck.hue} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={face[0]} /><Stop offset="1" stopColor={face[1]} /></LinearGradient></Defs>
                    <Rect width="100%" height="100%" fill={`url(#qaFace${deck.hue})`} /></Svg>
                  <Txt style={styles.who}>{Q.panelist}</Txt>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.role}>{Q.role}</Txt>
                  <Txt numberOfLines={1} style={styles.meta}>{'Asked after slide ' + (Q.slide_index + 1) + (Q.topic ? ' · ' + Q.topic : '')}</Txt>
                </View>
              </View>
              <View style={[styles.col, { height: rec ? 370 : 490 }]}>
                <ScrollView scrollEnabled={phase === 'review'} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24, flexGrow: 1 }}>
                  {phase !== 'review' && part === 0 && (
                    <Pressable accessibilityRole="button" accessibilityLabel={(hearing('q' + i) ? 'Stop the question: ' : 'Hear the question: ') + Q.question}
                      onPress={() => !rec && speak(Q.question, 'q' + i)} style={{ gap: 10 }}>
                      <Txt style={[styles.qBig, { fontSize: rec ? 18 : 22, lineHeight: (rec ? 18 : 22) * 1.28 }]}>{quote(Q.question)}</Txt>
                      {!rec && <HearHint playing={hearing('q' + i)} />}
                    </Pressable>
                  )}
                  {(phase === 'review' || part === 1) && (
                    <Pressable accessibilityRole="button" accessibilityLabel={part ? 'Back to the question: ' + Q.question : 'Hear the question: ' + Q.question}
                      onPress={() => { if (rec || count) return; if (part === 1) { stopSpeak(); setPart(0); } else speak(Q.question, 'q' + i); }}>
                      <Txt style={styles.over}>{part ? 'Question · tap to go back' : 'Question'}</Txt>
                      <Txt numberOfLines={3} style={styles.qSmall}>{quote(Q.question)}</Txt>
                    </Pressable>
                  )}
                  {phase === 'review' && part === 1 && (
                    <Pressable accessibilityRole="button" accessibilityLabel={'Hear the follow-up: ' + Q.follow_up} onPress={() => speak(Q.follow_up, 'f' + i)}>
                      <Txt style={[styles.over, { color: c.warn }]}>{'Follow-up · ' + Q.panelist}</Txt>
                      <Txt numberOfLines={3} style={styles.fSmall}>{quote(Q.follow_up)}</Txt>
                    </Pressable>
                  )}
                  {part === 1 && phase !== 'review' && (
                    <Pressable accessibilityRole="button" accessibilityLabel={(hearing('f' + i) ? 'Stop the follow-up: ' : 'Hear the follow-up: ') + Q.follow_up}
                      onPress={() => !rec && speak(Q.follow_up, 'f' + i)} style={{ gap: 8 }}>
                      <Txt style={[styles.over, { color: c.warn }]}>{'Follow-up · ' + Q.panelist}</Txt>
                      <Txt style={styles.fBig}>{quote(Q.follow_up)}</Txt>
                      {phase === 'ask' && <HearHint playing={hearing('f' + i)} />}
                    </Pressable>
                  )}
                  {phase === 'ask' && (
                    <View style={styles.slideBox} pointerEvents="none">
                      <MiniSlide hue={deck.hue} page={deck.pages[Q.slide_index]} title={deck.slides[Q.slide_index]?.title ?? ''} width={220} height={124} radius={16} num={Q.slide_index + 1} />
                      <Txt style={styles.slideCap}>{'From slide ' + (Q.slide_index + 1)}</Txt>
                    </View>
                  )}
                  {rec && <View style={styles.listening}><Txt style={styles.listenText}>Listening…</Txt></View>}
                  {phase === 'review' && ans && <>
                    {ans.status === 'judging' && <Row icon="i-wave" k="Your answer" t="Transcribing and reviewing your answer…" />}
                    {ans.status === 'error' && (
                      <Pressable accessibilityRole="button" onPress={() => void judge(key, i, part, ans)}><Row icon="i-flag" k="Couldn’t review this answer" t={(ans.error || '') + ' Tap to try again.'} /></Pressable>
                    )}
                    {verdict && (
                      <View style={styles.verdictRow}>
                        <View style={[styles.verdict, { backgroundColor: verdict.tone.bg }]}><UIIcon name={verdict.icon} size={22} /><Txt style={[styles.verdictText, { color: verdict.tone.fg }]}>{verdict.text}</Txt></View>
                        <Pressable accessibilityRole="button" accessibilityLabel={(player.playingKey === 'a' + key ? 'Stop your answer' : 'Play your answer') + ', ' + fmt(ans.durationMs / 1000)}
                          onPress={playAnswer} style={styles.playChip}>
                          <Glyph name={player.playingKey === 'a' + key ? 'p-pause' : 'p-play'} size={14} color={c.body} />
                          <Txt style={styles.playText}>{fmt(ans.durationMs / 1000)}</Txt>
                        </Pressable>
                      </View>
                    )}
                    {rows.map(r => <Row key={r.k} icon={r.icon} k={r.k} t={r.t} />)}
                    {part === 0 && result && !short && Q.follow_up && (
                      <Pressable accessibilityRole="button" accessibilityLabel={'Follow-up from ' + Q.panelist + ': ' + Q.follow_up}
                        onPress={() => { if (count) return; stopSpeak(); setPart(1); }} style={styles.followCard}>
                        <Txt style={[styles.over, { color: c.warn }]}>{'Follow-up · ' + Q.panelist}</Txt>
                        <Txt style={styles.followText}>{quote(Q.follow_up)}</Txt>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Glyph name="h-tap" size={16} /><Txt style={styles.followHint}>{set?.answers[answerKey(i, 1)] ? 'Answered · tap to view' : 'Tap to answer'}</Txt></View>
                      </Pressable>
                    )}
                    {!!ansLines.length && (
                      <View style={styles.ansBox} pointerEvents="none">
                        {ansLines.map((l, k) => <View key={k} style={{ flexDirection: 'row', gap: 8 }}><Txt style={styles.ansTime}>{l.time}</Txt><Txt style={styles.ansText}>{l.text}</Txt></View>)}
                      </View>
                    )}
                    {part === 1 && <Txt style={styles.end}>{last ? 'Last question · swipe down for your review' : 'Swipe for the next question'}</Txt>}
                  </>}
                </ScrollView>
              </View>
            </Animated.View>
          )}
          {!Q && load.kind !== 'consent' && (
            <View style={styles.status} pointerEvents="box-none">
              <UIIcon name={load.kind === 'error' ? 'i-flag' : 'i-bubble'} size={44} />
              <Txt style={styles.statusText}>{load.kind === 'error' ? load.message : 'Your panel is reading the slides and your transcript…'}</Txt>
              {load.kind === 'error' && <Pressable accessibilityRole="button" onPress={regenerate} style={styles.retry}><Txt style={styles.retryText}>Try again</Txt></Pressable>}
            </View>
          )}
          {Q && load.kind === 'error' && <Txt style={styles.inlineError}>{load.message}</Txt>}
          {rec && <>
            <Txt style={styles.big}>{fmt(elapsed)}</Txt>
            <Txt style={styles.line}>{(part ? 'Follow-up · ' : '') + (part ? '30–60' : '60–90') + ' seconds is typical'}</Txt>
            <Waveform bars={wave} live />
          </>}
          <RecordRing progress={ringP} visible={ringV} />
          <RecordButton glyph={glyph} label={btnLabel} onPress={toggleRec} disabled={!Q} />
          <HintRow hints={hints} />
        </Animated.View>
      </PanView>
      {load.kind === 'consent' && (
        <Dialog icon="i-bubble" tone="neutral" title="Practise with an AI panel?"
          body="Audience Q&A sends your slide text and transcript through your OutLoud server to its configured AI provider to write questions. Your spoken answers are sent to OpenAI for transcription and reviewed by the same provider. Answers stay on this phone too. Requests may incur provider charges."
          confirm="Continue" onConfirm={() => { saveQaConsent(); regenerate(); }} onCancel={() => { setLoad({ kind: 'idle' }); back(); }} />
      )}
    </Enter>
  );
}

function HearHint({ playing }: { playing: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Glyph name={playing ? 'p-pause' : 'p-play'} size={14} color={c.secondary} />
      <Txt style={styles.hear}>{playing ? 'Playing…' : 'Tap to hear'}</Txt>
    </View>
  );
}
function Row({ icon, k, t }: { icon: IconKey; k: string; t: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <UIIcon name={icon} size={22} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.rowK}>{k}</Txt>
        <Txt style={styles.rowT}>{t}</Txt>
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13, color: C.secondary },
  stage: { position: 'absolute', left: 0, top: 0, width: 390, height: 650 },
  panelist: { position: 'absolute', left: 16, right: 16, top: 102, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  who: { fontFamily: F.display, fontSize: 14, color: '#FFFFFF' },
  role: { fontFamily: F.bold, fontSize: 15, color: C.text },
  meta: { marginTop: 1, fontFamily: F.medium, fontSize: 12, color: C.secondary },
  col: { position: 'absolute', left: 16, right: 16, top: 158 },
  qBig: { fontFamily: F.display, letterSpacing: -0.3, color: C.text },
  hear: { fontFamily: F.semibold, fontSize: 12, color: C.secondary },
  over: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  qSmall: { marginTop: 4, fontFamily: F.medium, fontSize: 14, lineHeight: 19.6, color: C.secondary },
  fSmall: { marginTop: 4, fontFamily: F.semibold, fontSize: 14, lineHeight: 19.6, color: C.body },
  fBig: { fontFamily: F.display, fontSize: 20, lineHeight: 25.6, letterSpacing: -0.3, color: C.text },
  slideBox: { alignItems: 'center', gap: 10, marginTop: 8 },
  slideCap: { fontFamily: F.semibold, fontSize: 12, color: C.tertiary },
  listening: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 8 },
  listenText: { textAlign: 'center', fontFamily: F.medium, fontSize: 13, color: C.tertiary },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 3, paddingBottom: 3, paddingLeft: 4, paddingRight: 11, borderRadius: 999 },
  verdictText: { fontFamily: F.bold, fontSize: 13 },
  playChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingLeft: 8, paddingRight: 11, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  playText: { fontFamily: F.semibold, fontSize: 13, color: C.body, fontVariant: ['tabular-nums'] },
  rowK: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  rowT: { marginTop: 2, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18.9, color: C.body },
  followCard: { gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255, 181, 71, 0.24)', borderRadius: 18, backgroundColor: 'rgba(255, 181, 71, 0.07)' },
  followText: { fontFamily: F.display, fontSize: 16, lineHeight: 20.8, color: C.text },
  followHint: { fontFamily: F.semibold, fontSize: 12, color: C.secondary },
  ansBox: { gap: 6, paddingTop: 10, paddingBottom: 10, paddingRight: 12, paddingLeft: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  ansTime: { width: 34, paddingTop: 2, textAlign: 'center', fontFamily: F.semibold, fontSize: 11, color: C.tertiary, fontVariant: ['tabular-nums'] },
  ansText: { flex: 1, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18.9, color: C.body },
  end: { marginTop: 4, textAlign: 'center', fontFamily: F.semibold, fontSize: 13, color: C.tertiary },
  status: { position: 'absolute', left: 40, right: 40, top: 300, alignItems: 'center', gap: 14 },
  statusText: { textAlign: 'center', fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.secondary },
  retry: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  retryText: { fontFamily: F.bold, fontSize: 14, color: C.text },
  inlineError: { position: 'absolute', left: 24, right: 24, top: 600, textAlign: 'center', fontFamily: F.medium, fontSize: 13, color: C.bad },
  big: { position: 'absolute', left: 0, right: 0, top: 548, textAlign: 'center', fontFamily: F.display, fontSize: 42, lineHeight: 44, letterSpacing: -1.3, color: C.text, fontVariant: ['tabular-nums'] },
  line: { position: 'absolute', left: 0, right: 0, top: 596, textAlign: 'center', fontFamily: F.semibold, fontSize: 14, color: C.secondary },
});
