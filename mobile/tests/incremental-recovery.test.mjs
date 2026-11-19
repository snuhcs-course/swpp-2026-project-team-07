import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./helpers/incremental-loader.mjs', import.meta.url);
const { recoverCapture } = await import('../src/features/recording/captureRecovery.ts');
const { registerCapture, readCapture, updateCapture } = await import('../src/features/recording/incrementalState.ts');
const { getSavedAttempt, saveAttempt } = await import('../src/features/recording/storage.ts');
let serial = 0;
const manifest = (stopped = true) => ({ manifest_uri: 'file:///capture.properties', full_uri: 'file:///full.wav', duration_ms: 4000,
  slide_events: [{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 2000 }, { slide_index: 0, at_ms: 4000 }],
  segments: [{ sequence: 0, slide_index: 0, start_ms: 0, end_ms: 2000, uri: 'file:///s0.wav' },
    { sequence: 1, slide_index: 1, start_ms: 2000, end_ms: 4000, uri: 'file:///s1.wav' }],
  stopped, isRecording: !stopped, current_slide: 0, metering: -30 });
function setup(m, state = 'capturing') {
  const id = `recover-${++serial}`;
  saveAttempt({ id, local_deck_id: 'deck', title: 'Recovery', pdf_uri: 'file:///slides.pdf', page_count: 2, created_at: '', state,
    recording: { id, audience: '', audio_uri: m.full_uri, duration_ms: 3000, slide_events: m.slide_events.slice(0, 2) } });
  registerCapture(id, 'https://server.example/api', m);
  return id;
}
afterEach(() => { delete globalThis.captureRecorder; });

test('stopped journal reconciles metadata after a crash between the two Stop writes', () => {
  const id = setup(manifest());
  recoverCapture(id);
  const saved = getSavedAttempt(id);
  assert.equal(saved.recording.duration_ms, 4000);
  assert.equal(saved.state, 'interrupted');
  assert.deepEqual(saved.recording.slide_events, manifest().slide_events.slice(0, 2));
  assert.deepEqual(readCapture(id).manifest.slide_events, manifest().slide_events);
  assert.match(saved.error, /recovered/i);
});

test('a submitted stopped take retains its submitted state while metadata is reconciled', () => {
  const id = setup(manifest(), 'submitted');
  recoverCapture(id);
  assert.equal(getSavedAttempt(id).state, 'submitted');
  assert.equal(getSavedAttempt(id).recording.duration_ms, 4000);
});

test('stopped error journals retry native repair and keep uploaded segment identities', () => {
  const m = { ...manifest(), error: 'Header failed' }, id = setup(m, 'interrupted');
  updateCapture(id, { uploaded: [0] });
  let calls = 0;
  globalThis.captureRecorder = { status: () => { throw Error('No session'); }, recover: uri => { calls++; assert.equal(uri, m.manifest_uri); return manifest(); } };
  recoverCapture(id);
  assert.equal(calls, 1);
  assert.equal(readCapture(id).manifest.error, undefined);
  assert.deepEqual(readCapture(id).uploaded, [0]);
  assert.equal(getSavedAttempt(id).recording.duration_ms, 4000);
});

test('an active microphone is left recording and its checkpoint is unchanged', () => {
  const m = manifest(false), id = setup(m);
  globalThis.captureRecorder = { status: () => m, recover: () => { throw Error('Must not recover a live session'); } };
  recoverCapture(id);
  assert.deepEqual(readCapture(id).manifest, m);
  assert.equal(getSavedAttempt(id).state, 'capturing');
});

test('failed recovery leaves visible retryable error and can recover later without losing audio', () => {
  const m = manifest(false), id = setup(m);
  globalThis.captureRecorder = { status: () => { throw Error('No session'); }, recover: () => { throw Error('Journal not accessible'); } };
  assert.throws(() => recoverCapture(id), /not accessible/);
  assert.match(readCapture(id).error, /Recording recovery failed/);
  assert.equal(readCapture(id).retryAt, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(readCapture(id).manifest, m);
  globalThis.captureRecorder.recover = () => manifest();
  recoverCapture(id);
  assert.equal(readCapture(id).error, undefined);
  assert.equal(readCapture(id).retryAt, undefined);
  assert.equal(getSavedAttempt(id).recording.audio_uri, m.full_uri);
});
