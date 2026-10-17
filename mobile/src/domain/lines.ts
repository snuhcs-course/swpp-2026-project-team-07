// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex slide-spill detection: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// OutLoud redesign: transcript sentences for the merged run (SPEC §5.4, §6).
// Sentences come from hosted Scribe v2. Slide-change events split a sentence at
// the first word whose timestamp belongs to the next slide.
import type { Transcript, TranscriptWord } from '../contracts';
import { activeWordIndex, transcriptSpans } from '../features/transcription/playback';
import { partSeconds, runStarts, type Run } from './run';
import { fmt } from './format';

export type Flag = { w: string; alts: string[]; at?: number; reason?: string; dismissal?: string;
  range?: { first: number; last: number; revision: number; localVersion: number } };
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
  /** Only complete source sentences support saved slide-placement edits. */
  canMove: boolean;
  moved: boolean;
  from: number | null;
  fixed: boolean;
  /** Original positive-duration visit within this slide's selected source take. */
  visit: { slide: number; index: number; startMs: number };
  words: TranscriptWord[];
  /** Display-only replacement spans reuse original range timing; source words stay immutable. */
  highlightWords?: TranscriptWord[];
  source?: { first: number; last: number; text: string };
  audio: { attemptId: string; startMs: number; endMs: number };
};
export type LineEdit = { text?: string; slide?: number; dismissed?: string[] };
export type Sentence = { first: number; last: number; text: string };

/** Split a transcript into sentences, keeping the provider's punctuation; long or paused stretches are split too. */
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
  edits: Readonly<Record<string, LineEdit>>, _vocab: Vocabulary): Line[] {
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
    for (const [visitIndex, seg] of part.segments.entries()) {
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
        const text = capitalize(segmentText); // Legacy arbitrary edits stay archived, never applied.
        const target = !clipped ? edit.slide ?? slide : slide;
        const moved = target !== slide;
        // Only a direct saved boundary between adjacent slides in this source
        // take marks a spill. Separate takes and intervening visits do not.
        const nextPart = run.parts[slide + 1];
        const prevPart = run.parts[slide - 1];
        const intoNext = last < s.last && nextPart?.attemptId === part.attemptId &&
          nextPart.segments.some(next => next.startMs === seg.endMs && next.startMs <= words[s.last].start_ms);
        const fromPrev = first > s.first && prevPart?.attemptId === part.attemptId &&
          prevPart.segments.some(prev => prev.endMs === seg.startMs && prev.endMs > words[s.first].start_ms);
        lines.push({
          key, slide: Math.max(0, Math.min(n - 1, target)), t: starts[slide] + Math.min(rel, Math.max(0, times[slide] - 1)), rel, text,
          flags: [],
          edge: intoNext ? 1 : fromPrev ? -1 : 0, canMove: !clipped, moved, from: moved ? slide : null, fixed: false,
          visit: { slide, index: visitIndex, startMs: seg.startMs },
          words: words.slice(first, last + 1).map((w, i) => i === 0 ? { ...w, text: capitalize(w.text.trim()) } : w),
          source: { first, last, text: capitalize(segmentText) },
          audio: { attemptId: part.attemptId, startMs: start, endMs: Math.max(endMs, start + 300) },
        });
      });
      before += seg.endMs - seg.startMs;
    }
  }
  return lines.sort((a, b) => a.slide - b.slide || a.t - b.t);
}

/** A divider for each source visit; corrections keep their original provenance. */
export function visitHeading(line: Line, previous?: Line): string | null {
  const v = line.visit;
  if (previous && previous.audio.attemptId === line.audio.attemptId && previous.visit.slide === v.slide && previous.visit.index === v.index) return null;
  const label = v.index === 0 ? 'First visit' : 'Return visit ' + v.index;
  return label + (v.slide !== line.slide ? ' · from slide ' + (v.slide + 1) : '') + ' · ' + fmt(v.startMs / 1000) + ' in recording';
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

/** Split a sentence into plain and flagged pieces for display. */
export function splitFlags(text: string, flags: readonly Flag[]): { t: string; fi: number }[] {
  const ranges = flags.map((f, fi) => ({ at: f.at ?? text.indexOf(f.w), end: (f.at ?? text.indexOf(f.w)) + f.w.length, fi }))
    .filter(r => r.at >= 0 && text.slice(r.at, r.end) === flags[r.fi].w).sort((a, b) => a.at - b.at);
  const parts: { t: string; fi: number }[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.at < cursor) continue;
    if (r.at > cursor) parts.push({ t: text.slice(cursor, r.at), fi: -1 });
    parts.push({ t: text.slice(r.at, r.end), fi: r.fi }); cursor = r.end;
  }
  if (cursor < text.length) parts.push({ t: text.slice(cursor), fi: -1 });
  return parts;
}

/** Layer native-position word highlighting over the existing correction ranges. */
export function playbackPieces(line: Pick<Line, 'text' | 'words' | 'flags' | 'highlightWords'>, positionMs: number | null): { t: string; fi: number; active: boolean }[] {
  const words = line.highlightWords ?? line.words;
  const active = positionMs === null ? -1 : activeWordIndex(words, positionMs);
  let offset = 0, start = -1, end = -1;
  for (const span of transcriptSpans({ text: line.text, words })) {
    if (span.wordIndex === active && active >= 0) { start = offset; end = offset + span.text.length; }
    offset += span.text.length;
  }
  offset = 0;
  return splitFlags(line.text, line.flags).flatMap(piece => {
    const at = offset;
    offset += piece.t.length;
    const cuts = [...new Set([at, offset, ...[start, end].filter(p => p > at && p < offset)])].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((p, i) => ({ t: line.text.slice(p, cuts[i + 1]), fi: piece.fi, active: p >= start && cuts[i + 1] <= end && start >= 0 }));
  });
}

export function slideText(lines: readonly Line[], slide: number): string {
  return lines.filter(l => l.slide === slide).map(l => l.text).join(' ');
}
