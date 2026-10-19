// Rubric scores use the scoring transport only; legacy findings stay separate.
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '../../design/frame';
import { ScoreRing } from '../../design/ScoreRing';
import { F } from '../../design/tokens';
import { useTheme } from '../../design/theme';
import { scoreActive, type PresentationScore, type ScoreEvidence, type ScoreFeedback, type ScoreLevel, type ScoreResult, type ScoreTarget, type SlideScore } from './presentationScore';
import { scoreAudioEvidence, scoreEvidenceLabel, scoreLevelColor, scoreLevelLabel, scoreNumber, scoreRingStatus } from './presentationScoreDisplay';

type Controller = {state:PresentationScore|null;busy:boolean;notice:string;ask:boolean;refresh:()=>unknown;generate:()=>unknown;confirm:()=>unknown;cancel:()=>unknown};
export type ScoreDisplay = {score:number|null;level:ScoreLevel|null;status:string;state:PresentationScore|null;result:ScoreResult|SlideScore|null;target:ScoreTarget|null};
export function PresentationScoreRing({id,label,item}:{id:string;label:'Overall score'|'Slide score';item:Pick<ScoreDisplay,'score'|'level'|'status'>}) {
 const {c}=useTheme(),value=scoreNumber(item.score),color=scoreLevelColor(value===null?null:item.level,c),status=scoreRingStatus(item.status);
 return <ScoreRing id={id} percent={value} value={value===null?status.includes('…')?'…':'—':String(value)} label={`${label}\n${value===null?status:scoreLevelLabel(item.level)}`} labelColor={color} gradient={[color,color]}/>;
}
export function PresentationScorePanel({item,controller,target,overall=false,active=true,notice='',refresh,onEvidence}:{item:ScoreDisplay;controller:Controller;target:ScoreTarget|null;overall?:boolean;active?:boolean;notice?:string;refresh:()=>unknown;onEvidence:(refs:ScoreEvidence[])=>void}) {
 const {c}=useTheme(),state=controller.state;
 const current=!!item.state&&!item.state.stale&&item.state.state==='completed';
 const result=current?item.result:null,feedback=result?.feedback;
 const busy=controller.busy||scoreActive(state),ready=!!target?.review?.transcript_id&&!!target.review.transcript&&!!target.review.duration_ms;
 const unavailable=!!state&&state.availability.state!=='available';
 const rejected=overall&&current&&!!result&&'overall' in result&&result.overall.status==='invalid_evidence';
 const rejectedAssessment=state?.state==='completed'&&!state.stale&&state.assessment_status==='invalid_evidence';
 const retry=state?.state==='failed'||state?.requires_confirmation||!!state?.dependency?.retry_action||rejectedAssessment||rejected||!!controller.notice&&!(state?.state==='completed'&&!state.stale);
 return <View style={[styles.root,{borderColor:c.hair}]}>
  <View style={styles.heading}><Txt style={[styles.title,{color:c.text}]}>{overall?'Presentation score':'Slide score'}</Txt><Action label="Refresh score status" text="Refresh" disabled={!active||controller.busy} onPress={()=>void refresh()}/></View>
  <Txt accessibilityLiveRegion="polite" style={[styles.status,{color:c.text}]}>{rejected?'Presentation score unavailable. Your slide scores are saved.':item.status}</Txt>
  {!target&&<Txt style={[styles.note,{color:c.secondary}]}>{overall?'An overall score needs one complete original recording. Each slide can show its selected original recording’s score.':'Select an exact original recording for this slide to score it.'}</Txt>}
  {target&&!ready&&<Txt style={[styles.note,{color:c.secondary}]}>Analyze this original recording to obtain a transcript before scoring.</Txt>}
  {target&&retry&&<Action label="Retry grading" text={busy?'Scoring…':'Retry'} disabled={!active||busy||!ready||unavailable||controller.ask} onPress={()=>void controller.generate()}/>}
  {controller.ask&&target&&<View style={[styles.card,{borderColor:c.hair}]}><Txt style={[styles.note,{color:c.secondary}]}>A previous request may have reached the provider. Retrying may incur another charge.</Txt><Action label="Confirm grading retry" text="Retry anyway" disabled={!active||controller.busy} onPress={()=>void controller.confirm()}/><Action label="Cancel grading retry" text="Cancel" onPress={()=>void controller.cancel()}/></View>}
  {!!(notice||controller.notice)&&<Txt accessibilityRole="alert" style={[styles.note,{color:c.secondary}]}>{notice||controller.notice}</Txt>}
  {state?.state==='failed'&&state.error&&<Txt style={[styles.note,{color:c.secondary}]}>{state.error.message}</Txt>}
  {!!result&&<>
   {!!feedback?.summary&&<View style={styles.list}><Txt style={[styles.body,{color:c.text}]}>{feedback.summary.text}</Txt><Evidence refs={feedback.summary.evidence} title="Score summary" onEvidence={onEvidence}/></View>}
   {'justification' in result&&!!result.justification&&<Txt style={[styles.body,{color:c.text}]}>{result.justification}</Txt>}
   {!!feedback&&<Feedback value={feedback} onEvidence={onEvidence}/>}
  </>}
 </View>;
}
function Feedback({value,onEvidence}:{value:ScoreFeedback;onEvidence:(refs:ScoreEvidence[])=>void}) {
 const {c}=useTheme();return <View style={styles.list}>
  {(['strengths','weaknesses','improvements'] as const).map(key=>value[key].length>0&&<View key={key} style={styles.list}><Txt style={[styles.criterion,{color:c.text}]}>{key==='improvements'?'Actionable improvements':key[0].toUpperCase()+key.slice(1)}</Txt>{value[key].map((advice,i)=><View key={i} style={styles.list}><Txt style={[styles.body,{color:c.text}]}>{advice.text}</Txt><Evidence refs={advice.evidence} title={`${key} ${i+1}`} onEvidence={onEvidence}/></View>)}</View>)}
  {!!value.improvement_shortage&&<Txt style={[styles.note,{color:c.secondary}]}>{value.improvement_shortage}</Txt>}
 </View>;
}
function Evidence({refs,title,onEvidence}:{refs:ScoreEvidence[];title:string;onEvidence:(refs:ScoreEvidence[])=>void}) {
 const {c}=useTheme(),audio=scoreAudioEvidence(refs);
 return <View style={styles.list}>
  {audio.length>1&&<Action label={`Play cited audio for ${title}`} text={`Listen to ${audio.length} cited intervals`} onPress={()=>onEvidence(audio)}/>}
  {refs.map((ref,i)=><View key={i} style={styles.list}>
   <Txt style={[styles.source,{color:c.secondary}]}>{scoreEvidenceLabel(ref)}</Txt>
   {'quote' in ref&&<Txt style={[styles.note,{color:c.secondary}]}>{'“'+ref.quote+'”'}</Txt>}
   {ref.kind==='slide'?<Action label={`Show slide ${ref.slide_index+1} evidence`} text={`Open slide ${ref.slide_index+1}`} onPress={()=>onEvidence([ref])}/>:
    'start_ms' in ref?(ref.end_ms>ref.start_ms?<Action label={`Listen to evidence ${i+1} for ${title}`} text="Listen to this interval" onPress={()=>onEvidence([ref])}/>:<Txt style={[styles.note,{color:c.secondary}]}>No playable interval</Txt>):null}
  </View>)}
 </View>;
}
function Action({label,text=label,onPress,disabled=false}:{label:string;text?:string;onPress:()=>void;disabled?:boolean}) {
 const {c}=useTheme();return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.action,{backgroundColor:c.surface10,opacity:disabled ? .45 : 1}]}><Txt style={[styles.actionText,{color:c.text}]}>{text}</Txt></Pressable>;
}
const styles=StyleSheet.create({root:{gap:10,borderTopWidth:1,paddingTop:14,marginBottom:12},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},title:{fontFamily:F.display,fontSize:18},status:{fontFamily:F.semibold,fontSize:14},note:{fontFamily:F.medium,fontSize:12,lineHeight:18},body:{fontFamily:F.medium,fontSize:13,lineHeight:20},criterion:{fontFamily:F.semibold,fontSize:14,lineHeight:20},card:{gap:8,paddingTop:12,borderTopWidth:1},list:{gap:8},source:{fontFamily:F.medium,fontSize:10,lineHeight:15},action:{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderRadius:16,alignSelf:'flex-start',justifyContent:'center'},actionText:{fontFamily:F.semibold,fontSize:12}});
