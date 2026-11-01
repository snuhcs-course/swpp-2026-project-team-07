// OpenAI Codex, 2026-11-02: verified data for existing Review slots; see docs/ai-collaboration-prompts-iteration-2.md.
import type { FeedbackRow } from '../../domain/analysis';
import type { FeedbackStatusItem } from './selectedSlideFeedback';
import type { Finding } from './slideReview';

const slots: { icon: FeedbackRow['icon']; categories: readonly Finding['category'][] }[] = [
  { icon: 'i-clock', categories: ['timing'] },
  { icon: 'i-bubble', categories: ['fillers'] },
  { icon: 'i-flag', categories: ['content', 'graph', 'audience'] },
  { icon: 'i-wave', categories: ['delivery', 'repetition'] },
];

/** Status selection already validates exact recording, visits, transcript and settings revisions. */
export function compactFeedbackRows(slide: number, item: FeedbackStatusItem | undefined): FeedbackRow[] {
  const current = item?.slide === slide ? item : undefined;
  const assessed = current?.status === 'reviewed' && current.assessed;
  const findings = assessed || current?.status === 'partial' ? current?.findings ?? [] : [];
  const rows = slots.map(({ icon, categories }): FeedbackRow => {
    const finding = findings.filter(value => categories.includes(value.category)).sort((a, b) => a.priority - b.priority)[0];
    return finding ? { icon, text: finding.observation, status: 'finding' }
      : { icon, text: assessed ? 'Spot On!' : '—', status: assessed ? 'spot' : 'muted' };
  });
  if (!assessed) {
    const empty = rows.find(row => row.status === 'muted');
    if (empty) empty.text = current?.label ?? 'Not analyzed';
  }
  return rows;
}
