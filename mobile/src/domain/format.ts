// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: small formatting helpers shared by every screen.

/** m:ss for a number of seconds, rounded, never negative. */
export function fmt(sec: number): string {
  'worklet';
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

export function mod(a: number, n: number): number {
  'worklet';
  return ((a % n) + n) % n;
}

/** Nearest carousel position that shows item `idx` in front, given the current position `p`. */
export function nearestSlot(p: number, idx: number, n: number): number {
  return Math.round((p - idx) / n) * n + idx;
}

export const pad2 = (n: number) => (n < 10 ? '0' : '') + n;

/** "1, 2 and 3" */
export function listNumbers(nums: number[]): string {
  if (nums.length <= 1) return String(nums[0] ?? '');
  return nums.slice(0, -1).join(', ') + ' and ' + nums[nums.length - 1];
}

/** Curly-quote a phrase, turning inner double quotes into single ones. */
export function quote(text: string): string {
  return '“' + String(text).replace(/“/g, '‘').replace(/”/g, '’').replace(/"/g, '’') + '”';
}

export function relativeDay(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';
  const startOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOf(now) - startOf(at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + ' days ago';
  if (days < 14) return 'Last week';
  if (days < 60) return Math.floor(days / 7) + ' weeks ago';
  return new Date(at).toLocaleDateString();
}
