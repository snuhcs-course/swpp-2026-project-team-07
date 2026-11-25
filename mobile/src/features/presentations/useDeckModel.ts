// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
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
import { getSnapshot, getDeckState, useStore, type DeckState, type Presentation } from './store';
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

const vocabularies = new WeakMap<Presentation['slides'], Vocabulary>();

function vocabularyFor(slides: Presentation['slides']) {
  const cached = vocabularies.get(slides);
  if (cached) return cached;
  const vocabulary = buildVocabulary(slides.map(slide => slide.text));
  vocabularies.set(slides, vocabulary);
  return vocabulary;
}

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
  let lines: Line[] = [];
  if (transcripts.size) {
    const vocab = vocabularyFor(deck.slides);
    const correctionCache = new Map<string, ReturnType<typeof readCorrections>>();
    const suggestionCache = new Map<string, ReturnType<typeof readSTTSuggestions>>();
    lines = correctionLines(buildLines(run, n, transcripts, state.edits, vocab), transcripts, vocab,
      id => {
        if (!correctionCache.has(id)) {
          const saved = readCorrections(API_URL, id);
          const current = saved && saved.server.base_transcript_id === readReview(API_URL, id)?.transcript_id;
          correctionCache.set(id, current ? saved : null);
        }
        return correctionCache.get(id) ?? null;
      }, id => {
        if (!suggestionCache.has(id)) suggestionCache.set(id, readSTTSuggestions(API_URL, id));
        return suggestionCache.get(id) ?? null;
      }, state.edits);
  }
  const times = runTimes(run, n);
  const transcribed = ids.length > 0 && ids.every(id => transcripts.has(id) || stages.get(id) === 'no_speech');
  const points = deck.slides.map(s => s.points);
  return {
    deck: timed, targetSum: selectedRunTarget(run, timed.timing), state, n, times, total: times.reduce((a, b) => a + b, 0), lines,
    get vocab() { return vocabularyFor(deck.slides); },
    transcripts, stages, transcribed,
    pending: ids.some(id => !transcripts.has(id) && stages.get(id) !== 'no_speech'),
    stats: heroStats(run, n, lines, points, transcribed), points, ai: suggestionsFor(run),
  };
}

// The same presentation is mounted beneath review and appears in the Home carousel.
// Keep one derivation per recent deck and discard it when any source can change.
type ModelCache = Map<string, { requirementsVersion: number; model: DeckModel }>;
const modelsBySnapshot = new WeakMap<ReturnType<typeof getSnapshot>, ModelCache>();

export function useDeckModel(deckId: string | null): DeckModel | null {
  const snapshot = useStore(s => s);
  const requirementsVersion = useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  return useMemo(() => {
    if (!deckId) return null;
    let models = modelsBySnapshot.get(snapshot);
    if (!models) {
      models = new Map();
      modelsBySnapshot.set(snapshot, models);
    }
    const existing = models.get(deckId);
    if (existing?.requirementsVersion === requirementsVersion) return existing.model;
    const deck = snapshot.decks.find(item => item.id === deckId);
    if (!deck) return null;
    const model = deckModel(deck, getDeckState(deck.id));
    models.set(deckId, { requirementsVersion, model });
    if (models.size > 5) {
      const oldest = models.keys().next().value;
      if (oldest !== undefined) models.delete(oldest);
    }
    return model;
  }, [deckId, snapshot, requirementsVersion]);
}
