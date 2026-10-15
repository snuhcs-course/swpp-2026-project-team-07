import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/domain-loader.mjs';
registerHooks({resolve,load});
const {qaScope,qaAnchor,qaOutdated,parseQaState}=await import('../src/features/qa/state.ts');
const run={parts:[{attemptId:'b',segments:[{startMs:0,endMs:1000},{startMs:2000,endMs:3000}]},null,{attemptId:'a',segments:[{startMs:100,endMs:700}]}]};
test('Q&A manifest retains mixed takes and all returns; excludes unrecorded slides',()=>{
 const scope=qaScope(run,'context');assert.equal(qaAnchor(scope),'a');
 assert.deepEqual(scope.slides.map(s=>[s.slide_index,s.attempt_id]),[[0,'b'],[2,'a']]);
 assert.equal(scope.slides[0].segments.length,2);
 assert.equal(qaAnchor(qaScope({parts:[]},null)),null);
});
const scope=qaScope(run,'context');
const base={attempt_id:'a',scope,qa_version:'audience-qa-v2',state:'completed',feedback_revision:1,stale:false,
 source_revisions:{a:0,b:2},requirements:{context_id:'context',revision:1,audience:'Students'},
 retry_available:false,requires_confirmation:false,availability:{state:'available'},selection:{token:'f'.repeat(64)},
 result:{stale:false,qa_version:'audience-qa-v2',job_id:12,questions:[{id:'a'.repeat(32),panelist:'P1',role:'Student',slide_index:0,topic:'Meaning',question:'What does this mean?',follow_up:'For example?'}]}};
test('pending corrections and selected-source revisions invalidate without modifying cached questions',()=>{
 assert.equal(qaOutdated(base,1,{a:{revision:0},b:{revision:2}}),false);
 for(const source of [{revision:3},{revision:2,pending:true},{revision:2,conflict:true},{revision:2,sourceChanged:true}])assert.equal(qaOutdated(base,1,{a:{revision:0},b:source}),true);
 assert.equal(qaOutdated(base,2,{a:{revision:0},b:{revision:2}}),true);
 assert.equal(base.result.questions.length,1);
});
test('strict response identity rejects foreign, duplicate and out-of-scope questions',()=>{
 assert.equal(parseQaState(base,'a',scope).result.questions.length,1);
 for(const change of [{attempt_id:'b'},{qa_version:'old'},{scope:{...scope,context_id:null}},
 {result:{...base.result,questions:[{...base.result.questions[0],slide_index:1}]}},
 {result:{...base.result,questions:Array(2).fill(base.result.questions[0])}}])assert.throws(()=>parseQaState({...base,...change},'a',scope));
});

test('outdated current generation remains available in read-only history and same-job resync reinitializes answer controls',async()=>{
 const {qaHistoryJobs,qaScreenKey}=await import('../src/features/qa/state.ts');
 const saved=[{jobId:12,answers:{original:'recording'}},{jobId:11,answers:{older:'recording'}}];
 assert.deepEqual(qaHistoryJobs(saved,base).map(s=>s.jobId),[11]);
 const stale={...base,stale:true};
 assert.deepEqual(qaHistoryJobs(saved,stale).map(s=>s.jobId),[12,11]);
 assert.notEqual(qaScreenKey(stale),qaScreenKey(base));
 assert.equal(saved[0].answers.original,'recording');
});

test('accepts backend scope field order without weakening selected-source identity',()=>{
 const wire={slides:scope.slides.map(s=>({segments:s.segments.map(v=>({end_ms:v.end_ms,start_ms:v.start_ms})),attempt_id:s.attempt_id,slide_index:s.slide_index})),context_id:scope.context_id};
 assert.equal(parseQaState({...base,scope:wire},'a',scope).result.questions.length,1);
 const changed=structuredClone(wire);changed.slides[0].segments[0].end_ms++;
 assert.throws(()=>parseQaState({...base,scope:changed},'a',scope));
});


test('panelist names accept reasonable labels and reject unbounded metadata',()=>{
 const value=structuredClone(base);value.result.questions[0].panelist='Professor Kim';
 assert.equal(parseQaState(value,'a',scope).result.questions[0].panelist,'Professor Kim');
 value.result.questions[0].panelist='x'.repeat(65);assert.throws(()=>parseQaState(value,'a',scope));
});
