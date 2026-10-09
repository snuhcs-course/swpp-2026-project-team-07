import { useState, type ReactNode } from 'react';
import type { DescriptionFact, ReviewAttempt } from '../../contracts';
import { feedbackSeekTarget } from './validation';
import { useFeedbackReview } from './useFeedbackReview';
import { activeLayout } from '../../layouts/registry';
const states: Record<string, string> = { absent: 'Ready to generate', disabled: 'Generation disabled', unavailable: 'Generation unavailable',
  waiting_descriptions: 'Describing slides', queued: 'Queued', preparing: 'Preparing coaching', submitted: 'Preparing coaching',
  normalizing: 'Preparing coaching', waiting_quota: 'Waiting for quota', failed: 'Failed', needs_confirmation: 'Needs confirmation', stale: 'Stale', completed: 'Completed' };
type FeedbackInput = { section?: 'overview' | 'slides' | 'transcript'; slideIndex?: number; id: string; apiUrl: string; review: ReviewAttempt; pages?: number; canSeek: boolean; onSeek: (ms: number) => void; };
export function FeedbackPanel({ children, ...props }: FeedbackInput & { children?: (model: ReturnType<typeof useFeedbackController>) => ReactNode }) {
  const model = useFeedbackController(props);
  return children ? children(model) : <activeLayout.Feedback model={model} />;
}
export function useFeedbackController({ id, apiUrl, review, pages, canSeek, onSeek, section = "overview", slideIndex }: FeedbackInput) {
  const feedback = useFeedbackReview(id, apiUrl, review);
  const f = feedback.feedback, d = feedback.descriptions;
  const [expanded, setExpanded] = useState<number | null>(null), [quotes, setQuotes] = useState<number | null>(null);
  const selected = feedback.prompt?.intent.selection || f?.selection || f?.provenance;
  const dependency = f?.dependency;
  const displayedError = dependency?.description_set_id === f?.description_set_id && dependency?.state === 'failed' &&
    dependency.error?.code === 'quota_stopped' && !f?.stale && !f?.requires_confirmation && f?.state !== 'needs_confirmation' &&
    (!f?.error || f.error.code === 'description_dependency_failed') ? dependency.error : f?.error;
  const stoppedDependency = dependency?.retry_action === 'generate_descriptions' && !f?.stale;
  const canGenerate = !!f && f.availability.state === 'available' && !feedback.busy && !feedback.prompt && !feedback.draft && !stoppedDependency &&
    (f.feedback_revision === 0 || f.retry_available);
  const descriptionStage = dependency?.state === 'preparing' ? 'Preparing slides' : dependency?.state === 'submitted' ? 'Describing slides' : dependency?.state === 'normalizing' ? 'Saving descriptions' : states[dependency?.state || ''];
  const state = dependency && !f?.stale ? `Describing slides · ${descriptionStage || 'Unavailable'}` : `${states[f?.state || 'unavailable']}${f?.stale && f.requires_confirmation ? ' · Needs confirmation' : ''}`;
  const draftSlide = feedback.draft?.descriptions.slides.find(s => s.slide_index === feedback.draft?.slide);
  function changeFact(kind: 'summary' | 'key_ideas' | 'visual_facts', index: number, next: DescriptionFact) {
    if (!feedback.draft || feedback.busy) return;
    feedback.change({ slides: feedback.draft.descriptions.slides.map(slide => slide.slide_index !== feedback.draft!.slide ? slide :
      { ...slide, [kind]: kind === 'summary' ? next : slide[kind].map((fact, i) => i === index ? next : fact) }) });
  }
  const evidenceTargets = (f?.result?.suggestions || []).slice(0, 3).map((_, index) => f && pages && canSeek ? feedbackSeekTarget(f, index, review, pages) : null);
  function seekEvidence(index: number) { const target = f && pages && canSeek ? feedbackSeekTarget(f, index, review, pages) : null; if (target) onSeek(target.start_ms); }
  return { feedback, f, d, expanded, setExpanded, quotes, setQuotes, selected, dependency, displayedError, stoppedDependency, canGenerate, state, draftSlide, changeFact, section, slideIndex, evidenceTargets, seekEvidence };
}
