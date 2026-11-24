// Feedback v3 contract, parsing and display selection (pure; no network or storage).
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md
// and docs/ai-feedback-reimplementation.md#api. The server calculates every score; this module only
// validates shapes and chooses what each screen shows for the selected run.
// Supplied Claude-generated patch, integrated by OpenAI Codex for Iteration 2 (2026-11-20): coaching fields headline / explanation /
// example / steps / over_limit for the two-region Feedback page; older runs map from problem / action.
import type { SlidePart } from '../../domain/run';
import type { ScoreLevel } from './presentationScore';

export type V3Evidence =
  | { kind: 'speech'; id: string; slide_index: number; start_ms: number; end_ms: number; text: string; attempt_id?: string }
  | { kind: 'measurement'; id: string; text: string };
export type V3Criterion = { id: string; label: string; maximum_points: number; level: ScoreLevel | null; anchor: string | null;
  points: number | null; reason: string; next_level: string; evidence: V3Evidence[] };
export type V3Improvement = { criterion: string; problem: string; action: string; example: string; evidence: V3Evidence[];
  gain_slide_points: number | null; gain_overall_points: number | null;
  /** Prompt 3 coaching fields; empty for runs stored before them. */
  headline: string; explanation: string[]; steps: string[]; over_limit: string[] };
export type V3MustCover = { point: string; status: 'covered' | 'partial' | 'missing'; evidence: V3Evidence[] };
type FeedbackLanguage = 'en' | 'ko' | 'und';
export type V3SlideStatus = 'pending' | 'scored' | 'insufficient_evidence' | 'not_applicable' | 'not_recorded' | 'insufficient_speech' | 'failed';
export type V3SlideMeasurements = { seconds: number; target_seconds: number | null; words: number; filler_count: number;
  long_pauses: number; rate: { value: number; unit: string; band: 'slow' | 'comfortable' | 'fast' } | null };
export type V3Slide = { slide_index: number; status: V3SlideStatus; language?: FeedbackLanguage; reason: string | null; error: string | null; score: number | null; level: ScoreLevel | null; provisional?: boolean;
  criteria: V3Criterion[]; must_cover: V3MustCover[]; strength: { text: string; evidence: V3Evidence[] } | null;
  improvements: V3Improvement[]; measurements: V3SlideMeasurements | null };
export type V3Priority = { title: string; action: string; why: string; slide_index: number | null;
  headline: string; explanation: string[]; steps: string[]; example: string; over_limit: string[] };
export type V3Whole = { status: V3SlideStatus; language?: FeedbackLanguage; error: string | null; score: number | null; criteria: V3Criterion[];
  top_priorities: V3Priority[]; summary: string };
export type V3Scores = { overall: number | null; overall_level: ScoreLevel | null; slide_average: number | null;
  whole: number | null; withheld: { reason: string; slides: number[] }[] };
export type FeedbackRunStatus = 'absent' | 'queued' | 'running' | 'completed' | 'failed' | 'stale';
export type FeedbackRun = { status: FeedbackRunStatus; language?: FeedbackLanguage; enabled: boolean; outdated: boolean; runId: string | null;
  attemptId: string | null; contextId: string | null; scores: V3Scores | null; slides: V3Slide[]; whole: V3Whole | null;
  error: { code: string; message: string } | null; progress: { slidesTotal: number; slidesDone: number; wholeDone: boolean } };

const LEVELS: readonly ScoreLevel[] = ['beginning', 'emerging', 'competent', 'advanced'];
const SLIDE_STATUSES: readonly V3SlideStatus[] = ['pending', 'scored', 'insufficient_evidence', 'not_applicable', 'not_recorded', 'insufficient_speech', 'failed'];
const RUN_STATUSES: readonly FeedbackRunStatus[] = ['absent', 'queued', 'running', 'completed', 'failed', 'stale'];
type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Json : null;
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown): string => typeof v === 'string' ? v : '';
const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string' && !!x.trim());
const QUOTES = '"\'“”‘’„«»「」『』';
/** Strip quotation marks wrapped around the whole text, however many layers (e.g. “"…"”). */
export function unquote(text: string): string {
  let t = text.trim();
  while (t.length >= 2 && QUOTES.includes(t[0]) && QUOTES.includes(t[t.length - 1])) t = t.slice(1, -1).trim();
  return t;
}
const int = (v: unknown): number | null => Number.isSafeInteger(v) ? v as number : null;
const num = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const level = (v: unknown): ScoreLevel | null => LEVELS.includes(v as ScoreLevel) ? v as ScoreLevel : null;
const score = (v: unknown): number | null => { const n = int(v); return n !== null && n >= 0 && n <= 100 ? n : null; };
function languageField(value: unknown): { language?: FeedbackLanguage } {
  return value === 'en' || value === 'ko' || value === 'und' ? { language: value } : {};
}

function evidence(value: unknown): V3Evidence[] {
  return arr(value).flatMap((raw): V3Evidence[] => {
    const e = obj(raw);
    if (!e || !str(e.id)) return [];
    if (e.kind === 'measurement') return [{ kind: 'measurement', id: str(e.id), text: str(e.text) }];
    const start = int(e.start_ms), end = int(e.end_ms), slide = int(e.slide_index);
    return start !== null && end !== null && slide !== null && end > start && start >= 0
      ? [{ kind: 'speech', id: str(e.id), slide_index: slide, start_ms: start, end_ms: end, text: str(e.text),
        ...(str(e.attempt_id) ? { attempt_id: str(e.attempt_id) } : {}) }] : [];
  });
}
function criteria(value: unknown): V3Criterion[] {
  return arr(value).flatMap(raw => {
    const c = obj(raw);
    return c && str(c.id) ? [{ id: str(c.id), label: str(c.label) || str(c.id), maximum_points: int(c.maximum_points) ?? 0,
      level: level(c.level), anchor: str(c.anchor) || null, points: num(c.points), reason: str(c.reason),
      next_level: str(c.next_level), evidence: evidence(c.evidence) }] : [];
  });
}
function slide(raw: unknown): V3Slide | null {
  const s = obj(raw), index = int(s?.slide_index);
  if (!s || index === null || index < 0) return null;
  const m = obj(s.measurements), rate = obj(m?.rate);
  return {
    ...languageField(s.language), slide_index: index, status: SLIDE_STATUSES.includes(s.status as V3SlideStatus) ? s.status as V3SlideStatus : 'failed',
    reason: str(s.reason) || null, provisional: s.provisional === true, error: str(s.error) || null, score: score(s.score), level: level(s.level), criteria: criteria(s.criteria),
    must_cover: arr(s.must_cover).flatMap(raw2 => { const c = obj(raw2);
      return c && ['covered', 'partial', 'missing'].includes(str(c.status))
        ? [{ point: str(c.point), status: c.status as V3MustCover['status'], evidence: evidence(c.evidence) }] : []; }),
    strength: obj(s.strength) && str(obj(s.strength)!.text) ? { text: str(obj(s.strength)!.text), evidence: evidence(obj(s.strength)!.evidence) } : null,
    improvements: arr(s.improvements).flatMap(raw2 => { const i = obj(raw2);
      return i && (str(i.action) || strs(i.steps).length) ? [{ criterion: str(i.criterion), problem: str(i.problem), action: str(i.action), example: str(i.example),
        evidence: evidence(i.evidence), gain_slide_points: num(i.gain_slide_points), gain_overall_points: num(i.gain_overall_points),
        headline: str(i.headline), explanation: strs(i.explanation), steps: strs(i.steps), over_limit: strs(i.over_limit) }] : []; }),
    measurements: m ? { seconds: num(m.seconds) ?? 0, target_seconds: int(m.target_seconds), words: int(m.words) ?? 0,
      filler_count: int(m.filler_count) ?? 0, long_pauses: int(m.long_pauses) ?? 0,
      rate: rate && num(rate.value) !== null && ['slow', 'comfortable', 'fast'].includes(str(rate.band))
        ? { value: num(rate.value)!, unit: str(rate.unit), band: rate.band as 'slow' | 'comfortable' | 'fast' } : null } : null,
  };
}

/** Defensive parse of GET/POST /attempts/{id}/feedback-run/. Malformed parts are dropped, never guessed. */
export function parseFeedbackRun(value: unknown): FeedbackRun | null {
  const v = obj(value);
  if (!v || !RUN_STATUSES.includes(v.status as FeedbackRunStatus)) return null;
  const sc = obj(v.scores), wh = obj(v.whole), progress = obj(v.progress), error = obj(v.error);
  return {
    ...languageField(v.language), status: v.status as FeedbackRunStatus, enabled: v.enabled === true, outdated: v.outdated === true,
    runId: str(v.run_id) || null, attemptId: str(v.attempt_id) || null, contextId: str(v.context_id) || null,
    scores: sc ? { overall: score(sc.overall), overall_level: level(sc.overall_level), slide_average: num(sc.slide_average),
      whole: score(sc.whole), withheld: arr(sc.withheld).flatMap(raw => { const w = obj(raw);
        return w && str(w.reason) ? [{ reason: str(w.reason), slides: arr(w.slides).filter(Number.isSafeInteger) as number[] }] : []; }) } : null,
    slides: arr(v.slides).map(slide).filter((s): s is V3Slide => !!s),
    whole: wh ? { ...languageField(wh.language), status: SLIDE_STATUSES.includes(wh.status as V3SlideStatus) ? wh.status as V3SlideStatus : 'failed',
      error: str(wh.error) || null, score: score(wh.score), criteria: criteria(wh.criteria), summary: str(wh.summary),
      top_priorities: arr(wh.top_priorities).flatMap(raw => { const p = obj(raw);
        return p && (str(p.action) || strs(p.steps).length) ? [{ title: str(p.title), action: str(p.action), why: str(p.why), slide_index: int(p.slide_index),
          headline: str(p.headline), explanation: strs(p.explanation), steps: strs(p.steps), example: str(p.example), over_limit: strs(p.over_limit) }] : []; }) } : null,
    error: error && str(error.code) ? { code: str(error.code), message: str(error.message) } : null,
    progress: { slidesTotal: int(progress?.slides_total) ?? 0, slidesDone: int(progress?.slides_done) ?? 0, wholeDone: progress?.whole_done === true },
  };
}

export const feedbackRunActive = (run: FeedbackRun | null) => run?.status === 'queued' || run?.status === 'running';
/** No run exists yet for this recording (stale runs are replaced by the server). */
export const feedbackRunNeedsStart = (run: FeedbackRun | null) =>
  !!run && run.enabled && (run.status === 'absent' || run.status === 'stale');
/** Saved results came from older inputs (a correction or settings change); they stay visible until updated. */
export const feedbackRunOutdated = (run: FeedbackRun | null) => !!run && (run.outdated || run.status === 'stale') && !feedbackRunActive(run);
export const feedbackRunHasFailures = (run: FeedbackRun | null) =>
  !!run && (run.status === 'failed' || run.slides.some(s => s.status === 'failed') || run.whole?.status === 'failed');

// ------------------------------------------------------------------ selection for the selected run

export type V3SlideDisplay = { slide: number; score: number | null; level: ScoreLevel | null; status: string; settled: boolean;
  outdated: boolean; state: null; result: null; target: null; attemptId: string | null; v3: V3Slide | null; run: FeedbackRun | null };
export type V3OverallDisplay = { score: number | null; level: ScoreLevel | null; status: string; outdated: boolean; state: null;
  result: null; target: null; attemptId: string | null; run: FeedbackRun | null };
export type V3Input = { n: number; parts: (SlidePart | null)[]; stages: ReadonlyMap<string, string>;
  /** Saved run per attempt id, for attempts whose transcript is ready. */ runs: ReadonlyMap<string, FeedbackRun | null>;
  ready: ReadonlySet<string>;
  /** New recordings whose feedback starts automatically after transcription. */ expected: ReadonlySet<string>;
  /** New recordings whose automatic start waits for presentation settings to synchronize. */ waitingForSettings?: ReadonlySet<string>;
  /** Server assessment for the exact selected take composition. */ selected?: { run: FeedbackRun | null; status: string } | null };

const CODE_LABELS: Partial<Record<V3SlideStatus, string>> = {
  not_applicable: 'Not applicable', not_recorded: 'Not recorded', insufficient_speech: 'Too little speech',
  insufficient_evidence: 'Insufficient evidence', failed: 'Feedback failed',
};
function runStatus(run: FeedbackRun | null, ready: boolean, stage: string | undefined, expected: boolean, waiting = false): string | null {
  if (!ready) return stage === 'no_speech' ? 'No speech detected' : stage === 'done' ? 'No usable word timing' : 'Transcript pending';
  // Screens never start generation: a missing run is "Scoring…" only when one is on its way.
  if (!run || run.status === 'absent') return expected ? 'Scoring…' : waiting ? 'Settings sync pending' : 'Not graded';
  // A stale run is replaced by the server; if that has not happened, it needs an explicit request.
  if (run.status === 'stale') return 'Not graded';
  if (feedbackRunActive(run)) return 'Scoring…';
  if (run.status === 'failed') return 'Feedback failed';
  return null;
}

/** Per-slide and overall display for the selected run; mirrors the v2 shapes the screens already use. */
export function selectRunFeedbackV3(input: V3Input) {
  const selectedRun = input.selected?.run ?? null;
  const selectedSlides = !selectedRun?.outdated && selectedRun?.status !== 'stale'
    ? new Map(selectedRun?.slides.map(slide => [slide.slide_index, slide])) : new Map<number, V3Slide>();
  const items: V3SlideDisplay[] = Array.from({ length: input.n }, (_, slideIndex) => {
    const part = input.parts[slideIndex];
    const recorded = !!part?.segments.some(s => s.endMs > s.startMs);
    const base = { slide: slideIndex, score: null, level: null, state: null, result: null, target: null,
      attemptId: part?.attemptId ?? null, v3: null, run: null, outdated: false } as const;
    if (!part || !recorded) return { ...base, status: 'Not recorded', settled: true };
    const selectedSlide = selectedSlides.get(slideIndex);
    const useSelected = !!selectedSlide && !selectedSlide.provisional && !['pending', 'failed'].includes(selectedSlide.status);
    const run = useSelected ? selectedRun : input.runs.get(part.attemptId) ?? null;
    const ready = input.ready.has(part.attemptId);
    const v3 = useSelected ? selectedSlide : run?.slides.find(s => s.slide_index === slideIndex) ?? null;
    const expected = input.expected.has(part.attemptId);
    const pending = runStatus(run, ready, input.stages.get(part.attemptId), expected, !!input.waitingForSettings?.has(part.attemptId));
    const usable = !!v3 && v3.status !== 'pending';
    // Settled = nothing more is coming without a user action; a transcript still in progress is not settled.
    const stage = input.stages.get(part.attemptId), terminal = !ready && (stage === 'no_speech' || stage === 'done');
    if (v3?.provisional) return { ...base, run, v3, status: v3.reason === 'recording' ? 'Recording this slide' : 'Waiting for slide segments', settled: false, outdated: true };
    if (pending && !usable) return { ...base, run, v3, status: pending,
      settled: terminal || pending === 'Feedback failed' || pending === 'Not graded' };
    if (!v3 || v3.status === 'pending') return { ...base, run, v3, status: 'Scoring…', settled: false };
    const scored = v3.status === 'scored' && v3.score !== null;
    return { ...base, run, v3, score: scored ? v3.score : null, level: scored ? v3.level ?? slideLevel(v3.score!) : null,
      settled: true, outdated: feedbackRunOutdated(run), status: scored ? 'Scored' : CODE_LABELS[v3.status] ?? 'Not graded' };
  });
  const ids = [...new Set(input.parts.filter((p): p is SlidePart => !!p).map(p => p.attemptId))];
  const base = { score: null, level: null, state: null, result: null, target: null, outdated: false } as const;
  let overall: V3OverallDisplay;
  if (ids.length === 0) overall = { ...base, status: 'Not graded', attemptId: null, run: null };
  else if (ids.length > 1) {
    const run = selectedRun;
    const pending = input.selected?.status ?? 'Overall score unavailable';
    const scores = run?.scores;
    overall = { ...base, status: pending, attemptId: null, run: null };
    if (feedbackRunOutdated(run)) overall = { ...overall, status: 'Score outdated', outdated: true };
    else if (feedbackRunHasFailures(run)) overall = { ...overall, status: 'Feedback failed', run };
    else if (run?.status === 'completed') {
      if (scores?.overall != null && scores.overall_level && !scores.withheld.length) {
        overall = { ...overall, status: 'Scored', score: scores.overall, level: scores.overall_level, run };
      } else {
        overall = { ...overall, status: scores?.withheld.some(w => w.reason === 'presentation_incomplete')
          ? 'Record missing slides for an overall score' : withheldLabel(scores?.withheld ?? []), run };
      }
    }
  }
  else {
    const run = input.runs.get(ids[0]) ?? null;
    const pending = runStatus(run, input.ready.has(ids[0]), input.stages.get(ids[0]), input.expected.has(ids[0]),
      !!input.waitingForSettings?.has(ids[0]));
    const scores = run?.scores, outdated = feedbackRunOutdated(run);
    if (pending) overall = { ...base, status: pending, attemptId: ids[0], run };
    else if (scores?.overall !== null && scores?.overall !== undefined)
      overall = { ...base, score: scores.overall, level: scores.overall_level, status: 'Scored', outdated, attemptId: ids[0], run };
    else overall = { ...base, status: withheldLabel(scores?.withheld ?? []), outdated, attemptId: ids[0], run };
  }
  const graded = items.filter(i => i.v3 && !['not_applicable', 'not_recorded', 'insufficient_speech'].includes(i.v3.status));
  return {
    items, overall,
    aggregate: { total: input.n, settled: items.filter(i => i.settled).length, pending: items.filter(i => !i.settled).length,
      graded: graded.length, improvements: items.reduce((sum, i) => sum + (i.v3?.improvements.length ?? 0), 0) },
  };
}

/** Fallback only: the server sends each slide's level from exact points. Ties go to the higher band. */
export function slideLevel(points: number): ScoreLevel {
  return points >= 250 / 3 ? 'advanced' : points >= 50 ? 'competent' : points >= 100 / 6 ? 'emerging' : 'beginning';
}
export function withheldLabel(withheld: V3Scores['withheld']): string {
  if (withheld.some(w => w.reason === 'capture_incomplete' || w.reason === 'awaiting_segments')) return 'Waiting for all audio segments';
  if (withheld.some(w => w.reason === 'presentation_incomplete')) return 'Record the whole presentation for an overall score';
  const slides = withheld.find(w => w.reason === 'slides_not_scored')?.slides ?? [];
  if (slides.length) return `Overall needs slide${slides.length === 1 ? '' : 's'} ${slides.map(s => s + 1).join(', ')}`;
  if (withheld.some(w => w.reason === 'whole_not_scored')) return 'Overall score unavailable';
  return 'Not graded';
}

// ------------------------------------------------------------------ automatic start after transcription

export const START_RETRY_MS = 60_000;
export type StartCandidate = { id: string; contextId: string | null; eligible: boolean;
  start: { state: 'started' | 'failed'; at: number } | null };
/** Eligible recordings not yet started, plus failed starts whose retry time has come. */
export function startsDue(candidates: StartCandidate[], now: number): StartCandidate[] {
  return candidates.filter(c => c.eligible && (!c.start || (c.start.state === 'failed' && now - c.start.at >= START_RETRY_MS)));
}

// ------------------------------------------------------------------ coaching cards

export type V3Card = { key: string; slide: number | null; title: string; action: string; example: string; why: string;
  criterion: string | null; gain: number | null; evidence: Extract<V3Evidence, { kind: 'speech' }> | null; attemptId: string | null;
  /** Feedback page fields: one-line headline, why-it-is-wrong bullets, what-to-do bullets. */
  headline: string; explanation: string[]; steps: string[];
  /** The server found a field longer than its box; the page shows "…" and opens the full text. */
  overLimit: boolean };
/** Prompt 3 fields when present; older runs put the whole problem in the headline (shown with "…"). */
function coaching(c: { headline: string; explanation: string[]; steps: string[]; over_limit: string[] }, legacy: { title: string; why: string; action: string }) {
  const fresh = !!(c.headline || c.explanation.length || c.steps.length);
  return fresh ? { headline: c.headline, explanation: c.explanation, steps: c.steps, overLimit: c.over_limit.length > 0 }
    : { headline: legacy.title, explanation: legacy.why ? [legacy.why] : [], steps: legacy.action ? [legacy.action] : [], overLimit: false };
}
const firstSpeech = (refs: V3Evidence[]) => refs.find((e): e is Extract<V3Evidence, { kind: 'speech' }> => e.kind === 'speech') ?? null;

/** One slide's cards: improvements first (largest point gain first), then next-level advice not already covered. */
export function slideCards(item: Pick<V3SlideDisplay, 'slide' | 'v3' | 'attemptId'>, localizeLevel = (label: string) => label): V3Card[] {
  const v3 = item.v3;
  if (!v3) return [];
  const improvements = v3.improvements.map((i, n): V3Card => ({ key: `i${item.slide}:${n}`, slide: item.slide,
    title: i.headline || i.problem || i.action, action: i.action, example: unquote(i.example), why: '', criterion: i.criterion,
    gain: i.gain_slide_points, evidence: firstSpeech(i.evidence), attemptId: item.attemptId,
    ...coaching(i, { title: i.problem || i.action, why: '', action: i.action }) }))
    .sort((a, b) => (b.gain ?? 0) - (a.gain ?? 0));
  const covered = new Set(improvements.map(c => c.criterion));
  const nextLevels = v3.criteria.filter(c => c.level && c.level !== 'advanced' && c.next_level && !covered.has(c.id))
    .map((c, n): V3Card => ({ key: `n${item.slide}:${n}`, slide: item.slide, title: `${c.label}: ${localizeLevel(levelLabel(c.level))}`,
      action: c.next_level, example: '', why: c.reason, criterion: c.id, gain: c.maximum_points ? Math.round(c.maximum_points / 3 * 10) / 10 : null,
      evidence: firstSpeech(c.evidence), attemptId: item.attemptId,
      headline: `${c.label}: ${localizeLevel(levelLabel(c.level))}`, explanation: c.reason ? [c.reason] : [], steps: [c.next_level], overLimit: false }));
  return [...improvements, ...nextLevels];
}

/** Whole-run cards for the Feedback screen: top priorities, then every slide improvement by overall gain. */
export function runCards(items: V3SlideDisplay[], overall: V3OverallDisplay): V3Card[] {
  const priorities = (overall.run?.whole?.status === 'scored' || overall.run?.whole?.status === 'insufficient_evidence'
    ? overall.run.whole.top_priorities : []).map((p, n): V3Card => ({ key: `p${n}`, slide: p.slide_index, title: p.headline || p.title || p.action,
      action: p.action, example: unquote(p.example), why: p.why, criterion: null, gain: null, evidence: null, attemptId: overall.attemptId,
      ...coaching(p, { title: p.title || p.action, why: p.why, action: p.action }) }));
  const improvements = items.flatMap(item => (item.v3?.improvements ?? []).map((i, n) => ({ item, i, n })))
    .sort((a, b) => (b.i.gain_overall_points ?? 0) - (a.i.gain_overall_points ?? 0))
    .map(({ item, i, n }): V3Card => ({ key: `i${item.slide}:${n}`, slide: item.slide, title: i.headline || i.problem || i.action, action: i.action,
      example: unquote(i.example), why: '', criterion: i.criterion, gain: i.gain_overall_points, evidence: firstSpeech(i.evidence),
      attemptId: item.attemptId, ...coaching(i, { title: i.problem || i.action, why: '', action: i.action }) }));
  return [...priorities, ...improvements];
}
export const levelLabel = (value: ScoreLevel | null) => value ? value[0].toUpperCase() + value.slice(1) : 'Not assessed';
export const CODE_REASON_TEXT: Record<string, string> = {
  title_slide_profile: 'Title slide: introductions are reviewed as part of the whole presentation.',
  closing_slide_profile: 'Closing slide: the ending is reviewed as part of the whole presentation.',
  short_slide_text: 'Title-style slide: the opening or ending is reviewed as part of the whole presentation.',
  slide_not_visited: 'This slide was not recorded in this take.',
  fewer_than_5_words: 'Too little speech on this slide to give feedback. Record it again with a full explanation.',
};
