// AI-assisted Nakajima integration: verified selected-slide feedback in the normal Review page.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { UIIcon } from '../design/icons';
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
import { FeedbackStatusRing } from '../features/feedback/FeedbackStatusRing';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import type { Finding } from '../features/feedback/slideReview';
import { ReviewSlidePlayback, ReviewSlidePreview } from './ReviewSlidePlayback';
import { useBack, useNow, useShell } from './shared';

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
 const player=useSegmentPlayer(),stopPlayback=player.stop;
 const dy=useSharedValue(0),backExiting=useRef(false),scrollY=useRef(0),scroll=useRef<ScrollView>(null);
 const [evidence,setEvidence]=useState<{finding:Finding;request:number}|null>(null);
 const now=useNow();
 const showEvidence=useCallback((y:number)=>scroll.current?.scrollTo({y,animated:true}),[]);
 useEffect(()=>{if(!active){dy.set(0);stopPlayback();}},[active,dy,stopPlayback]);
 useEffect(()=>()=>stopPlayback(),[stopPlayback]);
 const toBack=useCallback(()=>{stopPlayback();if(nav.from==='full')go('full',{deckId:nav.deckId});else go('rehearse',{nav:null,deckId:nav.deckId,slide:s});},[go,nav.deckId,nav.from,s,stopPlayback]);
 const toQA=useCallback(()=>{stopPlayback();go('qa',{nav:'fade',deckId:nav.deckId,sel:s});},[go,nav.deckId,s,stopPlayback]);
 const toFull=useCallback(()=>{stopPlayback();go('full',{nav:nav.from==='full'?null:'fade',deckId:nav.deckId,from:nav.from==='full'?null:'review'});},[go,nav.deckId,nav.from,stopPlayback]);
 useBack(active,()=>{toBack();return true;});
 const pan={
  onMoveShould:(e:GestureResponderEvent,g:PanResponderGestureState)=>{
   const y=(e.nativeEvent.pageY-frame.top)/frame.s;
   return !backExiting.current&&Math.abs(g.dy)>8&&Math.abs(g.dy)>Math.abs(g.dx)&&
    (g.dy>0&&scrollY.current<=0 || g.dy<0&&(y<106||y>777));
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
 return <Enter kind={nav.nav}><PanView style={StyleSheet.absoluteFill} {...pan}>
  <Animated.View style={[StyleSheet.absoluteFill,screen]}><PageSurface hue={deck.hue}/>
   <View style={styles.header}><Txt numberOfLines={1} style={[styles.title,{color:c.text}]}>{deck.title}</Txt><Txt style={[styles.label,{color:c.secondary}]}>{runLabel(run,now,relativeDay)}</Txt></View>
   <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator
    onScroll={e=>{scrollY.current=e.nativeEvent.contentOffset.y;}} scrollEventThrottle={16}>
    <View style={styles.ringRow}>
     <FeedbackStatusRing id="gSlideStatus" item={item}/>
     <View style={styles.ringRight}><Txt style={[styles.slideLabel,{color:c.secondary}]}>{`Slide ${s+1} of ${n}`}</Txt>
      <Stat icon="i-clock" value={t>0?fmt(t):'—'} unit={`${fmt(target)} ${source} target`}/>
      <Stat icon="i-bubble" value={pending||t<=0?'—':String(fillerTotal(slideText(model.lines,s)))} unit="fillers"/>
      <Stat icon="i-flag" value={item?.findingCount?String(item.findingCount):item?.assessed?'0':'—'} unit="verified findings"/>
     </View>
    </View>
    <View><View style={styles.row}><Txt style={[styles.section,{color:c.text}]}>Times per slide</Txt><Txt style={[styles.label,{color:c.secondary}]}>Tap a bar</Txt></View>
     <View style={styles.bars}>{times.map((value,i)=><Pressable key={i} accessibilityRole="button" accessibilityState={{selected:i===s}}
      accessibilityLabel={`Slide ${i+1}, ${value>0?fmt(value):'not recorded'}`} onPress={()=>{stopPlayback();go('review',{sel:i});}}
      style={{flex:1,minWidth:0,height:value?Math.max(6,78*value/maxT):4,borderRadius:4,backgroundColor:i===s?c.strong:c.ink28}}/>)}</View>
     <View style={styles.nums}>{times.map((_,i)=><Txt key={i} style={[styles.number,{color:i===s?c.text:c.secondary}]}>{i+1}</Txt>)}</View>
    </View>
    {active&&partId&&<ReviewSlidePlayback model={model} id={partId} slide={s} player={player} evidence={evidence?.finding??null} evidenceRequest={evidence?.request??0} onCloseEvidence={()=>setEvidence(null)} onEvidenceShown={showEvidence}/>}
    {!partId&&<View style={{borderWidth:1,borderRadius:20,padding:14,gap:12,borderColor:c.hair,backgroundColor:c.surface06}}><ReviewSlidePreview model={model} slide={s}/><Txt style={[styles.note,{color:c.secondary}]}>No saved audio for this slide.</Txt></View>}
    {!!feedback.notice&&<Txt accessibilityLiveRegion="polite" style={[styles.note,{color:c.secondary}]}>{feedback.notice}</Txt>}
    {active&&partId&&part?<SlideReviewSummary key={`${partId}:${s}:${JSON.stringify(part.segments)}`} slide={s} part={part} localDeckId={deck.id}
      onEvidence={finding=>{stopPlayback();setEvidence(previous=>({finding,request:(previous?.request??0)+1}));}}/>:
     <Txt style={[styles.note,{color:c.secondary}]}>Record this slide to receive AI feedback.</Txt>}
    <Pressable accessibilityRole="button" accessibilityLabel="Full review" onPress={toFull} style={[styles.action,{borderColor:c.hair,borderWidth:1}]}><Txt style={[styles.actionText,{color:c.text}]}>Full review</Txt><Txt style={[styles.note,{color:c.secondary}]}>{`${a.assessed}/${a.recorded} recorded slides assessed · ${a.findings} verified findings`}</Txt></Pressable>
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
 action:{minHeight:48,borderRadius:18,padding:14,gap:4},actionText:{fontFamily:F.semibold,fontSize:14},note:{fontFamily:F.medium,fontSize:12,lineHeight:18},
});
