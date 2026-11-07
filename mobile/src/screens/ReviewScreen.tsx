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
import { EASE_SCREEN, F } from '../design/tokens';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { MiniSlide } from '../design/SlideCard';
import { fmt, relativeDay } from '../domain/format';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { runLabel } from '../domain/run';
import { compactFeedbackRows } from '../features/feedback/compactFeedbackRows';
import { slideText } from '../domain/lines';
import { covers, fillerTotal } from '../domain/words';
import { slideTimingLabel } from '../domain/slides';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { audioOf } from '../features/rehearsal/analysis';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import type { ScoreDisplay } from '../features/feedback/PresentationScorePanel';
import { useRunPresentationScores } from '../features/feedback/useRunPresentationScores';
import { scoreLevelColor } from '../features/feedback/presentationScoreDisplay';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import { SlideReviewDetails } from '../features/feedback/SlideReviewDetails';
import type { Finding } from '../features/feedback/slideReview';
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
 const feedback=useRunFeedbackStatus(model,active),item=feedback.items[s];
 const duration=model?.times[s]??0,allocation=model?.deck.targets[s]??0;
 const spokenText=slideText(model?.lines??[],s);
 const selectedAttempt=model?.state.run?.parts[s]?.attemptId;
 const hasTranscript=!!selectedAttempt&&model?.stages.get(selectedAttempt)==='done'&&!!model.transcripts.get(selectedAttempt)?.words.length;
 const fillerCount=duration>0&&hasTranscript&&spokenText.trim()?fillerTotal(spokenText):null;
 const slideReviewRows=compactFeedbackRows(s,item,{durationSeconds:duration,allocationSeconds:allocation,fillerCount});
 const [feedbackOpen,setFeedbackOpen]=useState(false);
 const [issueIndex,setIssueIndex]=useState(0);
 const findingRows=slideReviewRows.flatMap(row=>row.findings);
 const recorded=!!model?.state.run?.parts[s]?.segments.some(segment=>segment.endMs>segment.startMs);
 const detailsOpen=active&&feedbackOpen&&recorded;
 if(feedbackOpen&&!detailsOpen)setFeedbackOpen(false);
 const scores=useRunPresentationScores(model,active,s),scoreItem=scores.items[s]??EMPTY_SCORE;
 const player=useSegmentPlayer(),stopPlayback=player.stop;
 const dy=useSharedValue(0),backExiting=useRef(false);
 const now=useNow();
 useEffect(()=>{if(!active){backExiting.current=false;dy.set(0);stopPlayback();}},[active,dy,stopPlayback]);
 useEffect(()=>()=>stopPlayback(),[stopPlayback]);
 const toBack=useCallback(()=>{stopPlayback();go('full',{deckId:nav.deckId,sel:s});},[go,nav.deckId,s,stopPlayback]);
 const toQA=useCallback(()=>{stopPlayback();go('qa',{nav:'fade',deckId:nav.deckId,sel:s,from:'review'});},[go,nav.deckId,s,stopPlayback]);
 const toFull=useCallback(()=>{stopPlayback();go('full',nav.from==='full'?{deckId:nav.deckId,sel:s}:{nav:'fade',deckId:nav.deckId,sel:s,from:'review'});},[go,nav.deckId,nav.from,s,stopPlayback]);
 useBack(active,()=>{if(detailsOpen)setFeedbackOpen(false);else toBack();return true;});
 const pan={
  onMoveShould:(e:GestureResponderEvent,g:PanResponderGestureState)=>{
   const y=(e.nativeEvent.pageY-frame.top)/frame.s;
   return !detailsOpen&&!backExiting.current&&Math.abs(g.dy)>8&&Math.abs(g.dy)>Math.abs(g.dx)&&
    !(y>264&&y<360&&Math.abs(g.dx)>4) || !detailsOpen&&!backExiting.current&&Math.abs(g.dx)>16&&Math.abs(g.dx)>Math.abs(g.dy);
  },
  onMove:(_e:GestureResponderEvent,g:PanResponderGestureState)=>dy.set(Math.max(-BACK_FADE_Y,Math.min(BACK_FADE_Y,g.dy/frame.s))),
  onRelease:(_e:GestureResponderEvent,g:PanResponderGestureState)=>{
   if(Math.abs(g.dx/frame.s)>48&&Math.abs(g.dx)>Math.abs(g.dy)){
    const direction=g.dx<0?1:-1;dy.set(0);
    if(direction>0&&issueIndex<issueItems.length-1)setIssueIndex(issueIndex+1);
    else if(direction<0&&issueIndex>0)setIssueIndex(issueIndex-1);
    else {const next=s+direction;if(next>=0&&next<n){stopPlayback();go('review',{deckId:nav.deckId,sel:next});}else if(next>=n)toFull();}
    return;
   }
   if(dy.get()>BACK_T){backExiting.current=true;dy.set(withTiming(BACK_FADE_Y,{duration:220,easing:EASE_SCREEN},done=>{if(done)runOnJS(toBack)();}));}
   else if(dy.get() < -BACK_T){backExiting.current=true;dy.set(withTiming(-BACK_FADE_Y,{duration:220,easing:EASE_SCREEN},done=>{if(done)runOnJS(toQA)();}));}
   else if(Math.abs(dy.get())<8)dy.set(withTiming(0,{duration:160,easing:EASE_SCREEN}));
   else dy.set(withTiming(0,{duration:220,easing:EASE_SCREEN}));
  },
  onTerminate:()=>{if(!backExiting.current)dy.set(withTiming(0,{duration:220,easing:EASE_SCREEN}));},
 };
 const screen=useAnimatedStyle(()=>({opacity:Math.max(0,1-Math.abs(dy.value)/BACK_FADE_Y)}));
 if(!model||!model.state.run)return null;
 const {deck,times,state}=model,run=state.run!;
 const t=times[s]??0,target=deck.targets[s]??0,timingLabel=slideTimingLabel(t,target);
 const insufficient=recorded&&(!hasTranscript||item?.status==='insufficient'||item?.status==='not_analyzed');
 const scoreStrength=scoreItem.result&&'slide_index' in scoreItem.result?scoreItem.result.feedback.strengths[0]?.text:null;
 const pointList=deck.slides[s]?.points??[];
 const pointsSaid=spokenText.trim()?pointList.filter(point=>covers(spokenText,point)).length:null;
 const issueItems=[
  ...(timingLabel==='Over time'?[{category:'timing',observation:`This slide ran ${fmt(t-target)} over its ${fmt(target)} allocation.`,suggestion:'Trim or simplify this slide to stay within its planned time.',icon:'i-clock' as const}]:[]),
  ...findingRows.filter(f=>f.category!=='timing').slice().sort((a,b)=>a.priority-b.priority).map(f=>({category:f.category,observation:f.observation,suggestion:f.suggestion,icon:'i-flag' as const,finding:f})),
 ];
 const issue=issueItems[Math.min(issueIndex,Math.max(0,issueItems.length-1))];
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
 const playFindingEvidence=(finding:Finding)=>{
  if(!part||!slideAudioUri||finding.end_ms<=finding.start_ms)return;
  const key=`evidence:${part.attemptId}:${finding.start_ms}:${finding.end_ms}`;
  if(player.playingKey===key){player.setPaused(!player.paused);return;}
  void player.playSegments(key,[{uri:slideAudioUri,startMs:finding.start_ms,endMs:finding.end_ms}]);
 };

 return <Enter kind={nav.nav}><PanView style={StyleSheet.absoluteFill} {...pan}>
  <PageSurface hue={deck.hue}/>
  <Animated.View pointerEvents={detailsOpen?'none':'auto'} accessibilityElementsHidden={detailsOpen}
   importantForAccessibility={detailsOpen?'no-hide-descendants':'auto'} style={[StyleSheet.absoluteFill,screen]}>
   <View style={styles.header}>
    <Txt numberOfLines={1} style={[styles.title,{color:c.text}]}>{`Slide ${s+1} of ${n}`}</Txt><Txt numberOfLines={1} style={[styles.label,{color:c.secondary}]}>{deck.slides[s]?.title??runLabel(run,now,relativeDay)}</Txt>
   </View>
   <View style={styles.slideHero}>
    <MiniSlide hue={deck.hue} page={deck.pages[s]} title={deck.slides[s]?.title??''} width={342} height={160} radius={18}/>
    <View style={styles.heroScrim}><Txt style={styles.heroLabel}>{`SLIDE ${s+1} OF ${n}`}</Txt><Txt numberOfLines={2} style={styles.heroTitle}>{deck.slides[s]?.title??`Slide ${s+1}`}</Txt></View>
    <View style={[styles.scoreBadge,{backgroundColor:scoreItem.score===null?c.surface:scoreLevelColor(scoreItem.level,c)}]}><Txt style={[styles.scoreBadgeText,{color:scoreItem.score===null?c.secondary:c.onAccent}]}>{scoreItem.score===null?'—':scoreItem.score}</Txt></View>
    <Pressable accessibilityRole="button" accessibilityLabel={slidePlaying?'Pause slide audio':`Play slide ${s+1} audio`} disabled={!slideAudioUri||!part} onPress={playSlide} style={[styles.heroPlay,{backgroundColor:c.surface}]}><Glyph name={slidePlaying?'p-pause':'p-play'} size={19} color={c.text}/></Pressable>
   </View>
   <View style={[styles.issueCard,{backgroundColor:c.surface06,borderColor:c.hair}]}>
    <View style={styles.issueTop}><Txt style={[styles.issueMeta,{color:c.secondary}]}>{issue?`${issue.category.toUpperCase()} · ${issueIndex+1} OF ${issueItems.length}`:'SLIDE STATUS'}</Txt><Txt style={[styles.issueMeta,{color:timingLabel==='Over time'?c.warn:c.secondary}]}>{t>0?`${fmt(t)} / ${fmt(target)} planned`:item?.label??'Not recorded'}</Txt></View>
    <Txt style={[styles.issueTitle,{color:c.text}]}>{issue?issue.observation:insufficient?'Too little speech to review':'Nothing to fix on this slide'}</Txt>
    <Txt style={[styles.issueBody,{color:c.secondary}]}>{issue?issue.suggestion:insufficient?`Record slide ${s+1} again to get feedback based on your delivery.`:scoreStrength??'Keep the strongest part of this slide.'}</Txt>
    {issue&&'finding' in issue&&issue.finding.speech_quote&&<View style={[styles.evidence,{borderColor:c.hair}]}>
     <View style={styles.evidenceHead}><Txt style={[styles.evidenceLabel,{color:c.tertiary}]}>YOU SAID</Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={`Hear cited evidence at ${fmt(issue.finding.start_ms/1000)}`}
       disabled={!slideAudioUri||issue.finding.end_ms<=issue.finding.start_ms}
       onPress={()=>playFindingEvidence(issue.finding)} style={[styles.evidenceListen,{backgroundColor:c.surface08,opacity:!slideAudioUri||issue.finding.end_ms<=issue.finding.start_ms?0.45:1}]}>
       <Glyph name={player.playingKey===`evidence:${part?.attemptId}:${issue.finding.start_ms}:${issue.finding.end_ms}`&&!player.paused?'p-pause':'p-play'} size={14} color={c.text}/>
       <Txt style={[styles.evidenceListenText,{color:c.text}]}>{`Hear it · ${fmt(issue.finding.start_ms/1000)}`}</Txt>
      </Pressable>
     </View>
     <Txt numberOfLines={3} style={[styles.evidenceQuote,{color:c.body}]}>{`“${issue.finding.speech_quote}”`}</Txt>
    </View>}
    {recorded&&!insufficient?<Pressable accessibilityRole="button" onPress={()=>setFeedbackOpen(true)} style={styles.detailsLink}><Txt style={[styles.detailsLinkText,{color:c.accent}]}>Full feedback and recovery options</Txt></Pressable>
      :<Pressable accessibilityRole="button" onPress={()=>go('rehearse',{deckId:nav.deckId,slide:s,nav:'fade'})} style={styles.detailsLink}><Txt style={[styles.detailsLinkText,{color:c.accent}]}>Rehearse slide {s+1}</Txt></Pressable>}
   </View>
   <View style={styles.dots}>{issueItems.map((_,i)=><Pressable key={i} accessibilityRole="button" accessibilityLabel={`Show issue ${i+1}`} onPress={()=>setIssueIndex(i)} style={styles.dotHit}><View style={[styles.dot,{backgroundColor:i===issueIndex?c.strong:c.dotOff}]}/></Pressable>)}</View>
   <View style={styles.chips}>{slideReviewRows.map((row,i)=>{
    const category=['timing','fillers','content','delivery'][i];
    const targetIndex=issueItems.findIndex(value=>value.category===category||(category==='content'&&['graph','audience'].includes(value.category)));
    return <Pressable key={row.icon} accessibilityRole="button" onPress={()=>targetIndex>=0&&setIssueIndex(targetIndex)} style={[styles.chip,{backgroundColor:c.surface08,borderColor:row.status==='finding'?c.warn:c.hair}]}><Txt numberOfLines={1} style={[styles.chipText,{color:row.status==='finding'?c.text:c.secondary}]}>{category==='timing'?`Time ${timingLabel}`:category==='fillers'?`Fillers ${fillerValue}`:category==='content'?`Points ${pointsSaid===null?'—':`${pointsSaid} of ${pointList.length}`}`:'Delivery'}</Txt></Pressable>;
   })}</View>
   <HintRow hints={[{icon:'h-spin',text:'Next issue'},{icon:'h-up',text:'Q&A',nudge:'up'},{icon:'h-dn',text:'Back',nudge:'down'}]}/>
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
const styles=StyleSheet.create({
 header:{position:'absolute',left:30,right:30,top:46,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},label:{fontFamily:F.medium,fontSize:14,lineHeight:18},
 slideHero:{position:'absolute',left:24,right:24,top:100,height:160,borderRadius:18,overflow:'hidden'},heroScrim:{position:'absolute',left:0,right:0,top:0,bottom:0,justifyContent:'flex-end',padding:18,backgroundColor:'rgba(0,0,0,0.24)'},heroLabel:{fontFamily:F.bold,fontSize:13.5,letterSpacing:1.1,color:'#FFFFFF'},heroTitle:{maxWidth:245,fontFamily:F.display,fontSize:23,lineHeight:27,color:'#FFFFFF'},scoreBadge:{position:'absolute',top:12,right:12,minWidth:46,height:30,borderRadius:15,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},scoreBadgeText:{fontFamily:F.bold,fontSize:14},heroPlay:{position:'absolute',right:14,bottom:14,width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},
 issueCard:{position:'absolute',left:24,right:24,top:284,height:300,borderRadius:24,borderWidth:1,padding:20,gap:12},issueTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},issueMeta:{fontFamily:F.bold,fontSize:13.5,letterSpacing:.4},issueTitle:{fontFamily:F.display,fontSize:22,lineHeight:28},issueBody:{fontFamily:F.medium,fontSize:15,lineHeight:22},evidence:{marginTop:2,paddingTop:12,borderTopWidth:1,gap:4},evidenceHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},evidenceLabel:{fontFamily:F.bold,fontSize:13.5,letterSpacing:.5},evidenceListen:{minHeight:36,paddingHorizontal:10,borderRadius:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},evidenceListenText:{fontFamily:F.semibold,fontSize:13.5},evidenceQuote:{fontFamily:F.medium,fontSize:15,lineHeight:20},detailsLink:{marginTop:'auto',minHeight:44,justifyContent:'center'},detailsLinkText:{fontFamily:F.semibold,fontSize:14},
 dots:{position:'absolute',top:604,left:24,right:24,height:24,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5},dotHit:{width:22,height:24,alignItems:'center',justifyContent:'center'},dot:{width:6,height:6,borderRadius:3},chips:{position:'absolute',top:634,left:24,right:24,height:36,flexDirection:'row',alignItems:'center',gap:6},chip:{flex:1,minWidth:0,height:34,paddingHorizontal:6,borderRadius:17,borderWidth:1,alignItems:'center',justifyContent:'center'},chipText:{fontFamily:F.semibold,fontSize:13.5},
 content:{position:'absolute',left:16,right:16,top:140,gap:4},
 ringRow:{flexDirection:'row',alignItems:'center',gap:18,paddingHorizontal:8},ringRight:{flex:1,minWidth:0,gap:10},slideLabel:{fontFamily:F.semibold,fontSize:13.5},
 stat:{flexDirection:'row',alignItems:'center',gap:7},statValue:{fontFamily:F.display,fontSize:18,fontVariant:['tabular-nums']},statUnit:{flexShrink:1,fontFamily:F.medium,fontSize:13.5,lineHeight:18},
 timesBlock:{height:88},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'},section:{fontFamily:F.bold,fontSize:14},bars:{height:44,marginTop:4},barRow:{height:44,flexDirection:'row',alignItems:'flex-end',gap:1},barHit:{position:'relative',flex:1,minWidth:0,height:44,alignItems:'center',justifyContent:'flex-end'},
 slideCard:{marginTop:18,borderWidth:1,borderRadius:20,padding:14,gap:11},slidePreviewRow:{flexDirection:'row',alignItems:'center',gap:12},slideFacts:{flex:1,minWidth:0,gap:4},previewTitle:{fontFamily:F.display,fontSize:15,lineHeight:18},slideTime:{fontFamily:F.semibold,fontSize:13.5,lineHeight:18,fontVariant:['tabular-nums']},targetStatus:{fontFamily:F.semibold,fontSize:13.5,lineHeight:18},feedbackRows:{gap:8,minHeight:44},feedbackRow:{minHeight:22,flexDirection:'row',alignItems:'center',gap:8},feedbackText:{flex:1,minWidth:0,fontFamily:F.medium,fontSize:13.5,lineHeight:18},playbackStrip:{minHeight:36,flexDirection:'row',alignItems:'center',gap:8},playTrack:{height:5,flex:1,borderRadius:3,overflow:'hidden'},playProgress:{height:5},playTime:{fontFamily:F.medium,fontSize:13.5,fontVariant:['tabular-nums']},playError:{fontFamily:F.medium,fontSize:13.5,lineHeight:18},
 feedbackDetails:{position:'absolute',left:24,right:24,top:180,bottom:180,borderRadius:20,borderWidth:1,padding:16},detailsHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},detailsClose:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},detailsScroll:{flex:1},detailsBody:{paddingTop:12,paddingBottom:16,gap:20},detailsFinding:{gap:8},detailsText:{fontFamily:F.medium,fontSize:16,lineHeight:24},
 fullReview:{position:'absolute',left:16,right:16,bottom:68,height:58,borderWidth:1,borderRadius:18,overflow:'hidden',alignItems:'center',justifyContent:'center'},fullReviewTitle:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},actionText:{fontFamily:F.semibold,fontSize:14},
});
