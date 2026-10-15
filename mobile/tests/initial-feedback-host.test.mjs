import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/initial-feedback-host-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {InitialFeedbackHost}=await import('../src/features/feedback/InitialFeedbackHost.tsx');
const {enableInitialFeedback}=await import('../src/features/feedback/automaticFeedback.ts');const {API_URL}=await import('../src/services/api.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('automatic host selects only eligible chosen takes, excluding historical and pending comparisons',async()=>{
 globalThis.hostCalls=[];globalThis.hostDecks=[{id:'new'},{id:'historical'},{id:'comparison'}];
 const part=id=>({attemptId:id,segments:[{startMs:0,endMs:1000}]});
 globalThis.hostStates={new:{run:{parts:[part('selected'),null]}},historical:{run:{parts:[part('old')]}},comparison:{run:{parts:[part('pending')]},compare:{}}};
 globalThis.hostReviews=Object.fromEntries(['selected','old','pending'].map(id=>[id,{attempt_id:id,deck_id:'server',transcript:{words:[{text:'synthetic'}]}}]));
 enableInitialFeedback(API_URL,'selected');enableInitialFeedback(API_URL,'pending');
 let renderer;try{await act(async()=>{renderer=create(React.createElement(InitialFeedbackHost));});
 assert.equal(globalThis.hostCalls.length,1);assert.equal(globalThis.hostCalls[0][0],'selected');assert.equal(globalThis.hostCalls[0][4],true);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});
