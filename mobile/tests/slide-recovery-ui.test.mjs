// OpenAI Codex, issue #49: docs/ai-collaboration-prompts-iteration-2.md.
// Real review screens and recovery components; native boundaries and controller responses are synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/ai-overview-screen-loader.mjs';
import { withFeedback } from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
const React=await import('react'),{act,create}=await import('react-test-renderer');
const {runtime}=await import('./helpers/ai-overview-screen-native.mjs');
const {ReviewScreen}=await import('../src/screens/ReviewScreen.tsx');
const {FullReviewScreen}=await import('../src/screens/FullReviewScreen.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const text=tree=>JSON.stringify(tree.toJSON());
const button=(tree,label)=>tree.root.findAllByType('pressable').find(node=>node.props.accessibilityLabel===label);
function setup({state='failed',status='successful',retry=true,availability='available',stale=false,missing=false}={}) {
 const review=withFeedback(),part={attemptId:review.attempt_id,segments:[{startMs:0,endMs:1000},{startMs:1500,endMs:2000}]};
 runtime.routes=[];runtime.plays=[];runtime.players=[];runtime.scrolls=[];runtime.audio=new Map();runtime.scores=null;
 runtime.nav={deckId:'synthetic-recovery',sel:0,slide:0,from:null,nav:null};
 runtime.model={deck:{id:'synthetic-recovery',title:'Synthetic recovery fixture',hue:'blue',pages:[],slides:[{title:'One'},{title:'Two'}],targets:[60,60],text:'ready',timing:{source:'suggested'}},
  n:2,state:{run:{id:'synthetic-run',parts:[part,{...part,attemptId:'second'}],createdAt:'2026-11-03T00:00:00Z',sel:0}},times:[1.5,1.5],total:3,targetSum:120,lines:[],transcripts:new Map([[review.attempt_id,review.transcript]]),stages:new Map([[review.attempt_id,'done']]),stats:{wpm:120}};
 const assessed=state==='completed'&&status==='successful'&&!missing;
 runtime.feedback={items:[{slide:0,status:stale?'outdated':assessed?'reviewed':'recovery_needed',label:stale?'Feedback outdated':assessed?'No issues found':'Analysis failed',assessed,findingCount:0,findings:[]},{slide:1,status:'unavailable',label:'AI feedback unavailable',assessed:false,findingCount:0,findings:[]}],
  aggregate:{recorded:2,assessed:0,findings:0,slidesWithFindings:0,partial:0,pending:0,outdated:0,recoveryNeeded:2,insufficient:0,notAnalyzed:0},refresh:async()=>{},notice:''};
 runtime.review=review;runtime.requirements={deckId:review.deck_id,contextId:'saved-context',revision:7};runtime.requirementsDirty=false;
 runtime.slideReviewCalls=[];runtime.recoveryActions=[];
 const summary={slide_index:0,status,findings:[]};
 runtime.slideReview={state:{state,stale,feedback_revision:3,retry_available:retry,availability:{state:availability},dependency:null,
  error:state==='failed'?{code:'provider_failed',message:'Feedback could not be generated. Your recording is saved.'}:null,
  result:missing?null:{stale:false,slides:[summary]}},busy:false,initial:null,notice:'',ask:false,
  refresh:async()=>runtime.recoveryActions.push('refresh'),generate:async()=>runtime.recoveryActions.push('retry'),confirm:()=>runtime.recoveryActions.push('confirm'),cancel:()=>runtime.recoveryActions.push('cancel')};
 return part;
}
async function render(Component,run){let tree;try{await act(async()=>{tree=create(React.createElement(Component));});await run(tree);}finally{if(tree)await act(async()=>tree.unmount());}}
async function open(tree){const entry=tree.root.findAllByType('pressable').find(node=>node.props.accessibilityLabel?.startsWith('Read slide 1 feedback:'));assert.ok(entry);await act(async()=>entry.props.onPress());}

test('every affected Full Review slide links to existing selected-slide navigation without generating',async()=>{
 setup();await render(FullReviewScreen,async tree=>{
  for(const [label,index] of [['Analysis failed',0],['AI feedback unavailable',1]]) {
   const link=button(tree,`Review slide ${index+1}: ${label}`);assert.ok(link);await act(async()=>link.props.onPress());
   assert.deepEqual(runtime.routes.at(-1),['review',{nav:'fade',deckId:'synthetic-recovery',sel:index,from:'full'}]);
  }
  assert.deepEqual(runtime.recoveryActions,[]);assert.deepEqual(runtime.slideReviewCalls,[]);
 });
});

test('a failed slide without findings opens existing details and its one explicit controller keeps exact visits and context',async()=>{
 const part=setup();await render(ReviewScreen,async tree=>{
  assert.equal(runtime.slideReviewCalls.length,0);await open(tree);
  assert.match(text(tree),/Analysis failed/);assert.match(text(tree),/Your recording is saved/);
  assert.equal(tree.root.findAllByType('scroll').length,1);
  assert.deepEqual(runtime.slideReviewCalls[0],[part.attemptId,{context_id:'saved-context',slides:[{slide_index:0,segments:[{start_ms:0,end_ms:1000},{start_ms:1500,end_ms:2000}]}]},runtime.review,7,false,'synthetic-recovery']);
  assert.deepEqual(runtime.recoveryActions,[]);await act(async()=>button(tree,'Retry feedback').props.onPress());assert.deepEqual(runtime.recoveryActions,['retry']);
  await act(async()=>button(tree,'Close feedback details').props.onPress());assert.equal(tree.root.findAllByType('scroll').length,0);assert.deepEqual(runtime.routes,[]);
 });
});

test('rejected and missing completed feedback has an explicit server-gated Retry, including cooldown',async()=>{
 for(const entry of [{status:'invalid_evidence'},{status:'model_error'},{missing:true}])for(const retry of [true,false]) {
  setup({state:'completed',...entry,retry});await render(ReviewScreen,async tree=>{
   await open(tree);const action=button(tree,'Retry feedback');assert.ok(action);assert.equal(action.props.disabled,!retry);
   assert.doesNotMatch(text(tree),/No issue flagged/);
  });
 }
});

test('zero findings, partial, insufficient, unavailable and outdated remain distinct in the same dialog',async()=>{
 for(const [change,label,action,disabled] of [
  [{state:'completed'},'No issue flagged',null,false],
  [{state:'completed',status:'partial'},'Some feedback couldn’t be verified',null,false],
  [{state:'completed',status:'insufficient_evidence'},'The AI could not assess this slide',null,false],
  [{state:'unavailable',availability:'unavailable'},'Analysis unavailable', 'Retry feedback',true],
  [{stale:true},'Feedback outdated','Update feedback',false],
 ]) {
  setup(change);await render(ReviewScreen,async tree=>{
   await open(tree);assert.ok(text(tree).includes(label));
   if(action)assert.equal(button(tree,action).props.disabled,disabled);else assert.equal(button(tree,'Retry feedback'),undefined);
   await act(async()=>button(tree,'Refresh slide feedback status').props.onPress());assert.deepEqual(runtime.recoveryActions,['refresh']);
  });
 }
});

test('uncertain retry reuses its confirmation and cancel controls',async()=>{
 setup();runtime.slideReview.ask=true;await render(ReviewScreen,async tree=>{
  await open(tree);assert.match(text(tree),/may incur another charge/);
  await act(async()=>button(tree,'Confirm feedback retry').props.onPress());await act(async()=>button(tree,'Cancel feedback retry').props.onPress());
  assert.deepEqual(runtime.recoveryActions,['confirm','cancel']);
 });
});

test('a local recording without a timed transcript opens honest details without a server controller',async()=>{
 setup();runtime.review=null;runtime.feedback.items[0]={...runtime.feedback.items[0],status:'transcribing',label:'Transcript pending'};
 await render(ReviewScreen,async tree=>{
  await open(tree);assert.match(text(tree),/Transcript pending/);assert.match(text(tree),/usable word timing/);
  assert.equal(runtime.slideReviewCalls.length,0);assert.equal(button(tree,'Retry feedback'),undefined);assert.deepEqual(runtime.recoveryActions,[]);
 });
});
