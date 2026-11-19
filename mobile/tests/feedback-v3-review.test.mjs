import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/ai-overview-screen-loader.mjs';
registerHooks({ resolve, load });
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { runtime } = await import('./helpers/ai-overview-screen-native.mjs');
const { ReviewScreen } = await import('../src/screens/ReviewScreen.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test('Review distinguishes unfinished segment transcripts from explicit insufficient speech', async () => {
  runtime.nav = { deckId: 'deck', sel: 0, slide: 0, from: null, nav: null };
  runtime.model = { deck: { id: 'deck', title: 'Synthetic', hue: 'blue', pages: [], slides: [{ title: 'One', points: [] }], targets: [60], text: 'ready', timing: {} },
    n: 1, state: { run: { id: 'run', parts: [{ attemptId: 'a', segments: [{ startMs: 0, endMs: 5000 }] }], sel: 0 }, fixes: 0 },
    times: [5], lines: [], points: [[]], ai: [], transcripts: new Map(), stages: new Map([['a', 'processing']]) };
  runtime.feedback = { items: [{ status: 'pending', findingCount: 0 }], aggregate: {}, refresh() {} };
  const slide = { slide_index: 0, status: 'pending', reason: 'awaiting_segments', score: null, criteria: [], improvements: [], must_cover: [], strength: null, measurements: null };
  const item = { slide: 0, score: null, level: null, status: 'Scoring…', settled: false, v3: slide, attemptId: 'a' };
  runtime.v3 = { items: [item], overall: { score: null, status: 'Scoring…' }, notice: '', retry() {}, update() {}, busy: false };
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(ReviewScreen)); });
    assert.match(JSON.stringify(renderer.toJSON()), /Feedback in progress/);
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Too little speech to review|Record slide 1 again/);
    slide.status = 'insufficient_speech'; item.settled = true; item.status = 'Too little speech';
    await act(async () => renderer.update(React.createElement(ReviewScreen)));
    assert.match(JSON.stringify(renderer.toJSON()), /Too little speech to review/);
  } finally { if (renderer) await act(async () => renderer.unmount()); }
});
