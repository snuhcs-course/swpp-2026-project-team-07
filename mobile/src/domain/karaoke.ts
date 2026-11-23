// Supplied Claude-generated patch, integrated by OpenAI Codex for Iteration 2 (2026-11-21).
// Listen back (S13) karaoke: the clock, pages and word states behind the word-by-word highlight.
// Every word keeps the provider's timestamps (ms in its own take's audio); nothing here estimates timing.
import type { TranscriptWord } from '../contracts';
import { transcriptSpans } from '../features/transcription/playback';
import type { Line } from './lines';
import { listenEntryAt, type ListenVisit } from './listenTimeline';
import { FILLERS, KO_FILLERS } from './words';

/** One word as drawn: its text plus the spacing and punctuation that follow it, so punctuation takes the word's colour. */
export type KaraokeToken = { text: string; word: TranscriptWord; filler: boolean };
/** At most four rows of the 28 px current-line type on the 334 px measure. */
export type KaraokePage = { key: string; lineKey: string; slide: number; attemptId: string; tokens: KaraokeToken[];
  text: string; startMs: number; endMs: number };
/** A point in one take's audio: which take, where in it (ms), and the selected visit that contains it. */
export type SourcePoint = { attemptId: string; ms: number; visit: ListenVisit };
export type WordState = 'plain' | 'upcoming' | 'current' | 'spoken';

/** Width budget of one page in em of Bricolage Grotesque 700 (4 rows hold about 47 em; the rest absorbs word wrap). */
export const PAGE_EM = 36;
/** A tapped word starts this much early so its first sound is not clipped. */
export const PRE_ROLL_MS = 120;

// Advance widths of Bricolage Grotesque 700 in em (measured from the font file), minus the -0.3 px tracking at 28 px.
const NARROW = new Set([...'fijlrtI.,;:!\'’|']), WIDE = new Set([...'mwMW']);
const PUNCT: Record<string, number> = { '?': 0.29, '"': 0.36, '“': 0.4, '”': 0.4, '-': 0.35, '–': 0.54, '—': 0.8, '…': 0.98, '%': 0.77, '(': 0.32, ')': 0.32 };
/** Estimated width of `text` in em. Hangul, kana and Han fall back to a system font at about 1 em per character. */
export function textEm(text: string): number {
  let em = 0;
  for (const ch of text) {
    if (/\s/u.test(ch)) em += 0.23;
    else if (/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) em += 1;
    else if (NARROW.has(ch)) em += 0.3;
    else if (WIDE.has(ch)) em += 0.93;
    else if (ch in PUNCT) em += PUNCT[ch];
    else if (/[A-Z]/.test(ch)) em += 0.69;
    else if (/[0-9]/.test(ch)) em += ch === '1' ? 0.35 : 0.63;
    else em += 0.6;
    em -= 0.011;
  }
  return em;
}

/** Fillers in a line, matched as whole words or word pairs ("you know"), case-insensitive. */
export function fillerIndexes(words: readonly TranscriptWord[]): Set<number> {
  const marked = new Set<number>();
  const tokens = words.map(word => word.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, ''));
  for (const filler of [...FILLERS, ...KO_FILLERS]) {
    const parts = filler.toLocaleLowerCase().split(/\s+/u);
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      if (parts.every((part, offset) => tokens[i + offset] === part)) parts.forEach((_, offset) => marked.add(i + offset));
    }
  }
  return marked;
}

/** The line's words with the original punctuation and spacing attached to the word before it. */
export function lineTokens(line: Pick<Line, 'text' | 'words'>): KaraokeToken[] {
  const words = line.words, fillers = fillerIndexes(words);
  const spans = transcriptSpans({ text: line.text, words });
  if (words.length && spans.some(span => span.wordIndex !== null)) {
    const tokens: KaraokeToken[] = [];
    let lead = '';
    for (const span of spans) {
      if (span.wordIndex === null) {
        if (tokens.length) tokens[tokens.length - 1].text += span.text; else lead += span.text;
        continue;
      }
      tokens.push({ text: (tokens.length ? '' : lead.trimStart()) + span.text, word: words[span.wordIndex], filler: fillers.has(span.wordIndex) });
    }
    return tokens.map((token, i) => ({ ...token, text: i === tokens.length - 1 ? token.text.trimEnd() : token.text.replace(/\s+$/u, ' ') }));
  }
  // Text and timed words disagree: draw the timed words, a space before each unless it starts with punctuation.
  return words.map((word, i) => {
    const text = word.text.trim(), next = words[i + 1]?.text.trim() ?? '';
    return { text: text + (next && !/^[,.;:?!%)\]}]/u.test(next) ? ' ' : ''), word, filler: fillers.has(i) };
  });
}

const timed = (word: TranscriptWord) => Number.isFinite(word.start_ms) && word.start_ms >= 0;

/** Split tokens into pages of about equal width, none wider than `budget` em (a single longer word gets its own page). */
export function pageTokens(tokens: readonly KaraokeToken[], budget = PAGE_EM): KaraokeToken[][] {
  if (!tokens.length) return [];
  const widths = tokens.map(token => textEm(token.text)), total = widths.reduce((a, b) => a + b, 0);
  for (let count = Math.max(1, Math.ceil(total / budget)); ; count++) {
    const target = total / count, pages: KaraokeToken[][] = [];
    let page: KaraokeToken[] = [], width = 0;
    tokens.forEach((token, i) => {
      const full = width + widths[i] > budget;
      // Close at the target width: when adding this word takes the page further past the target than stopping short.
      const reached = width + widths[i] / 2 > target && count - pages.length > 1;
      if (page.length && (full || reached)) { pages.push(page); page = []; width = 0; }
      page.push(token); width += widths[i];
    });
    pages.push(page);
    if (pages.length <= count) return pages;
  }
}

/** Karaoke pages for the run, in the order Listen back plays them. */
export function karaokePages(lines: readonly Line[], budget = PAGE_EM): KaraokePage[] {
  return lines.flatMap(line => pageTokens(lineTokens(line), budget).map((tokens, i) => ({
    key: `${line.key}:${i}`, lineKey: line.key, slide: line.slide, attemptId: line.audio.attemptId, tokens,
    text: tokens.map(token => token.text).join('').trim(),
    startMs: tokens.find(token => timed(token.word))?.word.start_ms ?? line.audio.startMs,
    endMs: Math.max(...tokens.map(token => token.word.end_ms).filter(Number.isFinite), line.audio.startMs),
  })));
}

/** Where a run position (seconds) falls in the recorded audio. Positions in unrecorded time have no source. */
export function sourceAt(seconds: number, visits: readonly ListenVisit[]): SourcePoint | null {
  const visit = listenEntryAt(seconds, visits);
  if (!visit) return null;
  return { attemptId: visit.attemptId, ms: visit.startMs + Math.max(0, Math.min(visit.durationMs, (seconds - visit.runStart) * 1000)), visit };
}

/** The run position (seconds) of a moment in a take, or null when that moment is not in a selected visit. */
export function runSecondsAt(attemptId: string, ms: number, visits: readonly ListenVisit[]): number | null {
  const visit = visits.find(item => item.attemptId === attemptId && ms >= item.startMs && ms < item.endMs);
  return visit ? visit.runStart + (ms - visit.startMs) / 1000 : null;
}

/** The word being spoken at `ms`: the last word that has started. It stays lit through the pause until the next word starts. */
export function activeWord(tokens: readonly KaraokeToken[], ms: number): number {
  for (let i = tokens.length - 1; i >= 0; i--) if (timed(tokens[i].word) && tokens[i].word.start_ms <= ms) return i;
  return -1;
}

/** `active` null means no playback (idle): every word is plain. */
export function wordState(index: number, active: number | null): WordState {
  if (active === null) return 'plain';
  return index < active ? 'spoken' : index === active ? 'current' : 'upcoming';
}

/** The page on screen at a source point, and the word lit on it. Before the visit's first word: its first page, nothing lit yet. */
export function pageAt(point: SourcePoint | null, pages: readonly KaraokePage[]): { index: number; word: number } | null {
  if (!point) return null;
  let first = -1, index = -1;
  pages.forEach((page, i) => {
    if (page.attemptId !== point.attemptId || page.startMs < point.visit.startMs || page.startMs >= point.visit.endMs) return;
    if (first < 0) first = i;
    if (page.startMs <= point.ms) index = i;
  });
  if (first < 0) return null;
  const chosen = index >= 0 ? index : first;
  return { index: chosen, word: activeWord(pages[chosen].tokens, point.ms) };
}

/** Where a tapped word starts playing, in its take (ms): a short pre-roll, never before its visit. */
export function wordSeekMs(word: TranscriptWord, visit: Pick<ListenVisit, 'startMs' | 'endMs'>): number {
  return Math.min(visit.endMs - 1, Math.max(visit.startMs, word.start_ms - PRE_ROLL_MS));
}
