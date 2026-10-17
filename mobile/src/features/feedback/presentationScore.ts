/** Frozen v2 public score contract. A legacy feedback item is never a score. */
import type { FeedbackDependency, FeedbackEvidence, ReviewAttempt } from '../../contracts';
import { takeVisits, type Run, type SlidePart } from '../../domain/run';
import { quotesEqual, structurallyEqual, verifiedExcerpt } from './evidence';

export const SCORE_VERSION = 'presentation-score-v2';
export const SCORE_LEVELS = ['beginning','emerging','competent','advanced'] as const;
export type ScoreLevel = typeof SCORE_LEVELS[number];
export type Exact = { numerator:number; denominator:number };
export type ScoreEvidence = {kind:'speech';attempt_id:string;transcript_id:string;source_id:string;slide_index:number;visit_id:number;segment_id:string;word_start:number;word_end:number;quote:string;start_ms:number;end_ms:number} |
 {kind:'slide';slide_index:number;source_id:string;fact_ref:string;quote:string} |
 {kind:'measurement';attempt_id:string;audio_hash:string;measurement_id:string;start_ms:number;end_ms:number;measurement:{id:string;kind:string;start_ms:number;end_ms:number;value:number;unit:string}} |
 {kind:'requirement';context_id:string;revision:number;field:string;quote:string} |
 {kind:'full_attempt';attempt_id:string;source_id:string;start_ms:number;end_ms:number};
export type ScoreCriterion = {id:string;status:'assessed'|'insufficient_evidence';level:ScoreLevel|null;justification:string;evidence:ScoreEvidence[];limitations:string[];deductions:{weakness_id:string;consequence:string;evidence:ScoreEvidence[]}[]};
export type ScoreAdvice = {text:string;evidence:ScoreEvidence[]};
export type ScoreFeedback = {summary:ScoreAdvice|null;strengths:ScoreAdvice[];weaknesses:ScoreAdvice[];improvements:ScoreAdvice[];improvement_shortage:string|null};
export type SlideScore = {slide_index:number;status:'scored'|'not_applicable'|'not_recorded'|'insufficient_evidence'|'invalid_evidence';score:number|null;level:ScoreLevel|null;exact:Exact|null;justification:string;criteria:ScoreCriterion[];evidence:ScoreEvidence[];feedback:ScoreFeedback};
export type ScoreResult = {rubric_version:string;source_identity:string;assessment_status:string;overall:{status:string;score:number|null;level:ScoreLevel|null;exact:Exact|null;components:{slide_mean:Exact|null;whole:Exact|null}};slides:SlideScore[];whole:ScoreCriterion[];feedback:ScoreFeedback;validation:{score_critical:{rejected_count:number;reasons:string[]};optional:{rejected_count:number;reasons:string[]}};evidence:FeedbackEvidence};
export type PresentationScore = {schema_version:string;rubric_version:string;attempt_id:string;context_id:string|null;source_identity:string|null;assessment_status:string;feedback_revision:number;transcript_revision:number;state:string;stale:boolean;updated_at:string|null;selection:{token:string}|null;availability:{state:string};retry_available:boolean;requires_confirmation:boolean;retry_at:string|null;error:{code?:string;message:string}|null;dependency:FeedbackDependency|null;requirements:{context_id:string|null;revision:number|null;audience:string;required_duration_seconds:number|null};result:ScoreResult|null};
export type ScoreTarget = {id:string;contextId:string|null;review:ReviewAttempt|null;pageCount:number};
const slideIds=['essential_coverage','explanation_depth','clarity_relevance'],wholeIds=['structure','coherence','audience_suitability','delivery'];
const statuses=['not_graded','pending','scored','partial','incomplete','insufficient_evidence','unavailable','invalid_evidence'];
const int=(x:unknown):x is number=>Number.isSafeInteger(x);
const text=(x:unknown):x is string=>typeof x==='string'&&!!x.trim()&&x.length<=10000;
function bad():never {throw new Error('Invalid presentation score response. Saved recordings are preserved.');}
function exact(x:Exact|null):x is Exact {return !!x&&int(x.numerator)&&int(x.denominator)&&x.numerator>=0&&x.denominator>0&&x.numerator<=100*x.denominator;}
function equal(a:Exact|null,b:Exact):boolean {return exact(a)&&BigInt(a.numerator)*BigInt(b.denominator)===BigInt(b.numerator)*BigInt(a.denominator);}
export function performanceLevel(e:Exact):ScoreLevel {const n=BigInt(e.numerator),d=BigInt(e.denominator);return n*6n<100n*d?'beginning':n<50n*d?'emerging':n*3n<250n*d?'competent':'advanced';}
function validateNumber(value:{score:number|null;level:ScoreLevel|null;exact:Exact|null},wanted:Exact|null) {
 if(wanted===null){if(value.score!==null||value.level!==null||value.exact!==null)bad();return;}
 if(!equal(value.exact,wanted)||!int(value.score)||value.score!==Number((2n*BigInt(wanted.numerator)+BigInt(wanted.denominator))/(2n*BigInt(wanted.denominator)))||value.level!==performanceLevel(wanted))bad();
}
export const scoreActive=(s:PresentationScore|null)=>!!s&&!s.stale&&!s.dependency?.retry_action&&['queued','waiting_descriptions','waiting_quota','preparing','submitted','normalizing'].includes(s.state);
export function scoreStatus(s:PresentationScore|null):string {
 if(!s)return 'Not graded';
 if(s.stale||s.state==='stale')return 'Score outdated';
 if(s.dependency?.retry_action)return s.dependency.requires_confirmation?'Profile retry needs confirmation':'Slide context needs recovery';
 if(s.requires_confirmation||s.state==='needs_confirmation')return 'Retry needs confirmation';
 if(scoreActive(s))return s.state==='waiting_quota'?'Waiting for AI capacity':s.state==='waiting_descriptions'?'Preparing slide context…':'Grading…';
 if(s.state==='failed')return s.error?.code==='input_limit'?'Recording exceeds grading limits':'Grading failed';
 if(s.availability.state!=='available'||s.state==='unavailable'||s.state==='disabled')return 'Grading unavailable';
 return ({not_graded:'Not graded',pending:'Grading…',scored:'Graded',partial:'Some slides graded',incomplete:'Incomplete recording',insufficient_evidence:'Insufficient evidence',unavailable:'Grading unavailable',invalid_evidence:'Score evidence could not be verified'} as Record<string,string>)[s.assessment_status]??'Not graded';
}
export function parsePresentationScore(raw:unknown,target:ScoreTarget):PresentationScore {
 const s=raw as PresentationScore,review=target.review;
 if(!s||s.schema_version!==SCORE_VERSION||s.rubric_version!==SCORE_VERSION||s.attempt_id!==target.id||s.context_id!==target.contextId||!statuses.includes(s.assessment_status)||
 !int(s.feedback_revision)||s.feedback_revision<0||!int(s.transcript_revision)||s.transcript_revision<0||typeof s.stale!=='boolean'||
 !['absent','disabled','unavailable','queued','waiting_descriptions','waiting_quota','preparing','submitted','normalizing','failed','needs_confirmation','completed','stale'].includes(s.state)||
 !['available','disabled','unavailable'].includes(s.availability?.state)||typeof s.retry_available!=='boolean'||typeof s.requires_confirmation!=='boolean'||
 !(s.source_identity===null||text(s.source_identity))||!(s.updated_at===null||typeof s.updated_at==='string'&&Number.isFinite(Date.parse(s.updated_at)))||
 !(s.selection===null||text(s.selection?.token))||s.requirements?.context_id!==target.contextId||!(s.requirements.revision===null||int(s.requirements.revision)&&s.requirements.revision>=0)||typeof s.requirements.audience!=='string')bad();
 if(!s.result)return s;
 const r=s.result,e=r.evidence;
 if(!review?.transcript||!review.transcript_id||r.rubric_version!==SCORE_VERSION||r.source_identity!==s.source_identity||r.assessment_status!==s.assessment_status||
 e?.attempt_id!==target.id||e.transcript_id!==review.transcript_id||e.deck_id!==review.deck_id||e.duration_ms!==review.duration_ms||e.page_count!==target.pageCount||
 !Array.isArray(e.sources)||e.sources.length!==target.pageCount||!Array.isArray(e.descriptions?.slides)||!Array.isArray(e.visits)||!text(e.chronology_id)||typeof e.audience_supplied!=='boolean')bad();
 // Evidence IDs index every original event, including empty simultaneous visits.
 // takeVisits intentionally filters those intervals for run selection/playback only.
 const duration=review.duration_ms,events=review.slide_events;
 if(!int(duration)||duration<=0||!Array.isArray(events)||!events.length)bad();
 const visits=events.map((event,i)=>{
  const end=events[i+1]?.at_ms??duration;
  if(!event||!int(event.slide_index)||event.slide_index<0||event.slide_index>=target.pageCount||
   !int(event.at_ms)||event.at_ms<0||event.at_ms>=duration||!int(end)||end<event.at_ms||end>duration||i===0&&event.at_ms!==0)bad();
  return {slide:event.slide_index,startMs:event.at_ms,endMs:end};
 });
 if(visits.length!==e.visits.length)bad();
 const words=review.transcript.words;
 if(!Array.isArray(words)||words.some(w=>!w||!text(w.text)||w.text.includes('\u0000')||
  !int(w.start_ms)||!int(w.end_ms)||w.start_ms<0||w.start_ms>=duration||w.end_ms<w.start_ms||w.end_ms>duration))bad();
 for(let i=0;i<visits.length;i++){
  const v=visits[i],actual=e.visits[i],indexes=words.flatMap((w,j)=>w.start_ms>=v.startMs&&w.start_ms<v.endMs?[j]:[]);
  if(actual.slide_index!==v.slide||actual.start_ms!==v.startMs||actual.end_ms!==v.endMs||!structurallyEqual(actual.word_indexes,indexes))bad();
 }
 const sources=new Map<number,string>();
 for(const src of e.sources){if(!int(src.slide_index)||src.slide_index<0||src.slide_index>=target.pageCount||sources.has(src.slide_index)||!/^[a-f0-9]{64}$/.test(src.source_id))bad();sources.set(src.slide_index,src.source_id);}
 const checkEvidence=(refs:ScoreEvidence[],required=false)=>{
  if(!Array.isArray(refs)||refs.length>1000||required&&!refs.length)bad();
  for(const ref of refs){
   if(!ref||typeof ref!=='object')bad();
   if(ref.kind==='speech'){
    const visit=e.visits[ref.visit_id];
    if(ref.attempt_id!==target.id||ref.transcript_id!==review.transcript_id||ref.source_id!==sources.get(ref.slide_index)||!int(ref.visit_id)||!visit||visit.slide_index!==ref.slide_index||
     !int(ref.word_start)||!int(ref.word_end)||ref.word_start<0||ref.word_end<ref.word_start||ref.word_end>=words.length||!new RegExp(`^v${ref.visit_id}s[0-9]{1,4}$`).test(ref.segment_id)||!text(ref.quote))bad();
    const selected=words.slice(ref.word_start,ref.word_end+1);
    if(selected.some((_w,i)=>!visit.word_indexes.includes(ref.word_start+i))||!quotesEqual(ref.quote,selected.map(w=>w.text).join(' '))||ref.start_ms!==Math.min(...selected.map(w=>w.start_ms))||ref.end_ms!==Math.max(...selected.map(w=>w.end_ms)))bad();
   }else if(ref.kind==='slide'){
    const d=e.descriptions.slides.find(d=>d.slide_index===ref.slide_index),[field,index]=ref.fact_ref?.split('/')??[];
    const fact=field==='summary'?d?.summary:field==='key_ideas'?d?.key_ideas[Number(index)]:field==='visual_facts'?d?.visual_facts[Number(index)]:null;
    if(ref.source_id!==sources.get(ref.slide_index)||d?.source_id!==ref.source_id||!fact||fact.uncertain||!text(ref.quote)||verifiedExcerpt(ref.quote,fact.text)===null)bad();
   }else if(ref.kind==='full_attempt'){
    if(ref.attempt_id!==target.id||ref.source_id!==r.source_identity||ref.start_ms!==0||ref.end_ms!==e.duration_ms)bad();
   }else if(ref.kind==='requirement'){
    if(ref.context_id!==target.contextId||ref.revision!==s.requirements.revision||!['audience','required_duration_seconds'].includes(ref.field)||!text(ref.quote))bad();
    const wanted=ref.field==='audience'?s.requirements.audience:String(s.requirements.required_duration_seconds);
    if(ref.quote!==wanted)bad();
   }else if(ref.kind==='measurement'){
    const m=ref.measurement;
    if(ref.attempt_id!==target.id||!/^[a-f0-9]{64}$/.test(ref.audio_hash)||!m||m.id!==ref.measurement_id||!text(m.kind)||!text(m.unit)||!Number.isFinite(m.value)||
     !int(ref.start_ms)||!int(ref.end_ms)||ref.start_ms<0||ref.end_ms>e.duration_ms||ref.end_ms<ref.start_ms||m.start_ms!==ref.start_ms||m.end_ms!==ref.end_ms)bad();
   }else bad();
  }
 };
 const checkCriteria=(criteria:ScoreCriterion[],ids:string[],required:boolean)=>{
  if(!Array.isArray(criteria)||criteria.length>ids.length||(required&&criteria.length!==ids.length))bad();
  const seen=new Set<string>();
  for(const c of criteria){
   if(!c||!ids.includes(c.id)||seen.has(c.id)||!['assessed','insufficient_evidence'].includes(c.status)||!text(c.justification)||!Array.isArray(c.limitations)||c.limitations.some(x=>!text(x))||!Array.isArray(c.deductions))bad();
   seen.add(c.id);checkEvidence(c.evidence,c.status==='assessed');
   if(c.status==='assessed'?!SCORE_LEVELS.includes(c.level as ScoreLevel):c.level!==null||!c.limitations.length)bad();
   for(const d of c.deductions){if(!text(d?.weakness_id)||!text(d.consequence))bad();checkEvidence(d.evidence,true);}
  }
 };
 const checkFeedback=(feedback:ScoreFeedback):ScoreFeedback=>{
  const advice=(v:ScoreAdvice)=>{if(!v||!text(v.text))bad();checkEvidence(v.evidence,true);return v;};
  const list=(v:ScoreAdvice[]|undefined,max=100)=>Array.isArray(v)?v.slice(0,max).flatMap(item=>{try{return [advice(item)];}catch{return [];}}):[];
  let summary=null;try{if(feedback?.summary)summary=advice(feedback.summary);}catch{/* Optional advice cannot invalidate scoring. */}
  return {summary,strengths:list(feedback?.strengths),weaknesses:list(feedback?.weaknesses),improvements:list(feedback?.improvements,3),improvement_shortage:typeof feedback?.improvement_shortage==='string'?feedback.improvement_shortage:null};
 };
 if(!Array.isArray(r.slides)||r.slides.length!==target.pageCount)bad();
 const seen=new Set<number>();let sum=0,applicable=0,all=true;
 for(const slide of r.slides){
  if(!int(slide?.slide_index)||slide.slide_index<0||slide.slide_index>=target.pageCount||seen.has(slide.slide_index)||!['scored','not_applicable','not_recorded','insufficient_evidence','invalid_evidence'].includes(slide.status)||typeof slide.justification!=='string')bad();
  seen.add(slide.slide_index);checkEvidence(slide.evidence);checkCriteria(slide.criteria,slideIds,slide.status==='scored');
  if(slide.status==='not_applicable'){
   if(slide.slide_index!==0&&slide.slide_index!==target.pageCount-1||!text(slide.justification)||!slide.evidence.length)bad();
  }else applicable++;
  if(slide.status==='scored'){
   if(slide.criteria.some(c=>c.status!=='assessed')||!visits.some(v=>v.slide===slide.slide_index&&v.endMs>v.startMs))bad();
   const numerator=slideIds.reduce((sum,id,i)=>sum+[40,35,25][i]*SCORE_LEVELS.indexOf(slide.criteria.find(c=>c.id===id)!.level!),0);
   validateNumber(slide,{numerator,denominator:3});sum+=numerator;
  }else{validateNumber(slide,null);if(slide.status!=='not_applicable')all=false;}
  slide.feedback=checkFeedback(slide.feedback);
 }
 checkCriteria(r.whole,wholeIds,r.overall?.status==='scored');
 if(!r.overall||!r.overall.components)bad();
 if(r.overall.status==='scored'){
  if(!all||!applicable||r.assessment_status!=='scored'||r.whole.length!==4||r.whole.some(c=>c.status!=='assessed'))bad();
  const whole=r.whole.reduce((sum,c)=>sum+SCORE_LEVELS.indexOf(c.level!),0)*100;
  const mean={numerator:sum,denominator:3*applicable},wholeExact={numerator:whole,denominator:12};
  if(!equal(r.overall.components.slide_mean,mean)||!equal(r.overall.components.whole,wholeExact))bad();
  validateNumber(r.overall,{numerator:28*sum+3*whole*applicable,denominator:120*applicable});
 }else{validateNumber(r.overall,null);if(r.assessment_status==='scored')bad();}
 for(const group of [r.validation?.score_critical,r.validation?.optional])if(!group||!int(group.rejected_count)||group.rejected_count<0||!Array.isArray(group.reasons)||group.reasons.some(x=>!text(x)))bad();
 r.feedback=checkFeedback(r.feedback);return s;
}
export function scorePartMatches(part:SlidePart|null|undefined,review:ReviewAttempt|null,slide:number):boolean {
 if(!part||!review||part.attemptId!==review.attempt_id)return false;
 const wanted=takeVisits(review.slide_events,review.duration_ms??0).filter(v=>v.slide===slide).map(v=>({startMs:v.startMs,endMs:v.endMs}));
 return wanted.length>0&&structurallyEqual(part.segments,wanted);
}
export function scoreRunAttempt(run:Run|null,reviews:ReviewAttempt[],n:number,result?:ScoreResult|null):string|null {
 if(!run||run.parts.length!==n)return null;
 const ids=[...new Set(run.parts.filter((p):p is SlidePart=>!!p).map(p=>p.attemptId))];
 if(ids.length!==1)return null;
 const review=reviews.find(r=>r.attempt_id===ids[0]);if(!review)return null;
 for(let i=0;i<n;i++){
  if(result?.slides.find(s=>s.slide_index===i)?.status==='not_applicable'&&!run.parts[i])continue;
  if(!scorePartMatches(run.parts[i],review,i))return null;
 }
 return ids[0];
}
export function latestCompleteAttempt(reviews:ReviewAttempt[],n:number):ReviewAttempt|null {
 return reviews.filter(r=>!!r.transcript_id&&n>0&&Array.from({length:n},(_,i)=>i).every(i=>takeVisits(r.slide_events,r.duration_ms??0).some(v=>v.slide===i)))
 .sort((a,b)=>(Date.parse(b.created_at??'')||0)-(Date.parse(a.created_at??'')||0)||a.attempt_id.localeCompare(b.attempt_id))[0]??null;
}
