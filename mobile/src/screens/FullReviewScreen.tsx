// OpenAI Codex Review and Full review: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// Real merged-run audio, timed transcript and per-slide grades; no synthesized speech.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { ScoreRing } from '../design/ScoreRing';
import { EASE_SCREEN, F } from '../design/tokens';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { GRADE, GRADE_ORDER, slideGrade, type GradeKey } from '../domain/analysis';
import { fmt, relativeDay } from '../domain/format';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { runLabel, runPosition, runStarts, type RunAudioPlanEntry } from '../domain/run';
import type { Line } from '../domain/lines';
import { audioOf } from '../features/rehearsal/analysis';
import { useSegmentPlayer, type Segment } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useBack, useNow, useShell } from './shared';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
type Mode = { kind: 'run' } | { kind: 'slide'; slide: number } | null;
type RowLayout = { y: number; h: number };

export function FullReviewScreen({ active = true }: { active?: boolean }) {
  const { c } = useTheme();
  const { go, nav } = useShell();
  const frame = useFrame();
  const model = useDeckModel(nav.deckId);
  const run = model?.state.run ?? null;
  const now = useNow();
  const player = useSegmentPlayer();
  const stopPlayback = player.stop;
  const dy = useSharedValue(0);
  const backExiting = useRef(false);
  const [mode, setMode] = useState<Mode>(null);
  const [plan, setPlan] = useState<RunAudioPlanEntry[]>([]);
  const [audioNote, setAudioNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef<ScrollView>(null);
  const stripRef = useRef<ScrollView>(null);
  const transcriptDrag = useRef(false);
  const stripDrag = useRef(false);
  const [viewportH, setViewportH] = useState(0);
  const rowLayouts = useRef(new Map<string, RowLayout>());
  const transcriptBounds = useRef({ top: 343, bottom: 675 });

  useEffect(() => { if (!active) { dy.set(0); stopPlayback(); } }, [active, dy, stopPlayback]);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); stopPlayback(); }, [stopPlayback]);
  const toBack = useCallback(() => {
    stopPlayback();
    if (nav.from === 'review') go('review', { deckId: nav.deckId });
    else go('home');
  }, [go, nav.deckId, nav.from, stopPlayback]);
  const openSlide = useCallback((i: number) => {
    stopPlayback();
    if (nav.from === 'review') go('review', { deckId: nav.deckId, sel: i });
    else go('review', { nav: 'fade', deckId: nav.deckId, sel: i, from: 'full' });
  }, [go, nav.deckId, nav.from, stopPlayback]);
  const pan = {
    onMoveShould: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
      const y = (g.y0 - frame.top) / frame.s;
      return !backExiting.current && Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx)
        && !(y >= transcriptBounds.current.top && y < transcriptBounds.current.bottom)
        && !(y >= 301 && y <= 333) && !(y >= 718 && y <= 776);
    },
    onMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => { dy.set(Math.max(0, Math.min(BACK_FADE_Y, g.dy / frame.s))); },
    onRelease: () => {
      if (dy.get() > BACK_T) {
        backExiting.current = true;
        dy.set(withTiming(BACK_FADE_Y, { duration: 220, easing: EASE_SCREEN }, finished => {
          if (finished) runOnJS(toBack)();
        }));
      } else dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
    },
    onTerminate: () => { if (!backExiting.current) dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN })); },
  };
  useBack(active, () => { toBack(); return true; });
  const screen = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - dy.value / BACK_FADE_Y) }));

  const times = useMemo(() => model?.times ?? [], [model]);
  const starts = useMemo(() => runStarts(times), [times]);
  const grades = useMemo(() => {
    if (!model || !run) return [];
    return times.map((_, i) => {
      const id = run.parts[i]?.attemptId;
      return slideGrade(i, { times, targets: model.deck.targets, lines: model.lines, points: model.points,
        ai: model.ai, haveText: model.deck.text === 'ready',
        pending: !!id && !model.transcripts.has(id) && model.stages.get(id) !== 'no_speech' });
    });
  }, [model, run, times]);
  const counts = useMemo(() => Object.fromEntries(GRADE_ORDER.map(key =>
    [key, grades.filter(g => g.key === key).length])) as Record<(typeof GRADE_ORDER)[number], number>, [grades]);
  const lines = useMemo(() => (model?.lines ?? []).filter(line => (times[line.slide] ?? 0) > 0).slice().sort((a, b) => a.t - b.t), [model, times]);
  const runKey = `run:${model?.deck.id ?? ''}`;
  const playing = !!player.playingKey;
  const runPlaying = player.playingKey === runKey && mode?.kind === 'run';
  const slidePlaying = mode?.kind === 'slide' && player.playingKey === `slide:${model?.deck.id}:${mode.slide}`;
  const playbackSlide = runPlaying ? slideAtElapsed(player.elapsedMs, plan) : slidePlaying ? mode.slide : null;
  const pos = runPlaying ? runPosition(player.elapsedMs, plan)
    : slidePlaying && playbackSlide != null ? (starts[playbackSlide] ?? 0) + player.elapsedMs / 1000 : 0;
  const currentLine = (runPlaying || slidePlaying) && playbackSlide != null
    ? lines.filter(line => line.slide === playbackSlide && line.t <= pos).at(-1)?.key ?? null : null;

  useEffect(() => {
    if (!currentLine || transcriptDrag.current || !viewportH) return;
    const measured = rowLayouts.current.get(currentLine);
    if (measured) transcriptRef.current?.scrollTo({ y: Math.max(0, measured.y - (viewportH - measured.h) / 2), animated: true });
  }, [currentLine, viewportH]);
  useEffect(() => {
    if (playbackSlide == null || stripDrag.current) return;
    const max = Math.max(0, 16 + times.length * 50 - 8 - 358);
    stripRef.current?.scrollTo({ x: Math.max(0, Math.min(max, 8 + playbackSlide * 50 + 21 - 179)), animated: true });
  }, [playbackSlide, times.length]);

  if (!model || !run) return null;
  const { deck, stats, total } = model;
  const note = (message: string) => {
    setAudioNote(message);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setAudioNote(''), 3000);
  };
  const wholeAudio = (): { segments: Segment[]; entries: RunAudioPlanEntry[] } => {
    const segments: Segment[] = [], entries: RunAudioPlanEntry[] = [];
    times.forEach((t, i) => {
      if (t <= 0) return;
      const part = run.parts[i], uri = part && audioOf(part.attemptId);
      if (!uri || !part) return;
      const selected = part.segments.filter(seg => seg.endMs > seg.startMs).map(seg => ({ uri, ...seg }));
      if (!selected.length) return;
      segments.push(...selected);
      entries.push({ slide: i, runStart: starts[i], durMs: t * 1000 });
    });
    return { segments, entries };
  };
  const toggleWhole = () => {
    const { segments, entries } = wholeAudio();
    if (!segments.length) { note('Audio for this run isn’t on this phone'); return; }
    setAudioNote('');
    setPlan(entries); setMode({ kind: 'run' });
    void player.playSegments(runKey, segments);
  };
  const toggleSection = (i: number) => {
    const part = run.parts[i], uri = part && audioOf(part.attemptId);
    if (!uri || !part || !part.segments.length) { note('Audio for this slide isn’t on this phone'); return; }
    setAudioNote('');
    setMode({ kind: 'slide', slide: i });
    void player.playSegments(`slide:${deck.id}:${i}`, part.segments.map(seg => ({ uri, ...seg })));
  };
  const coverage = stats?.coverage ?? null;
  const coverageLabel = coverage == null ? model.pending ? 'Transcribing' : deck.text === 'ready' ? 'No speech' : 'No slide text'
    : coverage >= 90 ? 'On point' : coverage >= 75 ? 'Almost there' : 'Needs work';
  const coverageColor = coverage == null ? c.secondary : coverage >= 90 ? c.good : coverage >= 75 ? c.warnAlt : c.badAlt;
  const gradient: readonly [string, string] = coverage == null || coverage >= 90 ? GRADE.green.gradient
    : coverage >= 75 ? ['#FFE58C', '#FF8A1E'] : GRADE.red.gradient;
  const delta = run.delta != null && Math.abs(run.delta) >= 1 ? run.delta : null;
  const over = total - run.targetSum;
  const row2Value = delta != null ? fmt(Math.abs(delta)) : stats?.coverage == null ? '—/' + (stats?.total ?? '—') : stats.said + '/' + stats.total;
  const row2Unit = delta != null ? delta < 0 ? 'faster than last' : 'slower than last' : 'points said';
  const row2Color = delta == null ? c.secondary : delta < 0 ? c.good : c.warnAlt;
  const rightText = audioNote || ((runPlaying || slidePlaying) && playbackSlide != null
    ? runPlaying ? `${fmt(pos)} / ${fmt(total)}` : `${fmt(pos - starts[playbackSlide])} / ${fmt(times[playbackSlide])}`
    : 'Tap a section to hear it');
  const headerText = (runPlaying || slidePlaying) && playbackSlide != null
    ? `Slide ${playbackSlide + 1} · ${deck.slides[playbackSlide]?.title ?? 'Slide ' + (playbackSlide + 1)}` : 'Whole run';

  return <Enter kind={nav.nav}>
    <PanView style={StyleSheet.absoluteFill} {...pan}>
      <Animated.View style={[StyleSheet.absoluteFill, screen]}>
        <PageSurface hue={deck.hue} />
        <View style={styles.header} pointerEvents="none">
          <Txt numberOfLines={1} style={[styles.title, { color: c.text }]}>{deck.title}</Txt>
          <Txt numberOfLines={1} style={[styles.label, { color: c.secondary }]}>{'Full review · ' + runLabel(run, now, relativeDay)}</Txt>
        </View>
        <View style={styles.ringRow}>
          <ScoreRing id="gFullScore" percent={coverage} value={coverage == null ? model.pending ? '…' : '—' : coverage + '%'}
            label={coverageLabel} labelColor={coverageColor} gradient={gradient} />
          <View style={styles.ringStats}>
            <Stat icon="i-clock" value={fmt(total)}
              unit={over > 3 ? fmt(over) + ' over' : over < -3 ? fmt(-over) + ' under' : 'on target'}
              color={over > 3 ? c.warn : over < -3 ? c.info : c.good} />
            <Stat icon={delta == null ? 'i-slides' : delta < 0 ? 'i-faster' : 'i-slower'}
              value={row2Value} unit={row2Unit} color={row2Color} opacity={delta == null && coverage == null ? 0.45 : 1} />
            <Stat icon="i-bubble" value={stats?.fpm == null ? '—' : stats.fpm.toFixed(1)} unit="fillers / min"
              color={c.secondary} opacity={stats?.fpm == null ? 0.45 : 1} />
            <Stat icon="i-gauge" value={stats?.wpm == null ? '—' : String(stats.wpm)}
              unit={stats?.pace ? 'wpm · ' + stats.pace : 'wpm'} color={c.secondary} opacity={stats?.wpm == null ? 0.45 : 1} />
          </View>
        </View>
        <View style={styles.whole}>
          <View style={styles.wholeHeader}>
            <Txt numberOfLines={1} style={[styles.wholeTitle, { color: c.text }]}>{headerText}</Txt>
            <Txt numberOfLines={1} style={[styles.wholeHint, { color: c.tertiary }]}>{rightText}</Txt>
          </View>
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" accessibilityLabel={runPlaying && !player.paused ? 'Pause' : `Play the whole run, ${fmt(total)}`}
              onPress={toggleWhole} style={styles.wholePlay}>
              <Glyph name={runPlaying && !player.paused ? 'p-pause' : 'p-play'} size={20} color={c.text} />
            </Pressable>
            <View style={styles.sections}>
              {times.map((t, i) => t <= 0 ? null : <Pressable key={i} accessibilityRole="button"
                accessibilityLabel={slidePlaying && playbackSlide === i && !player.paused ? `Pause slide ${i + 1}`
                  : `Play slide ${i + 1}, ${deck.slides[i]?.title ?? 'Slide ' + (i + 1)}, ${fmt(t)}`}
                onPress={() => toggleSection(i)} style={[styles.sectionHit, { flex: t, opacity: slidePlaying && playbackSlide !== i ? 0.35 : 1 }]}>
                <View style={[styles.sectionTrack, { backgroundColor: c.ink18 }]}>
                  <View style={[styles.sectionFill, { backgroundColor: c.text,
                    width: `${100 * ((runPlaying || slidePlaying) && (runPlaying || playbackSlide === i) ? clamp((pos - starts[i]) / t) : 0)}%` }]} />
                </View>
              </Pressable>)}
            </View>
          </View>
        </View>
        <ScrollView ref={transcriptRef} style={styles.transcript} contentContainerStyle={styles.transcriptContent}
          onLayout={e => {
            const { y, height } = e.nativeEvent.layout;
            transcriptBounds.current = { top: y, bottom: y + height };
            setViewportH(height);
          }} onScrollBeginDrag={() => { transcriptDrag.current = true; }}
          onScrollEndDrag={() => { transcriptDrag.current = false; }} onMomentumScrollBegin={() => { transcriptDrag.current = true; }}
          onMomentumScrollEnd={() => { transcriptDrag.current = false; }} showsVerticalScrollIndicator={false}>
          {lines.length ? lines.map((line, i) => <TranscriptRow key={line.key} line={line}
            first={i === 0 || lines[i - 1].slide !== line.slide} active={currentLine === line.key}
            playing={playing} layouts={rowLayouts} />)
            : <Txt style={[styles.emptyTranscript, { color: c.secondary }]}>
              {model.pending ? 'Transcribing… the transcript appears here' : 'No speech detected in this run'}
            </Txt>}
        </ScrollView>
        <View style={styles.slidesHeader}>
          <Txt style={[styles.slidesTitle, { color: c.text }]}>Slides</Txt>
          <View style={styles.legend}>
            {GRADE_ORDER.map(key => <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: GRADE[key].fill }]} />
              <Txt style={[styles.legendCount, { color: c.text }]}>{counts[key]}</Txt>
              <Txt style={[styles.legendName, { color: c.secondary }]}>{GRADE[key].label}</Txt>
            </View>)}
          </View>
        </View>
        <View style={[styles.stripCard, { borderColor: c.hair, backgroundColor: c.surface06 }]}>
          <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
            onScrollBeginDrag={() => { stripDrag.current = true; }} onScrollEndDrag={() => { stripDrag.current = false; }}
            onMomentumScrollBegin={() => { stripDrag.current = true; }} onMomentumScrollEnd={() => { stripDrag.current = false; }}>
            {times.map((t, i) => {
              const grade = grades[i]?.key ?? 'none' as GradeKey;
              const fill = grade !== 'none' && grade !== 'pending' ? GRADE[grade].fill : c.ink08;
              const tileInk = grade !== 'none' && grade !== 'pending' ? '#14161D' : c.secondary;
              const selected = (runPlaying || slidePlaying) && playbackSlide === i;
              return <Pressable key={i} accessibilityRole="button"
                accessibilityLabel={`Slide ${i + 1}, ${deck.slides[i]?.title ?? 'Slide ' + (i + 1)}, ${t > 0 ? fmt(t) : 'not reached'}, ${grade === 'pending' ? 'pending' : grade === 'none' ? 'not reached' : GRADE[grade].label.toLowerCase()}. Open its review`}
                onPress={() => openSlide(i)} style={styles.tileWrap}>
                {selected && <View style={[styles.tileOutline, { borderColor: c.strong }]} />}
                <View style={[styles.tile, { backgroundColor: fill }]}>
                  <Txt style={[styles.tileNum, { color: tileInk }]}>{i + 1}</Txt>
                  <Txt style={[styles.tileTime, { color: tileInk }]}>{t <= 0 ? '—' : fmt(t)}</Txt>
                </View>
              </Pressable>;
            })}
          </ScrollView>
        </View>
        <HintRow hints={[{ icon: 'h-dn', text: nav.from === 'review' ? 'Back to review' : 'Back', nudge: 'down' },
          { icon: 'h-tap', text: 'Tap a slide to review it' }]} />
      </Animated.View>
    </PanView>
  </Enter>;
}

function slideAtElapsed(elapsedMs: number, plan: readonly RunAudioPlanEntry[]): number | null {
  if (!plan.length) return null;
  let remaining = Math.max(0, elapsedMs);
  for (const entry of plan) {
    if (remaining < entry.durMs) return entry.slide;
    remaining -= entry.durMs;
  }
  return plan[plan.length - 1].slide;
}
function Stat({ icon, value, unit, color, opacity = 1 }: {
  icon: 'i-clock' | 'i-faster' | 'i-slower' | 'i-slides' | 'i-bubble' | 'i-gauge';
  value: string; unit: string; color: string; opacity?: number;
}) {
  const { c } = useTheme();
  return <View style={[styles.statRow, { opacity }]}>
    <UIIcon name={icon} size={22} />
    <Txt style={[styles.statValue, { color: c.text }]}>{value}</Txt>
    <Txt numberOfLines={1} style={[styles.statUnit, { color }]}>{unit}</Txt>
  </View>;
}
const TranscriptRow = memo(function TranscriptRow({ line, first, active, playing, layouts }: {
  line: Line; first: boolean; active: boolean; playing: boolean; layouts: React.RefObject<Map<string, RowLayout>>;
}) {
  const { c } = useTheme();
  return <View style={styles.transcriptRow} onLayout={e => {
    layouts.current.set(line.key, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height });
  }}
    accessible accessibilityLabel={first ? `Slide ${line.slide + 1}. ${line.text}` : line.text}>
    {first ? <View style={[styles.badge, { backgroundColor: c.ink14 }]}>
      <Txt style={[styles.badgeText, { color: c.body }]}>{line.slide + 1}</Txt>
    </View> : <View style={styles.badgeSpacer} />}
    <Txt style={[styles.transcriptText, { color: !playing ? c.body : active ? c.strong : c.secondary,
      fontFamily: active ? F.semibold : F.medium }]}>{line.text}</Txt>
  </View>;
});

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3 },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13 },
  ringRow: { position: 'absolute', left: 16, right: 16, top: 140, height: 120, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringStats: { width: 196, gap: 10 },
  statRow: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontFamily: F.display, fontSize: 18, lineHeight: 20, fontVariant: ['tabular-nums'] },
  statUnit: { flexShrink: 1, fontFamily: F.medium, fontSize: 13 },
  whole: { position: 'absolute', left: 16, right: 16, top: 278, height: 55 },
  wholeHeader: { height: 17, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  wholeTitle: { flex: 1, minWidth: 0, fontFamily: F.bold, fontSize: 14 },
  wholeHint: { flexShrink: 1, fontFamily: F.medium, fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: { marginTop: 6, height: 32, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wholePlay: { width: 32, height: 32, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  sections: { flex: 1, height: 28, flexDirection: 'row', alignItems: 'center' },
  sectionHit: { flexBasis: 0, minWidth: 0, height: 28, justifyContent: 'center' },
  sectionTrack: { height: 6, marginHorizontal: 1, borderRadius: 3, overflow: 'hidden' },
  sectionFill: { height: 6, borderRadius: 3 },
  transcript: { position: 'absolute', left: 16, right: 16, top: 343, bottom: 169 },
  transcriptContent: { paddingVertical: 8, gap: 6 },
  transcriptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  badge: { width: 20, height: 18, marginTop: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  badgeSpacer: { width: 20, height: 18 },
  badgeText: { fontFamily: F.display, fontSize: 10.5, lineHeight: 18 },
  transcriptText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  emptyTranscript: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 20 },
  slidesHeader: { position: 'absolute', left: 16, right: 16, top: 693, height: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slidesTitle: { fontFamily: F.bold, fontSize: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendCount: { fontFamily: F.bold, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  legendName: { fontFamily: F.semibold, fontSize: 11.5 },
  stripCard: { position: 'absolute', left: 16, right: 16, top: 718, height: 58, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  stripContent: { height: 56, paddingHorizontal: 8, alignItems: 'center', gap: 8 },
  tileWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  tileOutline: { position: 'absolute', top: -4, bottom: -4, left: -4, right: -4, borderWidth: 2, borderRadius: 15 },
  tile: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tileNum: { fontFamily: F.display, fontSize: 15, lineHeight: 15 },
  tileTime: { fontFamily: F.semibold, fontSize: 9.5, opacity: 0.72, fontVariant: ['tabular-nums'] },
});
