// OpenAI Codex review routing: docs/ai-collaboration/prompt-logs/seoyeon/iteration-2.md#record-137
// AI-assisted Nakajima integration: verified selected-slide feedback in the normal Review page.
// OpenAI Codex compact slide review and scrubber label.
// OpenAI Codex Review exit underlay and duration colours.
// Supplied Claude-generated patch, integrated by OpenAI Codex for Iteration 2 (2026-11-21): every review in full on the
// page (canvas L3); grades and recovery actions on the last page instead of a pop-up.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent, type PanResponderGestureState, type TextProps } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph } from '../design/icons';
import { PanView } from '../design/PanView';
import { EASE_SCREEN, F, FRAME_W } from '../design/tokens';
import { useTheme } from '../design/theme';
import { useUiText } from '../design/language';
import { HintRow, PageSurface } from '../design/ui';
import { MiniSlide } from '../design/SlideCard';
import { fmt, relativeDay } from '../domain/format';
import { BACK_FADE_Y, REVIEW_PAGE_SWIPE } from '../domain/gestures';
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
import { usePageFooter } from './pageFooter';
import { SWIPE_ENTRY_X, useHorizontalSwipeMotion } from './swipeMotion';

const CONTENT_TOP=46;
const CONTENT_INSET=24;
const EMPTY_SCORE:ScoreDisplay={score:null,level:null,status:'Not graded',state:null,result:null,target:null};

export function ReviewScreen({active=true}:{active?:boolean}) {
 const {nav}=useShell();const model=useDeckModel(nav.deckId);
 const initialX=nav.swipeFrom===undefined||nav.sel===nav.swipeFrom?0:nav.sel>nav.swipeFrom?SWIPE_ENTRY_X:-SWIPE_ENTRY_X;
 // Selection/source changes reset playback and feedback details together.
 return <ReviewContent key={JSON.stringify([nav.deckId,nav.sel,model?.state.run?.parts[nav.sel]])} model={model} active={active} initialX={initialX}/>;
}
function ReviewContent({model,active,initialX}:{model:DeckModel|null;active:boolean;initialX:number}) {
 const {c}=useTheme(),{go,nav,footerHandoff}=useShell(),frame=useFrame(),ui=useUiText();
 const reducedMotion=useReducedMotion();
 const n=model?.n??0;
 const s=Math.max(0,Math.min(Math.max(0,n-1),nav.sel));
 const runScores=useRunScores(model,active,s,true),v3=runScores.v3,v3Item=v3?.items[s]??null,v3Slide=v3Item?.v3??null;
 const canRequest=v3?.canRequest!==false&&!v3?.budgetRetry;
 const feedback=useRunFeedbackStatus(model,active&&!v3,v3?undefined:s),item=feedback.items[s];
 const duration=model?.times[s]??0,allocation=model?.deck.targets[s]??0;
 const spokenText=slideText(model?.lines??[],s);
 const selectedAttempt=model?.state.run?.parts[s]?.attemptId;
 const hasTranscript=!!selectedAttempt&&model?.stages.get(selectedAttempt)==='done'&&!!model.transcripts.get(selectedAttempt)?.words.length;
 const fillerCount=v3Slide?.measurements?v3Slide.measurements.filler_count:duration>0&&hasTranscript&&spokenText.trim()?fillerTotal(spokenText):null;
 const slideReviewRows=compactFeedbackRows(s,item,{durationSeconds:duration,allocationSeconds:allocation,fillerCount});
 const [issueIndex,setIssueIndex]=useState(0);
 const pendingPageEnter=useRef<number|null>(null);
 const scroll=useRef({top:0,viewport:0,content:0,y:0});
 const [canScroll,setCanScroll]=useState(false);
 const findingRows=slideReviewRows.flatMap(row=>row.findings);
 const recorded=!!model?.state.run?.parts[s]?.segments.some(segment=>segment.endMs>segment.startMs);
 const scores=runScores.scores,scoreItem=scores.items[s]??EMPTY_SCORE;
 const player=useSegmentPlayer(),stopPlayback=player.stop;
 const dy=useSharedValue(0),backExiting=useRef(false);
 const hasPreviewUnderlay=footerHandoff?.underlay?.screen==='rehearse';
 const footer=usePageFooter(active,dy,'rehearse');
 const swipe=useHorizontalSwipeMotion({slideOnly:true,initialX,active});
 const now=useNow();
 useLayoutEffect(()=>{
  const offset=pendingPageEnter.current;
  if(offset===null)return;
  pendingPageEnter.current=null;
  swipe.enterFrom(offset);
 },[issueIndex,swipe]);
 useEffect(()=>{if(!active){pendingPageEnter.current=null;backExiting.current=false;if(dy.get()>0)dy.set(0);stopPlayback();}},[active,dy,stopPlayback]);
 useEffect(()=>()=>stopPlayback(),[stopPlayback]);
 const toBack=useCallback(()=>{pendingPageEnter.current=null;swipe.cancel();stopPlayback();go('rehearse',{deckId:nav.deckId,slide:s,sel:s});},[go,nav.deckId,s,stopPlayback,swipe]);
 const toQA=useCallback(()=>{pendingPageEnter.current=null;swipe.cancel();stopPlayback();go('qa',{nav:'fade',deckId:nav.deckId,sel:s,from:'review'});},[go,nav.deckId,s,stopPlayback,swipe]);
 const toFull=useCallback(()=>{pendingPageEnter.current=null;swipe.cancel();stopPlayback();go('full',nav.from==='full'?{deckId:nav.deckId,sel:s}:{deckId:nav.deckId,sel:s,from:'rehearse'});},[go,nav.deckId,nav.from,s,stopPlayback,swipe]);
 useBack(active,()=>{if(!backExiting.current)toBack();return true;});
 const resetSwipe=()=>dy.set(withTiming(0,{duration:REVIEW_PAGE_SWIPE.resetMs,easing:EASE_SCREEN}));
 const shouldNavigate=(e:GestureResponderEvent,g:PanResponderGestureState)=>{
  if(!active||backExiting.current)return false;
  if(Math.abs(g.dx)>16&&Math.abs(g.dx)>Math.abs(g.dy))return true;
  if(Math.abs(g.dy)<=8||Math.abs(g.dy)<=Math.abs(g.dx))return false;
  const {top,viewport,content,y}=scroll.current;
  const gestureStartX=(e.nativeEvent.pageX-g.dx-frame.left)/frame.s;
  const gestureStartY=(e.nativeEvent.pageY-g.dy-frame.top)/frame.s;
  if(gestureStartX<CONTENT_INSET||gestureStartX>=FRAME_W-CONTENT_INSET||
   gestureStartY<top||gestureStartY>=top+viewport||content<=viewport+1)return true;
  // An outward swipe at either edge still navigates. Inside the scroll range the review can be read.
  return g.dy>0?y<=1:y+viewport>=content-1;
 };
 const pan={
  onMoveShouldCapture:shouldNavigate,
  onMoveShould:shouldNavigate,
  onMove:(_e:GestureResponderEvent,g:PanResponderGestureState)=>{if(Math.abs(g.dx)>Math.abs(g.dy)){swipe.move(g.dx/frame.s);dy.set(0);}else{swipe.cancel();dy.set(Math.max(-BACK_FADE_Y,Math.min(BACK_FADE_Y,g.dy/frame.s)));}},
  onRelease:(_e:GestureResponderEvent,g:PanResponderGestureState)=>{
   if(Math.abs(g.dx/frame.s)>48&&Math.abs(g.dx)>Math.abs(g.dy)){
    const direction=g.dx<0?1:-1;dy.set(0);
    if(direction>0&&issueIndex<pageCount-1){changePage(issueIndex+1);}
    else if(direction<0&&issueIndex>0){changePage(issueIndex-1);}
    else {const next=s+direction;if(next>=0&&next<n){swipe.exitTo(direction>0?-390:390,()=>{stopPlayback();go('review',{deckId:nav.deckId,sel:next,swipeFrom:s});});}else if(next>=n)toFull();else swipe.settle();}
    return;
   }
   if(dy.get()>REVIEW_PAGE_SWIPE.distance){
    backExiting.current=true;
    dy.set(withTiming(BACK_FADE_Y,{duration:REVIEW_PAGE_SWIPE.exitMs,easing:EASE_SCREEN},done=>{if(done)runOnJS(toBack)();}));
   }else if(dy.get() < -REVIEW_PAGE_SWIPE.distance){
    backExiting.current=true;
    resetSwipe();
    toQA();
   }else resetSwipe();
   swipe.settle();
  },
  onTerminate:()=>{swipe.settle();if(!backExiting.current)resetSwipe();},
 };
 const pageFade=useAnimatedStyle(()=>({opacity:hasPreviewUnderlay?1-Math.max(0,dy.value)/BACK_FADE_Y:1}));
 const contentMotion=useAnimatedStyle(()=>({
  // An upward pull gives feedback while keeping the surface opaque under Q&A.
  transform:[{translateY:reducedMotion?0:Math.min(0,dy.value)*0.18}],
  opacity:hasPreviewUnderlay?1:1-Math.max(0,dy.value)/BACK_FADE_Y,
 }));
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
  headline:ui('Over time'),explanation:[ui(`This slide ran ${fmt(t-target)} over its ${fmt(target)} allocation.`)],example:'',steps:[ui('Trim or simplify this slide to stay within its planned time.')]}]:[];
 const issueItems:Issue[]=[...timingIssues,...(v3&&v3Item
  ?slideCards(v3Item,ui).map(card=>({category:v3Slide?.criteria.find(cr=>cr.id===card.criterion)?.label??'feedback',observation:card.title,
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
  :!v3Item.settled?canRequest?['Feedback in progress…','Slide feedback appears here as soon as it is ready.']:['Online feedback unavailable','']
  :v3Item.status==='Feedback failed'?['Feedback failed',canRequest?'Use Retry feedback below to try again.':'']
  :v3Item.status==='Not graded'?['No AI feedback yet',canRequest?'Use Get AI feedback below to request it for this recording.':'']:null;
 const page=Math.min(issueIndex,pageCount-1),issue=issueItems[page]??null;
 const changePage=(target:number)=>{
  if(target<0||target>=pageCount||target===issueIndex||pendingPageEnter.current!==null)return;
  const forward=target>issueIndex;
  swipe.exitTo(forward?-390:390,()=>{
   pendingPageEnter.current=forward?SWIPE_ENTRY_X:-SWIPE_ENTRY_X;
   scroll.current.content=0;
   scroll.current.y=0;
   setCanScroll(false);
   setIssueIndex(target);
  });
 };
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

 const boxBottom=frame.compact?694:756;
 const updateScrollAvailability=()=>{setCanScroll(scroll.current.viewport>0&&scroll.current.content>scroll.current.viewport+1);};
 const onPageLayout=(e:LayoutChangeEvent)=>{
  const {y,height}=e.nativeEvent.layout;
  scroll.current.top=CONTENT_TOP+y;
  scroll.current.viewport=height;
  updateScrollAvailability();
 };
 const status=v3&&v3Item?(v3Item.score!==null?`Slide score ${v3Item.score} · ${levelLabel(v3Item.level)}`:v3Item.status):item?.label??'Not analyzed';
 const emptyTitle=insufficient?'Too little speech to review':v3Empty?v3Empty[0]:legacyStatus??'Nothing to fix on this slide';
 const emptyBody=insufficient?`Record slide ${s+1} again to get feedback based on your delivery.`:v3Empty?v3Empty[1]:legacyStatus?'The status and recovery options are below.':'';
 const needsRetry=canRequest&&!!v3Item&&(v3Slide?.status==='failed'||v3Item.status==='Feedback failed');
 const needsUpdate=canRequest&&!!v3Item?.outdated;
 const needsRequest=canRequest&&v3Item?.status==='Not graded'&&recorded;
 const legacyRecovery=!v3&&recorded&&!!part&&(!item?.assessed||!scoreStrength);
 const timeColor=timingLabel==='Over time'?c.warn:c.secondary;
 return <><Enter kind={active?nav.nav:null} duration={REVIEW_PAGE_SWIPE.enterMs}><PanView style={[StyleSheet.absoluteFill,pageFade]} {...pan}>
  <PageSurface hue={deck.hue}/>
  <Animated.View style={[StyleSheet.absoluteFill,contentMotion]}>
   <View style={[styles.content,{height:boxBottom-CONTENT_TOP}]}>
   {/* Keep slide identity and audio fixed while review pages move. */}
   <View style={styles.header}>
    <Txt style={[styles.title,{color:c.text}]}>{`Slide ${s+1} of ${n}`}</Txt><Txt verbatim style={[styles.label,{color:c.secondary}]}>{deck.slides[s]?.title ?? ui(runLabel(run,now,relativeDay))}</Txt>
   </View>
   {/* Slide row: thumbnail with the score, the three numbers, and the slide's play button (the only playback here). */}
   <View style={styles.slideRow}>
    <View style={styles.thumb}>
     <MiniSlide hue={deck.hue} page={deck.pages[s]} title={deck.slides[s]?.title??''} width={128} height={72} radius={12}/>
     <View style={[styles.scoreBadge,{backgroundColor:scoreItem.score===null?c.surface:scoreLevelColor(scoreItem.level,c)}]}><Txt style={[styles.scoreBadgeText,{color:scoreItem.score===null?c.secondary:c.onAccent}]}>{scoreItem.score===null?'—':scoreItem.score}</Txt></View>
    </View>
    <View style={styles.facts}>
     <Txt style={[styles.fact,{color:timeColor}]}>{`${fmt(t)} of ${fmt(target)} planned`}</Txt>
     <Txt style={[styles.fact,{color:c.secondary}]}>{`${fillerValue} filler${fillerValue==='1'?'':'s'}`}</Txt>
     <Txt style={[styles.fact,{color:pointsSaid!==null&&pointsSaid<pointList.length?c.warn:c.secondary}]}>{pointList.length?`${pointsSaid===null?'—':pointsSaid} of ${pointList.length} points said`:'No slide points'}</Txt>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={ui(slidePlaying?'Pause slide audio':`Play slide ${s+1} audio`)} disabled={!slideAudioUri||!part} onPress={playSlide} style={[styles.play,{backgroundColor:c.surface,borderColor:c.hair}]}><Glyph name={slidePlaying?'p-pause':'p-play'} size={18} color={c.text}/></Pressable>
   </View>
   <Animated.View onLayout={onPageLayout} style={[styles.box,swipe.style]}>
    <ScrollView key={page} style={styles.reviewScroll} scrollEnabled={canScroll}
     onContentSizeChange={(_width,height)=>{scroll.current.content=height;updateScrollAvailability();}}
     onScroll={e=>{scroll.current.y=e.nativeEvent.contentOffset.y;}} scrollEventThrottle={16} overScrollMode="never">
     {issue?<ReviewCard issue={issue} meta={`${v3Item?.outdated?ui('OUTDATED')+' · ':''}${ui(issue.category).toUpperCase()}`} count={ui(`${page+1} of ${issueItems.length}`)}/>
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
    </ScrollView>
   </Animated.View>
   </View>
   <View style={[styles.dots,{top:boxBottom+8}]}>{Array.from({length:pageCount},(_,i)=><Pressable key={i} accessibilityRole="button" accessibilityLabel={ui(i<issueItems.length?`Show issue ${i+1}`:'Show grades and actions')} onPress={()=>changePage(i)} style={styles.dotHit}><View style={[styles.dot,{backgroundColor:i===page?c.strong:c.dotOff}]}/></Pressable>)}</View>
  </Animated.View>
 </PanView></Enter>
 {/* OpenAI Codex, 2026-11-20: issue navigation moves content while the footer stays in place. */}
 {footer.visible&&<Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,footer.style]}>
  <HintRow hints={[{icon:'h-spin',text:'Next review'},{icon:'h-up',text:'Q&A',nudge:'up'},{icon:'h-dn',text:'Slide preview',nudge:'down'}]}/>
 </Animated.View>}
 </>;
}

function ReviewText(props:TextProps&{verbatim?:boolean}) {
 return <Txt maxFontSizeMultiplier={0} {...props}/>;
}

type ReviewIssue={headline:string;explanation:string[];example:string;steps:string[];gain:number|null;quote:{text:string}|null};
function Bullets({items,color,dot,size,line}:{items:string[];color:string;dot:string;size:number;line:number}){
 return <View style={{gap:7}}>{items.map((text,i)=><View key={i} style={[styles.bullet,{gap:10}]}>
  <View style={[styles.bulletDot,{width:5,height:5,borderRadius:3,backgroundColor:dot,marginTop:line/2-2.5}]}/><ReviewText verbatim style={[styles.bulletText,{color,fontSize:size,lineHeight:line}]}>{text}</ReviewText></View>)}</View>;
}
/** One review, every word shown: what is wrong, why, what you said, what to say and do instead. */
function ReviewCard({issue,meta,count}:{issue:ReviewIssue;meta:string;count:string}){
 const {c}=useTheme();
 const kicker=(text:string,color:string)=><ReviewText style={[styles.kicker,{color,fontSize:12.5,lineHeight:16}]}>{text}</ReviewText>;
 return <View style={[styles.card,{padding:18,borderRadius:22,borderColor:c.hair,backgroundColor:c.surface06}]}>
  <View style={[styles.cardTop,{gap:8}]}>{kicker(`${meta} · ${count.toUpperCase()}`,c.secondary)}
   {!!issue.gain&&<ReviewText style={[styles.gain,{color:c.accent,backgroundColor:c.accentSoft,fontSize:13,lineHeight:18,paddingHorizontal:9,paddingVertical:2}]}>{`+${issue.gain} pts`}</ReviewText>}</View>
  <ReviewText verbatim style={[styles.headline,{color:c.text,marginTop:8,fontSize:22,lineHeight:28}]}>{issue.headline}</ReviewText>
  {!!issue.explanation.length&&<View style={{marginTop:8}}><Bullets items={issue.explanation} color={c.secondary} dot={c.tertiary} size={15} line={21}/></View>}
  {!!issue.quote&&<View style={[styles.said,{borderRadius:16,marginTop:14,padding:12,paddingHorizontal:14,backgroundColor:c.surface08}]}>{kicker('YOU SAID',c.tertiary)}
   <ReviewText verbatim style={[styles.quote,{color:c.body,marginTop:5,fontSize:15.5,lineHeight:21}]}>{`“${issue.quote.text}”`}</ReviewText></View>}
  {!!(issue.example||issue.steps.length)&&<View style={[styles.try,{borderRadius:16,marginTop:10,padding:14,backgroundColor:c.accentSoft,borderColor:c.accent}]}>
   {!!issue.example&&<>{kicker('TRY SAYING',c.accent)}<ReviewText verbatim style={[styles.example,{color:c.text,marginTop:5,fontSize:16.5,lineHeight:22}]}>{`“${issue.example}”`}</ReviewText>
    {!!issue.steps.length&&<View style={[styles.split,{backgroundColor:c.accent,marginVertical:12}]}/>}</>}
   {!!issue.steps.length&&<>{kicker('DO THIS',c.accent)}<View style={{marginTop:6}}><Bullets items={issue.steps} color={c.text} dot={c.accent} size={15} line={20}/></View></>}
  </View>}
 </View>;
}
type Criterion={id:string;label:string;level:Parameters<typeof levelLabel>[0];points:number|null;maximum_points:number|null;reason:string|null};
/** The last page leads with the three feedback sections; exceptional and legacy recovery follows them. */
function SlideSummary({status,empty,notices,strength,mustCover,criteria,actions,children}:{status:string;empty:[string,string]|null;notices:string[];strength:string|null;
 mustCover:{point:string;status:'covered'|'partial'|'missing'}[];criteria:Criterion[];actions:ReactNode;children:ReactNode}){
 const {c}=useTheme(),ui=useUiText();
 const kicker=(text:string,color:string)=><ReviewText style={[styles.kicker,{color,fontSize:12.5,lineHeight:16}]}>{text}</ReviewText>;
 const body=(text:string,color:string)=><ReviewText verbatim style={[styles.bodyText,{color,fontSize:15,lineHeight:21}]}>{text}</ReviewText>;
 const block={padding:20,borderRadius:22,borderWidth:1,borderColor:c.hair,backgroundColor:c.surface04,gap:10};
 const hasFeedback=!!strength||mustCover.length>0||criteria.length>0;
 const hasRecovery=!!children||notices.length>0||!!actions;
 return <View style={{gap:16}}>
  {/* OpenAI Codex, 2026-11-21: replace the former status/action card with a concise summary title. */}
  <ReviewText style={[styles.summaryTitle,{color:c.text,fontSize:22,lineHeight:28}]}>Overall per-slide feedback</ReviewText>
  {!!strength&&<View style={[block,{borderColor:c.good}]}>{kicker('WHAT WORKED',c.good)}{body(strength,c.body)}</View>}
  {!!mustCover.length&&<View style={block}>{kicker('MUST COVER',c.secondary)}
   {mustCover.map((m,i)=><View key={i} style={[styles.must,{gap:8}]}><ReviewText style={[styles.mustIcon,{width:18,color:m.status==='covered'?c.good:m.status==='partial'?c.gold:c.bad,fontSize:15,lineHeight:21}]}>{m.status==='covered'?'✓':m.status==='partial'?'◐':'✗'}</ReviewText>
    <View style={styles.flex}>{body(m.point,c.text)}</View></View>)}</View>}
  {!!criteria.length&&<View style={block}>{kicker('HOW IT WAS GRADED',c.secondary)}
   {criteria.map(cr=><View key={cr.id} style={{gap:3}}><View style={[styles.criterionTop,{gap:8}]}><ReviewText verbatim style={[styles.criterion,{color:c.text,fontSize:15.5,lineHeight:21}]}>{cr.label}</ReviewText>
    <ReviewText style={[styles.level,{color:scoreLevelColor(cr.level,c),fontSize:13.5,lineHeight:21}]}>{cr.level?`${ui(levelLabel(cr.level))} · ${Math.round((cr.points??0)*10)/10}/${cr.maximum_points}`:'Not assessed'}</ReviewText></View>
    {!!cr.reason&&body(cr.reason,c.secondary)}</View>)}</View>}
  {(!hasFeedback||hasRecovery)&&<View style={block}>{kicker('FEEDBACK STATUS',c.secondary)}
   {!hasFeedback&&empty?<><ReviewText style={[styles.headline,{color:c.text,fontSize:22,lineHeight:28}]}>{empty[0]}</ReviewText>{!!empty[1]&&body(ui(empty[1]),c.secondary)}</>:null}
   <ReviewText accessibilityLiveRegion="polite" style={[styles.status,{color:c.text,fontSize:15,lineHeight:21}]}>{status}</ReviewText>
   {notices.map((text,i)=><ReviewText key={i} style={[styles.bodyText,{color:c.secondary,fontSize:14,lineHeight:20}]}>{text}</ReviewText>)}
   {actions&&<View style={[styles.actions,{gap:10,marginTop:4}]}>{actions}</View>}
   {children}
  </View>}
 </View>;
}
/** A legacy timing finding: it has no page of its own, so it is shown in full on the last page. */
function SummaryFinding({observation,suggestion}:{observation:string;suggestion:string}){
 const {c}=useTheme();
 return <View style={{gap:4}}><ReviewText verbatim style={[styles.status,{color:c.text,fontSize:15,lineHeight:21}]}>{observation}</ReviewText>
  {!!suggestion&&<ReviewText verbatim style={[styles.bodyText,{color:c.secondary,fontSize:15,lineHeight:21}]}>{suggestion}</ReviewText>}</View>;
}
function Action({label,onPress,disabled=false,primary=false}:{label:string;onPress:()=>void;disabled?:boolean;primary?:boolean}){
 const {c}=useTheme(),ui=useUiText();
 return <Pressable accessibilityRole="button" accessibilityLabel={ui(label)} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={[styles.action,{minHeight:44,paddingHorizontal:16,borderRadius:16},primary?{backgroundColor:c.accent}:{borderWidth:1,borderColor:c.hair},{opacity:disabled?0.45:1}]}>
  <ReviewText style={[styles.actionText,{fontSize:15,color:primary?c.onAccent:c.text}]}>{label}</ReviewText></Pressable>;
}
const styles=StyleSheet.create({
 content:{position:'absolute',left:CONTENT_INSET,right:CONTENT_INSET,top:CONTENT_TOP},
 slideRow:{marginTop:5,minHeight:76,flexDirection:'row',alignItems:'center',gap:12},
 thumb:{width:128,height:72,borderRadius:12,overflow:'hidden'},facts:{flex:1,minWidth:0},fact:{fontFamily:F.semibold,fontSize:14,lineHeight:20,fontVariant:['tabular-nums']},
 play:{width:44,height:44,borderRadius:22,borderWidth:1,alignItems:'center',justifyContent:'center'},
 box:{flex:1,minHeight:0,marginTop:14},reviewScroll:{flex:1},
 card:{borderRadius:22,borderWidth:1},cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 kicker:{flexShrink:1,fontFamily:F.bold,letterSpacing:1.1},gain:{flexShrink:1,fontFamily:F.bold,borderRadius:999,paddingHorizontal:9,paddingVertical:2,overflow:'hidden'},
 headline:{fontFamily:F.display,letterSpacing:-0.2},bullet:{flexDirection:'row',alignItems:'flex-start',gap:10},bulletDot:{width:5,height:5,borderRadius:3},
 bulletText:{flex:1,minWidth:0,fontFamily:F.medium},said:{borderRadius:16},quote:{fontFamily:F.medium},try:{borderRadius:16,borderWidth:1.5},
 example:{fontFamily:F.semibold},split:{height:1,opacity:0.35},status:{fontFamily:F.semibold},bodyText:{fontFamily:F.medium},
 actions:{flexDirection:'row',flexWrap:'wrap'},action:{minHeight:44,paddingHorizontal:16,borderRadius:16,justifyContent:'center'},actionText:{fontFamily:F.bold,fontSize:15},
 must:{flexDirection:'row',alignItems:'flex-start',gap:8},mustIcon:{width:18,fontFamily:F.bold},flex:{flex:1,minWidth:0},
 criterionTop:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8},criterion:{flexGrow:1,flexShrink:1,fontFamily:F.bold},level:{flexShrink:1,fontFamily:F.bold},
 summaryTitle:{fontFamily:F.display,letterSpacing:-0.2},
 header:{paddingHorizontal:6,alignItems:'center'},title:{fontFamily:F.display,fontSize:18,lineHeight:23},label:{fontFamily:F.medium,fontSize:14,lineHeight:18,textAlign:'center'},
 slideHero:{position:'absolute',left:24,right:24,top:100,height:160,borderRadius:18,overflow:'hidden'},heroScrim:{position:'absolute',left:0,right:0,top:0,bottom:0,justifyContent:'flex-end',padding:18,backgroundColor:'rgba(0,0,0,0.24)'},heroLabel:{fontFamily:F.bold,fontSize:13.5,letterSpacing:1.1,color:'#FFFFFF'},heroTitle:{maxWidth:245,fontFamily:F.display,fontSize:23,lineHeight:27,color:'#FFFFFF'},scoreBadge:{position:'absolute',top:5,right:5,minWidth:46,height:26,borderRadius:13,paddingHorizontal:8,alignItems:'center',justifyContent:'center'},scoreBadgeText:{fontFamily:F.bold,fontSize:14},heroPlay:{position:'absolute',right:14,bottom:14,width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},
 issueCard:{position:'absolute',left:24,right:24,top:284,height:310,borderRadius:24,borderWidth:1,padding:20,gap:10},issueTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},issueMeta:{fontFamily:F.bold,fontSize:13.5,letterSpacing:.4},issueMetaFlex:{flexShrink:1},issueTitle:{fontFamily:F.display,fontSize:22,lineHeight:28},issueBody:{fontFamily:F.medium,fontSize:15,lineHeight:22},evidence:{marginTop:2,paddingTop:12,borderTopWidth:1,gap:4},evidenceHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},evidenceLabel:{fontFamily:F.bold,fontSize:13.5,letterSpacing:.5},evidenceListen:{minHeight:36,paddingHorizontal:10,borderRadius:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},evidenceListenText:{fontFamily:F.semibold,fontSize:13.5},evidenceQuote:{fontFamily:F.medium,fontSize:15,lineHeight:20},detailsLink:{marginTop:'auto',minHeight:44,justifyContent:'center'},detailsLinkText:{fontFamily:F.semibold,fontSize:14},
 dots:{position:'absolute',top:604,left:24,right:24,height:24,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5},dotHit:{width:22,height:24,alignItems:'center',justifyContent:'center'},dot:{width:6,height:6,borderRadius:3},chips:{position:'absolute',top:634,left:24,right:24,height:36,flexDirection:'row',alignItems:'center',gap:6},chip:{flex:1,minWidth:0,height:34,paddingHorizontal:6,borderRadius:17,borderWidth:1,alignItems:'center',justifyContent:'center'},chipText:{fontFamily:F.semibold,fontSize:13.5},
 ringRow:{flexDirection:'row',alignItems:'center',gap:18,paddingHorizontal:8},ringRight:{flex:1,minWidth:0,gap:10},slideLabel:{fontFamily:F.semibold,fontSize:13.5},
 stat:{flexDirection:'row',alignItems:'center',gap:7},statValue:{fontFamily:F.display,fontSize:18,fontVariant:['tabular-nums']},statUnit:{flexShrink:1,fontFamily:F.medium,fontSize:13.5,lineHeight:18},
 timesBlock:{height:88},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline'},section:{fontFamily:F.bold,fontSize:14},bars:{height:44,marginTop:4},barRow:{height:44,flexDirection:'row',alignItems:'flex-end',gap:1},barHit:{position:'relative',flex:1,minWidth:0,height:44,alignItems:'center',justifyContent:'flex-end'},
 slideCard:{marginTop:18,borderWidth:1,borderRadius:20,padding:14,gap:11},slidePreviewRow:{flexDirection:'row',alignItems:'center',gap:12},slideFacts:{flex:1,minWidth:0,gap:4},previewTitle:{fontFamily:F.display,fontSize:15,lineHeight:18},slideTime:{fontFamily:F.semibold,fontSize:13.5,lineHeight:18,fontVariant:['tabular-nums']},targetStatus:{fontFamily:F.semibold,fontSize:13.5,lineHeight:18},feedbackRows:{gap:8,minHeight:44},feedbackRow:{minHeight:22,flexDirection:'row',alignItems:'center',gap:8},feedbackText:{flex:1,minWidth:0,fontFamily:F.medium,fontSize:13.5,lineHeight:18},playbackStrip:{minHeight:36,flexDirection:'row',alignItems:'center',gap:8},playTrack:{height:5,flex:1,borderRadius:3,overflow:'hidden'},playProgress:{height:5},playTime:{fontFamily:F.medium,fontSize:13.5,fontVariant:['tabular-nums']},playError:{fontFamily:F.medium,fontSize:13.5,lineHeight:18},
 feedbackDetails:{position:'absolute',left:24,right:24,top:180,bottom:180,borderRadius:20,borderWidth:1,padding:16},detailsHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},detailsClose:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},detailsScroll:{flex:1},detailsBody:{paddingTop:12,paddingBottom:16,gap:20},detailsFinding:{gap:8},detailsText:{fontFamily:F.medium,fontSize:16,lineHeight:24},
 fullReview:{position:'absolute',left:16,right:16,bottom:68,height:58,borderWidth:1,borderRadius:18,overflow:'hidden',alignItems:'center',justifyContent:'center'},fullReviewTitle:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
});
