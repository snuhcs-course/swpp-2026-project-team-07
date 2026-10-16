// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex run-audio position mapping: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// OutLoud redesign: the merged "run" of a presentation (SPEC §5.2).
// Every recording stays a separate saved attempt (the existing upload/transcription
// pipeline is unchanged). A run only records which attempt, and which stretch of
// that attempt's audio, currently supplies each slide.
import type { SlideEvent } from '../contracts';

export type Segment = { startMs: number; endMs: number };
export type SlidePart = { attemptId: string; segments: Segment[] };
export type Run = {
  id: string;
  /** Per slide: the attempt audio that supplies it, or null when not reached. */
  parts: (SlidePart | null)[];
  /** "full run", "slide 7 redone", "new take · stopped at slide 3", … (the day is added on display). */
  core: string;
  createdAt: string;
  full: boolean;
  whole: boolean;
  targetSum: number;
  /** Seconds versus the previous full run (negative = faster); null when not comparable. */
  delta: number | null;
  /** Slide selected when Review opens. */
  sel: number;
  /** Take number for "attempt N" labels. */
  takeNo: number;
};
export type Visit = { slide: number; startMs: number; endMs: number };
export type TakeInput = {
  attemptId: string;
  visits: Visit[];
  /** Per slide: speech was detected while it was on screen (the start slide always counts). */
  spoken: boolean[];
  whole: boolean;
  createdAt: string;
};
export type CompareSpec = { slides: number[]; whole: boolean; prev: Run; next: Run; attemptId: string };

/** Slide visits of one recording: [event, next event) with the last ending at the duration. */
export function takeVisits(events: readonly SlideEvent[], durationMs: number): Visit[] {
  return events.map((e, i) => ({ slide: e.slide_index, startMs: e.at_ms, endMs: events[i + 1]?.at_ms ?? durationMs }))
    .filter(v => v.endMs > v.startMs);
}

export function partSeconds(part: SlidePart | null | undefined): number {
  if (!part) return 0;
  return part.segments.reduce((a, s) => a + Math.max(0, s.endMs - s.startMs), 0) / 1000;
}
export function runTimes(run: Run | null, n: number): number[] {
  return Array.from({ length: n }, (_, i) => (run ? partSeconds(run.parts[i]) : 0));
}
export function runTotal(run: Run | null, n: number): number {
  return runTimes(run, n).reduce((a, b) => a + b, 0);
}
/** Start of each slide in the merged timeline (seconds). */
export function runStarts(times: readonly number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const t of times) { out.push(acc); acc += t; }
  return out;
}
/** Map concatenated local audio time back to the true merged-run timeline. Missing-audio slides are absent from plan. */
export type RunAudioPlanEntry = { slide: number; runStart: number; durMs: number };
export function runPosition(elapsedMs: number, plan: readonly RunAudioPlanEntry[]): number {
  if (!plan.length) return 0;
  let remaining = Math.max(0, elapsedMs);
  for (const entry of plan) {
    const duration = Math.max(0, entry.durMs);
    if (remaining < duration) return entry.runStart + remaining / 1000;
    remaining -= duration;
  }
  const last = plan[plan.length - 1];
  return last.runStart + Math.max(0, last.durMs) / 1000;
}
export function runAttemptIds(run: Run | null): string[] {
  return run ? [...new Set(run.parts.filter((p): p is SlidePart => !!p).map(p => p.attemptId))] : [];
}

function span(redone: number[]): string {
  if (redone.length === 1) return 'slide ' + (redone[0] + 1);
  const contiguous = redone.length > 0 && redone[redone.length - 1] - redone[0] === redone.length - 1;
  return contiguous ? 'slides ' + (redone[0] + 1) + '–' + (redone[redone.length - 1] + 1) : redone.length + ' slides';
}

/**
 * Merge a new take into the previous run. Slides spoken on in this take are
 * replaced; every other slide keeps its earlier audio and time. A whole take
 * (long-press → Redo all) replaces the entire run.
 */
export function mergeTake(prev: Run | null, take: TakeInput, ctx: {
  n: number; targets: readonly number[]; deckTarget: number; lastFullTotal: number | null; takeNo: number; id: string;
}): { run: Run; redone: number[]; compare: CompareSpec | null } {
  const { n, targets } = ctx;
  const segs: Segment[][] = Array.from({ length: n }, () => []);
  for (const v of take.visits) if (v.slide >= 0 && v.slide < n) segs[v.slide].push({ startMs: v.startMs, endMs: v.endMs });
  const takeT = segs.map(list => list.reduce((a, s) => a + s.endMs - s.startMs, 0) / 1000);
  const prevParts = prev && prev.parts.length === n ? prev.parts : null;
  const prevT = prevParts ? prevParts.map(partSeconds) : Array<number>(n).fill(0);

  const parts: (SlidePart | null)[] = [];
  const redone: number[] = [];
  let visited = 0, tSum = 0, total = 0, sel = 0, best = -Infinity;
  for (let i = 0; i < n; i++) {
    const mine = take.whole || !!take.spoken[i] || (takeT[i] > 0 && !(prevT[i] > 0));
    const part = mine ? (takeT[i] > 0 ? { attemptId: take.attemptId, segments: segs[i] } : null) : prevParts?.[i] ?? null;
    parts.push(part);
    const t = partSeconds(part);
    if (mine && takeT[i] > 0) {
      redone.push(i);
      const over = takeT[i] - (targets[i] ?? 0);
      if (over > best) { best = over; sel = i; }
    }
    if (t > 0) { visited++; tSum += targets[i] ?? 0; total += t; }
  }
  const lastReached = (() => { for (let i = n - 1; i >= 0; i--) if (partSeconds(parts[i]) > 0) return i; return -1; })();
  const full = n > 0 && (visited === n || (lastReached === n - 1 && visited >= Math.ceil(n * 0.5)));
  const delta = full && ctx.lastFullTotal ? Math.round(total - ctx.lastFullTotal) : null;
  const lastRedone = redone.length ? redone[redone.length - 1] : 0;
  const core = take.whole
    ? (full ? 'new full run' : 'new take · stopped at slide ' + (lastRedone + 1))
    : (redone.length === n || !prevParts ? (full ? 'full run' : span(redone)) : span(redone) + ' redone');
  const run: Run = { id: ctx.id, parts, core, createdAt: take.createdAt, full, whole: take.whole,
    targetSum: full ? ctx.deckTarget : tSum, delta, sel, takeNo: ctx.takeNo };

  let compare: CompareSpec | null = null;
  if (prev && prevParts) {
    const slides = take.whole ? Array.from({ length: n }, (_, i) => i) : redone.filter(i => prevT[i] > 0);
    if (slides.length) compare = { slides, whole: take.whole, prev, next: run, attemptId: take.attemptId };
  }
  return { run, redone, compare };
}

/** "Just now · slide 7 redone", "Today · attempt 3 · full run". */
export function runLabel(run: Run, now = Date.now(), day: (iso: string) => string = () => ''): string {
  const age = now - Date.parse(run.createdAt);
  if (Number.isFinite(age) && age < 15 * 60_000) return 'Just now · ' + run.core;
  const when = day(run.createdAt) || 'Earlier';
  return when + ' · ' + (run.full && !run.whole ? 'attempt ' + run.takeNo + ' · ' : '') + run.core;
}
