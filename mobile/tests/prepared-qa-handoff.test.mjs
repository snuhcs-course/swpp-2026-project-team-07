import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {act,create} from 'react-test-renderer';
import React from 'react';
import {load,resolve} from './helpers/qa-screen-runtime-loader.mjs';
registerHooks({load,resolve});
const {QAScreen}=await import('../src/screens/QAScreen.tsx');
const {API_URL}=await import('../src/services/api.ts');
const {saveQaV2}=await import('../src/features/qa/store.ts');
const {setAppLanguage}=await import('../src/design/language.ts');
const {displayTranslations}=await import('../src/features/localization/useDisplayTranslation.ts');
const {markNewWording}=await import('../src/features/localization/firstWording.ts');
const {runtime}=await import('./helpers/qa-screen-runtime-native.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;globalThis.require=x=>x;
test('a new Q&A stays in ordinary preparation until Korean question one is ready; it can open ahead of its follow-up, without a new job',async()=>{
  const id=73901,deck='fresh-qa-handoff-deck',runId='fresh-run-handoff';
  const question={id:'1'.repeat(32),panelist:'P1',role:'Student',topic:'Rooms',question:'Why does the room close?',follow_up:'Which hours are available?',slide_index:0};
  saveQaV2(API_URL,deck,id,{runId,jobId:id,questions:[question],answers:{},audience:'Students',createdAt:''});
  globalThis.qaScreenModel={transcribed:true,transcripts:new Map(),stages:new Map(),deck:{id:deck,hue:'blue',pages:[],slides:[]},state:{run:{id:runId,parts:[]}}};
  let generated=0;
  globalThis.qaScreenValue={requirements:{audience:'Students',requiredDurationSeconds:300},requirementsDirty:false,state:{state:'completed',stale:false,attempt_id:'recording',requirements:{audience:'Students'},result:{job_id:id,stale:false,questions:[question]}},notice:'',busy:false,generate:()=>{generated++;},refresh:()=>{}};
  runtime.speeches=[];setAppLanguage('ko');markNewWording(API_URL,'questions',String(id));
  const asks=[];displayTranslations.setPreparationOwner(requests=>{asks.push(...requests);return()=>{};});
  let tree;
  try {
    await act(async()=>{tree=create(React.createElement(QAScreen));});
    const words=()=>tree.root.findAllByType('text').map(n=>n.children.join(' '));
    assert.ok(!words().some(line=>line.includes(question.question)));assert.equal(runtime.speeches.length,0);
    assert.ok(asks.some(r=>r.fields['questions.0.question']===question.question));assert.equal(generated,0);
    const r={kind:'questions',resource_id:String(id),fields:{'questions.0.question':question.question}};
    const translated='열람실은 왜 문을 닫나요?';
    await act(async()=>{displayTranslations.install(r,{'questions.0.question':{source:question.question,en:question.question,ko:translated}},'ko');});
    assert.ok(words().includes('“'+translated+'”'));assert.ok(!words().some(line=>line.includes(question.question)));
    assert.ok(runtime.speeches.some(s=>s.text===translated&&s.options.language==='ko'));
    assert.equal(displayTranslations.get({...r,language:'ko'},'questions.0.follow_up',question.follow_up),null);
    assert.equal(generated,0);
  } finally {if(tree)await act(async()=>tree.unmount());displayTranslations.setPreparationOwner(undefined);setAppLanguage('en');}
});
