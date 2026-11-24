import { useUiText } from '../design/language';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt } from '../design/frame';
import { UIIcon } from '../design/icons';
import { EASE_SCREEN, F } from '../design/tokens';
import { BACK_FADE_Y } from '../domain/gestures';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { fmt, relativeDay } from '../domain/format';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
// Claude Code, prompted by Seoyeon (2026-11-15): feedback v3 in Full Review; see docs/ai-feedback-reimplementation.md.
import { useRunScores } from '../features/feedback/useRunFeedbackV3';
import { scoreLevelColor, scoreLevelLabel } from '../features/feedback/presentationScoreDisplay';
import { runLabel } from '../domain/run';
import { useBack, useNow, useShell } from './shared';
import { PanView } from '../design/PanView';
import { STORE_MODE } from '../services/apiConfig';

export function OverviewScreen({active=true}:{active?:boolean}) {
  const ui = useUiText();
  const {c}=useTheme(),{go,nav}=useShell(),model=useDeckModel(nav.deckId),now=useNow();
  // OpenAI Codex, 2026-11-19: fade Full Review over the page that opened it.
  const fadeY=useSharedValue(0);
  const swipeFade=useAnimatedStyle(()=>({opacity:Math.max(0,1-Math.max(0,fadeY.value)/BACK_FADE_Y)}));
  useEffect(()=>{if(!active)fadeY.set(0);},[active,fadeY]);
  const runScores=useRunScores(model,active),v3=runScores.v3,scores=runScores.scores;
  const feedback=useRunFeedbackStatus(model,active&&!v3);
  const run=model?.state.run;
  const toBack=()=>nav.from==='rehearse'
    ? go('rehearse',{deckId:nav.deckId,slide:nav.sel,sel:nav.sel})
    : go('home');
  useBack(active,()=>{toBack();return true;});
  if(!model||!run)return null;
  const total=model.total,target=model.targetSum;
  const score=scores.overall;
  const wpm=model.stats?.wpm;
  const stale=!!score.state?.stale||/outdated|updating/i.test(score.status);
  const composed=score.status==='Combined recordings';
  // Long statuses ("Record the whole presentation…") go on the line below, not in the 58 px number slot.
  const status=score.score===null?(stale?'Updating…':composed||score.status.length>14?'—':score.status):`${score.score}%`;
  const critical=scores.items.filter(item=>item.level==='beginning'||item.level==='emerging').length;
  const hasSlideScores=scores.items.some(item=>item.score!==null);
  const tiles=Array.from({length:model.n},(_,i)=>scores.items[i]);
  const openFeedback=()=>go('feedback',{deckId:model.deck.id,sel:nav.sel,from:'full'});
  // OpenAI Codex, 2026-11-19: Listen Back returns to this screen, regardless of how Full Review was opened.
  const openListen=()=>go('listen',{deckId:model.deck.id,sel:nav.sel,from:'full'});
  const openQA=()=>go('qa',{deckId:model.deck.id,sel:nav.sel,from:'full'});
  return <><Enter kind={active?nav.nav:null}><PanView style={[StyleSheet.absoluteFill,swipeFade]}
    onMoveShould={(_e,g)=>Math.abs(g.dy)>12&&Math.abs(g.dy)>Math.abs(g.dx)}
    onMove={(_e,g)=>fadeY.set(Math.max(-BACK_FADE_Y,Math.min(BACK_FADE_Y,g.dy)))}
    onRelease={(_e,g)=>{if(g.dy < -60){fadeY.set(0);openQA();}else if(g.dy>60)fadeY.set(withTiming(BACK_FADE_Y,{duration:460,easing:EASE_SCREEN},done=>{if(done)runOnJS(toBack)();}));else fadeY.set(withTiming(0,{duration:360,easing:EASE_SCREEN}));}}
    onTerminate={()=>fadeY.set(withTiming(0,{duration:360,easing:EASE_SCREEN}))}>
    <PageSurface hue={model.deck.hue}/>
    <View style={styles.header}><Txt verbatim numberOfLines={1} style={[styles.title,{color:c.text}]}>{model.deck.title}</Txt><Txt style={[styles.sub,{color:c.secondary}]}>{`Overall feedback · ${runLabel(run,now,relativeDay)}`}</Txt></View>
    <View style={styles.big}><Txt numberOfLines={1} adjustsFontSizeToFit style={[styles.bigNumber,{color:score.score===null?c.secondary:scoreLevelColor(score.level,c)}]}>{status}</Txt>
      {v3?.failures?<Pressable accessibilityRole="button" accessibilityLabel={ui("Retry failed AI feedback")} disabled={v3.busy} onPress={()=>void v3.retry()} style={styles.retry}>
        <Txt style={[styles.grade,{color:c.accent}]}>{v3.busy?'Retrying…':'Some feedback failed · Tap to retry'}</Txt></Pressable>
      :v3&&(v3.outdated||v3.missing)?<Pressable accessibilityRole="button" accessibilityLabel={ui(v3.outdated?'Update AI feedback for the latest changes':'Get AI feedback for this recording')} disabled={v3.busy||v3.blocked} onPress={()=>void v3.update()} style={styles.retry}>
        <Txt numberOfLines={1} style={[styles.grade,{color:c.accent}]}>{v3.busy?'Requesting…':v3.outdated?'From before your latest changes · Tap to update':'No AI feedback yet · Tap to request'}</Txt></Pressable>
      :<Txt numberOfLines={2} style={[styles.grade,styles.gradeCenter,{color:c.secondary}]}>{composed?'Record a full run for an overall score':stale?'Updating saved score…':score.score===null?score.status:scoreLevelLabel(score.level)}</Txt>}</View>
    <View style={styles.stats}>
      <Stat value={hasSlideScores?String(critical):'—'} label="critical" />
      <Stat value={`${fmt(total)} / ${fmt(target)}`} label="recorded / planned" />
      <Stat value={wpm==null?'—':String(wpm)} label="words per minute" />
    </View>
    <View style={styles.slideHeader}><Txt style={[styles.section,{color:c.text}]}>Slides</Txt><Txt style={[styles.help,{color:c.secondary}]}>Tap one to review</Txt></View>
      <ScrollView style={styles.tiles} contentContainerStyle={styles.tileContent} scrollEnabled={tiles.length>28}
        showsVerticalScrollIndicator={false} bounces={false} nestedScrollEnabled>
      {/* OpenAI Codex, 2026-11-21: keep slide number above its score and fit seven tiles per row. */}
      {Array.from({length:Math.ceil(tiles.length/7)},(_,row)=><View key={row} style={styles.tileRow}>{tiles.slice(row*7,row*7+7).map((_,i)=>{
        const slideIndex=row*7+i;
        const score=scores.items[slideIndex],isRecorded=(model.times[slideIndex]??0)>0;
        const color=isRecorded&&score?.score!=null?scoreLevelColor(score.level,c):isRecorded?c.surface:c.track;
        return <Pressable key={slideIndex} accessibilityRole="button" accessibilityLabel={ui(`Slide ${slideIndex+1}, ${score?.score==null?'not graded':`${score.score} percent`}`)} onPress={()=>go('review',{deckId:model.deck.id,sel:slideIndex,from:'full'})} style={[styles.tile,{backgroundColor:color,borderColor:isRecorded&&score?.score==null?c.hair:'transparent',borderWidth:isRecorded&&score?.score==null?1:0}]}>
          <Txt style={[styles.tileNumber,{color:score?.score!=null?c.gradeOnFill:c.secondary}]}>{slideIndex+1}</Txt>
          {score?.score!=null&&<Txt style={[styles.tileScore,{color:c.gradeOnFill}]}>{score.score}</Txt>}
          {score?.level==='beginning'&&<Txt style={[styles.tileWarning,{color:c.gradeOnFill}]}>!</Txt>}
        </Pressable>;
      })}</View>)}
    </ScrollView>
    <Pressable accessibilityRole="button" onPress={openFeedback} style={[styles.door,{borderColor:c.hair,backgroundColor:c.surface06}]}>
      <View style={styles.doorText}><Txt style={[styles.doorTitle,{color:c.text}]}>Feedback</Txt><Txt style={[styles.doorSub,{color:c.secondary}]}>{v3?`${v3.aggregate.improvements} way${v3.aggregate.improvements===1?'':'s'} to raise your score`:`${feedback.aggregate.findings} verified point${feedback.aggregate.findings===1?'':'s'}`}</Txt></View><UIIcon name="i-arrow" size={17} color={c.secondary}/>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={openListen} style={[styles.door2,{borderColor:c.hair,backgroundColor:c.surface06}]}>
      <View style={styles.doorText}><Txt style={[styles.doorTitle,{color:c.text}]}>Listen back</Txt><Txt style={[styles.doorSub,{color:c.secondary}]}>{!STORE_MODE || model.lines.length ? `${fmt(total)} with transcript` : fmt(total)}</Txt></View><UIIcon name="i-arrow" size={17} color={c.secondary}/>
    </Pressable>
  </PanView></Enter>
  {/* OpenAI Codex, 2026-11-20: review content fades without moving its gesture cues. */}
  {active&&<HintRow hints={[{icon:'h-up',text:'Audience Q&A',nudge:'up'},{icon:'h-dn',text:nav.from==='rehearse'?'Slide preview':'Home',nudge:'down'}]}/>}
  </>;
}
function Stat({value,label}:{value:string;label:string}){const{c}=useTheme();return <View style={styles.stat}><Txt numberOfLines={1} style={[styles.statValue,{color:c.text}]}>{value}</Txt><Txt numberOfLines={1} style={[styles.statLabel,{color:c.secondary}]}>{label}</Txt></View>;}
const styles=StyleSheet.create({
  header:{position:'absolute',top:46,left:40,right:40,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},sub:{fontFamily:F.medium,fontSize:14,lineHeight:18},
  big:{position:'absolute',top:108,left:24,right:24,alignItems:'center'},retry:{minHeight:44,justifyContent:'center'},gradeCenter:{textAlign:'center'},bigNumber:{fontFamily:F.display,fontSize:58,lineHeight:66,letterSpacing:-2,fontVariant:['tabular-nums']},grade:{fontFamily:F.semibold,fontSize:14},
  stats:{position:'absolute',top:206,left:24,right:24,flexDirection:'row',justifyContent:'space-between',gap:8},stat:{flex:1,alignItems:'center',gap:5},statValue:{fontFamily:F.display,fontSize:24,lineHeight:29,fontVariant:['tabular-nums']},statLabel:{fontFamily:F.medium,fontSize:13.5},
  slideHeader:{position:'absolute',top:300,left:24,right:24,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},section:{fontFamily:F.bold,fontSize:15},help:{fontFamily:F.medium,fontSize:13.5},tiles:{position:'absolute',top:330,left:24,right:24,height:208},tileContent:{gap:8},tileRow:{height:46,flexDirection:'row',gap:6},tile:{position:'relative',width:43,height:46,borderRadius:13,alignItems:'center',justifyContent:'center'},tileNumber:{fontFamily:F.bold,fontSize:14,lineHeight:17},tileScore:{fontFamily:F.semibold,fontSize:11.5,lineHeight:14},tileWarning:{position:'absolute',top:2,right:3,fontFamily:F.bold,fontSize:12},
  door:{position:'absolute',left:24,right:24,top:548,height:62,borderWidth:1,borderRadius:18,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},door2:{position:'absolute',left:24,right:24,top:620,height:62,borderWidth:1,borderRadius:18,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},doorText:{gap:4},doorTitle:{fontFamily:F.semibold,fontSize:15},doorSub:{fontFamily:F.medium,fontSize:13.5}
});
