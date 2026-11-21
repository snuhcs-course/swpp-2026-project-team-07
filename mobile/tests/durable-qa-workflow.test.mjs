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
test('a status read disables actions only until it settles and reports malformed status separately from a network failure',async()=>{
 const model=setup('qa-first-status-read'),previous=fetch;let renderer,resolveRead;const requests=[];
 globalThis.fetch=(_url,init)=>{requests.push(init.method);return new Promise(resolve=>{resolveRead=resolve;});};
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{model}));});
  assert.equal(value.busy,true);
  await act(async()=>{resolveRead(response({scope:{slides:[]}}));});
  assert.equal(value.busy,false);assert.match(value.notice,/Invalid Q&A response/);
  let retry;await act(async()=>{retry=value.refresh();});
  assert.equal(value.busy,true);
  await act(async()=>{resolveRead(response(current(model)));await retry;});
  assert.equal(value.busy,false);assert.equal(value.state.state,'absent');assert.equal(value.notice,'');
  assert.deepEqual(requests,['GET','GET']);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=previous;}
});
test('a GET for a legacy run with missing context caches both exact historical batches and retains the original answer coordinates offline',async()=>{
 const {saveQaV2,readQaHistory}=await import('../src/features/qa/store.ts');
 const model=modelFor('qa-history-no-context');model.state.run.id='current-local-rehearsal';
 const requestedScope=qaScope(model.state.run,null);
 const batch=(id,revision)=>({qa_version:'audience-qa-v2',job_id:id,feedback_revision:revision,
  completed_at:'2026-01-02T00:00:00Z',scope:{...requestedScope,context_id:context},
  requirements:{context_id:context,revision:1,audience:'Library staff'},questions:[{
   id:id.toString(16).padStart(32,'0'),panelist:'P1',role:'Librarian',slide_index:0,topic:'Library hours',
   question:'How are opening hours measured?',follow_up:'How does that change the total?'}]});
 const first=batch(111,1),latest=batch(112,2);
 const answer={id:'answer',questionJobId:first.job_id,questionId:first.questions[0].id,audioUri:'file:///synthetic-old.wav',durationMs:9000,status:'done',at:'2026-01-02'};
 saveQaV2(API_URL,model.deck.id,first.job_id,{runId:'earlier-local-id',questions:first.questions,audience:'Library staff',answers:{'0-0':answer},createdAt:first.completed_at});
 const old=fetch,requests=[];let renderer,offline=false;
 globalThis.fetch=async(url,init)=>{
  requests.push(init.method);assert.deepEqual(JSON.parse(new URL(url).searchParams.get('scope')),requestedScope);
  if(offline)throw new Error('synthetic offline');
  return response({...current(model),scope:requestedScope,requirements:{context_id:null,revision:null,audience:''},saved_question_sets:[latest,first]});
 };
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{model,automatic:true}));});
  assert.equal(value.state.state,'absent');assert.equal(value.requirements.contextId,null);
  const saved=readQaHistory(API_URL,model.deck.id);
  assert.deepEqual(saved.map(s=>s.jobId),[latest.job_id,first.job_id]);
  assert.deepEqual(saved[0].questions,latest.questions);assert.deepEqual(saved[1].answers['0-0'],answer);
  offline=true;await act(async()=>value.refresh());
  assert.match(value.notice,/Offline/);assert.deepEqual(readQaHistory(API_URL,model.deck.id),saved);
  assert.deepEqual(requests,['GET','GET']);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('offline migration finds a validated background result for the exact visits before the question screen has ever cached it',async()=>{
 const {writeStored}=await import('../src/services/storage.ts');
 const {readQaHistory}=await import('../src/features/qa/store.ts');
 const model=modelFor('qa-old-background-status');const id='99999999-9999-4999-8999-999999999999';
 model.state.run.id='mobile-run';model.state.run.parts[0].attemptId=id;
 const oldScope=qaScope(model.state.run,context);
 const previous={...current(model),attempt_id:id,scope:oldScope,state:'completed',feedback_revision:1,
  result:{stale:false,qa_version:'audience-qa-v2',job_id:701,questions:[{id:'e'.repeat(32),panelist:'P1',role:'Doctor',slide_index:0,topic:'Library',
   question:'What does the chart show?',follow_up:'What follows from this result?'}]}};
 const foreign=structuredClone(previous);foreign.result.job_id=702;foreign.scope.slides[0].segments[0].end_ms=500;
 for(const item of [previous,foreign])writeStored('qa-state:v2:'+JSON.stringify([API_URL,id,item.scope]),item);
 const old=fetch,calls=[];let renderer;globalThis.fetch=async(_url,init)=>{calls.push(init.method);throw new Error('offline');};
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{model,automatic:true}));});
  const saved=readQaHistory(API_URL,model.deck.id);
  assert.deepEqual(saved.map(s=>s.jobId),[701]);assert.deepEqual(saved[0].questions,previous.result.questions);
  assert.deepEqual(calls,['GET']);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('recovering a completed question batch consumes any unclaimed initial handoff without generating for a different audience',async()=>{
 const id='98989898-9898-4989-8989-989898989898',originalContext='44444444-4444-4444-8444-444444444444';
 const model=setup('qa-no-regeneration-after-history');model.state.run.id='selected-local-run';model.state.run.parts[0].attemptId=id;
 globalThis.qaReviews[id]={...original,attempt_id:id};enableInitialQa(API_URL,id);
 const status={...current(model),attempt_id:id};
 status.saved_question_sets=[{job_id:152,feedback_revision:1,qa_version:'audience-qa-v2',completed_at:null,
  scope:{...status.scope,context_id:originalContext},requirements:{context_id:originalContext,revision:1,audience:'Teens'},
  questions:[{id:'d'.repeat(32),panelist:'P1',role:'Student',slide_index:0,topic:'Library shifts',question:'How is this measured?',follow_up:'What supports your estimate?'}]}];
 const old=fetch,calls=[];let renderer;
 globalThis.fetch=async(url,init)=>{calls.push([new URL(url).pathname,init.method]);return response(status);};
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{model,automatic:true}));});
  await act(async()=>value.refresh());
  assert.deepEqual(calls.map(c=>c[1]),['GET','GET']);assert.ok(calls.every(c=>c[0].endsWith('/audience-qa/')));
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
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
