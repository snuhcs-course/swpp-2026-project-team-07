import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import * as Module from 'node:module';
import { resolve, load } from './helpers/recording-screen-loader.mjs';
import { captures, resetCaptureFixture } from './helpers/recording-screen-audio.mjs';

if (Module.registerHooks) Module.registerHooks({ resolve, load });
else Module.register('./helpers/recording-screen-loader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { RehearsalScreen } = await import('../src/features/recording/RehearsalScreen.tsx');
const actions = (tree) => tree.root.findAllByType('action');
async function press(tree, label) {
  const action = actions(tree).find((item) => item.props.label === label);
  assert.ok(action, `Missing action: ${label}`);
  assert.notEqual(action.props.disabled, true);
  await act(async () => { action.props.onPress(); await new Promise(setImmediate); });
}
async function render() {
  let tree;
  await act(async () => { tree = create(React.createElement(RehearsalScreen)); });
  return tree;
}

test('failed native start offers a fresh recorder instead of reusing prepared state', async () => {
  resetCaptureFixture(true);
  const tree = await render();
  try {
    await press(tree, 'Start recording');
    assert.equal(actions(tree).some((item) => item.props.label === 'Try recording again'), true);
    await press(tree, 'Try recording again');
    assert.equal(captures[0].released, true);
    await press(tree, 'Start recording');
    assert.equal(captures.length, 2);
    assert.equal(captures[1].isRecording, true);
  } finally { await act(async () => tree.unmount()); }
});

test('native error retry releases old capture, retains the slide and ignores stale errors', async () => {
  resetCaptureFixture();
  const tree = await render();
  try {
    await press(tree, 'Next slide');
    await press(tree, 'Start recording');
    await act(async () => captures[0].emitError());
    const start = actions(tree).find((item) => item.props.label === 'Start recording');
    assert.ok(!start || start.props.disabled);
    await press(tree, 'Try recording again');
    assert.equal(tree.root.findByType('slide').props.index, 1);
    assert.equal(captures[0].released, true);
    await press(tree, 'Start recording');
    await act(async () => captures[0].emitError());
    assert.equal(captures[1].isRecording, true);
    assert.equal(actions(tree).some((item) => item.props.label === 'Stop recording'), true);
    assert.equal(actions(tree).some((item) => item.props.label === 'Try recording again'), false);
  } finally { await act(async () => tree.unmount()); }
});

const { requestBack, backgroundApp, routes } = await import('./helpers/recording-screen-ui.mjs');

test('Back finalizes capture and keeps the audio available before leaving', async () => {
  resetCaptureFixture();
  const tree = await render();
  try {
    await press(tree, 'Start recording');
    await act(async () => { assert.equal(requestBack(), true); await new Promise(setImmediate); });
    assert.equal(captures[0].isRecording, false);
    await press(tree, 'Listen to recording');
    assert.equal(routes.at(-1).params.audioUri, 'file:///test.m4a');
  } finally { await act(async () => tree.unmount()); }
});

test('backgrounding while native preparation waits never starts capture in the background', async () => {
  resetCaptureFixture();
  const tree = await render();
  let finish;
  try {
    captures[0].prepareWait = new Promise(resolve => { finish = resolve; });
    await press(tree, 'Start recording');
    await act(async () => backgroundApp('background'));
    await act(async () => { finish(); await new Promise(setImmediate); });
    assert.equal(captures[0].isRecording, false);
    assert.equal(captures[0].released, true);
  } finally { backgroundApp('active'); await act(async () => tree.unmount()); }
});

test('two rapid Start presses create one capture and repeated recordings reset the timeline', async () => {
  resetCaptureFixture();
  const tree = await render();
  try {
    const start = actions(tree).find(item => item.props.label === 'Start recording');
    await act(async () => { start.props.onPress(); start.props.onPress(); await new Promise(setImmediate); });
    assert.equal(captures[0].isRecording, true);
    await press(tree, 'Next slide');
    await press(tree, 'Stop recording');
    await press(tree, 'Start recording');
    await press(tree, 'Stop recording');
    await press(tree, 'Listen to recording');
    assert.deepEqual(JSON.parse(routes.at(-1).params.slideEvents), [{ slide_index: 1, at_ms: 0 }]);
  } finally { await act(async () => tree.unmount()); }
});


test('a late completion callback from the previous capture cannot end the next recording', async () => {
  resetCaptureFixture();
  const tree = await render();
  try {
    await press(tree, 'Start recording');
    const firstCapture = captures[0];
    await press(tree, 'Stop recording');
    await press(tree, 'Start recording');
    await act(async () => firstCapture.emitFinished());
    assert.equal(captures.at(-1).isRecording, true);
    assert.equal(actions(tree).some(item => item.props.label === 'Stop recording'), true);
  } finally { await act(async () => tree.unmount()); }
});

test('a delayed native error after Stop resolves cannot silently expose failed audio as successful', async () => {
  resetCaptureFixture();
  const tree = await render();
  try {
    await press(tree, 'Start recording');
    const capture = captures[0];
    capture.stop = async function () {
      this.isPrepared = false; this.isRecording = false;
      queueMicrotask(() => this.emitError());
    };
    await press(tree, 'Stop recording');
    assert.equal(actions(tree).some(item => item.props.label === 'Try recording again'), true);
    assert.equal(actions(tree).some(item => item.props.label === 'Listen to recording'), false);
  } finally { await act(async () => tree.unmount()); }
});


test('returning from the microphone permission activity before capture starts does not cancel recording', async () => {
  resetCaptureFixture();
  const tree = await render();
  let finish;
  try {
    captures[0].prepareWait = new Promise(resolve => { finish = resolve; });
    await press(tree, 'Start recording');
    await act(async () => { backgroundApp('background'); backgroundApp('active'); });
    await act(async () => { finish(); await new Promise(setImmediate); });
    assert.equal(captures.at(-1).isRecording, true);
    assert.equal(actions(tree).some(item => item.props.label === 'Stop recording'), true);
  } finally { finish?.(); backgroundApp('active'); await act(async () => tree.unmount()); }
});


test('retrying a failed second capture never presents the previous recording as the new attempt', async () => {
  resetCaptureFixture();
  const tree = await render();
  try {
    captures[0].uri = 'file:///first.m4a';
    await press(tree, 'Start recording');
    await press(tree, 'Stop recording');
    await press(tree, 'Start recording');
    await act(async () => captures.at(-1).emitError());
    await press(tree, 'Try recording again');
    assert.equal(actions(tree).some(item => item.props.label === 'Listen to recording'), false);
  } finally { await act(async () => tree.unmount()); }
});
