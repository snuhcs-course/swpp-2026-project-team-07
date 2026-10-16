// OpenAI Codex review routing: docs/ai-collaboration-prompts-iteration-2.md#first-recording-review-navigation-october-16-2026
// AI-assisted Nakajima integration: verified selected-slide feedback in the normal Review page.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { EASE_SCREEN, F } from '../design/tokens';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { fmt, relativeDay } from '../domain/format';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { runLabel } from '../domain/run';
import { slideText } from '../domain/lines';
import { fillerTotal } from '../domain/words';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { SlideReviewSummary } from '../features/feedback/SlideReviewSummary';
import { PresentationScorePanel, PresentationScoreRing, type ScoreDisplay } from '../features/feedback/PresentationScorePanel';
import { useRunPresentationScores } from '../features/feedback/useRunPresentationScores';
import { currentScoreEvidence, scoreAudioEvidence } from '../features/feedback/presentationScoreDisplay';
import type { ScoreEvidence } from '../features/feedback/presentationScore';
import type { ReviewEvidence } from './ReviewRecordingTools';
import { audioOf } from '../features/rehearsal/analysis';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import { ReviewSlidePlayback, ReviewSlidePreview } from './ReviewSlidePlayback';
import { useBack, useNow, useShell } from './shared';

const EMPTY_SCORE:ScoreDisplay={score:null,level:null,status:'Not graded',state:null,result:null,target:null};

export function ReviewScreen({active=true}:{active?:boolean}) {
 const {nav}=useShell();const model=useDeckModel(nav.deckId);
 // Selection/source changes reset playback and inline transcript expansion together.
 return <ReviewContent key={JSON.stringify([nav.deckId,nav.sel,model?.state.run?.parts[nav.sel],active])} model={model} active={active}/>;
}
function ReviewContent({model,active}:{model:DeckModel|null;active:boolean}) {
 const {c}=useTheme(),{go,nav}=useShell(),frame=useFrame();
 const n=model?.n??0;
 const s=Math.max(0,Math.min(Math.max(0,n-1),nav.sel));
 const feedback=useRunFeedbackStatus(model,active),item=feedback.items[s];
 const scores=useRunPresentationScores(model,active,s),scoreItem=scores.items[s]??EMPTY_SCORE;
 const scoreSource=useRef({item:scoreItem,target:scores.target,part:model?.state.run?.parts[s],active});
 const scorePart=model?.state.run?.parts[s];
 useLayoutEffect(()=>{scoreSource.current={item:scoreItem,target:scores.target,part:scorePart,active};return()=>{scoreSource.current.active=false;};},[scoreItem,scores.target,scorePart,active]);
 const player=useSegmentPlayer(),stopPlayback=player.stop;
 const dy=useSharedValue(0),backExiting=useRef(false),scrollY=useRef(0),scroll=useRef<ScrollView>(null);
 const [headerBottom,setHeaderBottom]=useState(176);
 const [evidence,setEvidence]=useState<{finding:ReviewEvidence;request:number;scoreIdentity?:string}|null>(null);
 const [scoreAudioNote,setScoreAudioNote]=useState('');
 const currentEvidence=evidence?.scoreIdentity&&(!scoreItem.state||scoreItem.state.stale||scoreItem.state.state!=='completed'||scoreItem.state.source_identity!==evidence.scoreIdentity)?null:evidence;
 useEffect(()=>{if(evidence&&!currentEvidence)stopPlayback();},[evidence,currentEvidence,stopPlayback]);
 const now=useNow();
 const showEvidence=useCallback((y:number)=>scroll.current?.scrollTo({y,animated:true}),[]);
 useEffect(()=>{if(!active){dy.set(0);stopPlayback();}},[active,dy,stopPlayback]);
 useEffect(()=>()=>stopPlayback(),[stopPlayback]);
 const toBack=useCallback(()=>{stopPlayback();if(nav.from==='full')go('full',{deckId:nav.deckId,sel:s});else go('rehearse',{nav:null,deckId:nav.deckId,slide:s});},[go,nav.deckId,nav.from,s,stopPlayback]);
 const toQA=useCallback(()=>{stopPlayback();go('qa',{nav:'fade',deckId:nav.deckId,sel:s});},[go,nav.deckId,s,stopPlayback]);
 const toFull=useCallback(()=>{stopPlayback();go('full',nav.from==='full'?{deckId:nav.deckId,sel:s}:{nav:'fade',deckId:nav.deckId,sel:s,from:'review'});},[go,nav.deckId,nav.from,s,stopPlayback]);
 useBack(active,()=>{toBack();return true;});
 const pan={
  onMoveShould:(e:GestureResponderEvent,g:PanResponderGestureState)=>{
   const y=(e.nativeEvent.pageY-frame.top)/frame.s;
   return !backExiting.current&&Math.abs(g.dy)>8&&Math.abs(g.dy)>Math.abs(g.dx)&&
    (g.dy>0&&scrollY.current<=0 || g.dy<0&&(y<headerBottom||y>777));
  },
  onMove:(_e:GestureResponderEvent,g:PanResponderGestureState)=>dy.set(Math.max(-BACK_FADE_Y,Math.min(BACK_FADE_Y,g.dy/frame.s))),
  onRelease:()=>{if(dy.get()>BACK_T){backExiting.current=true;dy.set(withTiming(BACK_FADE_Y,{duration:220,easing:EASE_SCREEN},done=>{if(done)runOnJS(toBack)();}));}else if(dy.get() < -BACK_T)toQA();else dy.set(withTiming(0,{duration:220,easing:EASE_SCREEN}));},
  onTerminate:()=>{if(!backExiting.current)dy.set(withTiming(0,{duration:220,easing:EASE_SCREEN}));},
 };
 const screen=useAnimatedStyle(()=>({opacity:Math.max(0,1-Math.max(0,dy.value)/BACK_FADE_Y)}));
 if(!model||!model.state.run)return null;
 const {deck,times,state}=model,run=state.run!,part=run.parts[s],partId=part?.attemptId??null;
 const t=times[s]??0,target=deck.targets[s]??0,source=deck.requirementsDefault?'default':deck.timing.source==='required'?'required':'suggested';
 const pending=!!partId&&!model.transcripts.has(partId)&&model.stages.get(partId)!=='no_speech';
 const maxT=Math.max(1,...times),a=feedback.aggregate;
 const onScoreEvidence=(refs:ScoreEvidence[])=>{
  const current=scoreSource.current,sourceTarget=current.target;
  if(!current.active||!sourceTarget||!currentScoreEvidence(current.item.state,sourceTarget,refs)||current.part?.attemptId!==sourceTarget.id)return;
  const fact=refs.find(ref=>ref.kind==='slide');
  if(fact?.kind==='slide'){stopPlayback();go('review',{deckId:deck.id,sel:fact.slide_index});return;}
  const audio=scoreAudioEvidence(refs),duration=sourceTarget.review?.duration_ms??0;
  if(!audio.length||audio.some(ref=>ref.attempt_id!==sourceTarget.id||ref.end_ms>duration))return;
  stopPlayback();setScoreAudioNote('');
  const first=audio[0];
  setEvidence(previous=>({finding:{start_ms:first.start_ms,end_ms:first.end_ms,speech_quote:first.kind==='speech'?first.quote:undefined,observation:first.kind==='measurement'?first.measurement_id:first.kind==='full_attempt'?'Full original recording':undefined},request:(previous?.request??0)+1,scoreIdentity:current.item.state!.source_identity!}));
  if(audio.length>1){const uri=audioOf(sourceTarget.id);if(!uri){setScoreAudioNote('Original recording audio is not on this phone. Download it with the recording tools.');return;}void player.playSegments(`score-evidence:${sourceTarget.id}:${audio.map(ref=>`${ref.start_ms}:${ref.end_ms}`).join(',')}`,audio.map(ref=>({uri,startMs:ref.start_ms,endMs:ref.end_ms})));}
 };

 return <Enter kind={nav.nav}><PanView style={StyleSheet.absoluteFill} {...pan}>
  <Animated.View style={[StyleSheet.absoluteFill,screen]}><PageSurface hue={deck.hue}/>
   <View style={styles.header} onLayout={e=>setHeaderBottom(e.nativeEvent.layout.y+e.nativeEvent.layout.height+12)}>
    <Txt numberOfLines={1} style={[styles.title,{color:c.text}]}>{deck.title}</Txt><Txt style={[styles.label,{color:c.secondary}]}>{runLabel(run,now,relativeDay)}</Txt>
    <Pressable accessibilityRole="button" accessibilityLabel="Full review" accessibilityHint="Review all slides in this presentation" onPress={toFull} style={[styles.fullReview,{backgroundColor:c.strong}]}>
     <View style={styles.fullReviewTitle}><Glyph name="h-review-bars" size={18} color={c.bg}/><Txt style={[styles.actionText,{color:c.bg}]}>Full Review</Txt></View>
     <Txt style={[styles.fullReviewSummary,{color:c.bg}]}>{`All slides · ${a.assessed}/${a.recorded} assessed · ${a.findings} findings`}</Txt>
    </Pressable>
   </View>
   <ScrollView ref={scroll} style={[styles.scroll,{top:headerBottom}]} contentContainerStyle={styles.content} showsVerticalScrollIndicator
    onScroll={e=>{scrollY.current=e.nativeEvent.contentOffset.y;}} scrollEventThrottle={16}>
    <View style={styles.ringRow}>
     <PresentationScoreRing id="gSlideStatus" label="Slide score" item={scoreItem}/>
     <View style={styles.ringRight}><Txt style={[styles.slideLabel,{color:c.secondary}]}>{`Slide ${s+1} of ${n}`}</Txt>
      <Stat icon="i-clock" value={t>0?fmt(t):'—'} unit={`${fmt(target)} ${source} target`}/>
      <Stat icon="i-bubble" value={pending||t<=0?'—':String(fillerTotal(slideText(model.lines,s)))} unit="fillers"/>
      <Stat icon="i-flag" value={item?.findingCount?String(item.findingCount):item?.assessed?'0':'—'} unit="verified findings"/>
     </View>
    </View>
    <View><View style={styles.row}><Txt style={[styles.section,{color:c.text}]}>Times per slide</Txt><Txt style={[styles.label,{color:c.secondary}]}>Tap a bar</Txt></View>
     <View style={styles.bars}>{times.map((value,i)=><Pressable key={i} accessibilityRole="button" accessibilityState={{selected:i===s}}
      accessibilityLabel={`Slide ${i+1}, ${value>0?fmt(value):'not recorded'}, ${scores.items[i]?.score??scores.items[i]?.status??'Not graded'}${scores.items[i]?.score!=null?' points':''}`} onPress={()=>{stopPlayback();go('review',{sel:i});}}
      style={{flex:1,minWidth:0,height:value?Math.max(6,78*value/maxT):4,borderRadius:4,backgroundColor:i===s?c.strong:c.ink28}}/>)}</View>
     <View style={styles.nums}>{times.map((_,i)=><Txt key={i} style={[styles.number,{color:i===s?c.text:c.secondary}]}>{`${i+1} · ${scores.items[i]?.score??'—'}`}</Txt>)}</View>
    </View>
    {active&&partId&&<ReviewSlidePlayback model={model} id={partId} slide={s} player={player} evidence={currentEvidence?.finding??null} evidenceRequest={currentEvidence?.request??0} onCloseEvidence={()=>setEvidence(null)} onEvidenceShown={showEvidence}/>}
    {!partId&&<View style={{borderWidth:1,borderRadius:20,padding:14,gap:12,borderColor:c.hair,backgroundColor:c.surface06}}><ReviewSlidePreview model={model} slide={s}/><Txt style={[styles.note,{color:c.secondary}]}>No saved audio for this slide.</Txt></View>}
    {!!scoreAudioNote&&<Txt accessibilityRole="alert" style={[styles.note,{color:c.secondary}]}>{scoreAudioNote}</Txt>}
    <PresentationScorePanel key={`${partId}:${s}:${scores.target?.contextId??''}`} item={scoreItem} controller={scores.controller} target={scores.target} active={active} notice={scores.notice} refresh={scores.refresh} onEvidence={onScoreEvidence}/>
    {!!feedback.notice&&<Txt accessibilityLiveRegion="polite" style={[styles.note,{color:c.secondary}]}>{feedback.notice}</Txt>}
    {active&&partId&&part?<SlideReviewSummary key={`${partId}:${s}:${JSON.stringify(part.segments)}`} slide={s} part={part} localDeckId={deck.id}
      onEvidence={finding=>{stopPlayback();setEvidence(previous=>({finding,request:(previous?.request??0)+1}));}}/>:
     <Txt style={[styles.note,{color:c.secondary}]}>Record this slide to receive AI feedback.</Txt>}
   </ScrollView>
   <HintRow hints={[{icon:'h-dn',text:nav.from==='full'?'Full review':'Back to slides',nudge:'down',onPress:toBack},{icon:'h-up',text:'Audience Q&A',nudge:'up',onPress:toQA}]}/>
  </Animated.View></PanView>
</Enter>;
}
function Stat({icon,value,unit}:{icon:'i-clock'|'i-bubble'|'i-flag';value:string;unit:string}) {
 const {c}=useTheme();return <View style={styles.stat}><UIIcon name={icon} size={19}/><Txt style={[styles.statValue,{color:c.text}]}>{value}</Txt><Txt style={[styles.statUnit,{color:c.secondary}]}>{unit}</Txt></View>;
}
const styles=StyleSheet.create({
 header:{position:'absolute',left:30,right:30,top:46,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},label:{fontFamily:F.medium,fontSize:12,lineHeight:17},
 scroll:{position:'absolute',left:16,right:16,top:106,bottom:67},content:{gap:20,paddingBottom:20,paddingTop:10},
 ringRow:{flexDirection:'row',alignItems:'center',gap:18,paddingHorizontal:8},ringRight:{flex:1,minWidth:0,gap:10},slideLabel:{fontFamily:F.semibold,fontSize:13},
 stat:{flexDirection:'row',alignItems:'center',gap:7},statValue:{fontFamily:F.display,fontSize:18,fontVariant:['tabular-nums']},statUnit:{flexShrink:1,fontFamily:F.medium,fontSize:12,lineHeight:16},
 row:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'},section:{fontFamily:F.bold,fontSize:14},bars:{height:78,marginTop:10,flexDirection:'row',alignItems:'flex-end',gap:3},nums:{flexDirection:'row',gap:3,marginTop:5},number:{flex:1,minWidth:0,textAlign:'center',fontFamily:F.bold,fontSize:10},
 fullReview:{alignSelf:'stretch',minHeight:56,borderRadius:16,paddingHorizontal:14,paddingVertical:10,marginTop:12,gap:3,alignItems:'center'},fullReviewTitle:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},fullReviewSummary:{fontFamily:F.medium,fontSize:11,lineHeight:16,opacity:.8,textAlign:'center'},actionText:{fontFamily:F.semibold,fontSize:14},note:{fontFamily:F.medium,fontSize:12,lineHeight:18},
});
