import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/slide-review-loader.mjs';
import {withFeedback,attemptId,transcriptId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {useSlideReview}=await import('../src/features/feedback/useSlideReview.ts');
const {API_URL}=await import('../src/services/api.ts');
const original=withFeedback();
const scope={context_id:null,slides:[{slide_index:0,segments:[{start_ms:0,end_ms:1000}]}]};
const other='99999999-9999-4999-8999-999999999999';
const state=(id,extra={})=>({attempt_id:id,feedback_revision:0,transcript_revision:0,state:'absent',stale:false,result:null,
 scope,review_version:'slide-review-v2',requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},
 selection:{token:'1'.repeat(64)},retry_available:false,requires_confirmation:false,availability:{state:'available'},dependency:null,updated_at:null,...extra});
const response=s=>new Response(JSON.stringify(s),{status:200});
const correction=id=>({attempt_id:id,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:original.transcript.text,source_changed:false});
let value;function Probe({id}){value=useSlideReview(id,scope,{...original,attempt_id:id},null);return null;}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('opening, refreshing and remounting perform reads only; explicit action admits once',async()=>{
 const old=globalThis.fetch;let renderer,posts=0;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response(correction(attemptId));
  if(init.method==='POST'){posts++;return response(state(attemptId,{feedback_revision:1,state:'queued'}));}
  return response(state(attemptId,posts?{feedback_revision:1,state:'queued'}:{}));
 };
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{id:attemptId}));});assert.equal(posts,0);
  await act(async()=>{await value.refresh();});assert.equal(posts,0);
  await act(async()=>{await value.generate();});assert.equal(posts,1);
  await act(async()=>{await value.generate();});assert.equal(posts,1);
  await act(async()=>renderer.unmount());renderer=null;
  await act(async()=>{renderer=create(React.createElement(Probe,{id:attemptId}));});assert.equal(posts,1);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('late responses and retry confirmations cannot cross selected takes',async()=>{
 const old=globalThis.fetch;let renderer,resolveLate,posts=0,delay=false;
 globalThis.fetch=async(url,init={})=>{
  const id=url.includes(other)?other:attemptId;
  if(init.method==='POST')posts++;
  if(url.endsWith('/corrections/'))return response(correction(id));
  if(delay&&id===attemptId)return new Promise(resolve=>{resolveLate=()=>resolve(response(state(id,{feedback_revision:5,state:'failed'})));});
  return response(state(id,{feedback_revision:1,state:'needs_confirmation',retry_available:true,requires_confirmation:true}));
 };
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{id:attemptId}));});
  await act(async()=>{await value.generate();});assert.equal(value.ask,true);const oldConfirm=value.confirm;
  delay=true;let inflight;await act(async()=>{inflight=value.refresh();});
  await act(async()=>renderer.update(React.createElement(Probe,{id:other})));
  await act(async()=>{resolveLate();await inflight;oldConfirm();});
  assert.equal(value.state.attempt_id,other);assert.equal(value.ask,false);assert.equal(posts,0);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('offline correction synchronization blocks generation and keeps saved feedback',async()=>{
 const old=globalThis.fetch;let renderer,posts=0;
 globalThis.fetch=async(url,init={})=>{
  if(init.method==='POST')posts++;
  if(url.endsWith('/corrections/'))throw new Error('offline');
  return response(state(other));
 };
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{id:other}));});
  const {confirmCorrection,initializeCorrections}=await import('../src/features/presentations/correctionStore.ts');
  initializeCorrections(API_URL,other,transcriptId,original.transcript);
  confirmCorrection(API_URL,other,0,0,'Synthetic correction',original.transcript);
  await act(async()=>{await value.generate();});assert.equal(posts,0);assert.match(value.notice,/synchron|offline/i);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});

test('background during submitted generation releases UI lock and refreshes on foreground',async()=>{
 const {backgroundApp}=await import('./helpers/recording-screen-ui.mjs');
 const old=globalThis.fetch;let renderer,finish,gets=0;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response(correction(attemptId));
  if(init.method==='POST')return new Promise(resolve=>{finish=()=>resolve(response(state(attemptId,{feedback_revision:2,state:'queued'})));});
  gets++;return response(state(attemptId));
 };
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{id:attemptId}));});
  let request;await act(async()=>{request=value.generate();});assert.equal(value.busy,true);
  await act(async()=>backgroundApp('background'));
  await act(async()=>{finish();await request;});
  const before=gets;await act(async()=>backgroundApp('active'));
  assert.equal(value.busy,false);assert.ok(gets>before);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;backgroundApp('active');}
});
test('failed profile dependency retries only on explicit action, with its own revision',async()=>{
 const old=globalThis.fetch;let renderer;const posts=[];
 const dependency={state:'failed',retry_action:'generate_descriptions',retry_available:true,description_set_id:'33333333-3333-4333-8333-333333333333',processing_revision:3,requires_confirmation:false};
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response(correction(attemptId));
  if(init.method==='POST'){posts.push({url,body:JSON.parse(init.body)});return response({});}
  return response(state(attemptId,{feedback_revision:2,state:'waiting_descriptions',dependency}));
 };
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{id:attemptId}));});assert.equal(posts.length,0);
  await act(async()=>{await value.generate();});assert.equal(posts.length,1);
  assert.match(posts[0].url,/descriptions\/generate/);assert.equal(posts[0].body.processing_revision,3);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('overlapping refreshes do not starve a slow successful response',async()=>{
 const old=globalThis.fetch;let renderer,finish,gets=0;
 globalThis.fetch=async()=>{gets++;return new Promise(resolve=>{finish=()=>resolve(response(state(attemptId)));});};
 try{
  await act(async()=>{renderer=create(React.createElement(Probe,{id:attemptId}));});
  await act(async()=>{void value.refresh();void value.refresh();});
  assert.equal(gets,1);
  await act(async()=>{finish();await new Promise(resolve=>setImmediate(resolve));});
  assert.equal(value.state.attempt_id,attemptId);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('initial feedback automatically admits once across remounts; no automatic retry',async()=>{
 const old=globalThis.fetch;let renderer,posts=0;
 const id='77777777-7777-4777-8777-777777777777';
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response(correction(id));
  if(init.method==='POST'){posts++;return response(state(id,{feedback_revision:1,state:'failed',retry_available:true}));}
  return response(state(id,posts?{feedback_revision:1,state:'failed',retry_available:true}:{}));
 };
 function Automatic(){value=useSlideReview(id,scope,{...original,attempt_id:id},null,true);return null;}
 try{
  await act(async()=>{renderer=create(React.createElement(Automatic));await new Promise(r=>setTimeout(r,20));});
  assert.equal(posts,1);
  await act(async()=>renderer.unmount());renderer=null;
  await act(async()=>{renderer=create(React.createElement(Automatic));await new Promise(r=>setTimeout(r,20));});
  assert.equal(posts,1);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('confirmed corrections never trigger automatic initial generation',async()=>{
 const {initializeCorrections,confirmCorrection}=await import('../src/features/presentations/correctionStore.ts');
 const old=globalThis.fetch;const id='66666666-6666-4666-8666-666666666666';let renderer,posts=0;
 initializeCorrections(API_URL,id,transcriptId,original.transcript);confirmCorrection(API_URL,id,0,0,'Recognition',original.transcript);
 globalThis.fetch=async(_url,init={})=>{if(init.method==='POST')posts++;return response(state(id));};
 function Automatic(){value=useSlideReview(id,scope,{...original,attempt_id:id},null,true);return null;}
 try{await act(async()=>{renderer=create(React.createElement(Automatic));await new Promise(r=>setTimeout(r,20));});
 assert.equal(posts,0);assert.equal(value.state.stale,true);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('abandoned starting marker exposes explicit retry without automatic resubmission',async()=>{
 const {writeStored}=await import('../src/services/storage.ts');const id='55555555-5555-4555-8555-555555555555';
 writeStored(`slide-review-initial:v1:${JSON.stringify([API_URL,id,scope.slides])}`,'starting');
 const old=globalThis.fetch;let renderer,posts=0;
 globalThis.fetch=async(_url,init={})=>{if(init.method==='POST')posts++;return response(state(id));};
 function Automatic(){value=useSlideReview(id,scope,{...original,attempt_id:id},null,true);return null;}
 try{await act(async()=>{renderer=create(React.createElement(Automatic));});assert.equal(value.initial,'failed');assert.equal(posts,0);}
 finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('first supplied audience context after initial feedback requires explicit update',async()=>{
 const {writeStored}=await import('../src/services/storage.ts');const id='44444444-4444-4444-8444-444444444444';
 const changed={...scope,context_id:'33333333-3333-4333-8333-333333333333'};
 writeStored(`slide-review-initial:v1:${JSON.stringify([API_URL,id,scope.slides])}`,'started');
 const old=globalThis.fetch;let renderer,posts=0;
 globalThis.fetch=async(_url,init={})=>{if(init.method==='POST')posts++;return response(state(id,{scope:changed,requirements:{context_id:changed.context_id,revision:1,audience:'Students',required_duration_seconds:null}}));};
 function Automatic(){value=useSlideReview(id,changed,{...original,attempt_id:id},1,true);return null;}
 try{await act(async()=>{renderer=create(React.createElement(Automatic));});assert.equal(value.state.stale,true);assert.equal(posts,0);}
 finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
test('automatic preflight never retries a generation admitted by another client',async()=>{
 const id='33333333-3333-4333-8333-333333333333';const old=globalThis.fetch;let renderer,gets=0,posts=0;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response(correction(id));
  if(init.method==='POST')posts++;
  gets++;return response(state(id,gets>1?{feedback_revision:1,state:'failed',retry_available:true}:{}));
 };
 function Automatic(){value=useSlideReview(id,scope,{...original,attempt_id:id},null,true);return null;}
 try{await act(async()=>{renderer=create(React.createElement(Automatic));await new Promise(r=>setTimeout(r,20));});assert.equal(posts,0);assert.equal(value.state.state,'failed');}
 finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=old;}
});
