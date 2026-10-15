import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/domain-loader.mjs';
registerHooks({ resolve, load });
const { buildLines, buildVocabulary, visitHeading } = await import('../src/domain/lines.ts');
const { mergeTake, takeVisits } = await import('../src/domain/run.ts');

const ctx = { n: 2, targets: [10, 10], deckTarget: 20, lastFullTotal: null, takeNo: 1, id: 'run' };
const makeRun = (id, events, duration, prev = null) => mergeTake(prev, {
  attemptId: id, visits: takeVisits(events, duration), spoken: [true, true], whole: false, createdAt: '2026-10-15T00:00:00Z',
}, ctx).run;
const events = [0, 1, 0, 1, 0].map((slide_index, i) => ({ slide_index, at_ms: i * 2000 }));
const run = makeRun('original', events, 10000);
const transcript = { text: 'First. More. Other. Back. Again. Last.', words: [
  ['First', 0], ['More', 1000], ['Other', 2000], ['Back', 4000], ['Again', 6000], ['Last', 8000],
].map(([text, start_ms]) => ({ text, start_ms, end_ms: start_ms + 500 })) };
const vocab = buildVocabulary(['', '']);

test('sentences retain their first or return visit and exact-boundary source playback', () => {
  const snapshot = JSON.stringify(run);
  const lines = buildLines(run, 2, new Map([['original', transcript]]), {}, vocab);
  assert.deepEqual(lines.filter(l => l.slide === 0).map(l => l.visit), [
    { slide: 0, index: 0, startMs: 0 }, { slide: 0, index: 0, startMs: 0 },
    { slide: 0, index: 1, startMs: 4000 }, { slide: 0, index: 2, startMs: 8000 },
  ]);
  assert.deepEqual(lines.filter(l => l.slide === 1).map(l => l.visit.index), [0, 1]);
  assert.equal(lines.find(l => l.key === 'original#3').audio.startMs, 4000);
  assert.equal(JSON.stringify(run), snapshot);
  const slide = lines.filter(l => l.slide === 0);
  assert.deepEqual(slide.map((l, i) => visitHeading(l, slide[i - 1])), [
    'First visit · 0:00 in recording', null, 'Return visit 1 · 0:04 in recording', 'Return visit 2 · 0:08 in recording',
  ]);
});

test('silent first visits still count; moving a sentence preserves provenance and ignores archived text rewrites', () => {
  const silent = { ...transcript, words: transcript.words.slice(2), text: 'Other. Back. Again. Last.' };
  const lines = buildLines(run, 2, new Map([['original', silent]]), { 'original#1': { slide: 1, text: 'Corrected.' } }, vocab);
  const moved = lines.find(l => l.key === 'original#1');
  assert.equal(moved.slide, 1);
  assert.equal(moved.text, 'Back.');
  assert.deepEqual(moved.visit, { slide: 0, index: 1, startMs: 4000 });
  assert.equal(visitHeading(moved), 'Return visit 1 · from slide 1 · 0:04 in recording');
});

test('a separate selected retake starts at first visit and leaves old slide visits intact', () => {
  const redo = mergeTake(run, { attemptId: 'redo', visits: [{ slide: 0, startMs: 0, endMs: 2000 }],
    spoken: [true, false], whole: false, createdAt: '2026-10-15T01:00:00Z' }, ctx).run;
  const lines = buildLines(redo, 2, new Map([['original', transcript], ['redo', { text: 'Redo.', words: [{ text: 'Redo', start_ms: 0, end_ms: 500 }] }]]), {}, vocab);
  assert.deepEqual(lines.filter(l => l.slide === 0).map(l => [l.audio.attemptId, l.visit.index]), [['redo', 0]]);
  assert.deepEqual(lines.filter(l => l.slide === 1).map(l => [l.audio.attemptId, l.visit.index]), [['original', 0], ['original', 1]]);
  assert.equal(visitHeading(lines[0]), 'First visit · 0:00 in recording');
  // A moved sentence from another take must not lose its source divider.
  const otherTake = { ...lines[0], audio: { ...lines[0].audio, attemptId: 'another' } };
  assert.equal(visitHeading(otherTake, lines[0]), 'First visit · 0:00 in recording');
});
