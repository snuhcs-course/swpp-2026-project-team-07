import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/qa-loader.mjs';
import {withFeedback,attemptId,transcriptId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {useDurableQa}=await import('../src/features/qa/useDurableQa.ts');
const {API_URL}=await import('../src/services/api.ts');
const {saveRequirements}=await import('../src/features/presentations/requirementsStore.ts');
const {initializeCorrections,confirmCorrection}=await import('../src/features/presentations/correctionStore.ts');
const {enableInitialQa}=await import('../src/features/qa/automatic.ts');
const {qaScope}=await import('../src/features/qa/state.ts');
const original=withFeedback(),context='33333333-3333-4333-8333-333333333333';
let value;function Probe({model,automatic=false,visible=true}){value=useDurableQa(model,automatic,visible);return null;}
const modelFor=(name)=>({deck:{id:name},state:{run:{parts:[{attemptId,segments:[{startMs:0,endMs:1000}]}]},compare:null},transcribed:true});
function setup(name){saveRequirements(name,API_URL,{contextId:context,deckId:original.deck_id,revision:1,audience:'Students',requiredDurationSeconds:null});globalThis.qaReviews={[attemptId]:original};return modelFor(name);}
const response=v=>new Response(JSON.stringify(v),{status:200});
const current=(model,extra={})=>({attempt_id:attemptId,scope:qaScope(model.state.run,context),qa_version:'audience-qa-v2',state:'absent',feedback_revision:0,stale:false,source_revisions:{},requirements:{context_id:context,revision:1,audience:'Students'},retry_available:false,requires_confirmation:false,availability:{state:'available'},selection:{token:'f'.repeat(64)},result:null,...extra});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('opening and reopening read only; concurrent explicit requests reuse one admitted job',async()=>{
 const old=fetch,model=setup('qa-read-only');let renderer,posts=0;
 globalThis.fetch=async(_url,init={})=>{if(_url.endsWith('/corrections/'))return response({attempt_id:attemptId,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:original.transcript.text,source_changed:false});if(init.method==='POST')posts++;return response(current(model,posts?{state:'queued',feedback_revision:1,source_revisions:{[attemptId]:0}}:{}));};
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{model}));});assert.equal(posts,0);
  await act(async()=>{await Promise.all([value.generate(),value.generate()]);});assert.equal(posts,1);
  await act(async()=>renderer.unmount());renderer=null;
  await act(async()=>{renderer=create(React.createElement(Probe,{model}));});assert.equal(posts,1);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('pending offline corrections block question admission',async()=>{
 const old=fetch,model=setup('qa-offline');let renderer,posts=0;
 initializeCorrections(API_URL,attemptId,transcriptId,original.transcript);
 confirmCorrection(API_URL,attemptId,0,0,'Synthetic accepted correction',original.transcript);
 globalThis.fetch=async(url,init={})=>{if(url.endsWith('/corrections/'))throw new Error('offline');if(init.method==='POST')posts++;return response(current(model));};
 try{await act(async()=>{renderer=create(React.createElement(Probe,{model}));});await act(async()=>value.generate());assert.equal(posts,0);assert.match(value.notice,/phone|connected|offline/i);}
 finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('historical recordings are not automatically backfilled',async()=>{
 const old=fetch,model=setup('qa-no-backfill');let renderer,posts=0;
 globalThis.fetch=async(_url,init={})=>{if(init.method==='POST')posts++;return response(current(model));};
 try{await act(async()=>{renderer=create(React.createElement(Probe,{model,automatic:true}));});assert.equal(posts,0);}
 finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});

test('two initial hosts admit once for a newly completed workflow and remount does not regenerate',async()=>{
 const old=fetch,model=setup('qa-initial-once'),id='99999999-9999-4999-8999-999999999991';let renderer,posts=0;
 model.state.run.parts[0].attemptId=id;globalThis.qaReviews[id]={...original,attempt_id:id};enableInitialQa(API_URL,id);
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response({attempt_id:id,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:original.transcript.text,source_changed:false});
  if(init.method==='POST')posts++;
  return response({...current(model,posts?{state:'queued',feedback_revision:1,source_revisions:{[id]:0}}:{}),attempt_id:id});
 };
 try{
  await act(async()=>{renderer=create(React.createElement(React.Fragment,null,React.createElement(Probe,{model,automatic:true}),React.createElement(Probe,{model,automatic:true})));});
  assert.equal(posts,1);
  await act(async()=>renderer.unmount());renderer=null;
  await act(async()=>{renderer=create(React.createElement(Probe,{model,automatic:true}));});assert.equal(posts,1);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});


test('automatic Q&A retries safe preflight failure without reopening and submits once',async()=>{
 const old=fetch,model=setup('qa-preflight-recovery'),id='99999999-9999-4999-8999-999999999992';let renderer,posts=0,offline=true;
 model.state.run.parts[0].attemptId=id;globalThis.qaReviews[id]={...original,attempt_id:id};enableInitialQa(API_URL,id);
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/')){
   if(offline)throw new Error('offline');
   return response({attempt_id:id,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:original.transcript.text,source_changed:false});
  }
  if(init.method==='POST')posts++;
  return response({...current(model,posts?{state:'queued',feedback_revision:1,source_revisions:{[id]:0}}:{}),attempt_id:id});
 };
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{model,automatic:true}));});
  assert.equal(posts,0);offline=false;
  // A real background refresh, without leaving the screen, must recover preflight.
  const oldNow=Date.now;Date.now=()=>oldNow()+10000;
  try{await act(async()=>{await value.refresh();});}finally{Date.now=oldNow;}
  assert.equal(posts,1);
  await act(async()=>{await value.refresh();});assert.equal(posts,1);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});

test('uncertain initial question submission never automatically repeats a POST',async()=>{
 const old=fetch,model=setup('qa-uncertain-initial'),id='99999999-9999-4999-8999-999999999993';let renderer,posts=0;
 model.state.run.parts[0].attemptId=id;globalThis.qaReviews[id]={...original,attempt_id:id};enableInitialQa(API_URL,id);
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response({attempt_id:id,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:original.transcript.text,source_changed:false});
  if(init.method==='POST'){posts++;throw new Error('lost acknowledgement');}
  return response({...current(model),attempt_id:id});
 };
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{model,automatic:true}));});assert.equal(posts,1);
  await act(async()=>{await value.refresh();});assert.equal(posts,1);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});


test('a persisted consumed initial scope is not backfilled when the server reports absent',async()=>{
 const old=fetch,model=setup('qa-consumed-absent'),id='99999999-9999-4999-8999-999999999994';let renderer,posts=0;
 model.state.run.parts[0].attemptId=id;globalThis.qaReviews[id]={...original,attempt_id:id};enableInitialQa(API_URL,id);
 const {writeStored}=await import('../src/services/storage.ts');
 const {normalizeApi}=await import('../src/features/transcription/analysisStorage.ts');
 const scope=qaScope(model.state.run,context);
 writeStored(`qa-initial:v2:${JSON.stringify([normalizeApi(API_URL),model.deck.id,scope.slides])}`,true);
 globalThis.fetch=async(_url,init={})=>{if(init.method==='POST')posts++;return response({...current(model),attempt_id:id});};
 try{await act(async()=>{renderer=create(React.createElement(Probe,{model,automatic:true}));});await act(async()=>value.refresh());assert.equal(posts,0);}
 finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('confirmed pending requirements immediately invalidate saved questions and block admission',async()=>{
 const {confirmRequirements}=await import('../src/features/presentations/requirementsDraft.ts');const old=fetch,model=setup('qa-pending-requirements');let renderer,posts=0;
 globalThis.fetch=async(url,init={})=>{if(init.method==='POST')posts++;return response(current(model,{state:'queued',feedback_revision:1}));};
 try{await act(async()=>{renderer=create(React.createElement(Probe,{model}));});await act(async()=>confirmRequirements(model.deck.id,API_URL,{requiredDurationSeconds:600,audience:'Clients'}));assert.equal(value.state.stale,true);await act(async()=>value.generate());assert.equal(posts,0);assert.match(value.notice,/presentation|synchron/i);}finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});

test('covering Q&A during preflight prevents the delayed provider admission',async()=>{
 const old=fetch,model=setup('qa-covered-preflight');let renderer,posts=0,release,entered;
 const waiting=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 globalThis.fetch=async(url,init={})=>{if(url.endsWith('/corrections/')){entered();await waiting;return response({attempt_id:attemptId,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:original.transcript.text,source_changed:false});}if(init.method==='POST')posts++;return response(current(model));};
 try{await act(async()=>{renderer=create(React.createElement(Probe,{model}));});let generation;await act(async()=>{generation=value.generate();await started;});await act(async()=>renderer.update(React.createElement(Probe,{model,visible:false})));await act(async()=>{release();await generation;});assert.equal(posts,0);}finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});

test('HTTP 400 read failure retains current accepted requirements and is not reported as offline',async()=>{
 const old=fetch,model=setup('qa-http400-audience');model.state.run.parts[0].attemptId='99999999-9999-4999-8999-999999999997';let renderer,requests=[];globalThis.fetch=async(_url,init={})=>{requests.push(init.method??'GET');return Response.json({error:{code:'invalid_request'}},{status:400});};
 try{await act(async()=>{renderer=create(React.createElement(Probe,{model}));});assert.equal(value.requirements?.audience,'Students');assert.equal(value.state,null);assert.doesNotMatch(value.notice,/offline/i);assert.match(value.notice,/selected run|recordings/i);await act(async()=>value.refresh());assert.deepEqual(requests,['GET','GET']);globalThis.fetch=async()=>{throw new Error('synthetic offline');};await act(async()=>value.refresh());assert.match(value.notice,/Offline/);assert.equal(value.requirements.audience,'Students');}finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('covering an active cached question job clears the polling timer without losing its state',async()=>{
 const old=fetch,oldSet=setInterval,oldClear=clearInterval,model=setup('qa-hidden-poll-timer');let renderer,next=0;const timers=new Set();globalThis.setInterval=()=>{const id=++next;timers.add(id);return id;};globalThis.clearInterval=id=>timers.delete(id);globalThis.fetch=async()=>response(current(model,{state:'submitted',feedback_revision:1}));
 try{await act(async()=>{renderer=create(React.createElement(Probe,{model}));});assert.equal(timers.size,1);await act(async()=>renderer.update(React.createElement(Probe,{model,visible:false})));assert.equal(timers.size,0);assert.equal(value.state.state,'submitted');await act(async()=>renderer.update(React.createElement(Probe,{model,visible:true})));assert.equal(timers.size,1);}finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;globalThis.setInterval=oldSet;globalThis.clearInterval=oldClear;}
});
