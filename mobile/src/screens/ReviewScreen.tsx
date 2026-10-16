// OpenAI Codex Review and Full review: docs/ai-collaboration/iteration-2/prompt-log.md#review-and-full-review-redesign-october-15-2026
// OpenAI Codex Review count label removal: docs/ai-collaboration/iteration-2/prompt-log.md#review-count-label-removal-october-15-2026
// Keeps the existing timing bars, stationary page fades, Q&A gesture, real PDF preview and explicit AI request.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Enter, Txt, useFrame } from '../design/frame';
import { GradeGrid } from '../design/GradeGrid';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { ScoreRing } from '../design/ScoreRing';
import { MiniSlide } from '../design/SlideCard';
import { EASE_SCREEN, F } from '../design/tokens';
import { useTheme } from '../design/theme';
import { HintRow, IconRow, PageSurface, Pill } from '../design/ui';
import { feedbackRows, GRADE, GRADE_ORDER, slideGrade, slideVerdict, type GradeKey } from '../domain/analysis';
import { fmt, relativeDay } from '../domain/format';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { runLabel } from '../domain/run';
import { slideText } from '../domain/lines';
import { fillerTotal } from '../domain/words';
import { audioOf, useWorkers } from '../features/rehearsal/analysis';
import { requestCoaching, retainCoaching, useCoaches } from '../features/rehearsal/coaching';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useBack, useNow, useShell } from './shared';

export function ReviewScreen({ active = true }: { active?: boolean }) {
  const { c } = useTheme();
  const { go, nav } = useShell();
  const frame = useFrame();
  const model = useDeckModel(nav.deckId);
  const n = model?.n ?? 0;
  // NavState is the source of truth, including when a Full-review tile reopens this mounted layer.
  const s = Math.max(0, Math.min(Math.max(0, n - 1), nav.sel));
  const player = useSegmentPlayer();
  const stopPlayback = player.stop;
  const dy = useSharedValue(0);
  const backExiting = useRef(false);
  const [audioNote, setAudioNote] = useState<number | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coaches = useCoaches();
  const workers = useWorkers();
  const now = useNow();

  useEffect(() => { if (!active) { dy.set(0); stopPlayback(); } }, [active, dy, stopPlayback]);
  useEffect(() => { stopPlayback(); }, [s, stopPlayback]);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); stopPlayback(); }, [stopPlayback]);

  const run = model?.state.run ?? null;
  const partId = run?.parts[s]?.attemptId ?? null;
  useEffect(() => partId ? retainCoaching(partId) : undefined, [partId]);
  const coach = partId ? coaches.get(partId) : undefined;
  const worker = partId ? workers.get(partId) : undefined;
  const pending = !!partId && !!model && !model.transcripts.has(partId) && model.stages.get(partId) !== 'no_speech';
  const grades = useMemo(() => {
    if (!model || !run) return [];
    return model.times.map((_, i) => {
      const id = run.parts[i]?.attemptId;
      return slideGrade(i, { times: model.times, targets: model.deck.targets, lines: model.lines, points: model.points,
        ai: model.ai, haveText: model.deck.text === 'ready',
        pending: !!id && !model.transcripts.has(id) && model.stages.get(id) !== 'no_speech' });
    });
  }, [model, run]);
  const counts = useMemo(() => Object.fromEntries(GRADE_ORDER.map(key =>
    [key, grades.filter(g => g.key === key).length])) as Record<(typeof GRADE_ORDER)[number], number>, [grades]);

  const toBack = useCallback(() => {
    stopPlayback();
    if (nav.from === 'full') go('full', { deckId: nav.deckId });
    else go('rehearse', { nav: null, deckId: nav.deckId, slide: s });
  }, [go, nav.deckId, nav.from, stopPlayback, s]);
  const toQA = useCallback(() => {
    stopPlayback();
    go('qa', { nav: 'fade', deckId: nav.deckId, sel: s });
  }, [go, nav.deckId, stopPlayback, s]);
  const toFull = useCallback(() => {
    stopPlayback();
    if (nav.from === 'full') go('full', { deckId: nav.deckId });
    else go('full', { nav: 'fade', deckId: nav.deckId, from: 'review' });
  }, [go, nav.deckId, nav.from, stopPlayback]);
  const pan = {
    onMoveShould: (e: GestureResponderEvent, g: PanResponderGestureState) => {
      const y = (e.nativeEvent.pageY - frame.top) / frame.s;
      return !backExiting.current && Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx)
        && !(y > 296 && y < 404 && Math.abs(g.dx) > 4);
    },
    onMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
      const d = g.dy / frame.s, a = Math.abs(d);
      dy.set(d > 0 ? Math.min(BACK_FADE_Y, d) : -(a > 160 ? 160 + (a - 160) * 0.5 : a));
    },
    onRelease: () => {
      if (dy.get() > BACK_T) {
        backExiting.current = true;
        dy.set(withTiming(BACK_FADE_Y, { duration: 220, easing: EASE_SCREEN }, finished => {
          if (finished) runOnJS(toBack)();
        }));
      } else if (dy.get() < -BACK_T) toQA();
      else dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
    },
    onTerminate: () => { if (!backExiting.current) dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN })); },
  };
  useBack(active, () => { toBack(); return true; });
  const screen = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.max(0, dy.value) / BACK_FADE_Y) }));

  if (!model || !run) return null;
  const { deck, times, lines, state } = model;
  const targets = deck.targets;
  const maxT = Math.max(1, ...times);
  const t = times[s] ?? 0, target = targets[s] ?? 0;
  const verdict = slideVerdict(t, target);
  const rows = feedbackRows(s, { times, targets, lines, points: model.points, ai: model.ai,
    haveText: deck.text === 'ready', pending, worker });
  const grade = grades[s] ?? { key: 'none' as GradeKey, percent: null };
  const graded = grade.key !== 'none' && grade.key !== 'pending' ? GRADE[grade.key] : null;
  const gradeLabel = graded?.label ?? (grade.key === 'pending' ? 'Transcribing' : 'Not reached');
  const gradeColor = grade.key === 'green' ? c.good : grade.key === 'yellow' ? c.gold
    : grade.key === 'orange' ? c.warnAlt : grade.key === 'red' ? c.badAlt : c.secondary;
  const issueCount = Number(rows[2].status === 'finding') + Number(rows[3].status === 'finding');
  const fillers = pending || t <= 0 ? '—' : String(fillerTotal(slideText(lines, s)));
  const label = runLabel(run, now, relativeDay) + (state.fixes ? ' · ' + state.fixes + (state.fixes === 1 ? ' transcript fix' : ' transcript fixes') : '');
  const key = `slide:${deck.id}:${s}`;
  const isCurrent = player.playingKey === key;
  const audioPart = run.parts[s];
  const showMissing = () => {
    setAudioNote(s);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setAudioNote(null), 3000);
  };
  const toggleSlide = () => {
    if (!audioPart || t <= 0) return;
    const uri = audioOf(audioPart.attemptId);
    if (!uri) { showMissing(); return; }
    setAudioNote(null);
    void player.playSegments(key, audioPart.segments.map(segment => ({ uri, ...segment })));
  };
  const hasAi = model.ai.some(a => a.slide === s);
  const canAsk = t > 0 && !pending && !!partId && !hasAi;
  const askDisabled = !!coach?.busy || coach?.done || !!coach?.prompt ||
    (!!coach?.details.feedback && (coach.details.feedback.availability.state !== 'available' ||
      (coach.details.feedback.feedback_revision > 0 && !coach.details.feedback.retry_available)));
  const coachNotice = !!coach && (!!coach.busy || !!coach.notice || coach.done);

  return <Enter kind={nav.nav}>
    <PanView style={StyleSheet.absoluteFill} {...pan}>
      <Animated.View style={[StyleSheet.absoluteFill, screen]}>
        <PageSurface hue={deck.hue} />
        <View style={styles.header} pointerEvents="none">
          <Txt numberOfLines={1} style={[styles.title, { color: c.text }]}>{deck.title}</Txt>
          <Txt numberOfLines={1} style={[styles.label, { color: c.secondary }]}>{label}</Txt>
        </View>
        <View style={styles.ringRow} accessible accessibilityLabel={`Slide ${s + 1} of ${n}: ${grade.percent == null ? gradeLabel : grade.percent + '%, ' + gradeLabel}`}>
          <ScoreRing id="gSlideScore" percent={grade.percent} value={grade.percent == null ? grade.key === 'pending' ? '…' : '—' : grade.percent + '%'}
            label={gradeLabel} labelColor={gradeColor} gradient={graded?.gradient ?? GRADE.green.gradient} animate />
          <View style={styles.ringRight}>
            <Txt numberOfLines={1} style={[styles.ringSlide, { color: c.secondary }]}>{`Slide ${s + 1} of ${n}`}</Txt>
            <View style={styles.ringStats}>
              <Stat icon="i-clock" value={t > 0 ? fmt(t) : '—'} unit={t > 0 ? `of ${fmt(target)} target` : ''} color={t - target >= 15 ? c.warn : c.secondary} opacity={t > 0 ? 1 : 0.45} />
              <Stat icon="i-bubble" value={fillers} unit={pending || t <= 0 ? '' : Number(fillers) === 1 ? 'filler' : 'fillers'} color={c.secondary} opacity={pending || t <= 0 ? 0.45 : 1} />
              <Stat icon="i-flag" value={pending || t <= 0 ? '—' : String(issueCount)}
                unit={pending || t <= 0 ? '' : issueCount === 1 ? 'issue flagged' : 'issues flagged'} color={c.secondary} opacity={pending || t <= 0 ? 0.45 : 1} />
            </View>
          </View>
        </View>
        <View style={styles.timesBlock}>
          <View style={styles.barsHead} pointerEvents="none">
            <Txt style={[styles.barsTitle, { color: c.text }]}>Times per slide</Txt>
            <Txt style={[styles.barsHint, { color: c.tertiary }]}>Tap a bar</Txt>
          </View>
          <View style={styles.bars}>
            {times.map((tb, b) => {
              const over = tb > 0 && tb - (targets[b] ?? 0) >= 15, isSel = b === s;
              return <Pressable key={b} accessibilityRole="button" accessibilityState={{ selected: isSel }}
                accessibilityLabel={'Slide ' + (b + 1) + ', ' + (tb > 0 ? fmt(tb) : 'not reached')}
                onPress={() => { stopPlayback(); go('review', { sel: b }); }}
                style={{ flex: 1, minWidth: 0, height: tb > 0 ? Math.max(6, Math.round((tb / maxT) * 78)) : 4,
                  borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
                  overflow: 'hidden', backgroundColor: isSel ? c.strong : over ? undefined : tb > 0 ? c.ink28 : c.ink08 }}>
                {over && !isSel && <OverBar />}
              </Pressable>;
            })}
          </View>
          <View style={styles.nums} pointerEvents="none">
            {times.map((tb, b) => {
              const over = tb > 0 && tb - (targets[b] ?? 0) >= 15, isSel = b === s;
              return <Txt key={b} style={[styles.num, { color: isSel ? c.strong : c.coralText }]}>{isSel || over ? String(b + 1) : ''}</Txt>;
            })}
          </View>
        </View>
        <View style={[styles.card, { borderColor: c.hair, backgroundColor: c.surface06 }]}>
          <View style={styles.previewRow}>
            <MiniSlide hue={deck.hue} page={deck.pages[s]} title={deck.slides[s]?.title ?? ''} width={170} height={96} radius={12} />
            <View style={styles.previewCopy}>
              <Txt style={[styles.previewNum, { color: c.secondary }]}>{'Slide ' + (s + 1)}</Txt>
              <Txt numberOfLines={2} style={[styles.previewTitle, { color: c.text }]}>{deck.slides[s]?.title ?? 'Slide ' + (s + 1)}</Txt>
              <View style={styles.previewTimeRow}>
                <Txt style={[styles.previewTime, { color: c.text }]}>{t > 0 ? fmt(t) + ' of ' + fmt(target) : 'Not reached'}</Txt>
                {verdict.chip && <Pill text={verdict.chip.text} tone={verdict.chip.tone} />}
              </View>
            </View>
          </View>
          <View style={[styles.playback, { opacity: t > 0 ? 1 : 0.4 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={t <= 0 ? `Slide ${s + 1} was not reached`
              : isCurrent && !player.paused ? `Pause slide ${s + 1}` : `Play slide ${s + 1}, ${fmt(t)}`}
              disabled={t <= 0} onPress={toggleSlide} style={styles.playButton}>
              <Glyph name={isCurrent && !player.paused ? 'p-pause' : 'p-play'} size={18} color={c.text} />
            </Pressable>
            <View style={[styles.playTrack, { backgroundColor: c.ink18 }]}>
              <View style={[styles.playFill, { width: `${(isCurrent ? player.progress : 0) * 100}%`, backgroundColor: c.text }]} />
            </View>
            <Txt numberOfLines={1} style={[styles.playTime, { color: c.tertiary }]}>{audioNote === s ? 'No audio' : isCurrent ? `${fmt(player.elapsedMs / 1000)} / ${fmt(t)}` : fmt(t)}</Txt>
          </View>
          <View style={styles.feedback}>
            {rows.map((row, i) => i === 3 && canAsk ? (
              <View key={row.icon} style={styles.feedbackWithAction}>
                <UIIcon name={row.icon} size={22} />
                <Txt numberOfLines={1} style={[styles.feedbackText, { color: coachNotice ? c.secondary : row.status === 'spot' ? c.good : row.status === 'muted' ? c.secondary : c.body,
                  fontFamily: row.status === 'spot' && !coachNotice ? F.bold : F.regular }]}>
                  {coachNotice ? coach.notice || coach.label : row.text}
                </Txt>
                {!coachNotice && <Pressable accessibilityRole="button" accessibilityLabel="Ask AI for suggestions"
                  disabled={askDisabled} onPress={() => partId && requestCoaching(partId)} style={styles.askButton}>
                  <Txt style={{ fontFamily: F.semibold, fontSize: 12, color: c.info, opacity: askDisabled ? 0.45 : 1 }}>Ask AI</Txt>
                </Pressable>}
              </View>
            ) : <IconRow key={row.icon} icon={row.icon} text={row.text} tone={row.status === 'spot' ? 'spot' : row.status === 'muted' ? 'muted' : 'normal'} singleLine />)}
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Full review: ${counts.green} strong, ${counts.yellow} good, ${counts.orange} needs work, ${counts.red} weak slides`}
          onPress={toFull} style={[styles.fullButton, { borderColor: c.hair, backgroundColor: c.surface06 }]}>
          <GradeGrid />
          <View style={styles.fullCopy}>
            <Txt style={[styles.fullTitle, { color: c.text }]}>Full review</Txt>
            <View style={styles.fullCounts}>
              {GRADE_ORDER.map(gradeKey => <View key={gradeKey} style={styles.countPair}>
                <View style={[styles.countDot, { backgroundColor: GRADE[gradeKey].fill }]} />
                <Txt style={[styles.countNum, { color: c.text }]}>{counts[gradeKey]}</Txt>
              </View>)}
            </View>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M9.5 5.5 L16 12 L9.5 18.5" fill="none" stroke={c.secondary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </Pressable>
        <HintRow hints={[{ icon: 'h-dn', text: nav.from === 'full' ? 'Full review' : 'Back to slides', nudge: 'down' },
          { icon: 'h-up', text: 'Audience Q&A', nudge: 'up' }]} />
      </Animated.View>
    </PanView>
  </Enter>;
}

function Stat({ icon, value, unit, color, opacity }: { icon: 'i-clock' | 'i-bubble' | 'i-flag'; value: string; unit: string; color: string; opacity: number }) {
  const { c } = useTheme();
  return <View style={[styles.statRow, { opacity }]}>
    <UIIcon name={icon} size={22} />
    <Txt style={[styles.statValue, { color: c.text }]}>{value}</Txt>
    <Txt numberOfLines={1} style={[styles.statUnit, { color }]}>{unit}</Txt>
  </View>;
}
function OverBar() {
  return <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
    <Defs><LinearGradient id="gReviewOver" x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0" stopColor={GRADE.red.gradient[0]} /><Stop offset="1" stopColor={GRADE.red.gradient[1]} />
    </LinearGradient></Defs>
    <Rect width="100%" height="100%" fill="url(#gReviewOver)" />
  </Svg>;
}

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3 },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13 },
  ringRow: { position: 'absolute', left: 16, right: 16, top: 140, height: 120, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringRight: { width: 196, height: 117, justifyContent: 'flex-start' },
  ringSlide: { fontFamily: F.semibold, fontSize: 14, lineHeight: 17 },
  ringStats: { marginTop: 14, gap: 10 },
  statRow: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontFamily: F.display, fontSize: 18, lineHeight: 20, fontVariant: ['tabular-nums'] },
  statUnit: { flexShrink: 1, fontFamily: F.medium, fontSize: 13 },
  timesBlock: { position: 'absolute', left: 16, right: 16, top: 278 },
  barsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  barsTitle: { fontFamily: F.bold, fontSize: 14 },
  barsHint: { fontFamily: F.medium, fontSize: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 80, marginTop: 8 },
  nums: { flexDirection: 'row', gap: 3, height: 14, marginTop: 4 },
  num: { flex: 1, minWidth: 0, textAlign: 'center', fontFamily: F.bold, fontSize: 10 },
  card: { position: 'absolute', left: 16, right: 16, top: 419, height: 281, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderRadius: 20, justifyContent: 'space-between' },
  previewRow: { height: 96, flexDirection: 'row', alignItems: 'center', gap: 14 },
  previewCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  previewNum: { fontFamily: F.semibold, fontSize: 12 },
  previewTitle: { marginTop: 2, fontFamily: F.display, fontSize: 17, lineHeight: 19.5 },
  previewTimeRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  previewTime: { fontFamily: F.semibold, fontSize: 13, fontVariant: ['tabular-nums'] },
  playback: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 6 },
  playButton: { width: 28, height: 28, marginLeft: -7, alignItems: 'center', justifyContent: 'center' },
  playTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  playFill: { height: 6, borderRadius: 3 },
  playTime: { minWidth: 34, textAlign: 'right', fontFamily: F.medium, fontSize: 12, fontVariant: ['tabular-nums'] },
  feedback: { gap: 6 },
  feedbackWithAction: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 16.9 },
  askButton: { width: 48, height: 28, marginVertical: -3, alignItems: 'center', justifyContent: 'center' },
  fullButton: { position: 'absolute', left: 16, right: 16, bottom: 68, height: 58, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fullCopy: { flex: 1, minWidth: 0 },
  fullTitle: { fontFamily: F.display, fontSize: 16, lineHeight: 19.2 },
  fullCounts: { marginTop: 4, height: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  countPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countDot: { width: 8, height: 8, borderRadius: 4 },
  countNum: { fontFamily: F.bold, fontSize: 12, fontVariant: ['tabular-nums'] },
});
