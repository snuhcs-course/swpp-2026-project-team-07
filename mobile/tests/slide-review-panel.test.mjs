import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/slide-review-panel-loader.mjs';import {withFeedback,attemptId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});const React=await import('react');const {act,create}=await import('react-test-renderer');
const {SlideReviewSummary}=await import('../src/features/feedback/SlideReviewSummary.tsx');
const {writeStored}=await import('../src/services/storage.ts');const {reviewKey}=await import('../src/features/transcription/reviewStorage.ts');const {API_URL}=await import('../src/services/api.ts');
writeStored(reviewKey(API_URL,'attempt',attemptId),withFeedback());globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const part={attemptId,segments:[{startMs:0,endMs:1000}]};
const props={slide:0,part,localDeckId:'synthetic-phase5-panel',onEvidence:()=>{}};
const state=(extra={})=>({state:'completed',stale:false,feedback_revision:1,retry_available:false,availability:{state:'available'},requirements:{audience:'',required_duration_seconds:null},
 result:{stale:false,slides:[{slide_index:0,status:'successful',findings:[]}]},...extra});
const texts=r=>r.root.findAllByType('text').map(n=>n.props.children).flat(Infinity).filter(x=>typeof x==='string').join(' ');
test('summary renders zero/four findings, evidence actions, and recoverable dependency control',async()=>{
 let renderer,played=null;
 globalThis.phase5Panel={state:state(),busy:false,notice:'',ask:false,refresh(){},generate(){}};
 try{
  await act(async()=>{renderer=create(React.createElement(SlideReviewSummary,{...props,onEvidence:f=>{played=f;}}));});
  assert.match(texts(renderer),/Looks good!/);assert.match(texts(renderer),/Audience not provided/);
  assert.equal(renderer.root.findAllByType('pressable').some(n=>/Analyze/.test(n.props.accessibilityLabel||'')),false);
  const findings=Array.from({length:4},(_,i)=>({category:'content',priority:i+1,word_start:i,observation:`Problem ${i}`,suggestion:'Practice',start_ms:i*100,slide_quote:'Slide',speech_quote:'Speech'}));
  globalThis.phase5Panel={...globalThis.phase5Panel,state:state({result:{stale:false,slides:[{slide_index:0,status:'successful',findings}]}})};
  await act(async()=>renderer.update(React.createElement(SlideReviewSummary,{...props,onEvidence:f=>{played=f;}})));
  const details=renderer.root.findAllByType('pressable').filter(n=>n.props.accessibilityLabel==='Show content feedback details');
  assert.equal(details.length,4);for(const button of details)await act(async()=>button.props.onPress());
  const buttons=renderer.root.findAllByType('pressable').filter(n=>String(n.props.accessibilityLabel).startsWith('Review content evidence'));
  assert.equal(buttons.length,4);await act(async()=>buttons[2].props.onPress());assert.equal(played,findings[2]);assert.doesNotMatch(texts(renderer),/Looks good!/);
  globalThis.phase5Panel={...globalThis.phase5Panel,state:state({state:'waiting_descriptions',result:null,dependency:{state:'failed',retry_action:'generate_descriptions',retry_available:true}})};
  await act(async()=>renderer.update(React.createElement(SlideReviewSummary,props)));
  const retry=renderer.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel==='Retry feedback');
  assert.equal(retry.props.disabled,false);assert.match(texts(renderer),/Retry slide profiles/);
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('Go deeper is expandable and never generates feedback or changes the problem verdict',async()=>{
 let tree,generated=0;
 globalThis.phase5Panel={state:state({result:{stale:false,slides:[{slide_index:0,status:'successful',findings:[],enrichments:[{kind:'illustrative',idea:'Imagine an example for this audience.'}]}]}}),busy:false,notice:'',ask:false,refresh(){},generate(){generated++}};
 try{await act(async()=>{tree=create(React.createElement(SlideReviewSummary,props));});
  assert.match(texts(tree),/Looks good!/);assert.doesNotMatch(texts(tree),/Imagine an example/);
  await act(async()=>tree.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel==='Show optional enrichment').props.onPress());
  assert.match(texts(tree),/ILLUSTRATIVE IDEA/);assert.match(texts(tree),/Imagine an example/);assert.equal(generated,0);
  await act(async()=>tree.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel==='Hide optional enrichment').props.onPress());
  assert.doesNotMatch(texts(tree),/Imagine an example/);assert.equal(generated,0);
 }finally{if(tree)await act(async()=>tree.unmount());}
});

test('AI feedback has a clear primary heading and finding evidence expands without generation',async()=>{
 let tree,generated=0;const finding={category:'content',priority:1,word_start:0,observation:'The main point is missing.',suggestion:'State the main point.',start_ms:0,speech_quote:'Synthetic speech',slide_quote:'Synthetic slide'};
 globalThis.phase5Panel={state:state({result:{stale:false,slides:[{slide_index:0,status:'successful',findings:[finding]}]}}),busy:false,notice:'',ask:false,refresh(){},generate(){generated++}};
 try{await act(async()=>{tree=create(React.createElement(SlideReviewSummary,props));});
  assert.match(texts(tree),/AI feedback/);assert.doesNotMatch(texts(tree),/Synthetic speech/);
  const details=tree.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel==='Show content feedback details');assert.ok(details);
  await act(async()=>details.props.onPress());assert.match(texts(tree),/Synthetic speech/);assert.equal(generated,0);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
