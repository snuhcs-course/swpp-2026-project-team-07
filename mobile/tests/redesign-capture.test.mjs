// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: the Rehearse screen's capture engine keeps the former
// recording rules: recorder-clock slide events, durable checkpoints and a saved attempt
// that uploads and transcribes automatically. Synthetic recorder fixture (no device audio).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/recording-screen-loader.mjs';
registerHooks({ resolve, load });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { captures, resetCaptureFixture } = await import('./helpers/recording-screen-audio.mjs');
const { backgroundApp } = await import('./helpers/recording-screen-ui.mjs');
const { CaptureEngine } = await import('../src/features/rehearsal/CaptureEngine.tsx');
const { getSavedAttempt, savedAttempts } = await import('../src/features/recording/storage.ts');
const { API_URL } = await import('../src/services/api.ts');

const deck = { id: 'synthetic-capture-deck', title: 'Synthetic', uri: 'file:///synthetic.pdf', pageCount: 3 };

test('capture uses voice AAC and stops near thirty minutes instead of ten', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  resetCaptureFixture();
  const { ref, calls, renderer, recorder } = await mount();
  assert.equal(recorder.options.bitRate, 64000);
  assert.equal(recorder.options.numberOfChannels, 1);
  assert.equal(recorder.options.android.audioEncoder, 'aac');
  assert.equal(recorder.options.android.outputFormat, 'mpeg4');
  assert.equal(recorder.options.directory, 'document');
  await act(async () => { await ref.current.start(() => 0); });
  for (const duration of [599000, 600001, 1798999]) {
    recorder.durationMillis = duration;
    await act(async () => { t.mock.timers.tick(70); });
    assert.equal(calls.mustStop, 0);
  }
  recorder.durationMillis = 1799000;
  await act(async () => { t.mock.timers.tick(70); });
  assert.equal(calls.mustStop, 1);
  let take;
  await act(async () => { take = await ref.current.stop(); });
  assert.equal(take.durationMs, 1799000);
  assert.equal(getSavedAttempt(take.attemptId).recording.duration_ms, 1799000);
  await act(async () => { renderer.unmount(); });
});

async function mount(props = {}) {
  const ref = React.createRef();
  const calls = { meter: 0, mustStop: 0, interrupted: [] };
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(CaptureEngine, {
      ref, deck, onMeter: () => { calls.meter++; }, onMustStop: () => { calls.mustStop++; }, onInterrupted: m => { calls.interrupted.push(m); }, ...props,
    }));
  });
  return { ref, calls, renderer, recorder: captures[captures.length - 1] };
}

test('a finished take is saved with its slide timeline and marked for automatic transcription', async () => {
  resetCaptureFixture();
  const { ref, renderer, recorder } = await mount();
  let slide = 1;
  await act(async () => { await ref.current.start(() => slide); });
  assert.equal(ref.current.isRecording(), true);
  recorder.durationMillis = 4200;
  slide = 2;
  await act(async () => { ref.current.slideChanged(2); });
  recorder.durationMillis = 9100;
  let take;
  await act(async () => { take = await ref.current.stop(); });
  assert.equal(take.durationMs, 9100);
  assert.deepEqual(take.events, [{ slide_index: 1, at_ms: 0 }, { slide_index: 2, at_ms: 4200 }]);
  const saved = getSavedAttempt(take.attemptId);
  assert.equal(saved.state, 'saved');
  assert.equal(saved.local_deck_id, deck.id);
  assert.equal(saved.auto_process_api, API_URL);
  assert.equal(saved.recording.duration_ms, 9100);
  assert.deepEqual(saved.recording.slide_events, take.events);
  assert.equal(ref.current.isRecording(), false);
  await assert.rejects(ref.current.start(() => 0), /already started/);
  await act(async () => { renderer.unmount(); });
});

test('a failed native start leaves no running take and the next engine can record', async () => {
  resetCaptureFixture(true);
  const first = await mount();
  await act(async () => { await assert.rejects(first.ref.current.start(() => 0), /native start failed/); });
  assert.equal(first.ref.current.isRecording(), false);
  const failed = savedAttempts(deck.id).filter(a => a.error === 'native start failed');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].state, 'interrupted');
  await act(async () => { first.renderer.unmount(); });

  const second = await mount();
  await act(async () => { await second.ref.current.start(() => 0); });
  assert.equal(second.ref.current.isRecording(), true);
  await act(async () => { await second.ref.current.stop(); });
  await act(async () => { second.renderer.unmount(); });
});

test('leaving the app while recording asks the screen to stop; the meter reports while capturing', async () => {
  resetCaptureFixture();
  const { ref, calls, renderer } = await mount();
  await act(async () => { await ref.current.start(() => 0); });
  await act(async () => { await new Promise(r => setTimeout(r, 160)); });
  assert.ok(calls.meter >= 1);
  await act(async () => { backgroundApp('background'); });
  assert.equal(calls.mustStop, 1);
  backgroundApp('active');
  await act(async () => { await ref.current.stop(); });
  await act(async () => { renderer.unmount(); });
});
