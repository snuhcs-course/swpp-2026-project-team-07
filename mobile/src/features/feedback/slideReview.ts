import { quotesEqual,verifiedExcerpt,structurallyEqual } from './evidence';
import type { ReviewAttempt, FeedbackEvidence, DescriptionFact } from '../../contracts';
import type { SlidePart } from '../../domain/run';
export const REVIEW_VERSION = 'slide-review-v3';
export type ReviewScope = { context_id: string | null; slides: {slide_index: number; segments: {start_ms: number; end_ms: number}[]}[] };
export type Finding = {category: 'content'|'graph'|'audience'|'fillers'|'repetition'|'delivery'|'timing'; priority: number;
 slide_index: number; source_id: string; transcript_id: string; visit_id: number; segment_id: string; word_start: number; word_end: number;
 speech_quote: string; description_ref: string; slide_quote: string; observation: string; suggestion: string; start_ms: number; end_ms: number};
export type Enrichment = {kind:'illustrative';idea:string};
export type SlideSummary = {evaluation_mode?: 'informative_descriptive'|'analytical_persuasive'|'mixed_or_uncertain'; slide_index: number; status: 'successful'|'insufficient_evidence'|'partial'|'invalid_evidence'|'model_error'; findings: Finding[]; enrichments?: Enrichment[]; validation?: {rejected_count:number; reasons:string[]; duplicates_removed:number; speech_word_count:number; model_insufficient:boolean}};
export type SlideReview = {attempt_id: string; feedback_revision: number; transcript_revision?: number; state: string; stale: boolean;
 review_version: string; scope: ReviewScope; updated_at: string|null;
 requirements: {context_id: string|null; revision: number|null; audience: string; required_duration_seconds: number|null};
 selection: {token: string}|null; retry_available: boolean; requires_confirmation: boolean; retry_at: string|null;
 availability: {state: string}; error: {message:string}|null;
 dependency: {state?:string; retry_action: string|null; retry_available: boolean; description_set_id: string; processing_revision: number; requires_confirmation:boolean}|null;
 result: {review_version:string; transcript_revision:number; stale:boolean; evidence: FeedbackEvidence; slides:SlideSummary[]}|null};
export function reviewScope(slide: number, part: SlidePart, context: string|null): ReviewScope {
 return {context_id:context,slides:[{slide_index:slide,segments:part.segments.map(s=>({start_ms:s.startMs,end_ms:s.endMs}))}]};
}
export const reviewActive = (s: SlideReview|null) => !!s && !s.stale && !s.dependency?.retry_action && ['queued','waiting_descriptions','preparing','submitted','normalizing','waiting_quota'].includes(s.state);
export function reviewStatus(s: SlideReview|null, slide:number) {
 if (!s) return 'Not analyzed';
 if (s.stale || s.state==='stale') return 'Feedback outdated';
 if (s.dependency?.retry_action) return s.dependency.requires_confirmation?'Profile retry needs confirmation':'Slide profile analysis failed';
 if (reviewActive(s)) return 'Analyzing…';
 if (s.result?.stale && s.state==='completed') return 'Feedback outdated';
 if (s.state==='failed') return 'Analysis failed';
 if (s.state==='needs_confirmation') return 'Retry needs confirmation';
 if (s.state==='completed') {
  const summary=s.result?.slides.find(x=>x.slide_index===slide);
  if (!summary || summary.status==='insufficient_evidence') return 'Insufficient evidence';
  if(summary.status==='invalid_evidence')return 'Feedback couldn’t be verified';
  if(summary.status==='model_error')return 'AI response couldn’t be processed';
  if(summary.status==='partial')return 'Some feedback couldn’t be verified';
  return summary.findings.length ? 'Focus on these' : 'Looks good!';
 }
 return s.state==='disabled'||s.state==='unavailable' ? 'Analysis unavailable' : 'Not analyzed';
}
const integer=(n:unknown)=>Number.isSafeInteger(n);
export function parseSlideReview(raw:unknown,id:string,scope:ReviewScope,review:ReviewAttempt|null):SlideReview {
 const s=raw as SlideReview;
 const bad=()=>{throw new Error('Invalid slide review response. Your recording is preserved.');};
 if (!s || s.attempt_id!==id || s.review_version!==REVIEW_VERSION || !structurallyEqual(s.scope,scope) ||
   !integer(s.feedback_revision)||s.feedback_revision<0 || typeof s.stale!=='boolean' ||
   !['absent','disabled','unavailable','completed','failed','stale','needs_confirmation','queued','waiting_descriptions','preparing','submitted','normalizing','waiting_quota'].includes(s.state) ||
   !s.availability || !['available','disabled','unavailable'].includes(s.availability.state) ||
   typeof s.retry_available!=='boolean'||typeof s.requires_confirmation!=='boolean'||
   !s.requirements || s.requirements.context_id!==scope.context_id || typeof s.requirements.audience!=='string' ||
   !(s.requirements.required_duration_seconds===null || integer(s.requirements.required_duration_seconds)&&s.requirements.required_duration_seconds>=60&&s.requirements.required_duration_seconds<=1800) ||
   !(s.requirements.revision===null||integer(s.requirements.revision)&&s.requirements.revision>=0) ||
   (s.selection!=null&&!/^[a-f0-9]{64}$/.test(s.selection.token))) bad();
 if (!s.result) return s;
 const result=s.result!;
 if ((result.review_version!==REVIEW_VERSION && !(['slide-review-v1','slide-review-v2'].includes(result.review_version) && result.stale)) || typeof result.stale!=='boolean' || !integer(result.transcript_revision)||result.transcript_revision<0 ||
   !Array.isArray(result.slides)||result.slides.length!==scope.slides.length || !review?.transcript ||
   !Array.isArray(result.evidence?.sources)||!Array.isArray(result.evidence?.descriptions?.slides)||
   result.evidence?.attempt_id!==id || result.evidence?.transcript_id!==review.transcript_id) bad();
 const seen=new Set<number>();
 for(const summary of result.slides) {
  const selection=scope.slides.find(x=>x.slide_index===summary.slide_index);
  if(!selection || seen.has(summary.slide_index) || !['successful','insufficient_evidence','partial','invalid_evidence','model_error'].includes(summary.status) ||
     !Array.isArray(summary.findings)||summary.findings.length>4) bad();
  if(result.review_version!=='slide-review-v1' && (!['informative_descriptive','analytical_persuasive','mixed_or_uncertain'].includes(summary.evaluation_mode??'') || !Array.isArray(summary.enrichments) || summary.enrichments.length>2 ||
     summary.enrichments.some(x=>x.kind!=='illustrative'||typeof x.idea!=='string'||!x.idea.trim()||x.idea.length>500))) bad();
  if(summary.validation){const v=summary.validation;
   if(!integer(v.rejected_count)||v.rejected_count<0||v.rejected_count>33||!Array.isArray(v.reasons)||v.reasons.length!==v.rejected_count||
      v.reasons.some(x=>!['invalid_slide_metadata','invalid_finding_metadata','source_identity_mismatch','invalid_visit_or_word_range','unsupported_finding_metadata','speech_quote_mismatch','slide_quote_mismatch','invalid_evidence_timing','evidence_quote_too_long'].includes(x))||
      !integer(v.duplicates_removed)||v.duplicates_removed<0||v.duplicates_removed>32||!integer(v.speech_word_count)||v.speech_word_count<0||v.speech_word_count>6000||typeof v.model_insufficient!=='boolean')bad();
  }
  seen.add(summary.slide_index);
  let priority=0;
  for(const f of summary.findings) {
   if(!['content','graph','audience','fillers','repetition','delivery','timing'].includes(f.category) || !integer(f.priority)||f.priority<priority||f.priority<1||f.priority>4 ||
     f.slide_index!==summary.slide_index || typeof f.observation!=='string'||!f.observation.trim()||f.observation.length>600 ||
     typeof f.suggestion!=='string'||!f.suggestion.trim()||f.suggestion.length>700 ||
     !integer(f.start_ms)||!integer(f.end_ms)||f.end_ms<=f.start_ms||f.end_ms>(review!.duration_ms??0) ||
     !selection!.segments.some(x=>x.start_ms<=f.start_ms&&f.start_ms<x.end_ms)) bad();
   priority=f.priority;
   if(f.category==='timing') {if(s.requirements.required_duration_seconds===null||f.speech_quote!==''||f.word_start!==-1)bad();continue;}
   const words=review!.transcript!.words;
   if(!integer(f.word_start)||!integer(f.word_end)||f.word_start<0||f.word_end<f.word_start||f.word_end>=words.length||
     typeof f.speech_quote!=='string'||[...f.speech_quote].length>1000||f.transcript_id!==review!.transcript_id||!/^[a-f0-9]{64}$/.test(f.source_id) || result.evidence.sources.find(x=>x.slide_index===f.slide_index)?.source_id!==f.source_id ||
     !/^v[0-9]{1,4}s[0-9]{1,4}$/.test(f.segment_id)||
     (f.category==='audience'&&!s.requirements.audience.trim()))bad();
   const selected=words.slice(f.word_start,f.word_end+1);
   const visit=review!.visits?.[f.visit_id];
   if(!visit||visit.slide_index!==f.slide_index||selected.some(w=>w.start_ms<visit.start_ms||w.start_ms>=visit.end_ms)||
      !quotesEqual(f.speech_quote,selected.map(w=>w.text).join(' ')) || f.start_ms!==Math.min(...selected.map(w=>w.start_ms))||
      f.end_ms!==Math.max(...selected.map(w=>w.end_ms)))bad();
   const description=result.evidence.descriptions.slides.find(x=>x.slide_index===f.slide_index);
   const facts:Record<string,DescriptionFact>=description?{summary:description.summary,...Object.fromEntries(description.key_ideas.map((x,i)=>[`key_ideas/${i}`,x])),...Object.fromEntries(description.visual_facts.map((x,i)=>[`visual_facts/${i}`,x]))}:{};
   const fact=facts[f.description_ref];
   if((f.description_ref||f.slide_quote||['content','graph'].includes(f.category))&&(!fact||fact.uncertain||verifiedExcerpt(f.slide_quote,fact.text)===null))bad();
   if(typeof f.slide_quote!=='string'||typeof f.description_ref!=='string'||
      (['content','graph'].includes(f.category)&&(!f.slide_quote||!f.description_ref)))bad();
  }
 }
 return s;
}
