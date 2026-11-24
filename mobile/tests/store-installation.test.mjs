import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { resolve, load } from './helpers/demo-access-native-loader.mjs';

registerHooks({ resolve, load });
const { STORE_API: api } = await import('../src/services/storeEndpoint.ts');
process.env.EXPO_PUBLIC_ACCESS_MODE = 'store';
process.env.EXPO_PUBLIC_API_URL = api;
delete process.env.EXPO_PUBLIC_REQUIRE_DEMO_CODE;
const { createStoreAccess, StorePreflightError } = await import('../src/services/storeAccess.ts');
const { mediaUrl } = await import('../src/features/transcription/reviewValidation.ts');
const { credentialKey } = await import('../src/services/demoAccess.ts');
const { storePrivacy } = await import('../src/services/storePrivacy.ts');
const { validAccessConfig } = await import('../src/services/apiConfig.ts');
const { backendFetch } = await import('../src/services/backendFetch.ts');
const { writeStored, readStored } = await import('../src/services/storage.ts');
const { DemoAccessGate } = await import('../src/screens/DemoAccessGate.tsx');
const { getBudgetNotice, dismissBudgetNotice, stageBudgetNotice, exhaustedNotice, unavailableNotice, readCoachingJson } = await import('../src/services/storeBudget.ts');
const enroll = api + '/installations/', deck = api + '/decks/';
const media = new URL('/store/media/slides/2026/11/a.png', api).href;
const issued = token => Response.json({ token }, { status: 201 });
const ok = () => Response.json({ ok: true });
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(choice = 'enabled') {
  const disk = new Map(), preference = { choice };
  const secure = { read: async k => disk.get(k) ?? null, write: async (k,v) => { disk.set(k,v); }, remove: async k => { disk.delete(k); } };
  const privacy = { read: () => preference.choice, write: v => { preference.choice = v; } };
  return { disk, secure, preference, privacy, request: createStoreAccess(secure, privacy) };
}

test('parallel first API and HEAD/range media requests share a single native enrollment, then restore one bound token', async () => {
  const f = fixture(), calls = [];
  let release;
  const transport = async (url, init) => {
    calls.push([url, init]);
    assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
    if (url === enroll) {
      assert.equal(init.method, 'POST'); assert.equal(init.headers, undefined); assert.equal(init.body, undefined);
      return new Promise(resolve => { release = () => resolve(issued('synthetic-one')); });
    }
    assert.equal(init.headers.get('Authorization'), 'Bearer synthetic-one');
    return ok();
  };
  const a = f.request(deck, { method: 'POST', body: 'fixture' }, transport);
  const b = f.request(media, { method: 'HEAD', headers: { Range:'bytes=0-99', Authorization: 'Basic old' } }, transport);
  await tick(); assert.equal(calls.length, 1); release(); await Promise.all([a,b]);
  assert.equal(f.preference.choice, 'registered'); assert.equal(f.disk.size, 1);
  assert.equal(calls.find(([url]) => url === media)[1].headers.get('range'), 'bytes=0-99');
  assert.equal(calls.find(([url]) => url === deck)[1].body, 'fixture');
  const restored = createStoreAccess(f.secure, f.privacy);
  await restored(new Request(deck, { headers: { 'X-Example': 'retained' } }), undefined, async (request, init) => {
    assert.equal(request.url, deck); assert.equal(init.headers.get('X-Example'), 'retained');
    assert.equal(init.headers.get('authorization'), 'Bearer synthetic-one'); return ok();
  });
  assert.equal(mediaUrl(media, api), media);
  assert.equal(mediaUrl(new URL('/media/stale.wav', api).href, api), null);
  assert.equal(mediaUrl(api + '/decks/', api), null);
});

test('old same-host demo, encoded paths, startup mistakes and foreign requests cannot carry installation data', async () => {
  const f = fixture(), origin = new URL(api).origin;
  const forbidden = [origin + '/api/attempts/', origin + '/media/old.wav', origin + '/storeX/api/decks/', api + '.other/decks/',
    api + '/../other/', api + '/%2e%2e/other/', api + '/a%2fb', api + '/%252f', api + '//x', api + '/#',
    api.replace('https:', 'http:') + '/', api.replace('https://', 'https://x@') + '/', api.replace('.com', '.com.evil.test') + '/', enroll];
  let sent = 0;
  for (const url of forbidden) await assert.rejects(f.request(url, { method: 'POST', body: 'private' }, async () => { sent++; }), StorePreflightError);
  await assert.rejects(f.request(media, { method: 'POST', body: 'private' }, async () => { sent++; }), StorePreflightError);
  assert.equal(sent, 0); assert.equal(f.disk.size, 0);
  for (const [mode,base,flag] of [[undefined,api], ['stor',api], ['store',api,'1'], ['store',origin+'/api'], ['store',api.replace('https:','http:')]])
    assert.equal(validAccessConfig(mode,base,flag),false);
  assert.equal(validAccessConfig('store',api,'0'),true);
  assert.equal(validAccessConfig(undefined,'http://10.0.2.2:8000/api',undefined),true);
  assert.equal(validAccessConfig(undefined,origin+'/api','1'),true);
});

test('an offline first enrollment retries on the next action without sending the write; a 401 never replays it', async () => {
  const f = fixture(), calls = [];
  await assert.rejects(f.request(deck, { method: 'POST' }, async url => { calls.push(url); throw Error('offline'); }), StorePreflightError);
  assert.deepEqual(calls,[enroll]); assert.equal(f.disk.size,0);
  const run = async url => { calls.push(url); return url === enroll ? issued('old-access') : new Response(null,{status:401}); };
  assert.equal((await f.request(deck, { method:'POST', body:'saved' }, run)).status,401);
  assert.equal(f.preference.choice, 'expired'); assert.deepEqual(calls,[enroll,enroll,deck]);
  await assert.rejects(f.request(deck, { method:'POST' }, run), /expired/);
  await tick(); assert.equal(f.disk.size,0); assert.equal(calls.length,3);
  f.preference.choice='enabled';
  await f.request(api+'/health/', undefined, async (url, init) => {
    calls.push(url); if (url === enroll) return issued('new-access');
    assert.equal(init.headers.get('Authorization'), 'Bearer new-access'); return ok();
  });
  assert.deepEqual(calls,[enroll,enroll,deck,enroll,api+'/health/']);
});

test('lost secure token, secure storage failure, cancellation, and redirects preserve privacy and stop before a user upload', async () => {
  const lost = fixture('registered');
  await assert.rejects(lost.request(deck, undefined, async () => { throw Error('unexpected transport'); }), /expired/);
  assert.equal(lost.preference.choice,'expired');
  for (const field of ['read','write']) {
    const f = fixture(); f.secure[field] = async () => { throw Error('secure store unavailable'); };
    const calls = [];
    await assert.rejects(f.request(deck, {method:'POST'}, async url => { calls.push(url); return issued('secure'); }), StorePreflightError);
    assert.deepEqual(calls, field==='write' ? [enroll] : []); assert.equal(f.disk.size,0);
  }
  for (const response of [Response.redirect('https://other.invalid/', 302), issued('token')]) {
    if (response.status===201) Object.defineProperty(response,'url',{value:new URL('/api/installations/',api).href});
    const f = fixture(), calls=[];
    await assert.rejects(f.request(deck, {method:'POST'}, async url => {calls.push(url);return response;}), StorePreflightError);
    assert.deepEqual(calls,[enroll]); assert.equal(f.disk.size,0);
  }
  const f = fixture(), cancelled = new AbortController();
  await assert.rejects(f.request(deck, { method:'POST', signal:cancelled.signal }, async url => {
    assert.equal(url,enroll); cancelled.abort(); return issued('ok'); }), /cancelled/);
  const bounced=ok(); Object.defineProperty(bounced,'redirected',{value:true});
  await assert.rejects(f.request(media, undefined, async () => bounced), /redirected/);
});

test('an upgraded reviewer installation opens directly offline and rejects old consent, cached addresses and recording handoffs before native fetch', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.__demoAccessStore=new Map([[credentialKey(new URL(api).origin),'old-review-code']]);
  const saved={state:'saved',recording:{audio_uri:'file:///old.wav'},auto_process_api:new URL('/api',api).href};
  writeStored('attempt:old-recording',saved); writeStored('analysis-consent:elevenlabs:scribe-v2:keyterms:v2',true);
  const calls=[]; globalThis.__demoAccessFetch=async (url, init) => { calls.push([url,init]); return url===enroll?issued('public-only'):ok(); };
  let tree;
  await act(async()=>{tree=create(React.createElement(DemoAccessGate,null,React.createElement('LocalLibrary')));});
  assert.equal(tree.root.findAllByType('LocalLibrary').length,1);assert.equal(tree.root.findAllByType('TextInput').length,0);
  assert.equal(storePrivacy.read(),null);await assert.rejects(backendFetch(deck,{method:'POST',body:'private PDF'}),/off/);
  storePrivacy.write('offline');await assert.rejects(backendFetch(deck,{method:'POST',body:'private PDF'}),/off/);
  assert.equal(calls.length,0);
  storePrivacy.write('enabled');
  await assert.rejects(backendFetch(saved.auto_process_api+'/attempts/',{method:'POST',body:'old audio'}),/address/);
  assert.equal(calls.length,0); await backendFetch(deck);
  assert.deepEqual(calls.map(([url])=>url),[enroll,deck]);assert.equal(calls[1][1].headers.get('Authorization'),'Bearer public-only');
  assert.deepEqual(readStored('attempt:old-recording'),saved);
  await act(async()=>tree.unmount());
});

test('direct and polled budget failures disclose the correct status and ignore words inside user content', async () => {
  const denied={error:{code:'public_budget_exhausted',message:'fixture'}};
  assert.equal(stageBudgetNotice({transcript:denied,slides:[{text:'public_budget_exhausted'}]}),null);
  assert.equal(stageBudgetNotice({segments:[{error:{code:'provider_timeout'}}]}),null);
  assert.equal(stageBudgetNotice({feedback:{slides:[{error:'public_budget_unavailable'}]}}),unavailableNotice);
  await readCoachingJson(Response.json({segments:[denied]}));assert.equal(getBudgetNotice(),exhaustedNotice);
  dismissBudgetNotice();assert.equal(getBudgetNotice(),null);
  await readCoachingJson(Response.json(denied));assert.equal(getBudgetNotice(),null);
  globalThis.__demoAccessFetch=async()=>Response.json({error:{code:'public_budget_unavailable'}},{status:503});
  assert.equal((await backendFetch(deck)).status,503);assert.equal(getBudgetNotice(),unavailableNotice);
});
