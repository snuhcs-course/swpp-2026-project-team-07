import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/ai-overview-screen-loader.mjs';
registerHooks({ resolve, load });
const { listenTimeline, listenEntryAt } = await import('../src/domain/listenTimeline.ts');
const { ListenBackKaraokeScreen } = await import('../src/screens/ListenBackKaraokeScreen.tsx');
const { runtime } = await import('./helpers/ai-overview-screen-native.mjs');
const { DARK_PALETTE, LIGHT_PALETTE } = await import('../src/design/tokens.ts');
runtime.palettes = { dark: DARK_PALETTE, light: LIGHT_PALETTE };
const React = await import('react');
const { act, create } = await import('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const part = (attemptId, ...ranges) => ({ attemptId, segments: ranges.map(([startMs, endMs]) => ({ startMs, endMs })) });
const line = (slide, at, t, text, attemptId = 'a') => ({ key: text, slide, t, rel: 0, text, flags: [],
  words: [{ text, start_ms: at, end_ms: at + 1000 }], audio: { attemptId, startMs: at, endMs: at + 1000 } });
function fixture() {
  const run = { id: 'run', parts: [part('a', [10000, 13000], [20000, 23000]), part('a', [13000, 17000], [23000, 27000])] };
  const lines = [line(0, 10500, 0.5, 'First A'), line(0, 20500, 3.5, 'Return A'), line(1, 13500, 6.5, 'First B'), line(1, 23500, 10.5, 'Return B')];
  return { run, lines, times: [6, 8] };
}

test('one source orders repeated visits by its original clock and excludes unselected gaps', () => {
  const { run, lines, times } = fixture();
  const value = listenTimeline(run, times, lines);
  assert.equal(value.chronological, true); assert.equal(value.total, 14);
  assert.deepEqual(value.visits.map(v => [v.slide, v.startMs, v.endMs, v.runStart]), [
    [0, 10000, 13000, 0], [1, 13000, 17000, 3], [0, 20000, 23000, 7], [1, 23000, 27000, 10],
  ]);
  assert.deepEqual(value.lines.map(l => [l.text, l.t]), [['First A', 0.5], ['First B', 3.5], ['Return A', 7.5], ['Return B', 10.5]]);
  assert.equal(listenEntryAt(7, value.chapters).slide, 0);
  assert.equal(listenEntryAt(14, value.chapters).slide, 1);
  assert.deepEqual(lines.map(l => l.t), [0.5, 3.5, 6.5, 10.5], 'shared Review lines remain unchanged');
});

test('a single selected source can start on a later slide; composed sources retain slide order and transcript', () => {
  const backwards = { parts: [part('a', [4000, 6000]), null, part('a', [1000, 4000])] };
  const value = listenTimeline(backwards, [2, 0, 3], []);
  assert.deepEqual(value.chapters.map(v => v.slide), [2, 0]);
  assert.deepEqual(value.visits.map(v => v.startMs), [1000, 4000]);
  const { run, lines } = fixture();
  run.parts[1] = part('b', [1000, 3000]);
  const composed = listenTimeline(run, [6, 2], lines);
  assert.equal(composed.chronological, false);
  assert.deepEqual(composed.visits.map(v => [v.attemptId, v.startMs]), [['a', 10000], ['a', 20000], ['b', 1000]]);
  assert.deepEqual(composed.chapters.map(v => [v.slide, v.runStart, v.durationMs]), [[0, 0, 6000], [1, 6, 2000]]);
  assert.deepEqual(composed.lines, lines);
});

function setup(value = fixture()) {
  runtime.nav = { deckId: 'deck', sel: 0, from: 'full', nav: null };
  runtime.routes = []; runtime.players = []; runtime.plays = []; runtime.audio = new Map([['a', 'file:///full.wav'], ['b', 'file:///redo.wav']]);
  runtime.model = { deck: { id: 'deck', hue: 'blue', slides: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }] },
    state: { run: value.run }, times: value.times, total: value.times.reduce((a, b) => a + b, 0), lines: value.lines, pending: false };
}
const button = (r, label) => r.root.findAllByType('pressable').find(node => node.props.accessibilityLabel === label);
const scrubber = r => r.root.findByProps({ accessibilityLabel: 'Run audio position' });
const text = r => JSON.stringify(r.toJSON());
async function render(work) {
  let r;
  try { await act(async () => { r = create(React.createElement(ListenBackKaraokeScreen)); }); await work(r); }
  finally { if (r) await act(async () => r.unmount()); }
}
const tap = node => act(async () => { assert.ok(node); node.props.onPress(); });
async function position(r, milliseconds) {
  runtime.players[0].elapsedMs = milliseconds;
  await act(async () => r.update(React.createElement(ListenBackKaraokeScreen)));
}

test('actual Listen Back queue, transcript, word highlight, progress and visit skips share chronological time', async () => {
  setup(); await render(async r => {
    await tap(button(r, 'Play whole run'));
    assert.deepEqual(runtime.plays[0].segments.map(s => [s.startMs, s.endMs]), [[10000, 13000], [13000, 17000], [20000, 23000], [23000, 27000]]);
    await position(r, 8000);
    assert.equal(scrubber(r).props.accessibilityValue.now, 8);
    assert.equal(scrubber(r).props.accessibilityValue.max, 14);
    assert.match(text(r), /Slide 1 · One/);
    // Supplied Claude patch, Codex integration 2026-11-21: colour-only highlight keeps the line from reflowing.
    const sentence = r.root.findAll(node => node.type === 'text' && node.props.accessibilityLabel === 'Return A')[0];
    const lit = sentence.findAll(node => node.type === 'text' && node !== sentence)[0];
    assert.equal(lit.props.style.color, '#D485FC');
    assert.equal(lit.props.style.fontFamily, undefined);
    const context = r.root.findAllByType('text').map(n => n.props.children);
    assert.ok(context.includes('First B')); assert.ok(context.includes('Return B'));
    await tap(button(r, 'Next slide')); assert.equal(runtime.plays.at(-1).elapsedMs, 10000);
    assert.match(text(r), /Slide 2 · Two/);
    await tap(button(r, 'Previous slide')); assert.equal(runtime.plays.at(-1).elapsedMs, 7000);
    await position(r, 4000); await tap(button(r, 'Next slide'));
    assert.equal(runtime.plays.at(-1).elapsedMs, 7000, 'next from the first slide-2 visit returns to slide 1');
  });
});

test('scrubbing a revisit seeks within selected audio and resumes the moving transcript clock', async () => {
  setup(); await render(async r => {
    await tap(button(r, 'Play whole run'));
    await act(async () => scrubber(r).props.onGrant({ nativeEvent: { pageX: 24 + 342 * 8 / 14 } }));
    assert.match(text(r), /Slide 1 · One/);
    await act(async () => scrubber(r).props.onRelease());
    assert.equal(runtime.plays.at(-1).elapsedMs, 8000);
    await position(r, 11000);
    assert.equal(scrubber(r).props.accessibilityValue.now, 11, 'released scrub does not freeze progress');
    assert.ok(r.root.findByProps({ accessibilityLabel: 'Return B' }));
  });
});

test('Whole run starts with the first spoken visit even when Review selected an earlier numbered slide', async () => {
  setup({ run: { parts: [part('a', [4000, 6000]), null, part('a', [1000, 4000])] }, times: [2, 0, 3], lines: [] });
  await render(async r => {
    assert.match(text(r), /Slide 3 · Three/);
    await tap(button(r, 'Play whole run'));
    assert.equal(runtime.plays[0].elapsedMs, 0);
    assert.deepEqual(runtime.plays[0].segments.map(s => [s.startMs, s.endMs]), [[1000, 4000], [4000, 6000]]);
    await tap(button(r, 'Next slide')); assert.equal(runtime.plays.at(-1).elapsedMs, 3000);
    assert.match(text(r), /Slide 1 · One/);
  });
});

test('composed playback still groups slide visits and does not seek a missing slide into other audio', async () => {
  const value = fixture(); value.run.parts[1] = part('b', [1000, 3000]); value.times = [6, 2]; value.lines = [];
  setup(value); await render(async r => {
    await tap(button(r, 'Play whole run'));
    assert.deepEqual(runtime.plays[0].segments.map(s => [s.uri, s.startMs]), [['file:///full.wav', 10000], ['file:///full.wav', 20000], ['file:///redo.wav', 1000]]);
    await tap(button(r, 'Next slide')); assert.equal(runtime.plays.at(-1).elapsedMs, 6000);
  });
  setup(value); runtime.audio.delete('b'); await render(async r => {
    await tap(button(r, 'Play whole run')); const calls = runtime.plays.length;
    await tap(button(r, 'Next slide'));
    assert.equal(runtime.plays.length, calls); assert.match(text(r), /Audio for slide 2 is not on this phone/);
  });
});
