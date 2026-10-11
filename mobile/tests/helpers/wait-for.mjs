// AI-assisted with OpenAI Codex; see collaboration log A7 (October 11, 2026).
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { act } from 'react-test-renderer';

// act flushes React updates, but one tick does not finish filesystem/stream I/O.
// Wait for an observable precondition without replaying the user action.
export async function waitFor(predicate, message, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  let value;
  do {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1)); });
    value = predicate();
    if (value) return value;
  } while (performance.now() < deadline);
  assert.ok(value, `Timed out waiting for ${message}`);
}
