import type { Transcript, TranscriptWord } from "../../contracts";

/** A late seek must not undo a newer pause, source change, or navigation. */
export async function resumeAfterSeek(
  seek: () => Promise<void>, isCurrent: () => boolean, play: () => void,
): Promise<void> {
  await seek();
  if (isCurrent()) play();
}

/** Use actual player time, half-open intervals; silence/zero-length words have no highlight. */
export function activeWordIndex(words: TranscriptWord[], positionMs: number): number {
  if (!Number.isFinite(positionMs) || positionMs < 0) return -1;
  for (let index = words.length - 1; index >= 0; index--) {
    if (words[index].start_ms <= positionMs && positionMs < words[index].end_ms) return index;
  }
  return -1;
}

/** Preserve original punctuation and whitespace while assigning spans to timestamped words. */
export function transcriptSpans(transcript: Transcript): { text: string; wordIndex: number | null }[] {
  const spans: { text: string; wordIndex: number | null }[] = [];
  let cursor = 0;
  for (let index = 0; index < transcript.words.length; index++) {
    const token = transcript.words[index].text;
    const start = token ? transcript.text.indexOf(token, cursor) : -1;
    if (start < 0) return [{ text: transcript.text, wordIndex: null }];
    if (start > cursor) spans.push({ text: transcript.text.slice(cursor, start), wordIndex: null });
    spans.push({ text: token, wordIndex: index });
    cursor = start + token.length;
  }
  if (cursor < transcript.text.length) spans.push({ text: transcript.text.slice(cursor), wordIndex: null });
  return spans;
}
