// OpenAI Codex review routing: docs/ai-collaboration/prompt-logs/seoyeon/iteration-2.md#record-137
// AI-assisted Nakajima integration: verified selected-slide feedback in the normal Review page.
// OpenAI Codex compact slide review and scrubber label.
// OpenAI Codex Review exit underlay and duration colours.
// Supplied Claude-generated patch, integrated by OpenAI Codex for Iteration 2 (2026-11-21): every review in full on the
// page (canvas L3); text shrinks to fit; grades and recovery actions on the last page instead of a pop-up.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph } from '../design/icons';
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
// Claude Code, prompted by Seoyeon (2026-11-15): feedback v3 in Review; see docs/ai-feedback-reimplementation.md.
import { useRunScores } from '../features/feedback/useRunFeedbackV3';
import { CODE_REASON_TEXT, levelLabel, slideCards } from '../features/feedback/feedbackRun';
import { scoreLevelColor } from '../features/feedback/presentationScoreDisplay';
import { useRunFeedbackStatus } from '../features/feedback/useRunFeedbackStatus';
import { SlideReviewDetails } from '../features/feedback/SlideReviewDetails';
import { useBack, useNow, useShell } from './shared';
import { SWIPE_ENTRY_X, useHorizontalSwipeMotion } from './swipeMotion';

const EMPTY_SCORE:ScoreDisplay={score:null,level:null,status:'Not graded',state:null,result:null,target:null};

export function ReviewScreen({active=true}:{active?:boolean}) {
 const {nav}=useShell();const model=useDeckModel(nav.deckId);
 const initialX=nav.swipeFrom===undefined||nav.sel===nav.swipeFrom?0:nav.sel>nav.swipeFrom?SWIPE_ENTRY_X:-SWIPE_ENTRY_X;
 // Selection/source changes reset playback and feedback details together.
 return <ReviewContent key={JSON.stringify([nav.deckId,nav.sel,model?.state.run?.parts[nav.sel]])} model={model} active={active} initialX={initialX}/>;
}
function ReviewContent({model,active,initialX}:{model:DeckModel|null;active:boolean;initialX:number}) {
 const {c}=useTheme(),{go,nav}=useShell(),frame=useFrame();
 const n=model?.n??0;
 const s=Math.max(0,Math.min(Math.max(0,n-1),nav.sel));
 const runScores=useRunScores(model,active,s),v3=runScores.v3,v3Item=v3?.items[s]??null,v3Slide=v3Item?.v3??null;
 const feedback=useRunFeedbackStatus(model,active&&!v3),item=feedback.items[s];
 const duration=model?.times[s]??0,allocation=model?.deck.targets[s]??0;
 const spokenText=slideText(model?.lines??[],s);
 const selectedAttempt=model?.state.run?.parts[s]?.attemptId;
 const hasTranscript=!!selectedAttempt&&model?.stages.get(selectedAttempt)==='done'&&!!model.transcripts.get(selectedAttempt)?.words.length;
 const fillerCount=v3Slide?.measurements?v3Slide.measurements.filler_count:duration>0&&hasTranscript&&spokenText.trim()?fillerTotal(spokenText):null;
 const slideReviewRows=compactFeedbackRows(s,item,{durationSeconds:duration,allocationSeconds:allocation,fillerCount});
 const [issueIndex,setIssueIndex]=useState(0);
 const pendingPageEnter=useRef<number|null>(null);
 const findingRows=slideReviewRows.flatMap(row=>row.findings);
 const recorded=!!model?.state.run?.parts[s]?.segments.some(segment=>segment.endMs>segment.startMs);
 const scores=runScores.scores,scoreItem=scores.items[s]??EMPTY_SCORE;
 const player=useSegmentPlayer(),stopPlayback=player.stop;
 const dy=useSharedValue(0),backExiting=useRef(false);
 const swipe=useHorizontalSwipeMotion({slideOnly:true,initialX,active});
 const now=useNow();
 useEffect(()=>{if(!active){pendingPageEnter.current=null;backExiting.current=false;dy.set(0);stopPlayback();}},[active,dy,stopPlayback]);
 useEffect(()=>()=>stopPlayback(),[stopPlayback]);
 const toBack=useCallback(()=>{pendingPageEnter.current=null;swipe.cancel();stopPlayback();go('rehearse',{deckId:nav.deckId,slide:s,sel:s});},[go,nav.deckId,s,stopPlayback,swipe]);
 const toQA=useCallback(()=>{pendingPageEnter.current=null;swipe.cancel();stopPlayback();go('qa',{nav:'fade',deckId:nav.deckId,sel:s,from:'review'});},[go,nav.deckId,s,stopPlayback,swipe]);
 const toFull=useCallback(()=>{pendingPageEnter.current=null;swipe.cancel();stopPlayback();go('full',nav.from==='full'?{deckId:nav.deckId,sel:s}:{deckId:nav.deckId,sel:s,from:'rehearse'});},[go,nav.deckId,nav.from,s,stopPlayback,swipe]);
 useBack(active,()=>{toBack();return true;});
 const pan={
  onMoveShould:(e:GestureResponderEvent,g:PanResponderGestureState)=>{
   const y=(e.nativeEvent.pageY-frame.top)/frame.s;
   return !backExiting.current&&Math.abs(g.dy)>8&&Math.abs(g.dy)>Math.abs(g.dx)&&
    !(y>264&&y<360&&Math.abs(g.dx)>4) || !backExiting.current&&Math.abs(g.dx)>16&&Math.abs(g.dx)>Math.abs(g.dy);
  },
  onMove:(_e:GestureResponderEvent,g:PanResponderGestureState)=>{if(Math.abs(g.dx)>Math.abs(g.dy)){swipe.move(g.dx/frame.s);dy.set(0);}else{swipe.cancel();dy.set(Math.max(-BACK_FADE_Y,Math.min(BACK_FADE_Y,g.dy/frame.s)));}},
  onRelease:(_e:GestureResponderEvent,g:PanResponderGestureState)=>{
   if(Math.abs(g.dx/frame.s)>48&&Math.abs(g.dx)>Math.abs(g.dy)){
    const direction=g.dx<0?1:-1;dy.set(0);
    if(direction>0&&issueIndex<pageCount-1){changePage(issueIndex+1);}
    else if(direction<0&&issueIndex>0){changePage(issueIndex-1);}
    else {const next=s+direction;if(next>=0&&next<n){swipe.exitTo(direction>0?-390:390,()=>{stopPlayback();go('review',{deckId:nav.deckId,sel:next,swipeFrom:s});});}else if(next>=n)toFull();else swipe.settle();}
    return;
   }
   if(dy.get()>BACK_T){backExiting.current=true;dy.set(withTiming(BACK_FADE_Y,{duration:460,easing:EASE_SCREEN},done=>{if(done)runOnJS(toBack)();}));}
   else if(dy.get() < -BACK_T){backExiting.current=true;dy.set(0);toQA();}
   else dy.set(withTiming(0,{duration:360,easing:EASE_SCREEN}));
   swipe.settle();
  },
  onTerminate:()=>{swipe.settle();if(!backExiting.current)dy.set(withTiming(0,{duration:360,easing:EASE_SCREEN}));},
 };
 const screen=useAnimatedStyle(()=>({opacity:Math.max(0,1-Math.max(0,dy.value)/BACK_FADE_Y)}));
 if(!model||!model.state.run)return null;
 const {deck,times,state}=model,run=state.run!;
 const t=times[s]??0,target=deck.targets[s]??0,timingLabel=slideTimingLabel(t,target);
 const insufficient=recorded&&(v3?v3Slide?.status==='insufficient_speech'||v3Item?.status==='No speech detected':item?.status==='insufficient'||model.stages.get(selectedAttempt??'')==='no_speech');
 const legacyStatus=!v3&&!item?.assessed?item?.label??'Not analyzed':null;
 const scoreStrength=v3?v3Slide?.strength?.text??null:scoreItem.result&&'slide_index' in scoreItem.result?scoreItem.result.feedback.strengths[0]?.text:null;
 const mustCover=v3Slide?.must_cover??[];
 const pointList=mustCover.length?mustCover.map(m=>m.point):deck.slides[s]?.points??[];
 const pointsSaid=mustCover.length?mustCover.filter(m=>m.status==='covered').length:spokenText.trim()?pointList.filter(point=>covers(spokenText,point)).length:null;
 type Issue={category:string;observation:string;suggestion:string;icon:'i-clock'|'i-flag';quote:{text:string;start_ms:number;end_ms:number}|null;gain:number|null;criterion:string|null;
  headline:string;explanation:string[];example:string;steps:string[]};
 const timingIssues:Issue[]=timingLabel==='Over time'?[{category:'timing',observation:`This slide ran ${fmt(t-target)} over its ${fmt(target)} allocation.`,suggestion:'Trim or simplify this slide to stay within its planned time.',icon:'i-clock',quote:null,gain:null,criterion:null,
  headline:'Over time',explanation:[`This slide ran ${fmt(t-target)} over its ${fmt(target)} allocation.`],example:'',steps:['Trim or simplify this slide to stay within its planned time.']}]:[];
 const issueItems:Issue[]=[...timingIssues,...(v3&&v3Item
  ?slideCards(v3Item).map(card=>({category:v3Slide?.criteria.find(cr=>cr.id===card.criterion)?.label??'feedback',observation:card.title,
    suggestion:[card.action,card.example?`Try saying: “${card.example}”`:''].filter(Boolean).join(' '),icon:'i-flag' as const,
    quote:card.evidence?{text:card.evidence.text,start_ms:card.evidence.start_ms,end_ms:card.evidence.end_ms}:null,gain:card.gain,criterion:card.criterion,
    headline:card.headline||card.title,explanation:card.explanation,example:card.example,steps:card.steps.length?card.steps:card.action?[card.action]:[]}))
  :findingRows.filter(f=>f.category!=='timing').slice().sort((a,b)=>a.priority-b.priority).map(f=>({category:f.category,observation:f.observation,suggestion:f.suggestion,icon:'i-flag' as const,
    quote:f.speech_quote?{text:f.speech_quote,start_ms:f.start_ms,end_ms:f.end_ms}:null,gain:null,criterion:null,
    headline:f.observation,explanation:[],example:'',steps:f.suggestion?[f.suggestion]:[]})))];
 const pageCount=issueItems.length+1;
 // v3 states with no coaching card. A slide the server could not grade never reads "Nothing to fix".
 const v3Empty:[string,string]|null=!v3||!v3Item?null:v3Slide?.status==='not_applicable'?['Reviewed with the whole presentation',CODE_REASON_TEXT[v3Slide.reason??'']??'']
  :v3Slide?.status==='insufficient_evidence'?['Too little to judge',`The AI could not grade slide ${s+1} from what was said. Record it again with a fuller explanation.`]
  :v3Slide?.status==='not_recorded'?['Not recorded in this take',CODE_REASON_TEXT.slide_not_visited]
  :!v3Item.settled?['Feedback in progress…','Slide feedback appears here as soon as it is ready.']
  :v3Item.status==='Feedback failed'?['Feedback failed','Use Retry feedback below to try again.']
  :v3Item.status==='Not graded'?['No AI feedback yet','Use Get AI feedback below to request it for this recording.']:null;
 const page=Math.min(issueIndex,pageCount-1),issue=issueItems[page]??null;
 const changePage=(target:number)=>{
  if(target<0||target>=pageCount||target===issueIndex||pendingPageEnter.current!==null)return;
  const forward=target>issueIndex;
  swipe.exitTo(forward?-390:390,()=>{
   // OpenAI Codex, 2026-11-21: keep the outgoing review offscreen until the next fitted page is ready.
   pendingPageEnter.current=forward?SWIPE_ENTRY_X:-SWIPE_ENTRY_X;
   setIssueIndex(target);
  });
 };
 const revealPage=()=>{const offset=pendingPageEnter.current;if(offset===null)return;pendingPageEnter.current=null;swipe.enterFrom(offset);};
 const part=run.parts[s],slidePlayKey=`slide:${deck.id}:${s}`;
 const slideAudioUri=part?audioOf(part.attemptId):null;
 const isSlideSelected=player.playingKey===slidePlayKey,slidePlaying=isSlideSelected&&!player.paused;
 // OpenAI Codex, 2026-11-02: verified selected feedback and honest absent-word metrics; see docs/ai-collaboration/README.md#prompt-logs.
 const fillerValue=fillerCount===null?'—':String(fillerCount);
 const playSlide=()=>{
  if(!part||!slideAudioUri)return;
  void player.playSegments(slidePlayKey,part.segments.filter(segment=>segment.endMs>segment.startMs)
   .map(segment=>({uri:slideAudioUri,...segment})));
 };

 // Fixed boxes (design frame): the page box runs from below the slide row to just above the page dots.
 const boxTop=182,boxBottom=frame.compact?694:756,boxHeight=boxBottom-boxTop;
 const status=v3&&v3Item?(v3Item.score!==null?`Slide score ${v3Item.score} · ${levelLabel(v3Item.level)}`:v3Item.status):item?.label??'Not analyzed';
 const emptyTitle=insufficient?'Too little speech to review':v3Empty?v3Empty[0]:legacyStatus??'Nothing to fix on this slide';
 const emptyBody=insufficient?`Record slide ${s+1} again to get feedback based on your delivery.`:v3Empty?v3Empty[1]:legacyStatus?'The status and recovery options are below.':'';
 const needsRetry=!!v3&&!!v3Item&&(v3Slide?.status==='failed'||v3Item.status==='Feedback failed');
 const needsUpdate=!!v3&&!!v3Item?.outdated;
 const needsRequest=!!v3&&v3Item?.status==='Not graded'&&recorded;
 const legacyRecovery=!v3&&recorded&&!!part&&(!item?.assessed||!scoreStrength);
 const timeColor=timingLabel==='Over time'?c.warn:c.secondary;
 return <><Enter kind={active?nav.nav:null}><PanView style={StyleSheet.absoluteFill} {...pan}>
  <PageSurface hue={deck.hue}/>
  <Animated.View style={[StyleSheet.absoluteFill,screen]}>
   {/* OpenAI Codex, 2026-11-21: keep slide identity and audio fixed while review pages move. */}
   <View style={styles.header}>
    <Txt numberOfLines={1} style={[styles.title,{color:c.text}]}>{`Slide ${s+1} of ${n}`}</Txt><Txt numberOfLines={1} style={[styles.label,{color:c.secondary}]}>{deck.slides[s]?.title??runLabel(run,now,relativeDay)}</Txt>
   </View>
   {/* Slide row: thumbnail with the score, the three numbers, and the slide's play button (the only playback here). */}
   <View style={styles.slideRow}>
    <View style={styles.thumb}>
     <MiniSlide hue={deck.hue} page={deck.pages[s]} title={deck.slides[s]?.title??''} width={128} height={72} radius={12}/>
     <View style={[styles.scoreBadge,{backgroundColor:scoreItem.score===null?c.surface:scoreLevelColor(scoreItem.level,c)}]}><Txt style={[styles.scoreBadgeText,{color:scoreItem.score===null?c.secondary:c.onAccent}]}>{scoreItem.score===null?'—':scoreItem.score}</Txt></View>
    </View>
    <View style={styles.facts}>
     <Txt numberOfLines={1} style={[styles.fact,{color:timeColor}]}>{`${fmt(t)} of ${fmt(target)} planned`}</Txt>
     <Txt numberOfLines={1} style={[styles.fact,{color:c.secondary}]}>{`${fillerValue} filler${fillerValue==='1'?'':'s'}`}</Txt>
     <Txt numberOfLines={1} style={[styles.fact,{color:pointsSaid!==null&&pointsSaid<pointList.length?c.warn:c.secondary}]}>{pointList.length?`${pointsSaid===null?'—':pointsSaid} of ${pointList.length} points said`:'No slide points'}</Txt>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={slidePlaying?'Pause slide audio':`Play slide ${s+1} audio`} disabled={!slideAudioUri||!part} onPress={playSlide} style={[styles.play,{backgroundColor:c.surface,borderColor:c.hair}]}><Glyph name={slidePlaying?'p-pause':'p-play'} size={18} color={c.text}/></Pressable>
   </View>
   <Animated.View style={[styles.box,{top:boxTop,height:boxHeight},swipe.style]}>
    <FitPage key={`${s}:${page}`} height={boxHeight} onReady={revealPage}>
     {issue?<ReviewCard issue={issue} meta={`${v3Item?.outdated?'OUTDATED · ':''}${issue.category==='timing'?'TIMING':issue.category.toUpperCase()}`} count={`${page+1} of ${issueItems.length}`}/>
      :<SlideSummary status={status} empty={issueItems.length?null:[emptyTitle,emptyBody]} notices={[v3?.notice??'',v3Slide?.reason?CODE_REASON_TEXT[v3Slide.reason]??v3Slide.reason:'',v3Item?.outdated?'These results are from before your latest transcript or settings changes.':''].filter(Boolean)}
        strength={scoreStrength} mustCover={mustCover} criteria={v3Slide?.criteria??[]}
        actions={needsRetry||needsUpdate||needsRequest?<>
         {needsRetry&&<Action label={v3!.busy?'Retrying…':'Retry feedback'} disabled={v3!.busy} onPress={()=>void v3!.retry()}/>}
         {needsUpdate&&<Action label={v3!.busy?'Updating…':'Update feedback'} disabled={v3!.busy} onPress={()=>void v3!.update()}/>}
         {needsRequest&&<Action label={v3!.busy?'Requesting…':'Get AI feedback'} disabled={v3!.busy} onPress={()=>void v3!.update()}/>}
        </>:null}>
       {legacyRecovery&&part?<SlideReviewDetails slide={s} part={part} localDeckId={deck.id} status={item?.label??'Not analyzed'}>
        {findingRows.filter(f=>f.category==='timing').map((f,i)=><SummaryFinding key={i} observation={f.observation} suggestion={f.suggestion}/>)}
       </SlideReviewDetails>:null}
      </SlideSummary>}
    </FitPage>
   </Animated.View>
   <View style={[styles.dots,{top:boxBottom+8}]}>{Array.from({length:pageCount},(_,i)=><Pressable key={i} accessibilityRole="button" accessibilityLabel={i<issueItems.length?`Show issue ${i+1}`:'Show grades and actions'} onPress={()=>changePage(i)} style={styles.dotHit}><View style={[styles.dot,{backgroundColor:i===page?c.strong:c.dotOff}]}/></Pressable>)}</View>
  </Animated.View></PanView>
</Enter>
 {/* OpenAI Codex, 2026-11-20: issue navigation moves content while the footer stays in place. */}
 {active&&<HintRow hints={[{icon:'h-spin',text:'Next review'},{icon:'h-up',text:'Q&A',nudge:'up'},{icon:'h-dn',text:'Slide preview',nudge:'down'}]}/>}
 </>;
}

// ── Fit to the box: measure and shrink the page so vertical drags remain navigation gestures. ──
const Fit=createContext(1);
/** Children size with useFit(); an overlong page stays hidden until it fits without scrolling. */
function FitPage({height,children,onReady}:{height:number;children:ReactNode;onReady?:()=>void}){
 const [fit,setFit]=useState<{scale:number;ready:boolean}>({scale:1,ready:false});
 // OpenAI Codex, 2026-11-21: no nested ScrollView may take the downward gesture from Review.
 return <View style={{height,overflow:'hidden'}}>
  <View testID="reviewFitContent" style={{opacity:fit.ready?1:0}} onLayout={e=>{
   const h=e.nativeEvent.layout.height;
   if(h<=0)return;
   if(h<=height+1){if(!fit.ready){setFit({...fit,ready:true});onReady?.();}return;}
   const scale=Math.max(0.05,fit.scale*height/h*0.98);
   if(scale<fit.scale-0.001)setFit({scale,ready:false});
   else if(!fit.ready){setFit({...fit,ready:true});onReady?.();}
  }}><Fit.Provider value={fit.scale}>{children}</Fit.Provider></View>
 </View>;
}
const useFit=()=>{const z=useContext(Fit);return (n:number)=>Math.round(n*z*10)/10;};

type ReviewIssue={headline:string;explanation:string[];example:string;steps:string[];gain:number|null;quote:{text:string}|null};
function Bullets({items,color,dot,size,line}:{items:string[];color:string;dot:string;size:number;line:number}){
 const z=useFit();
 return <View style={{gap:z(7)}}>{items.map((text,i)=><View key={i} style={[styles.bullet,{gap:z(10)}]}>
  <View style={[styles.bulletDot,{width:z(5),height:z(5),borderRadius:z(3),backgroundColor:dot,marginTop:z(line/2-2.5)}]}/><Txt style={[styles.bulletText,{color,fontSize:z(size),lineHeight:z(line)}]}>{text}</Txt></View>)}</View>;
}
/** One review, every word shown: what is wrong, why, what you said, what to say and do instead. */
function ReviewCard({issue,meta,count}:{issue:ReviewIssue;meta:string;count:string}){
 const {c}=useTheme(),z=useFit();
 const kicker=(text:string,color:string)=><Txt style={[styles.kicker,{color,fontSize:z(12.5),lineHeight:z(16)}]}>{text}</Txt>;
 return <View style={[styles.card,{padding:z(18),borderRadius:z(22),borderColor:c.hair,backgroundColor:c.surface06}]}>
  <View style={[styles.cardTop,{gap:z(8)}]}>{kicker(`${meta} · ${count.toUpperCase()}`,c.secondary)}
   {!!issue.gain&&<Txt style={[styles.gain,{color:c.accent,backgroundColor:c.accentSoft,fontSize:z(13),lineHeight:z(18),paddingHorizontal:z(9),paddingVertical:z(2)}]}>{`+${issue.gain} pts`}</Txt>}</View>
  <Txt style={[styles.headline,{color:c.text,marginTop:z(8),fontSize:z(22),lineHeight:z(28)}]}>{issue.headline}</Txt>
  {!!issue.explanation.length&&<View style={{marginTop:z(8)}}><Bullets items={issue.explanation} color={c.secondary} dot={c.tertiary} size={15} line={21}/></View>}
  {!!issue.quote&&<View style={[styles.said,{borderRadius:z(16),marginTop:z(14),padding:z(12),paddingHorizontal:z(14),backgroundColor:c.surface08}]}>{kicker('YOU SAID',c.tertiary)}
   <Txt style={[styles.quote,{color:c.body,marginTop:z(5),fontSize:z(15.5),lineHeight:z(21)}]}>{`“${issue.quote.text}”`}</Txt></View>}
  {!!(issue.example||issue.steps.length)&&<View style={[styles.try,{borderRadius:z(16),marginTop:z(10),padding:z(14),backgroundColor:c.accentSoft,borderColor:c.accent}]}>
   {!!issue.example&&<>{kicker('TRY SAYING',c.accent)}<Txt style={[styles.example,{color:c.text,marginTop:z(5),fontSize:z(16.5),lineHeight:z(22)}]}>{`“${issue.example}”`}</Txt>
    {!!issue.steps.length&&<View style={[styles.split,{backgroundColor:c.accent,marginVertical:z(12)}]}/>}</>}
   {!!issue.steps.length&&<>{kicker('DO THIS',c.accent)}<View style={{marginTop:z(6)}}><Bullets items={issue.steps} color={c.text} dot={c.accent} size={15} line={20}/></View></>}
  </View>}
 </View>;
}
type Criterion={id:string;label:string;level:Parameters<typeof levelLabel>[0];points:number|null;maximum_points:number|null;reason:string|null};
/** The last page leads with the three feedback sections; exceptional and legacy recovery follows them. */
function SlideSummary({status,empty,notices,strength,mustCover,criteria,actions,children}:{status:string;empty:[string,string]|null;notices:string[];strength:string|null;
 mustCover:{point:string;status:'covered'|'partial'|'missing'}[];criteria:Criterion[];actions:ReactNode;children:ReactNode}){
 const {c}=useTheme(),z=useFit();
 const kicker=(text:string,color:string)=><Txt style={[styles.kicker,{color,fontSize:z(12.5),lineHeight:z(16)}]}>{text}</Txt>;
 const body=(text:string,color:string)=><Txt style={[styles.bodyText,{color,fontSize:z(15),lineHeight:z(21)}]}>{text}</Txt>;
 const block={padding:z(20),borderRadius:z(22),borderWidth:1,borderColor:c.hair,backgroundColor:c.surface04,gap:z(10)};
 const hasFeedback=!!strength||mustCover.length>0||criteria.length>0;
 const hasRecovery=!!children||notices.length>0||!!actions;
 return <View style={{gap:z(16)}}>
  {/* OpenAI Codex, 2026-11-21: replace the former status/action card with a concise summary title. */}
  <Txt style={[styles.summaryTitle,{color:c.text,fontSize:z(22),lineHeight:z(28)}]}>Overall per-slide feedback</Txt>
  {!!strength&&<View style={[block,{borderColor:c.good}]}>{kicker('WHAT WORKED',c.good)}{body(strength,c.body)}</View>}
  {!!mustCover.length&&<View style={block}>{kicker('MUST COVER',c.secondary)}
   {mustCover.map((m,i)=><View key={i} style={[styles.must,{gap:z(8)}]}><Txt style={[styles.mustIcon,{width:z(18),color:m.status==='covered'?c.good:m.status==='partial'?c.gold:c.bad,fontSize:z(15),lineHeight:z(21)}]}>{m.status==='covered'?'✓':m.status==='partial'?'◐':'✗'}</Txt>
    <View style={styles.flex}>{body(m.point,c.text)}</View></View>)}</View>}
  {!!criteria.length&&<View style={block}>{kicker('HOW IT WAS GRADED',c.secondary)}
   {criteria.map(cr=><View key={cr.id} style={{gap:z(3)}}><View style={[styles.criterionTop,{gap:z(8)}]}><Txt style={[styles.criterion,{color:c.text,fontSize:z(15.5),lineHeight:z(21)}]}>{cr.label}</Txt>
    <Txt style={[styles.level,{color:scoreLevelColor(cr.level,c),fontSize:z(13.5),lineHeight:z(21)}]}>{cr.level?`${levelLabel(cr.level)} · ${Math.round((cr.points??0)*10)/10}/${cr.maximum_points}`:'Not assessed'}</Txt></View>
    {!!cr.reason&&body(cr.reason,c.secondary)}</View>)}</View>}
  {(!hasFeedback||hasRecovery)&&<View style={block}>{kicker('FEEDBACK STATUS',c.secondary)}
   {!hasFeedback&&empty?<><Txt style={[styles.headline,{color:c.text,fontSize:z(22),lineHeight:z(28)}]}>{empty[0]}</Txt>{!!empty[1]&&body(empty[1],c.secondary)}</>:null}
   <Txt accessibilityLiveRegion="polite" style={[styles.status,{color:c.text,fontSize:z(15),lineHeight:z(21)}]}>{status}</Txt>
   {notices.map((text,i)=><Txt key={i} style={[styles.bodyText,{color:c.secondary,fontSize:z(14),lineHeight:z(20)}]}>{text}</Txt>)}
   {actions&&<View style={[styles.actions,{gap:z(10),marginTop:z(4)}]}>{actions}</View>}
   {children}
  </View>}
 </View>;
}
/** A legacy timing finding: it has no page of its own, so it is shown in full on the last page. */
function SummaryFinding({observation,suggestion}:{observation:string;suggestion:string}){
 const {c}=useTheme(),z=useFit();
 return <View style={{gap:z(4)}}><Txt style={[styles.status,{color:c.text,fontSize:z(15),lineHeight:z(21)}]}>{observation}</Txt>
  {!!suggestion&&<Txt style={[styles.bodyText,{color:c.secondary,fontSize:z(15),lineHeight:z(21)}]}>{suggestion}</Txt>}</View>;
}
function Action({label,onPress,disabled=false,primary=false}:{label:string;onPress:()=>void;disabled?:boolean;primary?:boolean}){
 // OpenAI Codex, 2026-11-21: actions shrink with the rest of a fitted last page.
 const {c}=useTheme(),z=useFit();
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={[styles.action,{minHeight:z(44),paddingHorizontal:z(16),borderRadius:z(16)},primary?{backgroundColor:c.accent}:{borderWidth:1,borderColor:c.hair},{opacity:disabled?0.45:1}]}>
  <Txt style={[styles.actionText,{fontSize:z(15),color:primary?c.onAccent:c.text}]}>{label}</Txt></Pressable>;
}
const styles=StyleSheet.create({
 // Claude, 2026-11-21: slide row, fitted review pages and the last page (canvas L3).
 slideRow:{position:'absolute',left:24,right:24,top:92,height:76,flexDirection:'row',alignItems:'center',gap:12},
 thumb:{width:128,height:72,borderRadius:12,overflow:'hidden'},facts:{flex:1,minWidth:0},fact:{fontFamily:F.semibold,fontSize:14,lineHeight:20,fontVariant:['tabular-nums']},
 play:{width:44,height:44,borderRadius:22,borderWidth:1,alignItems:'center',justifyContent:'center'},
 box:{position:'absolute',left:24,right:24},
 card:{borderRadius:22,borderWidth:1},cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 kicker:{flexShrink:1,fontFamily:F.bold,letterSpacing:1.1},gain:{fontFamily:F.bold,borderRadius:999,paddingHorizontal:9,paddingVertical:2,overflow:'hidden'},
 headline:{fontFamily:F.display,letterSpacing:-0.2},bullet:{flexDirection:'row',alignItems:'flex-start',gap:10},bulletDot:{width:5,height:5,borderRadius:3},
 bulletText:{flex:1,minWidth:0,fontFamily:F.medium},said:{borderRadius:16},quote:{fontFamily:F.medium},try:{borderRadius:16,borderWidth:1.5},
 example:{fontFamily:F.semibold},split:{height:1,opacity:0.35},status:{fontFamily:F.semibold},bodyText:{fontFamily:F.medium},
 actions:{flexDirection:'row',flexWrap:'wrap'},action:{minHeight:44,paddingHorizontal:16,borderRadius:16,justifyContent:'center'},actionText:{fontFamily:F.bold,fontSize:15},
 must:{flexDirection:'row',alignItems:'flex-start',gap:8},mustIcon:{width:18,fontFamily:F.bold},flex:{flex:1,minWidth:0},
 criterionTop:{flexDirection:'row',justifyContent:'space-between',gap:8},criterion:{flex:1,minWidth:0,fontFamily:F.bold},level:{fontFamily:F.bold},
 summaryTitle:{fontFamily:F.display,letterSpacing:-0.2},
 header:{position:'absolute',left:30,right:30,top:46,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},label:{fontFamily:F.medium,fontSize:14,lineHeight:18},
 slideHero:{position:'absolute',left:24,right:24,top:100,height:160,borderRadius:18,overflow:'hidden'},heroScrim:{position:'absolute',left:0,right:0,top:0,bottom:0,justifyContent:'flex-end',padding:18,backgroundColor:'rgba(0,0,0,0.24)'},heroLabel:{fontFamily:F.bold,fontSize:13.5,letterSpacing:1.1,color:'#FFFFFF'},heroTitle:{maxWidth:245,fontFamily:F.display,fontSize:23,lineHeight:27,color:'#FFFFFF'},scoreBadge:{position:'absolute',top:5,right:5,minWidth:46,height:26,borderRadius:13,paddingHorizontal:8,alignItems:'center',justifyContent:'center'},scoreBadgeText:{fontFamily:F.bold,fontSize:14},heroPlay:{position:'absolute',right:14,bottom:14,width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},
 issueCard:{position:'absolute',left:24,right:24,top:284,height:310,borderRadius:24,borderWidth:1,padding:20,gap:10},issueTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},issueMeta:{fontFamily:F.bold,fontSize:13.5,letterSpacing:.4},issueMetaFlex:{flexShrink:1},issueTitle:{fontFamily:F.display,fontSize:22,lineHeight:28},issueBody:{fontFamily:F.medium,fontSize:15,lineHeight:22},evidence:{marginTop:2,paddingTop:12,borderTopWidth:1,gap:4},evidenceHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},evidenceLabel:{fontFamily:F.bold,fontSize:13.5,letterSpacing:.5},evidenceListen:{minHeight:36,paddingHorizontal:10,borderRadius:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},evidenceListenText:{fontFamily:F.semibold,fontSize:13.5},evidenceQuote:{fontFamily:F.medium,fontSize:15,lineHeight:20},detailsLink:{marginTop:'auto',minHeight:44,justifyContent:'center'},detailsLinkText:{fontFamily:F.semibold,fontSize:14},
 dots:{position:'absolute',top:604,left:24,right:24,height:24,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5},dotHit:{width:22,height:24,alignItems:'center',justifyContent:'center'},dot:{width:6,height:6,borderRadius:3},chips:{position:'absolute',top:634,left:24,right:24,height:36,flexDirection:'row',alignItems:'center',gap:6},chip:{flex:1,minWidth:0,height:34,paddingHorizontal:6,borderRadius:17,borderWidth:1,alignItems:'center',justifyContent:'center'},chipText:{fontFamily:F.semibold,fontSize:13.5},
 content:{position:'absolute',left:16,right:16,top:140,gap:4},
 ringRow:{flexDirection:'row',alignItems:'center',gap:18,paddingHorizontal:8},ringRight:{flex:1,minWidth:0,gap:10},slideLabel:{fontFamily:F.semibold,fontSize:13.5},
 stat:{flexDirection:'row',alignItems:'center',gap:7},statValue:{fontFamily:F.display,fontSize:18,fontVariant:['tabular-nums']},statUnit:{flexShrink:1,fontFamily:F.medium,fontSize:13.5,lineHeight:18},
 timesBlock:{height:88},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'},section:{fontFamily:F.bold,fontSize:14},bars:{height:44,marginTop:4},barRow:{height:44,flexDirection:'row',alignItems:'flex-end',gap:1},barHit:{position:'relative',flex:1,minWidth:0,height:44,alignItems:'center',justifyContent:'flex-end'},
 slideCard:{marginTop:18,borderWidth:1,borderRadius:20,padding:14,gap:11},slidePreviewRow:{flexDirection:'row',alignItems:'center',gap:12},slideFacts:{flex:1,minWidth:0,gap:4},previewTitle:{fontFamily:F.display,fontSize:15,lineHeight:18},slideTime:{fontFamily:F.semibold,fontSize:13.5,lineHeight:18,fontVariant:['tabular-nums']},targetStatus:{fontFamily:F.semibold,fontSize:13.5,lineHeight:18},feedbackRows:{gap:8,minHeight:44},feedbackRow:{minHeight:22,flexDirection:'row',alignItems:'center',gap:8},feedbackText:{flex:1,minWidth:0,fontFamily:F.medium,fontSize:13.5,lineHeight:18},playbackStrip:{minHeight:36,flexDirection:'row',alignItems:'center',gap:8},playTrack:{height:5,flex:1,borderRadius:3,overflow:'hidden'},playProgress:{height:5},playTime:{fontFamily:F.medium,fontSize:13.5,fontVariant:['tabular-nums']},playError:{fontFamily:F.medium,fontSize:13.5,lineHeight:18},
 feedbackDetails:{position:'absolute',left:24,right:24,top:180,bottom:180,borderRadius:20,borderWidth:1,padding:16},detailsHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},detailsClose:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},detailsScroll:{flex:1},detailsBody:{paddingTop:12,paddingBottom:16,gap:20},detailsFinding:{gap:8},detailsText:{fontFamily:F.medium,fontSize:16,lineHeight:24},
 fullReview:{position:'absolute',left:16,right:16,bottom:68,height:58,borderWidth:1,borderRadius:18,overflow:'hidden',alignItems:'center',justifyContent:'center'},fullReviewTitle:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
});
