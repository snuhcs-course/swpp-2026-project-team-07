import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Module from 'node:module';
import { resolve } from './helpers/expo-audio-loader.mjs';

if (Module.registerHooks) Module.registerHooks({ resolve });
else Module.register('./helpers/expo-audio-loader.mjs', import.meta.url);
const { AudioModule } = await import('expo-audio');
const { createRecordingService } = await import('../src/features/recording/service.ts');

function capture() {
  const recorder = {
    isRecording: false, durationMillis: 0, prepared: false,
    async prepareToRecordAsync() { this.prepared = true; },
    record() { this.isRecording = true; this.durationMillis = 0; },
    getStatus() { return { durationMillis: this.durationMillis }; },
  };
  return { recorder, service: createRecordingService(recorder) };
}

test('native audio time retains initial, forward, backward and simultaneous visits', async () => {
  const { recorder, service } = capture();
  await service.start(2);
  recorder.durationMillis = 1200.9;
  service.onSlideChanged(3);
  recorder.durationMillis = 2300.4;
  service.onSlideChanged(2);
  service.onSlideChanged(1);
  assert.deepEqual(service.getSlideEvents(3000), [
    { slide_index: 2, at_ms: 0 },
    { slide_index: 3, at_ms: 1200 },
    { slide_index: 2, at_ms: 2300 },
    { slide_index: 1, at_ms: 2300 },
  ]);
});

test('events at the exact capture end are excluded, earlier visits remain', async () => {
  const { recorder, service } = capture();
  await service.start(0);
  recorder.durationMillis = 999;
  service.onSlideChanged(1);
  recorder.durationMillis = 1000;
  service.onSlideChanged(2);
  assert.deepEqual(service.getSlideEvents(1000), [
    { slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 999 },
  ]);
});

test('inactive navigation is ignored and a new recording resets previous visits', async () => {
  const { recorder, service } = capture();
  service.onSlideChanged(2);
  assert.deepEqual(service.getSlideEvents(), []);
  await service.start(0);
  recorder.durationMillis = 400;
  service.onSlideChanged(1);
  recorder.isRecording = false;
  service.onSlideChanged(2);
  assert.equal(service.getSlideEvents().length, 2);
  await service.start(2);
  assert.deepEqual(service.getSlideEvents(), [{ slide_index: 2, at_ms: 0 }]);
});

test('permission denial prevents capture preparation and does not create a timeline', async () => {
  const original = AudioModule.requestRecordingPermissionsAsync;
  AudioModule.requestRecordingPermissionsAsync = async () => ({ granted: false });
  try {
    const { recorder, service } = capture();
    await assert.rejects(service.start(1), /permission was denied/);
    assert.equal(recorder.prepared, false);
    assert.equal(recorder.isRecording, false);
    assert.deepEqual(service.getSlideEvents(), []);
  } finally {
    AudioModule.requestRecordingPermissionsAsync = original;
  }
});
