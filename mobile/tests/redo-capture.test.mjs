// OpenAI Codex, 2026-11-02: retained-screen Redo regression; see docs/ai-collaboration-prompts-iteration-2.md.
// Actual single-use CaptureEngine/service/storage/take merging; native recorder/views and presentation model are fixtures.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/redo-capture-loader.mjs';
registerHooks({ resolve, load });
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { captures, resetCaptureFixture } = await import('./helpers/recording-screen-audio.mjs');
const { runtime } = await import('./helpers/recording-cues-runtime-native.mjs');
const { RehearseScreen } = await import('../src/screens/RehearseScreen.tsx');
const { ThemeProvider } = await import('../src/design/theme.tsx');
const { getSavedAttempt, savedAttempts } = await import('../src/features/recording/storage.ts');
const { resolveCompare } = await import('../src/features/rehearsal/takes.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
globalThis.cancelAnimationFrame = handle => clearTimeout(handle);
let renderer, serial = 0;
const screen = active => React.createElement(ThemeProvider, null, React.createElement(RehearseScreen, { active }));
const tap = node => act(async () => node.props.onPress());
const record = () => renderer.root.findByType('record-button');
async function setup(t, slide = 1, failStart = false) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: 0 });
  resetCaptureFixture(failStart);
  const deck = { id: `synthetic-redo-${++serial}`, title: 'Synthetic Redo', uri: 'file:///synthetic.pdf', hue: 'blue', pageCount: 2,
    target: 120, targets: [60, 60], pages: [], slides: [{ title: 'One', text: '', points: [] }, { title: 'Two', text: '', points: [] }] };
  runtime.reset({ deck, n: 2, stats: null, state: { run: null, takes: 0, compare: null, discarded: [], lastFullTotal: null, baselineCoverage: null, edits: {}, fixes: 0 } }, slide);
  await act(async () => { renderer = create(screen(true)); });
}
async function countdown(t) { await act(async () => { t.mock.timers.tick(3000); }); }
async function firstTake(t) {
  captures.at(-1).uri = `file:///synthetic-first-${serial}.m4a`;
  await tap(record()); await countdown(t); assert.equal(record().props.label, 'Stop recording');
  captures.at(-1).durationMillis = 5000; await tap(record());
  assert.equal(runtime.routes.at(-1)[0], 'full');
  return savedAttempts(runtime.model.deck.id)[0];
}
async function returnFromReview(t) {
  await act(async () => renderer.update(screen(false)));
  await act(async () => { t.mock.timers.tick(0); });
  await act(async () => renderer.update(screen(true)));
}
async function confirmRedo(t) {
  await tap(record()); assert.equal(renderer.root.findByType('dialog').props.confirm, 'Redo');
  await act(async () => renderer.root.findByType('dialog').props.onConfirm()); await countdown(t);
}
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; });

test('Redo on retained rehearsal starts a new single-use engine and keeps old audio until Compare decides', async t => {
  await setup(t); const first = await firstTake(t); const original = structuredClone(first);
  await returnFromReview(t); await confirmRedo(t);
  assert.equal(record().props.label, 'Stop recording');
  assert.equal(captures.length, 2); assert.equal(captures[0].released, true); assert.equal(captures[1].isRecording, true);
  captures[1].durationMillis = 3500; await tap(record());
  const state = runtime.model.state, candidate = state.compare;
  assert.equal(runtime.routes.at(-1)[0], 'compare'); assert.ok(candidate);
  assert.notEqual(candidate.attemptId, first.id); assert.equal(getSavedAttempt(candidate.attemptId).state, 'saved');
  assert.notEqual(getSavedAttempt(candidate.attemptId).recording.audio_uri, first.recording.audio_uri);
  assert.deepEqual(getSavedAttempt(first.id), original); assert.equal(state.run.parts[1].attemptId, first.id);
  await act(async () => resolveCompare(runtime.model.deck.id, 'old'));
  assert.equal(runtime.model.state.run.parts[1].attemptId, first.id);
  assert.deepEqual(getSavedAttempt(first.id), original); assert.equal(savedAttempts(runtime.model.deck.id).length, 2);
  await returnFromReview(t); await confirmRedo(t); assert.equal(record().props.label, 'Stop recording');
  captures[2].durationMillis = 1800; await tap(record());
  assert.equal(savedAttempts(runtime.model.deck.id).length, 3);
  assert.notEqual(runtime.model.state.compare.attemptId, candidate.attemptId);
  assert.deepEqual(getSavedAttempt(first.id), original);
});

test('cancelled Redo countdown consumes no engine or attempt; the next confirmed Redo can record', async t => {
  await setup(t); const first = await firstTake(t); await returnFromReview(t);
  await tap(record()); await act(async () => renderer.root.findByType('dialog').props.onConfirm());
  await act(async () => { t.mock.timers.tick(1000); }); await tap(record());
  assert.equal(captures[1].isPrepared, false); assert.equal(savedAttempts(runtime.model.deck.id).length, 1);
  await confirmRedo(t); assert.equal(record().props.label, 'Stop recording');
  captures[1].durationMillis = 2000; await tap(record());
  assert.notEqual(runtime.model.state.compare.attemptId, first.id); assert.equal(savedAttempts(runtime.model.deck.id).length, 2);
});

test('whole-presentation Redo returns to slide one and retains the old run for Compare', async t => {
  await setup(t); const first = await firstTake(t); await returnFromReview(t);
  await act(async () => record().props.onPressIn());
  await act(async () => { t.mock.timers.tick(3000); });
  await act(async () => record().props.onPressOut()); await tap(record());
  assert.equal(renderer.root.findByType('dialog').props.confirm, 'Redo all');
  await act(async () => renderer.root.findByType('dialog').props.onConfirm()); await countdown(t);
  assert.equal(record().props.label, 'Stop recording'); captures[1].durationMillis = 2500; await tap(record());
  const candidate = runtime.model.state.compare;
  assert.equal(candidate.whole, true); assert.deepEqual(candidate.slides, [0, 1]);
  assert.equal(getSavedAttempt(candidate.attemptId).recording.slide_events[0].slide_index, 0);
  assert.equal(candidate.prev.parts[1].attemptId, first.id);
  await act(async () => resolveCompare(runtime.model.deck.id, 'new'));
  assert.equal(runtime.model.state.run.parts[0].attemptId, candidate.attemptId); assert.equal(runtime.model.state.run.parts[1], null);
  assert.equal(getSavedAttempt(first.id).state, 'saved');
});

test('a failed native start remounts before retry and retains its interrupted attempt for recovery', async t => {
  await setup(t, 0, true); await tap(record()); await countdown(t);
  assert.notEqual(record().props.label, 'Stop recording'); assert.equal(captures[0].released, true);
  const failed = savedAttempts(runtime.model.deck.id)[0]; assert.equal(failed.state, 'interrupted');
  await tap(record()); await countdown(t); assert.equal(record().props.label, 'Stop recording');
  captures[1].durationMillis = 2500; await tap(record());
  assert.equal(getSavedAttempt(failed.id).state, 'interrupted'); assert.equal(savedAttempts(runtime.model.deck.id).length, 2);
  assert.equal(runtime.model.state.takes, 1);
});

test('a failed native stop retains an interrupted take and retries with a fresh engine without replacing the old run', async t => {
  await setup(t); const first = await firstTake(t); await returnFromReview(t); await confirmRedo(t);
  captures[1].durationMillis = 2500;
  captures[1].stop = async () => { queueMicrotask(() => captures[1].emitError()); };
  await tap(record());
  assert.equal(captures[1].released, true); assert.equal(runtime.model.state.run.parts[1].attemptId, first.id);
  assert.equal(runtime.model.state.compare, null); assert.equal(runtime.model.state.takes, 1);
  const interrupted = savedAttempts(runtime.model.deck.id).find(attempt => attempt.id !== first.id);
  assert.equal(interrupted.state, 'interrupted');
  await confirmRedo(t); assert.equal(record().props.label, 'Stop recording');
  captures[2].durationMillis = 2000; await tap(record());
  assert.ok(runtime.model.state.compare); assert.equal(getSavedAttempt(interrupted.id).state, 'interrupted');
  assert.equal(getSavedAttempt(first.id).state, 'saved');
});
