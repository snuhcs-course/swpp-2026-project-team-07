// OpenAI Codex review routing: docs/ai-collaboration-prompts-iteration-2.md#first-recording-review-navigation-october-16-2026
// OpenAI Codex Review and Full review: docs/ai-collaboration-prompts-iteration-2.md#review-and-full-review-redesign-october-15-2026
// Real merged-run audio, timed transcript and verified AI assessment status.
// OpenAI Codex #44: continuous within-section seeking preserves saved-source and pause intent.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { PresentationScorePanel, PresentationScoreRing } from '../features/feedback/PresentationScorePanel';
import { useRunPresentationScores } from '../features/feedback/useRunPresentationScores';
import { currentScoreEvidence, scoreAudioEvidence, scoreLevelColor, scoreLevelLabel, scorePlaybackSource } from '../features/feedback/presentationScoreDisplay';
import type { ScoreEvidence } from '../features/feedback/presentationScore';
import { EASE_SCREEN, F, FRAME_W } from '../design/tokens';
import { useTheme } from '../design/theme';
import { Dialog, HintRow, PageSurface } from '../design/ui';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import { fmt, relativeDay } from '../domain/format';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { runLabel, runPosition, runStarts, runScrubPosition, runSeekPosition, type RunAudioPlanEntry, type RunSeekPosition } from '../domain/run';
import type { Line } from '../domain/lines';
import { audioOf } from '../features/rehearsal/analysis';
import { useSegmentPlayer, type Segment } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useBack, useNow, useShell } from './shared';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
type Mode = { kind: 'run' } | { kind: 'slide'; slide: number } | null;
type RowLayout = { y: number; h: number };

export function FullReviewScreen({ active = true }: { active?: boolean }) {
  const { c, mode: themeMode } = useTheme();
  const { go, nav } = useShell();
  const frame = useFrame();
  const model = useDeckModel(nav.deckId);
  const run = model?.state.run ?? null;
  const feedback = useRunFeedbackStatus(model, active);
  const scores = useRunPresentationScores(model, active);
  const scoreSource = useRef({item:scores.overall,target:scores.target,active});
  useLayoutEffect(()=>{scoreSource.current={item:scores.overall,target:scores.target,active};return()=>{scoreSource.current.active=false;};},[scores.overall,scores.target,active]);
  const [missingAudio, setMissingAudio] = useState<{slides:number[];signature:string;target:RunSeekPosition;paused:boolean;resumeKey:string|null}|null>(null);
  const now = useNow();
  const player = useSegmentPlayer();
  const stopPlayback = player.stop;
  const scoreEvidenceSource=useRef<string|null>(null);
  const scorePlaybackIdentity=scorePlaybackSource(scores.overall.state,scores.target);
  useEffect(()=>{if(player.playingKey?.startsWith('score-evidence:')&&scoreEvidenceSource.current!==scorePlaybackIdentity)stopPlayback();},[scorePlaybackIdentity,player.playingKey,stopPlayback]);
  const sourceIdentity=JSON.stringify(run?.parts??[]);
  const playbackSource=useRef({active,signature:sourceIdentity,foreground:AppState.currentState!=='background'&&AppState.currentState!=='inactive'});
  const partialAccepted=useRef<string|null>(null);
  const dy = useSharedValue(0);
  const backExiting = useRef(false);
  const [mode, setMode] = useState<Mode>(null);
  const [sliderSlide,setSliderSlide]=useState(Math.max(0,nav.sel));
  const [scrubbing,setScrubbing]=useState(false);
  const [viewSource,setViewSource]=useState(sourceIdentity);
  const [scrubTarget,setScrubTarget]=useState<RunSeekPosition|null>(null);
  const scrubTargetRef=useRef<RunSeekPosition|null>(null);
  const scrubIntent=useRef<{signature:string;key:string|null;playing:boolean;positionMs:number}|null>(null);
  const sectionTrack=useRef({x:26,width:FRAME_W-58});
  const [plan, setPlan] = useState<RunAudioPlanEntry[]>([]);
  const [audioNote, setAudioNote] = useState('');
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef<ScrollView>(null);
  const stripRef = useRef<ScrollView>(null);
  const transcriptDrag = useRef(false);
  const stripDrag = useRef(false);
  const [viewportH, setViewportH] = useState(0);
  const rowLayouts = useRef(new Map<string, RowLayout>());
  const transcriptBounds = useRef({ top: 343, bottom: 675 });

  if(viewSource!==sourceIdentity||!active&&(scrubbing||missingAudio)){
    setViewSource(sourceIdentity);setScrubbing(false);setScrubTarget(null);setMissingAudio(null);
  }
  useLayoutEffect(()=>{const source=playbackSource.current;source.active=active;source.signature=sourceIdentity;return()=>{source.active=false;};},[active,sourceIdentity]);
  useLayoutEffect(()=>{stopPlayback();scrubIntent.current=null;scrubTargetRef.current=null;partialAccepted.current=null;},[sourceIdentity,stopPlayback]);
  useEffect(() => { if (!active) { dy.set(0); stopPlayback();scrubIntent.current=null;scrubTargetRef.current=null; } }, [active, dy, stopPlayback]);
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>{
    playbackSource.current.foreground=state==='active';
    if(state!=='active'){stopPlayback();scrubIntent.current=null;scrubTargetRef.current=null;setScrubbing(false);setScrubTarget(null);setMissingAudio(null);}
  });return()=>sub.remove();},[stopPlayback]);
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); stopPlayback(); }, [stopPlayback]);
  const toBack = useCallback(() => {
    playbackSource.current.active=false;scrubIntent.current=null;scrubTargetRef.current=null;
    stopPlayback();
    if (nav.from === 'review') go('review', { deckId: nav.deckId, sel: nav.sel });
    else if (nav.from === 'rehearse') go('rehearse', { nav: null, deckId: nav.deckId, slide: nav.sel });
    else go('home');
  }, [go, nav.deckId, nav.from, nav.sel, stopPlayback]);
  const openSlide = useCallback((i: number) => {
    playbackSource.current.active=false;scrubIntent.current=null;scrubTargetRef.current=null;
    stopPlayback();
    if (nav.from === 'review') go('review', { deckId: nav.deckId, sel: i });
    else go('review', { nav: 'fade', deckId: nav.deckId, sel: i, from: 'full' });
  }, [go, nav.deckId, nav.from, stopPlayback]);
  const pan = {
    onMoveShould: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
      const y = (g.y0 - frame.top) / frame.s;
      return !backExiting.current && Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx)
        && !(y >= transcriptBounds.current.top && y < transcriptBounds.current.bottom)
        && !(y >= 301 && y <= 333) && !(y >= 718 && y <= 776);
    },
    onMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => { dy.set(Math.max(0, Math.min(BACK_FADE_Y, g.dy / frame.s))); },
    onRelease: () => {
      if (dy.get() > BACK_T) {
        backExiting.current = true;
        dy.set(withTiming(BACK_FADE_Y, { duration: 220, easing: EASE_SCREEN }, finished => {
          if (finished) runOnJS(toBack)();
        }));
      } else dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN }));
    },
    onTerminate: () => { if (!backExiting.current) dy.set(withTiming(0, { duration: 220, easing: EASE_SCREEN })); },
  };
  useBack(active, () => { toBack(); return true; });
  const screen = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - dy.value / BACK_FADE_Y) }));

  const times = useMemo(() => model?.times ?? [], [model]);
  const starts = useMemo(() => runStarts(times), [times]);
  const lines = useMemo(() => (model?.lines ?? []).filter(line => (times[line.slide] ?? 0) > 0).slice().sort((a, b) => a.t - b.t), [model, times]);
  const runKey = `run:${model?.deck.id ?? ''}`;
  const playing = !!player.playingKey;
  const runPlaying = player.playingKey === runKey && mode?.kind === 'run';
  const slidePlaying = mode?.kind === 'slide' && player.playingKey === `slide:${model?.deck.id}:${mode.slide}`;
  const playbackSlide = runPlaying ? slideAtElapsed(player.elapsedMs, plan) : slidePlaying ? mode.slide : null;
  const pos = runPlaying ? runPosition(player.elapsedMs, plan)
    : slidePlaying && playbackSlide != null ? (starts[playbackSlide] ?? 0) + player.elapsedMs / 1000 : 0;
  const currentLine = (runPlaying || slidePlaying) && playbackSlide != null
    ? lines.filter(line => line.slide === playbackSlide && line.t <= pos).at(-1)?.key ?? null : null;

  useEffect(() => {
    if (!currentLine || transcriptDrag.current || !viewportH) return;
    const measured = rowLayouts.current.get(currentLine);
    if (measured) transcriptRef.current?.scrollTo({ y: Math.max(0, measured.y - (viewportH - measured.h) / 2), animated: true });
  }, [currentLine, viewportH]);
  useEffect(() => {
    if (playbackSlide == null || stripDrag.current) return;
    const max = Math.max(0, 16 + times.length * 50 - 8 - 358);
    stripRef.current?.scrollTo({ x: Math.max(0, Math.min(max, 8 + playbackSlide * 50 + 21 - 179)), animated: true });
  }, [playbackSlide, times.length]);

  if (!model || !run) return null;
  const { deck, stats, total } = model;
  const note = (message: string) => {
    setAudioNote(message);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setAudioNote(''), 3000);
  };
  const onScoreEvidence = (refs: ScoreEvidence[]) => {
    const current=scoreSource.current;
    if(!current.active||!currentScoreEvidence(current.item.state,current.target,refs))return;
    const fact=refs.find(ref=>ref.kind==='slide');
    if(fact?.kind==='slide'){openSlide(fact.slide_index);return;}
    const audio=scoreAudioEvidence(refs),duration=current.target!.review?.duration_ms??0;
    if(!audio.length||audio.some(ref=>ref.attempt_id!==current.target!.id||ref.end_ms>duration))return;
    const uri=audioOf(current.target!.id);
    if(!uri){note('Original recording audio is not on this phone. Open its slide review to download it.');return;}
    scoreEvidenceSource.current=scorePlaybackSource(current.item.state,current.target);
    setAudioNote('Playing cited intervals from the original recording');setMode(null);setPlan([]);
    void player.playSegments(`score-evidence:${current.target!.id}:${audio.map(ref=>`${ref.start_ms}:${ref.end_ms}`).join(',')}`,audio.map(ref=>({uri,startMs:ref.start_ms,endMs:ref.end_ms})));
  };
  const wholeAudio = (): { segments: Segment[]; entries: RunAudioPlanEntry[]; missing:number[] } => {
    const segments: Segment[] = [], entries: RunAudioPlanEntry[] = [], missing: number[] = [];
    times.forEach((t, i) => {
      if (t <= 0) return;
      const part = run.parts[i], uri = part && audioOf(part.attemptId);
      if (!uri || !part) { missing.push(i); return; }
      const selected = part.segments.filter(seg => seg.endMs > seg.startMs).map(seg => ({ uri, ...seg }));
      if (!selected.length) { missing.push(i); return; }
      segments.push(...selected);
      entries.push({ slide: i, runStart: starts[i], durMs: t * 1000 });
    });
    return { segments, entries, missing };
  };
  const seekWholeAt = (target:RunSeekPosition,paused:boolean,allowPartial=false,resumeKey:string|null=null) => {
    if(!playbackSource.current.active||!playbackSource.current.foreground||playbackSource.current.signature!==sourceIdentity)return false;
    const { segments, entries, missing } = wholeAudio();
    const entry=entries.find(value=>value.slide===target.slide);
    if(!entry){note(`Audio for slide ${target.slide+1} isn’t on this phone`);return false;}
    if (missing.length && !allowPartial && partialAccepted.current!==sourceIdentity) {
      setMissingAudio({slides:missing,signature:sourceIdentity,target,paused,resumeKey}); return true;
    }
    if(allowPartial)partialAccepted.current=sourceIdentity;
    const elapsedMs=entries.filter(value=>value.slide<target.slide).reduce((sum,value)=>sum+value.durMs,0)+Math.max(0,Math.min(entry.durMs,target.offsetMs));
    setSliderSlide(target.slide);
    setAudioNote(missing.length ? `Playing available audio · ${missing.length} slide${missing.length===1?'':'s'} missing` : '');
    setPlan(entries); setMode({ kind: 'run' });
    void player.seekSegments(runKey, segments,elapsedMs,paused);
    return true;
  };
  const toggleWhole = () => {
    if (runPlaying) { void player.playSegments(runKey,[]); return; }
    const target=runSeekPosition(0,times);
    if(target)seekWholeAt(target,false);else note('No recorded audio in this run');
  };
  const sliderTargetAt=(pageX:number)=>{
    const stageX=(pageX-frame.left)/frame.s;
    const left=16+sectionTrack.current.x;
    const fraction=Math.max(0,Math.min(1,(stageX-left)/Math.max(1,sectionTrack.current.width)));
    return runScrubPosition(fraction,times);
  };
  const previewSlider=(pageX:number)=>{
    if(!scrubIntent.current)return;
    const next=sliderTargetAt(pageX);if(!next)return;
    scrubTargetRef.current=next;setScrubTarget(next);setSliderSlide(next.slide);setAudioNote('');setScrubbing(true);
  };
  const beginSlider=(pageX:number)=>{
    if(!playbackSource.current.active||!playbackSource.current.foreground)return;
    scrubIntent.current={signature:sourceIdentity,key:player.playingKey,playing:!!player.playingKey&&!player.paused,positionMs:((runPlaying||slidePlaying)?pos:starts[sliderSlide]??0)*1000};
    player.setPaused(true);previewSlider(pageX);
  };
  const restoreScrub=(intent:NonNullable<typeof scrubIntent.current>)=>{
    if(playbackSource.current.active&&playbackSource.current.foreground&&intent.signature===playbackSource.current.signature&&intent.playing&&player.playingKey===intent.key)player.setPaused(false);
  };
  const cancelSlider=()=>{
    const intent=scrubIntent.current;scrubIntent.current=null;scrubTargetRef.current=null;setScrubbing(false);setScrubTarget(null);
    if(intent){setSliderSlide(runSeekPosition(intent.positionMs,times)?.slide??Math.max(0,nav.sel));restoreScrub(intent);}
  };
  const commitSlider=()=>{
    const intent=scrubIntent.current,target=scrubTargetRef.current;
    scrubIntent.current=null;scrubTargetRef.current=null;setScrubbing(false);setScrubTarget(null);
    if(!intent||!target||intent.signature!==playbackSource.current.signature)return;
    if(!seekWholeAt(target,!intent.playing,false,intent.playing?intent.key:null))restoreScrub(intent);
  };
  const adjustSlider=(direction:number)=>{
    const current=(runPlaying||slidePlaying)?pos*1000:(starts[sliderSlide]??0)*1000;
    const target=runSeekPosition(current+direction*5000,times);
    if(target)seekWholeAt(target,!player.playingKey||player.paused,false,!player.paused?player.playingKey:null);
  };
  const a=feedback.aggregate;
  const recoverySlides=feedback.items.filter(item=>item.status==='recovery_needed'||item.status==='unavailable');
  const source=deck.requirementsDefault?'default':deck.timing.source==='required'?'required':'suggested';
  const over=total-model.targetSum;
  const assessmentCounts=[
    ['With findings',a.slidesWithFindings],['Partial',a.partial],['Analyzing',a.pending],
    ['Outdated',a.outdated],['Needs recovery',a.recoveryNeeded],['Insufficient evidence',a.insufficient],['Not analyzed',a.notAnalyzed],
  ] as const;
  const rightText = audioNote || (scrubbing&&scrubTarget ? `${fmt(scrubTarget.positionMs/1000)} / ${fmt(total)}` : (runPlaying || slidePlaying) && playbackSlide != null
    ? runPlaying ? `${fmt(pos)} / ${fmt(total)}` : `${fmt(pos - starts[playbackSlide])} / ${fmt(times[playbackSlide])}`
    : `Slide ${sliderSlide+1} of ${times.length} · drag to seek`);
  const headerText = scrubbing&&scrubTarget?`Slide ${scrubTarget.slide+1} · ${deck.slides[scrubTarget.slide]?.title??'Slide '+(scrubTarget.slide+1)}`:(runPlaying || slidePlaying) && playbackSlide != null
    ? `Slide ${playbackSlide + 1} · ${deck.slides[playbackSlide]?.title ?? 'Slide ' + (playbackSlide + 1)}` : 'Whole run';
  const visibleSliderSlide=scrubbing?sliderSlide:playbackSlide??sliderSlide;
  const visiblePosition=scrubbing&&scrubTarget?scrubTarget.positionMs/1000:(runPlaying||slidePlaying)?pos:starts[sliderSlide]??0;
  const visibleOffset=(times[visibleSliderSlide]??0)>0?clamp((visiblePosition-(starts[visibleSliderSlide]??0))/times[visibleSliderSlide]):0;

  return <Enter kind={nav.nav}>
    <PanView style={StyleSheet.absoluteFill} {...pan}>
      <Animated.View style={[StyleSheet.absoluteFill, screen]}>
        <PageSurface hue={deck.hue} />
        <View style={styles.header} pointerEvents="none">
          <Txt numberOfLines={1} style={[styles.title, { color: c.text }]}>{deck.title}</Txt>
          <Txt numberOfLines={1} style={[styles.label, { color: c.secondary }]}>{'Full review · ' + runLabel(run, now, relativeDay)}</Txt>
        </View>
        <View style={styles.ringRow}>
          <PresentationScoreRing id="gFullAssessment" label="Overall score" item={scores.overall}/>
          <View style={styles.ringStats}>
            <Stat icon="i-clock" value={fmt(total)}
              unit={`${over>3?fmt(over)+' over':over < -3?fmt(-over)+' under':'on target'} · ${source}`}
              color={over > 3 ? c.warn : over < -3 ? c.info : c.good} />
            <Stat icon="i-slides" value={String(a.findings)} unit="verified findings" color={c.secondary} />
            <Stat icon="i-bubble" value={stats?.fpm == null ? '—' : stats.fpm.toFixed(1)} unit="fillers / min"
              color={c.secondary} opacity={stats?.fpm == null ? 0.45 : 1} />
            <Stat icon="i-gauge" value={stats?.wpm == null ? '—' : String(stats.wpm)}
              unit={stats?.pace ? 'wpm · ' + stats.pace : 'wpm'} color={c.secondary} opacity={stats?.wpm == null ? 0.45 : 1} />
          </View>
        </View>
        <View style={styles.whole}>
          <View style={styles.wholeHeader}>
            <Txt numberOfLines={1} style={[styles.wholeTitle, { color: c.text }]}>{headerText}</Txt>
            <Txt numberOfLines={1} style={[styles.wholeHint, { color: c.tertiary }]}>{rightText}</Txt>
          </View>
          <View style={styles.controls}>
            <Pressable accessibilityRole="button" accessibilityLabel={runPlaying && !player.paused ? 'Pause' : `Play the whole run, ${fmt(total)}`}
              onPress={() => toggleWhole()} style={styles.wholePlay}>
              <Glyph name={runPlaying && !player.paused ? 'p-pause' : 'p-play'} size={20} color={c.text} />
            </Pressable>
            <PanView style={styles.sections} accessibilityRole="adjustable" accessibilityLabel="Whole run audio review"
              accessibilityValue={{min:0,max:total,now:Math.max(0,Math.min(total,visiblePosition)),text:`${fmt(visiblePosition)} of ${fmt(total)}, slide ${visibleSliderSlide+1} of ${times.length}`}}
              accessibilityActions={[{name:'increment',label:'Seek forward 5 seconds'},{name:'decrement',label:'Seek backward 5 seconds'}]}
              onAccessibilityAction={e=>adjustSlider(e.nativeEvent.actionName==='increment'?1:-1)}
              onLayout={e=>{sectionTrack.current={x:e.nativeEvent.layout.x,width:e.nativeEvent.layout.width};}}
              onStartShould={()=>times.some(time=>time>0)} onGrant={e=>beginSlider(e.nativeEvent.pageX)}
              onMove={e=>previewSlider(e.nativeEvent.pageX)} onRelease={commitSlider} onTerminate={cancelSlider}
              onTerminationRequest={()=>false}>
              {times.map((t,i)=>{
                const current=visibleSliderSlide;
                const progress=t>0&&(runPlaying||slidePlaying||scrubbing)?clamp((visiblePosition-starts[i])/t):0;
                return <View key={i} style={[styles.sectionHit,{opacity:t>0?1:0.28}]}>
                  <View style={[styles.sectionTrack,{backgroundColor:c.ink18}]}>
                    {progress>0&&<View style={[styles.sectionFill,{backgroundColor:c.text,width:`${100*progress}%`}]}/>}
                  </View>
                  {current===i&&<View pointerEvents="none" style={[styles.sectionMarker,{backgroundColor:c.text,left:`${visibleOffset*100}%`}]} />}
                </View>;
              })}
            </PanView>
          </View>
        </View>
        <ScrollView ref={transcriptRef} style={styles.transcript} contentContainerStyle={styles.transcriptContent}
          onLayout={e => {
            const { y, height } = e.nativeEvent.layout;
            transcriptBounds.current = { top: y, bottom: y + height };
            setViewportH(height);
          }} onScrollBeginDrag={() => { transcriptDrag.current = true; }}
          onScrollEndDrag={() => { transcriptDrag.current = false; }} onMomentumScrollBegin={() => { transcriptDrag.current = true; }}
          onMomentumScrollEnd={() => { transcriptDrag.current = false; }} showsVerticalScrollIndicator={false}>
          <PresentationScorePanel key={`${scores.target?.id??'composed'}:${scores.target?.contextId??''}`} item={scores.overall} controller={scores.controller} target={scores.target} overall active={active} notice={scores.notice} refresh={scores.refresh} onEvidence={onScoreEvidence}/>
          <View style={styles.assessmentSummary} accessibilityLabel="AI assessment summary">
            <Txt style={[styles.slidesTitle,{color:c.text}]}>{`${a.assessed} of ${a.recorded} recorded slides assessed`}</Txt>
            <View style={styles.assessmentCounts}>{assessmentCounts.map(([label,count])=><Txt key={label} style={[styles.assessmentCount,{color:c.secondary}]}>{`${count} ${label.toLowerCase()}`}</Txt>)}</View>
            {!!recoverySlides.length&&<View style={styles.assessmentCounts}>{recoverySlides.map(item=><Pressable key={item.slide}
              accessibilityRole="button" accessibilityLabel={`Review slide ${item.slide+1}: ${item.label}`} onPress={()=>openSlide(item.slide)} style={styles.refresh}>
              <Txt style={[styles.assessmentCount,{color:c.text}]}>{`Slide ${item.slide+1} · ${item.label}`}</Txt>
            </Pressable>)}</View>}
            {!!feedback.notice&&<Txt style={[styles.emptyTranscript,{color:c.secondary}]}>{feedback.notice}</Txt>}
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh AI assessment status" onPress={()=>void feedback.refresh()} style={styles.refresh}><Txt style={[styles.assessmentCount,{color:c.text}]}>Refresh status</Txt></Pressable>
            <Txt style={[styles.slidesTitle,{color:c.text}]}>Transcript</Txt>
          </View>
          {lines.length ? lines.map((line, i) => <TranscriptRow key={line.key} line={line}
            first={i === 0 || lines[i - 1].slide !== line.slide} active={currentLine === line.key}
            playing={playing} layouts={rowLayouts} />)
            : <Txt style={[styles.emptyTranscript, { color: c.secondary }]}>
              {model.pending ? 'Transcribing… the transcript appears here' : 'No speech detected in this run'}
            </Txt>}
        </ScrollView>
        <View style={styles.slidesHeader}>
          <Txt style={[styles.slidesTitle, { color: c.text }]}>Slides</Txt>
          <Txt style={[styles.legendName,{color:c.secondary}]}>Slide scores · tap to review</Txt>
        </View>
        <View style={[styles.stripCard, { borderColor: c.hair, backgroundColor: c.surface06 }]}>
          <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripContent}
            onScrollBeginDrag={() => { stripDrag.current = true; }} onScrollEndDrag={() => { stripDrag.current = false; }}
            onMomentumScrollBegin={() => { stripDrag.current = true; }} onMomentumScrollEnd={() => { stripDrag.current = false; }}>
            {times.map((t, i) => {
              const item=feedback.items[i],score=scores.items[i];
              const fill=score?.score!=null?scoreLevelColor(score.level,c):c.ink08;
              const tileInk=score?.score==null?c.secondary:themeMode==='dark'?'#14161D':'#FFFFFF';
              const badge=score?.score!=null?String(score.score):score?.status.includes('…')?'…':score?.status.toLowerCase().includes('outdated')?'↻':'—';
              const selected = (runPlaying || slidePlaying) && playbackSlide === i;
              return <Pressable key={i} accessibilityRole="button"
                accessibilityLabel={`Slide ${i + 1}, ${deck.slides[i]?.title ?? 'Slide ' + (i + 1)}, ${t > 0 ? fmt(t) : 'not reached'}, ${score?.score!=null?`${score.score} points, ${scoreLevelLabel(score.level)}`:score?.status??'Not graded'}, ${item?.label??'Not analyzed'}. Open its review`}
                onPress={() => openSlide(i)} style={styles.tileWrap}>
                {selected && <View style={[styles.tileOutline, { borderColor: c.strong }]} />}
                <View style={[styles.tile, { backgroundColor: fill }]}>
                  <Txt style={[styles.tileNum, { color: tileInk }]}>{i + 1}</Txt>
                  <Txt style={[styles.tileTime, { color: tileInk }]}>{badge}</Txt>
                </View>
              </Pressable>;
            })}
          </ScrollView>
        </View>
        <HintRow hints={[{ icon: 'h-dn', text: nav.from === 'review' ? 'Back to review' : nav.from === 'rehearse' ? 'Back to slides' : 'Back', nudge: 'down', onPress:toBack },
          { icon: 'h-tap', text: 'Tap a slide to review it' }]} />
      </Animated.View>
    </PanView>
    {active&&missingAudio&&<Dialog title="Some run audio is missing" body={`Audio for slide${missingAudio.slides.length===1?'':'s'} ${missingAudio.slides.map(i=>i+1).join(', ')} is not on this phone. Play only the available recordings?`} confirm="Play available audio" onCancel={()=>{const captured=missingAudio;setMissingAudio(null);if(captured.signature===playbackSource.current.signature&&captured.resumeKey===player.playingKey&&playbackSource.current.active&&playbackSource.current.foreground)player.setPaused(false);}} onConfirm={()=>{const captured=missingAudio;setMissingAudio(null);if(!playbackSource.current.active||!playbackSource.current.foreground||captured.signature!==playbackSource.current.signature){note('Selected recordings changed. Start playback again.');return;}seekWholeAt(captured.target,captured.paused,true);}}/>}
  </Enter>;
}

function slideAtElapsed(elapsedMs: number, plan: readonly RunAudioPlanEntry[]): number | null {
  if (!plan.length) return null;
  let remaining = Math.max(0, elapsedMs);
  for (const entry of plan) {
    if (remaining < entry.durMs) return entry.slide;
    remaining -= entry.durMs;
  }
  return plan[plan.length - 1].slide;
}
function Stat({ icon, value, unit, color, opacity = 1 }: {
  icon: 'i-clock' | 'i-faster' | 'i-slower' | 'i-slides' | 'i-bubble' | 'i-gauge';
  value: string; unit: string; color: string; opacity?: number;
}) {
  const { c } = useTheme();
  return <View style={[styles.statRow, { opacity }]}>
    <UIIcon name={icon} size={22} />
    <Txt style={[styles.statValue, { color: c.text }]}>{value}</Txt>
    <Txt numberOfLines={2} style={[styles.statUnit, { color }]}>{unit}</Txt>
  </View>;
}
const TranscriptRow = memo(function TranscriptRow({ line, first, active, playing, layouts }: {
  line: Line; first: boolean; active: boolean; playing: boolean; layouts: React.RefObject<Map<string, RowLayout>>;
}) {
  const { c } = useTheme();
  return <View style={styles.transcriptRow} onLayout={e => {
    layouts.current.set(line.key, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height });
  }}
    accessible accessibilityLabel={first ? `Slide ${line.slide + 1}. ${line.text}` : line.text}>
    {first ? <View style={[styles.badge, { backgroundColor: c.ink14 }]}>
      <Txt style={[styles.badgeText, { color: c.body }]}>{line.slide + 1}</Txt>
    </View> : <View style={styles.badgeSpacer} />}
    <Txt style={[styles.transcriptText, { color: !playing ? c.body : active ? c.strong : c.secondary,
      fontFamily: active ? F.semibold : F.medium }]}>{line.text}</Txt>
  </View>;
});

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3 },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13 },
  ringRow: { position: 'absolute', left: 16, right: 16, top: 140, height: 120, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringStats: { width: 196, gap: 7 },
  statRow: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontFamily: F.display, fontSize: 18, lineHeight: 20, fontVariant: ['tabular-nums'] },
  statUnit: { flexShrink: 1, fontFamily: F.medium, fontSize: 12, lineHeight: 15 },
  whole: { position: 'absolute', left: 16, right: 16, top: 278, height: 55 },
  wholeHeader: { height: 17, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  wholeTitle: { flex: 1, minWidth: 0, fontFamily: F.bold, fontSize: 14 },
  wholeHint: { flexShrink: 1, fontFamily: F.medium, fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: { marginTop: 6, height: 32, flexDirection: 'row', alignItems: 'center', gap: 6 },
  wholePlay: { width: 32, height: 32, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  sections: { flex: 1, height: 32, flexDirection: 'row', alignItems: 'center', position: 'relative' },
  sectionHit: { flex: 1, flexBasis: 0, minWidth: 0, height: 28, justifyContent: 'center' },
  sectionTrack: { height: 6, marginHorizontal: 1, borderRadius: 3, overflow: 'hidden' },
  sectionFill: { height: 6, borderRadius: 3 },
  sectionMarker: { position: 'absolute', top: 1, bottom: 1, width: 2, transform:[{translateX:-1}], borderRadius: 1 },
  transcript: { position: 'absolute', left: 16, right: 16, top: 343, bottom: 169 },
  transcriptContent: { paddingVertical: 8, gap: 6 },
  assessmentSummary:{gap:10,marginBottom:12},assessmentCounts:{flexDirection:'row',flexWrap:'wrap',gap:8},assessmentCount:{fontFamily:F.medium,fontSize:12,lineHeight:17},refresh:{minHeight:44,alignSelf:'flex-start',justifyContent:'center',paddingHorizontal:10},
  transcriptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  badge: { width: 20, height: 18, marginTop: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  badgeSpacer: { width: 20, height: 18 },
  badgeText: { fontFamily: F.display, fontSize: 10.5, lineHeight: 18 },
  transcriptText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  emptyTranscript: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 20 },
  slidesHeader: { position: 'absolute', left: 16, right: 16, top: 693, height: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slidesTitle: { fontFamily: F.bold, fontSize: 14 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendCount: { fontFamily: F.bold, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  legendName: { fontFamily: F.semibold, fontSize: 11.5 },
  stripCard: { position: 'absolute', left: 16, right: 16, top: 718, height: 58, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  stripContent: { height: 56, paddingHorizontal: 8, alignItems: 'center', gap: 8 },
  tileWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  tileOutline: { position: 'absolute', top: -4, bottom: -4, left: -4, right: -4, borderWidth: 2, borderRadius: 15 },
  tile: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tileNum: { fontFamily: F.display, fontSize: 15, lineHeight: 15 },
  tileTime: { fontFamily: F.semibold, fontSize: 9.5, opacity: 0.72, fontVariant: ['tabular-nums'] },
});
