import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt } from '../design/frame';
import { EASE_SCREEN, F } from '../design/tokens';
import { BACK_FADE_Y } from '../domain/gestures';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
// Claude Code, prompted by Seoyeon (2026-11-15): waits on feedback v3 progress when the server offers it.
import { useRunScores } from '../features/feedback/useRunFeedbackV3';
import { scoreLevelColor } from '../features/feedback/presentationScoreDisplay';
import { runLabel } from '../domain/run';
import { useNow, useShell } from './shared';
import { PanView } from '../design/PanView';

export function WaitScreen({ active = true }: { active?: boolean }) {
  const { c } = useTheme();
  const { go, nav } = useShell();
  // OpenAI Codex, 2026-11-19: fade the pending page into Home on a downward swipe.
  const fadeY = useSharedValue(0);
  const swipeFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - fadeY.value / BACK_FADE_Y) }));
  const model = useDeckModel(nav.deckId);
  const runScores = useRunScores(model, active), v3 = runScores.v3, scores = runScores.scores, v2 = runScores.v2;
  const feedback = useRunFeedbackStatus(model, active && !v3);
  const now = useNow();
  const moved = useRef(false);
  const [timedOut, setTimedOut] = useState(false);
  const scorePending = v3 ? /scoring|pending|outdated/i.test(scores.overall.status) : /grading|scoring|updating|pending/i.test(scores.overall.status);
  const scoreResolved = v3 ? !scorePending : scores.overall.score !== null || /graded|unavailable|incomplete|insufficient|invalid|not applicable|select a complete|combined recordings/i.test(scores.overall.status);
  const slidesPending = v3 ? v3.aggregate.pending : feedback.aggregate.pending;
  const allReady = !!model?.state.run && slidesPending === 0 && !scorePending && scoreResolved;
  const revealTiles = allReady || timedOut;
  useEffect(() => {
    const remaining = 180_000;
    const timer = setTimeout(() => setTimedOut(true), remaining);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!active || !(allReady || timedOut) || moved.current) return;
    const timer = setTimeout(() => {
      if (!moved.current) {
        moved.current = true;
        go('full', { deckId: nav.deckId, sel: Math.max(0, nav.sel), from: 'wait', nav: null });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [active, allReady, timedOut, go, nav.deckId, nav.sel]);
  if (!model) return null;
  const { deck, times } = model;
  const run = model.state.run;
  if (!run) return null;
  const hintHome = () => { moved.current = true; go('home'); };
  const openListen = () => {
    moved.current = true;
    // OpenAI Codex, 2026-11-19: keep Full Review beneath Listen Back for its downward fade.
    go('full', { deckId: deck.id, sel: 0, from: 'wait', nav: null });
    go('listen', { deckId: deck.id, sel: 0, from: 'full' });
  };
  const terminalCount = v3 ? v3.aggregate.settled : feedback.items.filter(item => ['reviewed','partial','insufficient','unavailable','recovery_needed','outdated','not_analyzed'].includes(item.status)).length;
  return <Enter kind={nav.nav}><PanView style={[StyleSheet.absoluteFill,{backgroundColor:c.bg},swipeFade]}
    onMoveShould={(_e,g)=>g.dy>12&&g.dy>Math.abs(g.dx)}
    onMove={(_e,g)=>fadeY.set(Math.max(0,Math.min(BACK_FADE_Y,g.dy)))}
    onRelease={(_e,g)=>{if(g.dy>60)fadeY.set(withTiming(BACK_FADE_Y,{duration:460,easing:EASE_SCREEN},done=>{if(done)runOnJS(hintHome)();}));else fadeY.set(withTiming(0,{duration:360,easing:EASE_SCREEN}));}}
    onTerminate={()=>fadeY.set(withTiming(0,{duration:280,easing:EASE_SCREEN}))}>
    <PageSurface hue={deck.hue} />
    <View style={styles.header}><Txt numberOfLines={1} style={[styles.title,{color:c.text}]}>{deck.title}</Txt>
      <Txt style={[styles.sub,{color:c.secondary}]}>{`Review · ${runLabel(run,now,()=> 'Just now')}`}</Txt></View>
    <View style={styles.score}><Txt style={[styles.ghostScore,{color:c.tertiary}]}>—%</Txt>
      {v3 ? v3.failures && <>
        <Txt style={[styles.scoreError,{color:c.secondary}]}>Some AI feedback failed</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry failed AI feedback" disabled={v3.busy} onPress={() => void v3.retry()}
          style={[styles.retry,{borderColor:c.hair,opacity:v3.busy?0.5:1}]}><Txt style={[styles.retryText,{color:c.text}]}>{v3.busy?'Retrying…':'Try again'}</Txt></Pressable>
      </> : /unavailable|failed|invalid/i.test(scores.overall.status)&&<>
        <Txt style={[styles.scoreError,{color:c.secondary}]}>Overall score unavailable</Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={v2.controller.ask?'Confirm overall score retry':'Retry overall score'} disabled={v2.controller.busy || !v2.overall.state?.retry_available}
          onPress={() => void (v2.controller.ask ? v2.controller.confirm() : v2.controller.generate())} style={[styles.retry,{borderColor:c.hair,opacity:v2.controller.busy || !v2.overall.state?.retry_available?0.5:1}]}>
          <Txt style={[styles.retryText,{color:c.text}]}>{v2.controller.busy?'Retrying…':v2.controller.ask?'Retry anyway':'Try again'}</Txt>
        </Pressable>
        {v2.controller.ask&&<Pressable accessibilityRole="button" onPress={()=>void v2.controller.cancel()} style={styles.cancelRetry}><Txt style={[styles.retryText,{color:c.secondary}]}>Cancel retry</Txt></Pressable>}
      </>}</View>
    <View style={styles.steps}>
      <Step label="Recording saved" detail="Audio is safe on this phone" done icon="✓" />
      <Step label="Each slide checked" detail={`${terminalCount} of ${times.length} · ${slidesPending ? 'in progress' : 'ready'}`} done={terminalCount >= times.length} icon={terminalCount >= times.length ? '✓' : '···'} />
      <Step label="Full review against the rubric" detail={scorePending ? 'Checking the full presentation' : scores.overall.status} done={!scorePending && scores.overall.status !== 'Not graded'} icon={!scorePending ? '✓' : '···'} />
    </View>
    <View style={styles.tiles}>
      {Array.from({length:Math.ceil(times.length/6)},(_,row)=><View key={row} style={styles.tileRow}>{times.slice(row*6,row*6+6).map((_,col)=>{
        const i=row*6+col;
        const score=scores.items[i]; const fill=score?.score!=null?scoreLevelColor(score.level,c):c.track;
        const settled=revealTiles&&(v3?v3.items[i]?.settled:feedback.items[i]?.assessed);
        const available=revealTiles&&score?.score!=null;
        return <View key={i} style={[styles.tile,{backgroundColor:available?fill:settled?c.surface:c.track,borderColor:settled&&!available?c.hair:'transparent',borderWidth:settled&&!available?1:0}]}><Txt style={[styles.tileText,{color:available?c.gradeOnFill:settled?c.good:c.secondary}]}>{available?score.score:settled?'✓':i+1}</Txt></View>;
      })}</View>)}
    </View>
    <Txt style={[styles.note,{color:c.secondary}]}>{timedOut && !allReady ? 'Showing the results available so far. You can refresh the review later.' : 'Slide scores and the full review are checked together. You can listen while this finishes.'}</Txt>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={openListen} style={[styles.primary,{backgroundColor:c.strong}]}><Txt style={[styles.buttonText,{color:c.onAccent}]}>Listen back while you wait</Txt></Pressable>
      <Pressable accessibilityRole="button" onPress={hintHome} style={[styles.secondary,{borderColor:c.hair}]}><Txt style={[styles.buttonText,{color:c.text}]}>Go Home</Txt></Pressable>
    </View>
    <HintRow hints={[{icon:'h-dn',text:'Home',nudge:'down'}]} />
  </PanView></Enter>;
}

function Step({label,detail,done,icon}:{label:string;detail:string;done:boolean;icon:string}) {
  const {c}=useTheme();return <View style={styles.step}>
    <View style={[styles.check,{backgroundColor:done?c.good:c.surface06,borderColor:done?c.good:c.hair}]}><Txt style={[styles.checkText,{color:done?c.onAccent:c.secondary}]}>{icon}</Txt></View>
    <View style={styles.copy}><Txt style={[styles.label,{color:c.text}]}>{label}</Txt><Txt style={[styles.detail,{color:c.secondary}]}>{detail}</Txt></View>
  </View>;
}

const styles=StyleSheet.create({
  header:{position:'absolute',top:46,left:40,right:40,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},sub:{fontFamily:F.medium,fontSize:14,lineHeight:18},
  score:{position:'absolute',left:24,right:24,top:104,alignItems:'center'},ghostScore:{fontFamily:F.display,fontSize:58,lineHeight:66,letterSpacing:-2,fontVariant:['tabular-nums']},scoreError:{marginTop:2,fontFamily:F.medium,fontSize:13.5},retry:{minHeight:34,minWidth:100,marginTop:4,paddingHorizontal:14,borderRadius:17,borderWidth:1,alignItems:'center',justifyContent:'center'},retryText:{fontFamily:F.semibold,fontSize:13.5},cancelRetry:{minHeight:30,justifyContent:'center'},steps:{position:'absolute',left:40,right:24,top:200,gap:14},step:{minHeight:48,flexDirection:'row',alignItems:'center',gap:14},check:{width:32,height:32,borderRadius:16,borderWidth:1,alignItems:'center',justifyContent:'center'},checkText:{fontFamily:F.bold,fontSize:15},copy:{flex:1,gap:3},label:{fontFamily:F.semibold,fontSize:15},detail:{fontFamily:F.medium,fontSize:13.5,lineHeight:18},
  tiles:{position:'absolute',top:388,left:24,right:24,gap:8},tileRow:{height:50,flexDirection:'row',justifyContent:'space-between',gap:8},tile:{width:50,height:50,borderRadius:14,alignItems:'center',justifyContent:'center'},tileText:{fontFamily:F.bold,fontSize:14},note:{position:'absolute',left:24,right:24,top:552,fontFamily:F.medium,fontSize:14,lineHeight:20},actions:{position:'absolute',left:24,right:24,top:618,height:52,flexDirection:'row',gap:10},primary:{flex:1,minWidth:0,height:52,borderRadius:26,alignItems:'center',justifyContent:'center',paddingHorizontal:8},secondary:{flex:1,minWidth:0,height:52,borderWidth:1,borderRadius:26,alignItems:'center',justifyContent:'center',paddingHorizontal:8},buttonText:{fontFamily:F.semibold,fontSize:14,textAlign:'center'}
});
