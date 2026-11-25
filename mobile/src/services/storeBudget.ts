import { STORE_MODE } from './apiConfig';

export const exhaustedNotice = 'The remaining free coaching budget cannot cover this request. You can still record and play back on this phone.';
export const unavailableNotice = 'Free online coaching is currently unavailable. You can still record and play back on this phone.';
export function budgetNotice(code: unknown) {
  return code === 'public_budget_exhausted' ? exhaustedNotice : code === 'public_budget_unavailable' ? unavailableNotice : null;
}
export function budgetStatus(code: unknown) {
  if (code === 'public_budget_exhausted') return 'Free coaching budget too low';
  if (code === 'public_budget_unavailable') return 'Free coaching unavailable';
  return null;
}

/** Only server-owned status fields can signal a budget failure. User slides and transcripts are never searched. */
export function stageBudgetNotice(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== 'object' || depth > 5) return null;
  const stage = value as Record<string, unknown>;
  const error = stage.error as { code?: unknown } | null;
  const own = budgetNotice(error?.code) ?? budgetNotice(stage.error) ?? budgetNotice(stage.error_code);
  if (own) return own;
  for (const key of ['processing', 'processing_result', 'dependency', 'feedback', 'feedback_analysis', 'whole', 'segments', 'slides']) {
    const nested = stage[key];
    if (!nested || typeof nested !== 'object') continue;
    for (const part of Array.isArray(nested) ? nested : [nested]) {
      const notice = stageBudgetNotice(part, depth + 1);
      if (notice) return notice;
    }
  }
  return null;
}

const reported = new Set<string>();
const listeners = new Set<() => void>();
let current: string | null = null;
export const getBudgetNotice = () => current;
export const subscribeBudget = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function dismissBudgetNotice() { current = null; listeners.forEach(listener => listener()); }

/** Inspect a decoded live response once, without copying streamed media or parsing saved results. */
export async function readCoachingJson(response: Response): ReturnType<Response['json']> {
  const data = await response.json();
  if (STORE_MODE) {
    const notice = stageBudgetNotice(data);
    if (notice && !reported.has(notice)) {
      reported.add(notice);
      current = notice;
      listeners.forEach(listener => listener());
    }
  }
  return data;
}
