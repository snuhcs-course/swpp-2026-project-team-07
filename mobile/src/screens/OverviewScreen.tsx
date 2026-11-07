import { Pressable, StyleSheet, View } from 'react-native';
import { Enter, Txt } from '../design/frame';
import { UIIcon } from '../design/icons';
import { F } from '../design/tokens';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { fmt, relativeDay } from '../domain/format';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import { useRunPresentationScores } from '../features/feedback/useRunPresentationScores';
import { scoreLevelColor, scoreLevelLabel } from '../features/feedback/presentationScoreDisplay';
import { runLabel } from '../domain/run';
import { useBack, useNow, useShell } from './shared';
import { PanView } from '../design/PanView';

export function OverviewScreen({active=true}:{active?:boolean}) {
  const {c}=useTheme(),{go,nav}=useShell(),model=useDeckModel(nav.deckId),now=useNow();
  const feedback=useRunFeedbackStatus(model,active),scores=useRunPresentationScores(model,active);
  const run=model?.state.run;
  const toBack=()=>go('home');
  useBack(active,()=>{toBack();return true;});
  if(!model||!run)return null;
  const total=model.total,target=model.targetSum;
  const score=scores.overall;
  const wpm=model.stats?.wpm;
  const stale=!!score.state?.stale||/outdated|updating/i.test(score.status);
  const composed=score.status==='Combined recordings';
  const status=score.score===null?(stale?'Updating…':composed?'—':score.status):`${score.score}%`;
  const critical=scores.items.filter(item=>item.level==='beginning'||item.level==='emerging').length;
  const hasSlideScores=scores.items.some(item=>item.score!==null);
  const tiles=Array.from({length:model.n},(_,i)=>scores.items[i]);
  const openFeedback=()=>go('feedback',{deckId:model.deck.id,sel:nav.sel,from:'full'});
  const openListen=()=>go('listen',{deckId:model.deck.id,sel:nav.sel,from:nav.from??'full'});
  const openQA=()=>go('qa',{deckId:model.deck.id,sel:nav.sel,from:'full'});
  return <Enter kind={nav.nav}><PanView style={StyleSheet.absoluteFill}
    onMoveShould={(_e,g)=>Math.abs(g.dy)>12&&Math.abs(g.dy)>Math.abs(g.dx)}
    onRelease={(_e,g)=>{if(g.dy < -60)openQA();else if(g.dy>60)toBack();}}>
    <PageSurface hue={model.deck.hue}/>
    <View style={styles.header}><Txt numberOfLines={1} style={[styles.title,{color:c.text}]}>{model.deck.title}</Txt><Txt style={[styles.sub,{color:c.secondary}]}>{`Review · ${runLabel(run,now,relativeDay)}`}</Txt></View>
    <View style={styles.big}><Txt style={[styles.bigNumber,{color:score.score===null?c.secondary:scoreLevelColor(score.level,c)}]}>{status}</Txt><Txt style={[styles.grade,{color:c.secondary}]}>{composed?'Record a full run for an overall score':stale?'Updating saved score…':score.score===null?score.status:scoreLevelLabel(score.level)}</Txt></View>
    <View style={styles.stats}>
      <Stat value={hasSlideScores?String(critical):'—'} label="critical" />
      <Stat value={`${fmt(total)} / ${fmt(target)}`} label="recorded / planned" />
      <Stat value={wpm==null?'—':String(wpm)} label="words per minute" />
    </View>
    <View style={styles.slideHeader}><Txt style={[styles.section,{color:c.text}]}>Slides</Txt><Txt style={[styles.help,{color:c.secondary}]}>Tap one to review</Txt></View>
      <View style={styles.tiles}>
      {Array.from({length:Math.ceil(tiles.length/6)},(_,row)=><View key={row} style={styles.tileRow}>{tiles.slice(row*6,row*6+6).map((_,i)=>{
        const slideIndex=row*6+i;
        const score=scores.items[slideIndex],isRecorded=(model.times[slideIndex]??0)>0;
        const color=isRecorded&&score?.score!=null?scoreLevelColor(score.level,c):isRecorded?c.surface:c.track;
        return <Pressable key={slideIndex} accessibilityRole="button" accessibilityLabel={`Slide ${slideIndex+1}, ${score?.score==null?'not graded':`${score.score} percent`}`} onPress={()=>isRecorded?go('review',{deckId:model.deck.id,sel:slideIndex,from:'full'}):go('rehearse',{deckId:model.deck.id,slide:slideIndex,nav:'fade'})} style={[styles.tile,{backgroundColor:color,borderColor:isRecorded&&score?.score==null?c.hair:'transparent',borderWidth:isRecorded&&score?.score==null?1:0}]}>
          <Txt style={[styles.tileNumber,{color:score?.score!=null?c.gradeOnFill:c.secondary}]}>{score?.score??slideIndex+1}</Txt>
          {score?.level==='beginning'&&<Txt style={[styles.tileWarning,{color:c.onAccent}]}>!</Txt>}
        </Pressable>;
      })}</View>)}
    </View>
    <Pressable accessibilityRole="button" onPress={openFeedback} style={[styles.door,{borderColor:c.hair,backgroundColor:c.surface06}]}>
      <View style={styles.doorText}><Txt style={[styles.doorTitle,{color:c.text}]}>Feedback</Txt><Txt style={[styles.doorSub,{color:c.secondary}]}>{`${feedback.aggregate.findings} verified point${feedback.aggregate.findings===1?'':'s'}`}</Txt></View><UIIcon name="i-arrow" size={17} color={c.secondary}/>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={openListen} style={[styles.door2,{borderColor:c.hair,backgroundColor:c.surface06}]}>
      <View style={styles.doorText}><Txt style={[styles.doorTitle,{color:c.text}]}>Listen back</Txt><Txt style={[styles.doorSub,{color:c.secondary}]}>{`${fmt(total)} with transcript`}</Txt></View><UIIcon name="i-arrow" size={17} color={c.secondary}/>
    </Pressable>
    <HintRow hints={[{icon:'h-up',text:'Audience Q&A',nudge:'up'},{icon:'h-dn',text:'Home',nudge:'down'}]}/>
  </PanView></Enter>;
}
function Stat({value,label}:{value:string;label:string}){const{c}=useTheme();return <View style={styles.stat}><Txt numberOfLines={1} style={[styles.statValue,{color:c.text}]}>{value}</Txt><Txt numberOfLines={1} style={[styles.statLabel,{color:c.secondary}]}>{label}</Txt></View>;}
const styles=StyleSheet.create({
  header:{position:'absolute',top:46,left:40,right:40,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},sub:{fontFamily:F.medium,fontSize:14,lineHeight:18},
  big:{position:'absolute',top:108,left:24,right:24,alignItems:'center'},bigNumber:{fontFamily:F.display,fontSize:58,lineHeight:66,letterSpacing:-2,fontVariant:['tabular-nums']},grade:{fontFamily:F.semibold,fontSize:14},
  stats:{position:'absolute',top:206,left:24,right:24,flexDirection:'row',justifyContent:'space-between',gap:8},stat:{flex:1,alignItems:'center',gap:5},statValue:{fontFamily:F.display,fontSize:24,lineHeight:29,fontVariant:['tabular-nums']},statLabel:{fontFamily:F.medium,fontSize:13.5},
  slideHeader:{position:'absolute',top:300,left:24,right:24,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},section:{fontFamily:F.bold,fontSize:15},help:{fontFamily:F.medium,fontSize:13.5},tiles:{position:'absolute',top:330,left:24,right:24,gap:8},tileRow:{height:50,flexDirection:'row',justifyContent:'space-between',gap:8},tile:{position:'relative',width:50,height:50,borderRadius:14,alignItems:'center',justifyContent:'center'},tileNumber:{fontFamily:F.bold,fontSize:14},tileWarning:{position:'absolute',top:3,right:5,fontFamily:F.bold,fontSize:13.5},
  door:{position:'absolute',left:24,right:24,top:548,height:62,borderWidth:1,borderRadius:18,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},door2:{position:'absolute',left:24,right:24,top:620,height:62,borderWidth:1,borderRadius:18,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},doorText:{gap:4},doorTitle:{fontFamily:F.semibold,fontSize:15},doorSub:{fontFamily:F.medium,fontSize:13.5}
});
