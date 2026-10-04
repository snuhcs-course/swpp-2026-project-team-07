import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranscriptionClient, TranscriptionClientError } from '../src/features/transcription/client.ts';

const id = '33333333-3333-4333-8333-333333333333';
const recording = { id, deck_id: '11111111-1111-4111-8111-111111111111',
  audio_uri: 'file:///private/example.m4a', duration_ms: 5000, audience: '',
  slide_events: [{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 2000 }, { slide_index: 0, at_ms: 4000 }] };
const result = (status = 'completed') => ({ attempt_id: id, status,
  transcript: status === 'completed' ? { text: 'Hello', words: [{ text: 'Hello', start_ms: 0, end_ms: 1000 }] } : null,
  feedback: [], error: status === 'failed' ? { code: 'provider_timeout', message: 'Try later' } : null });
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
  const { client, calls } = setup([json({ attempt_id: id }, 201), json({ attempt_id: id }, 202)]);
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
  const { client, calls } = setup([json({ attempt_id: id }, 201), json({}, 503), json({ attempt_id: id }, 202)]);
  await rejects(client.submit(recording), 'http_error'); await client.retry(id);
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
    [() => ({ size: 25 * 1024 * 1024 + 1, name: 'big.m4a' }), 'invalid_audio_size'],
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

test('partial transcript and quota progress are read without processing calls', async () => {
  const partial = { ...result(), status: 'processing', stages: { transcription: 'complete', feedback: 'waiting_quota' }, error: { code: 'waiting_quota', message: 'Waiting for AI quota.' }, visits: [{ slide_index: 0, start_ms: 0, end_ms: 5000, words: result().transcript.words }] };
  const { client, calls } = setup([json(partial)]);
  assert.deepEqual(await client.getResult(id), partial);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, 'GET');
});

test('malformed visit and metric arrays are rejected before rendering', async () => {
  for (const extra of [{ visits: 'bad' }, { stages: { transcription: 3 } }, { metrics: { time_per_slide: [] } }]) {
    const { client } = setup([json({ ...result(), ...extra })]);
    await rejects(client.getResult(id), 'invalid_response');
  }
});
