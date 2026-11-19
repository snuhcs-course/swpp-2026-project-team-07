// Feedback v3 details for one slide in Review: rubric levels, how to reach the next level, Must Cover,
// improvements with examples and point gains, and playable evidence.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '../../design/frame';
import { Glyph } from '../../design/icons';
import { F } from '../../design/tokens';
import { useTheme } from '../../design/theme';
import { fmt } from '../../domain/format';
import { scoreLevelColor } from './presentationScoreDisplay';
import { CODE_REASON_TEXT, levelLabel, type V3Evidence, type V3SlideDisplay } from './feedbackRun';

type Speech = Extract<V3Evidence, { kind: 'speech' }>;
type Props = { item: V3SlideDisplay; isPlaying: (e: Speech) => boolean; onPlay: (e: Speech) => void;
  onRetry: () => void; onUpdate: () => void; busy: boolean; notice: string };
const MUST_ICON = { covered: '✓', partial: '◐', missing: '✗' } as const;

export function FeedbackV3SlideDetails({ item, isPlaying, onPlay, onRetry, onUpdate, busy, notice }: Props) {
  const { c } = useTheme(), v3 = item.v3;
  const listen = (e: Speech, label: string) => {
    const playing = isPlaying(e);
    return <Pressable key={`${label}:${e.id}`} accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Hear'} ${label} at ${fmt(e.start_ms / 1000)}`}
      onPress={() => onPlay(e)} style={[styles.listen, { backgroundColor: c.surface08 }]}>
      <Glyph name={playing ? 'p-pause' : 'p-play'} size={13} color={c.text} />
      <Txt numberOfLines={2} style={[styles.quote, { color: c.body }]}>{`${fmt(e.start_ms / 1000)} · “${e.text}”`}</Txt>
    </Pressable>;
  };
  const speech = (refs: V3Evidence[]) => refs.filter((e): e is Speech => e.kind === 'speech').slice(0, 2);
  return <View style={styles.root}>
    <Txt accessibilityLiveRegion="polite" style={[styles.status, { color: c.text }]}>
      {item.score !== null ? `Slide score ${item.score} · ${levelLabel(item.level)}` : item.status}</Txt>
    {!!notice && <Txt style={[styles.note, { color: c.secondary }]}>{notice}</Txt>}
    {!!v3?.reason && <Txt style={[styles.note, { color: c.secondary }]}>{CODE_REASON_TEXT[v3.reason] ?? v3.reason}</Txt>}
    {(v3?.status === 'failed' || item.status === 'Feedback failed') && <Action label="Retry slide feedback" text={busy ? 'Retrying…' : 'Retry feedback'} disabled={busy} onPress={onRetry} />}
    {item.outdated && <>
      <Txt style={[styles.note, { color: c.secondary }]}>These results are from before your latest transcript or settings changes.</Txt>
      <Action label="Update feedback for the latest changes" text={busy ? 'Updating…' : 'Update feedback'} disabled={busy} onPress={onUpdate} />
    </>}
    {item.status === 'Not graded' && <Action label="Get AI feedback for this recording" text={busy ? 'Requesting…' : 'Get AI feedback'} disabled={busy} onPress={onUpdate} />}
    {!!v3?.strength && <View style={styles.block}>
      <Txt style={[styles.kicker, { color: c.good }]}>WHAT WORKED</Txt>
      <Txt style={[styles.body, { color: c.text }]}>{v3.strength.text}</Txt>
      {speech(v3.strength.evidence).map(e => listen(e, 'what worked'))}
    </View>}
    {!!v3?.improvements.length && <View style={styles.block}>
      <Txt style={[styles.kicker, { color: c.accent }]}>NEXT TIME</Txt>
      {v3.improvements.map((i, n) => <View key={n} style={[styles.card, { borderColor: c.hair }]}>
        {!!i.gain_slide_points && <Txt style={[styles.gain, { color: c.good }]}>{`+${i.gain_slide_points} points on this slide`}</Txt>}
        {!!i.problem && <Txt style={[styles.body, { color: c.secondary }]}>{i.problem}</Txt>}
        <Txt style={[styles.strong, { color: c.text }]}>{i.action}</Txt>
        {!!i.example && <Txt style={[styles.body, { color: c.text }]}>{`Try saying: “${i.example}”`}</Txt>}
        {speech(i.evidence).map(e => listen(e, `improvement ${n + 1}`))}
      </View>)}
    </View>}
    {!!v3?.must_cover.length && <View style={styles.block}>
      <Txt style={[styles.kicker, { color: c.secondary }]}>MUST COVER</Txt>
      {v3.must_cover.map((m, n) => <View key={n} style={styles.row}>
        <Txt style={[styles.icon, { color: m.status === 'covered' ? c.good : m.status === 'partial' ? c.gold : c.bad }]}>{MUST_ICON[m.status]}</Txt>
        <Txt style={[styles.body, styles.flex, { color: c.text }]}>{m.point}</Txt>
      </View>)}
    </View>}
    {!!v3?.criteria.length && <View style={styles.block}>
      <Txt style={[styles.kicker, { color: c.secondary }]}>RUBRIC</Txt>
      {v3.criteria.map(cr => <View key={cr.id} style={[styles.card, { borderColor: c.hair }]}>
        <View style={styles.row}>
          <Txt style={[styles.strong, styles.flex, { color: c.text }]}>{cr.label}</Txt>
          <Txt style={[styles.strong, { color: scoreLevelColor(cr.level, c) }]}>{cr.level ? `${levelLabel(cr.level)} · ${Math.round((cr.points ?? 0) * 10) / 10}/${cr.maximum_points}` : 'Not assessed'}</Txt>
        </View>
        {!!cr.anchor && <Txt style={[styles.note, { color: c.secondary }]}>{cr.anchor}</Txt>}
        {!!cr.reason && <Txt style={[styles.body, { color: c.text }]}>{cr.reason}</Txt>}
        {!!cr.next_level && <Txt style={[styles.body, { color: c.text }]}>{`To reach the next level: ${cr.next_level}`}</Txt>}
        {speech(cr.evidence).map(e => listen(e, cr.label))}
      </View>)}
    </View>}
  </View>;
}
function Action({ label, text, disabled, onPress }: { label: string; text: string; disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.action, { backgroundColor: c.surface10, opacity: disabled ? 0.45 : 1 }]}>
    <Txt style={[styles.actionText, { color: c.text }]}>{text}</Txt></Pressable>;
}
const styles = StyleSheet.create({
  root: { gap: 18 }, block: { gap: 10 }, card: { gap: 8, borderTopWidth: 1, paddingTop: 10 },
  status: { fontFamily: F.semibold, fontSize: 15 }, kicker: { fontFamily: F.bold, fontSize: 13.5, letterSpacing: 1 },
  body: { fontFamily: F.medium, fontSize: 15, lineHeight: 21 }, strong: { fontFamily: F.semibold, fontSize: 15, lineHeight: 21 },
  note: { fontFamily: F.medium, fontSize: 14, lineHeight: 20 }, gain: { fontFamily: F.bold, fontSize: 13.5 },
  quote: { flex: 1, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18 }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1, minWidth: 0 }, icon: { width: 18, fontFamily: F.bold, fontSize: 15, lineHeight: 21 },
  listen: { minHeight: 40, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { minHeight: 44, paddingHorizontal: 14, borderRadius: 16, alignSelf: 'flex-start', justifyContent: 'center' },
  actionText: { fontFamily: F.semibold, fontSize: 14 },
});
