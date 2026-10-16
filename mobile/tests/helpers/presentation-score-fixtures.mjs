// Synthetic frozen score fixtures; no media, credentials or provider calls.
import {withFeedback,attemptId,feedbackState} from './feedback-fixtures.mjs';
export {attemptId};
const review=withFeedback(),evidence=feedbackState().result.evidence;
export function fixture(unit=2){
 const level=['beginning','emerging','competent','advanced'][unit],score=Math.floor(100*unit/3+.5), exact={numerator:100*unit,denominator:3};
 const speech=i=>({kind:'speech',attempt_id:attemptId,transcript_id:review.transcript_id,source_id:evidence.sources[i].source_id,slide_index:i,visit_id:i,segment_id:`v${i}s0`,word_start:i,word_end:i,quote:review.transcript.words[i].text,start_ms:i*1000,end_ms:i*1000+500});
 const criteria=(ids,i)=>ids.map(id=>({id,status:'assessed',level,justification:'Synthetic rubric explanation.',evidence:[speech(i)],limitations:[],deductions:[]}));
 const feedback={summary:null,strengths:[],weaknesses:[],improvements:[],improvement_shortage:'No additional supported advice.'};
 return structuredClone({schema_version:'presentation-score-v2',rubric_version:'presentation-score-v2',attempt_id:attemptId,context_id:null,source_identity:'f'.repeat(64),assessment_status:'scored',state:'completed',stale:false,feedback_revision:1,transcript_revision:0,updated_at:'2026-10-17T00:00:00.000001Z',selection:{token:'1'.repeat(64)},availability:{state:'available'},retry_available:false,requires_confirmation:false,retry_at:null,error:null,dependency:null,requirements:{context_id:null,revision:null,audience:'',required_duration_seconds:null},result:{rubric_version:'presentation-score-v2',source_identity:'f'.repeat(64),assessment_status:'scored',overall:{status:'scored',score,level,exact,components:{slide_mean:exact,whole:exact}},slides:[0,1].map(i=>({slide_index:i,status:'scored',score,level,exact,justification:'Synthetic slide explanation.',criteria:criteria(['essential_coverage','explanation_depth','clarity_relevance'],i),evidence:[speech(i)],feedback})),whole:criteria(['structure','coherence','audience_suitability','delivery'],0),feedback,validation:{score_critical:{rejected_count:0,reasons:[]},optional:{rejected_count:0,reasons:[]}},evidence}});
}
export const scoreReview=(extra={})=>withFeedback(extra);
export const scoreState=(extra={},unit=2)=>({...fixture(unit),...structuredClone(extra)});
export const scoreTarget=(extra={})=>({id:attemptId,contextId:null,review:scoreReview(),pageCount:2,...extra});
