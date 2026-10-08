import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import * as Module from 'node:module';
import { resolve, load } from './helpers/recording-screen-loader.mjs';
import { captures, resetCaptureFixture } from './helpers/recording-screen-audio.mjs';
import { routes, setRouteParams } from './helpers/recording-screen-ui.mjs';
import { pageRequests } from './helpers/recording-screen-pdf.mjs';

if (Module.registerHooks) Module.registerHooks({ resolve, load });
else Module.register('./helpers/recording-screen-loader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { RehearsalScreen } = await import('../src/features/recording/RehearsalScreen.tsx');
const { getSavedAttempt } = await import('../src/features/recording/storage.ts');
const savedRoute = () => getSavedAttempt(routes.at(-1).params.attemptId);
const { ViewerScreen } = await import('../src/features/pdf/ViewerScreen.tsx');
const pdf = tree => tree.root.findByType('pdf');
const action = (tree, label) => tree.root.findAllByType('action').find(node => node.props.label === label);
const rehearsalAction = tree => tree.root.findAllByType('action').find(node => /rehearsal/i.test(node.props.label));
async function tick(fn) { await act(async () => { fn(); await new Promise(setImmediate); }); }
async function press(tree, label) {
  const node = action(tree, label);
  assert.ok(node, 'Missing action: ' + label);
  assert.notEqual(node.props.disabled, true, 'Disabled action: ' + label);
  await tick(() => node.props.onPress());
}
async function mount(Component = RehearsalScreen, params = {}) {
  resetCaptureFixture();
  pageRequests.length = 0;
  setRouteParams({ uri: 'file:///six-slides.pdf', title: 'My slides', localDeckId: 'local-pdf-123', slide: '0', ...params });
  let tree;
  await act(async () => { tree = create(React.createElement(Component)); });
  return tree;
}
async function loaded(tree, page = 1, count = 6) {
  await tick(() => pdf(tree).props.onLoadComplete(count));
  await tick(() => pdf(tree).props.onPageChanged(page, count));
}
async function close(tree) { await act(async () => tree.unmount()); }
async function savedEvents(tree, duration = 2000) {
  captures.at(-1).durationMillis = duration;
  await press(tree, 'Stop recording');
  await press(tree, 'Listen to recording');
  assert.equal(savedRoute().recording.audio_uri, 'file:///test.m4a');
  return savedRoute().recording.slide_events;
}

test('viewer hands off the confirmed PDF page and metadata, never an unrendered navigation target', async () => {
  const tree = await mount(ViewerScreen, {});
  try {
    assert.equal(rehearsalAction(tree).props.disabled, true);
    await tick(() => pdf(tree).props.onLoadComplete(6));
    assert.equal(rehearsalAction(tree).props.disabled, true);
    await tick(() => pdf(tree).props.onPageChanged(4, 6));
    await press(tree, 'Next slide');
    assert.equal(rehearsalAction(tree).props.disabled, true);
    await tick(() => pdf(tree).props.onPageChanged(5, 6));
    await tick(() => tree.root.findByType('input').props.onChangeText('Students'));
    await press(tree, 'Start rehearsal');
    assert.deepEqual(routes.at(-1), { pathname: '/rehearsal', params: {
      uri: 'file:///six-slides.pdf', title: 'My slides', slide: 4, audience: 'Students',
      localDeckId: 'local-pdf-123', pageCount: 6,
    } });
  } finally { await close(tree); }
});

test('rehearsal starts beyond the sample slide count only after the real PDF page is confirmed', async () => {
  const tree = await mount(RehearsalScreen, { slide: '4' });
  try {
    assert.equal(pdf(tree).props.page, 5);
    assert.equal(action(tree, 'Start recording').props.disabled, true);
    await tick(() => pdf(tree).props.onLoadComplete(6));
    assert.equal(action(tree, 'Start recording').props.disabled, true);
    await tick(() => pdf(tree).props.onPageChanged(5, 6));
    await press(tree, 'Start recording');
    assert.deepEqual(await savedEvents(tree), [{ slide_index: 4, at_ms: 0 }]);
  } finally { await close(tree); }
});

test('real PDF callbacks timestamp forward and backward visits; requests and duplicate callbacks add no visits', async () => {
  const tree = await mount();
  try {
    await loaded(tree);
    await press(tree, 'Start recording');
    captures[0].durationMillis = 200;
    await press(tree, 'Next slide');
    captures[0].durationMillis = 700;
    await tick(() => pdf(tree).props.onPageChanged(2, 6));
    captures[0].durationMillis = 800;
    await tick(() => pdf(tree).props.onPageChanged(2, 6));
    captures[0].durationMillis = 1200;
    await tick(() => pdf(tree).props.onPageChanged(1, 6));
    captures[0].durationMillis = 1700;
    await tick(() => pdf(tree).props.onPageChanged(3, 6));
    assert.deepEqual(await savedEvents(tree), [
      { slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 700 },
      { slide_index: 0, at_ms: 1200 }, { slide_index: 2, at_ms: 1700 },
    ]);
  } finally { await close(tree); }
});

test('late PDF callbacks during microphone preparation choose the initial visible slide at capture start', async () => {
  const tree = await mount();
  let begin;
  try {
    await loaded(tree);
    captures[0].prepareWait = new Promise(resolve => { begin = resolve; });
    await press(tree, 'Start recording');
    assert.equal(pdf(tree).props.scrollEnabled, false);
    assert.equal(action(tree, 'Next slide').props.disabled, true);
    await tick(() => pdf(tree).props.onPageChanged(2, 6));
    await tick(() => begin());
    assert.deepEqual(await savedEvents(tree), [{ slide_index: 1, at_ms: 0 }]);
  } finally { begin?.(); await close(tree); }
});

test('stop freezes capture and blocks PDF navigation while native finalization is pending', async () => {
  const tree = await mount();
  let finish;
  try {
    await loaded(tree);
    await press(tree, 'Start recording');
    captures[0].durationMillis = 1000;
    captures[0].stopWait = new Promise(resolve => { finish = resolve; });
    await press(tree, 'Stop recording');
    assert.equal(pdf(tree).props.scrollEnabled, false);
    assert.equal(action(tree, 'Next slide').props.disabled, true);
    await tick(() => pdf(tree).props.onPageChanged(2, 6));
    await tick(() => finish());
    await press(tree, 'Listen to recording');
    assert.deepEqual(savedRoute().recording.slide_events, [{ slide_index: 0, at_ms: 0 }]);
  } finally { finish?.(); await close(tree); }
});

test('invalid PDF page callbacks cannot start a recording with an out-of-range slide', async () => {
  const tree = await mount(RehearsalScreen, { slide: '99' });
  try {
    await tick(() => pdf(tree).props.onLoadComplete(3));
    for (const page of [0, -1, 4, 1.5]) {
      await tick(() => pdf(tree).props.onPageChanged(page, 3));
      assert.equal(action(tree, 'Start recording').props.disabled, true);
    }
    await tick(() => pdf(tree).props.onPageChanged(3, 3));
    await press(tree, 'Start recording');
    assert.deepEqual(await savedEvents(tree), [{ slide_index: 2, at_ms: 0 }]);
  } finally { await close(tree); }
});

test('PDF errors block Start without substituting sample slides and leave Stop available for existing audio', async () => {
  const tree = await mount();
  try {
    await loaded(tree);
    await tick(() => pdf(tree).props.onError(new Error('damaged')));
    assert.equal(action(tree, 'Start recording').props.disabled, true);
    assert.equal(tree.root.findAllByType('slide').length, 0);
    await loaded(tree);
    await press(tree, 'Start recording');
    await tick(() => pdf(tree).props.onError(new Error('render failed')));
    assert.notEqual(action(tree, 'Stop recording').props.disabled, true);
    assert.deepEqual(await savedEvents(tree), [{ slide_index: 0, at_ms: 0 }]);
  } finally { await close(tree); }
});

test('recording retry reloads the selected PDF page and ignores callbacks from the released screen', async () => {
  const tree = await mount(RehearsalScreen, { slide: '4' });
  try {
    await loaded(tree, 5);
    const oldPdf = pdf(tree).props;
    await press(tree, 'Start recording');
    await tick(() => captures[0].emitError());
    await press(tree, 'Try recording again');
    assert.equal(pdf(tree).props.page, 5);
    assert.equal(action(tree, 'Start recording').props.disabled, true);
    await tick(() => { oldPdf.onPageChanged(1, 6); oldPdf.onError(new Error('stale')); });
    await loaded(tree, 5);
    await press(tree, 'Start recording');
    assert.deepEqual(await savedEvents(tree), [{ slide_index: 4, at_ms: 0 }]);
  } finally { await close(tree); }
});

test('a PDF over ten slides cannot start capture even after a valid page callback', async () => {
  const tree = await mount();
  try {
    await loaded(tree, 1, 11);
    assert.equal(action(tree, 'Start recording').props.disabled, true);
    assert.equal(captures[0].isRecording, false);
  } finally { await close(tree); }
});

test('local deck identity and native page count travel with the saved audio without a server ID', async () => {
  const tree = await mount(RehearsalScreen, { pageCount: '99', slide: '2' });
  try {
    await loaded(tree, 3, 6);
    await press(tree, 'Start recording');
    await savedEvents(tree);
    assert.equal(savedRoute().local_deck_id, 'local-pdf-123');
    assert.equal(savedRoute().page_count, 6);
    assert.equal(savedRoute().recording.duration_ms, 2000);
    assert.deepEqual(Object.keys(routes.at(-1).params), ["attemptId"]);
    assert.equal(savedRoute().recording.deck_id, undefined);
  } finally { await close(tree); }
});


test('two real-PDF recordings preserve distinct audio, selected page and native page count after remount', async () => {
  const tree = await mount(RehearsalScreen, { slide: '2' });
  try {
    await loaded(tree, 3, 6);
    captures.at(-1).uri = 'file:///first.m4a';
    await press(tree, 'Start recording');
    await press(tree, 'Stop recording');
    await press(tree, 'Listen to recording');
    assert.equal(savedRoute().recording.audio_uri, 'file:///first.m4a');
    assert.equal(action(tree, 'Start recording').props.disabled, true);
    await loaded(tree, 3, 6);
    captures.at(-1).uri = 'file:///second.m4a';
    await press(tree, 'Start recording');
    captures.at(-1).durationMillis = 1800;
    await press(tree, 'Stop recording');
    await press(tree, 'Listen to recording');
    assert.equal(savedRoute().recording.audio_uri, 'file:///second.m4a');
    assert.equal(savedRoute().page_count, 6);
    assert.equal(savedRoute().recording.duration_ms, 1800);
    assert.deepEqual(savedRoute().recording.slide_events, [{ slide_index: 2, at_ms: 0 }]);
  } finally { await close(tree); }
});

const { sqliteFaults } = await import('./helpers/sqlite-node.mjs');
const { savedAttempts } = await import('../src/features/recording/storage.ts');

test('prepared URI is durable; failed checkpoint and interruption still release recorder', async () => {
  const tree = await mount();
  try {
    await loaded(tree, 2);
    await press(tree, 'Start recording');
    const saved = savedAttempts().find(a => a.state === 'capturing');
    assert.equal(saved.recording.audio_uri, 'file:///test.m4a');
    assert.deepEqual(saved.recording.slide_events, [{ slide_index: 1, at_ms: 0 }]);
    sqliteFaults.before = op => { if (op === 'run') throw new Error('disk full'); };
    await tick(() => pdf(tree).props.onPageChanged(1, 6));
    assert.equal(captures[0].released, true);
    assert.ok(action(tree, 'Try recording again'));
    assert.equal(action(tree, 'Listen to recording'), undefined);
  } finally { sqliteFaults.before = null; await close(tree); }
});

test('native error with unavailable SQLite still releases microphone and presents retry', async () => {
  const tree = await mount();
  try {
    await loaded(tree);
    await press(tree, 'Start recording');
    sqliteFaults.before = op => { if (op === 'run') throw new Error('disk full'); };
    await tick(() => captures[0].emitError());
    assert.equal(captures[0].released, true);
    assert.ok(action(tree, 'Try recording again'));
  } finally { sqliteFaults.before = null; await close(tree); }
});

test('failed initial write cannot start native capture or strand its prepared recorder', async () => {
  const tree = await mount();
  try {
    await loaded(tree);
    sqliteFaults.before = op => { if (op === 'run') throw new Error('disk full'); };
    await press(tree, 'Start recording');
    assert.equal(captures[0].isRecording, false);
    assert.equal(captures[0].released, true);
    assert.ok(action(tree, 'Try recording again'));
  } finally { sqliteFaults.before = null; await close(tree); }
});

test('native start failure needs only one durable write to retain prepared audio and initial slide', async () => {
  const tree = await mount();
  try {
    await loaded(tree, 2);
    const before = new Set(savedAttempts().map(a => a.id));
    let writes = 0;
    captures[0].record = () => { throw new Error('synthetic native start failed'); };
    sqliteFaults.before = op => { if (op === 'run' && ++writes > 1) throw new Error('disk unavailable after creation'); };
    await press(tree, 'Start recording');
    const saved = savedAttempts().find(a => !before.has(a.id));
    assert.equal(saved.recording.audio_uri, 'file:///test.m4a');
    assert.deepEqual(saved.recording.slide_events, [{ slide_index: 1, at_ms: 0 }]);
    assert.equal(captures[0].released, true);
    assert.match(JSON.stringify(tree.toJSON()), /native start failed/);
  } finally { sqliteFaults.before = null; await close(tree); }
});
