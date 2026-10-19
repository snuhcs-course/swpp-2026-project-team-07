import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/slide-review-loader.mjs';
import {scoreState,scoreReview,scoreTarget,attemptId} from './helpers/presentation-score-fixtures.mjs';
registerHooks({resolve,load});
const projection=await import('../src/features/feedback/selectedPresentationScores.ts').catch(()=>({}));
const {writeStored}=await import('../src/services/storage.ts');
const {reviewKey}=await import('../src/features/transcription/reviewStorage.ts');
const cache=await import('../src/features/feedback/presentationScoreStore.ts');
const corrections=await import('../src/features/presentations/correctionStore.ts');
const {saveRequirements}=await import('../src/features/presentations/requirementsStore.ts');
const {confirmRequirements}=await import('../src/features/presentations/requirementsDraft.ts');
const other='99999999-9999-4999-8999-999999999999';
const setup=name=>{
 const api=`https://${name}.synthetic.invalid/api`,review=scoreReview();
 writeStored(reviewKey(api,'attempt',attemptId),review);
 const parts=[{attemptId,segments:[{startMs:0,endMs:1000}]},{attemptId,segments:[{startMs:1000,endMs:2000}]}];
 const model={deck:{id:name},n:2,state:{run:{parts,full:true}},stages:new Map([[attemptId,'done']])};
 return {api,review,model,target:scoreTarget()};
};
const project=(model,api,slide)=>{assert.equal(typeof projection.selectedPresentationScores,'function');return projection.selectedPresentationScores(model,api,slide);};
test('projection restores validated performance numbers including zero and never infers scores from feedback counts',()=>{
 for(const [unit,score] of [[0,0],[2,67],[3,100]]){
  const {api,model,target}=setup('projection-'+unit);
  assert.equal(project(model,api).overall.score,null);
  cache.publishPresentationScore(api,scoreState({},unit),target);
  const result=project(model,api);
  assert.equal(result.overall.score,score);assert.deepEqual(result.items.map(i=>i.score),[score,score]);
  assert.equal(result.target.id,attemptId);assert.equal(result.overall.target.id,attemptId);
 }
});
test('composed runs show per-slide original scores but cannot substitute one recording as their overall grade',()=>{
 const {api,model,target}=setup('projection-composite');cache.publishPresentationScore(api,scoreState(),target);
 const second=scoreReview({attempt_id:other});writeStored(reviewKey(api,'attempt',other),second);
 const raw=scoreState({},3);const rename=value=>{if(!value||typeof value!=='object')return;for(const [k,v] of Object.entries(value)){if(k==='attempt_id')value[k]=other;else rename(v);}};rename(raw);
 cache.publishPresentationScore(api,raw,scoreTarget({id:other,review:second}));
 model.state.run.parts[1].attemptId=other;
 const full=project(model,api),selected=project(model,api,1);
 assert.deepEqual(full.items.map(i=>i.score),[67,100]);assert.equal(full.overall.score,null);assert.equal(full.target,null);
 assert.equal(selected.target.id,other);assert.equal(selected.items[1].state.attempt_id,other);
});
test('altered visit selection or recording identity cannot inherit a previously cached score',()=>{
 const {api,model,target}=setup('projection-selection');cache.publishPresentationScore(api,scoreState(),target);
 model.state.run.parts[0].segments=[{startMs:1,endMs:1000}];
 const derived=project(model,api,0);assert.equal(derived.items[0].score,null);assert.equal(derived.target,null);assert.equal(derived.overall.score,null);
 assert.equal(derived.items[1].score,67);
 model.state.run.parts[1].attemptId=other;
 assert.equal(project(model,api,1).items[1].score,null);
});
test('local transcript corrections stale the display without erasing a saved assessment',()=>{
 const {api,model,target,review}=setup('projection-correction');cache.publishPresentationScore(api,scoreState(),target);
 corrections.initializeCorrections(api,attemptId,review.transcript_id,review.transcript);
 corrections.confirmCorrection(api,attemptId,0,0,'A corrected word',review.transcript);
 const derived=project(model,api);assert.equal(derived.overall.score,null);assert.deepEqual(derived.items.map(i=>i.score),[null,null]);
 assert.equal(derived.items[0].state.stale,true);assert.equal(cache.readPresentationScore(api,target).result.overall.score,67);
});
test('saved and unsynchronized presentation requirements stale scores at the correct context',()=>{
 const {api,model,review}=setup('projection-settings'),contextId='44444444-4444-4444-8444-444444444444';
 const settings={contextId,deckId:review.deck_id,revision:0,audience:'Students',requiredDurationSeconds:300};
 saveRequirements(model.deck.id,api,settings);
 const raw=scoreState({context_id:contextId,requirements:{context_id:contextId,revision:0,audience:'Students',required_duration_seconds:300}});
 cache.publishPresentationScore(api,raw,scoreTarget({contextId}));assert.equal(project(model,api).overall.score,67);
 confirmRequirements(model.deck.id,api,{audience:'Researchers',requiredDurationSeconds:300},settings);
 assert.equal(project(model,api).overall.score,null);assert.equal(project(model,api).items[0].state.stale,true);
});
test('partial, pending, failed and stale states never invent an overall number',()=>{
 for(const [name,extra] of [['pending',{state:'queued',assessment_status:'pending',result:null}],['failed',{state:'failed',assessment_status:'unavailable',result:null}],['stale',{state:'stale',stale:true}]]){
  const {api,model,target}=setup('projection-'+name);cache.publishPresentationScore(api,scoreState(extra),target);
  const derived=project(model,api);assert.equal(derived.overall.score,null);assert.deepEqual(derived.items.map(i=>i.score),[null,null]);
 }
 const {api,model,target}=setup('projection-partial');const raw=scoreState();raw.assessment_status=raw.result.assessment_status='partial';
 raw.result.overall={status:'insufficient_evidence',score:null,level:null,exact:null,components:{slide_mean:null,whole:null}};
 const missing=raw.result.slides[1];missing.status='insufficient_evidence';missing.score=missing.level=missing.exact=null;missing.criteria=[];
 cache.publishPresentationScore(api,raw,target);
 const derived=project(model,api);assert.equal(derived.overall.score,null);assert.deepEqual(derived.items.map(i=>i.score),[67,null]);
});
test('missing transcription and a mismatched saved server deck cannot authorize grading',()=>{
 const {api,model}=setup('projection-missing');
 writeStored(reviewKey(api,'attempt',attemptId),scoreReview({transcript:null,transcript_id:null}));
 assert.equal(project(model,api).target,null);assert.deepEqual(project(model,api).items.map(i=>i.score),[null,null]);
 writeStored(reviewKey(api,'attempt',attemptId),scoreReview());writeStored(`server-deck:${api}:${model.deck.id}`,'55555555-5555-4555-8555-555555555555');
 assert.equal(project(model,api).target,null);
});

test('silent completed sources stay ungraded and do not appear to be perpetually transcribing',()=>{
 const {api,model}=setup('projection-silent');model.stages.set(attemptId,'no_speech');
 writeStored(reviewKey(api,'attempt',attemptId),scoreReview({transcript:{text:'',words:[]}}));
 const derived=project(model,api);assert.equal(derived.target,null);assert.equal(derived.items[0].status,'No speech detected');assert.equal(derived.items[0].score,null);
});
