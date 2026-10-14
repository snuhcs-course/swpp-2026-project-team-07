// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: findings, Review insights, Compare and Home stats
// (SPEC §4.1, §4.5, §4.6, §5.5, §5.6). Pure functions over the merged run.
import { fmt, listNumbers, quote } from './format';
import { slideText, type Line } from './lines';
import { runTimes, type Run } from './run';
import { covers, fillerCounts, fillerTotal, scorablePoints, wordCount } from './words';

export type IconKey = 'i-timer' | 'i-clock' | 'i-faster' | 'i-slower' | 'i-plus' | 'i-doc' | 'i-mic' | 'i-replay' | 'i-bubble' |
  'i-flag' | 'i-arrow' | 'i-loop' | 'i-wave' | 'i-check' | 'i-gauge' | 'i-bulb' | 'i-chart' | 'i-slides' | 'i-text' | 'i-trash';
export type Row = { icon: IconKey; text: string };
export type Tone = 'good' | 'warn' | 'info' | 'bad' | 'plain';
export type ChipModel = { icon: IconKey; text: string; tone: Tone };
export type Suggestion = { slide: number; category: 'consistency' | 'clarity' | 'audience'; observation: string; suggestion: string };

/** Per-slide findings, re-run on every transcript fix. */
export function findingsFor(slide: number, lines: readonly Line[], points: readonly string[], ai: readonly Suggestion[], haveText: boolean): Row[] {
  const out: Row[] = [];
  const text = slideText(lines, slide);
  const fc = fillerCounts(text);
  let top: string | null = null;
  for (const w of Object.keys(fc)) if (!top || fc[w] > fc[top]) top = w;
  if (top && fc[top] >= 2) out.push({ icon: 'i-bubble', text: quote(top) + ' ' + fc[top] + ' times on this slide' });
  if (haveText) {
    const missing = scorablePoints(points).filter(p => !covers(text, p));
    if (missing.length) out.push({ icon: 'i-flag', text: 'Not said: ' + quote(missing[0]) });
  }
  const spilled = lines.some(l => l.slide === slide && l.edge === 1) || lines.some(l => l.slide === slide + 1 && l.edge === -1);
  if (spilled) out.push({ icon: 'i-arrow', text: 'Moved to slide ' + (slide + 2) + ' mid-sentence' });
  for (const s of ai.filter(x => x.slide === slide).slice(0, 2)) {
    out.push({ icon: s.category === 'consistency' ? 'i-loop' : s.category === 'clarity' ? 'i-wave' : 'i-bubble', text: s.observation });
  }
  return out;
}

export type Insights = { tip: string | null; best: { label: string; sub: string } | null; worst: { label: string; sub: string } | null };

export function reviewInsights(times: readonly number[], targets: readonly number[], total: number, targetSum: number): Insights {
  const n = times.length;
  const reached: number[] = [];
  for (let i = 0; i < n; i++) if (times[i] > 0) reached.push(i);
  const out: Insights = { tip: null, best: null, worst: null };
  if (!reached.length) return out;
  const over = total - targetSum;
  const ov = (k: number) => times[k] - (targets[k] ?? 0);
  if (over > 5) {
    const top = reached.filter(k => ov(k) > 3).sort((a, b) => ov(b) - ov(a)).slice(0, 3);
    if (top.length) {
      const held = top.reduce((acc, k) => acc + ov(k), 0);
      const w = top[0];
      let reachAt = 0, aimAt = 0;
      for (let j = reached[0]; j < w; j++) { reachAt += times[j]; aimAt += targets[j] ?? 0; }
      const ids = top.slice().sort((a, b) => a - b);
      out.tip = 'Trim slide' + (ids.length > 1 ? 's ' : ' ') + listNumbers(ids.map(k => k + 1)) + ' — ' +
        (ids.length > 1 ? 'they hold ' : 'it holds ') + fmt(held) + ' of your ' + fmt(over) + ' over.' +
        (w > reached[0] && reachAt > aimAt ? ' Reach slide ' + (w + 1) + ' by ' + fmt(aimAt) + '; you got there at ' + fmt(reachAt) + '.' : '');
    } else {
      out.tip = 'You ran ' + fmt(over) + ' over, spread across many slides. Tighten each one a little.';
    }
  } else if (over < -5) {
    const short = reached.slice().sort((a, b) => ov(a) - ov(b))[0];
    out.tip = 'You finished ' + fmt(-over) + ' under. Slide ' + (short + 1) + ' ran shortest — there’s room to expand it.';
  } else {
    out.tip = 'Right on time. Keep this pace and focus on cutting fillers.';
  }
  if (reached.length >= 2) {
    const win = Math.min(3, reached.length);
    let bestI = 0, worstI = 0, bestV = Infinity, worstV = -Infinity;
    for (let s0 = 0; s0 + win <= reached.length; s0++) {
      let absSum = 0, ovSum = 0;
      for (let q = s0; q < s0 + win; q++) { const o = ov(reached[q]); absSum += Math.abs(o); ovSum += o; }
      if (absSum < bestV) { bestV = absSum; bestI = s0; }
      if (ovSum > worstV) { worstV = ovSum; worstI = s0; }
    }
    const rng = (s0: number) => { const a = reached[s0] + 1, b = reached[s0 + win - 1] + 1; return a === b ? 'Slide ' + a : 'Slides ' + a + '–' + b; };
    out.best = { label: rng(bestI), sub: 'Within ' + fmt(bestV / win) + ' of target' };
    out.worst = { label: rng(worstI), sub: worstV > 0 ? '+' + fmt(worstV) + ' over together' : 'Closest to running long' };
  }
  return out;
}

/** Slide chip and first row of the selected slide card on Review. */
export function slideVerdict(t: number, target: number): { row: Row; chip: ChipModel | null } {
  const ov = t - target;
  if (t <= 0) return { row: { icon: 'i-clock', text: 'Not reached in this run' }, chip: null };
  if (ov >= 15) return { row: { icon: 'i-clock', text: fmt(ov) + ' over this slide’s ' + fmt(target) }, chip: { icon: 'i-clock', text: '+' + fmt(ov), tone: 'bad' } };
  if (ov <= -15) return { row: { icon: 'i-gauge', text: fmt(-ov) + ' under this slide’s ' + fmt(target) }, chip: { icon: 'i-gauge', text: '−' + fmt(-ov), tone: 'info' } };
  return { row: { icon: 'i-check', text: 'On target' }, chip: { icon: 'i-check', text: 'On target', tone: 'good' } };
}

export function reviewChips(total: number, targetSum: number, wpm: number | null, delta: number | null): ChipModel[] {
  const chips: ChipModel[] = [];
  const over = total - targetSum;
  chips.push(over >= 0 ? { icon: 'i-clock', text: '+' + fmt(over) + ' over', tone: 'warn' } : { icon: 'i-gauge', text: fmt(-over) + ' under', tone: 'info' });
  if (wpm) chips.push({ icon: 'i-gauge', text: wpm + ' wpm', tone: 'plain' });
  if (delta != null && Math.abs(delta) >= 1) {
    chips.push(delta < 0 ? { icon: 'i-faster', text: fmt(-delta) + ' faster', tone: 'good' } : { icon: 'i-slower', text: fmt(delta) + ' slower', tone: 'warn' });
  }
  return chips;
}

/** Words per minute over a stretch of speech (including pauses, like the backend metrics). */
export function wpmOf(text: string, seconds: number): number | null {
  if (seconds < 5) return null;
  const words = wordCount(text);
  return words ? Math.round(words / (seconds / 60)) : null;
}

// ── Home stats ──────────────────────────────────────────────────────────────
export type HeroStats = {
  coverage: number | null; said: number; total: number; fpm: number | null; wpm: number | null; pace: 'slow' | 'steady' | 'fast' | null;
};
/** Coverage, fillers and pace for the merged run. Null fields are not available yet (transcribing or no slide text). */
export function heroStats(run: Run | null, n: number, lines: readonly Line[], points: readonly (readonly string[])[], transcribed: boolean): HeroStats | null {
  if (!run) return null;
  const times = runTimes(run, n);
  const total = times.reduce((a, b) => a + b, 0);
  let said = 0, all = 0;
  for (let i = 0; i < n; i++) {
    const pts = scorablePoints(points[i] || []);
    all += pts.length;
    if (times[i] > 0 && transcribed) { const text = slideText(lines, i); said += pts.filter(p => covers(text, p)).length; }
  }
  const text = lines.map(l => l.text).join(' ');
  const wpm = transcribed ? wpmOf(text, total) : null;
  return {
    coverage: transcribed && all ? Math.round((100 * said) / all) : null, said, total: all,
    fpm: transcribed && total >= 10 ? Math.round((fillerTotal(text) / (total / 60)) * 10) / 10 : null,
    wpm, pace: wpm == null ? null : wpm < 130 ? 'slow' : wpm > 150 ? 'fast' : 'steady',
  };
}

// ── Compare takes ───────────────────────────────────────────────────────────
export type TakeSummary = { time: number; fc: Record<string, number>; ft: number; said: string[]; open: string; wpm: number | null; ready: boolean };
export function summarizeTake(times: readonly number[], lines: readonly Line[], points: readonly string[], ready: boolean): TakeSummary {
  const ls = lines.slice().sort((a, b) => a.slide - b.slide || a.t - b.t);
  const text = ls.map(l => l.text).join(' ');
  const time = times.reduce((a, b) => a + b, 0);
  return { time, fc: fillerCounts(text), ft: fillerTotal(text), said: points.filter(p => covers(text, p)), open: ls[0]?.text ?? '', wpm: wpmOf(text, time), ready };
}
export function compareChips(oldT: TakeSummary, newT: TakeSummary, target: number): ChipModel[] {
  const dt = newT.time - oldT.time, over = newT.time - target, chips: ChipModel[] = [];
  if (Math.abs(dt) >= 1) chips.push(dt < 0 ? { icon: 'i-faster', text: fmt(-dt) + ' faster', tone: 'good' } : { icon: 'i-slower', text: fmt(dt) + ' slower', tone: 'warn' });
  chips.push(over > 3 ? { icon: 'i-clock', text: fmt(over) + ' over target', tone: 'warn' }
    : over < -3 ? { icon: 'i-gauge', text: fmt(-over) + ' under target', tone: 'info' } : { icon: 'i-check', text: 'On target', tone: 'good' });
  return chips;
}
export function compareRows(oldT: TakeSummary, newT: TakeSummary, points: readonly string[]): Row[] {
  if (!newT.ready || !oldT.ready) return [{ icon: 'i-wave', text: 'Transcribing the takes — fillers and points appear here.' }];
  const rows: Row[] = [];
  let drop: string | null = null, dv = 0;
  for (const w of new Set([...Object.keys(oldT.fc), ...Object.keys(newT.fc)])) {
    const d = (oldT.fc[w] || 0) - (newT.fc[w] || 0);
    if (Math.abs(d) > Math.abs(dv)) { dv = d; drop = w; }
  }
  if (drop) rows.push({ icon: 'i-bubble', text: quote(drop) + ' ' + (oldT.fc[drop] || 0) + ' → ' + (newT.fc[drop] || 0) });
  const gained = newT.said.filter(p => !oldT.said.includes(p));
  const missing = points.filter(p => !newT.said.includes(p));
  if (gained.length) rows.push({ icon: 'i-check', text: 'Now covers ' + quote(gained[0]) });
  if (missing.length) rows.push({ icon: 'i-flag', text: 'Still not said: ' + quote(missing[0]) });
  if (!rows.length) rows.push({ icon: 'i-check', text: newT.ft ? 'Same points covered as before' : 'No filler words in either take' });
  return rows.slice(0, 3);
}

// ── Recording pace chip (SPEC §4.4) ─────────────────────────────────────────
export function paceChip(elapsed: number, cur: number, startSlide: number, targets: readonly number[]): ChipModel {
  let cs = 0;
  for (let i = startSlide; i < cur; i++) cs += targets[i] ?? 0;
  const ce = cs + (targets[cur] ?? 0);
  if (elapsed > ce + 3) return { icon: 'i-slower', text: fmt(elapsed - ce) + ' behind', tone: 'warn' };
  if (elapsed < cs - 3) return { icon: 'i-gauge', text: fmt(cs - elapsed) + ' ahead', tone: 'info' };
  return { icon: 'i-check', text: 'On pace', tone: 'good' };
}
