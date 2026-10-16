// AI-assisted integration: one validated feedback overview, separate from measured delivery metrics.
import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Txt } from '../design/frame';
import { UIIcon } from '../design/icons';
import { ScoreRing } from '../design/ScoreRing';
import { createThemedStyles, useTheme } from '../design/theme';
import { C, F } from '../design/tokens';
import { PULL_T } from '../domain/gestures';
import { relativeDay } from '../domain/format';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import type { HomeShared } from './shared';

export function HomeFeedbackStats({deckId,home,active}:{deckId:string|null;home:HomeShared;active:boolean}) {
 const {c}=useTheme();
 const model=useDeckModel(deckId);
 const feedback=useRunFeedbackStatus(model,active);
 const style=useAnimatedStyle(()=>{
  const pull=Math.min(1,Math.abs(home.vy.value)/PULL_T),fraction=Math.abs(home.p.value-Math.round(home.p.value));
  return {opacity:(home.vy.value<0?1-Math.min(1,pull*1.6)*.9:1)*Math.max(0,1-fraction*2.4)};
 });
 if(!model)return null;
 const {aggregate:a}=feedback,stats=model.stats,run=model.state.run;
 const rows=[
  {icon:'i-flag' as const,value:String(a.findings),unit:'verified findings'},
  {icon:'i-bubble' as const,value:stats?.fpm==null?'—':stats.fpm.toFixed(1),unit:'fillers / min'},
  {icon:'i-gauge' as const,value:stats?.wpm==null?'—':String(stats.wpm),unit:stats?.pace?'wpm · '+stats.pace:'wpm'},
 ];
 return <Animated.View pointerEvents="none" style={[styles.root,style]}>
  <ScoreRing id="gHomeAssessment" percent={a.recorded?100*a.assessed/a.recorded:null}
   value={a.recorded?`${a.assessed}/${a.recorded}`:'—'} label="slides assessed" labelColor={c.secondary} gradient={['#9AF7D6','#0EA877']}/>
  <View style={{flex:1,minWidth:0,gap:9}}>
   <Txt numberOfLines={1} style={styles.label}>{run?'Last run · '+(relativeDay(run.createdAt)||'Earlier'):'No runs yet'}</Txt>
   {rows.map(row=><View key={row.icon} style={styles.row}><UIIcon name={row.icon} size={21}/><Txt style={styles.value}>{row.value}</Txt><Txt style={styles.unit}>{row.unit}</Txt></View>)}
   <Txt numberOfLines={2} accessibilityLiveRegion="polite" style={styles.notice}>{feedback.notice||[
    a.pending?`${a.pending} analyzing`:null,a.outdated?`${a.outdated} outdated`:null,
    a.recoveryNeeded?`${a.recoveryNeeded} need retry`:null,a.partial?`${a.partial} partial`:null,
    a.insufficient?`${a.insufficient} insufficient evidence`:null,a.notAnalyzed?`${a.notAnalyzed} not analyzed`:null,
   ].filter(Boolean).join(' · ')}</Txt>
  </View>
 </Animated.View>;
}
const styles=createThemedStyles({
 root:{position:'absolute',left:24,right:24,top:548,height:156,flexDirection:'row',alignItems:'center',gap:18},
 label:{fontFamily:F.medium,fontSize:12,color:C.secondary},row:{flexDirection:'row',alignItems:'center',gap:7},
 value:{fontFamily:F.display,fontSize:18,color:C.text,fontVariant:['tabular-nums']},unit:{flexShrink:1,fontFamily:F.medium,fontSize:12,color:C.secondary},
 notice:{fontFamily:F.medium,fontSize:11,lineHeight:14,color:C.secondary},
});
