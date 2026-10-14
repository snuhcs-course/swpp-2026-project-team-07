import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from './helpers/storage-native-loader.mjs';
import { descriptionState, descriptionSelection, deckId } from './helpers/feedback-fixtures.mjs';
registerHooks({ resolve });
const { parseProfileState, cueState, createProfileClient, readProfiles } = await import('../src/features/presentations/slideProfiles.ts');
const api = 'http://profiles.invalid/api';
function state() {
  const v = descriptionState();
  v.provenance.prompt_version = 'slide-profile-v1';
  v.provenance.schema_version = 'slide-profile-gemini-v1';
  for (const s of v.descriptions.slides) Object.assign(s, { slide_kind: 'content', cues: [{ text: 'Explain the chart', evidence_refs: ['summary'] }] });
  return v;
}
test('profiles preserve zero-to-four evidence-linked cues and reject uncertain/wrong sources', () => {
  const parsed = parseProfileState(state(), deckId, 2);
  assert.equal(parsed.descriptions.slides[0].cues[0].text, 'Explain the chart');
  for (const change of [v => { v.descriptions.slides[0].cues = Array(5).fill(v.descriptions.slides[0].cues[0]); },
    v => { v.descriptions.slides[0].cues[0].evidence_refs = ['visual_facts/4']; },
    v => { v.descriptions.slides[0].summary = { text: 'Unreadable', uncertain: true, uncertainty: 'blurred' }; },
    v => { v.descriptions.slides[0].cues[0].text = '\ud800'; },
    v => { v.provenance.schema_version = 'description-v2'; },
    v => { v.descriptions.slides[0].source_id = 'f'.repeat(64); }]) {
    const v = state(); change(v); assert.throws(() => parseProfileState(v, deckId, 2));
  }
  const empty = state(); empty.descriptions.slides[0].cues = [];
  assert.deepEqual(cueState(parseProfileState(empty, deckId, 2), 0), { cues: [], message: 'Saved cues use the previous format · Generate updated guidance', action: 'generate' });
});

function guidance() {
  const v = state(); v.provenance.prompt_version = 'slide-profile-v2'; v.provenance.schema_version = 'slide-profile-gemini-v2';
  for (const s of v.descriptions.slides) {
    delete s.cues; s.must_cover = [{text:'Clarify what the comparison establishes.', evidence_refs:['summary']}];
    s.go_deeper = [{text:'Investigate a practical consequence.',kind:'question',information_needed:'Application context.',
      evidence_refs:[{slide_index:s.slide_index,source_id:s.source_id,fact_ref:'summary',quote:s.summary.text}]}];
  }
  return v;
}
test('v2 separates essential and optional guidance and rejects invented premises and duplicates', () => {
  const parsed = parseProfileState(guidance(),deckId,2);
  assert.equal(parsed.descriptions.slides[0].must_cover[0].text,'Clarify what the comparison establishes.');
  assert.equal(parsed.descriptions.slides[0].go_deeper[0].text,'Investigate a practical consequence.');
  assert.equal(cueState(parsed,0).message,'AI cues are out of date');
  for(const change of [v=>{v.descriptions.slides[0].must_cover=Array(4).fill(v.descriptions.slides[0].must_cover[0]);},
    v=>{v.descriptions.slides[0].go_deeper[0].evidence_refs[0].quote='An invented cause';},
    v=>{v.descriptions.slides[0].go_deeper[0].information_needed='';},
    v=>{v.descriptions.slides[0].go_deeper[0].text=v.descriptions.slides[0].must_cover[0].text;},
    v=>{v.descriptions.slides[0].go_deeper[0].evidence_refs[0].slide_index=9;},
    v=>{v.descriptions.slides[0].must_cover[0].text=v.descriptions.slides[0].summary.text;}]) {
    const v=guidance(); change(v); assert.throws(()=>parseProfileState(v,deckId,2));
  }
  const empty=guidance(); empty.descriptions.slides[1].go_deeper=[];
  empty.provenance.prompt_version='slide-profile-v4';empty.provenance.schema_version='slide-profile-gemini-v4';
  assert.equal(cueState(parseProfileState(empty,deckId,2),1,'go_deeper').message,'No additional suggestions for this slide');
});
test('v2 cache replaces historical scope and is retained offline without generating', async () => {
  const local='http://guidance.invalid/api';
  await createProfileClient(local,async()=>new Response(JSON.stringify(state()))).read(deckId,2);
  const v=guidance();v.description_set_id='55555555-5555-4555-8555-555555555555';
  await createProfileClient(local,async()=>new Response(JSON.stringify(v))).read(deckId,2);
  assert.equal(cueState(readProfiles(local,deckId,2),0).action,'generate');
  await assert.rejects(createProfileClient(local,async()=>{throw Error('offline');}).read(deckId,2));
  assert.equal(readProfiles(local,deckId,2).provenance.prompt_version,'slide-profile-v2');
});
test('server unavailable status is returned explicitly without erasing saved offline guidance',async()=>{
  for(const status of ['configuration_unavailable','source_unavailable','disabled','absent']) {
    const local=`http://${status}.invalid/api`,v=guidance();
    v.provenance.prompt_version='slide-profile-v4';v.provenance.schema_version='slide-profile-gemini-v4';
    await createProfileClient(local,async()=>new Response(JSON.stringify(v))).read(deckId,2);
    const unavailable=descriptionState({state:status});
    Object.assign(unavailable,{description_set_id:null,descriptions:null,available_data:false,provenance:null,
      description_revision:0,processing_revision:0,retry_available:false,requires_confirmation:false,edited:false,
      created_at:null,updated_at:null,queued_at:null,completed_at:null});
    const next=await createProfileClient(local,async()=>new Response(JSON.stringify(unavailable))).read(deckId,2);
    assert.equal(next.state,status);
    assert.equal(readProfiles(local,deckId,2).descriptions.slides[0].must_cover.length,1);
  }
});
test('concise v4 retains category boundaries and allows supported cross-slide connections',()=>{
  const v=guidance();v.provenance.prompt_version='slide-profile-v4';v.provenance.schema_version='slide-profile-gemini-v4';
  const other=v.descriptions.slides[1];
  v.descriptions.slides[0].go_deeper=[{text:'Connect this comparison to the later limitation.',kind:'connection',information_needed:'',
    evidence_refs:[{slide_index:other.slide_index,source_id:other.source_id,fact_ref:'summary',quote:other.summary.text}]}];
  assert.equal(cueState(parseProfileState(v,deckId,2),0,'go_deeper').cues.length,1);
  for(const change of [x=>{x.descriptions.slides[0].go_deeper=Array(4).fill(x.descriptions.slides[0].go_deeper[0]);},
    x=>{x.descriptions.slides[0].go_deeper[0].evidence_refs[0].source_id='f'.repeat(64);},
    x=>{x.descriptions.slides[1].summary.uncertain=true;x.descriptions.slides[1].summary.uncertainty='Unreadable';},
    x=>{x.provenance.schema_version='slide-profile-gemini-v2';}]) {
    const bad=structuredClone(v);change(bad);assert.throws(()=>parseProfileState(bad,deckId,2));
  }
});
test('known selection or source invalidation survives offline reopening while retaining history',async()=>{
  for(const status of ['absent','source_unavailable','configuration_unavailable']) {
    const local=`http://invalidated-${status}.invalid/api`,v=guidance();
    v.provenance.prompt_version='slide-profile-v4';v.provenance.schema_version='slide-profile-gemini-v4';
    await createProfileClient(local,async()=>new Response(JSON.stringify(v))).read(deckId,2);
    const unavailable=descriptionState({state:status,description_set_id:null,descriptions:null,available_data:false,provenance:null,
      processing_revision:0,description_revision:0,selection:{...descriptionSelection,model:'changed-model',prompt_version:'slide-profile-v4',schema_version:'slide-profile-gemini-v4'}});
    await createProfileClient(local,async()=>new Response(JSON.stringify(unavailable))).read(deckId,2);
    const offline=readProfiles(local,deckId,2);
    assert.equal(offline.stale,true);assert.equal(offline.descriptions.slides[0].must_cover.length,1);
    assert.deepEqual(cueState(offline,0),{cues:[],message:'AI cues are out of date',action:'generate'});
  }
});
test('v4 enforces fifteen words in both categories without truncating historical v3',()=>{
  for(const category of ['must_cover','go_deeper']) {
    const v=guidance();v.provenance.prompt_version='slide-profile-v4';v.provenance.schema_version='slide-profile-gemini-v4';
    v.descriptions.slides[0][category][0].text=Array(15).fill('word').join(' ');
    parseProfileState(v,deckId,2);
    v.descriptions.slides[0][category][0].text+=' extra';
    assert.throws(()=>parseProfileState(v,deckId,2));
    v.provenance.prompt_version='slide-profile-v3';v.provenance.schema_version='slide-profile-gemini-v3';
    const legacy=parseProfileState(v,deckId,2);
    assert.equal(legacy.descriptions.slides[0][category][0].text.split(' ').length,16);
    assert.equal(cueState(legacy,0).action,'generate');
  }
});
test('v4 counts Unicode separators consistently with backend',()=>{
  for(const sep of ['\ufeff','\u0085','\u001c','\u2003','\u00a0']) {
    const v=guidance();v.provenance.prompt_version='slide-profile-v4';v.provenance.schema_version='slide-profile-gemini-v4';
    v.descriptions.slides[0].must_cover[0].text=Array(15).fill('word').join(sep);parseProfileState(v,deckId,2);
    v.descriptions.slides[0].must_cover[0].text+=sep+'extra';assert.throws(()=>parseProfileState(v,deckId,2));
  }
});
test('pending, stale, failed, disabled and missing profiles cannot appear as successful empty cues', () => {
  assert.equal(cueState(null, 0).message, 'AI cues are unavailable offline');
  for (const [status, message] of [['queued', 'Preparing AI cues…'], ['failed', 'AI cues failed'], ['needs_confirmation', 'AI cue retry needs confirmation']]) {
    const v = state(); v.state = status; v.descriptions = null; v.available_data = false;
    v.requires_confirmation = status === 'needs_confirmation';
    const result = cueState(v, 0); assert.equal(result.message, message); assert.deepEqual(result.cues, []);
  }
  const v = state(); v.stale = true; assert.equal(cueState(v, 0).message, 'AI cues are out of date');
});
test('client only reads on refresh, retains offline cache, and retries with captured revision', async () => {
  const calls = [], responses = [state(), new Error('offline'), state()];
  const client = createProfileClient(api, async (url, init) => {
    calls.push({url, init}); const next = responses.shift(); if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next), {status: 200});
  });
  await client.read(deckId, 2);
  await assert.rejects(client.read(deckId, 2));
  assert.equal(readProfiles(api, deckId, 2).descriptions.slides[0].cues.length, 1);
  const current = state(); current.state = 'failed'; current.retry_available = true;
  await client.retry(current, 2);
  assert.equal(calls[0].init.method, 'GET'); assert.equal(calls[1].init.method, 'GET');
  assert.deepEqual(JSON.parse(calls[2].init.body), { description_set_id: current.description_set_id, processing_revision: current.processing_revision });
  assert.ok(calls.every(c => !c.url.includes('attempts')));
});

test('a reversed refresh cannot restore a superseded source scope', async () => {
  let deliver;
  const old = state(), next = state(); next.description_set_id = '44444444-4444-4444-8444-444444444444';
  const oldClient = createProfileClient(api, () => new Promise(resolve => { deliver = resolve; }));
  const pending = oldClient.read(deckId, 2);
  const fresh = createProfileClient(api, async () => new Response(JSON.stringify(next)));
  await fresh.read(deckId, 2);
  deliver(new Response(JSON.stringify(old)));
  await pending;
  assert.equal(readProfiles(api, deckId, 2).description_set_id, next.description_set_id);
});

test('cue profiles survive a fresh SQLite process without overwriting JJ records', () => {
  const directory = mkdtempSync(join(tmpdir(), 'outloud-profiles-'));
  const loader = new URL('./helpers/storage-native-loader.mjs', import.meta.url).href;
  const module = new URL('../src/features/presentations/slideProfiles.ts', import.meta.url).href;
  const storage = new URL('../src/services/storage.ts', import.meta.url).href;
  const header = `import {registerHooks} from 'node:module'; import {resolve} from ${JSON.stringify(loader)}; registerHooks({resolve});
    const p = await import(${JSON.stringify(module)}); const s = await import(${JSON.stringify(storage)});`;
  const env = { ...process.env, ONLOUD_TEST_DB: join(directory, 'profiles.sqlite3') };
  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', header + `s.writeStored('deck:v1:existing', {run:'retained'});
      await p.createProfileClient(${JSON.stringify(api)}, async()=>new Response(JSON.stringify(${JSON.stringify(state())}))).read(${JSON.stringify(deckId)},2);`], {env});
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', header + `process.stdout.write(JSON.stringify({profile:p.readProfiles(${JSON.stringify(api)},${JSON.stringify(deckId)},2), existing:s.readStored('deck:v1:existing')}));`], {env});
    const result = JSON.parse(out.toString());
    assert.equal(result.profile.descriptions.slides[0].cues.length, 1);
    assert.deepEqual(result.existing, {run:'retained'});
  } finally { rmSync(directory, {recursive:true, force:true}); }
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const {act, create} = await import('react-test-renderer');
const {useSlideProfiles} = await import('../src/features/presentations/useSlideProfiles.ts');
const {writeStored} = await import('../src/services/storage.ts');
const {API_URL} = await import('../src/services/api.ts');
let current;
function Harness({id='profile-hook'}) { current = useSlideProfiles(id, 2); return null; }

test('cue hook reopening and cached offline use perform reads only', async () => {
  const original = globalThis.fetch, calls = [];
  writeStored(`server-deck:${API_URL}:profile-hook`, deckId);
  globalThis.fetch = async (_url, init) => {calls.push(init.method); return new Response(JSON.stringify(state()));};
  let renderer;
  try {
    await act(async () => {renderer = create(React.createElement(Harness));});
    assert.equal(current.value.descriptions.slides[0].cues.length, 1);
    await act(async () => {renderer.unmount();});
    globalThis.fetch = async (_url, init) => {calls.push(init.method); throw new Error('offline');};
    await act(async () => {renderer = create(React.createElement(Harness));});
    assert.equal(current.value.descriptions.slides[0].cues.length, 1);
    assert.match(current.error, /Saved cues are retained/);
    assert.deepEqual(calls, ['GET','GET']);
  } finally { if (renderer) await act(async () => {renderer.unmount();}); globalThis.fetch=original; }
});

test('confirmation is bound to its captured generation and rapid retry taps admit once', async () => {
  const original = globalThis.fetch, calls=[];
  writeStored(`server-deck:${API_URL}:profile-confirmation`, deckId);
  const uncertain=state(); Object.assign(uncertain,{state:'needs_confirmation', descriptions:null, available_data:false, requires_confirmation:true, retry_available:true});
  let response=uncertain, renderer;
  globalThis.fetch=async (_url,init)=>{calls.push(init.method);return new Response(JSON.stringify(response));};
  try {
    await act(async()=>{renderer=create(React.createElement(Harness,{id:'profile-confirmation'}));});
    const captured=current.value;
    response={...uncertain,processing_revision:2,state:'failed',requires_confirmation:false};
    await act(async()=>{current.refresh();});
    await act(async()=>{await current.recover(true,captured);});
    assert.ok(calls.every(c=>c==='GET'));
    await act(async()=>{await Promise.all([current.recover(),current.recover()]);});
    assert.equal(calls.filter(c=>c==='POST').length,1);
  } finally {if(renderer) await act(async()=>{renderer.unmount();});globalThis.fetch=original;}
});
