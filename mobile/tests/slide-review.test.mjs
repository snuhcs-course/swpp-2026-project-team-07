import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/domain-loader.mjs';
registerHooks({ resolve, load });
const { reviewScope, parseSlideReview, reviewStatus } = await import('../src/features/feedback/slideReview.ts');
const part = { attemptId: 'take-1', segments: [{startMs: 0, endMs: 1000}, {startMs: 2000, endMs: 3000}] };
const scope = reviewScope(0, part, null);
test('scope preserves first/return visits and ignores run labels', () => {
 assert.deepEqual(scope, {context_id: null, slides: [{slide_index: 0, segments: [{start_ms: 0, end_ms: 1000},{start_ms: 2000, end_ms: 3000}]}]});
});
const base = {attempt_id: 'take-1', feedback_revision: 0, state: 'absent', stale: false, result: null, scope, review_version:'slide-review-v3',
 availability:{state:'available'},retry_available:false,requires_confirmation:false,requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null}};
test('missing, failed, insufficient, outdated and successful are distinct', () => {
 assert.equal(reviewStatus(base, 0), 'Not analyzed');
 assert.equal(reviewStatus({...base,state:'failed'},0), 'Analysis failed');
 assert.equal(reviewStatus({...base,state:'queued'},0), 'Queued for AI feedback');
 const done={...base,state:'completed',result:{stale:false,slides:[{slide_index:0,status:'insufficient_evidence',findings:[],enrichments:[]}]}};
 assert.equal(reviewStatus(done,0),'The AI could not assess this slide from the available evidence');
 done.result.slides[0].status='successful'; assert.equal(reviewStatus(done,0),'Looks good!');
 assert.equal(reviewStatus({...done,stale:true},0),'Feedback outdated');
});
test('reject responses for other takes, visit selections and oversized summaries', () => {
 assert.throws(()=>parseSlideReview({...base,attempt_id:'another'},'take-1',scope,null));
 assert.throws(()=>parseSlideReview({...base,scope:reviewScope(1,part,null)},'take-1',scope,null));
 assert.throws(()=>parseSlideReview({...base,state:'completed',result:{stale:false,review_version:'slide-review-v3',slides:[{slide_index:0,status:'successful',findings:Array(5).fill({})}]}},'take-1',scope,null));
 assert.equal(parseSlideReview(base,'take-1',scope,null).state,'absent');
});

test('failed profile dependencies are recoverable, not indefinitely pending',()=>{
 const failed={...base,state:'waiting_descriptions',dependency:{state:'failed',retry_action:'generate_descriptions',retry_available:true}};
 assert.equal(reviewStatus(failed,0),'Slide profile analysis failed');
 assert.equal(reviewStatus({...failed,dependency:{...failed.dependency,requires_confirmation:true}},0),'Profile retry needs confirmation');
});
test('verify original speech and slide evidence before enabling playback',async()=>{
 const {withFeedback}=await import('./helpers/feedback-fixtures.mjs');
 const review=withFeedback();const old=review.feedback_analysis.result;
 const selected={context_id:null,slides:[{slide_index:0,segments:[{start_ms:0,end_ms:1000}]}]};
 const finding={...old.suggestions[0],category:'graph',priority:1};
 const s={...base,attempt_id:review.attempt_id,scope:selected,feedback_revision:1,state:'completed',
 result:{...old,review_version:'slide-review-v3',transcript_revision:0,slides:[{slide_index:0,status:'successful',evaluation_mode:'informative_descriptive',findings:[finding],enrichments:[]}]}};
 assert.equal(parseSlideReview(s,review.attempt_id,selected,review).result.slides[0].findings.length,1);
 for(const replacement of [{speech_quote:'Invented'},{slide_quote:'Invented'},{source_id:'f'.repeat(64)},{start_ms:50},{end_ms:0},{visit_id:1}]){
  const bad=structuredClone(s);Object.assign(bad.result.slides[0].findings[0],replacement);
  assert.throws(()=>parseSlideReview(bad,review.attempt_id,selected,review));
 }
});

test('shared backend/mobile allocation golden cases include float ties and Unicode',async()=>{
 const {readFileSync}=await import('node:fs');const {slideTargets}=await import('../src/domain/slides.ts');
 const cases=JSON.parse(readFileSync(new URL('../../backend/rehearsals/testdata/slide_review_timing.json',import.meta.url),'utf8'));
 for(const c of cases)assert.deepEqual(slideTargets(c.texts??c.counts.map(n=>Array(n).fill('keywords').join(' ')),c.total),c.expected);
});

test('optional enrichment and purpose are validated; v1 results survive only as outdated',async()=>{
 const {withFeedback}=await import('./helpers/feedback-fixtures.mjs');
 const review=withFeedback(),old=review.feedback_analysis.result;
 const selected={context_id:null,slides:[{slide_index:0,segments:[{start_ms:0,end_ms:1000}]}]};
 const value={...base,attempt_id:review.attempt_id,scope:selected,feedback_revision:1,state:'completed',
  result:{...old,review_version:'slide-review-v3',transcript_revision:0,slides:[{slide_index:0,status:'successful',evaluation_mode:'informative_descriptive',findings:[],enrichments:[{kind:'illustrative',idea:'Imagine a classroom example.'}]}]}};
 assert.equal(parseSlideReview(value,review.attempt_id,selected,review).result.slides[0].enrichments.length,1);
 for(const changes of [{evaluation_mode:'invented'},{enrichments:[{kind:'sourced',idea:'Unverified fact'}]},{enrichments:Array(3).fill({kind:'illustrative',idea:'Example'})}]){
  const bad=structuredClone(value);Object.assign(bad.result.slides[0],changes);assert.throws(()=>parseSlideReview(bad,review.attempt_id,selected,review));
 }
 const historical=structuredClone(value);historical.result.review_version='slide-review-v1';delete historical.result.slides[0].enrichments;delete historical.result.slides[0].evaluation_mode;
 assert.throws(()=>parseSlideReview(historical,review.attempt_id,selected,review));
 historical.stale=true;historical.result.stale=true;
 assert.equal(parseSlideReview(historical,review.attempt_id,selected,review).result.review_version,'slide-review-v1');
 assert.equal(reviewStatus(historical,0),'Feedback outdated');
 const updating={...historical,state:'queued',stale:false,feedback_revision:2};
 assert.equal(parseSlideReview(updating,review.attempt_id,selected,review).state,'queued');
 assert.equal(reviewStatus(updating,0),'Queued for AI feedback');
});


test('v2 review results remain readable only as retained outdated results',async()=>{
 const {withFeedback}=await import('./helpers/feedback-fixtures.mjs');
 const review=withFeedback(),old=review.feedback_analysis.result;
 const selected={context_id:null,slides:[{slide_index:0,segments:[{start_ms:0,end_ms:1000}]}]};
 const value={...base,attempt_id:review.attempt_id,scope:selected,feedback_revision:1,state:'stale',stale:true,
 result:{...old,stale:true,review_version:'slide-review-v2',transcript_revision:0,slides:[{slide_index:0,status:'successful',evaluation_mode:'informative_descriptive',findings:[],enrichments:[]}]}};
 assert.equal(parseSlideReview(value,review.attempt_id,selected,review).result.review_version,'slide-review-v2');
 assert.equal(reviewStatus(value,0),'Feedback outdated');
 value.result.stale=false;assert.throws(()=>parseSlideReview(value,review.attempt_id,selected,review));
});


test('scope equality ignores object order while preserving exact visits and playback ranges',()=>{
 const reordered={slides:scope.slides.map(s=>({segments:s.segments.map(v=>({end_ms:v.end_ms,start_ms:v.start_ms})),slide_index:s.slide_index})),context_id:scope.context_id};
 assert.equal(parseSlideReview({...base,scope:reordered},'take-1',scope,null).state,'absent');
 const changed=structuredClone(reordered);changed.slides[0].segments.reverse();
 assert.throws(()=>parseSlideReview({...base,scope:changed},'take-1',scope,null));
});

test('partial and invalid-model statuses remain distinct and overlapping verified findings survive',async()=>{
 const {withFeedback}=await import('./helpers/feedback-fixtures.mjs');const review=withFeedback(),old=review.feedback_analysis.result;
 const selected={context_id:null,slides:[{slide_index:0,segments:[{start_ms:0,end_ms:1000}]}]};
 const first={...old.suggestions[0],category:'content',priority:1};
 const second={...first,category:'delivery',description_ref:'',slide_quote:'',observation:'The point is buried.',suggestion:'Lead with the conclusion.'};
 const value={...base,attempt_id:review.attempt_id,scope:selected,state:'completed',feedback_revision:1,
 result:{...old,review_version:'slide-review-v3',transcript_revision:0,slides:[{slide_index:0,status:'partial',evaluation_mode:'informative_descriptive',findings:[first,second],enrichments:[]}]}};
 assert.equal(parseSlideReview(value,review.attempt_id,selected,review).result.slides[0].findings.length,2);
 assert.equal(reviewStatus(value,0),'Some feedback couldn’t be verified');
 for(const [status,label]of [['invalid_evidence','Feedback couldn’t be verified'],['model_error','AI response couldn’t be processed']]){
  const v=structuredClone(value);v.result.slides[0].status=status;v.result.slides[0].findings=[];
  assert.equal(parseSlideReview(v,review.attempt_id,selected,review).result.slides[0].status,status);
  assert.equal(reviewStatus(v,0),label);
 }
});
