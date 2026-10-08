import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranscriptionClient, TranscriptionClientError } from '../src/features/transcription/client.ts';

const id = '33333333-3333-4333-8333-333333333333';
const recording = { id, deck_id: '11111111-1111-4111-8111-111111111111',
  audio_uri: 'file:///private/example.m4a', duration_ms: 5000, audience: '',
  slide_events: [{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 2000 }, { slide_index: 0, at_ms: 4000 }] };
const result = (status = 'completed') => ({ attempt_id: id, status, duration_ms: 5000,
  processing_state: status === 'pending' ? 'queued' : status === 'processing' ? 'transcribing' : status,
  processing_revision: 1, failed_stage: status === 'failed' ? 'transcribing' : null,
  retry_available: status === 'failed', retry_at: null, requires_confirmation: false,
  partial_available: { transcript: status === 'completed', alignment: status === 'completed' },
  transcript: status === 'completed' ? { text: 'Hello', words: [{ text: 'Hello', start_ms: 0, end_ms: 1000 }] } : null,
  visits: status === 'completed' ? [{ slide_index: 0, start_ms: 0, end_ms: 5000, words: [{ text: 'Hello', start_ms: 0, end_ms: 1000 }] }] : null,
  metrics: status === 'completed' ? { duration_ms: 5000, time_per_slide: [{ slide_index: 0, duration_ms: 5000 }], detected_language: 'english', speaking_rates: [], rate_note: 'Estimate' } : null,
  analysis_outcome: status === 'completed' ? 'speech' : null, feedback_state: 'disabled',
  provenance: { provider: 'openai', model: 'whisper-1', generation: 1, outcome: 'received', speech_gate: null },
  feedback: [], error: status === 'failed' ? { code: 'provider_timeout', message: 'Try later' } : null,
  ...(status === 'pending' ? { status: 'processing' } : {}),
});
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
function setup(responses, overrides = {}) {
  const calls = [];
  const client = createTranscriptionClient({ baseUrl: 'https://example.test/api/',
    audioFile: () => new File(['synthetic'], 'example.m4a', { type: 'audio/mp4' }),
    fetch: async (url, init) => { calls.push({ url, init }); const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'Unexpected extra request'); return response; }, ...overrides });
  return { client, calls };
}
const rejects = (promise, code) => assert.rejects(promise, e =>
  e instanceof TranscriptionClientError && e.code === code && e.attemptId === id);

test('upload metadata/file then process the same ID; preserve input', async () => {
  const original = structuredClone(recording);
  const { client, calls } = setup([json({ attempt_id: id }, 201), json(result('processing'), 202)]);
  assert.deepEqual(await client.submit(recording), { attempt_id: id });
  assert.deepEqual(calls.map(c => c.url), ['https://example.test/api/attempts/', `https://example.test/api/attempts/${id}/process/`]);
  const form = calls[0].init.body;
  const { audio_uri, ...metadata } = recording;
  assert.deepEqual(JSON.parse(form.get('metadata')), metadata);
  assert.equal(form.get('audio').name, 'example.m4a');
  assert.equal(await form.get('audio').text(), 'synthetic');
  assert.equal(calls[0].init.headers, undefined);
  assert.deepEqual(recording, original);
});
test('501 never starts processing or substitutes sample data', async () => {
  const { client, calls } = setup([json({ error: { code: 'not_implemented' } }, 501)]);
  await rejects(client.submit(recording), 'not_implemented'); assert.equal(calls.length, 1);
});
test('process failure retains ID; retry only processes without reupload', async () => {
  const { client, calls } = setup([json({ attempt_id: id }, 201), json({}, 503), json(result('processing'), 202)]);
  await rejects(client.submit(recording), 'http_error'); await client.retry(id, { processing_revision: 1 });
  assert.equal(calls.filter(c => c.url.endsWith('/attempts/')).length, 1);
});
test('wrong upload/processing IDs fail', async () => {
  for (const responses of [[json({ attempt_id: 'other' }, 201)],
    [json({ attempt_id: id }, 201), json({ attempt_id: 'other' }, 202)]]) {
    await rejects(setup(responses).client.submit(recording), 'invalid_response');
  }
});
test('sequential polling ends on completion or failure', async () => {
  for (const state of ['completed', 'failed']) {
    const { client, calls } = setup([json(result('pending')), json(result('processing')), json(result(state))]);
    assert.equal((await client.waitForResult(id, { intervalMs: 0 })).status, state);
    assert.equal(calls.length, 3);
  }
});
test('poll limit does not mark server attempt failed or trigger retry', async () => {
  const { client, calls } = setup([json(result('pending')), json(result('processing'))]);
  await rejects(client.waitForResult(id, { intervalMs: 0, maxAttempts: 2 }), 'poll_limit');
  assert.equal(calls.length, 2); assert.ok(calls.every(c => c.init.method === 'GET'));
});
test('malformed JSON and invalid results fail safely', async () => {
  const invalid = [null, [], { ...result(), attempt_id: 'wrong' }, { ...result(), status: 'unknown' },
    { ...result(), status: ['completed'], transcript: null },
    { ...result(), transcript: null }, { ...result(), transcript: { text: 'bad', words: [{ text: 'bad', start_ms: -1, end_ms: 2 }] } },
    { ...result('failed'), error: null }, { ...result(), feedback: [{}] }];
  for (const payload of invalid) await rejects(setup([json(payload)]).client.getResult(id), 'invalid_response');
  await rejects(setup([new Response('not json')]).client.getResult(id), 'invalid_response');
});
test('network failure is safe and does not retry', async () => {
  const { client, calls } = setup([new Error('private network details')]);
  await rejects(client.getResult(id), 'network_error'); assert.equal(calls.length, 1);
});
test('pre-cancelled operation performs no upload', async () => {
  const { client, calls } = setup([]);
  const controller = new AbortController(); controller.abort();
  await rejects(client.submit(recording, { signal: controller.signal }), 'cancelled');
  assert.equal(calls.length, 0);
});
test('request timeout aborts transport', async () => {
  const { client } = setup([], { timeoutMs: 5, fetch: (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) });
  await rejects(client.getResult(id), 'timeout');
});
test('cancellation during polling sleep stops further requests', async () => {
  const controller = new AbortController();
  const { client, calls } = setup([json(result('pending'))]);
  const pending = client.waitForResult(id, { intervalMs: 1000, signal: controller.signal });
  setTimeout(() => controller.abort(), 5);
  await rejects(pending, 'cancelled'); assert.equal(calls.length, 1);
});
test('invalid metadata is rejected before network', async () => {
  for (const update of [{ duration_ms: 0 }, { audio_uri: 'https://example.test/secret' },
    { slide_events: [] }, { slide_events: [{ slide_index: 0, at_ms: 1 }] },
    { slide_events: [...recording.slide_events, { slide_index: 2, at_ms: 3000 }] },
    { slide_events: [{ slide_index: -1, at_ms: 0 }] }]) {
    const { client, calls } = setup([]);
    await rejects(client.submit({ ...recording, ...update }), 'invalid_recording'); assert.equal(calls.length, 0);
  }
});
test('unavailable, empty, oversize, or unsupported local audio is rejected', async () => {
  for (const [audioFile, code] of [
    [() => { throw new Error('private path'); }, 'audio_unavailable'],
    [() => new File([], 'empty.m4a'), 'invalid_audio_size'],
    [() => ({ size: 25_000_001, name: 'big.m4a' }), 'invalid_audio_size'],
    [() => new File(['x'], 'unknown.bin'), 'unsupported_audio']]) {
    await rejects(setup([], { audioFile }).client.submit(recording), code);
  }
});
test('cancellation during an active request aborts transport', async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const { client } = setup([], { fetch: (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    started();
  }) });
  const pending = client.getResult(id, { signal: controller.signal });
  await ready;
  controller.abort();
  await rejects(pending, 'cancelled');
});
test('cancellation after upload response prevents processing and preserves ID', async () => {
  const controller = new AbortController();
  const response = json({ attempt_id: id }, 201);
  response.json = async () => { controller.abort(); return { attempt_id: id }; };
  const { client, calls } = setup([response]);
  await rejects(client.submit(recording, { signal: controller.signal }), 'cancelled');
  assert.equal(calls.length, 1);
  assert.equal(recording.id, id);
});


test('upload alone is durable success without a processing request', async () => {
  const { client, calls } = setup([json({ attempt_id: id, status: 'pending' }, 201)]);
  assert.deepEqual(await client.upload(recording), { attempt_id: id });
  assert.deepEqual(calls.map(c => c.url), ['https://example.test/api/attempts/']);
});
test('25,000,000-byte limit is decimal and exact, including legacy files', async () => {
  const { client, calls } = setup([json({ attempt_id: id }, 201)], { audioFile: () => {
    const file = new File(['audio'], 'pilot.m4a'); Object.defineProperty(file, 'size', {value:25_000_000}); return file;
  } });
  await client.upload(recording); assert.equal(calls.length, 1);
  const rejected = setup([], {audioFile: () => ({size:25_000_001, name:'legacy.m4a'})});
  await rejects(rejected.client.upload(recording), 'invalid_audio_size'); assert.equal(rejected.calls.length, 0);
});

test('processing validates stages and accepts completed 200 with revision-aware retry', async () => {
  const complete = { ...result(), processing_state: 'completed', processing_revision: 3,
    failed_stage: null, retry_available: false, retry_at: null, requires_confirmation: false,
    partial_available: { transcript: true, alignment: true }, visits: [{ slide_index: 0, start_ms: 0, end_ms: 5000, words: result().transcript.words }],
    duration_ms: 5000, metrics: { duration_ms: 5000, time_per_slide: [{ slide_index: 0, duration_ms: 5000 }], detected_language: 'english', speaking_rates: [], rate_note: 'Estimate' },
    feedback_state: 'disabled', analysis_outcome: 'speech', provenance: { provider: 'openai', model: 'whisper-1', generation: 3, outcome: 'received', speech_gate: 'silero-vad' } };
  const { client, calls } = setup([json(complete)]);
  assert.deepEqual(await client.process(id, { processing_revision: 2, acknowledge_uncertain: true }), complete);
  assert.deepEqual(JSON.parse(calls[0].init.body), { processing_revision: 2, acknowledge_uncertain: true });
  for (const update of [{ processing_revision: '3' }, { processing_state: 'imaginary' }, { visits: [{ slide_index: -1 }] }, { metrics: { duration_ms: 'bad' } }]) {
    await rejects(setup([json({ ...complete, ...update })]).client.getResult(id), 'invalid_response');
  }
});

test('no-speech completion accepts empty-word visits and timing metrics without provider provenance', async () => {
  const silent = { ...result(), analysis_outcome: 'no_speech', transcript: { text: '', words: [] },
    slide_events: [{ slide_index: 1, at_ms: 0 }, { slide_index: 0, at_ms: 0 },
      { slide_index: 0, at_ms: 2000 }, { slide_index: 1, at_ms: 4000 }],
    visits: [{ slide_index: 1, start_ms: 0, end_ms: 0, words: [] },
      { slide_index: 0, start_ms: 0, end_ms: 2000, words: [] },
      { slide_index: 0, start_ms: 2000, end_ms: 4000, words: [] },
      { slide_index: 1, start_ms: 4000, end_ms: 5000, words: [] }],
    metrics: { ...result().metrics, detected_language: 'und', time_per_slide: [
      { slide_index: 0, duration_ms: 4000 }, { slide_index: 1, duration_ms: 1000 }] },
    provenance: { provider: null, model: null, generation: null, outcome: null, speech_gate: 'silero-vad' } };
  const { client, calls } = setup([json(silent), json(silent)]);
  assert.deepEqual(await client.getResult(id), silent);
  assert.deepEqual(await client.process(id), silent);
  assert.equal(calls.length, 2);
  for (const update of [
    { visits: [], metrics: {} },
    { metrics: { ...silent.metrics, duration_ms: 6000 } },
    { transcript: result().transcript },
    { visits: [{ slide_index: 0, start_ms: 0, end_ms: 5000, words: result().transcript.words }] },
  ]) {
    await rejects(setup([json({ ...silent, ...update })]).client.getResult(id), 'invalid_response');
  }
});
