// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: slide titles, slide points and per-slide target times.
import { keyWords } from './words';
import { validateRequirementValues, type PresentationRequirements } from './presentationRequirements';

export type SlideText = { title: string; points: string[]; text: string };

const BULLET = /^\s*(?:[•●○◦▪▫■□‣⁃∙·\-–—*>]|\(?\d{1,2}[.)]|[a-zA-Z][.)])\s+/;

/**
 * Turn the server's extracted page text into a title and slide points.
 * PDF text extraction breaks wrapped lines, so a line that starts in lowercase
 * (or with a connector) continues the previous point.
 */
export function parseSlideText(raw: string, index: number): SlideText {
  const text = String(raw || '').replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l && !/^\d{1,3}$/.test(l) && /[\p{L}]/u.test(l));
  let title = '';
  const points: string[] = [];
  for (const line of lines) {
    if (!title) { title = line.replace(BULLET, '').slice(0, 90); continue; }
    const bulleted = BULLET.test(line);
    const body = line.replace(BULLET, '');
    const continues = !bulleted && points.length > 0 && (/^[a-z(,;:]/.test(body) || /[,;:\-–]$/.test(points[points.length - 1]));
    if (continues) points[points.length - 1] = (points[points.length - 1] + ' ' + body).slice(0, 160);
    else points.push(body.slice(0, 160));
  }
  const usable = points.filter(p => keyWords(p).length > 0).slice(0, 6);
  return { title: title || 'Slide ' + (index + 1), points: usable, text: lines.join(' ') };
}

/** JJ's legacy suggestion: one minute per slide, capped at ten minutes; never a required duration. */
export function defaultTarget(pageCount: number): number {
  return Math.max(30, Math.min(600, 60 * Math.max(1, pageCount)));
}

/**
 * Split the target across slides in proportion to how much text each slide has,
 * so text-heavy slides get more time. Integers that sum exactly to `total`.
 */
export function slideTargets(texts: readonly string[], total: number): number[] {
  const n = texts.length;
  if (!n) return [];
  const weights = texts.map(t => 1 + Math.min(80, keyWords(t).length) / 40);
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => (total * w) / sum);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) out[order[k][1]]++;
  return out;
}

/** Phase 3: explicit time only; never infer a requirement from JJ's saved defaults. */
export function requiredSlideTargets(texts: readonly string[], total: number | null): number[] | null {
  validateRequirementValues(total, '');
  return total === null ? null : slideTargets(texts, total);
}

export type PresentationTiming = {
  source: 'required' | 'legacy_default'; total: number; targets: number[]; requirementsRevision: number | null;
};

/** Derived on read, without overwriting presentation, selected-run or Compare snapshots. */
export function presentationTiming(deck: { pageCount: number; slides: readonly { text: string }[]; target: number; targets: number[] },
  requirements: PresentationRequirements): PresentationTiming {
  const targets = requiredSlideTargets(Array.from({ length: deck.pageCount }, (_, i) => deck.slides[i]?.text ?? ''), requirements.requiredDurationSeconds);
  return targets === null
    ? { source: 'legacy_default', total: deck.target, targets: [...deck.targets], requirementsRevision: null }
    : { source: 'required', total: requirements.requiredDurationSeconds!, targets, requirementsRevision: requirements.revision };
}

/** Cue chips for one slide: its points, with points missed in the last run marked "Don't skip". */
export function cuesFor(points: readonly string[], missed: ReadonlySet<string>): { text: string; mustSay: boolean }[] {
  return points.map(p => ({ text: missed.has(p) ? 'Don’t skip: ' + p : p, mustSay: missed.has(p) }));
}
