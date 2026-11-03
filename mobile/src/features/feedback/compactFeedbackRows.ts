// OpenAI Codex, 2026-11-02: verified data for existing Review slots; see docs/ai-collaboration-prompts-iteration-2.md.
import type { FeedbackRow } from '../../domain/analysis';
import { slideTimingLabel } from '../../domain/slides';
import type { FeedbackStatusItem } from './selectedSlideFeedback';
import type { Finding } from './slideReview';

const slots: { icon: FeedbackRow['icon']; categories: readonly Finding['category'][] }[] = [
  { icon: 'i-clock', categories: ['timing'] },
  { icon: 'i-bubble', categories: ['fillers'] },
  { icon: 'i-flag', categories: ['content', 'graph', 'audience'] },
  { icon: 'i-wave', categories: ['delivery', 'repetition'] },
];

export type CompactFeedbackRow = FeedbackRow & { findings: readonly Finding[] };
type Metrics = { durationSeconds: number; allocationSeconds: number; fillerCount: number | null };

/** OpenAI Codex, 2026-11-03: measured metrics stay separate from verified advice (#46). */
export function compactFeedbackRows(slide: number, item: FeedbackStatusItem | undefined, metrics: Metrics): CompactFeedbackRow[] {
  const current = item?.slide === slide ? item : undefined;
  const assessed = current?.status === 'reviewed' && current.assessed;
  const findings = assessed || current?.status === 'partial' ? current?.findings ?? [] : [];
  const rows = slots.map(({ icon, categories }): CompactFeedbackRow => {
    const selected = findings.filter(value => categories.includes(value.category)).sort((a, b) => a.priority - b.priority);
    if (icon === 'i-clock') {
      const text = slideTimingLabel(metrics.durationSeconds, metrics.allocationSeconds);
      return { icon, text, status: text === 'On time' ? 'spot' : text === 'Under time' || text === 'Over time' ? 'finding' : 'muted', findings: selected };
    }
    if (icon === 'i-bubble') return { icon, text: metrics.fillerCount === null ? '—' : `${metrics.fillerCount} filler${metrics.fillerCount === 1 ? '' : 's'}`, status: 'muted', findings: selected };
    return selected[0] ? { icon, text: selected[0].observation, status: 'finding', findings: selected }
      : { icon, text: assessed ? 'No issue flagged' : '—', status: assessed ? 'spot' : 'muted', findings: [] };
  });
  if (!assessed) {
    const empty = rows.slice(2).find(row => row.status === 'muted');
    if (empty) empty.text = current?.label ?? 'Not analyzed';
  }
  return rows;
}
