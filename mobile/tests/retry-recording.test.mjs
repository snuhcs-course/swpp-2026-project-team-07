// OpenAI Codex: B09 regression. Real screen, CaptureEngine, take selection and
// SQLite attempt storage; simulated microphone/native UI, no device/provider calls.
// Spec/evidence: docs/b09-retry-recording.md
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/retry-recording-loader.mjs';
registerHooks({ resolve, load });
process.env.EXPO_PUBLIC_API_URL = 'http://b09-fixture.invalid/api';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = clearTimeout;
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { runtime } = await import('./helpers/recording-cues-runtime-native.mjs');
const { captures, resetCaptureFixture } = await import('./helpers/recording-screen-audio.mjs');
const { RehearseScreen } = await import('../src/screens/RehearseScreen.tsx');
const { ThemeProvider } = await import('../src/design/theme.tsx');
const { getSavedAttempt } = await import('../src/features/recording/storage.ts');
const { resolveCompare } = await import('../src/features/rehearsal/takes.ts');
let renderer, serial = 0;
const fetchBefore = globalThis.fetch;
const screen = active => React.createElement(ThemeProvider, null, React.createElement(RehearseScreen, { active }));
const recordButton = () => renderer.root.findByType('record-button');
const latest = () => captures.at(-1);
const visible = () => JSON.stringify(renderer.toJSON());
async function tapRecord() { await act(async () => recordButton().props.onPress()); }
async function mount() {
  resetCaptureFixture();
  const deck = { id: `b09-synthetic-${++serial}`, title: 'B09 synthetic fixture', uri: 'file:///b09-fixture.pdf',
    hue: 'blue', target: 120, targets: [60, 60], pageCount: 2, pages: [],
    slides: [{ title: 'First', points: [] }, { title: 'Second', points: [] }] };
  runtime.reset({ deck, n: 2, state: { run: null, takes: 0, compare: null, discarded: [], lastFullTotal: null, baselineCoverage: null }, stats: null });
  globalThis.fetch = async () => { throw Error('offline fixture'); };
  await act(async () => { renderer = create(screen(true)); });
}
async function start(t) {
  await tapRecord();
  const dialogs = renderer.root.findAllByType('dialog');
  if (dialogs.length) await act(async () => dialogs[0].props.onConfirm());
  await act(async () => { t.mock.timers.tick(3000); });
}
async function finish() {
  latest().durationMillis = 4200;
  await tapRecord();
  const ids = runtime.model.state.compare ? [runtime.model.state.compare.attemptId] : [runtime.model.state.run.parts[0].attemptId];
  return getSavedAttempt(ids[0]);
}
async function returnFromReview(t) {
  await act(async () => renderer.update(screen(false)));
  await act(async () => t.mock.timers.tick(0));
  await act(async () => renderer.update(screen(true)));
  await act(async () => t.mock.timers.tick(0));
}
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; globalThis.fetch = fetchBefore; });

test('B09: first redo after returning from review starts a fresh capture and preserves the original', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 10000 });
  await mount();
  latest().uri = 'file:///b09-original.m4a';
  await start(t);
  assert.equal(recordButton().props.label, 'Stop recording');
  const originalRecorder = latest();
  const original = await finish();
  assert.equal(original.state, 'saved');
  await returnFromReview(t);
  await start(t);
  assert.equal(visible().includes('This take has already started.'), false, 'first redo must not reuse the finished capture');
  assert.equal(recordButton().props.label, 'Stop recording');
  assert.notEqual(latest(), originalRecorder, 'redo must own a fresh recorder');
  assert.equal(originalRecorder.released, true);
  originalRecorder.durationMillis = 99000;
  await act(async () => { originalRecorder.emitError(); originalRecorder.emitFinished(); t.mock.timers.tick(70); });
  assert.equal(recordButton().props.label, 'Stop recording', 'late callbacks from the released recorder cannot interrupt the redo');
  latest().uri = 'file:///b09-retake.m4a';
  const retake = await finish();
  assert.notEqual(retake.id, original.id);
  assert.deepEqual(getSavedAttempt(original.id), original);
  assert.equal(runtime.model.state.run.parts[0].attemptId, original.id, 'old take stays selected during comparison');
  await act(async () => resolveCompare(runtime.model.deck.id, 'old'));
  assert.equal(runtime.model.state.run.parts[0].attemptId, original.id);
  assert.equal(getSavedAttempt(original.id).recording.audio_uri, 'file:///b09-original.m4a');
});

const elapsed = () => renderer.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Elapsed rehearsal time '))[0]?.props.accessibilityLabel;

test('B09: successive redos use a new audio clock and support overwrite and keep current', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 10000 });
  await mount();
  await start(t);
  const original = await finish();
  await act(async () => renderer.root.findAllByType('round-button').find(node => node.props.label === 'Rotate only the PDF for a bigger view').props.onPress());
  let selected = original.id;
  for (const [index, choice] of ['new', 'old', 'new'].entries()) {
    await returnFromReview(t);
    await start(t);
    assert.equal(recordButton().props.label, 'Stop recording');
    assert.equal(elapsed(), 'Elapsed rehearsal time 0:00');
    latest().durationMillis = (index + 1) * 1000;
    await act(async () => t.mock.timers.tick(70));
    assert.equal(elapsed(), `Elapsed rehearsal time 0:0${index + 1}`);
    const retake = await finish();
    assert.equal(runtime.model.state.run.parts[0].attemptId, selected);
    await act(async () => resolveCompare(runtime.model.deck.id, choice));
    if (choice === 'new') selected = retake.id;
    assert.equal(runtime.model.state.run.parts[0].attemptId, selected);
    assert.equal(getSavedAttempt(original.id).state, 'saved');
    assert.equal(getSavedAttempt(retake.id).state, 'saved');
  }
});

test('B09: cancelling a redo countdown preserves the saved take and permits the next redo', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 10000 });
  await mount();
  await start(t);
  const original = await finish();
  await returnFromReview(t);
  await tapRecord();
  await act(async () => renderer.root.findByType('dialog').props.onConfirm());
  await act(async () => t.mock.timers.tick(1000));
  assert.match(recordButton().props.label, /Tap to cancel/);
  await tapRecord();
  await act(async () => t.mock.timers.tick(5000));
  assert.equal(runtime.model.state.run.parts[0].attemptId, original.id);
  assert.deepEqual(getSavedAttempt(original.id), original);
  await start(t);
  assert.equal(recordButton().props.label, 'Stop recording');
});

test('B09: repeated record taps while the native recorder prepares start only one capture', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 10000 });
  await mount();
  let release;
  latest().prepareWait = new Promise(resolve => { release = resolve; });
  await start(t);
  await tapRecord();
  await tapRecord();
  assert.equal(captures.length, 1);
  release();
  await act(async () => {});
  assert.equal(recordButton().props.label, 'Stop recording');
  assert.equal(captures.length, 1);
});

test('B09: holding redo restarts the full presentation and overwrite replaces its selected run', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 10000 });
  await mount();
  await start(t);
  latest().durationMillis = 1400;
  const slide = renderer.root.findAllByType('pan').find(node => node.props.accessibilityLabel?.startsWith('Slide 1 of 2:'));
  await act(async () => slide.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  const original = await finish();
  assert.equal(runtime.model.state.run.parts[1].attemptId, original.id);
  await returnFromReview(t);
  await act(async () => recordButton().props.onPressIn());
  await act(async () => t.mock.timers.tick(3000));
  await act(async () => recordButton().props.onPressOut());
  await tapRecord();
  assert.equal(renderer.root.findByType('dialog').props.title, 'Redo the whole presentation?');
  await act(async () => renderer.root.findByType('dialog').props.onConfirm());
  await act(async () => t.mock.timers.tick(3000));
  assert.equal(recordButton().props.label, 'Stop recording');
  const retake = await finish();
  assert.equal(retake.recording.slide_events[0].slide_index, 0);
  assert.equal(runtime.model.state.run.parts[1].attemptId, original.id);
  await act(async () => resolveCompare(runtime.model.deck.id, 'new'));
  assert.equal(runtime.model.state.run.parts[0].attemptId, retake.id);
  assert.equal(runtime.model.state.run.parts[1], null, 'whole redo replaces rather than splices the old run');
  assert.deepEqual(getSavedAttempt(original.id), original);
});
