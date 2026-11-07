import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Enter, Txt } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { F } from '../design/tokens';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { fmt } from '../domain/format';
import { audioOf } from '../features/rehearsal/analysis';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import { useRunPresentationScores } from '../features/feedback/useRunPresentationScores';
import { scoreAudioEvidence } from '../features/feedback/presentationScoreDisplay';
import type { ScoreAdvice, ScoreEvidence } from '../features/feedback/presentationScore';
import type { Finding } from '../features/feedback/slideReview';
import { useBack, useShell } from './shared';

export function FeedbackScreen({active=true}:{active?:boolean}) {
  const {c}=useTheme(),{go,nav}=useShell();
  const model=useDeckModel(nav.deckId),feedback=useRunFeedbackStatus(model,active);
  const scores=useRunPresentationScores(model,active);
  const player=useSegmentPlayer();
  const points=useMemo<FeedbackPoint[]>(()=>[
    ...feedback.items.flatMap(item=>item.findings.map(finding=>({kind:'slide' as const,slide:item.slide,finding})).filter(x=>x.finding.suggestion.trim())),
    ...(scores.overall.result?.feedback.improvements??[]).map(advice=>({kind:'score' as const,advice})),
  ],[feedback.items,scores.overall.result]);
  const [index,setIndex]=useState(0);
  const currentIndex=Math.min(index,Math.max(0,points.length-1));
  const point=points[currentIndex];
  const back=()=>{player.stop();go('full',{deckId:nav.deckId,sel:nav.sel});};
  useBack(active,()=>{back();return true;});
  const next=()=>{player.stop();setIndex(i=>(i+1)%Math.max(1,points.length));};
  const previous=()=>{player.stop();setIndex(i=>(i-1+Math.max(1,points.length))%Math.max(1,points.length));};
  const playEvidence=(refs:readonly ScoreEvidence[])=>{
    const key=`feedback-score:${currentIndex}`;
    if(player.playingKey===key){player.setPaused(!player.paused);return;}
    const segments=scoreAudioEvidence(refs).flatMap(ref=>{
      const uri=audioOf(ref.attempt_id);
      return uri?[{uri,startMs:ref.start_ms,endMs:ref.end_ms}]:[];
    });
    if(segments.length)void player.playSegments(key,segments);
  };
  const play=(finding:Finding,slide:number)=>{
    const part=model?.state.run?.parts[slide],uri=part&&audioOf(part.attemptId);
    if(!part||!uri||finding.end_ms<=finding.start_ms)return;
    const key=`feedback:${part.attemptId}:${finding.start_ms}`;
    if(player.playingKey===key){player.setPaused(!player.paused);return;}
    void player.playSegments(key,[{uri,startMs:finding.start_ms,endMs:finding.end_ms}]);
  };
  if(!model?.state.run)return null;
  return <Enter kind={nav.nav}><PanView style={StyleSheet.absoluteFill}
    onMoveShould={(_e,g)=>(Math.abs(g.dx)>18&&Math.abs(g.dx)>Math.abs(g.dy))||(g.dy>12&&g.dy>Math.abs(g.dx))}
    onRelease={(_e,g)=>{if(g.dx < -60)next();else if(g.dx > 60)previous();else if(g.dy>90)back();}}>
    <View style={StyleSheet.absoluteFill}>
    <PageSurface hue={model.deck.hue}/>
    <View style={styles.header}><Txt style={[styles.title,{color:c.text}]}>Feedback</Txt><Txt style={[styles.count,{color:c.secondary}]}>{points.length?`${currentIndex+1} of ${points.length}`:'No reviewed points'}</Txt></View>
    {point?<>
      <View style={[styles.slidePill,{backgroundColor:c.surface08}]}><UIIcon name="i-slides" size={16}/><Txt style={[styles.pillText,{color:c.secondary}]}>{point.kind==='slide'?`Slide ${point.slide+1} · ${model.deck.slides[point.slide]?.title??`Slide ${point.slide+1}`}`:'Whole presentation · Overall score'}</Txt></View>
      <Txt style={[styles.headline,{color:c.text}]}>{point.kind==='slide'?headline(point.finding):'Make this improvement to your talk'}</Txt>
      {point.kind==='slide'&&!!point.finding.speech_quote&&<View style={[styles.quoteCard,{backgroundColor:c.surface06,borderColor:c.hair}]}>
        <Txt style={[styles.kicker,{color:c.tertiary}]}>YOU SAID</Txt>
        <Txt numberOfLines={4} style={[styles.quote,{color:c.body}]}>{`“${point.finding.speech_quote}”`}</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={`Play the cited audio at ${fmt(point.finding.start_ms/1000)}`} onPress={()=>play(point.finding,point.slide)} style={styles.play}><Glyph name={player.playingKey?.startsWith('feedback:')&&!player.paused?'p-pause':'p-play'} size={14} color={c.text}/><Txt style={[styles.playText,{color:c.secondary}]}>{fmt(point.finding.start_ms/1000)}</Txt></Pressable>
      </View>}
      {point.kind==='score'&&scoreQuote(point.advice)&&<View style={[styles.quoteCard,{backgroundColor:c.surface06,borderColor:c.hair}]}>
        <Txt style={[styles.kicker,{color:c.tertiary}]}>YOU SAID</Txt>
        <Txt numberOfLines={4} style={[styles.quote,{color:c.body}]}>{`“${scoreQuote(point.advice)!.quote}”`}</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="Play the cited recording evidence" onPress={()=>playEvidence(point.advice.evidence)} style={styles.play}><Glyph name={player.playingKey===`feedback-score:${currentIndex}`&&!player.paused?'p-pause':'p-play'} size={14} color={c.text}/><Txt style={[styles.playText,{color:c.secondary}]}>{fmt(scoreQuote(point.advice)!.start_ms/1000)}</Txt></Pressable>
      </View>}
      {(point.kind==='slide'?!!point.finding.speech_quote:!!scoreQuote(point.advice))&&<View style={styles.arrow}><Txt style={[styles.arrowText,{color:c.secondary}]}>↓</Txt></View>}
      <View style={[styles.quoteCard,styles.tryCard,{backgroundColor:c.surface06,borderColor:c.hair}]}>
        <Txt style={[styles.kicker,{color:c.accent}]}>{point.kind==='slide'?'DO THIS':'TRY'}</Txt>
        <Txt numberOfLines={4} style={[styles.quote,{color:c.text}]}>{point.kind==='slide'?point.finding.suggestion:point.advice.text}</Txt>
      </View>
    </>:<View style={[styles.empty,{backgroundColor:c.surface06,borderColor:c.hair}]}><Txt style={[styles.quote,{color:c.secondary}]}>Verified feedback points will appear here when a slide review is available.</Txt></View>}
    <View style={styles.dots}>{points.map((_,i)=><View key={i} style={[styles.dot,i===currentIndex?styles.activeDot:{backgroundColor:c.dotOff},i===currentIndex&&{backgroundColor:c.text}]}/>)}</View>
    <HintRow hints={[{icon:'h-spin',text:'Next point'},{icon:'h-dn',text:'Back to review',nudge:'down'}]}/>
    </View>
  </PanView></Enter>;
}

type FeedbackPoint = {kind:'slide';slide:number;finding:Finding}|{kind:'score';advice:ScoreAdvice};
function scoreQuote(advice:ScoreAdvice){
  const speech=scoreAudioEvidence(advice.evidence).find(ref=>ref.kind==='speech');
  return speech?{quote:speech.quote,start_ms:speech.start_ms}:null;
}

function headline(f:Finding){
  if(f.category==='timing')return 'Bring this slide closer to its time';
  if(f.category==='fillers')return 'Reduce repeated filler words';
  if(f.category==='audience')return 'Make this clearer for your audience';
  if(f.category==='graph')return 'Explain what the visual shows';
  if(f.category==='delivery')return 'Strengthen this delivery moment';
  if(f.category==='repetition')return 'Avoid repeating the same point';
  return 'Add the missing point';
}
const styles=StyleSheet.create({
  header:{position:'absolute',top:46,left:40,right:40,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},count:{fontFamily:F.medium,fontSize:14,lineHeight:18},
  slidePill:{position:'absolute',top:112,left:24,right:24,minHeight:34,borderRadius:17,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},pillText:{fontFamily:F.semibold,fontSize:13.5},headline:{position:'absolute',left:24,right:24,top:162,fontFamily:F.display,fontSize:26,lineHeight:32,letterSpacing:-.4},
  quoteCard:{position:'absolute',top:220,left:24,right:24,minHeight:150,padding:18,borderRadius:20,borderWidth:1,gap:10},kicker:{fontFamily:F.bold,fontSize:13.5,letterSpacing:1.1},quote:{fontFamily:F.medium,fontSize:18,lineHeight:26},play:{alignSelf:'flex-start',minHeight:36,flexDirection:'row',alignItems:'center',gap:8},playText:{fontFamily:F.semibold,fontSize:13.5,fontVariant:['tabular-nums']},arrow:{position:'absolute',left:0,right:0,top:386,alignItems:'center'},arrowText:{fontSize:22},tryCard:{top:414,minHeight:144},empty:{position:'absolute',left:24,right:24,top:220,minHeight:140,borderRadius:20,borderWidth:1,padding:20,justifyContent:'center'},
  dots:{position:'absolute',left:0,right:0,bottom:86,flexDirection:'row',justifyContent:'center',gap:6},dot:{width:6,height:6,borderRadius:3},activeDot:{width:18,height:6,borderRadius:3}
});
