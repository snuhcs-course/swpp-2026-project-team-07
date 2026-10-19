// Phase 1: real SQLite persistence; synthetic presentations and HTTP responses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from './helpers/storage-native-loader.mjs';
registerHooks({ resolve });

const { readStored, writeStored } = await import('../src/services/storage.ts');
const { readRequirements, saveRequirements, reserveContext } = await import('../src/features/presentations/requirementsStore.ts');
const { parseContext, requirementsStatus, analysisScopeKey } = await import('../src/domain/presentationRequirements.ts');
const { createPresentationContextClient } = await import('../src/features/presentations/contextClient.ts');
const api = 'http://127.0.0.1:8000/api';
const contextId = '11111111-1111-4111-8111-111111111111';
const deckId = '22222222-2222-4222-8222-222222222222';
const wire = (changes = {}) => ({ id: contextId, deck_id: deckId, required_duration_seconds: null, audience: '', revision: 0, ...changes });

test('legacy timing and audience defaults never become confirmed requirements', () => {
  writeStored('pres:v1:legacy', { target: 600, targets: [300, 300], audience: 'Faculty panel' });
  writeStored('deck:v1:legacy', { run: { id: 'old-run' }, edits: { old: { text: 'corrected' } } });
  const before = [readStored('pres:v1:legacy'), readStored('deck:v1:legacy')];
  const req = readRequirements('legacy', api);
  assert.equal(req.requiredDurationSeconds, null);
  assert.equal(req.audience, '');
  assert.equal(requirementsStatus(req), 'missing');
  assert.deepEqual([readStored('pres:v1:legacy'), readStored('deck:v1:legacy')], before);
});

test('requirements persist separately per presentation and API address', () => {
  saveRequirements('local-a', api, parseContext(wire({ required_duration_seconds: 300, audience: 'New students', revision: 1 })));
  assert.equal(readRequirements('local-a', api).requiredDurationSeconds, 300);
  assert.equal(requirementsStatus(readRequirements('local-a', api)), 'ready');
  assert.equal(requirementsStatus(readRequirements('local-b', api)), 'missing');
  assert.equal(requirementsStatus(readRequirements('local-a', 'http://other.test/api')), 'missing');
  assert.equal(readRequirements('local-a', api + '/').revision, 1);
});

test('requirements survive a fresh process and SQLite reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'outloud-requirements-'));
  const loader = new URL('./helpers/storage-native-loader.mjs', import.meta.url).href;
  const store = new URL('../src/features/presentations/requirementsStore.ts', import.meta.url).href;
  const header = `import {registerHooks} from 'node:module'; import {resolve} from ${JSON.stringify(loader)};
    registerHooks({resolve}); const store = await import(${JSON.stringify(store)});`;
  const env = { ...process.env, ONLOUD_TEST_DB: join(directory, 'records.sqlite3') };
  const value = parseContext(wire({ audience: 'Faculty', required_duration_seconds: 900, revision: 3 }));
  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', header + `store.saveRequirements('reopen', ${JSON.stringify(api)}, ${JSON.stringify(value)});`], { env });
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', header + `process.stdout.write(JSON.stringify(store.readRequirements('reopen', ${JSON.stringify(api)})));`], { env });
    assert.deepEqual(JSON.parse(output.toString()), value);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('missing, partial, and explicitly provided requirements remain distinct', () => {
  assert.equal(requirementsStatus(parseContext(wire())), 'missing');
  assert.equal(requirementsStatus(parseContext(wire({ required_duration_seconds: 60 }))), 'partial');
  assert.equal(requirementsStatus(parseContext(wire({ audience: '   ' }))), 'missing');
  assert.equal(requirementsStatus(parseContext(wire({ required_duration_seconds: 1800, audience: 'Experts' }))), 'ready');
  for (const changes of [{ revision: true }, { audience: null }, { audience: 'x'.repeat(501) },
    { required_duration_seconds: 59 }, { required_duration_seconds: '60' }, { required_duration_seconds: 60.5 }, { required_duration_seconds: 1801 }]) {
    assert.throws(() => parseContext(wire(changes)));
  }
});

test('out-of-order responses cannot roll back or rebind a stored context', () => {
  const latest = parseContext(wire({ revision: 2, audience: 'Faculty', required_duration_seconds: 300 }));
  saveRequirements('ordered', api, latest);
  saveRequirements('ordered', api, parseContext(wire({ revision: 1 })));
  assert.deepEqual(readRequirements('ordered', api), latest);
  assert.throws(() => saveRequirements('ordered', api, parseContext(wire({ id: deckId }))));
  assert.deepEqual(readRequirements('ordered', api), latest);
});

test('malformed Unicode cannot overwrite saved requirements; valid emoji use code-point limits', () => {
  const original = parseContext(wire());
  saveRequirements('unicode', api, original);
  for (const audience of ['\ud800', '\udc00']) {
    assert.throws(() => parseContext(wire({ audience })));
    assert.throws(() => saveRequirements('unicode', api, { ...original, audience, revision: 1 }));
    assert.deepEqual(readRequirements('unicode', api), original);
  }
  const valid = parseContext(wire({ audience: '😀'.repeat(500), revision: 1 }));
  saveRequirements('unicode', api, valid);
  assert.deepEqual(readRequirements('unicode', api), valid);
});

test('context reservation survives a failed create and never resets requirements', async () => {
  const calls = [];
  const client = createPresentationContextClient(api, async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) throw new Error('offline');
    return Response.json(wire({ id: calls[0].id }));
  });
  await assert.rejects(client.ensure('retry', deckId));
  const reserved = readRequirements('retry', api);
  assert.equal(reserved.contextId, calls[0].id);
  assert.equal(requirementsStatus(reserved), 'missing');
  await client.ensure('retry', deckId);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(reserveContext('retry', api, deckId).contextId, reserved.contextId);
});

test('client checks response identity and saves only successful validated updates', async () => {
  saveRequirements('client', api, parseContext(wire()));
  const requests = [];
  let response = Response.json(wire({ revision: 1, audience: 'Students', required_duration_seconds: 600 }));
  const client = createPresentationContextClient(api, async (url, options) => {
    requests.push({ url, options }); return response;
  });
  await client.update('client', { requiredDurationSeconds: 600, audience: 'Students', expectedRevision: 0 });
  assert.equal(JSON.parse(requests[0].options.body).expected_revision, 0);
  assert.equal(readRequirements('client', api).revision, 1);
  response = Response.json({ error: { code: 'stale_revision' } }, { status: 409 });
  await assert.rejects(client.update('client', { requiredDurationSeconds: 600, audience: 'Students', expectedRevision: 0 }), /409/);
  assert.equal(readRequirements('client', api).revision, 1);
  response = Response.json(wire({ id: deckId }));
  await assert.rejects(client.refresh('client'), /different/);
  assert.equal(readRequirements('client', api).revision, 1);
});

const run = { id: 'run-1', core: 'ignored label', parts: [
  { attemptId: 'attempt-a', segments: [{ startMs: 0, endMs: 1000 }, { startMs: 2000, endMs: 3000 }] },
  null, { attemptId: 'attempt-b', segments: [{ startMs: 1000, endMs: 2000 }] },
] };
const scope = { contextId, sourceId: 'source', requirementsRevision: 1, profileRevision: 2, analysisVersion: 'phase1' };
const revisions = { 'attempt-a': { transcriptId: 't-a', correctionRevision: 0 }, 'attempt-b': { transcriptId: 't-b', correctionRevision: 1 } };

test('scope follows selected parts and revisions, not transient run labels or object ordering', () => {
  const key = analysisScopeKey(run, scope, revisions);
  assert.equal(analysisScopeKey({ ...run, id: 'run-2', core: 'renamed' }, { ...scope }, { 'attempt-b': revisions['attempt-b'], 'attempt-a': revisions['attempt-a'] }), key);
  for (const field of ['requirementsRevision', 'profileRevision', 'analysisVersion', 'sourceId', 'contextId']) {
    assert.notEqual(analysisScopeKey(run, { ...scope, [field]: typeof scope[field] === 'number' ? scope[field] + 1 : scope[field] + '-new' }, revisions), key);
  }
  assert.notEqual(analysisScopeKey(run, scope, { ...revisions, 'attempt-a': { ...revisions['attempt-a'], correctionRevision: 1 } }), key);
  assert.notEqual(analysisScopeKey(run, scope, { ...revisions, 'attempt-a': { ...revisions['attempt-a'], transcriptId: 'new-transcript' } }), key);
  const changed = structuredClone(run); changed.parts[0].segments[0].endMs = 900;
  assert.notEqual(analysisScopeKey(changed, scope, revisions), key);
  changed.parts[0].attemptId = 'attempt-b';
  assert.notEqual(analysisScopeKey(changed, scope, revisions), key);
  assert.deepEqual(run.parts[0].segments, [{ startMs: 0, endMs: 1000 }, { startMs: 2000, endMs: 3000 }]);
});

test('scope distinguishes unrecorded slides and rejects missing or invalid input identity', () => {
  assert.notEqual(analysisScopeKey(run, scope, revisions), analysisScopeKey({ ...run, parts: run.parts.filter(Boolean) }, scope, revisions));
  assert.throws(() => analysisScopeKey(run, scope, {}));
  assert.throws(() => analysisScopeKey(run, { ...scope, requirementsRevision: -1 }, revisions));
  const invalid = structuredClone(run); invalid.parts[0].segments[0].endMs = 0;
  assert.throws(() => analysisScopeKey(invalid, scope, revisions));
});
