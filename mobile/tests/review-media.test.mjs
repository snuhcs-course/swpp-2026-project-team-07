import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/saved-screen-loader.mjs';
registerHooks({ resolve, load });
const { createMediaManager, MEDIA_LIMITS, localUri, mediaIdentity } = await import('../src/features/transcription/reviewMedia.ts');
const api = 'http://synthetic.invalid/api';
const id = '11111111-1111-4111-8111-111111111111';
const spec = { api, id, kind: 'audio', url: 'http://synthetic.invalid/recordings/test.wav', durationMs: 2000 };
const signal = () => new AbortController().signal;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  const files = new Map(), records = new Map(), events = [];
  let counter = 0;
  const faults = { move: false, write: false, waitMove: null };
  const file = uri => ({ uri,
    get exists() { return files.has(uri); }, get size() { return files.get(uri)?.bytes || 0; }, get md5() { return files.get(uri)?.hash || null; },
    create() { files.set(uri, { bytes: 0, hash: 'synthetic' }); }, delete() { events.push('delete:' + uri); files.delete(uri); },
    open() { return { close() { events.push('close'); }, writeBytes(bytes) { events.push('write:' + bytes.length); files.get(uri).bytes += bytes.length; } }; },
  });
  const network = { count: 0, response: () => stream([new Uint8Array([1, 2, 3])]) };
  const manager = createMediaManager({ file,
    fetch: async (_url, init) => { network.count++; assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); return network.response(init); },
    allocate() { const n = ++counter; return { temporary: file(`file:///owned-${n}.tmp`), destination: file(`file:///owned-${n}.wav`) }; },
    async move(source, target) { events.push('move'); if (faults.waitMove) await faults.waitMove; if (faults.move) throw Error('move failed'); files.set(target.uri, files.get(source.uri)); files.delete(source.uri); },
    read: key => records.get(key) || null, write(key, value) { events.push('publish'); if (faults.write) throw Error('sqlite failed'); records.set(key, value); },
  });
  return { manager, files, records, events, network, faults };
}
function stream(chunks, length) {
  return { ok: true, redirected: false, url: spec.url, headers: new Headers(length === undefined ? {} : { 'content-length': String(length) }),
    body: new ReadableStream({ start(c) { chunks.forEach(x => c.enqueue(x)); c.close(); } }) };
}

test('downloads publish only after complete native validation and file move; scoped records survive manager reuse', async () => {
  const f = fixture(), done = deferred();
  const pending = f.manager.download(spec, async () => { f.events.push('validate'); await done.promise; }, signal());
  await new Promise(setImmediate);
  assert.equal(f.records.size, 0); assert.equal(f.events.includes('move'), false);
  done.resolve(); const value = await pending;
  assert.deepEqual(f.events.slice(-3), ['validate', 'move', 'publish']);
  assert.equal(f.manager.cached(spec).uri, value.uri);
  assert.equal(f.manager.cached({ ...spec, api: 'http://other.invalid/api' }), null);
  assert.equal(f.manager.cached({ ...spec, durationMs: 999 }), null);
  f.files.get(value.uri).hash = 'corrupt'; assert.equal(f.manager.cached(spec), null);
  f.files.delete(value.uri); assert.equal(f.manager.cached(spec), null);
});
for (const kind of ['audio', 'pdf']) {
  test(`${kind} accepts exactly its byte limit without Content-Length and rejects actual overflow before writing it`, async () => {
    const f = fixture(); const current = kind === 'audio' ? spec : { ...spec, kind, pageCount: 2, durationMs: undefined };
    const limit = MEDIA_LIMITS[kind];
    f.network.response = () => stream([new Uint8Array(limit)]);
    const good = await f.manager.download(current, async () => {}, signal()); assert.equal(good.bytes, limit);
    // Changed URL forces a new operation, which must preserve this good record/file.
    const next = { ...current, url: spec.url + '?retry=1' };
    f.network.response = () => ({ ...stream([new Uint8Array(limit), new Uint8Array([1])], 1), url: next.url });
    await assert.rejects(f.manager.download(next, async () => assert.fail('must not validate overflow'), signal()), /byte limit/);
    assert.equal(f.records.get(mediaIdentity(current)).uri, good.uri);
  });
}

test('concurrent active consumers share one download and native validation', async () => {
  const f = fixture(), validation = deferred();
  const a = f.manager.download(spec, () => validation.promise, signal());
  const b = f.manager.download(spec, () => assert.fail('duplicate validator'), signal());
  await new Promise(setImmediate);
  assert.equal(f.records.size, 0); validation.resolve();
  const [first, second] = await Promise.all([a, b]);
  assert.equal(first.uri, second.uri); assert.equal(f.network.count, 1); assert.equal(f.records.size, 1);
});

test('cancelling the validation owner transfers the same temporary file and ignores its late success', async () => {
  const f = fixture(), firstValidation = deferred(), secondValidation = deferred(), first = new AbortController();
  let firstUri, secondUri, oldSignal;
  const a = f.manager.download(spec, (uri, _spec, signal) => { firstUri = uri; oldSignal = signal; return firstValidation.promise; }, first.signal);
  const b = f.manager.download(spec, uri => { secondUri = uri; return secondValidation.promise; }, signal());
  await new Promise(setImmediate); first.abort(); await assert.rejects(a, /cancelled/);
  await new Promise(setImmediate);
  assert.equal(oldSignal.aborted, true); assert.equal(firstUri, secondUri);
  firstValidation.resolve(); await new Promise(setImmediate);
  assert.equal(f.records.size, 0); assert.equal(f.events.includes('move'), false);
  secondValidation.resolve(); await b;
  assert.equal(f.network.count, 1); assert.equal(f.records.size, 1);
});

test('owner cancellation before the response chooses a remaining validator without a second GET', async () => {
  const f = fixture(), response = deferred(), first = new AbortController();
  f.network.response = () => response.promise;
  let validations = 0;
  const a = f.manager.download(spec, () => assert.fail('detached validator'), first.signal);
  const b = f.manager.download(spec, async () => { validations++; }, signal());
  first.abort(); await assert.rejects(a, /cancelled/);
  response.resolve(stream([new Uint8Array([1, 2, 3])]));
  await b; assert.equal(validations, 1); assert.equal(f.network.count, 1); assert.equal(f.records.size, 1);
});

test('a replacement validator failure preserves the previous good PDF and cleans the owned download', async () => {
  const f = fixture(), pdf = { ...spec, kind: 'pdf', pageCount: 2, durationMs: undefined };
  const good = await f.manager.download(pdf, async () => {}, signal());
  const first = new AbortController(), next = { ...pdf, url: spec.url + '?retry=1' };
  f.network.response = () => ({ ...stream([new Uint8Array([4])]), url: next.url });
  const a = f.manager.download(next, () => new Promise(() => {}), first.signal);
  const b = assert.rejects(f.manager.download(next, async () => { throw Error('PDF page count does not match'); }, signal()), /page count/);
  await new Promise(setImmediate); first.abort(); await assert.rejects(a, /cancelled/); await b;
  assert.equal(f.records.get(mediaIdentity(pdf)).uri, good.uri);
  assert.deepEqual([...f.files.keys()], [good.uri]); assert.equal(f.network.count, 2);
});

test('last consumer cancellation during validation discards stale completion and cleans only owned temps', async () => {
  const f = fixture(), validation = deferred(), controller = new AbortController();
  f.files.set('file:///original.wav', { bytes: 10, hash: 'original' });
  const pending = f.manager.download(spec, () => validation.promise, controller.signal);
  await new Promise(setImmediate); controller.abort(); await assert.rejects(pending, /cancelled/);
  validation.resolve(); await new Promise(setImmediate);
  assert.equal(f.records.size, 0); assert.deepEqual([...f.files.keys()], ['file:///original.wav']);
});

test('cancellation during promotion never publishes a late result', async () => {
  const f = fixture(), move = deferred(), controller = new AbortController(); f.faults.waitMove = move.promise;
  const pending = f.manager.download(spec, async () => {}, controller.signal);
  await new Promise(setImmediate); controller.abort(); await assert.rejects(pending, /cancelled/);
  move.resolve(); await new Promise(setImmediate);
  assert.equal(f.records.size, 0); assert.equal(f.files.size, 0);
});

for (const failure of ['native', 'move', 'write']) {
  test(`${failure} failure preserves previous valid file and cache`, async () => {
    const f = fixture(); const good = await f.manager.download(spec, async () => {}, signal());
    const next = { ...spec, url: spec.url + '?new=1' };
    f.network.response = () => ({ ...stream([new Uint8Array([4])]), url: next.url });
    if (failure === 'move') f.faults.move = true;
    if (failure === 'write') f.faults.write = true;
    await assert.rejects(f.manager.download(next, async () => { if (failure === 'native') throw Error('corrupt audio'); }, signal()));
    assert.equal(f.records.get(mediaIdentity(spec)).uri, good.uri);
    assert.deepEqual([...f.files.keys()], [good.uri]);
  });
}

test('PDF failure is independent of successful audio; invalid page bounds and unsafe URLs never fetch', async () => {
  const f = fixture();
  const pdf = { ...spec, kind: 'pdf', durationMs: undefined, pageCount: 2 };
  const results = await Promise.allSettled([f.manager.download(spec, async () => {}, signal()), f.manager.download(pdf, async () => { throw Error('wrong page count'); }, signal())]);
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'rejected']); assert.ok(f.manager.cached(spec)); assert.equal(f.manager.cached(pdf), null);
  for (const invalid of [{ ...pdf, pageCount: 0 }, { ...pdf, pageCount: 11 }, { ...spec, url: 'file:///secret' }, { ...spec, url: 'http://different.invalid/audio' }]) {
    const before = f.network.count; await assert.rejects(f.manager.download(invalid, async () => {}, signal()), /metadata/); assert.equal(f.network.count, before);
  }
});

test('interrupting the stream and rejected redirects cannot publish media', async () => {
  const f = fixture(); const controller = new AbortController();
  f.network.response = () => ({ ...stream([]), body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); } }) });
  const pending = f.manager.download(spec, async () => assert.fail('incomplete'), controller.signal);
  await new Promise(setImmediate); controller.abort(); await assert.rejects(pending, /cancelled/); await new Promise(setImmediate);
  assert.equal(f.files.size, 0); assert.equal(f.records.size, 0);
  f.network.response = () => ({ ...stream([]), redirected: true });
  await assert.rejects(f.manager.download(spec, async () => {}, signal()), /redirected/);
});

test('missing, oversized declared, and empty streams cannot become offline media', async () => {
  const f = fixture();
  for (const response of [stream([], MEDIA_LIMITS.audio + 1), stream([]), { ...stream([]), body: null }]) {
    f.network.response = () => response;
    await assert.rejects(f.manager.download(spec, async () => assert.fail('must not validate empty'), signal()));
  }
  assert.equal(f.records.size, 0); assert.equal(f.files.size, 0);
  assert.equal(localUri('/data/example.wav'), 'file:///data/example.wav');
  assert.equal(localUri('content://example/audio/1'), 'content://example/audio/1');
  assert.equal(localUri('https://example/audio'), null);
});

test('network timeout settles even an unresponsive stream and removes its temporary file', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); f.network.response = () => ({ ...stream([]), body: new ReadableStream() });
  try {
    const done = assert.rejects(f.manager.download(spec, async () => assert.fail('incomplete'), signal()), /cancelled/);
    await new Promise(setImmediate); t.mock.timers.tick(120000); await done;
    assert.equal(f.records.size, 0); assert.equal(f.files.size, 0);
  } finally { t.mock.timers.reset(); }
});

test('a successful PDF is retained when the independent audio decoder fails', async () => {
  const f = fixture(); const pdf = { ...spec, kind: 'pdf', durationMs: undefined, pageCount: 2 };
  const results = await Promise.allSettled([f.manager.download(pdf, async () => {}, signal()), f.manager.download(spec, async () => { throw Error('bad audio'); }, signal())]);
  assert.deepEqual(results.map(r => r.status), ['fulfilled', 'rejected']); assert.ok(f.manager.cached(pdf)); assert.equal(f.manager.cached(spec), null);
});
