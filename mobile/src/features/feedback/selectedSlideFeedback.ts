// OpenAI Codex reliability fixes: docs/ai-collaboration-prompts-iteration-2.md#cue-and-feedback-reliability-october-16-2026
/** Status and counts from verified AI feedback for the exact selected recordings. No heuristic quality score. */
import type { DeckModel } from '../presentations/useDeckModel';
import { readRequirements } from '../presentations/requirementsStore';
import { requirementsDirty } from '../presentations/requirementsDraft';
import { readCorrections } from '../presentations/correctionStore';
import { readReview } from '../transcription/reviewStorage';
import { readStored } from '../../services/storage';
import { reviewActive, reviewScope, reviewStatus, type SlideReview } from './slideReview';
import { effectiveSlideReview, readSlideReview, slideReviewInitialKey, type SlideReviewTarget } from './slideReviewStore';

export type FeedbackStatus = 'not_recorded' | 'transcribing' | 'not_analyzed' | 'pending' | 'outdated' | 'recovery_needed' | 'insufficient' | 'partial' | 'reviewed' | 'unavailable';
export type FeedbackTone = 'good' | 'warn' | 'bad' | 'info' | 'muted';
export type FeedbackStatusItem = { slide: number; status: FeedbackStatus; label: string; findingCount: number; assessed: boolean; hasFindings: boolean; tone: FeedbackTone };
export type FeedbackAggregate = { recorded: number; assessed: number; findings: number; slidesWithFindings: number; partial: number;
  pending: number; outdated: number; recoveryNeeded: number; insufficient: number; notAnalyzed: number };
export function feedbackStatusItem(slide: number, recorded: boolean, stage: string | null, state: SlideReview | null): FeedbackStatusItem {
  const item = (status: FeedbackStatus, label: string, tone: FeedbackTone, count = 0, assessed = false): FeedbackStatusItem =>
    ({ slide, status, label, tone, findingCount: count, assessed, hasFindings: count > 0 });
  if (!recorded) return item('not_recorded', 'Not recorded', 'muted');
  if (stage === 'untimed') return item('insufficient', 'No usable word timing', 'muted');
  if (stage === 'no_speech') return item('insufficient', 'No speech detected', 'muted');
  if (stage !== 'done') return item('transcribing', 'Transcript pending', 'info');
  if (!state) return item('not_analyzed', 'Not analyzed', 'muted');
  if (state.stale || state.state === 'stale') return item('outdated', 'Feedback outdated', 'warn');
  if (state.dependency?.retry_action) return item('recovery_needed', state.dependency.requires_confirmation ? 'Retry needs confirmation' : 'Slide context needs recovery', 'bad');
  if (reviewActive(state)) return item('pending', reviewStatus(state, slide), 'info');
  if (state.state === 'failed' || state.state === 'needs_confirmation') return item('recovery_needed', state.state === 'failed' ? 'Analysis failed' : 'Retry needs confirmation', 'bad');
  if (state.result?.stale) return item('outdated', 'Feedback outdated', 'warn');
  if (state.state === 'completed') {
    const summary = state.result?.slides.find(value => value.slide_index === slide);
    if (!summary) return item('recovery_needed', reviewStatus(state, slide), 'bad');
    if (summary.status === 'insufficient_evidence') return item('insufficient', reviewStatus(state, slide), 'muted');
    if (summary.status === 'invalid_evidence' || summary.status === 'model_error') return item('recovery_needed', summary.status === 'invalid_evidence' ? 'Feedback could not be verified' : 'AI response could not be processed', 'bad');
    if (summary.status === 'partial') return item('partial', 'Partially assessed', 'warn', summary.findings.length);
    const count = summary.findings.length;
    return item('reviewed', count ? `${count} finding${count === 1 ? '' : 's'}` : 'No issues found', count ? 'warn' : 'good', count, true);
  }
  if (state.state === 'disabled' || state.state === 'unavailable' || state.availability.state !== 'available') return item('unavailable', 'AI feedback unavailable', 'muted');
  return item('not_analyzed', 'Not analyzed', 'muted');
}
export function aggregateFeedback(items: readonly FeedbackStatusItem[]): FeedbackAggregate {
  const count = (status: FeedbackStatus) => items.filter(item => item.status === status).length;
  return { recorded: items.length - count('not_recorded'), assessed: items.filter(item => item.assessed).length,
    findings: items.reduce((sum, item) => sum + item.findingCount, 0), slidesWithFindings: items.filter(item => item.hasFindings).length,
    partial: count('partial'), pending: count('pending') + count('transcribing'), outdated: count('outdated'),
    recoveryNeeded: count('recovery_needed') + count('unavailable'), insufficient: count('insufficient'), notAnalyzed: count('not_analyzed') };
}
export function selectedSlideFeedback(model: DeckModel | null, api: string) {
  const targets: SlideReviewTarget[] = [], activeTargets: SlideReviewTarget[] = [];
  if (!model) return { items: [] as FeedbackStatusItem[], aggregate: aggregateFeedback([]), targets, activeTargets };
  let requirements: ReturnType<typeof readRequirements> | null = null;
  try { requirements = readRequirements(model.deck.id, api); } catch { /* Unreadable settings cannot supply a context. */ }
  const dirty = requirementsDirty(model.deck.id, api);
  const items = Array.from({ length: model.n }, (_, slide) => {
    const part = model.state.run?.parts[slide], recorded = !!part?.segments.some(segment => segment.endMs > segment.startMs);
    if (!part || !recorded) return feedbackStatusItem(slide, false, null, null);
    const stage = model.stages.get(part.attemptId) ?? null;
    let original: ReturnType<typeof readReview> = null;
    try { original = readReview(api, part.attemptId); } catch { /* Source must validate before its feedback can be read. */ }
    const context = requirements?.deckId === original?.deck_id ? requirements?.contextId ?? null : null;
    const scope = reviewScope(slide, part, context);
    const raw = readSlideReview(api, part.attemptId, scope, original);
    const value = effectiveSlideReview(raw, { requirementsRevision: context ? requirements!.revision : null,
      correction: readCorrections(api, part.attemptId), transcriptId: original?.transcript_id ?? undefined,
      initial: readStored<string>(slideReviewInitialKey(api, part.attemptId, scope)), dirty });
    if (original?.deck_id && original.transcript?.words.length) {
      const target = { id: part.attemptId, scope, review: original };
      targets.push(target); if (reviewActive(value)) activeTargets.push(target);
    }
    return feedbackStatusItem(slide, true, stage === 'done' && original?.transcript && !original.transcript.words.length ? 'untimed' : stage, value);
  });
  return { items, aggregate: aggregateFeedback(items), targets, activeTargets };
}
