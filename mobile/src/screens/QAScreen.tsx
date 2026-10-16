// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: Audience Q&A (SPEC §4.7, §5.7).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { MiniSlide } from '../design/SlideCard';
import { C, EASE_SCREEN, EASE_SNAP, F, HUES, TONE } from '../design/tokens';
import { Dialog, HintRow, IDLE_WAVE, RecordButton, RecordRing, Waveform, type Hint, type RecordGlyph } from '../design/ui';
import type { IconKey } from '../domain/analysis';
import { fmt, quote } from '../domain/format';
import { BACK_T } from '../domain/gestures';
import { randomUUID } from 'expo-crypto';
import { API_URL } from '../services/api';
import { readReview } from '../features/transcription/reviewStorage';
import { useDurableQa } from '../features/qa/useDurableQa';
import { qaActive,qaHistoryJobs,qaScreenKey } from '../features/qa/state';
import { sentences } from '../domain/lines';
import { AnswerRecorder, type AnswerHandle } from '../features/qa/AnswerRecorder';
import { reviewDurableAnswer, QaError, type QaResult } from '../features/qa/client';
import { answerKey, readQaV2, readQaHistory, saveQaV2, saveAnswerAttempt, type QaSet, type StoredAnswer } from '../features/qa/store';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { useBack, useShell } from './shared';


export function QAScreen() {
  const { nav } = useShell();
  const model = useDeckModel(nav.deckId);
  if (!model?.state.run) return null;
  return <QABound key={model.state.run.id} model={model} />;
}

function QABound({model}:{model:DeckModel}){
  const qa=useDurableQa(model);
  const [archivedIndex,setArchivedIndex]=useState<number|null>(null);
  const history=qaHistoryJobs(readQaHistory(API_URL,model.deck.id),qa.state);
  const archived=archivedIndex===null?null:history[archivedIndex]??null;
  const nextHistory=()=>setArchivedIndex(i=>i===null?0:i+1<history.length?i+1:null);
  return <QA key={archived?`saved-${archived.jobId??'legacy'}`:qaScreenKey(qa.state)} model={model} qa={qa}
    archived={archived} historyAvailable={!!history.length} onHistory={nextHistory}/>;
}
function QA({ model,qa,archived,historyAvailable,onHistory }: { model: DeckModel;qa:ReturnType<typeof useDurableQa>;archived:QaSet|null;historyAvailable:boolean;onHistory:()=>void }) {
  const { go, nav } = useShell();
  const frame = useFrame();
  const { deck, state } = model;
  const run = state.run!;
  const jobId=archived?.jobId??qa.state?.result?.job_id??0;
  const questions=archived?.questions??(qa.state&&!qa.state.stale&&!qa.state.result?.stale&&qa.state.state==='completed'?qa.state.result?.questions??[]:[]);
  const [set,setSet]=useState<QaSet|null>(()=>{
    if(archived)return archived;
    if(!jobId||!questions.length)return null;
    const cached=readQaV2(API_URL,deck.id,jobId);
    // Adopt the complete validated server batch, retaining answers for this job.
    const next={...cached,runId:run.id,audience:qa.state!.requirements.audience,questions,answers:cached?.answers??{},createdAt:cached?.createdAt??new Date().toISOString()};
    saveQaV2(API_URL,deck.id,jobId,next);return next;
  });
  const [load,setLoad]=useState<{kind:'idle'|'loading'|'error';message?:string}>({kind:'idle'});
  const [answerAsk,setAnswerAsk]=useState<{k:string;qi:number;p:0|1;a:StoredAnswer}|null>(null);
  const submissions=useRef(new Map<string,AbortController>());
  useEffect(()=>{const active=submissions.current;return()=>{active.forEach(c=>c.abort());active.clear();};},[]);
  const [position, setI] = useState(0);
  const [part, setPart] = useState<0 | 1>(0);
  const [count, setCount] = useState(0);
  const [rec, setRec] = useState(false);
  const [hear, setHear] = useState<string | null>(null);
  const [recKey, setRecKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<AnswerHandle>(null);
  const [wave, setWave] = useState<number[]>(IDLE_WAVE);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringP = useSharedValue(0), ringV = useSharedValue(0);
  const dx = useSharedValue(0), dy = useSharedValue(0), gone = useSharedValue(0);
  const player = useSegmentPlayer();
  const hue = HUES[deck.hue];

  const regenerate=()=>{setLoad({kind:'idle'});void qa.generate();};
  const qs = archived?.questions??(questions.length?set?.questions??questions:[]);
  const i=Math.min(position,Math.max(0,qs.length-1));
  const Q = qs[i];
  const key = answerKey(i, part);
  const ans: StoredAnswer | undefined = set?.answers[key];
  const phase: 'ask' | 'rec' | 'review' = rec ? 'rec' : ans ? 'review' : 'ask';
  const last = i === qs.length - 1;

  // ── Speech ────────────────────────────────────────────────────────────────
  const stopSpeak = useCallback(() => { Speech.stop(); setHear(null); }, []);
  const speak = useCallback((text: string, k: string) => {
    if (hear === k) { stopSpeak(); return; }
    Speech.stop(); player.stop();
    setHear(k);
    Speech.speak(text, { onDone: () => setHear(h => (h === k ? null : h)), onStopped: () => setHear(h => (h === k ? null : h)), onError: () => setHear(null) });
  }, [hear, player, stopSpeak]);
  useEffect(() => () => { Speech.stop(); }, []);
  const playAnswer = () => {
    if (!ans) return;
    stopSpeak();
    void player.play('a' + key, { uri: ans.audioUri, startMs: 0, endMs: ans.durationMs });
  };

  // ── Answering ─────────────────────────────────────────────────────────────
  const update=(k:string,a:StoredAnswer)=>{
    const target=a.questionJobId;
    if(!target)return;
    saveAnswerAttempt(API_URL,deck.id,a);
    const saved=readQaV2(API_URL,deck.id,target);
    if(!saved)return;
    // Late responses from an older rerecording cannot replace the newer answer.
    if(saved.answers[k]?.id&&saved.answers[k].id!==a.id)return;
    const next={...saved,answers:{...saved.answers,[k]:a}};
    saveQaV2(API_URL,deck.id,target,next);
    if(target===jobId)setSet(prev=>prev?.questions[0]?.id===next.questions[0]?.id?next:prev);
  };
  const judge=async(k:string,qi:number,p:0|1,a:StoredAnswer,confirmed=false,retry=true)=>{
    const q=qs[qi];if(!q||!a.id||!a.questionId||!a.questionJobId||submissions.current.has(a.id))return;
    const anchor=qa.state?.attempt_id,deckId=anchor?readReview(API_URL,anchor)?.deck_id:null;
    if(!deckId){update(k,{...a,status:'error',error:'Presentation is not synchronized.'});return;}
    const controller=new AbortController();submissions.current.set(a.id,controller);
    update(k,{...a,status:'judging',error:undefined});
    try{
      const result:QaResult=await reviewDurableAnswer({id:a.id,deckId,audioUri:a.audioUri,durationMs:a.durationMs,
        questionJobId:a.questionJobId,questionId:a.questionId,part:p,slideIndex:q.slide_index},confirmed,controller.signal,retry);
      update(k,{...a,status:'done',result});
    }catch(e){
      if(controller.signal.aborted)return;
      if(e instanceof QaError&&e.code==='confirmation_required')setAnswerAsk({k,qi,p,a});
      update(k,{...a,status:'error',error:e instanceof Error?e.message:'The answer could not be reviewed.'});
    }finally{submissions.current.delete(a.id);}
  };
  const resume=useRef(judge);useEffect(()=>{resume.current=judge;});
  useEffect(()=>{
    if(!set||archived)return;
    for(const [k,a]of Object.entries(set.answers))if(a.status==='judging'){
      const [qi,p]=k.split('-').map(Number);void resume.current(k,qi,p as 0|1,a,false,false);
    }
  },[jobId,set,archived]);
  const stopCount = () => { if (countTimer.current) { clearInterval(countTimer.current); countTimer.current = null; } };
  useEffect(() => () => stopCount(), []);
  const startRec = async () => {
    try {
      await recorder.current?.start();
      setWave(Array(28).fill(6));
      setElapsed(0); setRec(true);
      ringP.set(0); ringV.set(1);
    } catch (e) {
      ringV.set(withTiming(0));
      setLoad({ kind: 'error', message: e instanceof Error ? e.message : 'Could not start recording.' });
      setRecKey(k => k + 1);
    }
  };
  const stopRec = async () => {
    if (!recorder.current?.recording()) return;
    const k = key, qi = i, p = part;
    try {
      const { uri, durationMs } = await recorder.current.stop();
      setRec(false); ringV.set(withTiming(0, { duration: 200 })); setRecKey(x => x + 1);
      const a: StoredAnswer = { id:randomUUID(),questionId:Q?.id,questionJobId:jobId,audioUri: uri, durationMs, status: 'judging', at: new Date().toISOString() };
      // Persist the new identity before any network request; retain previous attempts separately.
      if(set){const next={...set,answers:{...set.answers,[k]:a}};saveQaV2(API_URL,deck.id,jobId,next);setSet(next);}
      update(k, a);
      void judge(k, qi, p, a);
    } catch (e) {
      setRec(false); ringV.set(withTiming(0)); setRecKey(x => x + 1);
      setLoad({ kind: 'error', message: e instanceof Error ? e.message : 'The answer could not be saved.' });
    }
  };
  const toggleRec = () => {
    if (!Q||archived) return;
    if (rec) { void stopRec(); return; }
    if (count) { stopCount(); setCount(0); ringV.set(withTiming(0)); return; }
    stopSpeak(); player.stop();
    setCount(3); ringV.set(1); ringP.set(1);
    ringP.set(withTiming(0, { duration: 3000, easing: Easing.linear }));
    const t0 = Date.now();
    countTimer.current = setInterval(() => {
      const el = Date.now() - t0;
      if (el >= 3000) { stopCount(); setCount(0); void startRec(); return; }
      setCount(c => { const nx = 3 - Math.floor(el / 1000); if (nx !== c) void Haptics.selectionAsync().catch(() => undefined); return nx; });
    }, 50);
  };
  const onMeter = (db: number, ms: number) => {
    const level = Math.max(0, Math.min(1, (db + 60) / 50));
    setWave(w => [...w.slice(1), 6 + level * 24]);
    setElapsed(ms / 1000);
    ringP.set(withTiming(Math.min(1, ms / 1000 / (part ? 60 : 90)), { duration: 80 }));
  };

  // ── Navigation between items and questions ────────────────────────────────
  const goQ = (dir: -1 | 1) => {
    const ni = i + dir;
    if (rec || count || ni < 0 || ni >= qs.length) { dx.set(withTiming(0, { duration: 280, easing: EASE_SNAP })); return; }
    stopSpeak(); player.stop();
    setI(ni);
    setPart(set?.answers[answerKey(ni, 1)] ? 1 : 0);
    dx.set(dir * 80);
    dx.set(withTiming(0, { duration: 280, easing: EASE_SNAP }));
  };
  const back = useCallback(() => {
    if (rec || count) return;
    stopSpeak(); player.stop();
    gone.set(1); dy.set(withTiming(520, { duration: 280 }));
    setTimeout(() => go('review', { nav: 'fade', deckId: deck.id, sel: nav.sel }), 280);
  }, [count, deck.id, dy, go, gone, nav.sel, player, rec, stopSpeak]);
  const g = useRef<'x' | 'y' | null>(null);
  const busy = rec || !!count;
  const pan = {
    onMoveShould: (e: GestureResponderEvent, gs: PanResponderGestureState) => {
      if (busy) return false;
      const y = (e.nativeEvent.pageY - frame.top) / frame.s;
      if (Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy)) { g.current = 'x'; return true; }
      if (gs.dy > 8 && gs.dy > Math.abs(gs.dx) && !(phase === 'review' && y > 158 && y < 648)) { g.current = 'y'; return true; }
      return false;
    },
    onMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
      if (g.current === 'x') {
        const x = gs.dx / frame.s;
        dx.set((x > 0 && i === 0) || (x < 0 && i === qs.length - 1) ? x * 0.3 : x);
      } else { const d = Math.max(0, gs.dy / frame.s); dy.set(d > 160 ? 160 + (d - 160) * 0.5 : d); }
    },
    onRelease: () => {
      if (g.current === 'x') { if (Math.abs(dx.get()) > 60) goQ(dx.get() < 0 ? 1 : -1); else dx.set(withTiming(0, { duration: 280, easing: EASE_SNAP })); }
      else if (dy.get() > BACK_T) back();
      else dy.set(withTiming(0, { duration: 320, easing: EASE_SCREEN }));
      g.current = null;
    },
    onTerminate: () => { dx.set(withTiming(0)); dy.set(withTiming(0)); g.current = null; },
  };
  useBack(true, () => { back(); return true; });
  const screen = useAnimatedStyle(() => ({ opacity: gone.value ? withTiming(0, { duration: 260 }) : Math.max(0.15, 1 - dy.value / 260), transform: [{ translateY: dy.value * 0.55 }] }));
  const slideStyle = useAnimatedStyle(() => ({ opacity: Math.max(0.2, 1 - Math.abs(dx.value) / 240), transform: [{ translateX: dx.value }] }));
  useEffect(() => () => { cancelAnimation(ringP); }, [ringP]);

  // ── View ──────────────────────────────────────────────────────────────────
  const face = HUES[deck.hue].face;
  const hearing = (k: string) => hear === k;
  const glyph: RecordGlyph = count ? (count as 3 | 2 | 1) : rec ? 'stop' : phase === 'review' ? 'redo' : 'mic';
  const btnLabel = archived?'Saved Q&A · playback only':count ? `Starting in ${count}. Tap to cancel` : rec ? 'Stop answering' : phase === 'review' ? (part ? 'Answer the follow-up again' : 'Answer the question again') : (part ? 'Answer the follow-up' : 'Answer the question');
  const hints: Hint[] = count ? [{ icon: 'h-tap', text: 'Tap to cancel' }] : rec ? [{ icon: 'h-tap', text: 'Tap when done' }]
    : [...(!Q||last ? [] : [{ icon: 'h-spin' as const, text: 'Next' }]), { icon: 'h-dn', text: 'Back', nudge: 'down' }];
  const result = ans?.status === 'done' ? ans.result : undefined;
  const short = result?.verdict === 'too_short';
  const verdict = !result ? null : short ? { text: 'Too short', tone: TONE.bad, icon: 'i-clock' as IconKey }
    : result.verdict === 'answered' ? { text: 'Answered', tone: TONE.good, icon: 'i-check' as IconKey } : { text: 'Partly answered', tone: TONE.warn, icon: 'i-flag' as IconKey };
  const rows: { icon: IconKey; k: string; t: string }[] = !result ? [] : short ? [
    { icon: 'i-clock', k: 'Did it answer?', t: 'You stopped after ' + fmt((ans?.durationMs ?? 0) / 1000) + ' — not enough to judge.' },
    { icon: 'i-bulb', k: 'Clarify', t: 'Aim for ' + (part ? '30–60' : '60–90') + ' seconds. Tap the red button to try again.' },
  ] : ([
    { icon: result.verdict === 'answered' ? 'i-check' : 'i-flag', k: 'Did it answer?', t: result.did },
    { icon: 'i-chart', k: 'Evidence', t: result.evidence },
    { icon: 'i-bulb', k: 'Clarify', t: result.clarify },
  ] as { icon: IconKey; k: string; t: string }[]).filter(r => r.t);
  const ansLines = result ? sentences(result.transcript).map(s => ({ time: fmt(result.transcript.words[s.first].start_ms / 1000), text: s.text })) : [];

  return (
    <Enter kind={nav.nav}>
      <AnswerRecorder key={recKey} ref={recorder} onMeter={onMeter} onMustStop={() => { void stopRec(); }} />
      <PanView style={StyleSheet.absoluteFill} {...pan}>
        <Animated.View style={[StyleSheet.absoluteFill, screen]}>
          <View style={styles.header} pointerEvents="none">
            <Txt style={styles.title}>{archived?"Saved Q&A":"Audience Q&A"}</Txt>
            <Txt numberOfLines={1} style={styles.label}>{Q ? 'Question ' + (i + 1) + ' of ' + qs.length + ' · ' + ((set?.audience ?? qa.state?.requirements.audience ?? '')+(!archived&&model.deck.requirementsDefault?' (default)':'')) : qaActive(qa.state) ? 'Writing audience questions…' : (qa.state?.requirements.audience || 'Audience not set')}</Txt>
          </View>
          {historyAvailable&&<Pressable accessibilityRole="button" accessibilityLabel={archived?'Next saved Q&A or return to current questions':'View saved Q&A'} onPress={()=>{if(rec||count)return;stopSpeak();player.stop();onHistory();}}
            style={{position:'absolute',top:18,left:16,zIndex:10,paddingVertical:6,paddingHorizontal:10}}>
            <Txt style={{fontSize:12,color:C.secondary}}>{archived?'Next saved / Current Q&A':'Saved Q&A'}</Txt>
          </Pressable>}
          {Q && (
            <Animated.View style={[styles.stage, slideStyle]}>
              <View style={styles.panelist} pointerEvents="none">
                <View style={[styles.avatar, { boxShadow: `0px 8px 16px ${hue.glow}` }]}>
                  <Svg style={StyleSheet.absoluteFill}><Defs><LinearGradient id={'qaFace' + deck.hue} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={face[0]} /><Stop offset="1" stopColor={face[1]} /></LinearGradient></Defs>
                    <Rect width="100%" height="100%" fill={`url(#qaFace${deck.hue})`} /></Svg>
                  <Txt style={styles.who}>{Q.panelist}</Txt>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={styles.role}>{Q.role}</Txt>
                  <Txt numberOfLines={1} style={styles.meta}>{'Asked after slide ' + (Q.slide_index + 1) + (Q.topic ? ' · ' + Q.topic : '')}</Txt>
                </View>
              </View>
              <View style={[styles.col, { height: rec ? 370 : 490 }]}>
                <ScrollView scrollEnabled={phase === 'review'} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 24, flexGrow: 1 }}>
                  {phase !== 'review' && part === 0 && (
                    <Pressable accessibilityRole="button" accessibilityLabel={(hearing('q' + i) ? 'Stop the question: ' : 'Hear the question: ') + Q.question}
                      onPress={() => !rec && speak(Q.question, 'q' + i)} style={{ gap: 10 }}>
                      <Txt style={[styles.qBig, { fontSize: rec ? 18 : 22, lineHeight: (rec ? 18 : 22) * 1.28 }]}>{quote(Q.question)}</Txt>
                      {!rec && <HearHint playing={hearing('q' + i)} />}
                    </Pressable>
                  )}
                  {(phase === 'review' || part === 1) && (
                    <Pressable accessibilityRole="button" accessibilityLabel={part ? 'Back to the question: ' + Q.question : 'Hear the question: ' + Q.question}
                      onPress={() => { if (rec || count) return; if (part === 1) { stopSpeak(); setPart(0); } else speak(Q.question, 'q' + i); }}>
                      <Txt style={styles.over}>{part ? 'Question · tap to go back' : 'Question'}</Txt>
                      <Txt numberOfLines={3} style={styles.qSmall}>{quote(Q.question)}</Txt>
                    </Pressable>
                  )}
                  {phase === 'review' && part === 1 && (
                    <Pressable accessibilityRole="button" accessibilityLabel={'Hear the follow-up: ' + Q.follow_up} onPress={() => speak(Q.follow_up, 'f' + i)}>
                      <Txt style={[styles.over, { color: '#FFC266' }]}>{'Follow-up · ' + Q.panelist}</Txt>
                      <Txt numberOfLines={3} style={styles.fSmall}>{quote(Q.follow_up)}</Txt>
                    </Pressable>
                  )}
                  {part === 1 && phase !== 'review' && (
                    <Pressable accessibilityRole="button" accessibilityLabel={(hearing('f' + i) ? 'Stop the follow-up: ' : 'Hear the follow-up: ') + Q.follow_up}
                      onPress={() => !rec && speak(Q.follow_up, 'f' + i)} style={{ gap: 8 }}>
                      <Txt style={[styles.over, { color: '#FFC266' }]}>{'Follow-up · ' + Q.panelist}</Txt>
                      <Txt style={styles.fBig}>{quote(Q.follow_up)}</Txt>
                      {phase === 'ask' && <HearHint playing={hearing('f' + i)} />}
                    </Pressable>
                  )}
                  {phase === 'ask' && (
                    <View style={styles.slideBox} pointerEvents="none">
                      <MiniSlide hue={deck.hue} page={deck.pages[Q.slide_index]} title={deck.slides[Q.slide_index]?.title ?? ''} width={220} height={124} radius={16} num={Q.slide_index + 1} />
                      <Txt style={styles.slideCap}>{'From slide ' + (Q.slide_index + 1)}</Txt>
                    </View>
                  )}
                  {rec && <View style={styles.listening}><Txt style={styles.listenText}>Listening…</Txt></View>}
                  {phase === 'review' && ans && <>
                    <Pressable accessibilityRole="button" accessibilityLabel="Play saved answer" onPress={playAnswer} style={styles.playChip}><Glyph name={player.playingKey==='a'+key?'p-pause':'p-play'} size={14}/><Txt style={styles.playText}>{'Saved audio · '+fmt(ans.durationMs/1000)}</Txt></Pressable>
                    {ans.status === 'judging' && <Row icon="i-wave" k="Your answer" t="Transcribing and reviewing your answer…" />}
                    {ans.status === 'error' && !archived && (
                      <Pressable accessibilityRole="button" onPress={() => void judge(key, i, part, ans)}><Row icon="i-flag" k="Couldn’t review this answer" t={(ans.error || '') + ' Tap to try again.'} /></Pressable>
                    )}
                    {verdict && (
                      <View style={styles.verdictRow}>
                        <View style={[styles.verdict, { backgroundColor: verdict.tone.bg }]}><UIIcon name={verdict.icon} size={22} /><Txt style={[styles.verdictText, { color: verdict.tone.fg }]}>{verdict.text}</Txt></View>

                      </View>
                    )}
                    {rows.map(r => <Row key={r.k} icon={r.icon} k={r.k} t={r.t} />)}
                    {part === 0 && result && !short && Q.follow_up && (
                      <Pressable accessibilityRole="button" accessibilityLabel={'Follow-up from ' + Q.panelist + ': ' + Q.follow_up}
                        onPress={() => { if (count) return; stopSpeak(); setPart(1); }} style={styles.followCard}>
                        <Txt style={[styles.over, { color: '#FFC266' }]}>{'Follow-up · ' + Q.panelist}</Txt>
                        <Txt style={styles.followText}>{quote(Q.follow_up)}</Txt>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Glyph name="h-tap" size={16} /><Txt style={styles.followHint}>{set?.answers[answerKey(i, 1)] ? 'Answered · tap to view' : 'Tap to answer'}</Txt></View>
                      </Pressable>
                    )}
                    {!!ansLines.length && (
                      <View style={styles.ansBox} pointerEvents="none">
                        {ansLines.map((l, k) => <View key={k} style={{ flexDirection: 'row', gap: 8 }}><Txt style={styles.ansTime}>{l.time}</Txt><Txt style={styles.ansText}>{l.text}</Txt></View>)}
                      </View>
                    )}
                  </>}
                  {!rec&&<Txt style={styles.end}>{last?'Last question · swipe down for your review':'Swipe for the next question'}</Txt>}
                </ScrollView>
              </View>
            </Animated.View>
          )}
          {!Q && (
            <View style={styles.status} pointerEvents="box-none">
              <UIIcon name={load.kind === 'error' ? 'i-flag' : 'i-bubble'} size={44} />
              <Txt style={styles.statusText}>{load.message || qa.notice || (qa.state?.stale?'Questions outdated. Update using the selected recordings.':!qa.state?.requirements.audience?'Presentation audience is missing. Requirements entry is not available yet.':qaActive(qa.state)?'Your audience questions are being prepared…':qa.state?.dependency?.retry_action?'Slide profile analysis needs recovery.':qa.state?.state==='failed'?'Question generation failed. Your recordings are preserved.':'Audience questions are not ready.')}</Txt>
              {!qa.busy&&!qaActive(qa.state)&&!!qa.state?.requirements.audience&&<Pressable accessibilityRole="button" onPress={regenerate} style={styles.retry}><Txt style={styles.retryText}>{qa.state?.stale?'Update questions':'Retry questions'}</Txt></Pressable>}
            </View>
          )}
          {Q && load.kind === 'error' && <Txt style={styles.inlineError}>{load.message}</Txt>}
          {rec && <>
            <Txt style={styles.big}>{fmt(elapsed)}</Txt>
            <Txt style={styles.line}>{(part ? 'Follow-up · ' : '') + (part ? '30–60' : '60–90') + ' seconds is typical'}</Txt>
            <Waveform bars={wave} live />
          </>}
          <RecordRing progress={ringP} visible={ringV} />
          {!archived&&<RecordButton glyph={glyph} label={btnLabel} onPress={toggleRec} disabled={!Q} />}
          <HintRow hints={hints} />
        </Animated.View>
      </PanView>
      {(qa.ask||answerAsk)&&<Dialog title="Confirm retry" body="The previous request may have reached the provider and incurred a charge. Retry the same saved input?"
        confirm="Retry" onConfirm={()=>{if(answerAsk){const a=answerAsk;setAnswerAsk(null);void judge(a.k,a.qi,a.p,a.a,true);}else void qa.confirm();}}
        onCancel={()=>{setAnswerAsk(null);qa.cancel();}}/>}
    </Enter>
  );
}

function HearHint({ playing }: { playing: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Glyph name={playing ? 'p-pause' : 'p-play'} size={14} color={C.secondary} />
      <Txt style={styles.hear}>{playing ? 'Playing…' : 'Tap to hear'}</Txt>
    </View>
  );
}
function Row({ icon, k, t }: { icon: IconKey; k: string; t: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <UIIcon name={icon} size={22} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.rowK}>{k}</Txt>
        <Txt style={styles.rowT}>{t}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13, color: C.secondary },
  stage: { position: 'absolute', left: 0, top: 0, width: 390, height: 650 },
  panelist: { position: 'absolute', left: 16, right: 16, top: 102, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  who: { fontFamily: F.display, fontSize: 14, color: '#FFFFFF' },
  role: { fontFamily: F.bold, fontSize: 15, color: C.text },
  meta: { marginTop: 1, fontFamily: F.medium, fontSize: 12, color: C.secondary },
  col: { position: 'absolute', left: 16, right: 16, top: 158 },
  qBig: { fontFamily: F.display, letterSpacing: -0.3, color: C.text },
  hear: { fontFamily: F.semibold, fontSize: 12, color: C.secondary },
  over: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  qSmall: { marginTop: 4, fontFamily: F.medium, fontSize: 14, lineHeight: 19.6, color: C.secondary },
  fSmall: { marginTop: 4, fontFamily: F.semibold, fontSize: 14, lineHeight: 19.6, color: C.body },
  fBig: { fontFamily: F.display, fontSize: 20, lineHeight: 25.6, letterSpacing: -0.3, color: C.text },
  slideBox: { alignItems: 'center', gap: 10, marginTop: 8 },
  slideCap: { fontFamily: F.semibold, fontSize: 12, color: C.tertiary },
  listening: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 8 },
  listenText: { textAlign: 'center', fontFamily: F.medium, fontSize: 13, color: C.tertiary },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 3, paddingBottom: 3, paddingLeft: 4, paddingRight: 11, borderRadius: 999 },
  verdictText: { fontFamily: F.bold, fontSize: 13 },
  playChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingLeft: 8, paddingRight: 11, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  playText: { fontFamily: F.semibold, fontSize: 13, color: C.body, fontVariant: ['tabular-nums'] },
  rowK: { fontFamily: F.bold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  rowT: { marginTop: 2, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18.9, color: C.body },
  followCard: { gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255, 181, 71, 0.24)', borderRadius: 18, backgroundColor: 'rgba(255, 181, 71, 0.07)' },
  followText: { fontFamily: F.display, fontSize: 16, lineHeight: 20.8, color: C.text },
  followHint: { fontFamily: F.semibold, fontSize: 12, color: C.secondary },
  ansBox: { gap: 6, paddingTop: 10, paddingBottom: 10, paddingRight: 12, paddingLeft: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  ansTime: { width: 34, paddingTop: 2, textAlign: 'center', fontFamily: F.semibold, fontSize: 11, color: C.tertiary, fontVariant: ['tabular-nums'] },
  ansText: { flex: 1, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18.9, color: C.body },
  end: { marginTop: 4, textAlign: 'center', fontFamily: F.semibold, fontSize: 13, color: C.tertiary },
  status: { position: 'absolute', left: 40, right: 40, top: 300, alignItems: 'center', gap: 14 },
  statusText: { textAlign: 'center', fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.secondary },
  retry: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  retryText: { fontFamily: F.bold, fontSize: 14, color: C.text },
  inlineError: { position: 'absolute', left: 24, right: 24, top: 600, textAlign: 'center', fontFamily: F.medium, fontSize: 13, color: C.bad },
  big: { position: 'absolute', left: 0, right: 0, top: 548, textAlign: 'center', fontFamily: F.display, fontSize: 42, lineHeight: 44, letterSpacing: -1.3, color: C.text, fontVariant: ['tabular-nums'] },
  line: { position: 'absolute', left: 0, right: 0, top: 596, textAlign: 'center', fontFamily: F.semibold, fontSize: 14, color: C.secondary },
});
