import type { FeedbackRun } from '../feedback/feedbackRun';
import { translatedV3, translatedV3Cards } from './generatedProse';
import { firstWordingPending } from './firstWording';
import type { Language, Resource } from './translationCache';

export function firstFeedback(api: string, run: FeedbackRun, selected: (slide: number) => boolean, wholeSelected: boolean,
  slideDetails: number | undefined, language: Language, cache: { get: (r: Resource, p: string, s: string) => string | null }) {
  if (!run.runId) return run;
  const r = { kind: 'feedback' as const, resource_id: run.runId };
  let held = false;
  const slides = run.slides.map(slide => {
    if (!selected(slide.slide_index) || (slide.status !== 'scored' && slide.status !== 'insufficient_evidence')) return slide;
    const path = 'slides.' + slide.slide_index, details = slideDetails === slide.slide_index;
    if (!firstWordingPending(api, r, path + (details ? '.detail' : '.cards'), language, cache, text =>
      (details ? translatedV3 : translatedV3Cards)(slide, (p,s,h) => text(p,s,h ?? run.language), path))) return slide;
    held = true;
    return { ...slide, status: 'pending' as const, score: null, level: null, improvements: [], criteria: [], must_cover: [], strength: null };
  });
  let whole = run.whole;
  if (wholeSelected && whole && (whole.status === 'scored' || whole.status === 'insufficient_evidence') &&
      firstWordingPending(api, r, 'whole', language, cache, text => translatedV3Cards(whole!,
        (p,s,h) => text(p,s,h ?? run.language), 'whole'))) {
    held = true;
    whole = null;
  }
  return held ? { ...run, status: 'running' as const, slides, whole } : run;
}
