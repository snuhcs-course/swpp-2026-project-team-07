// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration/iteration-2/prompt-log.md#finger-linked-page-fade-october-15-2026
// OpenAI Codex stationary back crossfade: docs/ai-collaboration/iteration-2/prompt-log.md#stationary-back-crossfade-october-15-2026
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: gesture physics from the prototype (SPEC §4.1, §4.4, §8).
// Functions marked 'worklet' also run on the UI thread inside Reanimated styles.

export const FLOW_X1 = 196;
export const FLOW_XS = 44;
export const FLOW_ROT = 55;
export const PX_PER_CARD = 190;
export const PULL_T = 90;
export const HOLD_MS = 3000;
export const CARD_STEP = 374;
export const BACK_T = 110;
/** Downward drag distance in design units at which the current page is fully faded. */
export const BACK_FADE_Y = 240;

export type FlowSlot = {
  dd: number; x: number; scale: number; rotateY: number; blur: number; brightness: number;
  opacity: number; shadowOpacity: number; shadowScale: number; z: number; live: boolean;
};

/**
 * Cover-flow placement of item `j` for carousel position `p` (fractional while turning).
 * `spread` (0..1) slides the front item and everything left of it one place left
 * to make room for a new presentation while pulling up.
 */
export function coverFlow(j: number, p: number, n: number, spread: number): FlowSlot {
  'worklet';
  let dd = ((((j - p + n / 2) % n) + n) % n) - n / 2;
  if (spread > 0 && dd <= 0.001) dd -= spread;
  const a = Math.abs(dd), sg = dd < 0 ? -1 : 1, side = Math.min(1, a), far = Math.max(0, a - 1);
  const depth = Math.min(1, a / 2);
  const edge = Math.max(0, Math.min(1, (n / 2 - a) / 0.5));
  return {
    dd, x: sg * (side * FLOW_X1 + far * FLOW_XS), scale: 1 - side * 0.2 - far * 0.08, rotateY: -sg * side * FLOW_ROT,
    blur: side * 3.2 + far * 1.8, brightness: 1 - side * 0.45, opacity: (1 - depth * 0.5) * edge,
    shadowOpacity: (1 - depth * 0.7) * edge, shadowScale: 1 - side * 0.4, z: 150 - Math.round(a * 20), live: a < 1.4,
  };
}

/** Rubber band beyond a threshold. */
export function rubber(v: number, limit: number, k: number): number {
  'worklet';
  const a = Math.abs(v);
  return a > limit ? Math.sign(v) * (limit + (a - limit) * k) : v;
}

/** Where the card track should rest after release (SPEC §4.4 release rules). */
export function decideRelease(o: { x: number; base: number; vel: number; step: number; slide: number; n: number }): { dir: -1 | 0 | 1; ms: number } {
  'worklet';
  const { x, base, vel, step, slide, n } = o;
  let dir: -1 | 0 | 1 = 0;
  const pd: -1 | 1 = x < 0 ? 1 : -1;
  const moved = x - base;
  if (Math.abs(vel) > 0.28) {
    const fd: -1 | 1 = vel < 0 ? 1 : -1;
    if (Math.abs(x) < 10 || fd === pd) dir = fd;
  } else if (Math.abs(x) > step * 0.5 || (Math.abs(moved) > step * 0.2 && (moved < 0 ? 1 : -1) === pd)) {
    dir = pd;
  }
  const next = slide + dir;
  if (dir !== 0 && next >= 0 && next < n) {
    const rem = Math.abs(-dir * step - x);
    return { dir, ms: Math.round(Math.max(170, Math.min(300, 150 + rem * 0.36 - Math.abs(vel) * 70))) };
  }
  return { dir: 0, ms: Math.round(Math.max(170, Math.min(280, 150 + Math.abs(x) * 0.36))) };
}

/** Let Review's body scroll normally; a pull down from its top returns to slides. */
export function claimReviewDrag({dx,dy,startY,scrollY,modal}: {dx:number;dy:number;startY:number;scrollY:number;modal:boolean}): boolean {
  if (modal || Math.abs(dy) <= 8 || Math.abs(dy) <= Math.abs(dx)) return false;
  return startY < 102 || (dy > 0 && scrollY <= 1);
}
