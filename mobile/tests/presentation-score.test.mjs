// Synthetic scoring contracts; no user content, audio, or provider calls.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/slide-review-loader.mjs';
import {withFeedback,attemptId,feedbackState} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
const scoring=await import('../src/features/feedback/presentationScore.ts').catch(()=>({}));
const review=withFeedback(), evidence=feedbackState().result.evidence;
export function fixture(unit=2){
 const level=['beginning','emerging','competent','advanced'][unit],score=Math.floor(100*unit/3+.5), exact={numerator:100*unit,denominator:3};
 const speech=i=>({kind:'speech',attempt_id:attemptId,transcript_id:review.transcript_id,source_id:evidence.sources[i].source_id,slide_index:i,visit_id:i,segment_id:`v${i}s0`,word_start:i,word_end:i,quote:review.transcript.words[i].text,start_ms:i*1000,end_ms:i*1000+500});
 const criteria=(ids,i)=>ids.map(id=>({id,status:'assessed',level,justification:'Synthetic rubric explanation.',evidence:[speech(i)],limitations:[],deductions:[]}));
 const feedback={summary:null,strengths:[],weaknesses:[],improvements:[],improvement_shortage:'No additional supported advice.'};
 return structuredClone({schema_version:'presentation-score-v2',rubric_version:'presentation-score-v2',attempt_id:attemptId,context_id:null,source_identity:'f'.repeat(64),assessment_status:'scored',state:'completed',stale:false,feedback_revision:1,transcript_revision:0,updated_at:'2026-10-17T00:00:00.000001Z',selection:{token:'1'.repeat(64)},availability:{state:'available'},retry_available:false,requires_confirmation:false,retry_at:null,error:null,dependency:null,requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},result:{rubric_version:'presentation-score-v2',source_identity:'f'.repeat(64),assessment_status:'scored',overall:{status:'scored',score,level,exact,components:{slide_mean:exact,whole:exact}},slides:[0,1].map(i=>({slide_index:i,status:'scored',score,level,exact,justification:'Synthetic slide explanation.',criteria:criteria(['essential_coverage','explanation_depth','clarity_relevance'],i),evidence:[speech(i)],feedback})),whole:criteria(['structure','coherence','audience_suitability','delivery'],0),feedback,validation:{score_critical:{rejected_count:0,reasons:[]},optional:{rejected_count:0,reasons:[]}},evidence}});
}
const target={id:attemptId,contextId:null,review,pageCount:2};
test('v2 parser publishes rubric scores 0,67,100 and never reads legacy findings as points',()=>{
 assert.equal(typeof scoring.parsePresentationScore,'function','validated scoring parser must exist');
 for(const [u,n] of [[0,0],[2,67],[3,100]])assert.equal(scoring.parsePresentationScore(fixture(u),target).result.overall.score,n);
 assert.throws(()=>scoring.parsePresentationScore(feedbackState(),target),/score/i);
});
test('score validation rejects wrong arithmetic, unknown criteria and evidence source/timing drift',()=>{
 assert.equal(typeof scoring.parsePresentationScore,'function');
 for(const mutate of [s=>s.result.overall.score=66,s=>s.result.slides[0].criteria[0].id='made_up',s=>s.result.whole[0].evidence[0].quote='invented',s=>s.result.whole[0].evidence[0].visit_id=1,s=>s.result.slides[0].evidence[0].start_ms=1,s=>s.source_identity='wrong',s=>s.result.evidence.visits[0].word_indexes=[1],s=>s.result.slides.push(s.result.slides[0])]){
  const raw=fixture();mutate(raw);assert.throws(()=>scoring.parsePresentationScore(raw,target));
 }
});
test('insufficient evidence retains valid slides while suppressing whole number',()=>{
 assert.equal(typeof scoring.parsePresentationScore,'function');
 const raw=fixture();raw.assessment_status=raw.result.assessment_status='partial';raw.result.overall={status:'insufficient_evidence',score:null,level:null,exact:null,components:{slide_mean:null,whole:null}};
 const s=raw.result.slides[1];s.status='insufficient_evidence';s.score=s.level=s.exact=null;s.criteria=s.criteria.map(c=>({...c,status:'insufficient_evidence',level:null,limitations:['No usable evidence.']}));
 assert.equal(scoring.parsePresentationScore(raw,target).result.slides[0].score,67);
});
test('only exact original intervals from one complete attempt qualify for overall',()=>{
 assert.equal(typeof scoring.scoreRunAttempt,'function');
 const parts=[0,1].map(i=>({attemptId,segments:[{startMs:i*1000,endMs:(i+1)*1000}]})),run={parts,full:true};
 assert.equal(scoring.scoreRunAttempt(run,[review],2),attemptId);
 assert.equal(scoring.scoreRunAttempt({...run,parts:[parts[0],{...parts[1],attemptId:'other'}]},[review],2),null);
 assert.equal(scoring.scoreRunAttempt({...run,parts:[parts[0],null]},[review],2),null);
 assert.equal(scoring.scoreRunAttempt({...run,parts:[{...parts[0],segments:[{startMs:1,endMs:1000}]},parts[1]]},[review],2),null);
 const repeated={...review,slide_events:[{slide_index:0,at_ms:0},{slide_index:1,at_ms:600},{slide_index:0,at_ms:1200}]};
 assert.equal(scoring.scoreRunAttempt(run,[repeated],2),null,'repeat visits cannot be dropped');
});
test('Home picks latest complete attempt independently of which older attempt has a score',()=>{
 assert.equal(typeof scoring.latestCompleteAttempt,'function');
 const older={...review,attempt_id:'older',created_at:'2026-10-16T00:00:00Z'},latest={...review,created_at:'2026-10-17T00:00:00Z'},incomplete={...review,attempt_id:'incomplete',created_at:'2026-10-18T00:00:00Z',slide_events:[{slide_index:0,at_ms:0}]};
 assert.equal(scoring.latestCompleteAttempt([older,incomplete,latest],2).attempt_id,attemptId);
});
test('validated source-aware cache retains newer results and deduplicates GETs only',async()=>{
 const store=await import('../src/features/feedback/presentationScoreStore.ts').catch(()=>({}));
 assert.equal(typeof store.createPresentationScoreReader,'function');
 let count=0,release;const gate=new Promise(r=>release=r);
 const reader=store.createPresentationScoreReader('https://score.invalid',async(_url,init)=>{assert.equal(init.method,'GET');count++;await gate;return new Response(JSON.stringify(fixture()));});
 const one=reader.read(target),two=reader.read(target);release();await Promise.all([one,two]);assert.equal(count,1);
 const next=fixture();next.feedback_revision=2;store.publishPresentationScore('https://score.invalid',next,target);
 store.publishPresentationScore('https://score.invalid',fixture(),target);
 assert.equal(store.readPresentationScore('https://score.invalid',target).feedback_revision,2);
 assert.equal(store.readPresentationScore('https://score.invalid',{...target,contextId:'other'}),null);
 assert.equal(store.readPresentationScore('https://score.invalid',{...target,review:{...review,transcript_id:'changed'}}),null);
});
test('corrections and requirement changes suppress numeric output without destroying saved result',async()=>{
 const store=await import('../src/features/feedback/presentationScoreStore.ts').catch(()=>({}));assert.equal(typeof store.effectivePresentationScore,'function');
 const raw=fixture(),clean={requirementsRevision:null,correction:null,dirty:false,transcriptId:review.transcript_id};
 assert.equal(store.effectivePresentationScore(raw,clean).stale,false);
 for(const change of [{dirty:true},{transcriptId:'changed'},{requirementsRevision:2},{correction:{pending:true,conflict:false,server:{revision:0,source_changed:false,base_transcript_id:review.transcript_id}}}])assert.equal(store.effectivePresentationScore(raw,{...clean,...change}).stale,true);
 assert.equal(raw.result.overall.score,67);
});


// Original chronology IDs include empty visits; audio/run selection omits them.
function simultaneousVisitsFixture(){
 const review=withFeedback(),raw=fixture();
 review.slide_events=[{slide_index:0,at_ms:0},{slide_index:1,at_ms:0},{slide_index:0,at_ms:0},
  {slide_index:1,at_ms:1000},{slide_index:0,at_ms:1500},{slide_index:1,at_ms:1500}];
 review.transcript.words.push({text:'Again',start_ms:1500,end_ms:1900});
 review.transcript.text='Hello 안녕 Again';
 raw.result.evidence.visits=[
  {slide_index:0,start_ms:0,end_ms:0,word_indexes:[]},
  {slide_index:1,start_ms:0,end_ms:0,word_indexes:[]},
  {slide_index:0,start_ms:0,end_ms:1000,word_indexes:[0]},
  {slide_index:1,start_ms:1000,end_ms:1500,word_indexes:[1]},
  {slide_index:0,start_ms:1500,end_ms:1500,word_indexes:[]},
  {slide_index:1,start_ms:1500,end_ms:2000,word_indexes:[2]},
 ];
 const reindex=value=>{
  if(!value||typeof value!=='object')return;
  if(value.kind==='speech'){value.visit_id=value.slide_index===0?2:3;value.segment_id=`v${value.visit_id}s0`;}
  else for(const child of Object.values(value))reindex(child);
 };
 reindex(raw);
 const later={...raw.result.slides[1].evidence[0],visit_id:5,segment_id:'v5s0',word_start:2,word_end:2,quote:'Again',start_ms:1500,end_ms:1900};
 raw.result.slides[1].evidence.push(later);
 raw.result.whole[1].evidence.push({...later});
 return {raw,target:{id:attemptId,contextId:null,review,pageCount:2}};
}
test('score evidence preserves simultaneous empty visits and original citation IDs across repeated/backward visits',()=>{
 const {raw,target}=simultaneousVisitsFixture();
 const parsed=scoring.parsePresentationScore(raw,target);
 assert.equal(parsed.result.overall.score,67);
 assert.deepEqual(parsed.result.evidence.visits.map(v=>v.word_indexes),[[],[],[0],[1],[],[2]]);
 assert.equal(parsed.result.slides[0].evidence[0].visit_id,2);
 assert.deepEqual(parsed.result.slides[1].evidence.map(ref=>ref.visit_id),[3,5]);
 assert.equal(scoring.scorePartMatches({attemptId,segments:[{startMs:1000,endMs:1500},{startMs:1500,endMs:2000}]},target.review,1),true);
});
test('empty visits remain records but cannot acquire speech or silently renumber provenance',()=>{
 const good=simultaneousVisitsFixture();
 assert.doesNotThrow(()=>scoring.parsePresentationScore(good.raw,good.target));
 for(const mutate of [
  r=>r.result.evidence.visits.splice(0,2),
  r=>r.result.slides[0].evidence[0].visit_id=0,
  r=>r.result.evidence.visits[0].word_indexes=[0],
  r=>r.result.slides[0].evidence[0].segment_id='v0s0',
 ]){
  const {raw,target}=simultaneousVisitsFixture();mutate(raw);
  assert.throws(()=>scoring.parsePresentationScore(raw,target));
 }
});
test('valid zero-duration source words and measurements remain evidence without widened timestamps',()=>{
 const {raw,target}=simultaneousVisitsFixture();
 target.review.transcript.words[0].end_ms=0;
 const zero=value=>{if(!value||typeof value!=='object')return;
  if(value.kind==='speech'&&value.word_start===0)value.end_ms=0;
  else for(const child of Object.values(value))zero(child);
 };zero(raw);
 raw.result.whole[3].evidence.push({kind:'measurement',attempt_id:attemptId,audio_hash:'a'.repeat(64),measurement_id:'speech_point',start_ms:1500,end_ms:1500,
  measurement:{id:'speech_point',kind:'speech',start_ms:1500,end_ms:1500,value:0,unit:'ms'}});
 const parsed=scoring.parsePresentationScore(raw,target);
 assert.deepEqual([parsed.result.slides[0].evidence[0].start_ms,parsed.result.slides[0].evidence[0].end_ms],[0,0]);
 assert.deepEqual([parsed.result.whole[3].evidence.at(-1).start_ms,parsed.result.whole[3].evidence.at(-1).end_ms],[1500,1500]);
});
test('scoring rejects malformed chronology even when response metadata mirrors it',()=>{
 const cases=[
  (raw,review)=>{review.slide_events[0].at_ms=-1;raw.result.evidence.visits[0].start_ms=-1;},
  (raw,review)=>{review.duration_ms=2000.5;raw.result.evidence.duration_ms=2000.5;raw.result.evidence.visits[1].end_ms=2000.5;},
  (raw,review)=>{review.slide_events[1].at_ms=1000.5;raw.result.evidence.visits[0].end_ms=1000.5;raw.result.evidence.visits[1].start_ms=1000.5;
   review.transcript.words[1].start_ms=1000.5;raw.result.slides[1].evidence[0].start_ms=1000.5;for(const c of raw.result.slides[1].criteria)c.evidence[0].start_ms=1000.5;},
  (_raw,review)=>{review.slide_events[1].at_ms=-1;},
  (raw,review)=>{review.slide_events[1].at_ms=2000;raw.result.evidence.visits[0].end_ms=2000;raw.result.evidence.visits[1].start_ms=2000;},
 ];
 for(const mutate of cases){const raw=fixture(),review=withFeedback();mutate(raw,review);
  assert.throws(()=>scoring.parsePresentationScore(raw,{...target,review}));
 }
});
test('repeated-visit scores retain strict timestamp, visit, slide, quote and source validation',()=>{
 for(const mutate of [
  r=>r.result.evidence.visits[2].end_ms=-1,
  r=>r.result.evidence.visits[2].start_ms=0.5,
  r=>r.result.evidence.visits[4].end_ms=1499,
  r=>r.result.evidence.visits[5].word_indexes=[1],
  r=>r.result.evidence.visits[4].slide_index=2,
  r=>r.result.slides[1].evidence[1].visit_id=6,
  r=>r.result.slides[1].evidence[1].visit_id=-1,
  r=>r.result.slides[1].evidence[1].visit_id=true,
  r=>r.result.slides[1].evidence[1].visit_id=2,
  r=>r.result.slides[1].evidence[1].slide_index=0,
  r=>r.result.slides[1].evidence[1].start_ms=1500.5,
  r=>r.result.slides[1].evidence[1].end_ms=1499,
  r=>r.result.slides[1].evidence[1].source_id='f'.repeat(64),
  r=>r.result.slides[1].evidence[1].quote='invented',
 ]){const {raw,target}=simultaneousVisitsFixture();mutate(raw);assert.throws(()=>scoring.parsePresentationScore(raw,target));}
});

test('scoring rejects malformed original word times even when speech citations copy them',()=>{
 for(const [start,end] of [[0,-1],[0,2001],[0.5,500],[0,500.5],[0,Infinity],[true,500],[0,NaN]]){
  const raw=fixture(),review=withFeedback();
  review.transcript.words[0].start_ms=start;review.transcript.words[0].end_ms=end;
  const copy=value=>{if(!value||typeof value!=='object')return;
   if(value.kind==='speech'&&value.word_start===0){value.start_ms=start;value.end_ms=end;}
   else for(const child of Object.values(value))copy(child);
  };copy(raw);
  assert.throws(()=>scoring.parsePresentationScore(raw,{...target,review}));
 }
});

test('a preserved empty visit cannot qualify its slide or overall presentation for a score',()=>{
 const raw=fixture(),review=withFeedback();
 review.slide_events=[{slide_index:0,at_ms:0},{slide_index:1,at_ms:0}];
 raw.result.evidence.visits=[{slide_index:0,start_ms:0,end_ms:0,word_indexes:[]},
  {slide_index:1,start_ms:0,end_ms:2000,word_indexes:[0,1]}];
 const fact={kind:'slide',slide_index:0,source_id:raw.result.evidence.sources[0].source_id,
  fact_ref:'summary',quote:raw.result.evidence.descriptions.slides[0].summary.text};
 raw.result.slides[0].evidence=[fact];
 for(const c of raw.result.slides[0].criteria)c.evidence=[fact];
 for(const c of raw.result.whole)c.evidence=[{...raw.result.slides[1].evidence[0]}];
 assert.throws(()=>scoring.parsePresentationScore(raw,{...target,review}));
 // The same original chronology is readable when the backend withholds that score.
 const missing=raw.result.slides[0];missing.status='not_recorded';missing.score=missing.level=missing.exact=null;
 missing.criteria=[];missing.evidence=[];
 raw.assessment_status=raw.result.assessment_status='incomplete';
 raw.result.overall={status:'incomplete',score:null,level:null,exact:null,components:{slide_mean:null,whole:null}};
 const parsed=scoring.parsePresentationScore(raw,{...target,review});
 assert.equal(parsed.result.slides[0].score,null);
 assert.equal(parsed.result.slides[1].score,67);
 assert.equal(parsed.result.overall.score,null);
});
