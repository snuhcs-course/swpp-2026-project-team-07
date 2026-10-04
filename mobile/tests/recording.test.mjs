import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopCapture } from '../src/features/recording/stopCapture.ts';

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
