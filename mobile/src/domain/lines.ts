// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex slide-spill detection: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// OutLoud redesign: transcript sentences for the merged run (SPEC §5.4, §6).
// Sentences come from hosted Whisper. Slide-change events split a sentence at
// the first word whose timestamp belongs to the next slide.
import type { Transcript } from '../contracts';
import { transcriptSpans } from '../features/transcription/playback';
import { partSeconds, runStarts, type Run } from './run';

export type Flag = { w: string; alts: string[] };
export type Line = {
  /** Stable across merges and edits: attempt id + index of the first word. */
  key: string;
  slide: number;
  /** Seconds from the start of the merged run. */
  t: number;
  /** Seconds from the start of its slide. */
  rel: number;
  text: string;
  flags: Flag[];
  /** -1: may belong to the previous slide; +1: ran on into the next slide. */
  edge: -1 | 0 | 1;
  moved: boolean;
  from: number | null;
  fixed: boolean;
  audio: { attemptId: string; startMs: number; endMs: number };
};
export type LineEdit = { text?: string; slide?: number; dismissed?: string[] };
export type Sentence = { first: number; last: number; text: string };

/** Split a transcript into sentences, keeping Whisper's punctuation; long or paused stretches are split too. */
export function sentences(transcript: Transcript): Sentence[] {
  const words = transcript.words;
  if (!words.length) return [];
  const spans = transcriptSpans(transcript);
  const mapped = spans.some(s => s.wordIndex !== null);
  const out: Sentence[] = [];
  let cur: Sentence | null = null;
  const close = () => { if (cur && cur.text.trim()) out.push({ ...cur, text: cur.text.replace(/\s+/g, ' ').trim() }); cur = null; };
  if (!mapped) {
    // Text and word list disagree: fall back to the timed words alone.
    words.forEach((w, i) => {
      const gap = cur ? w.start_ms - words[i - 1].end_ms : 0;
      if (cur && (gap > 1200 || i - cur.first >= 28)) close();
      if (!cur) cur = { first: i, last: i, text: '' };
      cur.text += (cur.text ? ' ' : '') + w.text.trim();
      cur.last = i;
    });
    close();
    return out;
  }
  for (const span of spans) {
    if (span.wordIndex === null) {
      if (cur) {
        cur.text += span.text;
        if (/[.!?。！？…]/.test(span.text)) close();
      }
      continue;
    }
    const i = span.wordIndex;
    if (cur) {
      const open: Sentence = cur;
      const gap = words[i].start_ms - words[open.last].end_ms;
      if ((gap > 1500 && open.last - open.first >= 3) || open.last - open.first >= 30) close();
    }
    if (!cur) cur = { first: i, last: i, text: '' };
    cur.text += span.text;
    cur.last = i;
  }
  close();
  return out;
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Build the lines of the merged run from each attempt's transcript and the saved corrections. */
export function buildLines(run: Run | null, n: number, transcripts: ReadonlyMap<string, Transcript>,
  edits: Readonly<Record<string, LineEdit>>, vocab: Vocabulary): Line[] {
  if (!run) return [];
  const times = Array.from({ length: n }, (_, i) => partSeconds(run.parts[i]));
  const starts = runStarts(times);
  const cache = new Map<string, Sentence[]>();
  const lines: Line[] = [];
  for (let slide = 0; slide < n; slide++) {
    const part = run.parts[slide];
    if (!part) continue;
    const transcript = transcripts.get(part.attemptId);
    if (!transcript) continue;
    let list = cache.get(part.attemptId);
    if (!list) { list = sentences(transcript); cache.set(part.attemptId, list); }
    const words = transcript.words;
    let before = 0;
    for (const seg of part.segments) {
      list.forEach(s => {
        let first = s.first;
        while (first <= s.last && words[first].start_ms < seg.startMs) first++;
        if (first > s.last || words[first].start_ms >= seg.endMs) return;
        let last = first;
        while (last < s.last && words[last + 1].start_ms < seg.endMs) last++;
        const start = words[first].start_ms;
        const rel = (before + start - seg.startMs) / 1000;
        const endMs = Math.min(seg.endMs, words[last].end_ms);
        const key = part.attemptId + '#' + first;
        const edit = edits[key] || {};
        const clipped = first !== s.first || last !== s.last;
        // An older full-sentence edit cannot safely be mapped onto one side of
        // a slide boundary. Retain it in storage for review, but use timed words.
        const segmentText = clipped ? words.slice(first, last + 1).map(w => w.text.trim()).join(' ') : s.text;
        const text = !clipped && edit.text ? edit.text : capitalize(segmentText);
        const target = !clipped ? edit.slide ?? slide : slide;
        const moved = target !== slide;
        const dismissed = new Set(edit.dismissed || []);
        // A sentence that crosses the saved boundary between adjacent slides
        // carries a delivery finding. Compare word times within this attempt,
        // so separate takes and unrelated visits cannot create false spills.
        const nextPart = run.parts[slide + 1];
        const prevPart = run.parts[slide - 1];
        const intoNext = last < s.last && nextPart?.attemptId === part.attemptId &&
          nextPart.segments.some(next => next.startMs >= seg.endMs && next.startMs <= words[s.last].start_ms);
        const fromPrev = first > s.first && prevPart?.attemptId === part.attemptId &&
          prevPart.segments.some(prev => prev.endMs <= seg.startMs && prev.endMs > words[s.first].start_ms);
        lines.push({
          key, slide: Math.max(0, Math.min(n - 1, target)), t: starts[slide] + Math.min(rel, Math.max(0, times[slide] - 1)), rel, text,
          flags: misheard(text, vocab, slide).filter(f => !dismissed.has(f.w)),
          edge: intoNext ? 1 : fromPrev ? -1 : 0, moved, from: moved ? slide : null, fixed: !clipped && edit.text !== undefined,
          audio: { attemptId: part.attemptId, startMs: start, endMs: Math.max(endMs, start + 300) },
        });
      });
      before += seg.endMs - seg.startMs;
    }
  }
  return lines.sort((a, b) => a.slide - b.slide || a.t - b.t);
}

// ── Possibly misheard words ────────────────────────────────────────────────
export type Vocabulary = { joined: Map<string, string>; terms: string[]; perSlide: string[][] };

/** Distinctive slide terms: product names, acronyms and long words, from the slide text. */
export function buildVocabulary(slideTexts: readonly string[]): Vocabulary {
  const joined = new Map<string, string>();
  const terms = new Set<string>();
  const perSlide = slideTexts.map(t => {
    const own = new Set<string>();
    for (const raw of String(t || '').split(/[^\p{L}\p{N}'’-]+/u)) {
      const w = raw.replace(/^['’-]+|['’-]+$/g, '');
      if (w.length < 4) continue;
      const distinctive = /[a-z][A-Z]/.test(w) || /^[A-Z0-9]{2,}$/.test(w) || /\d/.test(w) || w.length >= 7;
      if (/[A-Za-z]/.test(w) && w.length >= 6) joined.set(w.toLowerCase().replace(/[-']/g, ''), w);
      if (distinctive && /[A-Za-z]/.test(w)) { terms.add(w); own.add(w); }
    }
    // Two-word phrases on the slide, for "manual levels" → "manual labels".
    const ws = String(t || '').split(/\s+/).map(x => x.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
    for (let i = 0; i + 1 < ws.length; i++) if (ws[i].length >= 4 && ws[i + 1].length >= 4) own.add(ws[i] + ' ' + ws[i + 1]);
    return [...own];
  });
  return { joined, terms: [...terms], perSlide };
}

export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Words in a sentence that look like a misheard slide term, with the slide's spelling as the fix. */
export function misheard(text: string, vocab: Vocabulary, slide: number): Flag[] {
  const out: Flag[] = [];
  const seen = new Set<string>();
  const tokens = [...String(text).matchAll(/[\p{L}\p{N}'’-]+/gu)].map(m => m[0]);
  const add = (w: string, alt: string) => {
    if (seen.has(w) || w === alt || out.length >= 2 || !text.includes(w)) return;
    seen.add(w); out.push({ w, alts: [alt] });
  };
  // Two spoken words that join into one slide word ("out loud" → "OutLoud").
  for (let i = 0; i + 1 < tokens.length; i++) {
    const pair = tokens[i] + ' ' + tokens[i + 1];
    const hit = vocab.joined.get((tokens[i] + tokens[i + 1]).toLowerCase());
    if (hit) add(pair, hit);
  }
  // A single word that differs only in letter case from a product-style name.
  for (const tok of tokens) {
    const term = vocab.terms.find(t => /[a-z][A-Z]/.test(t) && t.toLowerCase() === tok.toLowerCase());
    if (term && term !== tok) add(tok, term);
  }
  // A phrase one or two letters away from a phrase on this slide ("manual levels").
  for (const phrase of vocab.perSlide[slide] || []) {
    const [a, b] = phrase.split(' ');
    if (!b) continue;
    for (let i = 0; i + 1 < tokens.length; i++) {
      const x = tokens[i], y = tokens[i + 1];
      const exactA = x.toLowerCase() === a.toLowerCase(), exactB = y.toLowerCase() === b.toLowerCase();
      if (exactA === exactB) continue;
      const other = exactA ? [y, b] : [x, a];
      const d = editDistance(other[0].toLowerCase(), other[1].toLowerCase());
      if (d >= 1 && d <= 2 && other[1].length >= 5) add(x + ' ' + y, phrase);
    }
  }
  return out;
}

/** Split a sentence into plain and flagged pieces for display. */
export function splitFlags(text: string, flags: readonly Flag[]): { t: string; fi: number }[] {
  let segs = [{ t: text, fi: -1 }];
  flags.forEach((f, fi) => {
    const next: { t: string; fi: number }[] = [];
    for (const sg of segs) {
      const at = sg.fi < 0 ? sg.t.indexOf(f.w) : -1;
      if (at < 0) { next.push(sg); continue; }
      if (at > 0) next.push({ t: sg.t.slice(0, at), fi: -1 });
      next.push({ t: f.w, fi });
      if (at + f.w.length < sg.t.length) next.push({ t: sg.t.slice(at + f.w.length), fi: -1 });
    }
    segs = next;
  });
  return segs;
}

export function slideText(lines: readonly Line[], slide: number): string {
  return lines.filter(l => l.slide === slide).map(l => l.text).join(' ');
}
