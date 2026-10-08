import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve } from './helpers/upload-loader.mjs';
import { files, network, response } from './helpers/upload-native.mjs';
import { sqliteFaults } from './helpers/sqlite-node.mjs';
registerHooks({ resolve });
const { API_URL } = await import('../src/services/api.ts');
const { uploadAttempt, isUploading, serverDeckId } = await import('../src/features/recording/upload.ts');
const { beginAttempt, checkpointAttempt, getSavedAttempt, saveAttempt } = await import('../src/features/recording/storage.ts');
const { writeStored } = await import('../src/services/storage.ts');
const DECK = '11111111-1111-4111-8111-111111111111';
let serial = 0;
function setup() {
  const localId = `synthetic-${++serial}`;
  const id = beginAttempt({ id: localId, title: 'Synthetic slides', uri: 'file:///synthetic.pdf', pageCount: 2 }, '', 1, 'file:///synthetic.wav');
  checkpointAttempt(id, 'file:///synthetic.wav', 2000, [{ slide_index: 1, at_ms: 0 }, { slide_index: 0, at_ms: 700 }, { slide_index: 1, at_ms: 1300 }], true);
  return { id, localId, key: `server-deck:${API_URL}:${localId}` };
}
function success(url, init) {
  if (url.endsWith('/decks/') && init.method === 'POST') return response(201, { deck: { id: DECK, page_count: 2 }, slides: [] });
  if (url.endsWith(`/decks/${DECK}/`)) return response(200, { id: DECK, page_count: 2, slides: [] });
  if (url.endsWith('/attempts/')) return response(201, { attempt_id: JSON.parse(init.body.get('metadata')).id });
  throw new Error(`Unexpected endpoint ${url}`);
}
const audioRequests = () => network.requests.filter(r => r.url.endsWith('/attempts/'));
const pdfRequests = () => network.requests.filter(r => r.url.endsWith('/decks/') && r.method === 'POST');
beforeEach(() => {
  sqliteFaults.before = null;
  files.clear(); files.set('file:///synthetic.pdf', {}); files.set('file:///synthetic.wav', {});
  network.requests.length = 0; network.respond = success;
});

test('lost audio acknowledgement retries the exact UUID/audio/visits and reuses the persisted PDF mapping', async () => {
  const { id, localId } = setup();
  let fail = true;
  network.respond = (url, init) => { if (url.endsWith('/attempts/') && fail) { fail = false; throw new Error('ack lost'); } return success(url, init); };
  await assert.rejects(uploadAttempt(id));
  assert.equal(getSavedAttempt(id).state, 'upload_failed');
  assert.equal(serverDeckId(localId), DECK);
  await uploadAttempt(id);
  assert.equal(getSavedAttempt(id).state, 'submitted');
  assert.equal(pdfRequests().length, 1);
  assert.equal(audioRequests()[0].body.get('metadata'), audioRequests()[1].body.get('metadata'));
  assert.equal(await audioRequests()[0].body.get('audio').text(), await audioRequests()[1].body.get('audio').text());
  assert.equal(network.requests.some(r => r.url.includes('/process/')), false);
});

test('PDF failure never submits audio and can retry without replacing the attempt', async () => {
  const { id } = setup();
  network.respond = () => response(503, {});
  await assert.rejects(uploadAttempt(id));
  assert.equal(audioRequests().length, 0);
  assert.equal(isUploading(id), false);
  network.respond = success;
  await uploadAttempt(id);
  assert.equal(getSavedAttempt(id).recording.id, id);
});

test('missing or malformed cached deck mappings are repaired before audio upload', async () => {
  for (const cached of ['local-key', '22222222-2222-4222-8222-222222222222']) {
    const { id, key, localId } = setup();
    writeStored(key, cached);
    network.respond = (url, init) => url.endsWith(`/decks/${cached}/`) ? response(404, {}) : success(url, init);
    await uploadAttempt(id);
    assert.equal(serverDeckId(localId), DECK);
    assert.equal(JSON.parse(audioRequests().at(-1).body.get('metadata')).deck_id, DECK);
  }
});

test('transient deck lookup failure retains mapping and prevents speculative uploads', async () => {
  const { id, key, localId } = setup();
  writeStored(key, DECK);
  network.respond = () => response(503, {});
  await assert.rejects(uploadAttempt(id));
  assert.equal(serverDeckId(localId), DECK);
  assert.equal(pdfRequests().length, 0);
  assert.equal(audioRequests().length, 0);
  network.respond = success;
  await uploadAttempt(id);
});

test('mismatched cached deck identity or page count never reaches audio upload', async () => {
  for (const value of [{ id: '22222222-2222-4222-8222-222222222222', page_count: 2 }, { id: DECK, page_count: 3 }, null]) {
    const { id, key } = setup();
    writeStored(key, DECK);
    network.respond = () => response(200, value);
    await assert.rejects(uploadAttempt(id));
    assert.equal(audioRequests().length, 0);
  }
});

test('malformed deck responses retain local audio and never submit it', async () => {
  for (const data of [null, {}, { deck: { id: 'local', page_count: 2 } }, { deck: { id: DECK, page_count: 10 } }]) {
    const { id } = setup();
    network.respond = () => response(201, data);
    await assert.rejects(uploadAttempt(id));
    assert.equal(getSavedAttempt(id).recording.audio_uri, 'file:///synthetic.wav');
    assert.equal(audioRequests().length, 0);
  }
});

test('conflicting or malformed audio acknowledgements cannot mark success or allocate a new UUID', async () => {
  for (const reply of [response(409, {}), response(201, { attempt_id: DECK }), response(201, null)]) {
    const { id } = setup();
    network.respond = (url, init) => url.endsWith('/attempts/') ? reply : success(url, init);
    await assert.rejects(uploadAttempt(id));
    assert.equal(getSavedAttempt(id).state, 'upload_failed');
    assert.equal(getSavedAttempt(id).id, id);
  }
});

test('same-attempt concurrent calls share a request; different attempts share deck upload', async () => {
  const first = setup(), second = setup();
  saveAttempt({ ...getSavedAttempt(second.id), local_deck_id: first.localId });
  const one = uploadAttempt(first.id), two = uploadAttempt(first.id);
  assert.equal(one, two);
  await Promise.all([one, uploadAttempt(second.id)]);
  assert.equal(pdfRequests().length, 1);
  assert.equal(audioRequests().length, 2);
});

test('mapping persistence failure stops before audio; retry recovers the acknowledged deck', async () => {
  const { id, key } = setup();
  sqliteFaults.before = (op, sql, args) => { if (op === 'run' && args[0] === key) throw new Error('mapping disk full'); };
  await assert.rejects(uploadAttempt(id), /mapping disk full/);
  assert.equal(audioRequests().length, 0);
  sqliteFaults.before = null;
  await uploadAttempt(id);
  assert.equal(getSavedAttempt(id).state, 'submitted');
});

test('repeated local writes failing after server acknowledgement preserve a retryable UUID and exact payload', async () => {
  const { id } = setup();
  network.respond = (url, init) => {
    const reply = success(url, init);
    if (url.endsWith('/attempts/')) sqliteFaults.before = op => { if (op === 'run') throw new Error('disk full after ack'); };
    return reply;
  };
  await assert.rejects(uploadAttempt(id), /disk full after ack/);
  assert.equal(isUploading(id), false);
  assert.equal(getSavedAttempt(id).state, 'uploading');
  sqliteFaults.before = null; network.respond = success;
  await uploadAttempt(id);
  assert.equal(getSavedAttempt(id).state, 'submitted');
  assert.equal(audioRequests()[0].body.get('metadata'), audioRequests()[1].body.get('metadata'));
});

test('legacy oversized audio stays local, makes no network request and suggests a shorter new recording', async () => {
  const { id } = setup();
  files.set('file:///synthetic.wav', { size: 25_000_001 });
  await assert.rejects(uploadAttempt(id), /shorter.*recording/i);
  assert.equal(network.requests.length, 0);
  assert.equal(getSavedAttempt(id).recording.audio_uri, 'file:///synthetic.wav');
  files.set('file:///synthetic.wav', { size: 25_000_000 });
  await uploadAttempt(id);
  assert.equal(getSavedAttempt(id).state, 'submitted');
});

test('submitted on another server resolves a new mapping and uploads with the same attempt identity', async () => {
  const { id } = setup();
  saveAttempt({ ...getSavedAttempt(id), state: 'submitted', server_url: 'http://old.invalid/api', recording: { ...getSavedAttempt(id).recording, deck_id: '22222222-2222-4222-8222-222222222222' } });
  await uploadAttempt(id);
  assert.equal(getSavedAttempt(id).server_url, API_URL);
  assert.equal(JSON.parse(audioRequests()[0].body.get('metadata')).id, id);
  await uploadAttempt(id);
  assert.equal(audioRequests().length, 1);
});

test('failed status persistence cannot hide the original upload conflict', async () => {
  const { id } = setup();
  network.respond = (url, init) => {
    if (url.endsWith('/attempts/')) {
      sqliteFaults.before = op => { if (op === 'run') throw new Error('disk full'); };
      return response(409, {});
    }
    return success(url, init);
  };
  try { await assert.rejects(uploadAttempt(id), /HTTP 409/); }
  finally { sqliteFaults.before = null; }
});

test('audio timeout aborts transport and a later retry retains exactly the submitted metadata', async t => {
  const { id } = setup();
  let started;
  const waiting = new Promise(resolve => { started = resolve; });
  network.respond = (url, init) => {
    if (!url.endsWith('/attempts/')) return success(url, init);
    started();
    return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = uploadAttempt(id);
  await waiting;
  t.mock.timers.tick(60_001);
  await assert.rejects(pending, /timed out/);
  t.mock.timers.reset();
  assert.equal(audioRequests()[0].signal.aborted, true);
  network.respond = success;
  await uploadAttempt(id);
  assert.equal(audioRequests()[0].body.get('metadata'), audioRequests()[1].body.get('metadata'));
});
