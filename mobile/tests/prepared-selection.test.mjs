import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve as qaResolve, load } from './helpers/qa-loader.mjs';
import React from 'react';
import {act,create} from 'react-test-renderer';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const data = code => ({url:'data:text/javascript,'+encodeURIComponent(code),shortCircuit:true});
registerHooks({load,resolve(spec,ctx,next){
  if ((ctx.parentURL??'').endsWith('/SelectedPreparationHost.tsx')) {
    if(spec.endsWith('/presentations/store'))return data("export const deckById=id=>id?{id}:null;export const getDeckState=id=>({run:{id:'synthetic-work',parts:[]}});");
    if(spec.endsWith('/presentations/useDeckModel'))return data('export const deckModel=(deck,state)=>({deck,state,n:1,stages:new Map()});');
    if(spec==='react-native')return data("export const AppState={currentState:'active',addEventListener:()=>({remove(){}})};");
    if(spec.endsWith('/services/backendFetch'))return data('export const backendFetch=(...v)=>globalThis.fixtureFetch(...v);');
  }
  return qaResolve(spec,ctx,next);
}});
const {SelectedPreparationHost}=await import('../src/features/localization/SelectedPreparationHost.tsx');
const {displayTranslations}=await import('../src/features/localization/useDisplayTranslation.ts');
const {prepareSavedQa}=await import('../src/features/localization/selectedProse.ts');
const {saveQa,readQa}=await import('../src/features/qa/store.ts');
const make=(id,audio)=>({id:undefined,runId:id,audience:'Synthetic',questions:[{id:'abc',panelist:'P1',role:'not displayed',topic:'not displayed',
  slide_index:0,question:'Why are the rooms closed?',follow_up:'Which hours are available?'}],
  answers:{'0-0':{status:'done',questionId:'abc',audioUri:audio,durationMs:734,result:{verdict:'answered',did:'You gave both hours.',
    evidence:'You mentioned opening hours.',clarify:'Explain the closing time.',transcript:{text:'Raw original spoken answer.',words:[]}}}},createdAt:'2026-11-21'});
test('selected phone archive preparation starts on SQLite receipt before a screen or flag, and excludes another deck, transcript, recording, and mismatched answers',async()=>{
  const front=make('synthetic-work','file:///invented-answer.wav'),other=make('other-work','file:///other.wav');
  saveQa('other-deck',other);
  const captured=[];
  const translation='설명을 확인했어요.';
  globalThis.fixtureFetch=async(url,init)=>{
    assert.match(url,/\/localization\/prepared\/$/);assert.equal(init.method,'POST');
    const body=JSON.parse(init.body);captured.push(body);
    return Response.json({kind:body.kind,resource_id:body.resource_id,revision:'',state:'completed',next_cursor:null,
      fields:Object.fromEntries(Object.entries(body.fields).map(([p,source])=>[p,{en:source,ko:translation,source}]))});
  };
  let tree;
  try {
    saveQa('front-deck',make('older-work-on-same-deck','file:///archived.wav'));
    await act(async()=>{tree=create(React.createElement(SelectedPreparationHost,{deckId:'front-deck'}));});
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,210));});
    assert.deepEqual(captured,[],'opening a deck cannot submit a different saved rehearsal from that deck');
    await act(async()=>{saveQa('front-deck',front);await new Promise(resolve=>setTimeout(resolve,260));});
    assert.equal(captured.length,1);assert.equal(captured[0].resource_id,'synthetic-work');assert.equal(captured[0].kind,'legacy_qa');
    assert.deepEqual(Object.keys(captured[0].fields).sort(),['answers.0.0.clarify','answers.0.0.did','answers.0.0.evidence','questions.0.follow_up','questions.0.question']);
    assert.doesNotMatch(JSON.stringify(captured),/Raw original|\.wav|other-work|not displayed/);
    const resource={kind:'legacy_qa',resource_id:front.runId};
    assert.equal(displayTranslations.get({...resource,language:'ko'},'questions.0.question',front.questions[0].question),translation);
    assert.deepEqual(readQa('front-deck').answers,front.answers);
    const wrong=structuredClone(front);wrong.answers['0-0'].questionId='wrong-question';
    assert.deepEqual(Object.keys(prepareSavedQa(wrong)[0].fields).sort(),['questions.0.follow_up','questions.0.question']);
  } finally {if(tree)await act(async()=>tree.unmount());}
});
test('a usable current job takes precedence over older sets from the same selected visits and a phone archive',async()=>{
  const {selectedProse}=await import('../src/features/localization/selectedProse.ts');
  const {saveQaV2}=await import('../src/features/qa/store.ts');
  const {qaScope}=await import('../src/features/qa/state.ts');
  const {writeStored}=await import('../src/services/storage.ts');
  const api='https://selected.invalid/api',deck='synthetic-job-deck',id='11111111-1111-4111-8111-111111111111';
  const run={id:'selected-run',parts:[{attemptId:id,segments:[{startMs:0,endMs:2000}]}]},scope=qaScope(run,null);
  const makeQuestion=(job)=>({id:String(job).padStart(32,'a'),panelist:'P1',role:'Student',topic:'Library',slide_index:0,
    question:'Why does option '+job+' work?',follow_up:'Which schedule works?'});
  for(const jobId of [37,38])saveQaV2(api,deck,jobId,{jobId,runId:run.id,scope,audience:'',questions:[makeQuestion(jobId)],answers:{},createdAt:''});
  saveQa(deck,{...make('earlier-run','file:///invented.wav')});
  const job=37,questions=[makeQuestion(job)],state={attempt_id:id,scope,qa_version:'audience-qa-v2',state:'completed',feedback_revision:1,
    stale:false,source_revisions:{[id]:0},requirements:{context_id:null,revision:null,audience:''},selection:null,availability:{state:'available'},
    retry_available:false,requires_confirmation:false,result:{job_id:job,qa_version:'audience-qa-v2',stale:false,questions}};
  writeStored('qa-state:v2:'+JSON.stringify([api,id,scope]),state);
  const model={deck:{id:deck},n:1,state:{run},stages:new Map()};
  const rows=selectedProse(model,api);
  assert.deepEqual(rows.map(r=>[r.kind,r.resource_id]),[['questions','37']]);
  assert.equal(rows[0].fields['questions.0.question'],questions[0].question);
});
