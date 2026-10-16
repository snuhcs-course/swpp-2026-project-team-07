import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/qa-loader.mjs';
registerHooks({resolve,load});
const { saveAnalysisConsent } = await import('../src/features/transcription/analysisStorage.ts');
saveAnalysisConsent();
const {reviewDurableAnswer}=await import('../src/features/qa/client.ts');
const {files}=await import('./helpers/upload-native.mjs');
const input={id:'11111111-1111-4111-8111-111111111111',deckId:'22222222-2222-4222-8222-222222222222',audioUri:'file:///answer.m4a',durationMs:20000,questionJobId:12,questionId:'a'.repeat(32),part:1,slideIndex:0};
const result={verdict:'answered',did:'Direct answer',evidence:'Relevant example',clarify:'One detail',transcript:{text:'Original answer',words:[]},duration_ms:20000};
const state=(extra={})=>({attempt_id:input.id,question_job_id:12,question_id:input.questionId,part:1,
 processing:{status:'completed',processing_revision:1,requires_confirmation:false,retry_available:false},
 feedback:{state:'completed',feedback_revision:1,requires_confirmation:false,selection:{token:'f'.repeat(64)},retry_available:false,stale:false},result,...extra});
const response=(d,status=200)=>new Response(JSON.stringify(d),{status});
test('reopening a finished answer only reads the exact bound result',async()=>{
 const old=fetch,requests=[];globalThis.fetch=async(url,init={})=>{requests.push(init.method??'GET');return response(state());};
 try{assert.deepEqual(await reviewDurableAnswer(input),result);assert.deepEqual(requests,['GET','GET']);}finally{globalThis.fetch=old;}
});
test('uncertain transcription needs confirmation; retry retains the same ID and recording',async()=>{
 const old=fetch,posts=[];let completed=false;
 globalThis.fetch=async(url,init={})=>{
  if(init.method==='POST'){posts.push({url,body:JSON.parse(init.body)});completed=true;return response(state());}
  return response(completed?state():state({result:null,processing:{status:'failed',processing_revision:2,requires_confirmation:true,retry_available:true}}));
 };
 try{
  await assert.rejects(reviewDurableAnswer(input,false,undefined,true),e=>e.code==='confirmation_required');assert.equal(posts.length,0);
  assert.deepEqual(await reviewDurableAnswer(input,true,undefined,true),result);
  assert.equal(posts.length,1);assert.ok(posts[0].url.includes(input.id));assert.deepEqual(posts[0].body.processing,{processing_revision:2,acknowledge_uncertain:true});
 }finally{globalThis.fetch=old;}
});
test('saved failed answers do not automatically retry on reopening',async()=>{
 const old=fetch;globalThis.fetch=async(_url,init={})=>{assert.notEqual(init.method,'POST');return response(state({result:null,processing:{status:'failed',processing_revision:2,requires_confirmation:false}}));};
 try{await assert.rejects(reviewDurableAnswer(input),e=>e.code==='answer_stopped');}finally{globalThis.fetch=old;}
});
test('profile dependency retry uses its revision and confirmation without uploading audio',async()=>{
 const old=fetch,posts=[];let completed=false;
 const failed=state({result:null,feedback:{state:'waiting_descriptions',feedback_revision:1,requires_confirmation:false,dependency:{retry_action:'generate_descriptions',retry_available:true,requires_confirmation:true,description_set_id:'profile',processing_revision:3}}});
 globalThis.fetch=async(url,init={})=>{if(init.method==='POST'){posts.push({url,body:JSON.parse(init.body)});completed=true;return response({});}return response(completed?state():failed);};
 try{
  await assert.rejects(reviewDurableAnswer(input,false,undefined,true),e=>e.code==='confirmation_required');
  assert.deepEqual(await reviewDurableAnswer(input,true,undefined,true),result);
  assert.equal(posts.length,1);assert.ok(posts[0].url.endsWith('/descriptions/generate/'));assert.equal(posts[0].body.processing_revision,3);
 }finally{globalThis.fetch=old;}
});
test('lost submission acknowledgement reuses uploaded identity and saved result',async()=>{
 const old=fetch;files.set(input.audioUri,{data:'Synthetic audio only'});let bound=false,uploads=0;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/attempts/')){uploads++;const metadata=JSON.parse(init.body.get('metadata'));assert.equal(metadata.id,input.id);return response({attempt_id:input.id},201);}
  if(init.method==='POST'){bound=true;throw new Error('Acknowledgement lost');}
  return bound?response(state()):response({error:{code:'answer_not_found'}},404);
 };
 try{await assert.rejects(reviewDurableAnswer(input));assert.deepEqual(await reviewDurableAnswer(input,false,undefined,true),result);assert.equal(uploads,1);}finally{globalThis.fetch=old;files.clear();}
});

test('question generations and rerecorded answer attempts remain separated by API and question job',async()=>{
 const {readQaV2,saveQaV2,readQaHistory,saveAnswerAttempt}=await import('../src/features/qa/store.ts');
 const {readStored}=await import('../src/services/storage.ts');
 const set={runId:'run',audience:'Students',questions:[],answers:{},createdAt:'2026-10-16T00:00:00Z'};
 saveQaV2('http://one/api','deck',1,set);saveQaV2('http://one/api','deck',2,{...set,audience:'Researchers'});
 assert.equal(readQaV2('http://two/api','deck',1),null);
 assert.deepEqual(readQaHistory('http://one/api','deck').map(s=>s.jobId),[2,1]);
 saveAnswerAttempt('http://one/api','deck',{id:'first',audioUri:'file:///original',durationMs:10000,status:'done',at:'now'});
 saveAnswerAttempt('http://one/api','deck',{id:'second',audioUri:'file:///rerecorded',durationMs:10000,status:'judging',at:'now'});
 assert.equal(readStored('qa-answer:v2:http://one/api:deck:first').audioUri,'file:///original');
});

test('old provider consent blocks new Q&A uploads and retries; completed answers stay readable',async()=>{
 const {writeStored}=await import('../src/services/storage.ts');
 const old=fetch,posts=[];
 writeStored('analysis-consent:elevenlabs:scribe-v2:keyterms:v2',false);
 writeStored('analysis-consent:elevenlabs:scribe-v2:v1',true);
 writeStored('analysis-consent:openai:v1',true);
 let saved=null;
 globalThis.fetch=async(url,init={})=>{if(init.method==='POST'){posts.push(url);return response({});}return saved?response(saved):response({},404);};
 try{
  await assert.rejects(reviewDurableAnswer(input),e=>e.code==='transcription_consent_required');
  // Cancelling the disclosure grants no consent and sends no audio.
  await assert.rejects(reviewDurableAnswer(input),e=>e.code==='transcription_consent_required');
  saved=state({result:null,processing:{status:'failed',processing_revision:2,requires_confirmation:false,retry_available:true}});
  await assert.rejects(reviewDurableAnswer(input,false,undefined,true),e=>e.code==='transcription_consent_required');
  saved=state();assert.deepEqual(await reviewDurableAnswer(input),result);
  assert.equal(posts.length,0);
 }finally{globalThis.fetch=old;saveAnalysisConsent();}
});
