// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: a take joins the presentation's run; Compare keeps or restores it.
// Synthetic attempt ids and timings only; storage is the real SQLite key/value table (Node fixture).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve } from './helpers/pdf-native-loader.mjs';
registerHooks({ resolve });

const { commitTake, resolveCompare } = await import('../src/features/rehearsal/takes.ts');
const { getDeckState } = await import('../src/features/presentations/store.ts');
const { runTimes } = await import('../src/domain/run.ts');

const deck = { id: 'synthetic-deck', pageCount: 3, targets: [30, 30, 30], target: 90 };
const take = (attemptId, events, durationMs) => ({ attemptId, events, durationMs });

test('first take on every slide becomes the full run without a comparison', () => {
  const { run, compare } = commitTake(deck, take('take-1', [{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 31000 }, { slide_index: 2, at_ms: 60000 }], 92000),
    [true, true, true], false, null);
  assert.equal(compare, null);
  assert.equal(run.full, true);
  assert.deepEqual(runTimes(run, 3), [31, 29, 32]);
  const st = getDeckState(deck.id);
  assert.equal(st.takes, 1);
  assert.equal(st.lastFullTotal, 92);
  assert.equal(st.compare, null);
});

test('redoing one slide replaces only that slide, and keeping the old take restores the run exactly', () => {
  const before = getDeckState(deck.id);
  const { run, compare } = commitTake(deck, take('take-2', [{ slide_index: 1, at_ms: 0 }], 24000), [false, true, false], false, 50);
  assert.deepEqual(compare.slides, [1]);
  assert.deepEqual(runTimes(run, 3), [31, 24, 32]);
  assert.equal(run.parts[1].attemptId, 'take-2');
  assert.equal(run.parts[0].attemptId, 'take-1');
  assert.equal(getDeckState(deck.id).baselineCoverage, 50);

  const kept = resolveCompare(deck.id, 'old');
  assert.deepEqual(kept, before.run);
  const st = getDeckState(deck.id);
  assert.deepEqual(st.run, before.run);
  assert.equal(st.lastFullTotal, before.lastFullTotal);
  assert.equal(st.baselineCoverage, before.baselineCoverage);
  assert.equal(st.compare, null);
  assert.ok(st.discarded.includes('take-2'));
});

test('keeping the new take leaves the merged run and clears the comparison', () => {
  const { run } = commitTake(deck, take('take-3', [{ slide_index: 2, at_ms: 0 }], 27000), [false, false, true], false, null);
  assert.equal(resolveCompare(deck.id, 'new').id, run.id);
  const st = getDeckState(deck.id);
  assert.equal(st.compare, null);
  assert.equal(st.run.parts[2].attemptId, 'take-3');
  assert.equal(st.takes, 3);
});

test('a whole redo replaces every slide and compares all of them', () => {
  const { run, compare } = commitTake(deck, take('take-4', [{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 20000 }], 45000), [true, true, true], true, null);
  assert.deepEqual(compare.slides, [0, 1, 2]);
  assert.equal(run.parts[2], null);
  assert.ok(run.parts.slice(0, 2).every(p => p.attemptId === 'take-4'));
  assert.equal(resolveCompare(deck.id, 'old').parts[2].attemptId, 'take-3');
});
