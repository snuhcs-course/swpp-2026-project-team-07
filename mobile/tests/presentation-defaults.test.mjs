import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve} from './helpers/storage-native-loader.mjs';
registerHooks({resolve});
const {requestPresentationDefaults,synchronizePresentationDefaults,defaultRequirementsPending,hasDefaultRequirements}=await import('../src/features/presentations/defaultRequirements.ts');
const {readRequirements}=await import('../src/features/presentations/requirementsStore.ts');
const api='http://defaults.test/api',deck='22222222-2222-4222-8222-222222222222';
function server(overrides={}){let value;const calls=[];return {calls,fetch:async(_url,init)=>{const b=JSON.parse(init.body);calls.push({method:init.method,body:b});if(init.method==='POST')value??={id:b.id,deck_id:deck,revision:0,audience:'',required_duration_seconds:null,...overrides};else value={...value,revision:value.revision+1,audience:b.audience,required_duration_seconds:b.required_duration_seconds};return new Response(JSON.stringify(value),{status:200});}};}
test('new presentation saves general audience and 300 seconds once, separately from missing legacy requirements',async()=>{
 const local='new-defaults',s=server();requestPresentationDefaults(local,api);
 assert.equal(defaultRequirementsPending(local,api),true);
 assert.equal(readRequirements(local,api).requiredDurationSeconds,null);
 await Promise.all([synchronizePresentationDefaults(local,deck,api,s.fetch),synchronizePresentationDefaults(local,deck,api,s.fetch)]);
 assert.equal(s.calls.filter(c=>c.method==='PATCH').length,1);
 assert.equal(readRequirements(local,api).audience,'General audience');assert.equal(readRequirements(local,api).requiredDurationSeconds,300);
 assert.equal(hasDefaultRequirements(local,api),true);assert.equal(defaultRequirementsPending(local,api),false);
 await synchronizePresentationDefaults(local,deck,api,s.fetch);assert.equal(s.calls.length,2);
 assert.equal(readRequirements('untouched-legacy',api).audience,'');
});
test('offline initialization retains its UUID and resumes without overwriting saved preferences',async()=>{
 const local='offline-defaults';requestPresentationDefaults(local,api);let id;
 await assert.rejects(synchronizePresentationDefaults(local,deck,api,async(_url,init)=>{id=JSON.parse(init.body).id;throw Error('offline');}));
 assert.equal(defaultRequirementsPending(local,api),true);
 const s=server({revision:2,audience:'Researchers',required_duration_seconds:420});
 await synchronizePresentationDefaults(local,deck,api,s.fetch);
 assert.equal(s.calls[0].body.id,id);assert.equal(s.calls.length,1);
 assert.equal(readRequirements(local,api).audience,'Researchers');assert.equal(readRequirements(local,api).requiredDurationSeconds,420);
 assert.equal(hasDefaultRequirements(local,api),false);
});

test('lost PATCH acknowledgement resolves through GET without a second update',async()=>{
 const local='lost-default-save';requestPresentationDefaults(local,api);let value,patches=0;
 await synchronizePresentationDefaults(local,deck,api,async(_url,init)=>{
  if(init.method==='GET')return new Response(JSON.stringify(value));
  const b=JSON.parse(init.body);
  if(init.method==='POST'){value={id:b.id,deck_id:deck,revision:0,audience:'',required_duration_seconds:null};return new Response(JSON.stringify(value));}
  patches++;value={...value,revision:1,audience:b.audience,required_duration_seconds:b.required_duration_seconds};throw Error('Acknowledgement lost');
 });
 assert.equal(patches,1);assert.equal(defaultRequirementsPending(local,api),false);assert.equal(hasDefaultRequirements(local,api),true);
});
test('a concurrent preference update wins over default initialization',async()=>{
 const local='concurrent-preferences';requestPresentationDefaults(local,api);let value;
 await synchronizePresentationDefaults(local,deck,api,async(_url,init)=>{
  if(init.method==='GET')return new Response(JSON.stringify(value));
  const b=JSON.parse(init.body);
  if(init.method==='POST'){value={id:b.id,deck_id:deck,revision:0,audience:'',required_duration_seconds:null};return new Response(JSON.stringify(value));}
  value={...value,revision:1,audience:'Specialists',required_duration_seconds:900};return new Response('{}',{status:409});
 });
 assert.equal(readRequirements(local,api).audience,'Specialists');assert.equal(readRequirements(local,api).requiredDurationSeconds,900);
 assert.equal(hasDefaultRequirements(local,api),false);assert.equal(defaultRequirementsPending(local,api),false);
});
