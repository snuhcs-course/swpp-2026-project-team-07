// Automatic score admission over real controllers/cache; synthetic transport only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/presentation-score-workflow-loader.mjs';
import {withFeedback} from './helpers/feedback-fixtures.mjs';
import {scoreState} from './helpers/presentation-score-fixtures.mjs';
registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {usePresentationScore}=await import('../src/features/feedback/usePresentationScore.ts');
const {API_URL}=await import('../src/services/api.ts');
const {readStored}=await import('../src/services/storage.ts');
const {initializeCorrections,confirmCorrection,createCorrectionClient}=await import('../src/features/presentations/correctionStore.ts');
const {saveRequirements}=await import('../src/features/presentations/requirementsStore.ts');
const {confirmRequirements,acceptServerRequirements}=await import('../src/features/presentations/requirementsDraft.ts');
const {bump}=await import('./helpers/slide-review-runtime-store.mjs');
const {backgroundApp}=await import('./helpers/recording-screen-ui.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let serial=700,values=[];
const target=()=>{const id=`${++serial}00000-1234-4234-8234-123456789abc`;return {id,contextId:null,pageCount:2,review:withFeedback({attempt_id:id})};};
const absent=(t,extra={})=>({schema_version:'presentation-score-v2',rubric_version:'presentation-score-v2',attempt_id:t.id,context_id:null,source_identity:null,assessment_status:'not_graded',feedback_revision:0,transcript_revision:0,state:'absent',stale:false,updated_at:null,selection:{token:'1'.repeat(64)},availability:{state:'available'},retry_available:false,requires_confirmation:false,retry_at:null,error:null,dependency:null,requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},result:null,...extra});
const correction=(t,revision=0)=>({attempt_id:t.id,base_transcript_id:t.review.transcript_id,revision,edits:revision?[{word_start:0,word_end:0,text:`Correction ${revision}`}]:[],effective_text:revision?`Correction ${revision}`:t.review.transcript.text,source_changed:false});
const response=(v,status=200)=>new Response(JSON.stringify(v),{status});
function completed(t){const value=scoreState();const old=value.attempt_id;function walk(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='attempt_id'&&x===old)v[k]=t.id;else walk(x);}}walk(value);return value;}
function Probe({t,automatic=true,active=true,slot=0,revision=null,local}){values[slot]=usePresentationScore(t,revision,local,active,automatic);return null;}
const settle=()=>new Promise(r=>setImmediate(r));
async function mount(t,fetcher,props={}){const old=globalThis.fetch;globalThis.fetch=fetcher;let tree;values=[];
 await act(async()=>{tree=create(React.createElement(Probe,{t,...props}));await settle();});
 return {tree,get value(){return values[0];},async close(){await act(async()=>tree.unmount());globalThis.fetch=old;backgroundApp('active');}};
}
test('first eligible transcript starts once automatically and persisted queued state survives remount',async()=>{
 const t=target(),posts=[];let current=absent(t);
 const fetcher=async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts.push(JSON.parse(init.body));current=absent(t,{state:'queued',feedback_revision:1,assessment_status:'pending'});}return response(current);};
 let h=await mount(t,fetcher);try{assert.equal(posts.length,1);assert.equal(posts[0].transcript_revision,0);await act(async()=>h.value.refresh());assert.equal(posts.length,1);}finally{await h.close();}
 h=await mount(t,fetcher);try{assert.equal(posts.length,1);}finally{await h.close();}
});
test('two automatic owners and a read-only screen share a single source submission',async()=>{
 const t=target();let posts=0,current=absent(t);
 const fetcher=async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;current=absent(t,{state:'queued',feedback_revision:1,assessment_status:'pending'});}return response(current);};
 const h=await mount(t,fetcher);try{await act(async()=>{h.tree.update(React.createElement(React.Fragment,null,React.createElement(Probe,{t}),React.createElement(Probe,{t,slot:1}),React.createElement(Probe,{t,slot:2,automatic:false})));await settle();});assert.equal(posts,1);}finally{await h.close();}
});
test('saved corrections refresh the score automatically after one second of stable synchronized inputs',async ctx=>{
 ctx.mock.timers.enable({apis:['setTimeout','setInterval','Date']});const t=target();let revision=0,posts=0,current=completed(t);
 initializeCorrections(API_URL,t.id,t.review.transcript_id,t.review.transcript);
 const fetcher=async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t,revision));if(init.method==='POST'){posts++;assert.equal(JSON.parse(init.body).transcript_revision,revision);current=absent(t,{state:'queued',feedback_revision:2,transcript_revision:revision,assessment_status:'pending'});}return response(current);};
 const h=await mount(t,fetcher);try{
  assert.equal(posts,0);current=absent(t,{state:'stale',stale:true,feedback_revision:1,retry_available:true,updated_at:current.updated_at});
  await act(async()=>confirmCorrection(API_URL,t.id,0,0,'Correction 1',t.review.transcript));
  await act(async()=>ctx.mock.timers.tick(2000));assert.equal(posts,0,'unsynchronized correction must not submit');
  revision=1;await act(async()=>createCorrectionClient(API_URL).refresh(t.id));
  await act(async()=>createCorrectionClient(API_URL).synchronize(t.id));
  await act(async()=>ctx.mock.timers.tick(500));await act(async()=>bump());
  await act(async()=>ctx.mock.timers.tick(499));assert.equal(posts,0);
  await act(async()=>{ctx.mock.timers.tick(1);await settle();});assert.equal(posts,1);
 }finally{await h.close();ctx.mock.timers.reset();}
});
test('failed and rejected completed results do not enter an automatic paid retry loop; rejected result offers manual retry',async()=>{
 for(const rejected of [false,true]){const t=target();let posts=0,current=absent(t,{state:'failed',feedback_revision:1,retry_available:true,assessment_status:'unavailable'});
  if(rejected){current=completed(t);current.retry_available=true;current.assessment_status=current.result.assessment_status='invalid_evidence';current.result.overall={status:'invalid_evidence',score:null,level:null,exact:null,components:{slide_mean:{numerator:200,denominator:3},whole:null}};current.result.whole[3]={...current.result.whole[3],status:'insufficient_evidence',level:null,evidence:[],limitations:['Missing speech citation.']};current.result.validation.score_critical={rejected_count:1,reasons:['whole:delivery: unsupported_assessment']};}
  const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;current=absent(t,{state:'queued',feedback_revision:2,assessment_status:'pending'});}return response(current);});
  try{assert.equal(posts,0);await act(async()=>h.value.refresh());assert.equal(posts,0);await act(async()=>h.value.generate());assert.equal(posts,1,rejected?'rejected completed result must be retryable':'failed result can retry');}finally{await h.close();}
 }
});
test('uncertain automatic POST is not repeated on refresh/remount and still requires explicit confirmation',async()=>{
 const t=target();let posts=0;
 const fetcher=async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;throw Error('connection interrupted after dispatch');}return response(absent(t));};
 let h=await mount(t,fetcher);try{assert.equal(posts,1);await act(async()=>h.value.refresh());assert.equal(posts,1);}finally{await h.close();}
 h=await mount(t,fetcher);try{assert.equal(posts,1);await act(async()=>h.value.generate());assert.equal(h.value.ask,true);assert.equal(posts,1);}finally{await h.close();}
});
test('automatic owners pause in background and read-only owners never admit scoring',async()=>{
 for(const mode of ['background','read-only']){const t=target();let posts=0;if(mode==='background')backgroundApp('background');
  const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;return response(absent(t,{state:'queued',feedback_revision:1,assessment_status:'pending'}));}return response(absent(t));},{automatic:mode!=='read-only'});
  try{assert.equal(posts,0);if(mode==='background'){await act(async()=>{backgroundApp('active');await settle();});assert.equal(posts,1);}}finally{await h.close();}
 }
});
test('reactive store publications do not repeatedly submit when server still reports absent after a successful POST',async()=>{
 const t=target();let posts=0;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;return response(absent(t,{state:'queued',feedback_revision:1,assessment_status:'pending'}));}return response(absent(t));});
 try{assert.equal(posts,1);for(let i=0;i<4;i++)await act(async()=>{bump();await settle();});assert.equal(posts,1);}finally{await h.close();}
});

test('a definite automatic POST rejection remains manually recoverable in a separate screen controller',async()=>{
 const t=target();let posts=0;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;return response({error:'synthetic admission rejection'},409);}return response(absent(t));});
 try{await act(async()=>{h.tree.update(React.createElement(React.Fragment,null,React.createElement(Probe,{t}),React.createElement(Probe,{t,slot:1,automatic:false})));await settle();});assert.equal(posts,1);assert.match(values[1].notice,/retry|scor/i);assert.equal(values[1].busy,false);}finally{await h.close();}
});
test('offline correction preflight is bounded across reactive renders and recovers without a paid retry',async ctx=>{
 ctx.mock.timers.enable({apis:['setTimeout','setInterval','Date']});const t=target();let online=false,checks=0,posts=0;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/')){checks++;if(!online)throw Error('offline');return response(correction(t));}if(init.method==='POST'){posts++;return response(absent(t,{state:'queued',feedback_revision:1,assessment_status:'pending'}));}return response(absent(t));});
 try{assert.equal(checks,1);for(let i=0;i<4;i++)await act(async()=>bump());assert.equal(checks,1);assert.equal(posts,0);online=true;await act(async()=>{ctx.mock.timers.tick(5000);await settle();});assert.equal(checks,2);assert.equal(posts,1);}finally{await h.close();ctx.mock.timers.reset();}
});
test('rapid synchronized corrections coalesce to the latest revision before automatic scoring',async ctx=>{
 ctx.mock.timers.enable({apis:['setTimeout','setInterval','Date']});const t=target();let revision=0,posts=[];const completedState=completed(t);let current=completedState;
 initializeCorrections(API_URL,t.id,t.review.transcript_id,t.review.transcript);
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t,revision));if(init.method==='POST'){posts.push(JSON.parse(init.body));return response(absent(t,{state:'queued',feedback_revision:2,transcript_revision:revision,assessment_status:'pending'}));}return response(current);});
 try{
  current=absent(t,{state:'stale',stale:true,feedback_revision:1,retry_available:true,updated_at:completedState.updated_at});
  revision=1;await act(async()=>createCorrectionClient(API_URL).refresh(t.id));await act(async()=>ctx.mock.timers.tick(700));
  revision=2;await act(async()=>createCorrectionClient(API_URL).refresh(t.id));await act(async()=>ctx.mock.timers.tick(999));assert.equal(posts.length,0);
  await act(async()=>{ctx.mock.timers.tick(1);await settle();});assert.equal(posts.length,1);assert.equal(posts[0].transcript_revision,2);
 }finally{await h.close();ctx.mock.timers.reset();}
});


test('saved settings wait for synchronization and automatically refresh at the new context revision',async ctx=>{
 ctx.mock.timers.enable({apis:['setTimeout','setInterval','Date']});const t=target();t.contextId='12345678-1234-4234-8234-123456789abc';const local='settings-auto-'+t.id;
 saveRequirements(local,API_URL,{contextId:t.contextId,deckId:t.review.deck_id,revision:1,audience:'First audience',requiredDurationSeconds:300});
 initializeCorrections(API_URL,t.id,t.review.transcript_id,t.review.transcript);
 let current=absent(t,{context_id:t.contextId,state:'completed',feedback_revision:1,assessment_status:'insufficient_evidence',updated_at:'2026-10-17T02:00:00Z',requirements:{context_id:t.contextId,revision:1,audience:'First audience',required_duration_seconds:300}}),posts=0;
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t));if(init.method==='POST'){posts++;return response({...current,state:'queued',stale:false,assessment_status:'pending',feedback_revision:2,requirements:{...current.requirements,revision:2}});}return response(current);},{revision:1,local});
 try{
  await act(async()=>confirmRequirements(local,API_URL,{audience:'New audience',requiredDurationSeconds:360}));await act(async()=>ctx.mock.timers.tick(2000));assert.equal(posts,0);
  await act(async()=>{saveRequirements(local,API_URL,{contextId:t.contextId,deckId:t.review.deck_id,revision:2,audience:'New audience',requiredDurationSeconds:360});acceptServerRequirements(local,API_URL);current={...current,state:'stale',stale:true,retry_available:true};h.tree.update(React.createElement(Probe,{t,revision:2,local}));});
  await act(async()=>ctx.mock.timers.tick(999));assert.equal(posts,0);await act(async()=>{ctx.mock.timers.tick(1);await settle();});assert.equal(posts,1);
 }finally{await h.close();ctx.mock.timers.reset();}
});
test('a saved change during an unresolved provider request waits for its receipt before one replacement',async ctx=>{
 ctx.mock.timers.enable({apis:['setTimeout','setInterval','Date']});const t=target();let revision=0,posts=0,current=absent(t);
 const h=await mount(t,async(url,init={})=>{if(url.endsWith('/corrections/'))return response(correction(t,revision));if(init.method==='POST'){posts++;current=absent(t,{state:'queued',feedback_revision:posts,transcript_revision:revision,assessment_status:'pending',updated_at:`2026-10-17T03:0${posts}:00Z`});}return response(current);});
 try{
  assert.equal(posts,1);revision=1;current={...current,state:'stale',stale:true,requires_confirmation:true,retry_available:true};await act(async()=>{await createCorrectionClient(API_URL).refresh(t.id);await h.value.refresh();});
  await act(async()=>ctx.mock.timers.tick(2500));assert.equal(posts,1,'a submitted source must reconcile before any replacement');
  current={...current,requires_confirmation:false,updated_at:'2026-10-17T03:02:00Z'};await act(async()=>h.value.refresh());await act(async()=>{ctx.mock.timers.tick(1000);await settle();});assert.equal(posts,2);
 }finally{await h.close();ctx.mock.timers.reset();}
});

// Independent review reproduced this foreground/admission race.
test('independent: foreground owner reconciles a delayed accepted POST after reading absent',async ctx=>{
 ctx.mock.timers.enable({apis:['setInterval','Date']});
 const t=target();let posts=0,reads=0,release,current=absent(t);
 const h=await mount(t,async(url,init={})=>{
  if(url.endsWith('/corrections/'))return response(correction(t));
  if(init.method==='POST'){posts++;return new Promise(r=>release=()=>{current=absent(t,{state:'queued',feedback_revision:1,assessment_status:'pending'});r(response(current));});}
  reads++;return response(current);
 });
 try{
  assert.equal(posts,1);
  await act(async()=>{backgroundApp('background');backgroundApp('active');await settle();});
  assert.equal(h.value.state.state,'absent');
  await act(async()=>{release();await settle();});
  const before=reads;
  await act(async()=>{ctx.mock.timers.tick(10000);await settle();});
  assert.equal(posts,1);
  assert.ok(reads>before,`expected GET reconciliation for durable uncertain intent; reads stayed ${reads}`);
  assert.equal(h.value.state.state,'queued');
 }finally{await h.close();ctx.mock.timers.reset();}
});
test('independent: changing selected owner while automatic correction preflight is pending never posts the former owner',async()=>{
 const first=target(),second=target(),posts=[];let release,firstCorrection=true;
 const h=await mount(first,async(url,init={})=>{
  const owner=url.includes(first.id)?first:second;
  if(url.endsWith('/corrections/')){
   if(owner===first&&firstCorrection){firstCorrection=false;return new Promise(r=>release=()=>r(response(correction(first))));}
   return response(correction(owner));
  }
  if(init.method==='POST'){posts.push(owner.id);return response(absent(owner,{state:'queued',feedback_revision:1,assessment_status:'pending'}));}
  return response(absent(owner));
 });
 try{
  assert.equal(typeof release,'function');
  await act(async()=>{h.tree.update(React.createElement(Probe,{t:second}));await settle();});
  await act(async()=>{release();await settle();});
  assert.deepEqual(posts,[second.id]);
  assert.equal(h.value.state.attempt_id,second.id);
 }finally{await h.close();}
});
