// Actual automatic host -> controller -> mocked API -> validator/cache -> panel projection.
import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/presentation-score-integration-loader.mjs';
import {scoreState,scoreReview} from './helpers/presentation-score-fixtures.mjs';
registerHooks({resolve,load});
const React=await import('react'),{act,create}=await import('react-test-renderer');
const overview=await import('../src/features/feedback/useRunPresentationScores.ts').catch(()=>({}));
const {InitialPresentationScoreHost}=await import('../src/features/feedback/InitialPresentationScoreHost.tsx');
const {PresentationScorePanel,PresentationScoreRing}=await import('../src/features/feedback/PresentationScorePanel.tsx');
const {API_URL}=await import('../src/services/api.ts'),{writeStored}=await import('../src/services/storage.ts');
const {reviewKey}=await import('../src/features/transcription/reviewStorage.ts');
const {confirmCorrection}=await import('../src/features/presentations/correctionStore.ts');
const {readPresentationScore}=await import('../src/features/feedback/presentationScoreStore.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let latest,serial=0;const flush=()=>new Promise(r=>setImmediate(r));
function setup(){
 const id=`${String(++serial+800).padStart(8,'0')}-4321-4321-8321-123456789abc`,review=scoreReview({attempt_id:id});
 writeStored(reviewKey(API_URL,'attempt',id),review);
 const model={deck:{id:'integration-'+id},n:2,state:{run:{parts:[{attemptId:id,segments:[{startMs:0,endMs:1000}]},{attemptId:id,segments:[{startMs:1000,endMs:2000}]}]}},stages:new Map([[id,'done']])};
 globalThis.runtimeDecks=[model.deck];globalThis.runtimeDeckStates={[model.deck.id]:model.state};globalThis.runtimeModels={[model.deck.id]:model};
 const absent={schema_version:'presentation-score-v2',rubric_version:'presentation-score-v2',attempt_id:id,context_id:null,source_identity:null,assessment_status:'not_graded',feedback_revision:0,transcript_revision:0,state:'absent',stale:false,updated_at:null,selection:{token:'1'.repeat(64)},availability:{state:'available'},retry_available:false,requires_confirmation:false,retry_at:null,error:null,dependency:null,requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},result:null};
 const result=scoreState();const rename=v=>{if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(k==='attempt_id')v[k]=id;else rename(x);}};rename(result);
 return {id,review,model,absent,result};
}
function Probe({model,slide,active=true}){
 assert.equal(typeof overview.useRunPresentationScores,'function','run scoring adapter must exist');
 latest=overview.useRunPresentationScores(model,active,slide);const item=slide===undefined?latest.overall:latest.items[slide];
 return React.createElement(React.Fragment,null,React.createElement(InitialPresentationScoreHost,{openedDeckId:model.deck.id}),React.createElement(PresentationScoreRing,{id:'test-score',label:slide===undefined?'Overall score':'Slide score',item}),
  React.createElement(PresentationScorePanel,{item,controller:latest.controller,target:latest.target,overall:slide===undefined,active,refresh:latest.refresh,onEvidence:()=>{}}));
}
const button=(r,label)=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel===label);
const click=async(r,label)=>{const node=button(r,label);assert.ok(node,label);assert.notEqual(node.props.disabled,true,label+' enabled');await act(async()=>node.props.onPress());};
const response=(s,status=200)=>new Response(JSON.stringify(s),{status});
function mockNetwork(s){let current=s.absent;const posts=[],gets=[];
 const fetcher=async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response({attempt_id:s.id,base_transcript_id:s.review.transcript_id,revision:0,edits:[],effective_text:s.review.transcript.text,source_changed:false});
  if(init.method==='POST'){posts.push({url,body:JSON.parse(init.body)});current={...s.absent,state:'queued',assessment_status:'pending',feedback_revision:1};return response(current,202);}
  gets.push(url);assert.match(url,/presentation-score/,'no singleton feedback inference/read needed');return response(current);
 };
 return {fetcher,posts,gets,set:next=>{current=next;}};
}
test('automatic first scoring reaches display via polling; navigation and reopening never regenerate',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const s=setup(),network=mockNetwork(s),old=globalThis.fetch;globalThis.fetch=network.fetcher;let r;
 try{
  await act(async()=>{r=create(React.createElement(Probe,{model:s.model}));});assert.equal(network.posts.length,1);assert.equal(latest.overall.score,null);
  assert.equal(button(r,'Grade presentation'),undefined);assert.equal(network.posts.length,1);assert.match(network.posts[0].url,/presentation-score\/$/);
  network.set(s.result);await act(async()=>{t.mock.timers.tick(2500);await flush();});
  assert.equal(latest.overall.score,67);assert.equal(r.root.findByType('score-ring').props.value,'67');
  await act(async()=>r.update(React.createElement(Probe,{model:s.model,slide:1})));assert.equal(latest.items[1].score,67);assert.equal(network.posts.length,1);
  await act(async()=>r.unmount());r=null;
  globalThis.fetch=async()=>{throw Error('offline reopening');};
  await act(async()=>{r=create(React.createElement(Probe,{model:s.model}));});assert.equal(latest.overall.score,67);assert.equal(network.posts.length,1);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
});
test('failed assessment offers Retry and explicit retry uses the existing generation only once',async()=>{
 const s=setup(),network=mockNetwork(s),old=globalThis.fetch;network.set({...s.absent,state:'failed',assessment_status:'unavailable',feedback_revision:2,retry_available:true,error:{code:'provider_error',message:'Synthetic failure'}});globalThis.fetch=network.fetcher;let r;
 try{
  await act(async()=>{r=create(React.createElement(Probe,{model:s.model}));});assert.equal(latest.overall.score,null);
  await click(r,'Retry grading');assert.equal(network.posts.length,1);assert.equal(network.posts[0].body.feedback_revision,2);
  assert.equal(network.posts.some(p=>p.url.includes('slide-review')),false);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
});
test('local correction immediately removes performance numbers while retaining saved assessment',async()=>{
 const s=setup(),network=mockNetwork(s),old=globalThis.fetch;network.set(s.result);globalThis.fetch=network.fetcher;let r;
 try{
  await act(async()=>{r=create(React.createElement(Probe,{model:s.model}));});assert.equal(latest.overall.score,67);
  // Initialize/sync on explicit Grade is unnecessary here: initialize the existing correction store only.
  const {initializeCorrections}=await import('../src/features/presentations/correctionStore.ts');
  await act(async()=>{initializeCorrections(API_URL,s.id,s.review.transcript_id,s.review.transcript);confirmCorrection(API_URL,s.id,0,0,'Corrected recognition',s.review.transcript);});
  assert.equal(latest.overall.score,null);assert.equal(r.root.findByType('score-ring').props.value,'—');assert.equal(button(r,'Update score'),undefined);
  assert.equal(readPresentationScore(API_URL,{id:s.id,contextId:null,review:s.review,pageCount:2}).result.overall.score,67);assert.equal(network.posts.length,0);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
});
test('zero-duration chronology completes the actual scoring workflow without reindexing repeated visits',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const s=setup();
 s.review.slide_events=[{slide_index:0,at_ms:0},{slide_index:0,at_ms:0},{slide_index:1,at_ms:1000},{slide_index:0,at_ms:1000},{slide_index:1,at_ms:1000}];
 s.review.visits=[{slide_index:0,start_ms:0,end_ms:0,words:[]},{slide_index:0,start_ms:0,end_ms:1000,words:[s.review.transcript.words[0]]},
  {slide_index:1,start_ms:1000,end_ms:1000,words:[]},{slide_index:0,start_ms:1000,end_ms:1000,words:[]},{slide_index:1,start_ms:1000,end_ms:2000,words:[s.review.transcript.words[1]]}];
 s.result.result.evidence.visits=s.review.visits.map((v,i)=>({slide_index:v.slide_index,start_ms:v.start_ms,end_ms:v.end_ms,word_indexes:i===1?[0]:i===4?[1]:[]}));
 const reindex=v=>{if(!v||typeof v!=='object')return;if(v.kind==='speech'){v.visit_id=v.slide_index===0?1:4;v.segment_id=`v${v.visit_id}s0`;}else for(const x of Object.values(v))reindex(x);};reindex(s.result);
 writeStored(reviewKey(API_URL,'attempt',s.id),s.review);
 const network=mockNetwork(s),old=globalThis.fetch;globalThis.fetch=network.fetcher;let r;
 try{
  await act(async()=>{r=create(React.createElement(Probe,{model:s.model}));});assert.equal(network.posts.length,1);network.set(s.result);
  await act(async()=>{t.mock.timers.tick(2500);await flush();});assert.equal(latest.overall.score,67);assert.deepEqual(latest.items.map(i=>i.score),[67,67]);
  assert.equal(latest.overall.result.evidence.visits.length,5);assert.equal(latest.overall.result.slides[1].evidence[0].visit_id,4);assert.equal(network.posts.length,1);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
});

test('opening a saved presentation enables only its selected sources, leaving unopened history untouched',async()=>{
 const selected=setup(),history=setup(),old=globalThis.fetch;let r;const posts=[];
 globalThis.runtimeDecks=[selected.model.deck,history.model.deck];globalThis.runtimeDeckStates={[selected.model.deck.id]:selected.model.state,[history.model.deck.id]:history.model.state};globalThis.runtimeModels={[selected.model.deck.id]:selected.model,[history.model.deck.id]:history.model};
 globalThis.fetch=async(url,init={})=>{assert.ok(!url.includes(history.id),'unused history must not be read or graded');if(url.endsWith('/corrections/'))return response({attempt_id:selected.id,base_transcript_id:selected.review.transcript_id,revision:0,edits:[],effective_text:selected.review.transcript.text,source_changed:false});if(init.method==='POST'){posts.push(url);return response({...selected.absent,state:'queued',assessment_status:'pending',feedback_revision:1});}return response(selected.absent);};
 try{await act(async()=>{r=create(React.createElement(InitialPresentationScoreHost,{openedDeckId:null}));});assert.equal(posts.length,0);await act(async()=>{r.update(React.createElement(InitialPresentationScoreHost,{openedDeckId:selected.model.deck.id}));await flush();});assert.equal(posts.length,1);await act(async()=>r.update(React.createElement(InitialPresentationScoreHost,{openedDeckId:null})));assert.equal(posts.length,1);}finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
});

test('pending comparisons and cropped selected intervals cannot admit an automatic assessment',async()=>{
 for(const mode of ['comparison','cropped']){const s=setup(),old=globalThis.fetch;let r,requests=0;
  if(mode==='comparison')s.model.state.compare={pending:true};else for(const p of s.model.state.run.parts)p.segments[0].startMs++;
  globalThis.fetch=async()=>{requests++;return response(s.absent);};
  try{await act(async()=>{r=create(React.createElement(InitialPresentationScoreHost,{openedDeckId:s.model.deck.id}));await flush();});assert.equal(requests,0,mode+' must not trigger scoring');}finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
 }
});


test('active automatic submission shows scoring across readers without an uncertainty warning or retry',async()=>{
 const s=setup(),network=mockNetwork(s),old=globalThis.fetch;let r,finish;const pending=new Promise(resolve=>{finish=resolve;});
 globalThis.fetch=async(url,init={})=>init.method==='POST'?pending:network.fetcher(url,init);
 try{
  await act(async()=>{r=create(React.createElement(Probe,{model:s.model}));await flush();});
  assert.equal(latest.controller.busy,true);assert.equal(latest.controller.notice,'');
  assert.equal(latest.overall.status,'Scoring…');assert.equal(r.root.findByType('score-ring').props.value,'…');
  assert.equal(button(r,'Retry grading'),undefined);
  await act(async()=>r.update(React.createElement(Probe,{model:s.model,slide:1})));
  assert.equal(latest.items[1].status,'Scoring…');assert.equal(latest.controller.notice,'');
  await act(async()=>{finish(response({...s.absent,state:'queued',assessment_status:'pending',feedback_revision:1},202));await flush();});
 }finally{finish?.(response({...s.absent,state:'queued',assessment_status:'pending',feedback_revision:1},202));if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
});
