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
