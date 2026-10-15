// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: everything a screen derives for one presentation.
import { useMemo, useSyncExternalStore } from 'react';
import type { Transcript } from '../../contracts';
import { heroStats, type HeroStats, type Suggestion } from '../../domain/analysis';
import { buildLines, buildVocabulary, type Line, type Vocabulary } from '../../domain/lines';
import { runAttemptIds, runTimes, type Run } from '../../domain/run';
import { stageOf, transcriptOf, type Stage } from '../rehearsal/analysis';
import { readFeedback } from '../feedback/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { API_URL } from '../../services/api';
import { deckById, getDeckState, useStore, type DeckState, type Presentation } from './store';
import { timedPresentation, selectedRunTarget } from './timing';
import { getRequirementsVersion, subscribeRequirements } from './requirementsStore';
import { readCorrections } from './correctionStore';
import { correctionLines } from './correctionLines';
import { readSTTSuggestions } from './transcriptSuggestions';
import { readReview } from '../transcription/reviewStorage';

export type DeckModel = {
  deck: ReturnType<typeof timedPresentation>; state: DeckState; n: number; times: number[]; total: number; lines: Line[]; vocab: Vocabulary;
  transcripts: Map<string, Transcript>; stages: Map<string, Stage>; transcribed: boolean; pending: boolean;
  stats: HeroStats | null; points: string[][]; ai: Suggestion[];
  targetSum: number;
};

export function transcriptsFor(ids: readonly string[]) {
  const transcripts = new Map<string, Transcript>();
  const stages = new Map<string, Stage>();
  for (const id of ids) {
    const t = transcriptOf(id);
    if (t) transcripts.set(id, t);
    stages.set(id, stageOf(id));
  }
  return { transcripts, stages };
}

/** Coaching suggestions already generated for takes in the run (read from the feedback cache, never requested here). */
export function suggestionsFor(run: Run | null): Suggestion[] {
  const out: Suggestion[] = [];
  if (!run) return out;
  const api = normalizeApi(API_URL);
  for (const id of runAttemptIds(run)) {
    try {
      const f = readFeedback(api, id);
      for (const s of f?.result && !f.result.stale ? f.result.suggestions : []) {
        // Only keep a suggestion when that take still supplies the slide.
        if (run.parts[s.slide_index]?.attemptId === id) out.push({ slide: s.slide_index, category: s.category, observation: s.observation, suggestion: s.suggestion });
      }
    } catch { /* cache unavailable */ }
  }
  return out;
}

export function deckModel(deck: Presentation, state: DeckState, run: Run | null = state.run): DeckModel {
  const timed = timedPresentation(deck, API_URL);
  const n = deck.pageCount;
  const ids = runAttemptIds(run);
  const { transcripts, stages } = transcriptsFor(ids);
  const vocab = buildVocabulary(deck.slides.map(s => s.text));
  const lines = correctionLines(buildLines(run, n, transcripts, state.edits, vocab), transcripts, vocab,
    id => {
      const saved = readCorrections(API_URL, id);
      return saved?.server.base_transcript_id === readReview(API_URL, id)?.transcript_id ? saved : null;
    }, id => readSTTSuggestions(API_URL, id), state.edits);
  const times = runTimes(run, n);
  const transcribed = ids.length > 0 && ids.every(id => transcripts.has(id) || stages.get(id) === 'no_speech');
  const points = deck.slides.map(s => s.points);
  return {
    deck: timed, targetSum: selectedRunTarget(run, timed.timing), state, n, times, total: times.reduce((a, b) => a + b, 0), lines, vocab, transcripts, stages, transcribed,
    pending: ids.some(id => !transcripts.has(id) && stages.get(id) !== 'no_speech'),
    stats: heroStats(run, n, lines, points, transcribed), points, ai: suggestionsFor(run),
  };
}

export function useDeckModel(deckId: string | null): DeckModel | null {
  const version = useStore(s => s.version);
  const requirementsVersion = useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  return useMemo(() => {
    const deck = deckById(deckId);
    if (!deck) return null;
    return deckModel(deck, getDeckState(deck.id));
    // version: re-derive whenever the store or an analysis result changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, version, requirementsVersion]);
}
