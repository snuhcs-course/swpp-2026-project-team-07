// Synthetic mounted React scoring workflow; transport/storage/native boundaries only are mocked.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/presentation-score-workflow-loader.mjs';
import {scoreState} from './helpers/presentation-score-fixtures.mjs';
import {withFeedback,transcriptId,deckId,setId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
const React=await import('react');
const {act,create}=await import('react-test-renderer');
const {usePresentationScore}=await import('../src/features/feedback/usePresentationScore.ts').catch(()=>({}));
const {API_URL}=await import('../src/services/api.ts');
const {backgroundApp,setFocused}=await import('./helpers/recording-screen-ui.mjs');
const {readStored}=await import('../src/services/storage.ts');
const {presentationScoreKey,publishPresentationScore}=await import('../src/features/feedback/presentationScoreStore.ts');
const {initializeCorrections,confirmCorrection,readCorrections}=await import('../src/features/presentations/correctionStore.ts');
const {confirmRequirements,acceptServerRequirements}=await import('../src/features/presentations/requirementsDraft.ts');
const {saveRequirements}=await import('../src/features/presentations/requirementsStore.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let serial=0;
const target=()=>{const id=`${String(++serial).padStart(8,'0')}-1234-4234-8234-123456789abc`;return {id,contextId:null,pageCount:2,review:{...withFeedback(),attempt_id:id}};};
const state=(t,extra={})=>({schema_version:'presentation-score-v2',rubric_version:'presentation-score-v2',attempt_id:t.id,context_id:t.contextId,source_identity:null,assessment_status:'not_graded',feedback_revision:0,transcript_revision:0,state:'absent',stale:false,updated_at:null,selection:{token:'1'.repeat(64)},availability:{state:'available'},retry_available:false,requires_confirmation:false,retry_at:null,error:null,dependency:null,requirements:{context_id:t.contextId,revision:null,audience:'',required_duration_seconds:null},result:null,...extra});
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
const correction=(t,extra={})=>({attempt_id:t.id,base_transcript_id:t.review.transcript_id,revision:0,edits:[],effective_text:t.review.transcript.text,source_changed:false,...extra});
const flush=()=>new Promise(r=>setImmediate(r));
function Probe({target:t,revision=null,local,active=true,slot=0}){values[slot]=usePresentationScore(t,revision,local,active);return null;}
let values=[];
async function mount(t,handler,props={}){
 assert.equal(typeof usePresentationScore,'function','explicit score workflow controller must exist');
 const old=globalThis.fetch;globalThis.fetch=handler;values=[];let renderer;
 try{await act(async()=>{renderer=create(React.createElement(Probe,{target:t,...props}));});}
 catch(e){globalThis.fetch=old;throw e;}
 return {get value(){return values[0];},renderer,async close(){await act(async()=>renderer.unmount());globalThis.fetch=old;backgroundApp('active');setFocused(true);}};
}
function transport(t,score,posts){return async(url,init={})=>{
 if(url.endsWith('/corrections/'))return response(correction(t));
 if(init.method==='POST'){posts.push({url,body:JSON.parse(init.body)});return response(state(t,{state:'queued',assessment_status:'pending',feedback_revision:1}));}
 return response(typeof score==='function'?score():score);
};}

test('mount, refresh, focus and remount only read; first explicit Grade posts frozen selection and revisions once',async()=>{
 const t=target(),posts=[];let status=state(t);
 const h=await mount(t,async(url,init={})=>{
  const r=await transport(t,()=>status,posts)(url,init);
  if(init.method==='POST')status=state(t,{state:'queued',assessment_status:'pending',feedback_revision:1});return r;
 });
 try{
  assert.equal(posts.length,0);await act(async()=>h.value.refresh());
  await act(async()=>{setFocused(false);setFocused(true);});assert.equal(posts.length,0);
  await act(async()=>h.value.generate());assert.equal(posts.length,1);
  assert.match(posts[0].url,/presentation-score\/$/);assert.deepEqual(posts[0].body,{context_id:null,expected_selection:'1'.repeat(64),transcript_revision:0});
  await act(async()=>h.value.generate());assert.equal(posts.length,1);assert.equal(h.value.state.state,'queued');
 }finally{await h.close();}
 const again=await mount(t,transport(t,()=>status,posts));try{assert.equal(posts.length,1);}finally{await again.close();}
});

test('active queued score polls to completion with no second POST',async tctx=>{
 tctx.mock.timers.enable({apis:['setInterval']});const t=target(),posts=[];let gets=0;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts.push(url);return response(state(t,{feedback_revision:1,state:'queued',assessment_status:'pending'}));}
 gets++;return response(state(t,gets<3?{feedback_revision:1,state:'queued',assessment_status:'pending'}:{feedback_revision:1,state:'completed',assessment_status:'insufficient_evidence',updated_at:'2026-10-17T02:00:00Z'}));});
 try{await act(async()=>tctx.mock.timers.tick(2000));await act(async()=>tctx.mock.timers.tick(2000));assert.equal(h.value.state.state,'completed');assert.equal(posts.length,0);}finally{await h.close();tctx.mock.timers.reset();}
});

test('same-frame repeated taps and two mounted controllers admit only one request',async()=>{
 const t=target(),posts=[];let finish;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts.push(url);return new Promise(r=>finish=()=>r(response(state(t,{state:'queued',feedback_revision:1,assessment_status:'pending'}))));}return response(state(t));});
 try{
  await act(async()=>h.renderer.update(React.createElement(React.Fragment,null,React.createElement(Probe,{target:t}),React.createElement(Probe,{target:t,slot:1}))));
  let one,two;await act(async()=>{one=values[0].generate();two=values[1].generate();void values[0].generate();await flush();});assert.equal(posts.length,1);
  await act(async()=>{finish();await Promise.all([one,two]);});assert.equal(values[0].busy,false);assert.equal(values[1].busy,false);
 }finally{await h.close();}
});

test('failed retry obeys cooldown, then sends matching feedback revision explicitly',async()=>{
 const t=target(),posts=[];let allowed=false;
 const h=await mount(t,transport(t,()=>state(t,{state:'failed',feedback_revision:4,retry_available:allowed,retry_at:allowed?null:'2099-01-01T00:00:00Z'}),posts));
 try{await act(async()=>h.value.generate());assert.equal(posts.length,0);assert.match(h.value.notice,/retry.*not.*available/i);
 allowed=true;await act(async()=>h.value.generate());assert.equal(posts.length,1);assert.equal(posts[0].body.feedback_revision,4);
 }finally{await h.close();}
});

test('ambiguous submission persists uncertainty across remount and requires fresh acknowledged retry',async()=>{
 const t=target(),posts=[];let fail=true,gets=0;
 const fetcher=async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts.push(JSON.parse(init.body));if(fail)throw Error('connection lost');return response(state(t,{state:'queued',assessment_status:'pending',feedback_revision:1}));}gets++;return response(state(t));};
 let h=await mount(t,fetcher);
 try{await act(async()=>h.value.generate());assert.match(h.value.notice,/uncertain/i);assert.ok(readStored(`${presentationScoreKey(API_URL,t)}:uncertain`));}finally{await h.close();}
 h=await mount(t,fetcher);try{
  assert.equal(posts.length,1);await act(async()=>h.value.generate());assert.equal(h.value.ask,true);assert.equal(posts.length,1);const before=gets;fail=false;
  await act(async()=>{h.value.confirm();await flush();});assert.ok(gets>before);assert.equal(posts.length,2);assert.equal(posts[1].acknowledge_uncertain,true);assert.equal(h.value.ask,false);assert.equal(readStored(`${presentationScoreKey(API_URL,t)}:uncertain`),false);
 }finally{await h.close();}
});

test('confirmation is invalidated by changed selection, revision or source identity',async()=>{
 for(const changed of [{selection:{token:'2'.repeat(64)}},{feedback_revision:3},{source_identity:'new-source'}]){
  const t=target(),posts=[];let extra={};const h=await mount(t,transport(t,()=>state(t,{state:'needs_confirmation',feedback_revision:2,requires_confirmation:true,retry_available:true,...extra}),posts));
  try{await act(async()=>h.value.generate());assert.equal(h.value.ask,true);extra=changed;await act(async()=>{h.value.confirm();await flush();});assert.equal(posts.length,0);assert.match(h.value.notice,/changed/i);}finally{await h.close();}
 }
});

test('local correction invalidates cached score immediately, synchronizes before explicit update, and fences edits during preflight',async()=>{
 const t=target(),posts=[];let serverCorrection=correction(t),release,hold=false;
 const h=await mount(t,async(url,init={})=>{
  if(url.endsWith('/corrections/')){if(init.method==='PATCH'){serverCorrection=correction(t,{revision:1,edits:JSON.parse(init.body).edits});}return response(serverCorrection);}
  if(init.method==='POST'){posts.push(JSON.parse(init.body));return response(state(t,{state:'queued',feedback_revision:2,transcript_revision:1,assessment_status:'pending'}));}
  if(hold)return new Promise(r=>release=()=>r(response(state(t,{state:'completed',feedback_revision:1,transcript_revision:1,stale:true}))));
  return response(state(t,{state:'completed',feedback_revision:1}));
 });
 try{
  await act(async()=>{initializeCorrections(API_URL,t.id,transcriptId,t.review.transcript);confirmCorrection(API_URL,t.id,0,0,'Recognition',t.review.transcript);});assert.equal(h.value.state.stale,true);assert.equal(posts.length,0);
  hold=true;let request;await act(async()=>{request=h.value.generate();await flush();});assert.equal(readCorrections(API_URL,t.id).pending,false);
  await act(async()=>confirmCorrection(API_URL,t.id,1,1,'New recognition',t.review.transcript));
  await act(async()=>{release();await request;});assert.equal(posts.length,0);assert.match(h.value.notice,/correction|synchron/i);
 }finally{await h.close();}
});

test('offline correction synchronization preserves score and blocks admission',async()=>{
 const t=target(),posts=[];const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))throw Error('offline corrections');if(init.method==='POST')posts.push(url);return response(state(t,{state:'completed',feedback_revision:1,stale:true}));});
 try{await act(async()=>h.value.generate());assert.equal(posts.length,0);assert.equal(h.value.state.feedback_revision,1);assert.match(h.value.notice,/offline|synchron/i);}finally{await h.close();}
});

test('pending settings immediately mark stale and block posts; setting changes during GET also fence admission',async()=>{
 const t=target(),posts=[],local='score-settings-'+t.id;let release,hold=false;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST')posts.push(url);if(hold)return new Promise(r=>release=()=>r(response(state(t))));return response(state(t));},{local});
 try{
  await act(async()=>confirmRequirements(local,API_URL,{audience:'Students',requiredDurationSeconds:300}));assert.equal(h.value.state.stale,true);await act(async()=>h.value.generate());assert.equal(posts.length,0);
  await act(async()=>acceptServerRequirements(local,API_URL));hold=true;let request;
  await act(async()=>{request=h.value.generate();await flush();});
  await act(async()=>confirmRequirements(local,API_URL,{audience:'Experts',requiredDurationSeconds:600}));
  await act(async()=>{release();await request;});assert.equal(posts.length,0);assert.match(h.value.notice,/settings|synchron/i);
 }finally{await h.close();acceptServerRequirements(local,API_URL);}
});

test('source selection change and inactive state discard late responses and old confirmation handlers',async()=>{
 const first=target(),second=target(),posts=[];let release,hold=false;
 const h=await mount(first,async(url,init={})=>{
  const t=url.includes(first.id)?first:second;if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST')posts.push(url);
  if(hold&&t.id===first.id)return new Promise(r=>release=()=>r(response(state(first,{state:'failed',feedback_revision:8}))));
  return response(state(t,{state:'needs_confirmation',feedback_revision:2,requires_confirmation:true,retry_available:true}));
 });
 try{
  await act(async()=>h.value.generate());const confirm=h.value.confirm;hold=true;let request;await act(async()=>{request=h.value.refresh();});
  await act(async()=>h.renderer.update(React.createElement(Probe,{target:second})));
  await act(async()=>{release();await request;confirm();});assert.equal(h.value.state.attempt_id,second.id);assert.equal(h.value.ask,false);assert.equal(posts.length,0);
  await act(async()=>h.renderer.update(React.createElement(Probe,{target:second,active:false})));await act(async()=>h.value.generate());assert.equal(posts.length,0);assert.equal(h.value.busy,false);
 }finally{await h.close();}
});

test('backgrounded submission retains uncertainty and cross-mount lock until response, then foreground refreshes',async()=>{
 const t=target(),posts=[];let release,gets=0;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts.push(url);return new Promise(r=>release=()=>r(response(state(t,{state:'queued',feedback_revision:1,assessment_status:'pending'}))));}gets++;return response(state(t));});
 try{let request;await act(async()=>{request=h.value.generate();await flush();});assert.equal(h.value.busy,true);
 await act(async()=>backgroundApp('background'));assert.equal(h.value.busy,false);
 await act(async()=>{release();await request;});assert.equal(h.value.state.state,'absent');assert.ok(readStored(`${presentationScoreKey(API_URL,t)}:uncertain`));
 const before=gets;await act(async()=>backgroundApp('active'));assert.ok(gets>before);assert.equal(posts.length,1);
 }finally{await h.close();}
});

test('failed profile recovery uses the shared descriptions retry revision without posting a score or singleton feedback',async()=>{
 const t=target(),posts=[];
 const dependency={deck_id:deckId,state:'failed',retry_action:'generate_descriptions',retry_available:true,description_set_id:setId,processing_revision:3,description_revision:1,requires_confirmation:false,retry_at:null,error:null};
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts.push({url,body:JSON.parse(init.body)});return response({});}return response(state(t,{state:'waiting_descriptions',feedback_revision:2,dependency}));});
 try{assert.equal(posts.length,0);await act(async()=>h.value.generate());assert.equal(posts.length,1);assert.match(posts[0].url,/decks\/.*\/descriptions\/generate\/$/);assert.deepEqual(posts[0].body,{description_set_id:setId,processing_revision:3});}finally{await h.close();}
});

test('read failure recovers by GET and restored cache remains available offline',async tctx=>{
 tctx.mock.timers.enable({apis:['setInterval']});const t=target(),posts=[];let online=false,reads=0;
 publishPresentationScore(API_URL,state(t,{feedback_revision:3,state:'completed'}),t);
 const h=await mount(t,async(_url,init={})=>{reads++;if(init.method==='POST')posts.push(_url);if(!online)throw Error('offline');return response(state(t,{feedback_revision:4,state:'queued',assessment_status:'pending'}));});
 try{assert.equal(h.value.state.feedback_revision,3);assert.match(h.value.notice,/connection|offline/i);online=true;await act(async()=>tctx.mock.timers.tick(5000));assert.equal(h.value.state.feedback_revision,4);assert.equal(h.value.notice,'');assert.equal(posts.length,0);assert.ok(reads>=2);}finally{await h.close();tctx.mock.timers.reset();}
});

test('Update synchronizes a correction and grades against its new revision while the stale score retains its frozen revision',async()=>{
 const t=target(),posts=[];let correctionRevision=0;
 initializeCorrections(API_URL,t.id,transcriptId,t.review.transcript);confirmCorrection(API_URL,t.id,0,0,'Recognition fix',t.review.transcript);
 const h=await mount(t,async(url,init={})=>{
  if(url.endsWith('/corrections/')){if(init.method==='PATCH')correctionRevision=1;return response(correction(t,{revision:correctionRevision,edits:correctionRevision?[{word_start:0,word_end:0,text:'Recognition fix'}]:[]}));}
  if(init.method==='POST'){posts.push(JSON.parse(init.body));return response(state(t,{state:'queued',feedback_revision:2,transcript_revision:1,assessment_status:'pending'}));}
  return response(state(t,{state:'stale',stale:true,feedback_revision:1,transcript_revision:0,retry_available:true}));
 });
 try{await act(async()=>h.value.generate());assert.equal(posts.length,1);assert.equal(posts[0].transcript_revision,1);assert.equal(posts[0].feedback_revision,1);assert.equal(h.value.state.state,'queued');}finally{await h.close();}
});

test('Update uses current saved settings while preserving the server frozen stale context revision',async()=>{
 const base=target(),context='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',t={...base,contextId:context},local='score-saved-'+base.id,posts=[];
 saveRequirements(local,API_URL,{contextId:context,deckId,revision:2,audience:'Students',requiredDurationSeconds:300});
 const h=await mount(t,transport(t,state(t,{state:'stale',stale:true,feedback_revision:1,retry_available:true,
  requirements:{context_id:context,revision:1,audience:'Experts',required_duration_seconds:600}}),posts),{local,revision:2});
 try{await act(async()=>h.value.generate());assert.equal(posts.length,1);assert.equal(posts[0].body.context_id,context);assert.equal(posts[0].body.feedback_revision,1);}finally{await h.close();}
});

test('stale generation cooldown still blocks explicit updates',async()=>{
 const t=target(),posts=[],h=await mount(t,transport(t,state(t,{state:'stale',stale:true,feedback_revision:1,retry_available:false,retry_at:'2099-01-01T00:00:00Z'}),posts));
 try{await act(async()=>h.value.generate());assert.equal(posts.length,0);assert.match(h.value.notice,/retry.*not.*available/i);}finally{await h.close();}
});


function scored(t){
 const result=scoreState(),replace=value=>{if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){if(key==='attempt_id')value[key]=t.id;else replace(child);}};
 replace(result);return result;
}
test('first explicit grade polls a validated 67 score with simultaneous/repeated visits and restores it offline',async tctx=>{
 tctx.mock.timers.enable({apis:['setInterval']});const t=target(),result=scored(t);let posts=0,ready=false,online=true;
 t.review.slide_events=[{slide_index:0,at_ms:0},{slide_index:1,at_ms:0},{slide_index:0,at_ms:0},{slide_index:1,at_ms:1000},{slide_index:0,at_ms:1500},{slide_index:1,at_ms:1500}];
 result.result.evidence.visits=[
  {slide_index:0,start_ms:0,end_ms:0,word_indexes:[]},{slide_index:1,start_ms:0,end_ms:0,word_indexes:[]},
  {slide_index:0,start_ms:0,end_ms:1000,word_indexes:[0]},{slide_index:1,start_ms:1000,end_ms:1500,word_indexes:[1]},
  {slide_index:0,start_ms:1500,end_ms:1500,word_indexes:[]},{slide_index:1,start_ms:1500,end_ms:2000,word_indexes:[]}];
 const reindex=value=>{if(!value||typeof value!=='object')return;if(value.kind==='speech'){value.visit_id=value.slide_index===0?2:3;value.segment_id=`v${value.visit_id}s0`;}else for(const child of Object.values(value))reindex(child);};reindex(result);
 const fetcher=async(url,init={})=>{if(!online)throw Error('offline');if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;return response(state(t,{state:'queued',assessment_status:'pending',feedback_revision:1}));}return response(ready?result:state(t,posts?{state:'queued',assessment_status:'pending',feedback_revision:1}:{}));};
 let h=await mount(t,fetcher);
 try{await act(async()=>h.value.generate());ready=true;await act(async()=>tctx.mock.timers.tick(2000));assert.equal(h.value.state.result.overall.score,67);assert.equal(h.value.state.result.slides[0].criteria[0].evidence[0].visit_id,2);assert.equal(posts,1);}finally{await h.close();}
 online=false;h=await mount(t,fetcher);try{assert.equal(h.value.state.result.overall.score,67);assert.equal(h.value.state.stale,false);assert.equal(posts,1);}finally{await h.close();tctx.mock.timers.reset();}
});

test('malformed score response retains validated result and marks an explicit POST outcome uncertain',async()=>{
 const t=target(),saved=scored(t);publishPresentationScore(API_URL,saved,t);let posts=0;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;return response({schema_version:'unknown'});}return response({...saved,stale:true,state:'stale',retry_available:true,updated_at:'2026-10-17T01:00:00Z'});});
 try{await act(async()=>h.value.generate());assert.equal(posts,1);assert.equal(h.value.state.result.overall.score,67);assert.equal(h.value.state.stale,true);assert.match(h.value.notice,/uncertain/i);assert.ok(readStored(`${presentationScoreKey(API_URL,t)}:uncertain`));}finally{await h.close();}
});

test('a definite admission rejection clears the uncertain marker and the next explicit attempt refreshes status',async()=>{
 const t=target(),posts=[];let gets=0;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts.push(JSON.parse(init.body));assert.ok(readStored(`${presentationScoreKey(API_URL,t)}:uncertain`));return response({error:'selection_mismatch'},409);}gets++;return response(state(t));});
 try{await act(async()=>h.value.generate());assert.equal(readStored(`${presentationScoreKey(API_URL,t)}:uncertain`),false);assert.doesNotMatch(h.value.notice,/uncertain/i);const before=gets;await act(async()=>h.value.generate());assert.ok(gets>before);assert.equal(posts.length,2);assert.equal(posts[1].acknowledge_uncertain,undefined);}finally{await h.close();}
});

test('a saved requirements revision changed during preflight blocks admission even without a pending draft',async()=>{
 const base=target(),context='dddddddd-dddd-4ddd-8ddd-dddddddddddd',t={...base,contextId:context},local='score-boundary-'+base.id;let release,hold=false,posts=0;
 saveRequirements(local,API_URL,{contextId:context,deckId,revision:1,audience:'Students',requiredDurationSeconds:300});
 const envelope=state(t,{requirements:{context_id:context,revision:1,audience:'Students',required_duration_seconds:300}});
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST')posts++;if(hold)return new Promise(r=>release=()=>r(response(envelope)));return response(envelope);},{local,revision:1});
 try{hold=true;let request;await act(async()=>{request=h.value.generate();await flush();});await act(async()=>saveRequirements(local,API_URL,{contextId:context,deckId,revision:2,audience:'Experts',requiredDurationSeconds:600}));await act(async()=>{release();await request;});assert.equal(posts,0);assert.match(h.value.notice,/settings.*changed/i);}finally{await h.close();}
});

test('background cannot release another mounted controller into a second submission before the original settles',async()=>{
 const t=target();let posts=0,release;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;return new Promise(r=>release=()=>r(response(state(t,{state:'queued',assessment_status:'pending',feedback_revision:1}))));}return response(state(t));});
 try{await act(async()=>h.renderer.update(React.createElement(React.Fragment,null,React.createElement(Probe,{target:t}),React.createElement(Probe,{target:t,slot:1}))));let request;await act(async()=>{request=values[0].generate();await flush();});
 await act(async()=>{backgroundApp('background');backgroundApp('active');await flush();});await act(async()=>values[1].generate());assert.equal(posts,1);
 await act(async()=>{release();await request;});assert.equal(values[0].busy,false);assert.equal(values[1].busy,false);
 await act(async()=>values[1].generate());assert.equal(values[1].ask,true);assert.equal(posts,1);
 }finally{await h.close();}
});

test('inactive and null targets perform no lifecycle requests or submissions until activated',async()=>{
 const t=target();let requests=0;
 const h=await mount(t,async()=>{requests++;return response(state(t));},{active:false});
 try{await act(async()=>{await h.value.refresh();await h.value.generate();});assert.equal(requests,0);assert.equal(h.value.busy,false);assert.equal(h.value.ask,false);
 await act(async()=>h.renderer.update(React.createElement(Probe,{target:null})));await act(async()=>h.value.generate());assert.equal(requests,0);assert.equal(h.value.state,null);
 await act(async()=>h.renderer.update(React.createElement(Probe,{target:t})));assert.equal(requests,1);assert.equal(h.value.state.attempt_id,t.id);
 }finally{await h.close();}
});

test('uncertain retry acknowledgement is invalidated by corrections changed after its prompt',async()=>{
 const t=target(),posts=[];let revision=0,edits=[];
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/')){if(init.method==='PATCH'){revision++;edits=JSON.parse(init.body).edits;}return response(correction(t,{revision,edits}));}if(init.method==='POST'){posts.push(url);return response(state(t,{state:'queued',assessment_status:'pending',feedback_revision:3,transcript_revision:revision}));}return response(state(t,{state:'needs_confirmation',stale:true,requires_confirmation:true,retry_available:true,feedback_revision:2,transcript_revision:0}));});
 try{await act(async()=>h.value.generate());assert.equal(h.value.ask,true);await act(async()=>confirmCorrection(API_URL,t.id,0,0,'New recognition',t.review.transcript));await act(async()=>{h.value.confirm();await flush();});assert.equal(posts.length,0);assert.match(h.value.notice,/changed/i);}finally{await h.close();}
});

test('a stale cancel handler cannot dismiss the current source retry confirmation',async()=>{
 const first=target(),second=target();
 const h=await mount(first,async(url)=>{const t=url.includes(first.id)?first:second;return response(url.endsWith('/corrections/')?correction(t):state(t,{state:'needs_confirmation',feedback_revision:1,requires_confirmation:true,retry_available:true}));});
 try{await act(async()=>h.value.generate());const oldCancel=h.value.cancel;await act(async()=>h.renderer.update(React.createElement(Probe,{target:second})));await act(async()=>h.value.generate());assert.equal(h.value.ask,true);await act(async()=>oldCancel());assert.equal(h.value.ask,true);}finally{await h.close();}
});

test('a local requirements record bound to another deck cannot authorize null-context grading',async()=>{
 const t=target(),local='score-otherdeck-'+t.id,posts=[];
 saveRequirements(local,API_URL,{contextId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',deckId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',revision:1,audience:'Students',requiredDurationSeconds:300});
 const h=await mount(t,transport(t,state(t),posts),{local});
 try{await act(async()=>h.value.generate());assert.equal(posts.length,0);assert.match(h.value.notice,/settings|source/i);}finally{await h.close();}
});
