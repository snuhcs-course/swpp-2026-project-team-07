import type { Transcript, TranscriptWord } from '../../contracts';
import { correctedRange, type LocalCorrections } from '../../domain/corrections';
import { type Line, type Vocabulary } from '../../domain/lines';
import { transcriptSpans } from '../transcription/playback';

export type STTSuggestion = { word_start: number; word_end: number; original: string; error_type: 'malformed_word' | 'technical_term' | 'proper_noun' | 'acronym' | 'mixed_language'; replacements: string[]; reason: string };
export function correctionLines(lines: Line[], transcripts: ReadonlyMap<string, Transcript>, _vocab: Vocabulary,
  stateFor: (id: string) => LocalCorrections | null,
  suggestionsFor: (id: string) => { revision: number; suggestions: STTSuggestion[] } | null,
  dismissed: Readonly<Record<string, { dismissed?: string[] }>> = {}) {
  return lines.map(line => {
    const id = line.audio.attemptId, state = stateFor(id), transcript = transcripts.get(id), source = line.source;
    if (!state || !transcript || !source || state.server.source_changed) return line;
    const text = correctedRange(transcript, state.edits, source.first, source.last, source.text) ?? (line.fixed ? source.text : null);
    let highlightWords: TranscriptWord[] | undefined;
    if (text !== null && state.edits.every(e => e.word_end < source.first || e.word_start > source.last ||
        (e.word_start >= source.first && e.word_end <= source.last))) {
      highlightWords = [];
      for (let i = source.first; i <= source.last;) {
        const edit = state.edits.find(e => e.word_start === i);
        highlightWords.push(edit ? { text: edit.text, start_ms: transcript.words[i].start_ms, end_ms: transcript.words[edit.word_end].end_ms } : { ...line.words[i - source.first] });
        i = edit ? edit.word_end + 1 : i + 1;
      }
    }
    let next = text === null ? line : { ...line, text, highlightWords, fixed: state.edits.some(e => e.word_start <= source.last && e.word_end >= source.first),
      flags: [] };
    const suggestions = suggestionsFor(id);
    if (state.pending || state.conflict || suggestions?.revision !== state.server.revision) return next;
    for (const s of suggestions.suggestions) {
      if (s.word_start < source.first || s.word_start > source.last || text !== null ||
          s.original !== transcript.words.slice(s.word_start, s.word_end + 1).map(w => w.text).join(' ')) continue;
      let at = 0, start = -1, end = -1;
      for (const span of transcriptSpans({ text: line.text, words: line.words })) {
        if (span.wordIndex !== null && source.first + span.wordIndex === s.word_start) start = at;
        if (span.wordIndex !== null && source.first + span.wordIndex === Math.min(s.word_end, source.last)) end = at + span.text.length;
        at += span.text.length;
      }
      if (start < 0 || end < start) continue;
      const w = next.text.slice(start, end);
      const dismissal = `${state.server.base_transcript_id}:${state.server.revision}:${s.word_start}:${s.word_end}`;
      if (dismissed[line.key]?.dismissed?.includes(dismissal)) continue;
      next = { ...next, flags: [{ w, at: start, alts: s.replacements, reason: s.reason,
        dismissal,
        range: { first: s.word_start, last: s.word_end, revision: state.server.revision, localVersion: state.localVersion } },
      ...next.flags.filter(f => f.range || f.w !== w)] };
    }
    return next;
  });
}
