import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopCapture } from '../src/features/recording/stopCapture.ts';
function withNativeCompletion(recorder, completion = {}) {
  const listeners = new Set();
  const originalStop = recorder.stop;
  return Object.assign(recorder, {
    addListener(_event, callback) { listeners.add(callback); return { remove() { listeners.delete(callback); } }; },
    async stop() {
      await originalStop.call(this);
      setImmediate(() => { for (const callback of listeners) callback({ isFinished: true, hasError: false, url: this.uri, ...completion }); });
    },
  });
}


test('stopping retains the audio duration when Android resets native status', async () => {
  const calls = [];
  let duration = 2400;
  const recorder = {
    isRecording: true, uri: 'file:///recording.m4a',
    pause() { calls.push('pause'); duration = 2450; },
    getStatus() { return { durationMillis: duration }; },
    async stop() { calls.push('stop'); duration = 0; },
  };
  assert.deepEqual(await stopCapture(withNativeCompletion(recorder)), { uri: recorder.uri, durationMillis: 2450 });
  assert.deepEqual(calls, ['pause', 'stop']);
});

test('failed native stop propagates instead of returning saved audio', async () => {
  await assert.rejects(stopCapture(withNativeCompletion({ isRecording: true, uri: 'file:///bad.m4a',
    pause() {}, getStatus() { return { durationMillis: 10 }; },
    async stop() { throw Error('native stop failed'); },
  })), /native stop failed/);
});

for (const duration of [0, NaN, Infinity]) {
  test(`quick or invalid stop duration ${duration} is not reported as a saved recording`, async () => {
    await assert.rejects(stopCapture(withNativeCompletion({ isRecording: true, uri: 'file:///empty.m4a',
      pause() {}, getStatus() { return { durationMillis: duration }; }, async stop() {},
    })), /could not be saved/);
  });
}

test('a resolved native stop still waits for and rejects the asynchronous error event', async () => {
  const recorder = withNativeCompletion({ isRecording: true, uri: 'file:///failed.m4a',
    pause() {}, getStatus() { return { durationMillis: 25 }; }, async stop() {},
  }, { hasError: true, url: null });
  await assert.rejects(stopCapture(recorder), /could not be saved/);
});


for (const hangs of [false, true]) {
  test(`missing native completion times out and removes its listener (stop hangs: ${hangs})`, { timeout: 1000 }, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let removed = false;
    const pending = stopCapture({ isRecording: true, pause() {},
      getStatus() { return { durationMillis: 300 }; },
      stop() { return hangs ? new Promise(() => {}) : Promise.resolve(); },
      addListener() { return { remove() { removed = true; } }; },
    });
    const rejected = assert.rejects(pending, /could not be saved/);
    t.mock.timers.tick(5000);
    await rejected;
    assert.equal(removed, true);
  });
}
