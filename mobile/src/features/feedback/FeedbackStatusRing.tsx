import { ScoreRing } from '../../design/ScoreRing';
import { useTheme } from '../../design/theme';
import type { FeedbackStatusItem } from './selectedSlideFeedback';

/** The arc indicates a completed assessment; the number is a finding count, never a quality score. */
export function FeedbackStatusRing({ id, item }: { id: string; item: FeedbackStatusItem }) {
  const { c } = useTheme();
  const current = item.status === 'reviewed' || item.status === 'partial';
  const value = current ? String(item.findingCount) : item.status === 'pending' || item.status === 'transcribing' ? '…' : '—';
  const color = item.tone === 'good' ? c.good : item.tone === 'warn' ? c.warn : item.tone === 'bad' ? c.bad : item.tone === 'info' ? c.info : c.secondary;
  const gradient: readonly [string, string] = item.tone === 'good' ? ['#9AF7D6', '#0EA877'] : item.tone === 'bad' ? ['#FF9A7C', '#EC2A35'] : ['#FFE58C', '#FF8A1E'];
  const label = item.status === 'partial' ? 'Verified findings · partial' : item.label;
  return <ScoreRing id={id} percent={item.assessed ? 100 : null} value={value} label={label} labelColor={color} gradient={gradient} />;
}
