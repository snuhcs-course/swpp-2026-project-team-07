import type { Transcript } from '../contracts';

export type Correction = { word_start: number; word_end: number; text: string };
export type CorrectionSnapshot = { attempt_id: string; base_transcript_id: string; revision: number;
  edits: Correction[]; effective_text: string; source_changed: boolean };
export type LocalCorrections = { server: CorrectionSnapshot; edits: Correction[]; pending: boolean;
  localVersion: number; conflict: boolean; error: string };

export function correctedText(transcript: Transcript, edits: readonly Correction[]) {
  if (!edits.length) return transcript.text;
  const parts: string[] = [];
  let cursor = 0;
  const spans: { start: number; end: number }[] = [];
  for (const word of transcript.words) {
    const start = transcript.text.indexOf(word.text.trim(), cursor);
    if (start < 0) { spans.length = 0; break; }
    cursor = start + word.text.trim().length;
    spans.push({ start, end: cursor });
  }
  if (spans.length) {
    cursor = 0;
    for (const e of edits) {
      parts.push(transcript.text.slice(cursor, spans[e.word_start].start), e.text);
      cursor = spans[e.word_end].end;
      const ending = e.text.slice(-1);
      if (/[.!?。！？]/.test(ending) && transcript.text[cursor] === ending) cursor++;
    }
    parts.push(transcript.text.slice(cursor));
    return parts.join('');
  }
  cursor = 0;
  for (const e of edits) {
    parts.push(...transcript.words.slice(cursor, e.word_start).map(w => w.text), e.text);
    cursor = e.word_end + 1;
  }
  parts.push(...transcript.words.slice(cursor).map(w => w.text));
  return parts.join(' ');
}

export function replaceCorrection(edits: readonly Correction[], first: number, last: number, input: string, transcript: Transcript): Correction[] {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 0 || last < first ||
      last >= transcript.words.length || !text || text.length > 4000 || text.includes('\u0000')) throw new Error('Invalid correction.');
  if (edits.some(e => e.word_start <= last && e.word_end >= first && (e.word_start < first || e.word_end > last))) {
    throw new Error('This correction spans another sentence. Restore that correction first.');
  }
  const next = edits.filter(e => e.word_end < first || e.word_start > last);
  if (text !== transcript.words.slice(first, last + 1).map(w => w.text).join(' ')) next.push({ word_start: first, word_end: last, text });
  return next.sort((a, b) => a.word_start - b.word_start);
}

export function affectedSlides(edits: readonly Correction[], transcript: Transcript,
  visits: readonly { slide_index: number; start_ms: number; end_ms: number }[]) {
  const slides = new Set<number>();
  for (const e of edits) for (const word of transcript.words.slice(e.word_start, e.word_end + 1)) {
    for (const visit of visits) if (word.start_ms < visit.end_ms && word.end_ms >= visit.start_ms) slides.add(visit.slide_index);
  }
  return [...slides].sort((a, b) => a - b);
}

export const feedbackOutdated = (state: { revision: number; pending: boolean }, analyzedRevision: number) =>
  state.pending || state.revision !== analyzedRevision;

/** No guessed timing or textual substring matching: overlays refer to original indexes. */
export function correctedRange(transcript: Transcript, edits: readonly Correction[], first: number, last: number, sourceText?: string): string | null {
  const overlapping = edits.filter(e => e.word_start <= last && e.word_end >= first);
  if (!overlapping.length) return null;
  if (sourceText && overlapping.every(e => e.word_start >= first && e.word_end <= last)) {
    const words = transcript.words.slice(first, last + 1).map((w, i) => i === 0 ? { ...w, text: w.text.trim().charAt(0).toUpperCase() + w.text.trim().slice(1) } : w);
    return correctedText({ text: sourceText, words }, overlapping.map(e => ({ ...e, word_start: e.word_start - first, word_end: e.word_end - first })));
  }
  const parts: string[] = [];
  for (let i = first; i <= last;) {
    const edit = overlapping.find(e => e.word_start <= i && e.word_end >= i);
    if (edit) { if (edit.word_start >= first) parts.push(edit.text); i = edit.word_end + 1; }
    else parts.push(transcript.words[i++].text);
  }
  return parts.join(' ') || 'Included in the preceding correction';
}
