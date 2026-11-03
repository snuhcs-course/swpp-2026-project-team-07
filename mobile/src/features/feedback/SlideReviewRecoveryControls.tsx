// OpenAI Codex, issue #49: docs/ai-collaboration-prompts-iteration-2.md.
import { Pressable, View } from 'react-native';
import { Txt } from '../../design/frame';
import { createThemedStyles, useTheme } from '../../design/theme';
import { C, F } from '../../design/tokens';
import { completedReviewNeedsRecovery, reviewActive } from './slideReview';
import type { useSlideReview } from './useSlideReview';

export function SlideReviewRecoveryControls({feedback:fb,slide,ready,dirty}:{feedback:ReturnType<typeof useSlideReview>;slide:number;ready:boolean;dirty:boolean}) {
 useTheme();
 const state=fb.state;
 const recoverable=completedReviewNeedsRecovery(state,slide);
 const action=!!state?.stale||!!state?.feedback_revision&&state.state!=='completed'||fb.initial==='failed'||recoverable;
 const disabled=dirty||fb.busy||!ready||!state||state.availability.state!=='available'||reviewActive(state)||
  !!state.feedback_revision&&!(state.dependency?.retry_action?state.dependency.retry_available:state.retry_available);
 return <>
  {!!fb.notice&&<Txt accessibilityRole="alert" style={styles.note}>{fb.notice}</Txt>}
  {!!state?.error&&!fb.notice&&<Txt style={styles.note}>{state.error.message}</Txt>}
  {action&&<SlideReviewAction label={state?.stale?'Update feedback':'Retry feedback'}
   text={fb.busy?'Preparing…':state?.dependency?.retry_action?'Retry slide profiles':state?.stale?'Update feedback':'Retry feedback'}
   disabled={disabled} onPress={()=>void fb.generate()}/>}
  {fb.ask&&<View style={styles.card}><Txt style={styles.note}>A previous request may have reached the provider. Retrying may incur another charge.</Txt>
   <SlideReviewAction label="Confirm feedback retry" text="Retry anyway" disabled={fb.busy} onPress={fb.confirm}/>
   <SlideReviewAction label="Cancel feedback retry" text="Cancel" onPress={fb.cancel}/></View>}
 </>;
}

export function SlideReviewAction({label,text,onPress,disabled=false}:{label:string;text:string;onPress:()=>void;disabled?:boolean}) {
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={[styles.action,disabled&&{opacity:.45}]}><Txt style={styles.actionText}>{text}</Txt></Pressable>;
}
const styles=createThemedStyles({
 note:{fontFamily:F.medium,fontSize:12,lineHeight:18,color:C.secondary},
 card:{paddingTop:12,gap:8,borderTopWidth:1,borderTopColor:'rgba(255,255,255,.12)'},
 action:{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderRadius:18,alignSelf:'flex-start',justifyContent:'center',backgroundColor:'rgba(255,255,255,.10)'},
 actionText:{fontFamily:F.semibold,fontSize:12,color:C.text},
});
