// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: filler counts, key words and slide-point coverage.
// Rules follow the design spec (SPEC §5.3) and extend them to Korean text,
// because the backend's metrics already treat Hangul runs as words.

/** Filler words, matched as whole words, case-insensitive (design list). */
export const FILLERS = ['um', 'uh', 'basically', 'like', 'kind of', 'so yeah', 'you know', 'actually'] as const;
/** Korean hesitation fillers. Only unambiguous forms; common words such as 그 are left out. */
export const KO_FILLERS = ['음', '어', '그니까', '뭐랄까'] as const;

const EN_RE: Record<string, RegExp> = {};
for (const w of FILLERS) EN_RE[w] = new RegExp('\\b' + w.replace(' ', '\\s+') + '\\b', 'gi');
const KO_RE: Record<string, RegExp> = {};
for (const w of KO_FILLERS) KO_RE[w] = new RegExp('(?:^|[^가-힣])' + w + '(?=$|[^가-힣])', 'g');

export function fillerCounts(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const t = String(text || '');
  for (const w of FILLERS) { const m = t.match(EN_RE[w]); if (m) out[w] = m.length; }
  for (const w of KO_FILLERS) { const m = t.match(KO_RE[w]); if (m) out[w] = m.length; }
  return out;
}
export function fillerTotal(text: string): number {
  return Object.values(fillerCounts(text)).reduce((a, b) => a + b, 0);
}
/** Sorted most-frequent first, for the Review filler chips. */
export function fillerList(text: string): [string, number][] {
  return Object.entries(fillerCounts(text)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Words counted for wpm: English word pattern plus contiguous Hangul runs (same as backend metrics). */
export function wordCount(text: string): number {
  const t = String(text || '');
  return (t.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0) + (t.match(/[가-힣]+/g)?.length ?? 0);
}

const STOP = new Set(['this', 'that', 'with', 'your', 'from', 'have', 'they', 'them', 'what', 'which', 'when', 'were', 'will', 'into',
  'about', 'there', 'their', 'than', 'then', 'also', 'only', 'just', 'each', 'does',
  '그리고', '그래서', '하지만', '그러나', '또한', '이것', '그것', '저것', '우리', '여러분', '있습니다', '합니다', '입니다']);
const HANGUL = /[가-힣]/;

/** Lowercase key words: Latin words of 4+ letters, Hangul words of 2+ syllables, numbers; stop words dropped. */
export function keyWords(s: string): string[] {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}%\s]/gu, ' ').split(/\s+/).filter(w => {
    if (!w || STOP.has(w)) return false;
    if (HANGUL.test(w)) return w.length >= 2;
    if (/^\d+%?$/.test(w)) return true;
    return w.length >= 4;
  });
}
/** Comparison stem: first 5 letters (Latin) or first 2 syllables (Hangul, so particles do not matter). */
function stem(w: string): string { return HANGUL.test(w) ? w.slice(0, 2) : w.slice(0, 5); }

/** A slide point counts as said when at least half of its key words show up in the text. */
export function covers(text: string, phrase: string): boolean {
  const said = new Set(keyWords(text).map(stem));
  const pw = keyWords(phrase);
  if (!pw.length) return false;
  return pw.filter(w => said.has(stem(w))).length / pw.length >= 0.5;
}

/** Points that have key words (points without any cannot be scored). */
export function scorablePoints(points: readonly string[]): string[] {
  return points.filter(p => keyWords(p).length > 0);
}
