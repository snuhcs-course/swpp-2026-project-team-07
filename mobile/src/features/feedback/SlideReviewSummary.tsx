// OpenAI Codex reliability fixes: docs/ai-collaboration-prompts-iteration-2.md#cue-and-feedback-reliability-october-16-2026
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Txt } from '../../design/frame';
import { createThemedStyles, useTheme } from '../../design/theme';
import { C, F } from '../../design/tokens';
import type { SlidePart } from '../../domain/run';
import { fmt } from '../../domain/format';
import { API_URL } from '../../services/api';
import { readRequirements } from '../presentations/requirementsStore';
import { requirementsDirty } from '../presentations/requirementsDraft';
import { readReview } from '../transcription/reviewStorage';
import { useStore } from '../presentations/store';
import { reviewScope, reviewStatus, type Finding } from './slideReview';
import { initialFeedbackEnabled } from './automaticFeedback';
import { useSlideReview } from './useSlideReview';

export function SlideReviewSummary({slide,part,localDeckId,onEvidence}:{slide:number;part:SlidePart;localDeckId:string;onEvidence:(f:Finding)=>void}) {
 useTheme();
 const version=useStore(s=>s.version);
 const review=useMemo(()=>{void version;try{return readReview(API_URL,part.attemptId);}catch{return null;}},[part.attemptId,version]);
 let context:string|null=null, revision:number|null=null;
 try{const r=readRequirements(localDeckId,API_URL);if(r.deckId===review?.deck_id){context=r.contextId;revision=r.contextId?r.revision:null;}}catch{/* Missing requirements remain missing. */}
 const scope=reviewScope(slide,part,context);
 const fb=useSlideReview(part.attemptId,scope,review,revision,false,localDeckId);
 const dirty=requirementsDirty(localDeckId,API_URL);
 const [enrichmentOpen,setEnrichmentOpen]=useState(false);
 const state=fb.state;
 const summary=state?.result&&!state.stale&&!state.result.stale&&state.state==='completed'?state.result.slides.find(s=>s.slide_index===slide):null;
 const title=reviewStatus(state,slide);
 const ready=!!review?.transcript?.words.length;
 const eligible=initialFeedbackEnabled(API_URL,part.attemptId);
 const noSpeech=review?.processing_result?.analysis_outcome==='no_speech';
 const disabled=dirty || fb.busy || !ready || !!state&&state.availability.state!=='available' ||
   (!!state?.feedback_revision&&!state.retry_available&&!state.dependency?.retry_available&&!state.stale&&state.state!=='completed');
 return <View style={styles.root}>
  <View style={styles.heading}><Txt style={styles.headingText}>AI feedback</Txt>
   <Action label="Refresh slide feedback status" text="Refresh" onPress={()=>void fb.refresh()} disabled={fb.busy}/></View>
  <Txt accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.status}>{ready?(state?.state==='absent'&&!state.stale?(fb.initial==='failed'?'First feedback could not start':eligible?'Preparing first feedback…':'Feedback begins with a new recording.'):title):noSpeech?'No speech detected — insufficient evidence.':'Transcript pending — analyze this recording first.'}</Txt>
  {dirty&&<Txt style={styles.note}>Presentation settings saved on phone · synchronize before updating AI feedback.</Txt>}
  {summary?.status==='partial'&&<Txt style={styles.note}>Verified findings are shown below. Some other feedback could not be verified.</Txt>}
  {summary?.status==='invalid_evidence'&&<Txt style={styles.note}>The AI’s evidence did not match the saved recording or slide. Your audio and transcript are preserved.</Txt>}
  {summary?.status==='model_error'&&<Txt style={styles.note}>The AI returned invalid feedback data. Your recording is preserved.</Txt>}
  {summary?.status==='insufficient_evidence'&&<Txt style={styles.note}>{summary.validation&&summary.validation.speech_word_count<2?'Try recording a fuller explanation for this slide.':'Your recording is preserved. This does not mean that no speech was recorded or that no improvements are possible.'}</Txt>}
  {state?.requirements && <>
   {!state.requirements.audience.trim()&&<Txt style={styles.note}>Audience not provided; audience-specific feedback is unavailable.</Txt>}
   {state.requirements.required_duration_seconds===null&&<Txt style={styles.note}>Time limit not provided; displayed targets are suggestions.</Txt>}
  </>}
  {summary?.findings.map((f,i)=><FindingCard key={`${f.category}:${f.word_start}:${i}`} finding={f} onEvidence={()=>onEvidence(f)}/>)}
  {!!summary?.enrichments?.length&&<View style={styles.card}>
   <Action label={enrichmentOpen?'Hide Further Insight':'Show Further Insight'} text={enrichmentOpen?'Hide Further Insight':'Further Insight · optional'} onPress={()=>setEnrichmentOpen(x=>!x)}/>
   {enrichmentOpen&&summary.enrichments.map((idea,i)=><View key={i} style={{gap:6}}>
    <Txt style={styles.category}>ILLUSTRATIVE IDEA</Txt><Txt style={styles.advice}>{idea.idea}</Txt>
   </View>)}
  </View>}
  {!!fb.notice&&<Txt accessibilityRole="alert" style={styles.note}>{fb.notice}</Txt>}
  {!!state?.error&&!fb.notice&&state.state==='failed'&&<Txt style={styles.note}>{state.error.message}</Txt>}
  {state?.stale||state?.feedback_revision&&state.state!=='completed'||fb.initial==='failed' ? <Action label={state?.stale?'Update feedback':'Retry feedback'}
   text={fb.busy?'Preparing…':state?.dependency?.retry_action?'Retry slide profiles':state?.stale?'Update feedback':'Retry feedback'}
   disabled={disabled} onPress={()=>void fb.generate()}/>:null}
  {fb.ask&&<View style={styles.card}><Txt style={styles.note}>A previous request may have reached the provider. Retrying may incur another charge.</Txt>
   <Action label="Confirm feedback retry" text="Retry anyway" onPress={fb.confirm}/><Action label="Cancel feedback retry" text="Cancel" onPress={fb.cancel}/></View>}
 </View>;
}
export function FindingCard({finding:f,onEvidence}:{finding:Finding;onEvidence:()=>void}) {
 useTheme();
 const [expanded,setExpanded]=useState(false);
 return <View style={styles.card}>
  <Txt style={styles.category}>{f.category.toUpperCase()}</Txt>
  <Txt style={styles.problem}>{f.observation}</Txt><Txt style={styles.advice}>{f.suggestion}</Txt>
  <Action label={`${expanded?'Hide':'Show'} ${f.category} feedback details`} text={expanded?'Hide details':'Details & evidence'} onPress={()=>setExpanded(value=>!value)}/>
  {expanded&&<>
  {!!f.slide_quote&&<Txt style={styles.note}>Slide: {f.slide_quote}</Txt>}
  {!!f.speech_quote&&<Txt style={styles.note}>Speech: “{f.speech_quote}”</Txt>}
  <Action label={`Review ${f.category} evidence at ${fmt(f.start_ms/1000)}`} text={`Listen at ${fmt(f.start_ms/1000)}`} onPress={onEvidence}/>
  </>}
 </View>;
}
function Action({label,text,onPress,disabled=false}:{label:string;text:string;onPress:()=>void;disabled?:boolean}) {
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={[styles.action,disabled&&{opacity:.45}]}><Txt style={styles.actionText}>{text}</Txt></Pressable>;
}
const styles=createThemedStyles({
 root:{gap:10,marginTop:14},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 headingText:{fontFamily:F.display,fontSize:18,color:C.text},status:{fontFamily:F.semibold,fontSize:14,color:C.text},
 note:{fontFamily:F.medium,fontSize:12,lineHeight:18,color:C.secondary},
 card:{paddingTop:12,gap:8,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.12)'},
 category:{fontFamily:F.bold,fontSize:10,letterSpacing:1,color:C.warn},
 problem:{fontFamily:F.semibold,fontSize:15,lineHeight:21,color:C.text},advice:{fontFamily:F.medium,fontSize:13,lineHeight:19,color:C.body},
 action:{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderRadius:18,alignSelf:'flex-start',justifyContent:'center',backgroundColor:'rgba(255,255,255,.10)'},
 actionText:{fontFamily:F.semibold,fontSize:12,color:C.text},
});
