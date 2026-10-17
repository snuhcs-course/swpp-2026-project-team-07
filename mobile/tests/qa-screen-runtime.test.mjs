import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/qa-screen-runtime-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {QAScreen}=await import('../src/screens/QAScreen.tsx');
const {PageSurface}=await import('../src/design/ui.tsx');
const {PanView}=await import('../src/design/PanView.tsx');
const Surface=PageSurface.type??PageSurface;
const {saveQaV2,readQaV2}=await import('../src/features/qa/store.ts');
const {API_URL}=await import('../src/services/api.ts');
const {runtime,flattenStyle}=await import('./helpers/qa-screen-runtime-native.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// Asset identities only; this test never reads the phone or a user recording.
globalThis.require=asset=>asset;
const question=i=>({id:String(i).padStart(32,'a'),panelist:'Audience '+i,role:'Student',slide_index:i-1,topic:'Synthetic topic '+i,question:'Synthetic question '+i,follow_up:'Synthetic follow-up '+i});
function setup(){
 runtime.routes=[];runtime.mounts=0;runtime.unmounts=0;runtime.speechStops=0;runtime.playerStops=0;
 const questions=[1,2,3].map(question);
 const cached={jobId:73001,runId:'runtime-run',audience:'Saved audience',questions,answers:{},createdAt:'2026-01-01T00:00:00Z'};
 saveQaV2(API_URL,'runtime-deck',cached.jobId,cached);
 globalThis.qaScreenModel={transcribed:true,transcripts:new Map(),stages:new Map(),deck:{id:'runtime-deck',hue:'blue',pages:[],slides:[]},state:{run:{id:'runtime-run',parts:[]}}};
 globalThis.qaScreenValue={requirements:{audience:'Saved audience',requiredDurationSeconds:300},requirementsDirty:false,state:{state:'completed',stale:false,attempt_id:'runtime-attempt',requirements:{audience:'Saved audience'},result:{job_id:cached.jobId,stale:false,questions}},notice:'',busy:false,generate:()=>{throw new Error('Question navigation must never generate');},refresh:()=>{}};
 return cached;
}
const button=(r,label)=>r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel===label);
function assertPageVisible(r,index){
 const words=r.root.findAllByType('text').map(n=>n.children.join(' '));
 assert.ok(words.includes('Audience Q&A'));
 assert.ok(words.some(text=>text.startsWith('Question '+index+' of 3')));
 assert.ok(button(r,'Back'));
 assert.ok(button(r,'Answer the question'));
 const surface=r.root.findByType(Surface);
 let node=surface.parent;
 while(node){if(node.type==='animated'){const style=flattenStyle(node.props.style),reactStyle=flattenStyle(node.props.style,true);assert.notEqual(style.display,'none');assert.ok((style.opacity??1)>0,'Q&A ancestor remains visible');assert.ok((reactStyle.opacity??1)>0,'a React commit must retain the completed page opacity');}node=node.parent;}
 assert.equal(runtime.unmounts,0,'question navigation must retain the mounted recorder/screen');
 assert.deepEqual(runtime.routes,[],'Next stays on the same Q&A page');
}
test('actual Next buttons advance a cached three-question page while retaining header, surface and answer control',async()=>{
 const cached=setup();let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const surface=r.root.findByType(Surface),pan=r.root.findByType(PanView);
  assertPageVisible(r,1);assert.equal(runtime.mounts,1);
  for(const index of [2,3]){
   const next=button(r,'Next');assert.ok(next);
   await act(async()=>next.props.onPress());
   assertPageVisible(r,index);
   assert.equal(r.root.findByType(Surface),surface,'Next preserves the page surface');
   assert.equal(r.root.findByType(PanView),pan,'Next preserves its responder');
  }
  assert.equal(!!button(r,'Next'),false);
  assert.equal(readQaV2(API_URL,'runtime-deck',cached.jobId).questions.length,3);
  assert.deepEqual(readQaV2(API_URL,'runtime-deck',cached.jobId).answers,{});
 }finally{if(r)await act(async()=>r.unmount());}
 assert.equal(runtime.unmounts,1);
});

test('Scribe consent Cancel keeps a saved answer and Continue submits that same identity once',async()=>{
 const cached=setup();
 const {writeStored}=await import('../src/services/storage.ts');
 const {files}=await import('./helpers/upload-native.mjs');
 const answer={id:'11111111-1111-4111-8111-111111111111',questionId:cached.questions[0].id,questionJobId:cached.jobId,audioUri:'file:///scribe-answer.m4a',durationMs:20000,status:'error',error:'Retry saved answer',at:'2026-10-17T00:00:00Z'};
 saveQaV2(API_URL,'runtime-deck',cached.jobId,{...cached,answers:{'0-0':answer}});
 writeStored('analysis-consent:elevenlabs:scribe-v2:keyterms:v2',false);
 files.set(answer.audioUri,{data:'Synthetic audio'});
 const {saveReview}=await import('../src/features/transcription/reviewStorage.ts');
 const {wireResult,attemptId}=await import('./helpers/review-fixtures.mjs');
 globalThis.qaScreenValue.state.attempt_id=attemptId;
 saveReview(API_URL,wireResult({audio_url:API_URL.replace(/\/api\/?$/,'')+'/recordings/synthetic.wav'}));
 const old=fetch,requests=[];let bound=false,r;
 const result={verdict:'answered',did:'Direct answer',evidence:'Relevant example',clarify:'One detail',transcript:{text:'Um, original answer',words:[]},duration_ms:20000};
 globalThis.fetch=async(url,init={})=>{
  requests.push({url,method:init.method??'GET'});
  if(url.endsWith('/attempts/')){assert.equal(JSON.parse(init.body.get('metadata')).id,answer.id);return new Response(JSON.stringify({attempt_id:answer.id}),{status:201});}
  if(init.method==='POST')bound=true;
  const state={attempt_id:answer.id,question_job_id:cached.jobId,question_id:answer.questionId,part:0,processing:{status:'completed',processing_revision:1},feedback:{state:'completed'},result};
  return new Response(JSON.stringify(state),{status:bound?200:404});
 };
 const byText=text=>r.root.findAllByType('pressable').find(n=>n.findAllByType('text').some(t=>t.children.join('').includes(text)));
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  await act(async()=>byText('Couldn’t review this answer').props.onPress());
  assert.ok(byText('Continue'),JSON.stringify({requests,saved:readQaV2(API_URL,'runtime-deck',cached.jobId).answers,text:r.root.findAllByType('text').map(n=>n.children.join(''))}));assert.ok(requests.every(q=>q.method==='GET'));
  await act(async()=>byText('Cancel').props.onPress());
  assert.equal(readQaV2(API_URL,'runtime-deck',cached.jobId).answers['0-0'].id,answer.id);
  assert.ok(files.has(answer.audioUri));assert.ok(requests.every(q=>q.method==='GET'));
  await act(async()=>byText('Couldn’t review this answer').props.onPress());
  await act(async()=>byText('Continue').props.onPress());
  assert.equal(requests.filter(q=>q.url.endsWith('/attempts/')&&q.method==='POST').length,1);
  const saved=readQaV2(API_URL,'runtime-deck',cached.jobId).answers['0-0'];
  assert.equal(saved.id,answer.id);assert.equal(saved.status,'done');assert.deepEqual(saved.result,result);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;files.clear();delete globalThis.qaReviews;}
});
