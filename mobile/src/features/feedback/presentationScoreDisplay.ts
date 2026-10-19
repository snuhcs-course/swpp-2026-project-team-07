/** Display and playback boundaries for already validated rubric results. */
import type { Palette } from '../../design/tokens';
import type { PresentationScore, ScoreEvidence, ScoreLevel, ScoreTarget } from './presentationScore';
export const scoreLevelLabel = (level: ScoreLevel | null) => level ? level[0].toUpperCase() + level.slice(1) : '';
export const scoreNumber = (score: number | null | undefined) => Number.isSafeInteger(score) && score! >= 0 && score! <= 100 ? score! : null;
/** Color by the validated exact backend level; rounded points never choose a level. */
export function scoreLevelColor(level: ScoreLevel | null, palette: Pick<Palette, 'bad'|'warn'|'good'|'info'|'secondary'>): string {
 return level === 'beginning' ? palette.bad : level === 'emerging' ? palette.warn : level === 'competent' ? palette.good : level === 'advanced' ? palette.info : palette.secondary;
}
/** Keep ring labels short; panels retain the full explanation and recovery action. */
export function scoreRingStatus(status: string): string {
 if (/outdated|stale|changed/i.test(status)) return 'Updating';
 if (/…|grading|pending|transcrib/i.test(status) && !/failed|unavailable|not graded/i.test(status)) return 'Scoring…';
 if (/failed/i.test(status)) return 'Failed';
 if (/not graded/i.test(status)) return 'Not scored';
 if (/not recorded/i.test(status)) return 'Not recorded';
 if (/insufficient|no speech|no usable/i.test(status)) return 'No score';
 return 'Unavailable';
}
export function scorePlaybackSource(state: PresentationScore | null, target: ScoreTarget | null): string | null {
 if (!state || !target || state.stale || state.state !== 'completed' || !state.result || state.attempt_id !== target.id || state.context_id !== target.contextId ||
  state.source_identity !== state.result.source_identity || target.review?.transcript_id !== state.result.evidence.transcript_id) return null;
 return JSON.stringify([target.id,target.contextId,state.source_identity,state.feedback_revision,state.transcript_revision,target.review.transcript_id]);
}
export function currentScoreEvidence(state: PresentationScore | null, target: ScoreTarget | null, refs: readonly ScoreEvidence[]): boolean {
 if (!state?.result || !scorePlaybackSource(state,target)) return false;
 const known = new Set<string>();
 const walk = (value: unknown) => {
  if (!value || typeof value !== 'object') return;
  if ('kind' in value) known.add(JSON.stringify(value));
  else for (const child of Object.values(value)) if (Array.isArray(child)) child.forEach(walk); else walk(child);
 };
 walk(state.result);
 return refs.length > 0 && refs.every(ref => known.has(JSON.stringify(ref)));
}
export type ScoreAudioEvidence = Extract<ScoreEvidence, {kind:'speech'|'measurement'|'full_attempt'}>;
export function scoreAudioEvidence(refs: readonly ScoreEvidence[]): ScoreAudioEvidence[] {
 const seen = new Set<string>();
 return refs.filter((ref): ref is ScoreAudioEvidence => {
  if (!('start_ms' in ref) || !Number.isSafeInteger(ref.start_ms) || !Number.isSafeInteger(ref.end_ms) || ref.start_ms < 0 || ref.end_ms <= ref.start_ms) return false;
  const key = `${ref.attempt_id}:${ref.start_ms}:${ref.end_ms}`;
  if (seen.has(key)) return false;
  seen.add(key); return true;
 }).sort((a,b) => a.start_ms-b.start_ms);
}
export function scoreEvidenceTime(ms: number): string {
 const seconds=Math.floor(ms/1000);
 return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
}
export function scoreEvidenceLabel(ref: ScoreEvidence): string {
 if (ref.kind === 'speech') return `Original recording · slide ${ref.slide_index+1} · ${scoreEvidenceTime(ref.start_ms)}–${scoreEvidenceTime(ref.end_ms)}`;
 if (ref.kind === 'measurement') return `${ref.measurement.kind.replace(/_/g,' ')} · ${ref.measurement.value} ${ref.measurement.unit} · original recording · ${scoreEvidenceTime(ref.start_ms)}–${scoreEvidenceTime(ref.end_ms)}`;
 if (ref.kind === 'full_attempt') return `Full original recording · ${scoreEvidenceTime(ref.start_ms)}–${scoreEvidenceTime(ref.end_ms)}`;
 if (ref.kind === 'slide') return `Slide ${ref.slide_index+1} · saved slide evidence`;
 return ref.field==='audience'?'Audience requirement':'Presentation time requirement';
}
