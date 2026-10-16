// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode compare: docs/ai-collaboration/iteration-2/prompt-log.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration/iteration-2/prompt-log.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OutLoud redesign: Compare takes (SPEC §4.5). No swipes on this screen.
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Enter, Txt } from '../design/frame';
import { UIIcon } from '../design/icons';
import { C, F, HUES } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { Chip, IconRow, PageSurface, Pop, RecordButton } from '../design/ui';
import { compareChips, compareRows, summarizeTake, type TakeSummary } from '../domain/analysis';
import { fmt, quote } from '../domain/format';
import { buildLines } from '../domain/lines';
import { partSeconds, runAttemptIds, type Run } from '../domain/run';
import { scorablePoints } from '../domain/words';
import { resolveCompare } from '../features/rehearsal/takes';
import { transcriptsFor, useDeckModel } from '../features/presentations/useDeckModel';
import { useBack, useShell } from './shared';

export function CompareScreen() {
  const { c: palette } = useTheme();
  const { go, nav } = useShell();
  const model = useDeckModel(nav.deckId);
  const [keep, setKeep] = useState<'old' | 'new'>('old');
  const c = model?.state.compare ?? null;

  const view = useMemo(() => {
    if (!model || !c) return null;
    const { deck } = model;
    const sl = c.slides, first = sl[0], last = sl[sl.length - 1];
    const tgt = sl.reduce((a, i) => a + (deck.targets[i] ?? 0), 0);
    const points = sl.flatMap(i => scorablePoints(deck.slides[i]?.points ?? []));
    const summary = (run: Run) => {
      const ids = runAttemptIds({ ...run, parts: sl.map(i => run.parts[i]) });
      const { transcripts, stages } = transcriptsFor(ids);
      const lines = buildLines(run, model.n, transcripts, model.state.edits, model.vocab).filter(l => sl.includes(l.slide));
      const ready = ids.every(id => transcripts.has(id) || stages.get(id) === 'no_speech');
      return summarizeTake(sl.map(i => partSeconds(run.parts[i])), lines, points, ready);
    };
    const A = summary(c.prev), B = summary(c.next);
    return {
      title: c.whole ? deck.title : sl.length === 1 ? deck.slides[first]?.title ?? 'Slide ' + (first + 1) : 'Slides ' + (first + 1) + '–' + (last + 1),
      label: (c.whole ? 'Whole presentation' : sl.length === 1 ? 'Slide ' + (first + 1) : sl.length + ' slides') + ' · choose one recording',
      A, B, tgt, points, first, whole: c.whole, many: sl.length > 1,
    };
  }, [c, model]);

  const finish = useCallback((which: 'old' | 'new') => {
    if (!model || !view) return;
    resolveCompare(model.deck.id, which);
    go('rehearse', { nav: 'fade', deckId: model.deck.id, slide: view.first, sel: view.first });
  }, [go, model, view]);
  // System Back leaves the current recording in place.
  useBack(true, useCallback(() => { finish('old'); return true; }, [finish]));

  if (!model || !view) return null;
  const glow = HUES[model.deck.hue].glow;
  const tone = (a: number | null, b: number | null, lowerBetter: boolean) => (a == null || b == null || a === b ? palette.text : (lowerBetter ? b < a : b > a) ? palette.good : palette.bad);
  const card = (kind: 'old' | 'new', T: TakeSummary, O: TakeSummary) => {
    const isNew = kind === 'new', kept = keep === kind;
    const rows = [
      { k: 'Fillers', v: T.ready ? String(T.ft) : '…', c: isNew && T.ready && O.ready ? tone(O.ft, T.ft, true) : palette.text },
      { k: 'Points', v: view.points.length ? (T.ready ? T.said.length + ' / ' + view.points.length : '…') : '—', c: isNew && T.ready && O.ready && view.points.length ? tone(O.said.length, T.said.length, false) : palette.text },
      { k: 'Pace', v: T.wpm != null ? T.wpm + ' wpm' : T.ready ? '—' : '…', c: palette.text },
    ];
    const open = !T.ready ? 'Transcribing…' : T.open ? quote(T.open) : 'Nothing said';
    return (
      <Pressable key={kind} accessibilityRole="button" accessibilityState={{ selected: kept }}
        accessibilityLabel={(isNew ? 'Overwrite with new recording' : 'Keep current recording') + ', ' + fmt(T.time) + (T.ready ? ', ' + T.ft + ' filler words' : '') + (T.wpm ? ', ' + T.wpm + ' words per minute' : '') + '. ' + (kept ? 'Selected' : 'Tap to select')}
        onPress={() => setKeep(kind)}
        style={[styles.card, { borderColor: kept ? palette.border50 : palette.hair,
          backgroundColor: kept ? palette.surface10 : palette.surface04,
          opacity: kept ? 1 : 0.6, boxShadow: kept ? `0px 18px 36px ${glow}` : undefined }]}>
        <View style={styles.cardHead}>
          <Txt style={styles.cardLabel}>{isNew ? 'Overwrite' : 'Keep current'}</Txt>
          {kept && <Pop><UIIcon name="i-check" size={22} /></Pop>}
        </View>
        <Txt style={styles.cardTime}>{fmt(T.time)}</Txt>
        <View style={styles.cardRows}>
          {rows.map(r => (
            <View key={r.k} style={styles.cardRow}><Txt style={styles.k}>{r.k}</Txt><Txt style={[styles.v, { color: r.c }]}>{r.v}</Txt></View>
          ))}
        </View>
        <View style={styles.openBox}>
          <Txt style={styles.openLabel}>Opened with</Txt>
          <Txt numberOfLines={5} style={styles.open}>{open}</Txt>
        </View>
      </Pressable>
    );
  };
  return (
    <Enter kind={nav.nav}>
      <PageSurface hue={model.deck.hue} />
      <View style={styles.header} pointerEvents="none">
        <Txt numberOfLines={1} style={styles.title}>{view.title}</Txt>
        <Txt style={styles.label}>{view.label}</Txt>
      </View>
      <View style={styles.col}>
        <View style={styles.bigRow} pointerEvents="none">
          <Txt style={styles.big}>{fmt(view.B.time)}</Txt>
          <Txt style={styles.sub}>{'/ ' + fmt(view.tgt)}</Txt>
        </View>
        <View style={styles.chips} pointerEvents="none">{compareChips(view.A, view.B, view.tgt).map(ch => <Chip key={ch.text} chip={ch} />)}</View>
        <View style={styles.cards}>{card('old', view.A, view.B)}{card('new', view.B, view.A)}</View>
        <View style={{ gap: 8, marginTop: 4 }} pointerEvents="none">
          {compareRows(view.A, view.B, view.points).map(r => <IconRow key={r.text} icon={r.icon} text={r.text} />)}
        </View>
      </View>
      <Svg width={112} height={112} viewBox="0 0 112 112" style={styles.ring} pointerEvents="none"><Circle cx={56} cy={56} r={52} fill="none" stroke={palette.track} strokeWidth={4} /></Svg>
      <RecordButton green glyph="check" label={keep === 'old' ? 'Keep current recording' : 'Overwrite with new recording'} onPress={() => finish(keep)} />
    </Enter>
  );
}

const styles = createThemedStyles({
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13, color: C.secondary },
  col: { position: 'absolute', left: 16, right: 16, top: 102, gap: 12 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
  big: { fontFamily: F.display, fontSize: 50, lineHeight: 52, letterSpacing: -1.6, color: C.text, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: F.semibold, fontSize: 17, color: C.secondary, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  cards: { flexDirection: 'row', gap: 12, marginTop: 4 },
  card: { flex: 1, minWidth: 0, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 16, borderWidth: 1.5, borderRadius: 22, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 22 },
  cardLabel: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.secondary },
  cardTime: { fontFamily: F.display, fontSize: 32, lineHeight: 34, letterSpacing: -0.8, color: C.text, fontVariant: ['tabular-nums'] },
  cardRows: { gap: 7, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
  cardRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  k: { fontFamily: F.medium, fontSize: 13, color: C.secondary },
  v: { fontFamily: F.bold, fontSize: 13, fontVariant: ['tabular-nums'] },
  openBox: { paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' },
  openLabel: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  open: { marginTop: 5, minHeight: 90, fontFamily: F.medium, fontSize: 13, lineHeight: 17.9, color: '#D9DAE0' },
  ring: { position: 'absolute', left: 139, top: 660 },
});
