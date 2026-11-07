// Home's v2 score and three compact run statistics (UI spec S01).
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Txt, useFrame } from '../design/frame';
import { UIIcon } from '../design/icons';
import { useRunPresentationScores } from '../features/feedback/useRunPresentationScores';
import { scoreLevelColor, scoreNumber } from '../features/feedback/presentationScoreDisplay';
import { createThemedStyles, useTheme } from '../design/theme';
import { C, F } from '../design/tokens';
import { PULL_T } from '../domain/gestures';
import { fmt } from '../domain/format';
import { useDeckModel } from '../features/presentations/useDeckModel';
import type { HomeShared } from './shared';

export function HomeFeedbackStats({ deckId, home, active, onOpenReview }: { deckId: string | null; home: HomeShared; active: boolean; onOpenReview: () => void }) {
  const { c } = useTheme();
  const compact = useFrame().compact;
  const model = useDeckModel(deckId);
  const scores = useRunPresentationScores(model, active);
  const style = useAnimatedStyle(() => {
    const pull = Math.min(1, Math.abs(home.vy.value) / PULL_T), fraction = Math.abs(home.p.value - Math.round(home.p.value));
    return { opacity: (home.vy.value < 0 ? 1 - Math.min(1, pull * 1.6) * 0.9 : 1) * Math.max(0, 1 - fraction * 2.4) };
  });
  if (!model) return null;
  const { stats, state } = model;
  const run = state.run;
  const score = run ? scoreNumber(scores.overall.score) : null;
  const color = score === null ? c.muted : scoreLevelColor(scores.overall.level, c);
  const critical = scores.items.filter(item => item.level === 'beginning' || item.level === 'emerging').length;
  const hasSlideScores=scores.items.some(item=>item.score!==null);
  const target = model.deck.targets.reduce((sum, seconds) => sum + seconds, 0);
  const cols = [
    { icon: !hasSlideScores ? null : critical ? 'i-flag' as const : 'i-check' as const, value: hasSlideScores?String(critical):'—', label: 'critical', color: !hasSlideScores?c.muted:critical ? c.bad : c.good },
    { icon: null, value: run ? fmt(model.total) : '—', label: target ? `of ${fmt(target)}` : 'duration', color: run && target && model.total > target ? c.gold : c.text },
    { icon: null, value: stats?.wpm == null ? '—' : String(stats.wpm), label: 'wpm', color: c.text },
  ];
  const composed = !!run && scores.overall.status === 'Combined recordings';
  return <Animated.View pointerEvents="box-none" style={[styles.root, style]}>
    {score !== null ? <Pressable accessibilityRole="button" accessibilityLabel={`Open full review, presentation score ${score} percent`}
      onPress={onOpenReview} style={styles.scoreTarget}><Txt style={[styles.score, compact && styles.compactScore, { color }]}>{score}<Txt style={[styles.unit, compact && styles.compactUnit, { color }]}>%</Txt></Txt></Pressable>
      : run ? <Txt style={[styles.score, compact && styles.compactScore, { color: c.muted, opacity: 0.45 }]}>—</Txt>
        : <Txt style={[styles.noRun, { color: c.muted }]}>No run yet</Txt>}
    {composed && <Txt style={[styles.composed, { color: c.muted }]}>Record a full run for an overall score</Txt>}
    {run && <View style={styles.columns}>
      {cols.map((item, index) => <View key={item.label} style={[styles.column, index > 0 && styles.withRule]}>
        <View style={styles.valueRow}>{item.icon && <UIIcon name={item.icon} size={22} color={item.color} />}
          <Txt style={[styles.value, { color: item.color }]}>{item.value}</Txt></View>
        <Txt style={[styles.label, { color: c.muted }]}>{item.label}</Txt>
      </View>)}
    </View>}
  </Animated.View>;
}
const styles = createThemedStyles({
  root: { position: 'absolute', left: 24, right: 24, top: 548, height: 160, alignItems: 'center' },
  scoreTarget: { minWidth: 120, minHeight: 76, alignItems: 'center', justifyContent: 'center' },
  score: { fontFamily: F.display, fontSize: 64, lineHeight: 68, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: F.display, fontSize: 26, lineHeight: 32 },
  compactScore: { fontSize: 52, lineHeight: 56 },
  compactUnit: { fontSize: 22, lineHeight: 28 },
  noRun: { marginTop: 7, fontFamily: F.medium, fontSize: 15, lineHeight: 22 },
  composed: { marginTop: 1, fontFamily: F.medium, fontSize: 14, lineHeight: 18 },
  columns: { width: '100%', height: 58, marginTop: 14, flexDirection: 'row', alignItems: 'center' },
  column: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  withRule: { borderLeftWidth: 1, borderLeftColor: C.hair },
  valueRow: { height: 29, flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontFamily: F.display, fontSize: 24, lineHeight: 29, fontVariant: ['tabular-nums'] },
  label: { fontFamily: F.medium, fontSize: 14, lineHeight: 18 },
});
