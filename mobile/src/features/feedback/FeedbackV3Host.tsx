import { isIncrementalAttempt } from '../recording/incrementalState';
// Starts feedback v3 for each new recording as soon as its transcription completes, on any screen.
// AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
// Screens only display results. The server deduplicates by input fingerprint and reuses unchanged
// parts, so this host and the server's optional auto-start never repeat model calls.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { API_URL } from '../../services/api';
import { runAttemptIds } from '../../domain/run';
import { getDeckState, useStore, visibleDecks } from '../presentations/store';
import { getRequirementsVersion, readRequirements, subscribeRequirements } from '../presentations/requirementsStore';
import { requirementsPending } from '../presentations/requirementsDraft';
import { defaultRequirementsPending } from '../presentations/defaultRequirements';
import { readReview } from '../transcription/reviewStorage';
import { normalizeApi } from '../transcription/analysisStorage';
import { automaticFeedbackV3Enabled } from './automaticFeedback';
import { feedbackRunNeedsStart, START_RETRY_MS, startsDue, type StartCandidate } from './feedbackRun';
import { feedbackV3Capability, feedbackV3CapabilityChecked, fetchFeedbackRun, readStartState, startFeedbackRun, writeStartState } from './feedbackRunClient';

const inProgress = new Set<string>();

function candidates(api: string): StartCandidate[] {
  const found: StartCandidate[] = [];
  for (const deck of visibleDecks()) {
    const saved = getDeckState(deck.id);
    try {
      const r = readRequirements(deck.id, api);
      const pending = defaultRequirementsPending(deck.id, api) || requirementsPending(deck.id, api);
      // A take waiting on Keep/Overwrite starts too: its per-slide feedback is ready when the choice is made.
      const ids = [...new Set([...runAttemptIds(saved.run), ...(saved.compare ? [saved.compare.attemptId] : [])])];
      for (const id of ids) {
        if (isIncrementalAttempt(api, id)) continue;
        const review = readReview(api, id);
        if (!review?.transcript_id || !review.transcript?.words.length) continue;
        const contextId = r.deckId === review.deck_id ? r.contextId ?? null : null;
        found.push({ id, contextId, eligible: !pending && automaticFeedbackV3Enabled(api, id), start: readStartState(api, id) });
      }
    } catch { /* Unreadable local settings or review: nothing is started for this deck. */ }
  }
  return found;
}

async function startOne(api: string, c: StartCandidate) {
  const key = JSON.stringify([api, c.id, c.contextId]);
  if (inProgress.has(key)) return;
  inProgress.add(key);
  try {
    const run = await fetchFeedbackRun(api, c.id, c.contextId);
    if (run && !run.enabled) return;  // v3 switched off: nothing is recorded, so it starts once it is back.
    // A saved assessment may predate this phone's start marker. Refreshing it is a user action.
    if (run?.runId && (run.outdated || !feedbackRunNeedsStart(run))) {
      writeStartState(api, c.id, 'started');
      return;
    }
    const started = await startFeedbackRun(api, c.id, c.contextId);
    writeStartState(api, c.id, started?.runId ? 'started' : 'failed');
  } catch {
    writeStartState(api, c.id, 'failed');
  } finally { inProgress.delete(key); }
}

export function FeedbackV3Host() {
  useStore(s => s.version);
  useSyncExternalStore(subscribeRequirements, getRequirementsVersion);
  const api = normalizeApi(API_URL);
  const [tick, setTick] = useState(0);
  const list = candidates(api), capability = feedbackV3Capability(api);
  // Learn once per session whether the server offers v3, before any automatic v2 work starts.
  const probes = !feedbackV3CapabilityChecked(api) ? list.slice(0, 5) : [];
  const retrying = probes.length > 0 || list.some(c => c.eligible && c.start?.state === 'failed');
  const identity = JSON.stringify({ api, capability, probes, list, tick });
  useEffect(() => {
    if (!retrying) return;
    const timer = setInterval(() => setTick(value => value + 1), START_RETRY_MS);
    return () => clearInterval(timer);
  }, [retrying]);
  useEffect(() => {
    const work = JSON.parse(identity) as { api: string; capability: boolean | null; probes: StartCandidate[]; list: StartCandidate[] };
    void (async () => {
      // Try recordings in turn: one missing on the server (not_found) leaves the answer unknown.
      for (const probe of work.probes) {
        try { await fetchFeedbackRun(work.api, probe.id, probe.contextId); } catch { /* Try the next one. */ }
        if (feedbackV3CapabilityChecked(work.api)) break;
      }
      if (!feedbackV3CapabilityChecked(work.api) || feedbackV3Capability(work.api) !== true) return;
      for (const c of startsDue(work.list, Date.now())) await startOne(work.api, c);
    })();
  }, [identity]);
  return null;
}
