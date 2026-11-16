// OpenAI Codex review routing: docs/ai-collaboration-prompts-iteration-2.md#first-recording-review-navigation-october-16-2026
// AI-assisted Nakajima integration: verified selected-slide feedback in the normal Review page.
// OpenAI Codex compact slide review and scrubber label: docs/ai-collaboration-prompts-iteration-2.md#compact-slide-review-card-and-slider-label-november-1-2026
// OpenAI Codex Review exit underlay and duration colours: docs/ai-collaboration-prompts-iteration-2.md#review-to-qa-fade-underlay-and-time-bar-colours-november-1-2026
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { EASE_SCREEN, F, FRAME_W } from '../design/tokens';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { MiniSlide } from '../design/SlideCard';
import { fmt, relativeDay } from '../domain/format';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { runLabel } from '../domain/run';
import { compactFeedbackRows } from '../features/feedback/compactFeedbackRows';
import { slideText } from '../domain/lines';
import { fillerTotal } from '../domain/words';
import { slideTimingLabel } from '../domain/slides';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { audioOf } from '../features/rehearsal/analysis';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { PresentationScoreRing, type ScoreDisplay } from '../features/feedback/PresentationScorePanel';
import { useRunPresentationScores } from '../features/feedback/useRunPresentationScores';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import { SlideReviewDetails } from '../features/feedback/SlideReviewDetails';
import { useBack, useNow, useShell } from './shared';

const EMPTY_SCORE:ScoreDisplay={score:null,level:null,status:'Not graded',state:null,result:null,target:null};

export function ReviewScreen({active=true}:{active?:boolean}) {
 const {nav}=useShell();const model=useDeckModel(nav.deckId);
 // Selection/source changes reset playback and feedback details together.
 return <ReviewContent key={JSON.stringify([nav.deckId,nav.sel,model?.state.run?.parts[nav.sel],active])} model={model} active={active}/>;
}
function ReviewContent({model,active}:{model:DeckModel|null;active:boolean}) {
 const {c}=useTheme(),{go,nav}=useShell(),frame=useFrame();
 const n=model?.n??0;
 const s=Math.max(0,Math.min(Math.max(0,n-1),nav.sel));
 const [scrubSlide,setScrubSlide]=useState(s),scrubSlideRef=useRef(s);
 const feedback=useRunFeedbackStatus(model,active),item=feedback.items[s];
 const duration=model?.times[s]??0,allocation=model?.deck.targets[s]??0;
 const spokenText=slideText(model?.lines??[],s);
 const selectedAttempt=model?.state.run?.parts[s]?.attemptId;
 const hasTranscript=!!selectedAttempt&&model?.stages.get(selectedAttempt)==='done'&&!!model.transcripts.get(selectedAttempt)?.words.length;
 const fillerCount=duration>0&&hasTranscript&&spokenText.trim()?fillerTotal(spokenText):null;
 const slideReviewRows=compactFeedbackRows(s,item,{durationSeconds:duration,allocationSeconds:allocation,fillerCount});
 const [feedbackOpen,setFeedbackOpen]=useState(false);
 const findingRows=slideReviewRows.flatMap(row=>row.findings);
 const recorded=!!model?.state.run?.parts[s]?.segments.some(segment=>segment.endMs>segment.startMs);
 const detailsOpen=active&&feedbackOpen&&recorded;
 if(feedbackOpen&&!detailsOpen)setFeedbackOpen(false);
 const scores=useRunPresentationScores(model,active,s),scoreItem=scores.items[s]??EMPTY_SCORE;
 const player=useSegmentPlayer(),stopPlayback=player.stop;
 const dy=useSharedValue(0),backExiting=useRef(false);
 const now=useNow();
 const previewSlideAt=(pageX:number)=>{
  if(n<=1)return 0;
  const x=Math.max(0,Math.min(1,((pageX-frame.left)/frame.s-16)/(FRAME_W-32)));
  return Math.min(n-1,Math.floor(x*n));
 };
 const previewSlide=(pageX:number)=>{const next=previewSlideAt(pageX);scrubSlideRef.current=next;setScrubSlide(next);};
 const commitSlide=()=>{const next=scrubSlideRef.current;if(next!==s){stopPlayback();go('review',{deckId:nav.deckId,sel:next});}};
 useEffect(()=>{if(!active){backExiting.current=false;dy.set(0);stopPlayback();}},[active,dy,stopPlayback]);
 useEffect(()=>()=>stopPlayback(),[stopPlayback]);
 const toBack=useCallback(()=>{stopPlayback();go('rehearse',{nav:null,deckId:nav.deckId,slide:s});},[go,nav.deckId,s,stopPlayback]);
 const toQA=useCallback(()=>{stopPlayback();go('qa',{nav:'fade',deckId:nav.deckId,sel:s});},[go,nav.deckId,s,stopPlayback]);
 const toFull=useCallback(()=>{stopPlayback();go('full',nav.from==='full'?{deckId:nav.deckId,sel:s}:{nav:'fade',deckId:nav.deckId,sel:s,from:'review'});},[go,nav.deckId,nav.from,s,stopPlayback]);
 useBack(active,()=>{if(detailsOpen)setFeedbackOpen(false);else toBack();return true;});
 const pan={
  onMoveShould:(e:GestureResponderEvent,g:PanResponderGestureState)=>{
   const y=(e.nativeEvent.pageY-frame.top)/frame.s;
   return !detailsOpen&&!backExiting.current&&Math.abs(g.dy)>8&&Math.abs(g.dy)>Math.abs(g.dx)&&
    !(y>264&&y<360&&Math.abs(g.dx)>4);
  },
  onMove:(_e:GestureResponderEvent,g:PanResponderGestureState)=>dy.set(Math.max(-BACK_FADE_Y,Math.min(BACK_FADE_Y,g.dy/frame.s))),
  onRelease:()=>{
   if(dy.get()>BACK_T){backExiting.current=true;dy.set(withTiming(BACK_FADE_Y,{duration:220,easing:EASE_SCREEN},done=>{if(done)runOnJS(toBack)();}));}
   else if(dy.get() < -BACK_T){backExiting.current=true;dy.set(withTiming(-BACK_FADE_Y,{duration:220,easing:EASE_SCREEN},done=>{if(done)runOnJS(toQA)();}));}
   else dy.set(withTiming(0,{duration:220,easing:EASE_SCREEN}));
  },
  onTerminate:()=>{if(!backExiting.current)dy.set(withTiming(0,{duration:220,easing:EASE_SCREEN}));},
 };
 const screen=useAnimatedStyle(()=>({opacity:Math.max(0,1-Math.abs(dy.value)/BACK_FADE_Y)}));
 if(!model||!model.state.run)return null;
 const {deck,times,state}=model,run=state.run!;
 const t=times[s]??0,target=deck.targets[s]??0,timingLabel=slideTimingLabel(t,target);
 const maxT=Math.max(1,...times);
 const part=run.parts[s],slidePlayKey=`slide:${deck.id}:${s}`;
 const slideAudioUri=part?audioOf(part.attemptId):null;
 const isSlideSelected=player.playingKey===slidePlayKey,slidePlaying=isSlideSelected&&!player.paused;
 // OpenAI Codex, 2026-11-02: verified selected feedback and honest absent-word metrics; see docs/ai-collaboration-prompts-iteration-2.md.
 const fillerValue=fillerCount===null?'—':String(fillerCount);
 const playSlide=()=>{
  if(!part||!slideAudioUri)return;
  void player.playSegments(slidePlayKey,part.segments.filter(segment=>segment.endMs>segment.startMs)
   .map(segment=>({uri:slideAudioUri,...segment})));
 };

 return <Enter kind={nav.nav}><PanView style={StyleSheet.absoluteFill} {...pan}>
  <PageSurface hue={deck.hue}/>
  <Animated.View pointerEvents={detailsOpen?'none':'auto'} accessibilityElementsHidden={detailsOpen}
   importantForAccessibility={detailsOpen?'no-hide-descendants':'auto'} style={[StyleSheet.absoluteFill,screen]}>
   <View style={styles.header}>
    <Txt numberOfLines={1} style={[styles.title,{color:c.text}]}>{deck.title}</Txt><Txt style={[styles.label,{color:c.secondary}]}>{runLabel(run,now,relativeDay)}</Txt>
   </View>
   <View style={styles.content}>
    <View style={styles.ringRow}>
     <PresentationScoreRing id="gSlideStatus" label="Slide score" item={scoreItem}/>
     <View style={styles.ringRight}><Txt style={[styles.slideLabel,{color:c.secondary}]}>{`Slide ${s+1} of ${n}`}</Txt>
      <Stat icon="i-clock" value={t>0?fmt(t):'—'} unit={target>0?`${fmt(target)} allocation`:'No allocation'}/>
      <Stat icon="i-bubble" value={fillerValue} unit="fillers"/>
      <Stat icon="i-flag" value={item?.findingCount?String(item.findingCount):item?.assessed?'0':'—'} unit="verified findings"/>
     </View>
    </View>
    <View style={styles.timesBlock}><View style={styles.row}><Txt style={[styles.section,{color:c.text}]}>Times per slide</Txt><Txt style={[styles.label,{color:c.secondary}]}>{`${scrubSlide+1} of ${n}`}</Txt></View>
     <PanView style={styles.bars} accessibilityRole="adjustable" accessibilityLabel="Times per slide"
      accessibilityValue={{min:1,max:Math.max(1,n),now:scrubSlide+1,text:`Slide ${scrubSlide+1} of ${n}`}}
      accessibilityActions={[{name:'increment'},{name:'decrement'}]}
      onAccessibilityAction={e=>{const next=Math.max(0,Math.min(n-1,scrubSlide+(e.nativeEvent.actionName==='increment'?1:-1)));stopPlayback();go('review',{deckId:nav.deckId,sel:next});}}
      onStartShould={()=>n>0} onGrant={e=>previewSlide(e.nativeEvent.pageX)} onMove={e=>previewSlide(e.nativeEvent.pageX)}
      onRelease={commitSlide} onTerminate={commitSlide} onTerminationRequest={()=>false}>
     <View style={styles.barRow}>{times.map((value,i)=>{
      const target=deck.targets[i]??0;
      const status=slideTimingLabel(value,target),tooLong=status==='Over time',tooShort=status==='Under time';
      const selected=i===scrubSlide;
      return <View key={i} style={styles.barHit}>
       <View style={{width:'100%',height:value?Math.max(6,Math.round(40*value/maxT)):4,borderRadius:4,backgroundColor:selected?c.strong:tooLong?c.badAlt:tooShort?c.warnAlt:value?c.ink28:c.ink08}}/>
      </View>;
     })}</View></PanView>
    </View>
    <View style={[styles.slideCard,{borderColor:c.hair,backgroundColor:c.surface06}]}>
     <View style={styles.slidePreviewRow}>
      <MiniSlide hue={deck.hue} page={deck.pages[s]} title={deck.slides[s]?.title??''} width={160} height={90} radius={12}/>
      <View style={styles.slideFacts}>
       <Txt style={[styles.slideLabel,{color:c.secondary}]}>{`Slide ${s+1}`}</Txt>
       <Txt numberOfLines={2} style={[styles.previewTitle,{color:c.text}]}>{deck.slides[s]?.title??`Slide ${s+1}`}</Txt>
       <Txt numberOfLines={1} style={[styles.slideTime,{color:c.text}]}>{target>0?`${fmt(t)} of ${fmt(target)}`:`${fmt(t)} recorded`}</Txt>
       <Txt style={[styles.targetStatus,{color:timingLabel==='On time'?c.good:timingLabel==='Under time'||timingLabel==='Over time'?c.warn:c.secondary}]}>{timingLabel}</Txt>
      </View>
     </View>
     <Pressable accessibilityRole="button" accessibilityLabel={slidePlaying?`Pause slide ${s+1} playback`:isSlideSelected?`Resume slide ${s+1} playback`:`Play slide ${s+1} recording`}
      accessibilityState={{disabled:!slideAudioUri||!part}} disabled={!slideAudioUri||!part} onPress={playSlide} style={styles.playbackStrip}>
      <Glyph name={slidePlaying?'p-pause':'p-play'} size={15} color={c.text}/>
      <View style={[styles.playTrack,{backgroundColor:c.ink18}]}><View style={[styles.playProgress,{width:`${isSlideSelected?player.progress*100:0}%`,backgroundColor:c.text}]}/></View>
      <Txt style={[styles.playTime,{color:c.secondary}]}>{isSlideSelected?fmt(player.elapsedMs/1000):fmt(t)}</Txt>
     </Pressable>
     {player.error&&isSlideSelected&&<Txt accessibilityRole="alert" style={[styles.playError,{color:c.secondary}]}>{player.error}</Txt>}
     <Pressable style={styles.feedbackRows} disabled={!recorded} accessible={recorded}
      accessibilityRole={recorded?'button':undefined} accessibilityLabel={recorded?`Read slide ${s+1} feedback: ${item?.label??'Not analyzed'}`:undefined}
      accessibilityHint="Opens complete feedback and recovery controls" onPress={()=>setFeedbackOpen(true)}>
      {slideReviewRows.map((row,index)=><View key={`${row.icon}-${index}`} style={styles.feedbackRow}>
      <UIIcon name={row.icon} size={18} color={row.status==='spot'?c.good:row.status==='finding'?c.warn:c.secondary}/>
      <Txt numberOfLines={1} style={[styles.feedbackText,{color:row.status==='spot'?c.good:row.status==='finding'?c.text:c.secondary}]}>{row.text}</Txt>
      {(row.findings.length>0||index===2&&recorded&&!item?.assessed)&&<UIIcon name="i-arrow" size={14} color={c.secondary}/>}
     </View>)}</Pressable>
    </View>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Full review" accessibilityHint="Review all slides in this presentation" onPress={toFull}
    style={[styles.fullReview,{borderColor:c.hair,backgroundColor:c.surface06}]}>
    <View style={styles.fullReviewTitle}><Glyph name="h-review-bars" size={18} color={c.text}/><Txt style={[styles.actionText,{color:c.text}]}>Full Review</Txt></View>
   </Pressable>
   <HintRow hints={[{icon:'h-up',text:'Audience Q&A',nudge:'up',onPress:toQA},{icon:'h-dn',text:'Back to recording',nudge:'down',onPress:toBack}]}/>
  </Animated.View></PanView>
  {detailsOpen&&<View style={[StyleSheet.absoluteFill,{backgroundColor:c.scrim}]}>
   <View accessibilityViewIsModal onAccessibilityEscape={()=>setFeedbackOpen(false)} style={[styles.feedbackDetails,{backgroundColor:c.dialog,borderColor:c.hair}]}>
    <View style={styles.detailsHeader}><Txt accessibilityRole="header" style={[styles.section,{color:c.text}]}>{`Slide ${s+1} feedback`}</Txt>
     <Pressable accessibilityRole="button" accessibilityLabel="Close feedback details" onPress={()=>setFeedbackOpen(false)} style={styles.detailsClose}>
      <Txt style={[styles.actionText,{color:c.text}]}>Close</Txt>
     </Pressable></View>
    <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsBody} accessibilityLabel="Full slide feedback">
     <SlideReviewDetails slide={s} part={part!} localDeckId={deck.id} status={item?.label??'Not analyzed'}>
     {findingRows.map((finding,index)=><View key={`${finding.category}-${index}`} style={styles.detailsFinding}>
      <UIIcon name={slideReviewRows.find(row=>row.findings.includes(finding))!.icon} size={18} color={c.warn}/>
      <Txt style={[styles.detailsText,{color:c.text}]}>{finding.observation}</Txt>
      <Txt style={[styles.detailsText,{color:c.text}]}>{finding.suggestion}</Txt>
     </View>)}
     </SlideReviewDetails>
    </ScrollView>
   </View>
  </View>}
</Enter>;
}
function Stat({icon,value,unit}:{icon:'i-clock'|'i-bubble'|'i-flag';value:string;unit:string}) {
 const {c}=useTheme();return <View style={styles.stat}><UIIcon name={icon} size={19}/><Txt style={[styles.statValue,{color:c.text}]}>{value}</Txt><Txt style={[styles.statUnit,{color:c.secondary}]}>{unit}</Txt></View>;
}
const styles=StyleSheet.create({
 header:{position:'absolute',left:30,right:30,top:46,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},label:{fontFamily:F.medium,fontSize:12,lineHeight:17},
 content:{position:'absolute',left:16,right:16,top:140,gap:4},
 ringRow:{flexDirection:'row',alignItems:'center',gap:18,paddingHorizontal:8},ringRight:{flex:1,minWidth:0,gap:10},slideLabel:{fontFamily:F.semibold,fontSize:13},
 stat:{flexDirection:'row',alignItems:'center',gap:7},statValue:{fontFamily:F.display,fontSize:18,fontVariant:['tabular-nums']},statUnit:{flexShrink:1,fontFamily:F.medium,fontSize:12,lineHeight:16},
 timesBlock:{height:88},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'},section:{fontFamily:F.bold,fontSize:14},bars:{height:44,marginTop:4},barRow:{height:44,flexDirection:'row',alignItems:'flex-end',gap:1},barHit:{position:'relative',flex:1,minWidth:0,height:44,alignItems:'center',justifyContent:'flex-end'},
 slideCard:{marginTop:18,borderWidth:1,borderRadius:20,padding:14,gap:11},slidePreviewRow:{flexDirection:'row',alignItems:'center',gap:12},slideFacts:{flex:1,minWidth:0,gap:4},previewTitle:{fontFamily:F.display,fontSize:15,lineHeight:18},slideTime:{fontFamily:F.semibold,fontSize:12,lineHeight:15,fontVariant:['tabular-nums']},targetStatus:{fontFamily:F.semibold,fontSize:11,lineHeight:14},feedbackRows:{gap:8,minHeight:44},feedbackRow:{minHeight:22,flexDirection:'row',alignItems:'center',gap:8},feedbackText:{flex:1,minWidth:0,fontFamily:F.medium,fontSize:12,lineHeight:16},playbackStrip:{minHeight:36,flexDirection:'row',alignItems:'center',gap:8},playTrack:{height:5,flex:1,borderRadius:3,overflow:'hidden'},playProgress:{height:5},playTime:{fontFamily:F.medium,fontSize:11,fontVariant:['tabular-nums']},playError:{fontFamily:F.medium,fontSize:11,lineHeight:14},
 feedbackDetails:{position:'absolute',left:24,right:24,top:180,bottom:180,borderRadius:20,borderWidth:1,padding:16},detailsHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},detailsClose:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},detailsScroll:{flex:1},detailsBody:{paddingTop:12,paddingBottom:16,gap:20},detailsFinding:{gap:8},detailsText:{fontFamily:F.medium,fontSize:16,lineHeight:24},
 fullReview:{position:'absolute',left:16,right:16,bottom:68,height:58,borderWidth:1,borderRadius:18,overflow:'hidden',alignItems:'center',justifyContent:'center'},fullReviewTitle:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},actionText:{fontFamily:F.semibold,fontSize:14},
});
