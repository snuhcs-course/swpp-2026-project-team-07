// Full-screen (landscape) Rehearse — "bottom dock" layout. Drop-in replacement for the inline
// LandscapeRehearse in RehearseScreen.tsx: same props, same behaviour, tidier layout.
//  · Nothing sits in the middle of the slide. One bottom row (the dock): timer + pace on the left,
//    record in the middle, Review · 5/18 · cues · exit on the right; the slide progress bar sits just above it.
//  · Arrows stay at the side walls. One exit (bottom-right). No top shading.
//  · The ring round record only shows for the 3-2-1 and hold-to-redo-all (the progress bar already shows run progress).
//  · Cues open: the slide shrinks left; prev · record · next line up under it; timer and 5/18 sit above it.
//  · While recording, every control hides after 3 s (tap the slide to show them); a red-dot timer and a thin
//    progress line stay.
// Spec: FULLSCREEN_DOCK_SPEC.md. Reference renders: png/.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useUiText } from '../design/language';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { Txt, useFrame } from '../design/frame';
import { UIIcon } from '../design/icons';
import { MiniSlide } from '../design/SlideCard';
import { F } from '../design/tokens';
import { useTheme } from '../design/theme';
import { Chip, Dialog, RecordButton, RecordRing, type RecordGlyph } from '../design/ui';
import { paceChip } from '../domain/analysis';
import { fmt } from '../domain/format';
import type { DeckModel } from '../features/presentations/useDeckModel';
import { cueState, type ProfileState } from '../features/presentations/slideProfiles';

// Structural types so this file needs nothing private from RehearseScreen.tsx; its LiveStore and Phase fit them.
type LiveSnapshot = { E: number; recStart: number };
type LiveSource = { get(): LiveSnapshot; subscribe(f: () => void): () => void };

const REC = 56;          // record button in the dock: the 84 dp RecordButton drawn at 2/3
const REC_SCALE = REC / 84;
const ARROW = 48;        // side-wall arrows (unchanged size)
const DOCK_PAD = 12;     // dock row sits this far above the bottom safe area
const BAR_GAP = 14;      // progress bar sits this far above the dock row
const BAR_H = 4;
const SHADE_H = 140;     // the only shading, under the dock
const TOP_ROW = 34;      // timer row above the slide when cues are open

function BottomShade() {
  return <Svg pointerEvents="none" width="100%" height={SHADE_H} style={styles.shade}>
    <Defs><LinearGradient id="olDockShade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000000" stopOpacity={0} /><Stop offset="1" stopColor="#000000" stopOpacity={0.74} /></LinearGradient></Defs>
    <Rect x={0} y={0} width="100%" height={SHADE_H} fill="url(#olDockShade)" />
  </Svg>;
}
function ExitIcon() {
  // Exit full screen: four corners pointing in.
  return <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
    <Path d="M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function LandscapeRehearse({model,live,slide,phase:_phase,glyph,btnLabel,recording,take:_take,disabled,onRecord,onRecordDown,onRecordUp,onExit,onPrevious,onNext,cueState:profile,cueBusy,onCueRecovery,onReview,reviewEnabled,liveFeedback,comparePending,redoAsk,onConfirmRedo,onCancelRedo,ringProgress,ringVisible,externalCorners=false,cues:controlledCues,onCuesChange}:{
  model:DeckModel;live:LiveSource;slide:number;phase:string;glyph:RecordGlyph;btnLabel:string;recording:boolean;take:boolean;disabled:boolean;
  onRecord:()=>void;onRecordDown:()=>void;onRecordUp:()=>void;onExit:()=>void;onPrevious:()=>void;onNext:()=>void;
  cueState:ProfileState|null;cueBusy:boolean;onCueRecovery:()=>void;onReview:()=>void;redoAsk:false|'slide'|'all';onConfirmRedo:()=>void;onCancelRedo:()=>void;
  reviewEnabled:boolean;liveFeedback:boolean;comparePending:boolean;
  ringProgress:SharedValue<number>;ringVisible:SharedValue<number>;externalCorners?:boolean;cues?:boolean;onCuesChange?:(open:boolean)=>void;
}){
  const ui=useUiText();
  const {c}=useTheme();
  const frame=useFrame();
  const {width,height}=frame;
  const portraitInsets=useSafeAreaInsets();
  // The app stays portrait while Frame rotates the canvas clockwise. Only controls avoid system bars.
  const insets={left:Math.max(0,portraitInsets.top-frame.top)/frame.s,right:Math.max(0,portraitInsets.bottom-frame.top)/frame.s,
    top:Math.max(0,portraitInsets.right-frame.left)/frame.s,bottom:Math.max(0,portraitInsets.left-frame.left)/frame.s};
  const [controls,setControls]=useState(true),[localCues,setLocalCues]=useState(false);
  const cues=controlledCues??localCues;
  const setCues=(value:boolean)=>{setLocalCues(value);onCuesChange?.(value);setControls(true);};
  const liveValue=useSyncExternalStore(live.subscribe,live.get);
  useEffect(()=>{
    if(!recording||cues||!controls)return;
    const timer=setTimeout(()=>setControls(false),3000);
    return()=>clearTimeout(timer);
  },[recording,slide,cues,controls]);
  const controlsVisible=controls||!recording||cues;
  const controlsOpacity=useSharedValue(controlsVisible?1:0);
  const controlsMotion=useAnimatedStyle(()=>({opacity:controlsOpacity.value}));
  useEffect(()=>{controlsOpacity.set(withTiming(controlsVisible?1:0,{duration:300,easing:Easing.inOut(Easing.quad)}));},[controlsOpacity,controlsVisible]);
  const must=cueState(profile,slide,'must_cover'),deeper=cueState(profile,slide,'go_deeper');
  const cuePanelWidth=Math.min(width*0.46,390);
  const cueWidth=cues?cuePanelWidth:0;
  const cueProgress=useSharedValue(cues?1:0);
  const cuePanelMotion=useAnimatedStyle(()=>({opacity:cueProgress.value,transform:[{translateX:cuePanelWidth*(1-cueProgress.value)}]}),[cuePanelWidth]);
  useEffect(()=>{cueProgress.set(withTiming(cues?1:0,{duration:240,easing:Easing.out(Easing.cubic)}));},[cueProgress,cues]);

  // ── Layout (design units of the rotated frame) ──
  const rowTop=height-insets.bottom-DOCK_PAD-REC;                 // dock row, REC high
  const barTop=rowTop-BAR_GAP-BAR_H;                              // slide progress bar
  const topRow=insets.top+6;                                      // timer row (cues open only)
  const cardLeft=cues?20:68;
  const cardRight=cues?cueWidth+12:12;
  const maxCardWidth=Math.max(120,width-cardLeft-cardRight);
  const maxCardHeight=cues?Math.max(100,barTop-12-(topRow+TOP_ROW)):Math.max(100,height);
  const cardWidth=Math.min(maxCardWidth,maxCardHeight*16/9);
  const cardHeight=cardWidth*9/16;
  const cardTop=cues?topRow+TOP_ROW:Math.max(0,(height-cardHeight)/2);
  const areaRight=width-cueWidth;                                 // controls stay left of the cue panel
  const controlCenter=cues?(cardLeft+areaRight)/2:width/2;
  const recLeft=controlCenter-REC/2;
  const arrowTop=cues?rowTop+(REC-ARROW)/2:(height-ARROW)/2-16;   // walls: a little above centre, clear of the dock
  const sideLeft=Math.max(24,insets.left+16), sideRight=Math.max(24,insets.right+16);
  const pace=recording?paceChip(liveValue.E,slide,liveValue.recStart,model.deck.targets):null;
  const count=`${slide+1}/${model.n}`;
  const segments=model.times.map((seconds,i)=><View key={i} style={[styles.segment,{backgroundColor:i===slide?c.accent:seconds>0?c.ink55:c.track}]}/>);
  const panelText=(items:ReturnType<typeof cueState>)=>items.cues.slice(0,4);
  const review=<Pressable accessibilityRole="button" accessibilityLabel={ui(liveFeedback?'Show live feedback progress':comparePending?'Compare takes':'Review overall feedback')}
    disabled={!reviewEnabled} onPress={onReview} style={[styles.review,{backgroundColor:c.glass,opacity:reviewEnabled?1:0.45}]}>
    <Txt style={styles.reviewText}>{liveFeedback?'Feedback so far':comparePending?'Compare':'Review'}</Txt></Pressable>;

  return <View style={[StyleSheet.absoluteFill,{backgroundColor:'#000000'}]}>
    <StatusBar hidden />
    <Pressable accessibilityRole="button" accessibilityLabel={ui("Show or hide rehearsal controls")} onPress={()=>setControls(v=>!v)}
      style={{position:'absolute',left:cardLeft,top:cardTop,width:cardWidth,height:cardHeight,alignItems:'center',justifyContent:'center',overflow:'hidden',borderRadius:6}}>
      <MiniSlide hue={model.deck.hue} page={model.deck.pages[slide]} title={model.deck.slides[slide]?.title??''} width={cardWidth} height={cardHeight} radius={6}/>
    </Pressable>

    <Animated.View pointerEvents={controlsVisible?'auto':'none'} accessibilityElementsHidden={!controlsVisible}
      importantForAccessibility={controlsVisible?'auto':'no-hide-descendants'} style={[StyleSheet.absoluteFill,controlsMotion]}>
      {!cues&&<BottomShade/>}
      {/* Arrows: side walls; with cues open they flank record under the slide. */}
      <Pressable accessibilityRole="button" accessibilityLabel={ui("Previous slide")} disabled={slide===0||disabled} onPress={onPrevious}
        style={[styles.arrow,{left:cues?controlCenter-108-ARROW/2:insets.left+8,top:arrowTop,backgroundColor:c.glass,opacity:slide===0?0.35:1}]}><Txt style={styles.arrowText}>‹</Txt></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={ui("Next slide")} disabled={slide>=model.n-1||disabled} onPress={onNext}
        style={[styles.arrow,cues?{left:controlCenter+108-ARROW/2}:{right:insets.right+8},{top:arrowTop,backgroundColor:c.glass,opacity:slide>=model.n-1?0.35:1}]}><Txt style={styles.arrowText}>›</Txt></Pressable>

      {/* Progress bar just above the dock. */}
      <View style={[styles.progress,{top:barTop,left:cues?cardLeft:sideLeft,right:cues?cueWidth+12:sideRight}]}>{segments}</View>

      {/* Ring only for the 3-2-1 and hold-to-redo-all. */}
      {!recording&&<RecordRing progress={ringProgress} visible={ringVisible} size={REC+20} style={{position:'absolute',left:recLeft-10,top:rowTop-10}}/>}
      <RecordButton quiet glyph={glyph} label={btnLabel} onPress={()=>{if(!recording)setControls(true);onRecord();}} onPressIn={onRecordDown} onPressOut={onRecordUp} disabled={disabled}
        style={{position:'absolute',left:recLeft-(84-REC)/2,top:rowTop-(84-REC)/2,width:84,height:84,borderRadius:42,transform:[{scale:REC_SCALE}]}}/>

      {/* Timer + pace: left of the dock, or above the slide when cues are open. */}
      <View pointerEvents="none" style={[styles.readout,cues?{left:insets.left+70,top:topRow}:{left:sideLeft,top:rowTop+(REC-30)/2}]}>
        <Txt style={styles.elapsed}>{`${fmt(liveValue.E)} / ${fmt(model.deck.target)}`}</Txt>
        {cues&&<Txt style={styles.count}>{`· ${count}`}</Txt>}
        {pace&&<Chip chip={pace} size={14}/>}
      </View>

      {cues
        ? <>
            {/* Cues open: Review top-right of the slide area; exit at the end of the prev · record · next row. */}
            <View style={[styles.cueTop,{top:topRow-7,right:cueWidth+12}]}>{review}</View>
            {!externalCorners&&<Pressable accessibilityRole="button" accessibilityLabel={ui("Return to portrait rehearsal")} onPress={onExit}
              style={[styles.iconButton,{left:areaRight-12-48,top:rowTop+(REC-48)/2}]}><ExitIcon/></Pressable>}
          </>
        : <View style={[styles.dockRight,{right:insets.right+12,top:rowTop+(REC-48)/2}]}>
            {review}
            <Txt style={styles.count}>{count}</Txt>
            {!externalCorners&&<Pressable accessibilityRole="button" accessibilityLabel={ui("Open cue panel")} onPress={()=>setCues(true)} style={styles.iconButtonInline}><UIIcon name="i-bubble" size={24} color="#FFFFFF"/></Pressable>}
            {!externalCorners&&<Pressable accessibilityRole="button" accessibilityLabel={ui("Return to portrait rehearsal")} onPress={onExit} style={styles.iconButtonInline}><ExitIcon/></Pressable>}
          </View>}
    </Animated.View>

    {/* Controls hidden while recording: red-dot timer and a thin progress line. */}
    {!controlsVisible&&recording&&<>
      <View style={[styles.recordingPill,{left:insets.left+70,top:insets.top+16}]}><View style={styles.redDot}/><Txt style={styles.pillTime}>{fmt(liveValue.E)}</Txt></View>
      <View pointerEvents="none" style={[styles.thinProgress,{bottom:0}]}>{model.times.map((seconds,i)=><View key={i} style={[styles.thinSegment,{backgroundColor:i===slide?c.accent:seconds>0?c.ink55:c.track}]}/>)}</View>
    </>}

    <Animated.View pointerEvents={cues?'auto':'none'} accessibilityElementsHidden={!cues} importantForAccessibility={cues?'auto':'no-hide-descendants'}
      style={[styles.cuePanel,{width:cuePanelWidth,paddingTop:Math.max(insets.top+12,20),paddingBottom:Math.max(insets.bottom+12,20),paddingRight:insets.right+20,backgroundColor:c.dialog,borderColor:c.hair},cuePanelMotion]}>
      <View style={styles.cueHeading}><Txt numberOfLines={1} style={[styles.cueTitle,{color:c.text}]}>{`Slide ${slide+1} cues`}</Txt><Pressable accessibilityRole="button" accessibilityLabel={ui("Close cues")} onPress={()=>setCues(false)} style={styles.cueClose}><Txt style={{color:c.text,fontSize:27,lineHeight:30}}>×</Txt></Pressable></View>
      <ScrollView contentContainerStyle={{gap:18,paddingBottom:20}}>
        <View style={{gap:8}}><Txt style={[styles.cueKind,{color:c.accent}]}>MUST COVER</Txt>
          {panelText(must).map((cue,i)=><View key={i} style={styles.cueRow}><View style={[styles.cueBullet,{backgroundColor:c.accent}]}/><View style={{flex:1,gap:4}}><Txt verbatim style={[styles.cueStrong,{color:c.text}]}>{cue.text}</Txt>{'information_needed' in cue&&!!cue.information_needed&&<Txt verbatim style={[styles.cueText,{color:c.secondary}]}>{cue.information_needed}</Txt>}</View></View>)}
          {!must.cues.length&&<Txt style={[styles.cueText,{color:c.secondary}]}>{cueBusy?'Cues are on the way':must.message||'No cues yet'}</Txt>}</View>
        <View style={{gap:8}}><Txt style={[styles.cueKind,{color:c.secondary}]}>FURTHER INSIGHT</Txt>
          {panelText(deeper).map((cue,i)=><View key={i} style={styles.cueRow}><View style={[styles.cueBullet,{backgroundColor:c.secondary}]}/><View style={{flex:1,gap:4}}><Txt verbatim style={[styles.cueStrong,{color:c.text}]}>{cue.text}</Txt>{'information_needed' in cue&&!!cue.information_needed&&<Txt verbatim style={[styles.cueText,{color:c.secondary}]}>{cue.information_needed}</Txt>}</View></View>)}
          {!deeper.cues.length&&<Txt style={[styles.cueText,{color:c.secondary}]}>{deeper.message||'No further cues yet'}</Txt>}</View>
        <Pressable accessibilityRole="button" onPress={onCueRecovery} style={styles.refresh}><Txt style={{color:c.secondary}}>Refresh cues</Txt></Pressable>
      </ScrollView>
    </Animated.View>
    {redoAsk&&<Dialog title={redoAsk==='all'?'Redo all slides?':`Redo slide ${slide+1}?`}
      body={redoAsk==='all'?'Your current take stays, so you can compare and keep either one.':`Your recording and transcript for slide ${slide+1} will be replaced. This can’t be undone.`}
      confirm={redoAsk==='all'?'Redo all':`Redo slide ${slide+1}`} onConfirm={onConfirmRedo} onCancel={onCancelRedo}
      style={{left:24,right:24,top:'50%',marginTop:-116}} />}
  </View>;
}

const styles=StyleSheet.create({
  shade:{position:'absolute',left:0,right:0,bottom:0},
  arrow:{position:'absolute',width:ARROW,height:ARROW,borderRadius:ARROW/2,alignItems:'center',justifyContent:'center'},
  arrowText:{fontFamily:F.medium,fontSize:38,lineHeight:42,color:'#FFFFFF'},
  progress:{position:'absolute',height:BAR_H,flexDirection:'row',gap:3},
  segment:{flex:1,minWidth:2,borderRadius:3},
  readout:{position:'absolute',height:30,flexDirection:'row',alignItems:'center',gap:10},
  elapsed:{fontFamily:F.display,fontSize:16,color:'#FFFFFF',fontVariant:['tabular-nums']},
  count:{fontFamily:F.semibold,fontSize:15,color:'rgba(255,255,255,0.8)',fontVariant:['tabular-nums']},
  dockRight:{position:'absolute',height:48,flexDirection:'row',alignItems:'center',gap:4},
  cueTop:{position:'absolute',height:40,justifyContent:'center'},
  review:{height:40,paddingHorizontal:14,borderRadius:20,justifyContent:'center',marginRight:6},
  reviewText:{color:'#FFFFFF',fontFamily:F.semibold,fontSize:14.5},
  iconButton:{position:'absolute',width:48,height:48,alignItems:'center',justifyContent:'center'},
  iconButtonInline:{width:48,height:48,alignItems:'center',justifyContent:'center'},
  recordingPill:{position:'absolute',height:34,paddingHorizontal:12,borderRadius:17,backgroundColor:'rgba(0,0,0,0.58)',flexDirection:'row',alignItems:'center',gap:8},
  redDot:{width:9,height:9,borderRadius:5,backgroundColor:'#E0414B'},
  pillTime:{fontFamily:F.semibold,fontSize:16,color:'#FFFFFF',fontVariant:['tabular-nums']},
  thinProgress:{position:'absolute',left:0,right:0,height:3,flexDirection:'row',gap:2},
  thinSegment:{flex:1,minWidth:2,borderRadius:2},
  cuePanel:{position:'absolute',right:0,top:0,bottom:0,paddingHorizontal:20,borderLeftWidth:1},
  cueHeading:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  cueTitle:{fontFamily:F.display,fontSize:20,lineHeight:26,flex:1},
  cueClose:{width:40,height:44,alignItems:'center',justifyContent:'center'},
  cueKind:{fontFamily:F.bold,fontSize:13.5,letterSpacing:0.7},
  cueRow:{flexDirection:'row',alignItems:'flex-start',gap:12},
  cueBullet:{width:8,height:8,borderRadius:4,marginTop:7},
  cueStrong:{fontFamily:F.semibold,fontSize:15.5,lineHeight:21},
  cueText:{fontFamily:F.medium,fontSize:14.5,lineHeight:20},
  refresh:{minHeight:40,alignItems:'center',justifyContent:'center'},
});
