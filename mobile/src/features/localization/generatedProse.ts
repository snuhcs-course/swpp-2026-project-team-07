import type { DisplayField } from './useDisplayTranslation';
import type { V3Improvement, V3Priority, V3Slide, V3Whole } from '../feedback/feedbackRun';
import type { ScoreResult, SlideScore } from '../feedback/presentationScore';
import type { SlideProfile } from '../presentations/slideProfiles';
import type { QaQuestion, QaResult } from '../qa/client';
import type { Finding } from '../feedback/slideReview';
import type { CoachingSuggestion } from '../../contracts';

const v3Keys = new Set(['text', 'point', 'anchor', 'label', 'reason', 'next_level', 'problem', 'action', 'summary', 'title', 'why', 'headline', 'explanation', 'steps']);
const scoreKeys = new Set(['text', 'justification', 'limitations', 'consequence', 'improvement_shortage']);
const cueKeys = new Set(['text', 'information_needed', 'supporting_detail']);
// IDs, examples, exact speech, source slide evidence and all measured values pass through untouched.
const opaque = new Set(['evidence', 'evidence_refs', 'measurements', 'transcript', 'example', 'over_limit', 'validation']);

function displayTree<T>(input: T, fields: ReadonlySet<string>, text: DisplayField, root: string): T {
  function visit(value: unknown, path: string, key: string): unknown {
    if (typeof value === 'string') return fields.has(key) && value.trim() ? text(path, value, key === 'anchor' || key === 'label' ? 'en' : undefined) : value;
    if (Array.isArray(value)) return value.map((item, i) => visit(item, path + '.' + i, key));
    if (value === null || typeof value !== 'object') return value;
    const pairs = Object.entries(value).map(([name, item]) => [name, opaque.has(name) ? item : visit(item, path + '.' + name, name)]);
    return Object.fromEntries(pairs);
  }
  return visit(input,root,'') as T;
}

export function translatedV3<T extends V3Slide | V3Whole>(value: T, text: DisplayField, path: string): T {
  return displayTree(value, v3Keys, (key, source, hint) =>
    key === path + '.reason' ? source : text(key, source, hint ?? value.language), path);
}
// Whole Feedback shows coaching cards. Legacy titles/actions retain their original cache paths.
export function translatedV3Cards<T extends V3Slide | V3Whole>(part: T, text: DisplayField, path: string): T {
  function card<C extends V3Improvement | V3Priority>(item: C, prefix: string): C {
    const fields = new Set(['headline', 'explanation', 'steps']);
    if (!item.headline) {
      if ('problem' in item && item.problem) fields.add('problem');
      else if ('title' in item && item.title) fields.add('title');
      else fields.add('action');
      if (!item.explanation.length && !item.steps.length) {
        fields.add('action');
        fields.add('why');
      }
    }
    return displayTree(item, fields, (key, source) => text(key, source, part.language), prefix);
  }
  if ('improvements' in part) {
    return { ...part, improvements: part.improvements.map((item, i) => card(item, path + '.improvements.' + i)) };
  }
  if (part.status !== 'scored' && part.status !== 'insufficient_evidence') return part;
  return { ...part, top_priorities: part.top_priorities.map((item, i) => card(item, path + '.top_priorities.' + i)) };
}
export function translatedScore<T extends SlideScore | ScoreResult>(value: T, text: DisplayField, path: string): T {
  return displayTree(value, scoreKeys, text, path);
}
export function translatedProfile(slide: SlideProfile, text: DisplayField): SlideProfile {
  const path = 'slides.' + slide.slide_index;
  return {...slide, must_cover: displayTree(slide.must_cover, cueKeys, text, path + '.must_cover'),
    go_deeper: displayTree(slide.go_deeper, cueKeys, text, path + '.go_deeper')};
}
export function translatedFinding<T extends Finding | CoachingSuggestion>(item: T, text: DisplayField, path: string): T {
  return {...item, observation: text(path + '.observation', item.observation), suggestion: text(path + '.suggestion', item.suggestion)};
}
export function translatedPanelist(label: string, text: DisplayField, index: number): string {
  // P1/P2/P3 identify a slot in older and current question batches in either language.
  return /^P[0-9]+$/i.test(label) ? label : text('questions.' + index + '.panelist', label);
}
export function translatedQuestion<T extends QaQuestion>(q: T, text: DisplayField, index: number): T {
  const path = 'questions.' + index;
  return {...q, panelist: translatedPanelist(q.panelist,text,index), role: text(path + '.role',q.role), topic: text(path + '.topic',q.topic),
    question: text(path + '.question',q.question), follow_up: text(path + '.follow_up',q.follow_up)};
}
export function translatedAnswer(answer: QaResult, text: DisplayField, index: number, part: number): QaResult {
  const path = 'answers.' + index + '.' + part;
  return {...answer, did: text(path + '.did',answer.did), evidence: text(path + '.evidence',answer.evidence),
    clarify: text(path + '.clarify',answer.clarify)};
}
