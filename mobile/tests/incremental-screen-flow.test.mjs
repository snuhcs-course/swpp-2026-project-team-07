import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/incremental-screen-loader.mjs';
registerHooks({ resolve, load });
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { runtime } = await import('./helpers/recording-cues-runtime-native.mjs');
const { RehearseScreen } = await import('../src/screens/RehearseScreen.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);
let renderer;
const button = label => renderer.root.findAllByType('pressable').find(n => n.props.accessibilityLabel === label);
const round = label => renderer.root.findAllByType('round-button').find(n => n.props.label === label);
const tap = node => act(async () => { assert.ok(node); node.props.onPress(); });
async function start(t, incremental) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 0 });
  const deck = { id: 'deck', title: 'Synthetic deck', uri: 'file:///fixture.pdf', hue: 'blue', pageCount: 2,
    targets: [60, 60], target: 120, pages: [], slides: [{ title: 'One', text: '', points: [] }, { title: 'Two', text: '', points: [] }] };
  runtime.reset({ deck, n: 2, times: [0, 0], stats: null, state: { run: null, takes: 0, compare: null, discarded: [] } });
  runtime.incremental = incremental;
  await act(async () => { renderer = create(React.createElement(RehearseScreen)); });
  await tap(renderer.root.findByType('record-button'));
  await act(async () => { t.mock.timers.tick(3000); });
  assert.equal(renderer.root.findByType('record-button').props.label, 'Stop recording');
  return runtime.captures[0];
}
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });

test('rotation, revisits and live feedback retain one capture owner until Stop', async t => {
  const capture = await start(t, true);
  runtime.insets = { top: 24, bottom: 48, left: 0, right: 0 };
  await tap(round('Open full-screen landscape player'));
  assert.equal(runtime.captures.length, 1); assert.equal(capture.released, false); assert.equal(capture.recording, true);
  assert.equal(button('Next slide').props.style.find(part => part.right !== undefined).right, 56, 'portrait navigation bar maps to landscape right');
  assert.equal(button('Previous slide').props.style.find(part => part.left !== undefined).left, 32, 'portrait top inset maps to landscape left');
  const dock = button('Return to portrait rehearsal').parent;
  assert.equal(dock.props.style.find(part => part.right !== undefined).right, 60, 'dock keeps clear of the right inset');
  assert.deepEqual(dock.findAllByType('pressable').map(node => node.props.accessibilityLabel),
    ['Show live feedback progress', 'Open cue panel', 'Return to portrait rehearsal']);
  assert.equal(renderer.root.findAllByType('record-ring').length, 0, 'recording progress uses the dock bar');
  await tap(button('Next slide')); await tap(button('Previous slide'));
  assert.deepEqual(capture.slides, [0, 1, 0]);
  const live = button('Show live feedback progress');
  assert.equal(live.props.disabled, false); await tap(live);
  assert.ok(renderer.root.findByType('live-feedback')); assert.equal(capture.recording, true);
  assert.equal(renderer.root.findByType('live-feedback').parent.props.landscape, true);
  await act(async () => renderer.root.findByType('live-feedback').props.close());
  await act(async () => { t.mock.timers.tick(3000); });
  assert.equal(button('Return to portrait rehearsal').parent.parent.props.pointerEvents, 'none', 'controls become non-interactive after three seconds of recording');
  assert.ok(runtime.timings.some(timing => timing.value === 0 && timing.duration === 300), 'the dock fades out');
  assert.ok(renderer.root.findAllByType('view').some(node => Array.isArray(node.props.style) && node.props.style.some(part => part.height === 3)), 'thin progress line remains');
  await tap(button('Show or hide rehearsal controls'));
  assert.equal(button('Return to portrait rehearsal').parent.parent.props.pointerEvents, 'auto', 'tapping the slide restores the controls');
  await act(async () => { t.mock.timers.tick(3000); });
  assert.equal(button('Return to portrait rehearsal').parent.parent.props.pointerEvents, 'none', 'restored controls hide again');
  await tap(button('Show or hide rehearsal controls'));
  await tap(button('Return to portrait rehearsal'));
  assert.equal(runtime.captures.length, 1); assert.equal(capture.released, false);
  await tap(renderer.root.findByType('record-button'));
  assert.equal(capture.recording, false);
  assert.equal(runtime.routes.at(-1)[0], 'full', 'incremental first take exposes available Review immediately');
});

test('after-Stop fallback retains the existing first-take wait route', async t => {
  await start(t, false);
  await tap(renderer.root.findByType('record-button'));
  assert.equal(runtime.routes.at(-1)[0], 'wait');
  await act(async () => { t.mock.timers.tick(1); });
  await tap(round('Review overall feedback'));
  assert.equal(runtime.routes.at(-1)[0], 'full', 'reopening the saved first take skips the one-time wait');
});
