import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { EASE_SCREEN, F } from '../design/tokens';
import { BACK_FADE_Y } from '../domain/gestures';
import { useTheme } from '../design/theme';
import { HintRow, PageSurface } from '../design/ui';
import { fmt } from '../domain/format';
import { audioOf } from '../features/rehearsal/analysis';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel } from '../features/presentations/useDeckModel';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
// Claude Code, prompted by Seoyeon (2026-11-15): v3 priorities and improvements; see docs/ai-feedback-reimplementation.md.
import { useRunScores } from '../features/feedback/useRunFeedbackV3';
import { runCards, unquote, type V3Card } from '../features/feedback/feedbackRun';
import { scoreAudioEvidence } from '../features/feedback/presentationScoreDisplay';
import type { ScoreAdvice, ScoreEvidence } from '../features/feedback/presentationScore';
import type { Finding } from '../features/feedback/slideReview';
import { useBack, useShell } from './shared';
import { SWIPE_ENTRY_X, useHorizontalSwipeMotion } from './swipeMotion';

// Supplied Claude-generated patch, integrated by OpenAI Codex for Iteration 2 (2026-11-20): two fixed regions (what is wrong + you said ·
// try saying | do this). Text longer than its box ends in "…"; tapping a region opens the whole point full screen.
export function FeedbackScreen({active=true}:{active?:boolean}) {
  const {c}=useTheme(),{go,nav}=useShell(),frame=useFrame();
  // OpenAI Codex, 2026-11-19: preserve horizontal point swipes and fade on downward return.
  // OpenAI Codex Q&A-matched feedback swipes: docs/ai-collaboration-prompts-iteration-2.md#match-feedback-swipes-to-qa
  const fadeY=useSharedValue(0);
  const swipe=useHorizontalSwipeMotion({slideOnly:true,active});
  const swipeFade=useAnimatedStyle(()=>({opacity:Math.max(0,1-fadeY.value/BACK_FADE_Y)}));
  const model=useDeckModel(nav.deckId),runScores=useRunScores(model,active),v3=runScores.v3;
  const feedback=useRunFeedbackStatus(model,active&&!v3),scores=runScores.v2;
  const player=useSegmentPlayer();
  const v3Cards=v3?runCards(v3.items,v3.overall):null;
  const points=useMemo<FeedbackPoint[]>(()=>v3Cards?v3Cards.map(card=>({kind:'v3' as const,card})):[
    ...feedback.items.flatMap(item=>item.findings.map(finding=>({kind:'slide' as const,slide:item.slide,finding})).filter(x=>x.finding.suggestion.trim())),
    ...(scores.overall.result?.feedback.improvements??[]).map(advice=>({kind:'score' as const,advice})),
  ],[v3Cards,feedback.items,scores.overall.result]);
  const [index,setIndex]=useState(0);
  const currentIndex=Math.min(index,Math.max(0,points.length-1));
  const point=points[currentIndex];
  const [detail,setDetail]=useState(false);
  // Which clamped texts on this page did not fit (keyed by field); reset when the point changes.
  const [cut,setCut]=useState<{index:number;keys:string[]}>({index:-1,keys:[]});
  const [quoteMeasure,setQuoteMeasure]=useState<{index:number;lines:number}>({index:-1,lines:0});
  const markCut=(key:string)=>(over:boolean)=>setCut(prev=>{
    const keys=prev.index===currentIndex?prev.keys:[];
    if(over===keys.includes(key))return prev.index===currentIndex?prev:{index:currentIndex,keys};
    return {index:currentIndex,keys:over?[...keys,key]:keys.filter(k=>k!==key)};
  });
  const back=()=>{swipe.cancel();player.stop();go('full',{deckId:nav.deckId,sel:nav.sel});};
  useBack(active,()=>{if(detail)setDetail(false);else back();return true;});
  const turn=(direction:-1|1)=>{
    if(points.length<2){swipe.settle();return;}
    const target=(currentIndex+direction+points.length)%points.length;
    player.stop();
    swipe.exitTo(-direction*390,()=>{setIndex(target);swipe.enterFrom(direction*SWIPE_ENTRY_X);});
  };
  const playEvidence=(refs:readonly ScoreEvidence[])=>{
    const key=`feedback-score:${currentIndex}`;
    if(player.playingKey===key){player.setPaused(!player.paused);return;}
    const segments=scoreAudioEvidence(refs).flatMap(ref=>{
      const uri=audioOf(ref.attempt_id);
      return uri?[{uri,startMs:ref.start_ms,endMs:ref.end_ms}]:[];
    });
    if(segments.length)void player.playSegments(key,segments);
  };
  const playCard=(card:V3Card)=>{
    const uri=card.attemptId&&audioOf(card.attemptId),e=card.evidence;
    if(!uri||!e)return;
    const key=`feedback-v3:${card.key}`;
    if(player.playingKey===key){player.setPaused(!player.paused);return;}
    void player.playSegments(key,[{uri,startMs:e.start_ms,endMs:e.end_ms}]);
  };
  const play=(finding:Finding,slide:number)=>{
    const part=model?.state.run?.parts[slide],uri=part&&audioOf(part.attemptId);
    if(!part||!uri||finding.end_ms<=finding.start_ms)return;
    const key=`feedback:${part.attemptId}:${finding.start_ms}`;
    if(player.playingKey===key){player.setPaused(!player.paused);return;}
    void player.playSegments(key,[{uri,startMs:finding.start_ms,endMs:finding.end_ms}]);
  };
  if(!model?.state.run)return null;
  const slideLabel=(slide:number|null)=>slide===null?'Whole presentation':`Slide ${slide+1} · ${model.deck.slides[slide]?.title??`Slide ${slide+1}`}`;
  const view:PointView|null=!point?null:point.kind==='v3'?{
    chip:`${v3?.outdated?'Outdated · ':''}${slideLabel(point.card.slide)}`,gain:point.card.gain,headline:point.card.headline||point.card.title,
    category:point.card.criterion,explanation:point.card.explanation,example:point.card.example,steps:point.card.steps,overLimit:point.card.overLimit,
    said:point.card.evidence?{text:point.card.evidence.text,startMs:point.card.evidence.start_ms,key:`feedback-v3:${point.card.key}`,play:()=>playCard(point.card)}:null,
  }:point.kind==='slide'?{
    chip:slideLabel(point.slide),gain:null,headline:headline(point.finding),category:point.finding.category,explanation:[],example:'',steps:[point.finding.suggestion],overLimit:false,
    said:point.finding.speech_quote?{text:point.finding.speech_quote,startMs:point.finding.start_ms,key:`feedback:${model.state.run.parts[point.slide]?.attemptId}:${point.finding.start_ms}`,play:()=>play(point.finding,point.slide)}:null,
  }:{
    chip:'Whole presentation · Overall score',gain:null,headline:'One change to make',category:null,explanation:[],example:'',steps:[point.advice.text],overLimit:false,
    said:scoreQuote(point.advice)?{text:scoreQuote(point.advice)!.quote,startMs:scoreQuote(point.advice)!.start_ms,key:`feedback-score:${currentIndex}`,play:()=>playEvidence(point.advice.evidence)}:null,
  };
  const count=points.length?`${currentIndex+1} of ${points.length}`:'No reviewed points';
  const keys=cut.index===currentIndex?cut.keys:[];
  const maxWhy=view?.said?2:3;
  // OpenAI Codex, 2026-11-20: show the actual feedback title, including legacy detail, within a bounded text area.
  const cardHeadline=view?.headline??'';
  const koreanHeadline=/[\uac00-\ud7a3]/.test(cardHeadline);
  const headlineSize=koreanHeadline
    ? cardHeadline.length<=11?26:cardHeadline.length<=18?23:cardHeadline.length<=28?20:cardHeadline.length<=40?18:16
    : cardHeadline.length<=24?26:cardHeadline.length<=48?23:cardHeadline.length<=80?20:cardHeadline.length<=120?18:16;
  const cardFontSize=frame.compact?Math.min(24,headlineSize):headlineSize;
  const cardLineHeight=cardFontSize+6;
  const truncated=!!view&&(view.overLimit||keys.length>0||view.explanation.length>maxWhy||view.steps.length>2);
  const r=regions(frame.compact?760:844),quoteLines=frame.compact?2:3;
  // Reserve measured quote space and visible explanation bullets before giving the title the remaining lines.
  const headlineLines=view?headlineLineBudget(r.r1[1]-r.r1[0],
    view.said?(quoteMeasure.index===currentIndex?Math.min(quoteLines,quoteMeasure.lines):quoteLines):0,
    Math.min(maxWhy,view.explanation.length),cardLineHeight,frame.compact):2;
  const playing=(key:string)=>player.playingKey===key&&!player.paused;
  const open=truncated?()=>{setDetail(true);}:undefined;
  return <><Enter kind={nav.nav}><PanView style={[StyleSheet.absoluteFill,swipeFade]}
    onMoveShould={(_e,g)=>!detail&&((Math.abs(g.dx)>18&&Math.abs(g.dx)>Math.abs(g.dy))||(g.dy>12&&g.dy>Math.abs(g.dx)))}
    onMove={(_e,g)=>{if(Math.abs(g.dx)>Math.abs(g.dy)){swipe.move(g.dx/frame.s);fadeY.set(0);}else{swipe.settle();fadeY.set(Math.max(0,Math.min(BACK_FADE_Y,g.dy)));}}}
    onRelease={(_e,g)=>{if(Math.abs(g.dx)>Math.abs(g.dy)&&g.dx/frame.s < -60)turn(1);else if(Math.abs(g.dx)>Math.abs(g.dy)&&g.dx/frame.s > 60)turn(-1);else if(g.dy>90)fadeY.set(withTiming(BACK_FADE_Y,{duration:460,easing:EASE_SCREEN},done=>{if(done)runOnJS(back)();}));else {swipe.settle();fadeY.set(withTiming(0,{duration:360,easing:EASE_SCREEN}));}}}
    onTerminate={()=>{swipe.settle();fadeY.set(withTiming(0,{duration:360,easing:EASE_SCREEN}));}}>
    <PageSurface hue={model.deck.hue}/>
    <Animated.View style={[StyleSheet.absoluteFill,swipe.style]}>
    {view?<>
      {/* Region 1 · what is wrong, with what was said pinned to the bottom. Keyed by point so each text is measured afresh. */}
      <Pressable key={`r1-${currentIndex}`} disabled={!open} onPress={open} accessibilityRole={open?'button':undefined} accessibilityHint={open?'Opens the whole point':undefined}
        style={[styles.region1,frame.compact&&styles.region1Compact,{top:r.r1[0],height:r.r1[1]-r.r1[0],backgroundColor:c.surface06,borderColor:c.hair}]}>
        <View style={[styles.chipRow,frame.compact&&styles.chipRowCompact]}>
          <View style={[styles.chip,frame.compact&&styles.chipCompact,{backgroundColor:c.surface08}]}><UIIcon name="i-slides" size={16}/><Txt numberOfLines={1} style={[styles.chipText,{color:c.text}]}>{view.chip}</Txt></View>
          <Txt style={[styles.count,{color:c.tertiary}]}>{count}</Txt>
        </View>
        <View style={styles.topCopy}>
          <Clamp text={cardHeadline} lines={headlineLines}
            style={[styles.headline,frame.compact&&styles.headlineCompact,{color:c.text,fontSize:cardFontSize,lineHeight:cardLineHeight}]} onCut={markCut('headline')}/>
          {view.explanation.length>0&&<View style={[styles.bullets,frame.compact&&styles.bulletsCompact]}>{view.explanation.slice(0,maxWhy).map((t,i)=><Bullet key={i} dot={c.tertiary}>
            <Clamp text={i===maxWhy-1&&view.explanation.length>maxWhy?`${t}…`:t} lines={2} style={[styles.why,{color:c.secondary}]} onCut={markCut(`why${i}`)}/></Bullet>)}</View>}
        </View>
        {view.said&&<View style={[styles.said,frame.compact&&styles.saidCompact,{backgroundColor:c.surface08}]}>
          <View style={[styles.saidHead,frame.compact&&styles.saidHeadCompact]}><Txt style={[styles.kicker,{color:c.tertiary}]}>YOU SAID</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={`Play the cited audio at ${fmt(view.said.startMs/1000)}`} onPress={view.said.play} hitSlop={10} style={styles.play}>
              <Glyph name={playing(view.said.key)?'p-pause':'p-play'} size={14} color={c.accent}/><Txt style={[styles.playText,{color:c.accent}]}>{fmt(view.said.startMs/1000)}</Txt></Pressable></View>
          <Clamp text={`“${view.said.text}”`} lines={quoteLines} style={[styles.quote,{color:c.body}]} onCut={markCut('said')}
            onLines={lines=>setQuoteMeasure(prev=>prev.index===currentIndex&&prev.lines===lines?prev:{index:currentIndex,lines})}/>
        </View>}
        <View style={[styles.categoryRow,frame.compact&&styles.categoryRowCompact]}><Txt style={[styles.categoryTag,{color:c.secondary,backgroundColor:c.surface08}]}>{categoryLabel(view.category)}</Txt></View>
      </Pressable>
      {/* Region 2 · try saying, a split line half-way down, then do this. */}
      <Pressable key={`r2-${currentIndex}`} disabled={!open} onPress={open} accessibilityRole={open?'button':undefined} accessibilityHint={open?'Opens the whole point':undefined}
        style={[styles.region2,{top:r.r2[0],height:r.r2[1]-r.r2[0],backgroundColor:c.accentSoft,borderColor:c.accent}]}>
        {!!view.example&&<View style={[styles.half,{top:14,height:(r.r2[1]-r.r2[0])/2-14}]}>
          <View style={styles.tryHead}><Txt style={[styles.kicker,{color:c.accent}]}>SAY:</Txt>
            {!!view.gain&&<Txt style={[styles.gain,{color:c.accent,backgroundColor:c.accentSoft}]}>{`+${view.gain} pts`}</Txt>}</View>
          <Clamp text={`“${unquote(view.example)}”`} lines={3} style={[styles.example,{color:c.text}]} onCut={markCut('example')}/>
        </View>}
        {!!view.example&&<View style={[styles.split,{top:(r.r2[1]-r.r2[0])/2,backgroundColor:c.accent}]}/>}
        <View style={[styles.half,{top:view.example?(r.r2[1]-r.r2[0])/2+12:14,bottom:frame.compact?10:14}]}>
          <View style={styles.tryHead}><Txt style={[styles.kicker,{color:c.accent}]}>TRY:</Txt>
            {!view.example&&!!view.gain&&<Txt style={[styles.gain,{color:c.accent,backgroundColor:c.accentSoft}]}>{`+${view.gain} pts`}</Txt>}</View>
          <View style={styles.stepList}>{view.steps.slice(0,2).map((t,i)=><Bullet key={i} dot={c.accent}>
            <Clamp text={i===1&&view.steps.length>2?`${t}…`:t} lines={view.example?2:3} style={[styles.step,{color:c.text}]} onCut={markCut(`step${i}`)}/></Bullet>)}</View>
        </View>
      </Pressable>
    </>:<View style={[styles.empty,{top:r.r1[0],backgroundColor:c.surface06,borderColor:c.hair}]}><Txt style={[styles.count,{color:c.tertiary}]}>{count}</Txt><Txt style={[styles.quote,{color:c.secondary}]}>{v3?'Ways to raise your score appear here when the AI review is ready.':'Verified feedback points will appear here when a slide review is available.'}</Txt></View>}
    <View style={styles.dots}>{points.map((_,i)=><View key={i} style={[styles.dot,i===currentIndex?styles.activeDot:{backgroundColor:c.dotOff},i===currentIndex&&{backgroundColor:c.text}]}/>)}</View>
    </Animated.View>
    {detail&&view&&<FeedbackDetail view={view} count={count} playing={playing} onClose={()=>setDetail(false)}/>}
  </PanView></Enter>
  {/* OpenAI Codex, 2026-11-20: pin gesture cues while feedback cards swipe or fade. */}
  {/* Supplied Claude patch, Codex integration 2026-11-20: Read all joins pinned cues when text is cut. */}
  {active&&!detail&&<HintRow hints={[...(truncated?[{icon:'h-tap' as const,text:'Read all',onPress:open}]:[]),{icon:'h-spin',text:'Next point'},{icon:'h-dn',text:'Back to review',nudge:'down'}]}/>}
  </>;
}

type PointView={chip:string;gain:number|null;headline:string;category:string|null;explanation:string[];example:string;steps:string[];overLimit:boolean;
  said:{text:string;startMs:number;key:string;play:()=>void}|null};
type FeedbackPoint = {kind:'slide';slide:number;finding:Finding}|{kind:'score';advice:ScoreAdvice}|{kind:'v3';card:V3Card};

/** Region 1 takes 54% of the space between the top (46) and the page dots; region 2 the rest. */
export function regions(frameHeight:number){
  const top=46,bottom=frameHeight-86-6-16,avail=bottom-top-12,r1=Math.round(avail*0.54);
  return {r1:[top,top+r1] as const,r2:[top+r1+12,bottom] as const};
}

function headlineLineBudget(regionHeight:number,quoteLines:number,bullets:number,lineHeight:number,compact:boolean){
  // Include the actual visible bullet count, quote, category tag and gaps; overflow stays inside topCopy.
  const reserved=compact
    ? 14+10+28+6+4+20+(quoteLines?16+18+4+quoteLines*22:0)
    : 16+12+30+8+4+24+(quoteLines?20+18+6+quoteLines*22:0);
  const bulletHeight=bullets?bullets*40+(bullets-1)*(compact?4:6)+(compact?2:4):0;
  return Math.max(2,Math.floor((regionHeight-reserved-bulletHeight)/lineHeight));
}

/** Text clamped to `lines`, ending in "…"; a hidden unclamped copy reports whether it was cut. */
function Clamp({text,lines,style,onCut,onLines}:{text:string;lines:number;style:StyleProp<TextStyle>;onCut:(cut:boolean)=>void;onLines?:(lines:number)=>void}){
  const last=useRef<boolean|null>(null);
  const lastLines=useRef<number|null>(null);
  const report=(n:number)=>{
    const over=n>lines;
    if(last.current!==over){last.current=over;onCut(over);}
    const shown=Math.min(n,lines);
    if(onLines&&lastLines.current!==shown){lastLines.current=shown;onLines(shown);}
  };
  return <View>
    <Txt numberOfLines={lines} ellipsizeMode="tail" style={style}>{text}</Txt>
    <Txt aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
      style={[style,styles.measure]} onTextLayout={e=>report(e.nativeEvent.lines.length)}>{text}</Txt>
  </View>;
}
function Bullet({dot,children}:{dot:string;children:ReactNode}){
  return <View style={styles.bullet}><View style={[styles.dotMark,{backgroundColor:dot}]}/><View style={styles.flex}>{children}</View></View>;
}

/** The whole point, nothing cut: opened by tapping a region whose text ends in "…". */
function FeedbackDetail({view,count,playing,onClose}:{view:PointView;count:string;playing:(key:string)=>boolean;onClose:()=>void}){
  const {c}=useTheme();
  const scrollY=useRef(0);
  return <View style={[StyleSheet.absoluteFill,styles.detail,{backgroundColor:c.bg}]} accessibilityViewIsModal>
    <PanView style={StyleSheet.absoluteFill} onMoveShould={(_e,g)=>scrollY.current<=0&&g.dy>12&&g.dy>Math.abs(g.dx)}
      onRelease={(_e,g)=>{if(g.dy>90)onClose();}}>
      <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={styles.detailBody} onScroll={e=>{scrollY.current=e.nativeEvent.contentOffset.y;}} scrollEventThrottle={32}>
        <View style={styles.chipRow}>
          <View style={[styles.chip,{backgroundColor:c.surface08}]}><UIIcon name="i-slides" size={16}/><Txt style={[styles.chipText,{color:c.text}]}>{view.chip}</Txt></View>
          <Txt style={[styles.count,{color:c.tertiary}]}>{count}</Txt>
        </View>
        <Txt style={[styles.headline,{color:c.text}]}>{view.headline}</Txt>
        {view.explanation.length>0&&<View style={styles.bullets}>{view.explanation.map((t,i)=><Bullet key={i} dot={c.tertiary}><Txt style={[styles.why,{color:c.secondary}]}>{t}</Txt></Bullet>)}</View>}
        {view.said&&<View style={[styles.said,styles.detailBlock,{backgroundColor:c.surface08}]}>
          <View style={styles.saidHead}><Txt style={[styles.kicker,{color:c.tertiary}]}>YOU SAID</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={`Play the cited audio at ${fmt(view.said.startMs/1000)}`} onPress={view.said.play} hitSlop={10} style={styles.play}>
              <Glyph name={playing(view.said.key)?'p-pause':'p-play'} size={14} color={c.accent}/><Txt style={[styles.playText,{color:c.accent}]}>{fmt(view.said.startMs/1000)}</Txt></Pressable></View>
          <Txt style={[styles.quote,{color:c.body}]}>{`“${view.said.text}”`}</Txt>
        </View>}
        <View style={[styles.detailTry,styles.detailBlock,{backgroundColor:c.accentSoft,borderColor:c.accent}]}>
          {!!view.example&&<><View style={styles.tryHead}><Txt style={[styles.kicker,{color:c.accent}]}>SAY:</Txt>
            {!!view.gain&&<Txt style={[styles.gain,{color:c.accent,backgroundColor:c.accentSoft}]}>{`+${view.gain} pts`}</Txt>}</View>
            <Txt style={[styles.example,{color:c.text}]}>{`“${unquote(view.example)}”`}</Txt>
            <View style={[styles.detailSplit,{backgroundColor:c.accent}]}/></>}
          <Txt style={[styles.kicker,{color:c.accent}]}>TRY:</Txt>
          <View style={styles.bullets}>{view.steps.map((t,i)=><Bullet key={i} dot={c.accent}><Txt style={[styles.step,{color:c.text}]}>{t}</Txt></Bullet>)}</View>
        </View>
      </ScrollView>
      <HintRow hints={[{icon:'h-dn',text:'Close',nudge:'down',onPress:onClose}]}/>
    </PanView>
  </View>;
}

function scoreQuote(advice:ScoreAdvice){
  const speech=scoreAudioEvidence(advice.evidence).find(ref=>ref.kind==='speech');
  return speech?{quote:speech.quote,start_ms:speech.start_ms}:null;
}

function headline(f:Finding){
  if(f.category==='timing')return 'Trim this slide';
  if(f.category==='fillers')return 'Fewer filler words';
  if(f.category==='audience')return 'Clearer for your audience';
  if(f.category==='graph')return 'Explain the visual';
  if(f.category==='delivery')return 'Stronger delivery here';
  if(f.category==='repetition')return 'Same point twice';
  return 'Add the missing point';
}
// OpenAI Codex, 2026-11-20: classify existing rubric/finding IDs without another model call.
const CATEGORY:Record<string,string>={
  essential_coverage:'Coverage',explanation_depth:'Explanation',clarity_relevance:'Clarity',
  structure:'Structure',coherence:'Flow',audience_suitability:'Audience',delivery:'Delivery',
  timing:'Timing',fillers:'Fillers',audience:'Audience',graph:'Visuals',repetition:'Repetition',
};
function categoryLabel(category:string|null){return category?CATEGORY[category]??'Feedback':'Overall';}
const styles=StyleSheet.create({
  flex:{flex:1},
  region1:{position:'absolute',left:24,right:24,borderRadius:28,borderWidth:1,paddingTop:16,paddingHorizontal:20,paddingBottom:12,overflow:'hidden'},
  region1Compact:{paddingTop:14,paddingBottom:10},
  topCopy:{flex:1,minHeight:0,overflow:'hidden',marginBottom:4},
  region2:{position:'absolute',left:24,right:24,borderRadius:28,borderWidth:1.5,overflow:'hidden'},
  chipRow:{height:30,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  chipRowCompact:{height:28},
  chip:{flexShrink:1,minHeight:30,borderRadius:15,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7},chipCompact:{minHeight:28},chipText:{flexShrink:1,fontFamily:F.semibold,fontSize:14},
  count:{fontFamily:F.semibold,fontSize:13.5,fontVariant:['tabular-nums']},
  headline:{marginTop:8,fontFamily:F.display,fontSize:26,lineHeight:32,letterSpacing:-.3},
  headlineCompact:{marginTop:6},
  bullets:{marginTop:4,gap:6},bulletsCompact:{marginTop:2,gap:4},bullet:{flexDirection:'row',alignItems:'flex-start',gap:10},dotMark:{width:5,height:5,borderRadius:3,marginTop:7.5},
  why:{fontFamily:F.medium,fontSize:15,lineHeight:20},
  said:{borderRadius:18,paddingHorizontal:14,paddingVertical:10},saidCompact:{paddingVertical:8},saidHead:{height:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:6},saidHeadCompact:{marginBottom:4},
  categoryRow:{height:20,marginTop:4,alignItems:'flex-end',justifyContent:'center'},categoryRowCompact:{height:18,marginTop:2},categoryTag:{fontFamily:F.semibold,fontSize:11.5,lineHeight:16,paddingHorizontal:8,borderRadius:10,overflow:'hidden'},
  kicker:{fontFamily:F.bold,fontSize:13.5,letterSpacing:1.1},quote:{fontFamily:F.medium,fontSize:16,lineHeight:22},
  play:{flexDirection:'row',alignItems:'center',gap:6},playText:{fontFamily:F.semibold,fontSize:13.5,fontVariant:['tabular-nums']},
  half:{position:'absolute',left:16,right:16,overflow:'hidden'},tryHead:{height:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4},
  stepList:{gap:8},
  gain:{fontFamily:F.bold,fontSize:13,lineHeight:16,paddingHorizontal:9,paddingVertical:2,borderRadius:999,overflow:'hidden'},
  example:{fontFamily:F.semibold,fontSize:18,lineHeight:24},step:{fontFamily:F.medium,fontSize:15,lineHeight:20},
  split:{position:'absolute',left:16,right:16,height:1,opacity:.35},
  measure:{position:'absolute',left:0,right:0,top:0,opacity:0},
  empty:{position:'absolute',left:24,right:24,minHeight:140,borderRadius:28,borderWidth:1,padding:20,gap:12,justifyContent:'center'},
  dots:{position:'absolute',left:0,right:0,bottom:86,flexDirection:'row',justifyContent:'center',gap:6},dot:{width:6,height:6,borderRadius:3},activeDot:{width:18,height:6,borderRadius:3},
  detail:{zIndex:20},detailBody:{paddingTop:46,paddingHorizontal:24,paddingBottom:96},detailBlock:{marginTop:16},
  detailTry:{borderRadius:24,borderWidth:1.5,padding:16},detailSplit:{height:1,opacity:.35,marginVertical:14},
});
