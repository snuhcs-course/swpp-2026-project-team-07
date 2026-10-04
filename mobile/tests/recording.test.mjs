import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopCapture } from '../src/features/recording/stopCapture.ts';
import { finalizeOnce } from '../src/features/recording/finalizeOnce.ts';

test('native completion without an await releases Stop for the next recording', async () => {
  const pending = { current: null };
  const calls = [];
  await finalizeOnce(pending, () => { calls.push('native finished'); });
  assert.equal(pending.current, null);
  await finalizeOnce(pending, async () => { calls.push('second recording stopped'); });
  assert.deepEqual(calls, ['native finished', 'second recording stopped']);
  assert.equal(pending.current, null);
});

test('concurrent Stop and native completion save once, and failures release the lock', async () => {
  const pending = { current: null };
  let release;
  const stopped = new Promise(resolve => { release = resolve; });
  let calls = 0;
  const first = finalizeOnce(pending, async () => { calls++; await stopped; });
  assert.equal(finalizeOnce(pending, () => { calls++; }), first);
  release(); await first;
  assert.equal(calls, 1);
  await assert.rejects(finalizeOnce(pending, () => { throw Error('save failed'); }), /save failed/);
  assert.equal(pending.current, null);
});

test('stopping retains the audio duration when Android resets native status', async () => {
  const calls = [];
  let duration = 2400;
  const recorder = {
    isRecording: true, uri: 'file:///recording.m4a',
    pause() { calls.push('pause'); duration = 2450; },
    getStatus() { return { durationMillis: duration }; },
    async stop() { calls.push('stop'); duration = 0; },
  };
  assert.deepEqual(await stopCapture(recorder), { uri: recorder.uri, durationMillis: 2450 });
  assert.deepEqual(calls, ['pause', 'stop']);
});

test('failed native stop propagates instead of returning saved audio', async () => {
  await assert.rejects(stopCapture({ isRecording: true, uri: 'file:///bad.m4a',
    pause() {}, getStatus() { return { durationMillis: 10 }; },
    async stop() { throw Error('native stop failed'); },
  }), /native stop failed/);
});

import { recoverRecording } from '../src/features/recording/recovery.ts';

test('recovery keeps ID/audio/audience and backward visits, using media duration', () => {
  const recording = { id: 'stable-id', deck_id: 'deck', audio_uri: 'file:///speech.m4a', audience: 'students', duration_ms: 1700,
    slide_events: [{ slide_index: 2, at_ms: 0 }, { slide_index: 0, at_ms: 1000 }, { slide_index: 2, at_ms: 1900 }] };
  const result = recoverRecording(recording, 1900);
  assert.equal(result.id, recording.id);
  assert.equal(result.audio_uri, recording.audio_uri);
  assert.equal(result.duration_ms, 1900);
  assert.deepEqual(result.slide_events, recording.slide_events.slice(0, 2));
  assert.equal(recording.duration_ms, 1700);
});

test('recovery refuses missing audio duration and caps only codec tail', () => {
  const recording = { slide_events: [{ slide_index: 0, at_ms: 0 }] };
  for (const duration of [0, NaN, 601001]) assert.throws(() => recoverRecording(recording, duration));
  assert.equal(recoverRecording(recording, 600800).duration_ms, 600000);
});

test('stop can retain a checkpoint after native interruption reset', async () => {
  const recorder = { isRecording: false, pause() {}, async stop() {}, getStatus: () => ({ durationMillis: 0 }), uri: 'file:///saved.m4a' };
  assert.deepEqual(await stopCapture(recorder, 5120), { uri: 'file:///saved.m4a', durationMillis: 5120 });
});
