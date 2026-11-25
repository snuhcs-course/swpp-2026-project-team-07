// AI-generated with Claude (Anthropic), Iteration 5 (2026-11-20).
// Integrated with OpenAI Codex for OutLoud Iteration 2: docs/ai-collaboration-prompts-iteration-2.md#centre-pdf-import-ring
// Home carousel geometry shared with Upload. While a PDF is analysed, Home keeps
// drawing the "New presentation" icon (shrunk in place) and Upload draws the
// progress ring around it, so both screens must agree on where that icon is.
// Units are the 390-wide design frame.

export const CAROUSEL_TOP = 150;
export const SLOT_W = 260, SLOT_H = 223, SLOT_TOP = 61;
/** Point inside a slot (from its top) that stays fixed while the slot scales. */
export const ORIGIN_Y = 111;
export const deckIconSize = (compact: boolean) => (compact ? 120 : 146);

// The moving title lands before blending into the Home card's text layout.
export const HOME_TITLE_LANDING = 0.74;
export const HOME_TITLE_BLENDED = 0.90;

export function homeTitleReveal(progress: number) {
  'worklet';
  return Math.max(0, Math.min(1, (progress - HOME_TITLE_LANDING) / (HOME_TITLE_BLENDED - HOME_TITLE_LANDING)));
}

export function homeSlideCountReveal(progress: number) {
  'worklet';
  return Math.max(0, Math.min(1, (progress - 0.68) / 0.28));
}

export function uploadGlowReturn(progress: number) {
  'worklet';
  return Math.min(1, progress * 260 / 220);
}
/** Size of the "New presentation" icon while a PDF is analysed, relative to Home. */
export const ANALYZE_ICON_SCALE = 0.58;

export const ANALYZE_RING_STROKE = 5;
/** Space between the shrunk icon's box and the ring's centre line. */
const ANALYZE_RING_GAP = 26;

/** Centre (y) and radius of the analysis ring; it is centred on the shrunk icon. */
export function analyzeRing(compact: boolean) {
  const size = deckIconSize(compact);
  const fixed = CAROUSEL_TOP + SLOT_TOP + ORIGIN_Y;
  // The icon sits at the bottom of the slot's item box.
  const iconCentre = CAROUSEL_TOP + SLOT_TOP + SLOT_H - size / 2;
  const cy = fixed + (iconCentre - fixed) * ANALYZE_ICON_SCALE;
  const r = (size * ANALYZE_ICON_SCALE) / 2 + ANALYZE_RING_GAP;
  return { cy, r, top: cy - r - ANALYZE_RING_STROKE / 2, bottom: cy + r + ANALYZE_RING_STROKE / 2 };
}
