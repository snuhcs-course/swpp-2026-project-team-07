// Synthetic offline tests verify independent initial slide feedback and explicit recovery.
import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/initial-feedback-loader.mjs';import {withFeedback,transcriptId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {InitialFeedbackHost}=await import('../src/features/feedback/InitialFeedbackHost.tsx');
const {API_URL}=await import('../src/services/api.ts');const {writeStored,readStored}=await import('../src/services/storage.ts');
const {reviewKey}=await import('../src/features/transcription/reviewStorage.ts');
const {enableInitialFeedback}=await import('../src/features/feedback/automaticFeedback.ts');
const {slideReviewInitialKey,slideReviewKey,readSlideReview}=await import('../src/features/feedback/slideReviewStore.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const response=(s,status=200)=>new Response(JSON.stringify(s),{status});
const scope=i=>({context_id:null,slides:[{slide_index:i,segments:[{start_ms:i*1000,end_ms:(i+1)*1000}]}]});
const state=(id,i,extra={})=>({attempt_id:id,scope:scope(i),feedback_revision:0,transcript_revision:0,state:'absent',stale:false,result:null,review_version:'slide-review-v3',
 requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},selection:{token:'1'.repeat(64)},retry_available:false,requires_confirmation:false,
 availability:{state:'available'},dependency:null,updated_at:null,...extra});
let serial=20;
function setup({mixed=false}={}){
 const id=`${String(++serial).padStart(8,'0')}-1111-4111-8111-111111111111`,other=`${String(serial).padStart(8,'0')}-2222-4222-8222-222222222222`,local=`singleton-test-${serial}`;
 const ids=[id,mixed?other:id];globalThis.initialDecks=[{id:local}];
 globalThis.initialDeckStates={[local]:{run:{parts:ids.map((attemptId,i)=>({attemptId,segments:[{startMs:i*1000,endMs:(i+1)*1000}]}))}}};
 for(const source of new Set(ids)){writeStored(reviewKey(API_URL,'attempt',source),withFeedback({attempt_id:source}));enableInitialFeedback(API_URL,source);}
 return {id,ids,review:withFeedback({attempt_id:id})};
}
const tick=()=>new Promise(r=>setTimeout(r,25));
function transport(ids,{preflight=()=>({}),postStatus=200,onPost=()=>{},onGet=()=>{}}={}){
 return async(url,init={})=>{
  const id=ids.find(id=>url.includes(id));
  if(url.endsWith('/corrections/'))return response({attempt_id:id,base_transcript_id:transcriptId,revision:0,edits:[],effective_text:'Hello World',source_changed:false});
  if(init.method==='POST'){
   const body=JSON.parse(init.body);assert.equal(init.headers['X-OutLoud-Review-Protocol'],undefined);assert.ok(!url.endsWith('/initial/'));onPost(url,body);if(postStatus!==200)return response({},postStatus);
   assert.equal(body.scope.slides.length,1);
   return response(state(id,body.scope.slides[0].slide_index,{feedback_revision:1,state:'queued'}));
  }
  const query=JSON.parse(new URL(url).searchParams.get('scope')),i=query.slides[0].slide_index;onGet(id,i);
  return response(state(id,i,preflight(id,i)));
 };
}
test('two new same-source selected slides independently admit singleton requests',async()=>{
 const {id,ids,review}=setup();const old=globalThis.fetch;let tree;const posts=[];
 globalThis.fetch=transport(ids,{onPost:(url,body)=>{for(const s of body.scope.slides)assert.equal(readStored(slideReviewInitialKey(API_URL,id,scope(s.slide_index))),'starting');posts.push({url,body});}});
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);
  assert.equal(posts.length,2);for(const post of posts){assert.match(post.url,/slide-review\/$/);assert.equal(post.body.scope.slides.length,1);}
  assert.equal(posts[0].body.transcript_revision,0);assert.equal(posts[0].body.expected_selection,'1'.repeat(64));
  for(const i of [0,1]){const saved=readSlideReview(API_URL,id,scope(i),review);assert.equal(saved.feedback_revision,1);assert.deepEqual(saved.scope,scope(i));}
  await act(async()=>tree.update(React.createElement(InitialFeedbackHost)));await act(tick);assert.equal(posts.length,2);
  await act(async()=>tree.unmount());tree=null;await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});assert.equal(posts.length,2);
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});
test('different source attempts retain separate singleton requests',async()=>{
 const {ids}=setup({mixed:true});const old=globalThis.fetch;let tree;const posts=[];
 globalThis.fetch=transport(ids,{onPost:(url,body)=>posts.push({url,body})});
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);
  assert.equal(posts.length,2);for(const p of posts)assert.equal(p.body.scope.slides.length,1);
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});
test('failed singleton requests consume per-slide claims without automatic remount retry',async()=>{
 const {id,ids}=setup();const old=globalThis.fetch;let tree;const posts=[];
 globalThis.fetch=transport(ids,{postStatus:404,onPost:(url,body)=>posts.push({url,body})});
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);
  assert.equal(posts.length,2);assert.match(posts[0].url,/slide-review\/$/);for(const i of [0,1])assert.equal(readStored(slideReviewInitialKey(API_URL,id,scope(i))),'failed');
  await act(async()=>tree.unmount());tree=null;await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});assert.equal(posts.length,2);
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});

test('saved owners, active work, uncertainty and durable initial history are excluded from automatic singleton admission',async()=>{
 for(const exclude of [
  (id)=>writeStored(slideReviewKey(API_URL,id,scope(0)),state(id,0,{state:'queued',feedback_revision:1})),
  (id)=>writeStored(slideReviewKey(API_URL,id,scope(0)),state(id,0,{state:'failed',feedback_revision:1,retry_available:true})),
  (id)=>writeStored(`${slideReviewKey(API_URL,id,scope(0))}:uncertain`,{revision:0}),
  (id)=>writeStored(slideReviewInitialKey(API_URL,id,scope(0)),'started'),
  (id)=>writeStored(slideReviewInitialKey(API_URL,id,scope(0)),'failed'),
 ]){
  const {id,ids}=setup();exclude(id);const old=globalThis.fetch;let tree;const posts=[];
  globalThis.fetch=transport(ids,{onPost:(url,body)=>posts.push({url,body})});
  try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);
   assert.equal(posts.length,1);assert.deepEqual(posts[0].body.scope.slides,scope(1).slides);
  }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
 }
});
test('preflight discovers a competing owner and admits only the remaining absent member',async()=>{
 const {ids}=setup();const old=globalThis.fetch;let tree;const posts=[];
 globalThis.fetch=transport(ids,{preflight:(_id,i)=>i===0?{feedback_revision:3,state:'needs_confirmation',requires_confirmation:true}:{},onPost:(url,body)=>posts.push({url,body})});
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);
  assert.equal(posts.length,1);assert.deepEqual(posts[0].body.scope.slides,scope(1).slides);assert.equal(posts[0].body.feedback_revision,undefined);
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});
test('server corrections are refreshed before either singleton admission',async()=>{
 const {id,ids}=setup();const old=globalThis.fetch;let tree,correctionGets=0,posts=0;const base=transport(ids,{onPost:()=>posts++});
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/corrections/')){correctionGets++;return response({attempt_id:id,base_transcript_id:transcriptId,revision:1,edits:[],effective_text:'Hello World',source_changed:false});}
  return base(url,init);
 };
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);
  assert.equal(correctionGets,2);assert.equal(posts,0);
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});
test('local correction accepted while singleton preflight is in flight fences singleton admission',async()=>{
 const {initializeCorrections,confirmCorrection}=await import('../src/features/presentations/correctionStore.ts');
 const {id,ids,review}=setup();const old=globalThis.fetch;let tree,posts=0,changed=false;
 globalThis.fetch=transport(ids,{onGet:()=>{if(!changed){changed=true;initializeCorrections(API_URL,id,transcriptId,review.transcript);confirmCorrection(API_URL,id,0,0,'Recognition',review.transcript);}},onPost:()=>posts++});
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);assert.equal(posts,0);}
 finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});
test('different provider selection tokens each admit an independent singleton',async()=>{
 const {ids}=setup();const old=globalThis.fetch;let tree,posts=0;
 globalThis.fetch=transport(ids,{preflight:(_id,i)=>({selection:{token:String(i+1).repeat(64)}}),onPost:()=>posts++});
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);assert.equal(posts,2);}
 finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});
test('unknown submitted outcome retains per-slide uncertainty and never retries on remount',async()=>{
 const {id,ids}=setup();const old=globalThis.fetch;let tree,posts=0;const base=transport(ids);
 globalThis.fetch=async(url,init={})=>{if(init.method==='POST'){posts++;throw new Error('connection lost after submission');}return base(url,init);};
 try{await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);assert.equal(posts,2);
  for(const i of [0,1])assert.deepEqual(readStored(`${slideReviewKey(API_URL,id,scope(i))}:uncertain`),{revision:0});
  await act(async()=>tree.unmount());tree=null;await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});assert.equal(posts,2);
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});

test('eligible work mounted while backgrounded waits for foreground and still admits once',async()=>{
 const {backgroundApp}=await import('./helpers/recording-screen-ui.mjs');
 const {ids}=setup();const old=globalThis.fetch;let tree,posts=0;globalThis.fetch=transport(ids,{onPost:()=>posts++});
 try{backgroundApp('background');await act(async()=>{tree=create(React.createElement(InitialFeedbackHost));await tick();});await act(tick);assert.equal(posts,0);
  await act(async()=>{backgroundApp('active');await tick();});await act(tick);assert.equal(posts,2);
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;backgroundApp('active');}
});

test('concurrent automatic hosts share singleton claims before any POST',async()=>{
 const {ids}=setup();const old=globalThis.fetch;let tree,posts=0;
 globalThis.fetch=transport(ids,{onPost:()=>posts++});
 try{
  await act(async()=>{tree=create(React.createElement(React.Fragment,null,React.createElement(InitialFeedbackHost),React.createElement(InitialFeedbackHost)));await tick();});await act(tick);
  assert.equal(posts,2,'each of two selected slides admits once across both hosts');
 }finally{if(tree)await act(async()=>tree.unmount());globalThis.fetch=old;}
});
