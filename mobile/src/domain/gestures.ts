// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-117
// OpenAI Codex stationary back crossfade: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-119
// OpenAI Codex Home carousel positions: docs/ai-collaboration-prompts-iteration-2.md#show-neighbouring-home-presentations
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OutLoud redesign: gesture physics from the prototype (SPEC §4.1, §4.4, §8).
// Functions marked 'worklet' also run on the UI thread inside Reanimated styles.

// OpenAI Codex integrated supplied carousel spacing and blur: docs/ai-collaboration-prompts-iteration-2.md#widen-and-blur-home-carousel--november-20-2026
// Home carousel layout. The cards next to the front one sit 170 from the centre (was 155),
// leaving more room around the front card while most of their icon stays on a 390-wide
// screen. Cards two away sit 260 out, just off-screen, and slide in as the carousel spins.
// Side cards turn 45°.
export const FLOW_X1 = 170;
export const FLOW_XS = 90;
export const FLOW_ROT = 45;
// Blur (CSS sigma, dp) of the card next to the front one, and the extra for the card two away.
// The whole card blurs, title included; the front card stays sharp. Android 12+ draws it.
export const FLOW_BLUR1 = 2;
export const FLOW_BLUR2 = 1.2;
export const PX_PER_CARD = 190;
export const PULL_T = 90;
export const HOLD_MS = 3000;
export const CARD_STEP = 374;
export const BACK_T = 110;
/** Downward drag distance in design units at which the current page is fully faded. */
// OpenAI Codex, 2026-11-19: a shorter fade travel makes slow downward swipes visibly dissolve the page.
export const BACK_FADE_Y = 180;

// OpenAI Codex, 2026-11-25: keep the Review and Audience Q&A page transitions in step.
export const REVIEW_PAGE_SWIPE = { distance: 60, enterMs: 220, exitMs: 180, resetMs: 160 };

// OpenAI Codex, 2026-11-19: keep a Home carousel fling readable without making a single turn sluggish.
export function homeCarouselRelease(position: number, velocity: number): { target: number; duration: number } {
  'worklet';
  const target = Math.round(position + Math.max(-4, Math.min(4, velocity * 0.25)));
  const distance = Math.abs(target - position);
  return { target, duration: Math.min(860, Math.max(300, 260 + distance * 145)) };
}

export function carouselGlowWeight(hues: readonly string[], hue: string, position: number, uploading: boolean): number {
  'worklet';
  const count = hues.length;
  if (!count) return 0;
  const floor = Math.floor(position);
  const fraction = position - floor;
  const left = ((floor % count) + count) % count;
  const right = (left + 1) % count;
  if (uploading) return Number(fraction !== 0.5 && hues[fraction < 0.5 ? left : right] === hue);
  // Only cards within one slot of the centre contribute to the glow.
  const leftWeight = (1 - fraction) ** 2 * (1 + 2 * fraction);
  const rightWeight = fraction ** 2 * (3 - 2 * fraction);
  if (left === right) return hues[left] === hue ? Math.max(leftWeight, rightWeight) : 0;
  return Math.min(1, (hues[left] === hue ? leftWeight : 0) + (hues[right] === hue ? rightWeight : 0));
}

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
    blur: side * FLOW_BLUR1 + far * FLOW_BLUR2, brightness: 1 - side * 0.45, opacity: (1 - depth * 0.5) * edge,
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
    return { dir, ms: Math.round(Math.max(300, Math.min(480, 250 + rem * 0.4 - Math.abs(vel) * 45))) };
  }
  return { dir: 0, ms: Math.round(Math.max(300, Math.min(440, 250 + Math.abs(x) * 0.4))) };
}

/** Let Review's body scroll normally; a pull down from its top returns to slides. */
export function claimReviewDrag({dx,dy,startY,scrollY,modal}: {dx:number;dy:number;startY:number;scrollY:number;modal:boolean}): boolean {
  if (modal || Math.abs(dy) <= 8 || Math.abs(dy) <= Math.abs(dx)) return false;
  return startY < 102 || (dy > 0 && scrollY <= 1);
}
