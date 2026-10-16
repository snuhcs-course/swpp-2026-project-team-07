import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/slide-review-loader.mjs';import {withFeedback,attemptId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});const React=await import('react');const {act,create}=await import('react-test-renderer');
const hook=await import('../src/features/feedback/useRunFeedbackStatus.ts').catch(()=>({}));
const {writeStored}=await import('../src/services/storage.ts');const {reviewKey}=await import('../src/features/transcription/reviewStorage.ts');const {API_URL}=await import('../src/services/api.ts');
const review=withFeedback();const part={attemptId,segments:[{startMs:0,endMs:1000}]};
const model={deck:{id:'run-status-synthetic'},n:2,state:{run:{parts:[part,null]}},stages:new Map([[attemptId,'done']])};
const scope={context_id:null,slides:[{slide_index:0,segments:[{start_ms:0,end_ms:1000}]}]};
const state=()=>({attempt_id:attemptId,feedback_revision:1,transcript_revision:0,state:'queued',stale:false,result:null,
 scope,review_version:'slide-review-v3',requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},
 selection:{token:'1'.repeat(64)},retry_available:false,requires_confirmation:false,availability:{state:'available'},dependency:null,updated_at:null});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;let value;function Probe({active}){value=hook.useRunFeedbackStatus(model,active);return null;}
test('one active-only overview timer reads exact singleton status and never generates on navigation',async()=>{
 assert.equal(typeof hook.useRunFeedbackStatus,'function','one aggregate feedback hook must exist');
 writeStored(reviewKey(API_URL,'attempt',attemptId),review);
 const oldFetch=globalThis.fetch,oldInterval=globalThis.setInterval,oldClear=globalThis.clearInterval;const timers=new Set();let gets=0,tree,reply=state(),fail=false;
 globalThis.fetch=async(url,init)=>{assert.equal(init.method,'GET');assert.deepEqual(JSON.parse(new URL(url).searchParams.get('scope')),scope);gets++;if(fail)throw Error('offline');return new Response(JSON.stringify(reply));};
 globalThis.setInterval=(fn,ms)=>{const token={fn,ms};timers.add(token);return token;};globalThis.clearInterval=token=>timers.delete(token);
 try{await act(async()=>{tree=create(React.createElement(Probe,{active:true}));});
  assert.equal(gets,1);assert.equal(value.items[0].status,'pending');assert.equal(value.aggregate.recorded,1);assert.equal(timers.size,1);
  await act(async()=>tree.update(React.createElement(Probe,{active:false})));assert.equal(timers.size,0);
  const before=gets;await act(async()=>value.refresh());assert.equal(gets,before,'covered overview must not perform network work');
  await act(async()=>tree.update(React.createElement(Probe,{active:true})));assert.equal(gets,before+1);assert.equal(timers.size,1);
  reply={...state(),feedback_revision:2,state:'failed'};await act(async()=>{await [...timers][0].fn();await new Promise(setImmediate);});
  assert.equal(timers.size,0,'terminal jobs stop the single polling timer');assert.equal(value.aggregate.recoveryNeeded,1);
  fail=true;await act(async()=>value.refresh());assert.equal(value.offline,true);assert.equal(value.aggregate.recoveryNeeded,1,'offline refresh retains validated saved status');
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=oldFetch;globalThis.setInterval=oldInterval;globalThis.clearInterval=oldClear;}
 assert.equal(timers.size,0);
});
