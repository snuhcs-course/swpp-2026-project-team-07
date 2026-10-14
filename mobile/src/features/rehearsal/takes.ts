// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OutLoud redesign: commit a finished recording into the presentation's run,
// then keep the current version or overwrite it. Each slide points to only one
// selected recording; other audio remains stored when needed by other slides.
import { randomUUID } from 'expo-crypto';
import { mergeTake, runAttemptIds, runTotal, takeVisits, type Run } from '../../domain/run';
import { getDeckState, saveDeckState, type Presentation } from '../presentations/store';
import type { FinishedTake } from './CaptureEngine';

/** `coverage` is the current run's key-point coverage (null when unknown); it becomes the baseline Compare and Review measure against. */
export function commitTake(deck: Presentation, take: FinishedTake, spoken: boolean[], whole: boolean, coverage: number | null) {
  const st = getDeckState(deck.id);
  const n = deck.pageCount;
  const before = st.run ? coverage ?? st.baselineCoverage : null;
  const { run, compare } = mergeTake(st.run, {
    attemptId: take.attemptId, visits: takeVisits(take.events, take.durationMs), spoken, whole, createdAt: new Date().toISOString(),
  }, { n, targets: deck.targets, deckTarget: deck.target, lastFullTotal: st.lastFullTotal, takeNo: st.takes + 1, id: randomUUID() });
  const restore = { lastFullTotal: st.lastFullTotal, baselineCoverage: st.baselineCoverage };
  saveDeckState(deck.id, {
    ...st, run: compare ? st.run : run, takes: st.takes + 1,
    lastFullTotal: compare ? st.lastFullTotal : run.full ? runTotal(run, n) : st.lastFullTotal,
    baselineCoverage: compare ? st.baselineCoverage : before ?? st.baselineCoverage,
    compare: compare ? { ...compare, restore, nextBaselineCoverage: before ?? st.baselineCoverage } : null,
  });
  return { run, compare };
}

/** Keep the current recording or overwrite it. The active run keeps one source per slide. */
export function resolveCompare(deckId: string, keep: 'old' | 'new'): Run | null {
  const st = getDeckState(deckId);
  const c = st.compare;
  if (!c) return st.run;
  if (keep === 'new') {
    const replaced = runAttemptIds(c.prev).filter(id => !runAttemptIds(c.next).includes(id));
    saveDeckState(deckId, { ...st, run: c.next, compare: null,
      lastFullTotal: c.next.full ? runTotal(c.next, c.next.parts.length) : c.restore.lastFullTotal,
      baselineCoverage: c.nextBaselineCoverage ?? st.baselineCoverage,
      discarded: [...new Set([...st.discarded, ...replaced])] });
    return c.next;
  }
  saveDeckState(deckId, { ...st, run: c.prev, lastFullTotal: c.restore.lastFullTotal, baselineCoverage: c.restore.baselineCoverage, compare: null,
    discarded: [...new Set([...st.discarded, c.attemptId])] });
  return c.prev;
}
