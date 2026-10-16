// Reactive-store regression: correction and review GET publications must not restart preflight.
import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/slide-review-runtime-loader.mjs';import {withFeedback,transcriptId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {InitialFeedbackHost}=await import('../src/features/feedback/InitialFeedbackHost.tsx');
const {useSlideReview}=await import('../src/features/feedback/useSlideReview.ts');
const {API_URL}=await import('../src/services/api.ts');const {readStored,writeStored}=await import('../src/services/storage.ts');
const {reviewKey}=await import('../src/features/transcription/reviewStorage.ts');
const {enableInitialFeedback}=await import('../src/features/feedback/automaticFeedback.ts');
const {slideReviewInitialKey}=await import('../src/features/feedback/slideReviewStore.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const scope=i=>({context_id:null,slides:[{slide_index:i,segments:[{start_ms:i*1000,end_ms:(i+1)*1000}]}]});
const response=value=>new Response(JSON.stringify(value));
const state=(id,i,extra={})=>({attempt_id:id,scope:scope(i),feedback_revision:0,transcript_revision:0,state:'absent',stale:false,result:null,review_version:'slide-review-v3',
 requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},selection:{token:'1'.repeat(64)},retry_available:false,requires_confirmation:false,
 availability:{state:'available'},dependency:null,updated_at:null,...extra});
let serial=300;
function setup(count=1){const id=`${String(++serial).padStart(8,'0')}-1111-4111-8111-111111111111`,local=`reactive-initial-${serial}`,review=withFeedback({attempt_id:id});
 globalThis.runtimeDecks=[{id:local}];globalThis.runtimeDeckStates={[local]:{run:{parts:Array.from({length:count},(_,i)=>({attemptId:id,segments:[{startMs:i*1000,endMs:(i+1)*1000}]}))}}};
 writeStored(reviewKey(API_URL,'attempt',id),review);enableInitialFeedback(API_URL,id);return {id,review,local};}
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
test('reactive publications do not retry failed correction preflights',async()=>{
 const {id}=setup(),old=globalThis.fetch;let tree,correctionGets=0,reviewGets=0,posts=0;
 globalThis.fetch=async(url,init={})=>{
  if(init.method==='POST'){posts++;return response({});}
  if(url.endsWith('/corrections/')){correctionGets++;throw Error('offline');}
  reviewGets++;return response(state(id,0));
 };
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);
  assert.equal(correctionGets,1);assert.equal(posts,0);assert.ok(reviewGets<=2);
  assert.equal(readStored(slideReviewInitialKey(API_URL,id,scope(0))),null);
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;globalThis.runtimeDecks=[];globalThis.runtimeDeckStates={};}
});
test('singleton admission runs once across reactive publications',async()=>{
 const {id}=setup(),old=globalThis.fetch;let tree,correctionGets=0,posts=0;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/')){correctionGets++;return response({attempt_id:id,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:'Hello World',source_changed:false});}
  if(init.method==='POST'){posts++;assert.match(url,/slide-review\/$/);return response(state(id,0,{feedback_revision:1,state:'queued'}));}
  return response(state(id,0,posts?{feedback_revision:1,state:'queued'}:{}));
 };
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);
  assert.equal(posts,1);assert.equal(correctionGets,1);assert.equal(readStored(slideReviewInitialKey(API_URL,id,scope(0))),'started');
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;globalThis.runtimeDecks=[];globalThis.runtimeDeckStates={};}
});

test('a failed session preflight exposes existing explicit Retry recovery without consuming the initial claim',async()=>{
 const {id,review,local}=setup(),old=globalThis.fetch;let tree,value,offline=true,posts=0,correctionGets=0;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/')){correctionGets++;if(offline)throw Error('offline');return response({attempt_id:id,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:'Hello World',source_changed:false});}
  if(init.method==='POST'){posts++;return response(state(id,0,{feedback_revision:1,state:'queued'}));}
  return response(state(id,0));
 };
 function Detail(){value=useSlideReview(id,scope(0),review,null,false,local);return null;}
 try{await act(async()=>{tree=create(React.createElement(React.Fragment,null,React.createElement(InitialFeedbackHost),React.createElement(Detail)));await tick();});await act(tick);
  assert.equal(correctionGets,1);assert.equal(value.initial,'failed');assert.match(value.notice,/Retry feedback/);assert.equal(readStored(slideReviewInitialKey(API_URL,id,scope(0))),null);assert.equal(posts,0);
  offline=false;await act(async()=>{await value.generate();await tick();});await act(tick);
  assert.equal(posts,1);assert.equal(value.state.feedback_revision,1);assert.equal(value.initial,null);assert.equal(value.notice,'');
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;globalThis.runtimeDecks=[];globalThis.runtimeDeckStates={};}
});


test('automatic singleton hook bounds fresh-read failure and initialization publications, retaining explicit recovery',async()=>{
 for(const mode of ['review-read']){
  const {id,review,local}=setup(),old=globalThis.fetch;let tree,value,failed=true,correctionGets=0,reviewGets=0,posts=0;
  globalThis.runtimeDecks=[];globalThis.runtimeDeckStates={};
  globalThis.fetch=async(url,init={})=>{
   if(url.endsWith('/corrections/')){correctionGets++;if(correctionGets>4)return new Promise(()=>{});if(failed&&mode==='correction-read')throw Error('offline');return response({attempt_id:id,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:'Hello World',source_changed:false});}
   if(init.method==='POST'){posts++;return response(state(id,0,{feedback_revision:1,state:'queued'}));}
   reviewGets++;if(failed&&mode==='review-read'&&reviewGets>1)throw Error('review refresh offline');return response(state(id,0));
  };
  function Automatic(){value=useSlideReview(id,scope(0),review,null,true,local);return null;}
  try{await act(async()=>{tree=create(React.createElement(Automatic));await tick();});await act(tick);
   assert.equal(correctionGets,1,'automatic admission checks authoritative server corrections');assert.equal(reviewGets,2);assert.equal(posts,0);assert.equal(value.initial,'failed');assert.equal(readStored(slideReviewInitialKey(API_URL,id,scope(0))),null);
   failed=false;await act(async()=>{await value.generate();await tick();});await act(tick);assert.equal(posts,1);assert.equal(value.state.feedback_revision,1);
  }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
 }
});
