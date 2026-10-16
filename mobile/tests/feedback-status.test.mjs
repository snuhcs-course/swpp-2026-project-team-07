import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/slide-review-loader.mjs';
import {withFeedback,attemptId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
const store=await import('../src/features/feedback/slideReviewStore.ts').catch(()=>({}));
const status=await import('../src/features/feedback/selectedSlideFeedback.ts').catch(()=>({}));
const review=withFeedback();
const scope={context_id:null,slides:[{slide_index:0,segments:[{start_ms:0,end_ms:1000}]}]};
const state=(extra={})=>({attempt_id:attemptId,feedback_revision:1,transcript_revision:0,state:'completed',stale:false,
 scope,review_version:'slide-review-v3',requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},
 selection:{token:'1'.repeat(64)},retry_available:false,requires_confirmation:false,availability:{state:'available'},dependency:null,updated_at:'2026-10-16T00:00:00Z',
 result:{...review.feedback_analysis.result,review_version:'slide-review-v3',transcript_revision:0,stale:false,slides:[{slide_index:0,status:'successful',evaluation_mode:'informative_descriptive',findings:[],enrichments:[]}]},...extra});
const correction={server:{base_transcript_id:review.transcript_id,revision:0,source_changed:false},pending:false,conflict:false};
const derive=(value,stage='done')=>status.feedbackStatusItem(0,true,stage,value);

test('current successful and partial findings replace quality scores; failures never count as clean',()=>{
 assert.equal(typeof status.feedbackStatusItem,'function','shared AI status derivation must exist');
 const finding={...review.feedback_analysis.result.suggestions[0],category:'content',priority:1};
 const successful=state();successful.result.slides[0].findings=[finding];
 assert.deepEqual({...derive(successful)}, {slide:0,status:'reviewed',label:'1 finding',findingCount:1,assessed:true,hasFindings:true,tone:'warn'});
 const partial=structuredClone(successful);partial.result.slides[0].status='partial';
 assert.equal(derive(partial).status,'partial');assert.equal(derive(partial).findingCount,1);assert.equal(derive(partial).assessed,false);
 for(const summary of ['insufficient_evidence','invalid_evidence','model_error']){const s=state();s.result.slides[0].status=summary;
  assert.equal(derive(s).assessed,false);assert.equal(derive(s).findingCount,0);assert.notEqual(derive(s).status,'reviewed');}
 const active=state({state:'queued'});assert.equal(derive(active).status,'pending');assert.equal(derive(active).findingCount,0);
 assert.equal(derive(state({stale:true})).status,'outdated');assert.equal(derive(state({state:'failed'})).status,'recovery_needed');
 assert.equal(derive(state({state:'absent',feedback_revision:0,result:null})).status,'not_analyzed');
});

test('requirements, source and correction revisions centrally invalidate cached feedback',()=>{
 assert.equal(typeof store.effectiveSlideReview,'function','shared freshness adapter must exist');
 const current=state();const opts={requirementsRevision:null,correction,transcriptId:review.transcript_id,initial:null,dirty:false};
 assert.equal(store.effectiveSlideReview(current,opts).stale,false);
 for(const change of [{dirty:true},{requirementsRevision:2},{correction:{...correction,pending:true}},{correction:{...correction,conflict:true}},
  {correction:{...correction,server:{...correction.server,revision:1}}},{correction:{...correction,server:{...correction.server,base_transcript_id:'f'.repeat(64)}}}]){
  assert.equal(store.effectiveSlideReview(current,{...opts,...change}).stale,true);
 }
 const newer=state({transcript_revision:2});assert.equal(store.effectiveSlideReview(newer,{...opts,correction:null}).stale,true,'missing correction snapshot cannot verify revision 2');
 assert.equal(current.stale,false,'freshness does not mutate saved source');
});

test('aggregate counts include only current verified findings and keep partial/pending/outdated separate',()=>{
 assert.equal(typeof status.aggregateFeedback,'function','aggregate adapter must exist');
 const clean=derive(state()),partial=state();partial.result.slides[0].status='partial';partial.result.slides[0].findings=[{}];
 const items=[clean,derive(partial),derive(state({state:'queued'})),derive(state({stale:true})),derive(state({state:'failed'})),derive(state({state:'absent',result:null})),status.feedbackStatusItem(6,false,null,null)];
 assert.deepEqual(status.aggregateFeedback(items),{recorded:6,assessed:1,findings:1,slidesWithFindings:1,partial:1,pending:1,outdated:1,recoveryNeeded:1,insufficient:0,notAnalyzed:1});
});

test('cache keys retain exact singleton scope and GET reader deduplicates with at most three concurrent requests',async()=>{
 assert.equal(typeof store.createSlideReviewReader,'function','bounded GET reader must exist');
 const api='https://bounded.synthetic.invalid/api';let active=0,max=0,calls=0;const releases=[];
 const reader=store.createSlideReviewReader(api,async(url,init)=>{assert.equal(init.method,'GET');calls++;active++;max=Math.max(max,active);await new Promise(r=>releases.push(r));active--;return new Response(JSON.stringify(state({attempt_id:url.split('/attempts/')[1].split('/')[0],state:'absent',feedback_revision:0,result:null})));});
 const target=i=>({id:`take-${i}`,scope,review:{...review,attempt_id:`take-${i}`}});
 const pending=Array.from({length:6},(_,i)=>reader.read(target(i)));
 const duplicate=reader.read(target(0));const all=Promise.all([...pending,duplicate]);
 await new Promise(setImmediate);assert.equal(calls,3);assert.equal(max,3);
 while(releases.length){releases.splice(0).forEach(r=>r());await new Promise(setImmediate);}
 await all;assert.equal(calls,6);assert.equal(max,3);
 assert.equal(store.slideReviewKey(api,attemptId,scope),`slide-review:v1:${JSON.stringify([api,attemptId,scope])}`);
 const reverse=structuredClone(scope);reverse.slides[0].segments.push({start_ms:2000,end_ms:3000});assert.notEqual(store.slideReviewKey(api,attemptId,reverse),store.slideReviewKey(api,attemptId,scope));
});

test('read refresh retains newer cached revisions and rejects mismatched source identities',async()=>{
 assert.equal(typeof store.publishSlideReview,'function','monotonic validated publication must exist');
 const api='https://monotonic.synthetic.invalid/api';const newer=state({feedback_revision:8});
 store.publishSlideReview(api,newer,review);store.publishSlideReview(api,state({feedback_revision:2}),review);
 assert.equal(store.readSlideReview(api,attemptId,scope,review).feedback_revision,8);
 assert.equal(store.readSlideReview(api,attemptId,scope,{...review,transcript_id:'f'.repeat(64)}),null);
 const reader=store.createSlideReviewReader(api,async()=>{throw Error('offline');});await assert.rejects(reader.read({id:attemptId,scope,review}));
 assert.equal(store.readSlideReview(api,attemptId,scope,review).feedback_revision,8);
});


test('selected source and exact visits choose the current cache; pending settings exclude prior findings',async()=>{
 const {writeStored}=await import('../src/services/storage.ts');const {reviewKey}=await import('../src/features/transcription/reviewStorage.ts');
 const {confirmRequirements,acceptServerRequirements}=await import('../src/features/presentations/requirementsDraft.ts');
 const api='https://selection.synthetic.invalid/api',local='selected-feedback-synthetic';
 writeStored(reviewKey(api,'attempt',attemptId),review);
 store.publishSlideReview(api,state(),review);
 const model={deck:{id:local},n:2,state:{run:{parts:[{attemptId,segments:[{startMs:0,endMs:1000}]},null]}},stages:new Map([[attemptId,'done']])};
 assert.equal(status.selectedSlideFeedback(model,api).items[0].status,'reviewed');
 const changed={...model,state:{run:{parts:[{attemptId,segments:[{startMs:0,endMs:900}]},null]}}};
 assert.equal(status.selectedSlideFeedback(changed,api).items[0].status,'not_analyzed','different segments never borrow cached findings');
 confirmRequirements(local,api,{audience:'Students',requiredDurationSeconds:600});
 assert.equal(status.selectedSlideFeedback(model,api).items[0].status,'outdated');acceptServerRequirements(local,api);
 writeStored(reviewKey(api,'attempt',attemptId),{...review,transcript:{text:'Saved words without timing',words:[]}});
 assert.equal(status.selectedSlideFeedback(model,api).items[0].status,'insufficient','untimed text is not a clean AI assessment');
 assert.match(status.selectedSlideFeedback(model,api).items[0].label,/timing|evidence/i);
});

test('retained evidence source identity is checked even without a correction snapshot',()=>{
 const current=state();
 for(const transcriptId of ['f'.repeat(64),undefined]){
  const effective=store.effectiveSlideReview(current,{requirementsRevision:null,correction:null,transcriptId});
  assert.equal(effective.stale,true,'unverifiable evidence source must be outdated');assert.equal(effective.result.stale,true);
 }
 const correctionAtNewSource={...correction,server:{...correction.server,base_transcript_id:'f'.repeat(64)}};
 assert.equal(store.effectiveSlideReview(current,{requirementsRevision:null,correction:correctionAtNewSource,transcriptId:'f'.repeat(64)}).stale,true);
});
