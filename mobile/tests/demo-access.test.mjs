// Synthetic codes and transports only; no production credentials or network calls.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDemoAccess, credentialKey, DemoAccessError } from '../src/services/demoAccess.ts';

const api = 'https://demo.example.test/api';
const origin = new URL(api).origin;
const key = credentialKey(origin);
function fixture(saved = null, overrides = {}) {
  const values = new Map(saved ? [[key, saved]] : []), operations = [];
  const store = {
    read: async k => values.get(k) ?? null,
    write: async (k, value) => { operations.push('write'); values.set(k, value); },
    remove: async k => { operations.push('remove'); values.delete(k); },
    ...overrides,
  };
  return { access: createDemoAccess(api, true, store), values, operations, store };
}
const healthy = () => Response.json({ service: 'outloud-api' });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('native credential encoding works without the browser btoa global', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'btoa');
  Object.defineProperty(globalThis, 'btoa', { configurable: true, writable: true, value: undefined });
  try {
    const { access } = fixture();
    const authorization = `Basic ${Buffer.from('reviewer:synthetic-native~0123', 'ascii').toString('base64')}`;
    let calls = 0;
    const transport = async (_url, init) => {
      calls++; assert.equal(init.headers.get('Authorization'), authorization); return healthy();
    };
    await access.verifyCode('synthetic-native~0123', transport);
    await access.request(`${origin}/media/audio.wav`, undefined, transport);
    assert.equal(calls, 2);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'btoa', descriptor);
    else delete globalThis.btoa;
  }
});

test('missing code blocks API and media before transport; wrong code is never persisted', async () => {
  const { access, values, operations } = fixture();
  let calls = 0;
  const transport = async () => { calls++; return new Response('', { status: 401 }); };
  for (const url of [`${api}/decks/`, `${origin}/media/audio.wav`]) {
    await assert.rejects(access.request(url, undefined, transport), DemoAccessError);
  }
  assert.equal(calls, 0);
  await assert.rejects(access.verifyCode('synthetic-wrong', transport), /did not work/);
  assert.equal(calls, 1); assert.equal(values.size, 0); assert.deepEqual(operations, []);
  assert.equal(access.getSnapshot().state, 'locked');
});

test('a verified code is stored only under the bound HTTPS origin and restored offline', async () => {
  const { access, store, values } = fixture();
  const calls = [];
  await access.verifyCode('synthetic-code', async (url, init) => { calls.push({ url, init }); return healthy(); });
  assert.equal(calls[0].url, `${api}/health/`);
  assert.equal(calls[0].init.headers.get('Authorization'), `Basic ${btoa('reviewer:synthetic-code')}`);
  assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(values.get(key), 'synthetic-code');
  assert.match(key, /^[\w.-]+$/);
  const restored = createDemoAccess(api, true, store);
  await restored.initialize();
  assert.deepEqual(restored.getSnapshot(), { state: 'ready', unlockedOnce: true, notice: '' });
  let networkCalls = 0;
  await assert.rejects(restored.request(`${api}/decks/`, undefined, async () => { networkCalls++; throw Error('synthetic offline'); }));
  assert.equal(networkCalls, 1); assert.equal(restored.getSnapshot().state, 'ready');
  assert.equal(values.get(key), 'synthetic-code');
  const anotherOrigin = createDemoAccess('https://another.example.test/api', true, store);
  await anotherOrigin.initialize();
  assert.equal(anotherOrigin.getSnapshot().state, 'locked');
  assert.notEqual(credentialKey('https://example.test:8443'), credentialKey('https://example.test'));
  assert.notEqual(credentialKey('http://example.test'), credentialKey('https://example.test'));
});

test('API, multipart upload and media share explicit authorization with redirects and cookies disabled', async () => {
  const { access } = fixture('synthetic-code');
  const calls = [];
  const transport = async (url, init) => { calls.push({ url, init }); return healthy(); };
  const body = new FormData(); body.set('metadata', 'synthetic');
  await access.request(`${api}/attempts/`, { method: 'POST', body, headers: { 'X-Synthetic': 'kept' }, redirect: 'follow', credentials: 'include' }, transport);
  await access.request(`${origin}/media/audio.wav`, { method: 'GET', credentials: 'omit' }, transport);
  assert.equal(calls[0].init.body, body);
  assert.equal(calls[0].init.headers.get('X-Synthetic'), 'kept');
  for (const { init } of calls) {
    assert.equal(init.headers.get('Authorization'), `Basic ${btoa('reviewer:synthetic-code')}`);
    assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
  }
});

test('different host, scheme, port and URL credentials never receive the code', async () => {
  const { access } = fixture('synthetic-code');
  let calls = 0;
  for (const url of ['https://foreign.test/media/audio.wav', 'http://demo.example.test/api/decks/',
    'https://demo.example.test:8443/api/decks/', 'https://reviewer:synthetic@demo.example.test/api/decks/']) {
    await assert.rejects(access.request(url, undefined, async () => { calls++; return healthy(); }), DemoAccessError);
  }
  assert.equal(calls, 0);
  assert.equal(access.getSnapshot().state, 'loading');
  await access.initialize(); assert.equal(access.getSnapshot().state, 'ready');
});

test('redirected or foreign final responses are rejected without accepting their data', async () => {
  const { access } = fixture('synthetic-code');
  for (const kind of ['redirected', 'foreign']) {
    const response = healthy();
    Object.defineProperty(response, kind === 'redirected' ? 'redirected' : 'url', {
      value: kind === 'redirected' ? true : 'https://foreign.test/data',
    });
    await assert.rejects(access.request(`${api}/decks/`, undefined, async (_url, init) => {
      assert.equal(init.redirect, 'error'); return response;
    }), DemoAccessError);
  }
});

test('401 locks server access but retains mounted-app capability and never replays a POST', async () => {
  const { access, values } = fixture('synthetic-old');
  await access.initialize();
  let posts = 0;
  const response = await access.request(`${api}/attempts/`, { method: 'POST', body: 'synthetic' }, async () => {
    posts++; return new Response('', { status: 401 });
  });
  assert.equal(response.status, 401);
  assert.equal(access.getSnapshot().state, 'locked'); assert.equal(access.getSnapshot().unlockedOnce, true);
  await tick(); assert.equal(values.has(key), false);
  await access.verifyCode('synthetic-new', async () => healthy());
  assert.equal(posts, 1); assert.equal(values.get(key), 'synthetic-new');
  assert.equal(access.getSnapshot().state, 'ready');
});

test('a late 401 for the previous code cannot clear newly verified access', async () => {
  const { access, values } = fixture('synthetic-old');
  await access.initialize();
  let finish;
  const pending = access.request(`${api}/decks/`, undefined, () => new Promise(resolve => { finish = resolve; }));
  await tick();
  await access.verifyCode('synthetic-new', async () => healthy());
  finish(new Response('', { status: 401 })); await pending; await tick();
  assert.equal(values.get(key), 'synthetic-new'); assert.equal(access.getSnapshot().state, 'ready');
});

test('secure storage failures fail closed; a later code entry can recover', async () => {
  const readFailure = fixture(null, { read: async () => { throw Error('synthetic storage failure'); } });
  await readFailure.access.initialize(); assert.equal(readFailure.access.getSnapshot().state, 'locked');
  let fail = true;
  const { access, values } = fixture(null, { write: async (k, value) => {
    if (fail) throw Error('synthetic storage failure'); values.set(k, value);
  } });
  await assert.rejects(access.verifyCode('synthetic-code', async () => healthy()), /securely/);
  assert.equal(access.getSnapshot().state, 'locked');
  fail = false; await access.verifyCode('synthetic-code', async () => healthy());
  assert.equal(access.getSnapshot().state, 'ready');
});

test('a protected build refuses an HTTP endpoint; local development remains unchanged when disabled', async () => {
  const store = fixture().store;
  let calls = 0;
  const raw = async (_url, init) => { calls++; assert.deepEqual(init, { method: 'GET' }); return healthy(); };
  const protectedAccess = createDemoAccess('http://10.0.2.2:8000/api', true, store);
  await assert.rejects(protectedAccess.request('http://10.0.2.2:8000/api/health/', undefined, raw), DemoAccessError);
  assert.equal(calls, 0);
  const local = createDemoAccess('http://10.0.2.2:8000/api', false, store);
  await local.request('http://10.0.2.2:8000/api/health/', { method: 'GET' }, raw);
  assert.equal(calls, 1);
});
