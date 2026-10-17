import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/domain-loader.mjs';
registerHooks({ resolve, load });
const corrections = await import('../src/domain/corrections.ts');
const transcript = { text: 'ChatGPTN works. Again.', words: [
  { text: 'ChatGPTN', start_ms: 0, end_ms: 500 },
  { text: 'works', start_ms: 500, end_ms: 1200 },
  { text: 'Again', start_ms: 1200, end_ms: 1600 },
] };

test('confirmed edits replace exact indexed occurrence, preserve source, and recognize no-op saves', () => {
  const source = JSON.stringify(transcript);
  const first = corrections.replaceCorrection([], 0, 0, 'ChatGPT', transcript);
  assert.equal(corrections.correctedText(transcript, first), 'ChatGPT works. Again.');
  assert.deepEqual(corrections.replaceCorrection(first, 0, 0, 'ChatGPT', transcript), first);
  assert.deepEqual(corrections.replaceCorrection(first, 0, 0, 'ChatGPTN', transcript), []);
  const second = corrections.replaceCorrection(first, 2, 2, '다시', transcript);
  assert.equal(corrections.correctedText(transcript, second), 'ChatGPT works. 다시.');
  assert.equal(JSON.stringify(transcript), source);
});

test('boundary correction invalidates all overlapping visits and keeps unrelated slides', () => {
  const visits = [{ slide_index: 0, start_ms: 0, end_ms: 1000 },
    { slide_index: 1, start_ms: 1000, end_ms: 1400 }, { slide_index: 0, start_ms: 1400, end_ms: 2000 }];
  assert.deepEqual(corrections.affectedSlides([{ word_start: 1, word_end: 2, text: 'works again' }], transcript, visits), [0, 1]);
});

test('pending edits and older analyzed revisions remain outdated; suggestion dismissal is not a text edit', () => {
  assert.equal(corrections.feedbackOutdated({ revision: 2, pending: true }, 2), true);
  assert.equal(corrections.feedbackOutdated({ revision: 2, pending: false }, 1), true);
  assert.equal(corrections.feedbackOutdated({ revision: 2, pending: false }, 2), false);
});
