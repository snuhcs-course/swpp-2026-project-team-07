// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OutLoud redesign: Review (SPEC §4.6, §5.5, §5.6).
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Enter, Txt, useFrame } from '../design/frame';
import { UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { MiniSlide } from '../design/SlideCard';
import { C, EASE_SCREEN, F } from '../design/tokens';
import { Chip, HintRow, IconRow, Pill } from '../design/ui';
import { findingsFor, reviewChips, reviewInsights, slideVerdict, wpmOf, type Row } from '../domain/analysis';
import { fmt, relativeDay } from '../domain/format';
import { runLabel } from '../domain/run';
import { fillerList } from '../domain/words';
import { requestCoaching, retainCoaching, useCoaches } from '../features/rehearsal/coaching';
import { useWorkers } from '../features/rehearsal/analysis';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { BACK_T } from '../domain/gestures';
import { useBack, useNow, useShell } from './shared';
import { TakePlayback } from './TakePlayback';

export function ReviewScreen() {
  const { go, nav } = useShell();
  const frame = useFrame();
  const model = useDeckModel(nav.deckId);
  const n = model?.n ?? 0;
  const [sel, setSel] = useState(() => Math.max(0, Math.min(Math.max(0, n - 1), nav.sel)));
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const dy = useSharedValue(0);
  const gone = useSharedValue(0);
  const coaches = useCoaches();
  const workers = useWorkers();
  const now = useNow();
  const selectedPartId = model?.state.run?.parts[Math.max(0, Math.min(Math.max(0, n - 1), sel))]?.attemptId ?? null;
  useEffect(() => selectedPartId ? retainCoaching(selectedPartId) : undefined, [selectedPartId]);

  const toSlides = useCallback(() => { gone.set(1); dy.set(withTiming(520, { duration: 280 })); setTimeout(() => go('rehearse', { nav: 'fade', deckId: nav.deckId, slide: sel }), 280); }, [dy, go, gone, nav.deckId, sel]);
  const toQA = useCallback(() => { gone.set(1); setTimeout(() => go('qa', { nav: 'rise', deckId: nav.deckId, sel }), 120); }, [go, gone, nav.deckId, sel]);
  const pan = {
    onMoveShould: (e: GestureResponderEvent, g: PanResponderGestureState) => {
      const y = (e.nativeEvent.pageY - frame.top) / frame.s;
      return Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx) && !(y > 330 && y < 440 && Math.abs(g.dx) > 4);
    },
    onMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => { const d = g.dy / frame.s, a = Math.abs(d); dy.set(Math.sign(d) * (a > 160 ? 160 + (a - 160) * 0.5 : a)); },
    onRelease: () => {
      if (dy.get() > BACK_T) toSlides();
      else if (dy.get() < -BACK_T) toQA();
      else dy.set(withTiming(0, { duration: 320, easing: EASE_SCREEN }));
    },
    onTerminate: () => { dy.set(withTiming(0, { duration: 320, easing: EASE_SCREEN })); },
  };
  useBack(true, () => { if (detailsId) { setDetailsId(null); return true; } toSlides(); return true; });
  const screen = useAnimatedStyle(() => ({ opacity: gone.value ? withTiming(0, { duration: 260 }) : Math.max(0.15, 1 - Math.abs(dy.value) / 260), transform: [{ translateY: dy.value * 0.55 }] }));

  if (!model || !model.state.run) return null;
  const { deck, times, total, lines, state } = model;
  const run = state.run!;
  const targets = deck.targets;
  const maxT = Math.max(1, ...times);
  const s = Math.max(0, Math.min(n - 1, sel));
  const t = times[s] ?? 0, g = targets[s] ?? 0;
  const verdict = slideVerdict(t, g);
  const rows: Row[] = [verdict.row];
  if (t > 0) rows.push(...findingsFor(s, lines, deck.slides[s]?.points ?? [], model.ai, deck.text === 'ready'));
  const ins = reviewInsights(times, targets, total, run.targetSum);
  const text = lines.map(l => l.text).join(' ');
  const wpm = model.transcribed ? wpmOf(text, total) : null;
  const fillers = model.transcribed ? fillerList(text).slice(0, 5) : [];
  const label = runLabel(run, now, relativeDay) + (state.fixes ? ' · ' + state.fixes + (state.fixes === 1 ? ' transcript fix' : ' transcript fixes') : '');
  // The take that supplies the selected slide: its transcription and AI-suggestion status.
  const partId = run.parts[s]?.attemptId ?? null;
  const pending = partId ? !model.transcripts.has(partId) && model.stages.get(partId) !== 'no_speech' : false;
  const worker = partId ? workers.get(partId) : undefined;
  const coach = partId ? coaches.get(partId) : undefined;
  const hasAi = model.ai.some(a => a.slide === s);

  return (
    <Enter kind={nav.nav}>
      <PanView style={StyleSheet.absoluteFill} {...pan}>
        <Animated.View style={[StyleSheet.absoluteFill, screen]}>
          <View style={styles.header} pointerEvents="none">
            <Txt numberOfLines={1} style={styles.title}>{deck.title}</Txt>
            <Txt numberOfLines={1} style={styles.label}>{label}</Txt>
          </View>
          <View style={styles.col}>
            <View style={styles.bigRow} pointerEvents="none">
              <Txt style={styles.big}>{fmt(total)}</Txt>
              <Txt style={styles.sub}>{'/ ' + fmt(run.targetSum)}</Txt>
            </View>
            <View style={styles.chips} pointerEvents="none">{reviewChips(total, run.targetSum, wpm, run.delta).map(c => <Chip key={c.text} chip={c} />)}</View>
            {!!ins.tip && (
              <View style={styles.tip} pointerEvents="none">
                <UIIcon name="i-bulb" size={26} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.tipHead}>What to change first</Txt>
                  <Txt style={styles.tipText}>{ins.tip}</Txt>
                </View>
              </View>
            )}
            <View>
              <View style={styles.barsHead} pointerEvents="none">
                <Txt style={styles.barsTitle}>Times per slide</Txt>
                <Txt style={styles.barsHint}>Tap a bar</Txt>
              </View>
              <View style={styles.bars}>
                {times.map((tb, b) => {
                  const over = tb > 0 && tb - (targets[b] ?? 0) >= 15, isSel = b === s;
                  return (
                    <Pressable key={b} accessibilityRole="button" accessibilityState={{ selected: isSel }} accessibilityLabel={'Slide ' + (b + 1) + ', ' + (tb > 0 ? fmt(tb) : 'not reached')}
                      onPress={() => setSel(b)} style={{ flex: 1, minWidth: 0, height: tb > 0 ? Math.max(6, Math.round((tb / maxT) * 78)) : 4, borderTopLeftRadius: 4, borderTopRightRadius: 4,
                        borderBottomLeftRadius: 2, borderBottomRightRadius: 2, overflow: 'hidden', backgroundColor: isSel ? '#FFFFFF' : over ? undefined : tb > 0 ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.08)' }}>
                      {over && !isSel && <OverBar />}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.nums} pointerEvents="none">
                {times.map((tb, b) => {
                  const over = tb > 0 && tb - (targets[b] ?? 0) >= 15, isSel = b === s;
                  return <Txt key={b} style={[styles.num, { color: isSel ? '#FFFFFF' : '#FF8A7E' }]}>{isSel || over ? String(b + 1) : ''}</Txt>;
                })}
              </View>
            </View>
            <View style={styles.selCard}>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }} pointerEvents="box-none">
                {partId ? <Pressable accessibilityRole="button" accessibilityLabel={'Recording details for slide ' + (s + 1)} onPress={() => setDetailsId(partId)}>
                  <MiniSlide hue={deck.hue} page={deck.pages[s]} title={deck.slides[s]?.title ?? ''} width={104} height={58} radius={9} />
                </Pressable> : <MiniSlide hue={deck.hue} page={deck.pages[s]} title={deck.slides[s]?.title ?? ''} width={104} height={58} radius={9} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.selNum}>{'Slide ' + (s + 1)}</Txt>
                  <Txt numberOfLines={1} style={styles.selTitle}>{deck.slides[s]?.title ?? 'Slide ' + (s + 1)}</Txt>
                  <View style={styles.selTimeRow}>
                    <Txt style={styles.selTime}>{t > 0 ? fmt(t) + ' of ' + fmt(g) : 'Not reached'}</Txt>
                    {verdict.chip && <Pill text={verdict.chip.text} tone={verdict.chip.tone === 'plain' ? 'plain' : verdict.chip.tone} />}
                  </View>
                </View>
              </View>
              <View style={{ gap: 6, marginTop: 10 }}>
                {rows.slice(0, 5).map(r => <IconRow key={r.icon + r.text} icon={r.icon} text={r.text} />)}
                {t > 0 && pending && <IconRow icon="i-wave" text={worker?.stage === 'processing' ? (worker.detail || 'Transcribing') + '… fillers and points follow' : 'Transcript pending — fillers and points appear when it’s ready'} />}
                {t > 0 && !pending && partId && !hasAi && (
                  <Pressable accessibilityRole="button" disabled={!!coach?.busy || coach?.done || !!coach?.prompt ||
                    (!!coach?.details.feedback && (coach.details.feedback.availability.state !== 'available' ||
                      (coach.details.feedback.feedback_revision > 0 && !coach.details.feedback.retry_available)))} onPress={() => requestCoaching(partId)}>
                    <IconRow icon="i-chart" text={coach ? (coach.notice || coach.label) : 'Tap for AI suggestions on this take'} />
                  </Pressable>
                )}
              </View>
            </View>
            {!!ins.best && !!ins.worst && (
              <View style={{ flexDirection: 'row', gap: 10 }} pointerEvents="none">
                <View style={[styles.tile, { borderColor: 'rgba(63, 217, 164, 0.22)', backgroundColor: 'rgba(63, 217, 164, 0.07)' }]}>
                  <View style={styles.tileHead}><UIIcon name="i-check" size={16} /><Txt style={[styles.tileTitle, { color: '#3FD9A4' }]}>Strongest</Txt></View>
                  <Txt style={styles.tileLabel}>{ins.best.label}</Txt>
                  <Txt style={styles.tileSub}>{ins.best.sub}</Txt>
                </View>
                <View style={[styles.tile, { borderColor: 'rgba(255, 122, 107, 0.24)', backgroundColor: 'rgba(255, 122, 107, 0.07)' }]}>
                  <View style={styles.tileHead}><UIIcon name="i-flag" size={16} /><Txt style={[styles.tileTitle, { color: '#FF9C90' }]}>Needs most work</Txt></View>
                  <Txt style={styles.tileLabel}>{ins.worst.label}</Txt>
                  <Txt style={styles.tileSub}>{ins.worst.sub}</Txt>
                </View>
              </View>
            )}
            {!!fillers.length && (
              <View style={styles.fillers} pointerEvents="none">
                <UIIcon name="i-bubble" size={24} />
                {fillers.map(([w, c]) => <View key={w} style={styles.filler}><Txt style={styles.fillerText}>{w + ' '}<Txt style={{ fontFamily: F.displayHeavy }}>{c}</Txt></Txt></View>)}
              </View>
            )}
          </View>
          <HintRow hints={[{ icon: 'h-dn', text: 'Back to slides', nudge: 'down' }, { icon: 'h-up', text: 'Audience Q&A', nudge: 'up' }]} />
        </Animated.View>
      </PanView>
      {detailsId && <TakePlayback key={detailsId} id={detailsId} deck={deck} initialSlide={s} onClose={() => setDetailsId(null)} />}
    </Enter>
  );
}
function OverBar() {
  return (
    <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
      <Defs><LinearGradient id="gOver" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FF9A7C" /><Stop offset="1" stopColor="#EC2A35" /></LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#gOver)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13, color: C.secondary },
  col: { position: 'absolute', left: 16, right: 16, top: 102, gap: 12 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
  big: { fontFamily: F.display, fontSize: 50, lineHeight: 52, letterSpacing: -1.6, color: C.text, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: F.semibold, fontSize: 17, color: C.secondary, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255, 216, 102, 0.22)',
    borderRadius: 18, backgroundColor: 'rgba(255, 216, 102, 0.07)' },
  tipHead: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: '#FFD866' },
  tipText: { marginTop: 3, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18.9, color: C.text },
  barsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  barsTitle: { fontFamily: F.bold, fontSize: 14, color: C.text },
  barsHint: { fontFamily: F.medium, fontSize: 12, color: C.tertiary },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 80, marginTop: 8 },
  nums: { flexDirection: 'row', gap: 3, height: 14, marginTop: 4 },
  num: { flex: 1, minWidth: 0, textAlign: 'center', fontFamily: F.bold, fontSize: 10 },
  selCard: { paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  selNum: { fontFamily: F.semibold, fontSize: 12, color: C.secondary },
  selTitle: { marginTop: 2, fontFamily: F.display, fontSize: 18, lineHeight: 20.7, color: C.text },
  selTimeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  selTime: { fontFamily: F.semibold, fontSize: 13, color: C.text, fontVariant: ['tabular-nums'] },
  tile: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 16 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileTitle: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  tileLabel: { marginTop: 4, fontFamily: F.display, fontSize: 16, color: C.text },
  tileSub: { marginTop: 1, fontFamily: F.medium, fontSize: 12, color: C.secondary },
  fillers: { flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  filler: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(155, 124, 255, 0.16)' },
  fillerText: { fontFamily: F.semibold, fontSize: 12, color: '#CBB8FF' },
});
