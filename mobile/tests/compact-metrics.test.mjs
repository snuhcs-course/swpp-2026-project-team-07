// OpenAI Codex, 2026-11-03: issue #46 metric labels; synthetic data, no provider calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks(await import('./helpers/domain-loader.mjs'));
const { compactFeedbackRows } = await import('../src/features/feedback/compactFeedbackRows.ts');

const assessed = { slide: 0, status: 'reviewed', assessed: true, findings: [], label: 'No issues found' };
const rows = (durationSeconds, allocationSeconds, fillerCount = 3, item = assessed) =>
  compactFeedbackRows(0, item, { durationSeconds, allocationSeconds, fillerCount });

test('17 seconds against a 28-second allocation is under time, with an informational filler count', () => {
  const value = rows(17, 28);
  assert.deepEqual(value.map(row => row.text), ['Under time', '3 fillers', 'No issue flagged', 'No issue flagged']);
  assert.equal(value[1].status, 'muted');
});

test('per-slide timing includes both exact 15 percent boundaries, using millisecond precision', () => {
  for (const [duration, expected] of [[84.999, 'Under time'], [85, 'On time'], [100, 'On time'], [115, 'On time'], [115.001, 'Over time']]) {
    assert.equal(rows(duration, 100)[0].text, expected, String(duration));
  }
});

test('missing recording, allocation or transcript is not presented as a good result or zero fillers', () => {
  assert.equal(rows(0, 28, null)[0].text, 'Not recorded');
  assert.equal(rows(17, 0, null)[0].text, 'No allocation');
  assert.equal(rows(17, 28, null)[1].text, '—');
  assert.equal(rows(17, 28, 0)[1].text, '0 fillers');
  assert.equal(rows(17, 28, 1)[1].text, '1 filler');
  const pending = { ...assessed, status: 'pending', assessed: false, label: 'Analyzing' };
  assert.deepEqual(rows(17, 28, null, pending).slice(2).map(row => row.text), ['Analyzing', '—']);
});

test('metric labels retain every verified timing/filler finding for the existing details view', () => {
  const findings = [
    { category: 'timing', priority: 1, observation: 'Timing finding', suggestion: 'Redistribute time.' },
    { category: 'fillers', priority: 2, observation: 'Filler finding', suggestion: 'Pause instead.' },
  ];
  const value = rows(17, 28, 3, { ...assessed, findings });
  assert.deepEqual(value.slice(0, 2).map(row => row.text), ['Under time', '3 fillers']);
  assert.deepEqual(value.flatMap(row => row.findings), findings);
  assert.deepEqual(rows(17, 28, null, { ...assessed, status: 'outdated', assessed: false, findings, label: 'Feedback outdated' }).flatMap(row => row.findings), []);
});
