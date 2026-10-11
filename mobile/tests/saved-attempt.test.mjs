import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/saved-screen-loader.mjs';
import { playback, resetPlayback } from './helpers/recording-screen-audio.mjs';
import { setFocused } from './helpers/recording-screen-ui.mjs';
import { sqliteFaults } from './helpers/sqlite-node.mjs';
import { files, network, response } from './helpers/upload-native.mjs';
registerHooks({ resolve, load });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { SavedAttemptScreen } = await import('../src/features/recording/SavedAttemptScreen.tsx');
const { beginAttempt, checkpointAttempt, getSavedAttempt, saveAttempt } = await import('../src/features/recording/storage.ts');
const { API_URL } = await import('../src/services/api.ts');
const action = (tree, label) => tree.root.findAllByType('action').find(n => n.props.label === label);
const text = tree => JSON.stringify(tree.toJSON());
async function tick(fn) { await act(async () => { fn(); await new Promise(setImmediate); }); }
async function mount(id) { let tree; await tick(() => { tree = create(React.createElement(SavedAttemptScreen, { id })); }); return tree; }
function saved() {
  const id = beginAttempt({ id: 'local', uri: 'file:///synthetic.pdf', title: 'Synthetic', pageCount: 2 }, '', 1, 'file:///synthetic.wav');
  checkpointAttempt(id, 'file:///synthetic.wav', 2000, [{ slide_index: 1, at_ms: 0 }], true);
  return id;
}
beforeEach(() => { resetPlayback(); setFocused(true); sqliteFaults.before = null; });

test('saved audio reopens from its URI and rewinds at end even without didJustFinish', async () => {
  const id = saved();
  let tree = await mount(id);
  await tick(() => tree.unmount());
  tree = await mount(id);
  try {
    assert.equal(playback.source, 'file:///synthetic.wav');
    await tick(() => action(tree, 'Play').props.onPress());
    assert.deepEqual(playback.seeks, [0]);
    assert.equal(playback.played, 1);
    assert.equal(text(tree).includes('SAVED TEST'), false);
  } finally { await tick(() => tree.unmount()); }
});

test('rapid replay taps serialize seeking; blur invalidates resume before its passive pause effect', async () => {
  const tree = await mount(saved());
  let finish;
  playback.wait = new Promise(resolve => { finish = resolve; });
  try {
    await tick(() => { action(tree, 'Play').props.onPress(); action(tree, 'Play').props.onPress(); });
    assert.deepEqual(playback.seeks, [0]);
    await tick(() => { setFocused(false); finish(); });
    assert.equal(playback.played, 0);
    assert.ok(playback.paused > 0);
  } finally { finish(); await tick(() => tree.unmount()); }
});

test('unmount during replay never resumes released audio', async () => {
  const tree = await mount(saved());
  let finish;
  playback.wait = new Promise(resolve => { finish = resolve; });
  await tick(() => action(tree, 'Play').props.onPress());
  await tick(() => tree.unmount());
  await tick(() => finish());
  assert.equal(playback.played, 0);
});

test('read failure presents a recoverable load action without losing the saved attempt', async () => {
  const id = saved();
  sqliteFaults.before = op => { if (op === 'get') throw new Error('database unavailable'); };
  const tree = await mount(id);
  try {
    assert.match(text(tree), /database unavailable/);
    sqliteFaults.before = null;
    await tick(() => action(tree, 'Reload saved rehearsal').props.onPress());
    assert.ok(action(tree, 'Play'));
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});

test('refresh read failure after upload clears busy and exposes retry', async () => {
  const id = saved();
  files.set('file:///synthetic.pdf', {}); files.set('file:///synthetic.wav', {});
  network.respond = (url, init) => {
    if (url.endsWith('/decks/')) return response(201, { deck: { id: '11111111-1111-4111-8111-111111111111', page_count: 2 } });
    if (url.includes('/decks/')) return response(200, { id: '11111111-1111-4111-8111-111111111111', page_count: 2 });
    sqliteFaults.before = op => { if (op === 'get') throw new Error('refresh unavailable'); };
    return response(201, { attempt_id: id });
  };
  const tree = await mount(id);
  try {
    await tick(() => action(tree, 'Upload recording').props.onPress());
    assert.match(text(tree), /refresh unavailable/);
    assert.equal(action(tree, 'Uploading…'), undefined);
    assert.notEqual(action(tree, 'Upload recording').props.disabled, true);
    sqliteFaults.before = null;
    await tick(() => action(tree, 'Upload recording').props.onPress());
    assert.match(text(tree), /Uploaded · awaiting analysis/);
  } finally { sqliteFaults.before = null; await tick(() => tree.unmount()); }
});

test('upload action and awaiting-analysis state are scoped to the configured server', async () => {
  const id = saved();
  saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: 'http://old.invalid/api' });
  let tree = await mount(id);
  try { assert.ok(action(tree, 'Upload recording')); assert.doesNotMatch(text(tree), /Uploaded · awaiting analysis/); }
  finally { await tick(() => tree.unmount()); }
  saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: API_URL });
  tree = await mount(id);
  try { assert.equal(action(tree, 'Upload recording'), undefined); assert.match(text(tree), /Uploaded · awaiting analysis/); }
  finally { await tick(() => tree.unmount()); }
});
