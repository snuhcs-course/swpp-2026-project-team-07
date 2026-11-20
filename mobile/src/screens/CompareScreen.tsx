// OpenAI Codex review routing: docs/ai-collaboration/prompt-logs/seoyeon/iteration-2.md#record-137
// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode compare: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-081
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OpenAI Codex follow-up: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-047
// OutLoud redesign: Compare takes (SPEC §4.5).
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph } from '../design/icons';
import { PanView } from '../design/PanView';
import { C, EASE_SCREEN, F } from '../design/tokens';
import { BACK_FADE_Y } from '../domain/gestures';
import { createThemedStyles, useTheme } from '../design/theme';
import { HintRow, PageSurface, RecordButton } from '../design/ui';
import { summarizeTake } from '../domain/analysis';
import { fmt } from '../domain/format';
import { buildLines } from '../domain/lines';
import { partSeconds, reviewDestination, runAttemptIds, type Run } from '../domain/run';
import { scorablePoints } from '../domain/words';
import { resolveCompare } from '../features/rehearsal/takes';
import { audioOf } from '../features/rehearsal/analysis';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { transcriptsFor, useDeckModel } from '../features/presentations/useDeckModel';
import { useBack, useShell } from './shared';
import { useHorizontalSwipeMotion } from './swipeMotion';

export function CompareScreen() {
  const { c: palette } = useTheme();
  const frame = useFrame();
  const { go, nav } = useShell();
  const model = useDeckModel(nav.deckId);
  const [keep, setKeep] = useState<'old' | 'new'>('old');
  const player = useSegmentPlayer();
  const swipe = useHorizontalSwipeMotion();
  const fadeY = useSharedValue(0);
  const swipeFade = useAnimatedStyle(() => ({opacity:Math.max(0,1-fadeY.value/BACK_FADE_Y)}));
  const c = model?.state.compare ?? null;

  const view = useMemo(() => {
    if (!model || !c) return null;
    const { deck } = model;
    const sl = c.slides, first = sl[0], last = sl[sl.length - 1];
    const tgt = sl.reduce((a, i) => a + (deck.targets[i] ?? 0), 0);
    const points = sl.flatMap(i => scorablePoints(deck.slides[i]?.points ?? []));
    const summary = (run: Run) => {
      const ids = runAttemptIds({ ...run, parts: sl.map(i => run.parts[i]) });
      const { transcripts, stages } = transcriptsFor(ids);
      const lines = buildLines(run, model.n, transcripts, model.state.edits, model.vocab).filter(l => sl.includes(l.slide));
      const ready = ids.every(id => transcripts.has(id) || stages.get(id) === 'no_speech');
      return summarizeTake(sl.map(i => partSeconds(run.parts[i])), lines, points, ready);
    };
    const A = summary(c.prev), B = summary(c.next);
    return {
      title: c.whole ? deck.title : sl.length === 1 ? deck.slides[first]?.title ?? 'Slide ' + (first + 1) : 'Slides ' + (first + 1) + '–' + (last + 1),
      label: (c.whole ? 'Whole presentation' : sl.length === 1 ? 'Slide ' + (first + 1) : sl.length + ' slides') + ' · choose one recording',
      A, B, tgt, points, first, slides: sl, whole: c.whole, many: sl.length > 1,
    };
  }, [c, model]);

  const finish = useCallback((which: 'old' | 'new', reviewing = true) => {
    if (!model || !view) return;
    player.stop();
    const resolved = resolveCompare(model.deck.id, which);
    const requested = Math.max(0, Math.min(model.n - 1, nav.sel));
    const inScope = c?.slides.includes(requested) || requested === c?.next.sel;
    const fallback = c?.slides.find(i => partSeconds(resolved?.parts[i]) > 0);
    const selected = inScope && partSeconds(resolved?.parts[requested]) > 0 ? requested :
      fallback ?? Math.max(0, resolved?.parts.findIndex(part => partSeconds(part) > 0) ?? -1);
    const destination=reviewing ? reviewDestination(model.state.takes) : 'rehearse';
    go(destination, { nav: 'fade', deckId: model.deck.id, slide: selected, sel: selected, from: destination==='review'?'rehearse':null });
  }, [c, go, model, nav.sel, player, view]);
  // Leaving comparison keeps its pending take choice intact.
  const back = useCallback(() => {
    player.stop();
    if(model)go('rehearse',{nav:'fade',deckId:model.deck.id,slide:Math.max(0,Math.min(model.n-1,nav.sel))});
    else go('home');
  },[go,model,nav.sel,player]);
  useBack(true, useCallback(() => { back(); return true; }, [back]));

  if (!model || !view) return null;
  const selected = keep === 'old' ? view.A : view.B;
  const playKey = `compare:${model.deck.id}:${keep}`;
  const playSelected = () => {
    const source = keep === 'old' ? c?.prev : c?.next;
    if (!source) return;
    const segments = view.slides.flatMap(i => {
      const part = source.parts[i], uri = part && audioOf(part.attemptId);
      return part && uri ? part.segments.filter(s => s.endMs > s.startMs).map(s => ({ uri, ...s })) : [];
    });
    if (segments.length) void player.playSegments(playKey, segments);
  };
  const other=keep==='old'?view.B:view.A;
  const durationDelta=view.B.time-view.A.time;
  const durationLabel=durationDelta===0?'Same time':`${fmt(Math.abs(durationDelta))} ${durationDelta<0?'faster':'slower'}`;
  const statDelta=(value:number,otherValue:number,lowerBetter=false)=>{
    if(value===otherValue)return 'No change';
    const amount=Math.abs(value-otherValue);
    return lowerBetter?`${amount} ${value<otherValue?'fewer':'more'}`:`${value>otherValue?'+':''}${value-otherValue}`;
  };
  const currentPoints=selected.ready?selected.said.length:null,otherPoints=other.ready?other.said.length:null;
  const playActive=player.playingKey===playKey&&!player.paused;
  const togglePlay=()=>{if(player.playingKey===playKey){player.setPaused(!player.paused);return;}playSelected();};
  // Centre the 84 dp action and its label between Play and the footer hints.
  const hintTop=(frame.compact?760:844)-24-22;
  const keepTop=(526+hintTop-116)/2;
  return (
    <><Enter kind={nav.nav}><PanView style={[StyleSheet.absoluteFill,swipeFade]}
      onMoveShould={(_e,g)=>(Math.abs(g.dx)>18&&Math.abs(g.dx)>Math.abs(g.dy))||(g.dy>12&&g.dy>Math.abs(g.dx))}
      onMove={(_e,g)=>{if(Math.abs(g.dx)>Math.abs(g.dy)){swipe.move(g.dx);fadeY.set(0);}else{swipe.settle();fadeY.set(Math.max(0,Math.min(BACK_FADE_Y,g.dy)));}}}
      onRelease={(_e,g)=>{const horizontal=Math.abs(g.dx)>Math.abs(g.dy)||Math.abs(g.vx)>0.6&&Math.abs(g.vx)>Math.abs(g.vy);if(!horizontal&&g.dy>60){fadeY.set(withTiming(BACK_FADE_Y,{duration:460,easing:EASE_SCREEN},done=>{if(done)runOnJS(back)();}));}else{fadeY.set(withTiming(0,{duration:360,easing:EASE_SCREEN}));if(horizontal&&(g.dx < -60 || g.vx < -0.6)){if(Math.abs(g.dx)<18)swipe.move(-95);player.stop();setKeep('new');}else if(horizontal&&(g.dx > 60 || g.vx > 0.6)){if(Math.abs(g.dx)<18)swipe.move(95);player.stop();setKeep('old');}swipe.settle();}}}
      onTerminate={()=>{swipe.settle();fadeY.set(withTiming(0,{duration:360,easing:EASE_SCREEN}));}}>
      <PageSurface hue={model.deck.hue} />
      <Animated.View style={[StyleSheet.absoluteFill,swipe.style]}>
      <View style={styles.header} pointerEvents="none">
        <Txt numberOfLines={1} style={styles.title}>{view.title}</Txt>
        <Txt style={styles.label}>Compare takes</Txt>
      </View>
      <View style={[styles.segment, { backgroundColor: palette.raised, borderColor: palette.line }]}>
          {(['old', 'new'] as const).map(kind => <Pressable key={kind} accessibilityRole="button" accessibilityState={{ selected: keep === kind }}
            onPress={() => { if(keep!==kind){swipe.move(kind==='new'?-95:95);player.stop();setKeep(kind);swipe.settle();} }} style={[styles.segmentOption, keep === kind && { backgroundColor: palette.text }]}>
            <Txt style={[styles.segmentText, { color: keep === kind ? palette.onAccent : palette.secondary }]}>{kind === 'old' ? 'Old take' : 'New take'}</Txt>
          </Pressable>)}
      </View>
      <View style={styles.bigRow} pointerEvents="none">
        <Txt style={styles.big}>{fmt(selected.time)}</Txt>
        <Txt style={[styles.change,{color:durationDelta<0?palette.good:durationDelta>0?palette.warn:palette.secondary}]}>{durationLabel}</Txt>
      </View>
      <View style={styles.metrics} pointerEvents="none">
        <Metric label="Fillers" value={selected.ready?String(selected.ft):'—'} delta={selected.ready&&other.ready?statDelta(selected.ft,other.ft,true):'—'} />
        <Metric label="Key points" value={currentPoints==null||!view.points.length?'—':`${currentPoints} of ${view.points.length}`} delta={currentPoints!=null&&otherPoints!=null?statDelta(currentPoints,otherPoints):'—'} />
        <Metric label="Pace" value={selected.wpm==null?'—':`${selected.wpm} wpm`} delta={selected.wpm!=null&&other.wpm!=null?statDelta(selected.wpm,other.wpm):'—'} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={playActive?'Pause selected take':`Play ${keep} take`} onPress={togglePlay} style={[styles.playButton,{backgroundColor:palette.strong}]}>
        <Glyph name={playActive?'p-pause':'p-play'} size={22} color={palette.onAccent}/>
      </Pressable>
      {!!player.error && <Txt accessibilityRole="alert" style={[styles.playError, { color: palette.secondary }]}>{player.error}</Txt>}
      <RecordButton green glyph="check" label="Keep this take" onPress={() => finish(keep,false)} style={[styles.keepButton,{top:keepTop}]}/>
      <Txt pointerEvents="none" style={[styles.keepLabel,{top:keepTop+94}]}>Keep this take</Txt>
      </Animated.View>
    </PanView></Enter>
    {/* OpenAI Codex, 2026-11-20: keep the take-switch cue in one place. */}
    <HintRow style={styles.hints} hints={[{icon:'h-spin',text:'Switch take'},{icon:'h-dn',text:'Back',nudge:'down'}]}/>
    </>
  );
}

function Metric({label,value,delta}:{label:string;value:string;delta:string}){
  const{c}=useTheme();
  return <View style={styles.metric}>
    <Txt style={[styles.metricValue,{color:c.text}]}>{value}</Txt>
    <Txt style={[styles.metricLabel,{color:c.secondary}]}>{label}</Txt>
    <Txt style={[styles.metricDelta,{color:c.secondary}]}>{delta}</Txt>
  </View>;
}

const styles = createThemedStyles({
  header: { position: 'absolute', left: 40, right: 40, top: 46, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13.5, color: C.secondary },
  bigRow: { position:'absolute',top:200,left:24,right:24,height:80,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:16 },
  big: { fontFamily: F.display, fontSize: 52, lineHeight: 56, letterSpacing: -1.6, color: C.text, fontVariant: ['tabular-nums'] },
  change:{fontFamily:F.semibold,fontSize:16},
  metrics:{position:'absolute',top:330,left:24,right:24,flexDirection:'row',justifyContent:'space-between',gap:8},
  metric:{flex:1,alignItems:'center',gap:4},metricValue:{fontFamily:F.display,fontSize:24,lineHeight:29,fontVariant:['tabular-nums']},metricLabel:{fontFamily:F.medium,fontSize:14},metricDelta:{fontFamily:F.semibold,fontSize:13.5},
  segment:{position:'absolute',top:118,left:40,right:40,height:50,flexDirection:'row',borderWidth:1,borderRadius:25,padding:4,gap:4},
  segmentOption: { flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontFamily: F.bold, fontSize: 15, lineHeight: 20 },
  playButton:{position:'absolute',left:167,top:470,width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center'},
  playError:{position:'absolute',top:538,left:24,right:24,textAlign:'center',fontFamily:F.medium,fontSize:13.5},
  keepButton:{left:153},keepLabel:{position:'absolute',left:24,right:24,textAlign:'center',fontFamily:F.semibold,fontSize:16,color:C.text},hints:{bottom:24},
});
