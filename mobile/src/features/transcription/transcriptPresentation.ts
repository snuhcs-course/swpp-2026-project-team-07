import type { Transcript } from '../../contracts';
import { activeWordIndex, seekableWord, transcriptSpans } from './playback';
export function transcriptPresentation(transcript: Transcript | null | undefined, position: number, duration: number, ready: boolean, seek: (ms: number) => void) {
  if (!transcript) return [];
  const active = ready ? activeWordIndex(transcript.words, position, duration) : -1;
  return transcriptSpans(transcript).map(span => {
    const word = span.wordIndex === null ? null : transcript.words[span.wordIndex];
    const allowed = !!word && ready && seekableWord(word, duration);
    return { text: span.text, selected: span.wordIndex !== null && span.wordIndex === active, onSeek: allowed ? () => seek(word!.start_ms) : undefined };
  });
}
