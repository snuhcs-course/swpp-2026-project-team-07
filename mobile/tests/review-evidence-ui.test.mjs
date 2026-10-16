import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/review-evidence-loader.mjs';registerHooks({resolve,load});
const React=await import('react'),{act,create}=await import('react-test-renderer');
const {SlideReviewSummary}=await import('../src/features/feedback/SlideReviewSummary.tsx');
const {withFeedback}=await import('./helpers/feedback-fixtures.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const review=withFeedback(),old=review.feedback_analysis.result;
globalThis.qaReviews={[review.attempt_id]:review};
function setup(status){globalThis.reviewEvidenceHook={busy:false,initial:'started',notice:'',refresh:()=>{},generate:()=>{throw new Error('No AI requests from status rendering');},state:{state:'completed',stale:false,feedback_revision:1,availability:{state:'available'},requirements:{audience:'General audience',required_duration_seconds:300},
 result:{stale:false,slides:[{slide_index:0,status,findings:status==='partial'?[{...old.suggestions[0],category:'content',priority:1}]:[],enrichments:[]}]}}};}
test('validation failure statuses never blame insufficient recorded speech and valid partial cards stay playable',async()=>{
 for(const [status,label]of [['invalid_evidence','Feedback couldn’t be verified'],['model_error','AI response couldn’t be processed'],['partial','Some feedback couldn’t be verified']]){
  setup(status);let renderer,played=0;
  try{await act(async()=>{renderer=create(React.createElement(SlideReviewSummary,{slide:0,part:{attemptId:review.attempt_id,segments:[{startMs:0,endMs:1000}]},localDeckId:'evidence-ui',onEvidence:()=>played++}));});
   const text=JSON.stringify(renderer.toJSON());assert.ok(text.includes(label));assert.ok(!text.includes('Insufficient evidence'));
   if(status==='partial'){const details=renderer.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel==='Show content feedback details');assert.ok(details);await act(async()=>details.props.onPress());const listen=renderer.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel?.startsWith('Review content evidence'));assert.ok(listen);await act(async()=>listen.props.onPress());assert.equal(played,1);}
  }finally{if(renderer)await act(async()=>renderer.unmount());}
 }
});
