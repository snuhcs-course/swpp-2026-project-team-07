// OpenAI Codex, 2026-11-23: read and refresh the overall assessment for the selected takes.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { runAttemptIds } from '../../domain/run';
import { budgetStatus } from '../../services/storeBudget';
import { readCorrections } from '../presentations/correctionStore';
import { defaultRequirementsPending } from '../presentations/defaultRequirements';
import { requirementsDirty } from '../presentations/requirementsDraft';
import { readRequirements } from '../presentations/requirementsStore';
import type { DeckModel } from '../presentations/useDeckModel';
import { qaAnchor, qaScope } from '../qa/state';
import { readCapture } from '../recording/incrementalState';
import { readReview } from '../transcription/reviewStorage';
import { feedbackRunActive, selectedRunBudgetStatus } from './feedbackRun';
import { checkSelectedFeedback, readSelectedFeedback, type SelectedFeedback, type SelectedFeedbackCheck } from './feedbackRunClient';

function selectedInputs(model: DeckModel | null, api: string): { selection: SelectedFeedback | null; status: string } | null {
  const run = model?.state.run;
  if (!model || !run) return null;
  const ids = runAttemptIds(run).sort();
  if (ids.length < 2) return null;
  const waiting = { selection: null, status: 'Transcript pending' };
  const blocked = { selection: null, status: 'Settings sync pending' };
  try {
    const requirements = readRequirements(model.deck.id, api);
    if (requirementsDirty(model.deck.id, api) || defaultRequirementsPending(model.deck.id, api)) return blocked;
    const revisions = [];
    let deckId = requirements.deckId;
    for (const id of ids) {
      const capture = readCapture(id), review = readReview(api, id);
      if (capture?.api === api && !capture.remote?.finalized) return waiting;
      if (!review?.transcript_id || !review.transcript) {
        const stage = model.stages.get(id);
        if (stage === 'no_speech') return { selection: null, status: 'No speech detected' };
        if (stage === 'done') return { selection: null, status: 'No usable word timing' };
        return waiting;
      }
      deckId ??= review.deck_id;
      if (review.deck_id !== deckId) return { selection: null, status: 'Overall score unavailable' };
      const correction = readCorrections(api, id);
      if (correction?.pending || correction?.conflict || correction?.server.source_changed) {
        return { selection: null, status: 'Transcript changes pending' };
      }
      revisions.push([id, review.transcript_id, correction?.server.revision ?? 0]);
    }
    const scope = qaScope(run, requirements.contextId);
    const anchor = qaAnchor(scope);
    return anchor ? { selection: { anchor, scope, revision: JSON.stringify([requirements.revision, revisions]) },
      status: 'Scoring selected takes…' } : waiting;
  } catch {
    return blocked;
  }
}

export function useSelectedFeedback(model: DeckModel | null, api: string, visible: boolean, supported: boolean, online: boolean) {
  const input = selectedInputs(model, api);
  const selection = input?.selection ?? null;
  const identity = selection ? JSON.stringify(selection) : '';
  const maySync = visible && supported && online && !!selection && !model?.state.compare;
  const live = useRef({ selection, identity, maySync });
  useLayoutEffect(() => { live.current = { selection, identity, maySync }; });
  const [response, setResponse] = useState<{ identity: string; status: SelectedFeedbackCheck } | null>(null);
  const check = useCallback(async (action: 'check' | 'update' | 'retry' = 'check') => {
    const current = live.current;
    if (!current.maySync || !current.selection) return;
    const status = await checkSelectedFeedback(api, current.selection, action);
    if (live.current.identity === current.identity) {
      setResponse(old => old?.identity === current.identity && old.status === status ? old : { identity: current.identity, status });
    }
  }, [api]);

  const responseStatus = response?.identity === identity ? response.status : null;
  const liveBudget = budgetStatus(responseStatus);
  const saved = selection && responseStatus !== 'waiting' && responseStatus !== 'unavailable'
    ? readSelectedFeedback(api, selection) : null;
  const run = liveBudget && (saved?.status !== 'completed' || saved.outdated) ? null : saved;
  const budget = liveBudget ?? selectedRunBudgetStatus(run);
  const retryBudget = budget === budgetStatus('public_budget_unavailable');
  const poll = !budget && (feedbackRunActive(run) || responseStatus === 'offline' || responseStatus === 'waiting');
  useEffect(() => {
    if (maySync) void check();
  }, [check, identity, maySync]);
  useEffect(() => {
    if (!maySync || !poll) return;
    const timer = setInterval(() => void check(), responseStatus === 'offline' ? 5000 : 2500);
    return () => clearInterval(timer);
  }, [check, identity, maySync, poll, responseStatus]);

  if (!input) return null;
  const status = budget ?? (!online ? 'Online feedback unavailable'
    : !supported || responseStatus === 'unavailable' ? 'Overall score unavailable'
    : responseStatus === 'offline' ? 'Overall score sync pending'
    : responseStatus === 'waiting' ? 'Transcript pending' : input.status);
  return { run, status, check, budget, retryBudget };
}
