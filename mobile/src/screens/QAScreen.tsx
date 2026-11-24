import { displayTranslations, useDisplayTranslation } from '../features/localization/useDisplayTranslation';
import { firstWordingPending, markNewWording } from '../features/localization/firstWording';
import { sourceLanguage } from '../features/localization/translationCache';
import { translatedAnswer } from '../features/localization/generatedProse';
// Scribe-only compatibility: OpenAI Codex, October 17, 2026; docs/testing/evidence/scribe-only-integration-verification-2026-10-17.md.
// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex finger-linked page fade: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-117
// OpenAI Codex audience setup: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-107
// OpenAI Codex light-mode Q&A: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-081
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OutLoud redesign: Audience Q&A (SPEC §4.7, §5.7).
// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-11-21): question page as canvas S15 (panel on top, the
// question as a chat message, its slide under it, a fixed space for your answer above the record button); audience names.
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { getAppLanguage, useAppLanguage, useUiText } from '../design/language';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Enter, Txt, useFrame } from '../design/frame';
import { Glyph, UIIcon } from '../design/icons';
import { PanView } from '../design/PanView';
import { MiniSlide } from '../design/SlideCard';
import { C, EASE_SCREEN, F, TONE } from '../design/tokens';
import { createThemedStyles, useTheme } from '../design/theme';
import { Dialog, HintRow, IDLE_WAVE, PageSurface, RecordButton, RecordRing, Waveform, type Hint, type RecordGlyph } from '../design/ui';
import type { IconKey } from '../domain/analysis';
import { AUDIENCES } from '../domain/presentationRequirements';
import { fmt, quote } from '../domain/format';
import { BACK_FADE_Y, BACK_T } from '../domain/gestures';
import { randomUUID } from 'expo-crypto';
import { API_URL } from '../services/api';
import { readReview } from '../features/transcription/reviewStorage';
import { useDurableQa } from '../features/qa/useDurableQa';
import { qaActive,qaHistoryJobs,qaScreenKey,qaUsable } from '../features/qa/state';
import { saveAnalysisConsent } from '../features/transcription/analysisStorage';
import { AnswerRecorder, type AnswerHandle } from '../features/qa/AnswerRecorder';
import { reviewDurableAnswer, QaError, type QaResult } from '../features/qa/client';
import { answerKey, readQaV2, readQaHistory, savedForSelectedRun, saveQaV2, saveAnswerAttempt, type QaSet, type StoredAnswer } from '../features/qa/store';
import { useSegmentPlayer } from '../features/rehearsal/useSegmentPlayer';
import { useDeckModel, type DeckModel } from '../features/presentations/useDeckModel';
import { useBack, useShell } from './shared';
import { SWIPE_ENTRY_X, useHorizontalSwipeMotion } from './swipeMotion';


/** The only names the audience panel uses. */
export const AUDIENCE_NAMES = ['Jaewon', 'Seoyeon', 'Injoon', 'Jooyoung'] as const;
/** OpenAI Codex, Iteration 2 (2026-11-21): shuffle the four display names per saved set, without repeating one
 * within its three questions. The job ID seeds the shuffle so reopening a set does not rename its audience. */
export function audienceNames(questions: readonly { panelist: string }[], jobId: number): Map<number, string> {
  const shuffled: string[] = [...AUDIENCE_NAMES];
  let seed = (Math.trunc(jobId) >>> 0) || 1;
  for (let k = shuffled.length - 1; k > 0; k--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swap = seed % (k + 1);
    [shuffled[k], shuffled[swap]] = [shuffled[swap], shuffled[k]];
  }
  return new Map(questions.map((_, index) => [index, shuffled[index % shuffled.length]]));
}
const initials = (name: string) => name.slice(0, 2);

export function QAScreen({ active = true }: { active?: boolean }) {
  const { nav } = useShell();
  const model = useDeckModel(nav.deckId);
  if (!model?.state.run) return null;
  return <QABound key={model.state.run.id} model={model} active={active} />;
}

function QABound({model,active}:{model:DeckModel;active:boolean}){
  const source=useDurableQa(model,false,active), language=useAppLanguage();
  useSyncExternalStore(displayTranslations.subscribe, displayTranslations.version);
  const batch=source.state?.result, first=batch?.questions[0];
  const waiting=active&&batch&&first&&qaUsable(source.state)&&firstWordingPending(API_URL,
    {kind:'questions',resource_id:String(batch.job_id)},'initial',language,displayTranslations,
    text=>text('questions.0.question',first.question));
  useDisplayTranslation(!!waiting, scope => waiting && scope('questions', String(batch!.job_id))('questions.0.question', first!.question));
  const qa=waiting&&source.state?{...source,state:{...source.state,state:'preparing',result:null}}:source;
  // Keep an explicit history choice on the same batch when a status refresh changes the list.
  const [selection,setSelection]=useState<string|null>();
  const history=qaHistoryJobs(readQaHistory(API_URL,model.deck.id),qa.state).filter(saved=>saved.questions.length);
  const archiveKey=(saved:QaSet)=>saved.jobId===undefined?'legacy':String(saved.jobId);
  const archived=selection===undefined
    ? (!qaUsable(qa.state)&&!qaActive(qa.state)?savedForSelectedRun(history,model.state.run!.id,
      qa.scope??{context_id:qa.requirements.contextId??null,slides:[]},qa.requirements.audience):null)??null
    : history.find(saved=>archiveKey(saved)===selection)??null;
  const nextHistory=()=>{
    const next=history[archived?history.indexOf(archived)+1:0];
    setSelection(next?archiveKey(next):null);
  };
  return <QA key={archived?`saved-${archived.jobId??'legacy'}`:qaScreenKey(qa.state)} model={model} qa={qa}
    archived={archived} historyAvailable={!!history.length} onHistory={nextHistory} active={active}/>;
}
function QA({ model,qa,archived,historyAvailable,onHistory,active }: { model: DeckModel;qa:ReturnType<typeof useDurableQa>;archived:QaSet|null;historyAvailable:boolean;onHistory:()=>void;active:boolean }) {
  const ui = useUiText();
  const { c } = useTheme();
  const { go, nav } = useShell();
  const frame = useFrame();
  const { deck, state } = model;
  const run = state.run!;
  const jobId=archived ? archived.jobId ?? 0 : qa.state?.result?.job_id ?? 0;
  const questions=archived?.questions??(qa.state&&!qa.state.stale&&!qa.state.result?.stale&&qa.state.state==='completed'?qa.state.result?.questions??[]:[]);
  const [set,setSet]=useState<QaSet|null>(()=>{
    if(archived)return archived;
    if(!jobId||!questions.length)return null;
    const cached=readQaV2(API_URL,deck.id,jobId);
    // Adopt the complete validated server batch, retaining answers for this job.
    const next={...cached,runId:run.id,scope:qa.state!.scope,audience:qa.state!.requirements.audience,questions,answers:cached?.answers??{},createdAt:cached?.createdAt??new Date().toISOString()};
    saveQaV2(API_URL,deck.id,jobId,next);return next;
  });
  const [load,setLoad]=useState<{kind:'idle'|'loading'|'error';message?:string}>({kind:'idle'});
  const [answerAsk,setAnswerAsk]=useState<{k:string;qi:number;p:0|1;a:StoredAnswer}|null>(null);
  const [answerConsent,setAnswerConsent]=useState<{k:string;qi:number;p:0|1;a:StoredAnswer;confirmed:boolean;retry:boolean}|null>(null);
  const submissions=useRef(new Map<string,AbortController>());
  useEffect(()=>{const active=submissions.current;return()=>{active.forEach(c=>c.abort());active.clear();};},[]);
  const [position, setI] = useState(0);
  const [part, setPart] = useState<0 | 1>(0);
  const [questionViewKey, setQuestionViewKey] = useState<string | null>(null);
  const [subpage, setSubpage] = useState<'followup' | 'transcript' | null>(null);
  const [followupReveal, setFollowupReveal] = useState(false);
  const [count, setCount] = useState(0);
  const [rec, setRec] = useState(false);
  const [hear, setHear] = useState<string | null>(null);
  const [recKey, setRecKey] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<AnswerHandle>(null);
  const [wave, setWave] = useState<number[]>(IDLE_WAVE);
  const startingCapture = useRef(false);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringP = useSharedValue(0), ringV = useSharedValue(0);
  const questionSwipe=useHorizontalSwipeMotion({slideOnly:true,active});
  const dy = useSharedValue(0);
  const resultDy = useSharedValue(0);
  const transcriptDy = useSharedValue(0);
  const reviewScrollY = useRef(0);
  const chatScrollY = useRef(0);
  const transcriptScrollY = useRef(0);
  const backExiting = useRef(false);
  const player = useSegmentPlayer();

  const regenerate=()=>{setLoad({kind:'idle'});void qa.generate();};
  const qs = archived?.questions??(questions.length?set?.questions??questions:[]);
  const i=Math.min(position,Math.max(0,qs.length-1));
  const names = audienceNames(qs, jobId);
  const panelist = (index: number) => names.get(index) ?? AUDIENCE_NAMES[0];
  const key = answerKey(i, part);
  const savedAnswer: StoredAnswer | undefined = set?.answers[key];
  const answerWaiting=active&&savedAnswer?.status==='done'&&savedAnswer.result&&savedAnswer.id&&jobId&&
    firstWordingPending(API_URL,{kind:'answer',resource_id:savedAnswer.id},'evaluation',getAppLanguage(),displayTranslations,
      text=>translatedAnswer(savedAnswer.result!,(p,s)=>text(p,s,sourceLanguage(savedAnswer.result!.transcript.text)),i,part));
  const ans = answerWaiting ? {...savedAnswer!,status:'judging' as const} : savedAnswer;
  const original = qs[i];
  const localId = archived?.runId ?? run.id;
  const questionDisplay = useDisplayTranslation(active, scope => {
    if (!original) return undefined;
    const text = scope(jobId ? 'questions' : 'legacy_qa', jobId ? String(jobId) : localId);
    const path = 'questions.' + i;
    return { ...original, question: text(path + '.question', original.question), follow_up: text(path + '.follow_up', original.follow_up) };
  });
  const Q = questionDisplay.value;
  const questionReady = !questionDisplay.missing.has('questions.' + i + (part ? '.follow_up' : '.question'));
  const displayedAnswer = useDisplayTranslation(active, scope => {
    if (savedAnswer?.status !== 'done' || !savedAnswer.result) return undefined;
    const durable = !!jobId && !!savedAnswer.id;
    const hint = sourceLanguage(savedAnswer.result.transcript.text);
    const fields = scope(durable ? 'answer' : 'legacy_qa', durable ? savedAnswer.id! : localId, undefined, hint);
    return translatedAnswer(savedAnswer.result, fields, i, part);
  });
  const language = questionDisplay.language;
  const currentAudience=qa.requirements.audience;
  const audience = Q ? set?.audience ?? qa.state?.requirements.audience ?? '' : currentAudience;
  const audienceLabel = audience === 'General audience' || AUDIENCES.some(value => value === audience) ? ui(audience) : audience;
  const questionNumber = ui('Question ' + (i + 1) + ' of ' + qs.length);
  const presenterHeader = panelist(i) + ' · ' + questionNumber;
  const questionHeader = Q
    ? questionNumber + ' · ' + audienceLabel + (!archived && deck.requirementsDefault ? ' ' + ui('(default)') : '')
    : (qaActive(qa.state) ? ui('Writing audience questions…') + ' · ' : '') + (audienceLabel || ui('Audience not set'));
  const sourcesPending=!model.transcribed;
  const generationAction=qa.state?.stale?'Update questions':qa.state?.feedback_revision?'Retry questions':'Generate questions';
  const serviceUnavailable=qa.state?.availability?.state==='disabled'||qa.state?.availability?.state==='unavailable';
  const recoverySlide=run.parts.findIndex(part=>!!part&&!model.transcripts.has(part.attemptId)&&model.stages.get(part.attemptId)!=='no_speech');
  const readinessMessage=qa.requirementsDirty?'Presentation choices are saved on this phone. Synchronize them before preparing questions.':sourcesPending?'Finish uploading and transcribing the selected recordings before preparing audience questions.':'';
  const statusMessage=load.message||readinessMessage||qa.notice||(qa.state?.stale?'Questions outdated. Update using the selected recordings.':!currentAudience.trim()?'Presentation audience is missing. Edit presentation time and audience to add it.':qaActive(qa.state)?'Your audience questions are being prepared…':qa.state?.dependency?.retry_action?'Slide profile analysis needs recovery.':qa.state?.state==='failed'?'Question generation failed. Your recordings are preserved.':serviceUnavailable?'Q&A is unavailable on this server.':'Audience questions are not ready.');
  const phase: 'ask' | 'rec' | 'review' = rec ? 'rec' : ans && questionViewKey !== key ? 'review' : 'ask';
  const last = i === qs.length - 1;
  const answerTop = (frame.compact ? 607 : 674) - 26 - ANSWER_HEIGHT;
  const layout = { answerTop, chatHeight: answerTop - 12 - CHAT_TOP };
  // OpenAI Codex, Iteration 4 (2026-11-21): keep the result's bottom gap to Record equal to Record's gap to the footer.
  const resultScrollBottom = frame.compact ? 66 : 0;

  // ── Speech ────────────────────────────────────────────────────────────────
  const speechEpoch = useRef(0);
  const stopSpeak = useCallback(() => { speechEpoch.current++; setHear(null); return Speech.stop(); }, []);
  const speak = useCallback((text: string, k: string, automatic = false) => {
    if (!active || !questionReady || count || countTimer.current !== null || startingCapture.current || rec) return;
    if (!automatic && hear === language + ':' + k) { stopSpeak(); return; }
    const epoch = ++speechEpoch.current;
    Speech.stop(); player.stop();
    setHear(language + ':' + k);
    const finish = () => { if (epoch === speechEpoch.current) setHear(null); };
    Speech.speak(text, { language, onDone: finish, onStopped: finish, onError: finish });
  }, [active, count, hear, language, player, questionReady, rec, stopSpeak]);
  const autoSpoken = useRef<string | null>(null);
  useEffect(() => { autoSpoken.current = null; return () => { Speech.stop(); }; }, [language]);
  useEffect(() => { if (!active) { Speech.stop(); player.stop(); } }, [active, player]);
  useEffect(() => {
    if (!active || archived || !Q || !questionReady || count || startingCapture.current || rec || phase === 'review') return;
    const identity = `${jobId}:${Q.id}:${part}:${language}`;
    if (autoSpoken.current === identity) return;
    autoSpoken.current = identity;
    speak(part === 0 ? Q.question : Q.follow_up, (part === 0 ? 'q' : 'f') + i, true);
  }, [active, archived, count, i, jobId, language, part, phase, Q, questionReady, rec, speak]);
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
      markNewWording(API_URL,'answer',a.id);
      update(k,{...a,status:'done',result});
    }catch(e){
      if(controller.signal.aborted)return;
      if(e instanceof QaError&&e.code==='confirmation_required')setAnswerAsk({k,qi,p,a});
      if(e instanceof QaError&&e.code==='transcription_consent_required')setAnswerConsent({k,qi,p,a,confirmed,retry});
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
    startingCapture.current = true;
    try {
      await stopSpeak();
      if (!recorder.current) return;
      await recorder.current.start();
      setWave(Array(28).fill(6));
      setElapsed(0); setRec(true);
      ringP.set(0); ringV.set(1);
    } catch (e) {
      ringV.set(withTiming(0));
      setLoad({ kind: 'error', message: e instanceof Error ? e.message : 'Could not start recording.' });
      setRecKey(k => k + 1);
    } finally { startingCapture.current = false; setCount(0); }
  };
  const stopRec = async () => {
    if (!recorder.current?.recording()) return;
    const k = key, qi = i, p = part;
    try {
      const { uri, durationMs } = await recorder.current.stop();
      setQuestionViewKey(null); setRec(false); ringV.set(withTiming(0, { duration: 200 })); setRecKey(x => x + 1);
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
    if (!active || !Q || archived || startingCapture.current) return;
    if (rec) { void stopRec(); return; }
    if (count) { stopCount(); setCount(0); ringV.set(withTiming(0)); return; }
    if (!questionReady) return;
    stopSpeak(); player.stop();
    setCount(3); ringV.set(1); ringP.set(1);
    ringP.set(withTiming(0, { duration: 3000, easing: Easing.linear }));
    const t0 = Date.now();
    countTimer.current = setInterval(() => {
      const el = Date.now() - t0;
      if (el >= 3000) { stopCount(); void startRec(); return; }
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
    if (rec || count || ni < 0 || ni >= qs.length) { questionSwipe.settle(); return; }
    stopSpeak(); player.stop();
    questionSwipe.exitTo(dir * -390,()=>{
      reviewScrollY.current = 0;
      setSubpage(null);
      setI(ni);
      setPart(set?.answers[answerKey(ni, 1)] ? 1 : 0);
      questionSwipe.enterFrom(dir * SWIPE_ENTRY_X);
    });
  };
  const back = useCallback(() => {
    if (rec || count) return;
    questionSwipe.cancel();
    stopSpeak(); player.stop();
    if(nav.from==='full')go('full',{nav:null,deckId:deck.id,sel:nav.sel});
    else go('review', { nav: null, deckId: deck.id, sel: nav.sel });
  }, [count, deck.id, go, nav.from, nav.sel, player, questionSwipe, rec, stopSpeak]);
  const openFollowup = () => {
    if (!Q?.follow_up || !ans?.result || ans.result.verdict === 'too_short') return;
    stopSpeak(); player.stop();
    dy.set(0);
    setPart(1);
    setQuestionViewKey(answerKey(i, 1));
    setSubpage('followup');
  };
  const returnFromFollowup = () => {
    if (rec || count || backExiting.current) return;
    backExiting.current = true;
    stopSpeak(); player.stop();
    resultDy.set(0);
    dy.set(withTiming(BACK_FADE_Y, { duration: 380, easing: EASE_SCREEN }, finished => {
      if (finished) runOnJS(prepareFollowupReveal)();
    }));
  };
  const prepareFollowupReveal = () => {
    // OpenAI Codex, Iteration 4 (2026-11-21): retain the opaque Q&A backdrop until the answer result has faded in.
    setFollowupReveal(true);
    setPart(0);
    setQuestionViewKey(null);
    setSubpage(null);
  };
  const finishFollowupReveal = () => { setFollowupReveal(false); backExiting.current = false; };
  useEffect(() => {
    if (followupReveal) dy.set(withTiming(0, { duration: 420, easing: EASE_SCREEN }, finished => {
      if (finished) runOnJS(finishFollowupReveal)();
    }));
  }, [followupReveal, dy]);
  const openTranscript = () => {
    if (!ans?.result) return;
    stopSpeak(); player.stop();
    transcriptDy.set(BACK_FADE_Y);
    transcriptScrollY.current = 0;
    setSubpage('transcript');
  };
  useEffect(() => {
    if (subpage === 'transcript') transcriptDy.set(withTiming(0, { duration: 420, easing: EASE_SCREEN }));
  }, [subpage, transcriptDy]);
  const finishTranscript = () => { setSubpage(null); backExiting.current = false; };
  const closeTranscript = () => {
    if (backExiting.current) return;
    backExiting.current = true;
    transcriptDy.set(withTiming(BACK_FADE_Y, { duration: 420, easing: EASE_SCREEN }, finished => {
      if (finished) runOnJS(finishTranscript)();
    }));
  };
  const showQuestion = () => {
    // OpenAI Codex, Iteration 2 (2026-11-21): the result fades over its own question, then reveals the saved transcript.
    stopSpeak(); player.stop();
    if (Q) autoSpoken.current = `${jobId}:${Q.id}:${part}:${language}`;
    setQuestionViewKey(key);
    backExiting.current = false;
  };
  const returnToQuestion = () => {
    if (backExiting.current) return;
    backExiting.current = true;
    resultDy.set(withTiming(BACK_FADE_Y, { duration: 460, easing: EASE_SCREEN }, finished => {
      if (finished) runOnJS(showQuestion)();
    }));
  };
  useEffect(() => { if (phase !== 'review') resultDy.set(0); }, [phase, resultDy]);
  useEffect(() => { reviewScrollY.current = 0; }, [i, part]);
  useEffect(() => { chatScrollY.current = 0; }, [i, part, language, Q?.question, Q?.follow_up]);
  const g = useRef<'x' | 'y' | null>(null);
  const busy = rec || !!count;
  const shouldCaptureDown = (e: GestureResponderEvent, gs: PanResponderGestureState) => {
    if (busy || backExiting.current || gs.dy <= 8 || gs.dy <= Math.abs(gs.dx)) return false;
    const y = (e.nativeEvent.pageY - frame.top) / frame.s;
    if (subpage === 'transcript') {
      if (y > 132 && transcriptScrollY.current > 0) return false;
      g.current = 'y';
      return true;
    }
    if (phase === 'review' && y > 158 && y < 648 && reviewScrollY.current > 0) return false;
    if (phase !== 'review' && y > CHAT_TOP && y < layout.answerTop && chatScrollY.current > 0) return false;
    g.current = 'y';
    return true;
  };
  const pan = {
    // OpenAI Codex, Iteration 2 (2026-11-21): capture a downward pull before the nested question/result scroll view does.
    onMoveShouldCapture: shouldCaptureDown,
    onMoveShould: (e: GestureResponderEvent, gs: PanResponderGestureState) => {
      if (busy || backExiting.current) return false;
      if (subpage === 'transcript') return shouldCaptureDown(e, gs);
      if (Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy)) { g.current = 'x'; return true; }
      return shouldCaptureDown(e, gs);
    },
    onMove: (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
      if (g.current === 'x') {
        const x = gs.dx / frame.s;
        dy.set(0); resultDy.set(0);
        questionSwipe.move((x > 0 && i === 0) || (x < 0 && i === qs.length - 1) ? x * 0.3 : x);
      } else {
        questionSwipe.cancel();
        (subpage === 'transcript' ? transcriptDy : phase === 'review' ? resultDy : dy).set(Math.min(BACK_FADE_Y, Math.max(0, gs.dy / frame.s)));
      }
    },
    onRelease: (_e: GestureResponderEvent,gs: PanResponderGestureState) => {
      if (g.current === 'x') { if (Math.abs(gs.dx / frame.s) > 60) goQ(gs.dx < 0 ? 1 : -1); else questionSwipe.settle(); }
      else if (subpage === 'transcript' && transcriptDy.get() > BACK_T) closeTranscript();
      else if (subpage === 'transcript') transcriptDy.set(withTiming(0, { duration: 360, easing: EASE_SCREEN }));
      else if (phase === 'review' && resultDy.get() > BACK_T) returnToQuestion();
      else if (phase === 'review') resultDy.set(withTiming(0, { duration: 360, easing: EASE_SCREEN }));
      else if (subpage === 'followup') {
        if (dy.get() > BACK_T) returnFromFollowup();
        else dy.set(withTiming(0, { duration: 360, easing: EASE_SCREEN }));
      }
      else if (dy.get() > BACK_T) {
        backExiting.current = true;
        dy.set(withTiming(BACK_FADE_Y, { duration: 460, easing: EASE_SCREEN }, finished => {
          if (finished) runOnJS(back)();
        }));
      } else dy.set(withTiming(0, { duration: 360, easing: EASE_SCREEN }));
      g.current = null;
    },
    onTerminate: () => { questionSwipe.settle(); if (!backExiting.current) { dy.set(withTiming(0)); resultDy.set(withTiming(0)); transcriptDy.set(withTiming(0)); } g.current = null; },
  };
  useBack(true, () => {
    if (subpage === 'transcript') closeTranscript();
    else if (subpage === 'followup') returnFromFollowup();
    else back();
    return true;
  });
  const screen = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - dy.value / BACK_FADE_Y),
  }));
  const resultFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - resultDy.value / BACK_FADE_Y) }));
  const transcriptFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - transcriptDy.value / BACK_FADE_Y) }));
  const slideStyle = questionSwipe.style;
  useEffect(() => () => { cancelAnimation(ringP); }, [ringP]);

  // ── View ──────────────────────────────────────────────────────────────────
  // Fixed regions: panel 112–164, chat from 180, the answer space ends 26 above the record button (674; compact 607).
  const hearing = (k: string) => hear === language + ':' + k;
  const glyph: RecordGlyph = count ? (count as 3 | 2 | 1) : rec ? 'stop' : ans ? 'redo' : 'mic';
  const btnLabel = archived?'Saved Q&A · playback only':count ? `Starting in ${count}. Tap to cancel` : rec ? 'Stop answering' : ans ? (part ? 'Answer the follow-up again' : 'Answer the question again') : (part ? 'Answer the follow-up' : 'Answer the question');
  const hints: Hint[] = subpage === 'transcript' ? [{ icon: 'h-dn', text: 'Answer review', nudge: 'down', onPress: closeTranscript }]
    : count ? [{ icon: 'h-tap', text: 'Tap to cancel' }] : rec ? [{ icon: 'h-tap', text: 'Tap when done' }]
    : [...(!Q||last ? [] : [{ icon: 'h-spin' as const, text: 'Next', onPress: () => goQ(1) }]), { icon: 'h-dn', text: phase === 'review' ? 'Question' : subpage === 'followup' ? 'Answer review' : 'Back', nudge: 'down', onPress: phase === 'review' ? returnToQuestion : subpage === 'followup' ? returnFromFollowup : back }];
  const result = answerWaiting ? undefined : displayedAnswer.value;
  const transcriptPreview = savedAnswer?.result?.transcript.text.trim();
  const short = result?.verdict === 'too_short';
  const verdict = !result ? null : short ? { text: 'Too short', tone: TONE.plain, icon: 'i-clock' as IconKey }
    : result.verdict === 'answered' ? { text: 'Answered', tone: TONE.good, icon: 'i-check' as IconKey } : { text: 'Partly answered', tone: TONE.warn, icon: 'i-flag' as IconKey };

  return (
    <>
    {/* OpenAI Codex, 2026-11-24: keep the swipe into Audience Q&A responsive. */}
    <Enter kind={nav.nav} duration={240}>
      <AnswerRecorder key={recKey} ref={recorder} onMeter={onMeter} onMustStop={() => { void stopRec(); }} />
      <PanView style={StyleSheet.absoluteFill} {...pan}>
        {(subpage === 'followup' || followupReveal) && <View testID="qa-followup-fade-backdrop" pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} />}
        <Animated.View style={[StyleSheet.absoluteFill, screen]}>
          <PageSurface hue={deck.hue} />
          <View style={StyleSheet.absoluteFill} pointerEvents={subpage==='transcript'?'none':'auto'} importantForAccessibility={subpage==='transcript'?'no-hide-descendants':'auto'}>
          <Animated.View style={[styles.header,slideStyle]} pointerEvents="none">
            <Txt style={styles.title}>{subpage === 'followup' ? 'Follow-up' : archived?"Saved Q&A":"Audience Q&A"}</Txt>
            <Txt verbatim numberOfLines={1} style={styles.label}>{subpage === 'followup' && Q ? presenterHeader : questionHeader}</Txt>
          </Animated.View>
          {historyAvailable&&<Pressable accessibilityRole="button" accessibilityLabel={ui(archived?'Next saved Q&A or return to current questions':'View saved Q&A')}
            disabled={rec||!!count} onPress={()=>{stopSpeak();player.stop();onHistory();}} style={styles.historyButton}>
            <UIIcon name="i-replay" size={24} color={c.secondary} />
          </Pressable>}
          {Q && (
            <Animated.View style={[styles.stage, slideStyle]}>
              <View style={StyleSheet.absoluteFill} pointerEvents={phase==='review'?'none':'auto'} importantForAccessibility={phase==='review'?'no-hide-descendants':'auto'}>
              <View style={styles.panel} pointerEvents="none">
                {qs.slice(0,3).map((question,qi)=>{const now=qi===i,done=!!set?.answers[answerKey(qi,0)];
                  return <View key={`${question.id}:${qi}`} accessibilityLabel={panelist(qi) + (done?', ' + ui('Answered'):'')} style={[now?styles.panelNow:styles.panelMember,{backgroundColor:now?c.accentSoft:c.raised}]}>
                    <Txt verbatim style={[now?styles.panelNowText:styles.panelText,{color:now?c.accent:qi<i?c.secondary:c.tertiary}]}>{initials(panelist(qi))}</Txt>
                    {done&&<View style={[styles.panelDone,{backgroundColor:c.good}]}><UIIcon name="i-check" size={14} color={c.onAccent}/></View>}
                  </View>;})}
              </View>
              <View style={[styles.chat,{top:CHAT_TOP,height:layout.chatHeight}]}>
                <FitBox key={JSON.stringify([jobId,i,part,rec,language,Q.question,part?Q.follow_up:''])} height={layout.chatHeight}
                  onScrollY={y=>{chatScrollY.current=y;}}>
                  <ChatQuestion name={panelist(i)} slideNumber={Q.slide_index+1} slideTitle={deck.slides[Q.slide_index]?.title??''}
                    slide={(w,h)=><MiniSlide hue={deck.hue} page={deck.pages[Q.slide_index]} title={deck.slides[Q.slide_index]?.title ?? ''} width={w} height={h} radius={10} />}
                    question={quote(Q.question)} followUp={part===1?quote(Q.follow_up):null} recording={rec} countdown={!!count} speechReady={questionReady}
                    questionLabel={ui(part===1?'Back to the question: '+Q.question:(hearing('q' + i) ? 'Stop the question: ' : 'Hear the question: ') + Q.question)}
                    onQuestion={()=>{if(rec||count)return;if(part===1){stopSpeak();setPart(0);setQuestionViewKey(answerKey(i,0));setSubpage(null);}else speak(Q.question,'q'+i);}}
                    followLabel={ui((hearing('f' + i) ? 'Stop the follow-up: ' : 'Hear the follow-up: ') + Q.follow_up)}
                    onFollow={()=>{if(!rec)speak(Q.follow_up,'f'+i);}} playing={hearing(part===1?'f'+i:'q'+i)} last={last}/>
                </FitBox>
              </View>
              <Pressable accessibilityRole={ans&&!rec?'button':undefined} accessibilityLabel={ans&&!rec?ui('View answer review'):undefined} disabled={!ans||rec}
                onPress={()=>{stopSpeak();player.stop();setQuestionViewKey(null);}}
                style={[styles.answerSpace,{top:layout.answerTop,height:ANSWER_HEIGHT,borderColor:rec?c.accent:c.tertiary,borderStyle:rec?'solid':'dashed',backgroundColor:rec?c.surface06:'transparent'}]}>
                {/* OpenAI Codex, Iteration 2 (2026-11-21): preview the saved transcript in the fixed answer space. */}
                <View style={styles.answerHead}><UIIcon name="i-mic" size={18} color={rec?c.text:c.secondary}/>
                  <Txt style={[styles.answerTitle,{color:rec?c.text:c.secondary}]}>{rec?`Your answer · ${fmt(elapsed)}`:'Your answer'}</Txt></View>
                {rec?<><Waveform bars={wave} live /><Txt numberOfLines={2} style={[styles.answerNote,{color:c.secondary}]}>Listening… your words are written out when you stop.</Txt></>
                  :<Txt verbatim={!!transcriptPreview && !count} numberOfLines={3} ellipsizeMode="tail" style={[styles.answerNote,{color:transcriptPreview?c.text:c.tertiary}]}>
                    {count?'Get ready to answer…':transcriptPreview|| (ans ? ans.status==='judging'?'Transcribing your answer…':'Transcript unavailable. Tap to see the answer review.' : 'Tap the mic and answer out loud. Your words are written out when you stop.')}
                  </Txt>}
              </Pressable>
              </View>
              {phase==='review'&&<Animated.View style={[styles.resultOverlay,{backgroundColor:c.bg},resultFade]}>
              <ScrollView style={[styles.reviewLayout,{bottom:resultScrollBottom}]} contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}
                onScroll={event=>{reviewScrollY.current=event.nativeEvent.contentOffset.y;}} scrollEventThrottle={16}>
                <View style={styles.reviewVerdict}>
                  <Txt style={[styles.reviewVerdictText,{color:short?c.tertiary:verdict?.tone.fg??c.secondary}]}>{verdict?.text??(ans?.status==='judging'?'Reviewing answer':'Answer saved')}</Txt>
                  <View style={styles.reviewBar}>{(['Missed','Partly','Answered'] as const).map(label=>{
                    const selected=!short&&((label==='Missed'&&verdict?.text==='Missed')||(label==='Partly'&&verdict?.text==='Partly answered')||(label==='Answered'&&verdict?.text==='Answered'));
                    return <View key={label} style={[styles.reviewBarSegment,{backgroundColor:selected?(verdict?.tone.fg??c.secondary):c.ink14}]} />;
                  })}</View>
                  <View style={styles.verdictBarLabels}>{(['Missed','Partly','Answered'] as const).map(label=><Txt key={label} style={[styles.verdictBarLabel,{color:c.tertiary}]}>{label}</Txt>)}</View>
                </View>
                {ans&&<Pressable accessibilityRole="button" accessibilityLabel={ui("Play your recorded answer")} onPress={playAnswer} style={[styles.playChip,styles.reviewPlay]}><Glyph name={player.playingKey==='a'+key?'p-pause':'p-play'} size={15}/><Txt style={styles.playText}>{'Your answer · '+fmt(ans.durationMs/1000)}</Txt></Pressable>}
                <View style={styles.nextTime}><Txt style={[styles.over,{color:c.tertiary}]}>NEXT TIME</Txt><Txt verbatim={!!result?.clarify && !short} style={styles.nextTimeText}>{short?'Answer for at least 8 seconds.':result?.clarify||'Keep the answer clear and tied to the question.'}</Txt></View>
                {ans?.status==='judging'&&<Row icon="i-wave" k="Answer review" t="Transcribing and reviewing your answer…"/>}
                {ans?.status==='error'&&!archived&&<Pressable accessibilityRole="button" onPress={()=>void judge(key,i,part,ans)}><Row icon="i-flag" k="Couldn’t review this answer" t={(ans.error||'')+' Tap to try again.'}/></Pressable>}
                {/* OpenAI Codex, Iteration 4 (2026-11-21): dedicated follow-up and transcript pages replace inline result details. */}
                <View style={styles.detailActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={ui('Open follow-up page')} disabled={part!==0||!result||short||!Q.follow_up}
                    onPress={openFollowup} style={[styles.detailAction,{borderColor:c.hair,backgroundColor:c.surface06},(part!==0||!result||short||!Q.follow_up)&&styles.detailDisabled]}>
                    <UIIcon name="i-bubble" size={19} color={c.secondary}/><Txt style={styles.detailLabel}>Follow-up</Txt><UIIcon name="i-arrow" size={15} color={c.secondary}/>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={ui('Open answer transcript')} disabled={!result}
                    onPress={openTranscript} style={[styles.detailAction,{borderColor:c.hair,backgroundColor:c.surface06},!result&&styles.detailDisabled]}>
                    <UIIcon name="i-text" size={19} color={c.secondary}/><Txt style={styles.detailLabel}>Transcript</Txt><UIIcon name="i-arrow" size={15} color={c.secondary}/>
                  </Pressable>
                </View>
              </ScrollView>
              </Animated.View>}
            </Animated.View>
          )}
          {!Q && (
            <View style={styles.status} pointerEvents="box-none">
              <UIIcon name={load.kind === 'error' ? 'i-flag' : 'i-bubble'} size={44} />
              <Txt style={styles.statusText}>{statusMessage}</Txt>
              {(!currentAudience.trim() || qa.requirementsDirty) && <Pressable accessibilityRole="button" accessibilityLabel={ui("Edit presentation time and audience")} onPress={() => { stopSpeak(); player.stop(); go('rehearse', { deckId: deck.id, editRequirements: true }); }} style={styles.retry}><Txt style={styles.retryText}>Edit time and audience</Txt></Pressable>}
              {sourcesPending && <Pressable accessibilityRole="button" accessibilityLabel={ui("Review selected recordings")} onPress={() => { stopSpeak(); player.stop(); go('review', { nav: null, deckId: deck.id, sel: recoverySlide >= 0 ? recoverySlide : run.sel ?? nav.sel }); }} style={styles.retry}><Txt style={styles.retryText}>Review selected recordings</Txt></Pressable>}
              <Pressable accessibilityRole="button" accessibilityLabel={ui("Refresh audience questions status")} disabled={!active || qa.busy} onPress={() => void qa.refresh()} style={styles.retry}><Txt style={styles.retryText}>Refresh status</Txt></Pressable>
              {!sourcesPending&&!qa.requirementsDirty&&!serviceUnavailable&&!qaActive(qa.state)&&!!currentAudience.trim()&&<Pressable accessibilityRole="button" accessibilityLabel={ui(generationAction)} disabled={!active||qa.busy} onPress={regenerate} style={styles.retry}><Txt style={styles.retryText}>{generationAction}</Txt></Pressable>}
            </View>
          )}
          {Q && load.kind === 'error' && <Txt style={styles.inlineError}>{load.message}</Txt>}
          <RecordRing progress={ringP} visible={ringV} />
          {!archived&&<RecordButton glyph={glyph} label={btnLabel} onPress={toggleRec} disabled={!active || !Q || (!questionReady && !rec && !count)} />}
          </View>
          {subpage==='transcript'&&<Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:c.bg},transcriptFade]}>
            <View style={styles.transcriptHeader}>
              <Txt style={styles.title}>Transcript</Txt>
              <Txt verbatim style={styles.label}>{Q ? presenterHeader : ui('Your answer')}</Txt>
            </View>
            <ScrollView style={[styles.transcriptScroll,frame.compact&&{bottom:60}]} contentContainerStyle={styles.transcriptContent}
              showsVerticalScrollIndicator={false} onScroll={event=>{transcriptScrollY.current=event.nativeEvent.contentOffset.y;}} scrollEventThrottle={16}>
              <Txt style={[styles.over,{color:c.tertiary}]}>{part===1?'FOLLOW-UP QUESTION':'QUESTION'}</Txt>
              <Txt verbatim style={styles.transcriptQuestion}>{Q ? quote(part===1?Q.follow_up:Q.question) : ''}</Txt>
              {ans&&<Pressable accessibilityRole="button" accessibilityLabel={ui('Play your recorded answer')} onPress={playAnswer} style={[styles.playChip,styles.reviewPlay]}>
                <Glyph name={player.playingKey==='a'+key?'p-pause':'p-play'} size={15}/><Txt style={styles.playText}>{'Your answer · '+fmt(ans.durationMs/1000)}</Txt>
              </Pressable>}
              <Txt style={[styles.over,{color:c.tertiary}]}>YOUR TRANSCRIPT</Txt>
              <Txt verbatim={!!transcriptPreview} style={styles.transcriptBody}>{transcriptPreview||'No speech was recognized in this answer.'}</Txt>
              {!!result?.did && !short && <Row icon="i-check" k={language === 'ko' ? '잘한 점' : 'What you covered'} t={result.did} verbatim />}
              {!!result?.evidence && !short && <Row icon="i-bubble" k={language === 'ko' ? '답변 근거' : 'Answer evidence'} t={result.evidence} verbatim />}
            </ScrollView>
          </Animated.View>}
        </Animated.View>
      </PanView>
      {active&&answerConsent&&<Dialog icon="i-mic" tone="neutral" title="Transcribe with ElevenLabs?"
        body="Your saved answer audio and vocabulary hints from its recorded slide go through your OutLoud server to ElevenLabs for Scribe v2 transcription. Requests may incur provider charges. Continue to allow transcription of future recordings and answers, or Cancel to keep the saved audio without submitting it."
        cancel="Cancel" confirm="Continue" onCancel={()=>setAnswerConsent(null)}
        onConfirm={()=>{const pending=answerConsent;if(!active||pending.a.questionJobId!==jobId)return;try{saveAnalysisConsent();}catch{update(pending.k,{...pending.a,status:'error',error:'Could not save transcription consent. Your answer is retained.'});setAnswerConsent(null);return;}setAnswerConsent(null);void judge(pending.k,pending.qi,pending.p,pending.a,pending.confirmed,pending.retry);}}/>}
      {(qa.ask||answerAsk)&&<Dialog title="Confirm retry" body="The previous request may have reached the provider and incurred a charge. Retry the same saved input?"
        confirm="Retry" onConfirm={()=>{if(answerAsk){const a=answerAsk;setAnswerAsk(null);void judge(a.k,a.qi,a.p,a.a,true);}else void qa.confirm();}}
        onCancel={()=>{setAnswerAsk(null);qa.cancel();}}/>}
    </Enter>
    {/* OpenAI Codex, 2026-11-20: Q&A cards move independently of their gesture cues. */}
    {active&&!answerConsent&&!qa.ask&&!answerAsk&&<HintRow hints={hints} />}
    </>
  );
}

const CHAT_TOP = 180, ANSWER_HEIGHT = 132, MIN_FIT = 0.72;
// OpenAI Codex, 2026-11-21, Iteration 2: remeasure after shrinking so a long question scrolls only at the 72% floor.
const Fit = createContext(1);
function FitBox({ height, onScrollY, children }: { height: number; onScrollY: (y: number) => void; children: ReactNode }) {
  const [fit, setFit] = useState({ scale: 1, ready: false, overflow: false });
  return <ScrollView style={{ height }} scrollEnabled={fit.overflow} showsVerticalScrollIndicator={fit.overflow} bounces={false} overScrollMode="never"
    onScroll={event=>onScrollY(event.nativeEvent.contentOffset.y)} scrollEventThrottle={16}>
    <View style={{ opacity: fit.ready ? 1 : 0 }} onLayout={e => {
      const h = e.nativeEvent.layout.height;
      if (h > height + 1 && fit.scale > MIN_FIT) {
        const scale = Math.max(MIN_FIT, fit.scale * height / h);
        if (scale < fit.scale - 0.001) { setFit({ scale, ready: false, overflow: false }); return; }
      }
      const overflow = h > height + 1 && fit.scale <= MIN_FIT + 0.001;
      if (!fit.ready || overflow !== fit.overflow) setFit({ ...fit, ready: true, overflow });
    }}><Fit.Provider value={fit.scale}>{children}</Fit.Provider></View>
  </ScrollView>;
}
const useFit = () => { const z = useContext(Fit); return (n: number) => Math.round(n * z * 10) / 10; };

/** The question as a chat message from the panelist (tap to hear it), the follow-up under it, then the slide it came from. */
function ChatQuestion({ name, slideNumber, slideTitle, slide, question, followUp, recording, countdown, speechReady, questionLabel, onQuestion, followLabel, onFollow, playing, last }: {
  name: string; slideNumber: number; slideTitle: string; slide: (width: number, height: number) => ReactNode; question: string; followUp: string | null; recording: boolean; countdown: boolean; speechReady: boolean;
  questionLabel: string; onQuestion: () => void; followLabel: string; onFollow: () => void; playing: boolean; last: boolean }) {
  const { c } = useTheme(), z = useFit(), ui = useUiText();
  const bubble = { backgroundColor: c.raised, borderRadius: 20, borderBottomLeftRadius: 6, paddingHorizontal: z(16), paddingVertical: z(14) };
  const sender = (text: string, color: string) => <Txt verbatim style={[styles.sender, { color, fontSize: z(14), lineHeight: z(18) }]}>{text}</Txt>;
  const hear = !recording && !countdown && speechReady && <View style={[styles.hearRow, { marginTop: z(10) }]}><Glyph name={playing ? 'p-pause' : 'p-play'} size={z(14)} color={c.secondary} />
    <Txt style={[styles.hearText, { color: c.secondary, fontSize: z(14), lineHeight: z(18) }]}>{playing ? 'Playing…' : 'Tap to hear'}</Txt></View>;
  return <View style={styles.msgRow}>
    <View style={[styles.msgAvatar, { width: z(36), height: z(36), borderRadius: z(18), backgroundColor: c.accentSoft }]}>
      <Txt verbatim style={[styles.msgAvatarText, { color: c.accent, fontSize: z(14) }]}>{initials(name)}</Txt></View>
    <View style={[styles.msgColumn, { gap: z(8) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={questionLabel} disabled={recording || countdown || (!followUp && !speechReady)} onPress={onQuestion} style={bubble}>
        {sender(name + ' · ' + (followUp ? ui('Question · tap to go back') : ui('after slide ' + slideNumber)), c.accent)}
        <Txt verbatim style={[styles.question, { color: followUp ? c.secondary : c.text, marginTop: z(6), fontSize: z(followUp ? 15 : 18), lineHeight: z(followUp ? 21 : 25.6) }]}>{question}</Txt>
        {!followUp && hear}
      </Pressable>
      {followUp && <Pressable accessibilityRole="button" accessibilityLabel={followLabel} disabled={recording || countdown || !speechReady} onPress={onFollow} style={bubble}>
        {sender(ui('Follow-up') + ' · ' + name, c.warn)}
        <Txt verbatim style={[styles.question, { color: c.text, marginTop: z(6), fontSize: z(18), lineHeight: z(25.6) }]}>{followUp}</Txt>
        {hear}
      </Pressable>}
      <View style={[styles.attach, { gap: z(10) }]} pointerEvents="none">
        {slide(z(112), z(63))}
        <Txt verbatim numberOfLines={2} style={[styles.attachText, { color: c.tertiary, fontSize: z(13.5), lineHeight: z(18) }]}>{ui('Slide ' + slideNumber) + (slideTitle ? ' · ' + slideTitle : '')}</Txt>
      </View>
      {last && !recording && <Txt style={[styles.attachText, { color: c.tertiary, fontSize: z(13.5), lineHeight: z(18) }]}>Last question · swipe down for your review</Txt>}
    </View>
  </View>;
}
function Row({ icon, k, t, verbatim = false }: { icon: IconKey; k: string; t: string; verbatim?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <UIIcon name={icon} size={22} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={styles.rowK}>{k}</Txt>
        <Txt verbatim={verbatim} style={styles.rowT}>{t}</Txt>
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  // Claude, 2026-11-21: S15 question page.
  historyButton: { position:'absolute', top:4, right:16, zIndex:10, width:44, height:44, alignItems:'center', justifyContent:'center' },
  panel: { position: 'absolute', left: 0, right: 0, top: 112, height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18 },
  panelMember: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  panelNow: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  panelText: { fontFamily: F.display, fontSize: 16 }, panelNowText: { fontFamily: F.display, fontSize: 19 },
  panelDone: { position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  chat: { position: 'absolute', left: 16, right: 16 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  msgAvatar: { alignItems: 'center', justifyContent: 'center' }, msgAvatarText: { fontFamily: F.display },
  msgColumn: { flex: 1, minWidth: 0 },
  sender: { fontFamily: F.bold }, question: { fontFamily: F.medium },
  hearRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, hearText: { fontFamily: F.semibold },
  attach: { flexDirection: 'row', alignItems: 'center' }, attachText: { flex: 1, minWidth: 0, fontFamily: F.semibold },
  answerSpace: { position: 'absolute', left: 16, right: 16, borderWidth: 1.5, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 }, answerTitle: { fontFamily: F.bold, fontSize: 16, lineHeight: 21 },
  answerNote: { fontFamily: F.medium, fontSize: 15, lineHeight: 21 },
  resultOverlay: { position: 'absolute', left: 0, right: 0, top: 100, bottom: 0 },
  header: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  title: { fontFamily: F.display, fontSize: 18, lineHeight: 21.6, letterSpacing: -0.3, color: C.text },
  label: { marginTop: 3, fontFamily: F.medium, fontSize: 13.5, color: C.secondary },
  stage: { position: 'absolute', left: 0, top: 0, width: 390, height: 650 },
  panelAvatars:{position:'absolute',left:0,right:0,top:112,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:18},
  panelAvatar:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  panelist: { position: 'absolute', left: 16, right: 16, top: 102, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  who: { fontFamily: F.display, fontSize: 14, color: '#FFFFFF' },
  role: { fontFamily: F.bold, fontSize: 15, color: C.text },
  meta: { marginTop: 1, fontFamily: F.medium, fontSize: 13.5, color: C.secondary },
  col: { position: 'absolute', left: 16, right: 16, top: 158 },
  askBubble:{top:196,borderWidth:1,borderRadius:22,padding:16},
  answerBubble:{position:'absolute',left:16,right:16,top:520,height:100,borderWidth:1,borderRadius:20,paddingHorizontal:16,paddingVertical:14,justifyContent:'center',gap:8},
  answerPlaceholderText:{fontFamily:F.medium,fontSize:15,lineHeight:21},
  reviewLayout: { position: 'absolute', left: 24, right: 24, top: 32, bottom: 0 },
  reviewContent: { flexGrow: 1, justifyContent: 'space-between', gap: 16, paddingBottom: 12 },
  reviewVerdict: { gap: 12 },
  reviewVerdictText: { fontFamily: F.display, fontSize: 32, lineHeight: 40 },
  reviewBar: { height: 9,flexDirection:'row',gap:3,borderRadius:5,overflow:'hidden' },
  reviewBarSegment:{flex:1,borderRadius:5},
  verdictBarLabels:{flexDirection:'row',justifyContent:'space-between'},
  verdictBarLabel:{fontFamily:F.semibold,fontSize:13.5},
  reviewPlay: { minHeight: 40, alignSelf: 'flex-start', paddingHorizontal: 12 },
  nextTime: { marginTop: 6, gap: 10 },
  nextTimeText: { fontFamily: F.medium, fontSize: 18, lineHeight: 25, color: C.text },
  detailActions: { flexDirection: 'row', gap: 12 },
  detailAction: { flex: 1, minHeight: 70, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailLabel: { flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.text },
  detailDisabled: { opacity: 0.42 },
  transcriptHeader: { position: 'absolute', left: 40, right: 40, top: 50, alignItems: 'center' },
  transcriptScroll: { position: 'absolute', left: 24, right: 24, top: 132, bottom: 76 },
  transcriptContent: { gap: 18, paddingBottom: 32 },
  transcriptQuestion: { fontFamily: F.medium, fontSize: 18, lineHeight: 26, color: C.text },
  transcriptBody: { fontFamily: F.medium, fontSize: 17, lineHeight: 26, color: C.text },
  followDoor: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: C.hair, backgroundColor: C.surface06 },
  followAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface12 },
  followDoorTitle: { fontFamily: F.semibold, fontSize: 14, color: C.text },
  qBig: { fontFamily: F.display, letterSpacing: -0.3, color: C.text },
  hear: { fontFamily: F.semibold, fontSize: 13.5, color: C.secondary },
  over: { fontFamily: F.bold, fontSize: 13.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  qSmall: { marginTop: 4, fontFamily: F.medium, fontSize: 14, lineHeight: 19.6, color: C.secondary },
  fSmall: { marginTop: 4, fontFamily: F.semibold, fontSize: 14, lineHeight: 19.6, color: C.body },
  fBig: { fontFamily: F.display, fontSize: 20, lineHeight: 25.6, letterSpacing: -0.3, color: C.text },
  slideBox: { alignItems: 'center', gap: 10, marginTop: 8 },
  slideCap: { fontFamily: F.semibold, fontSize: 13.5, color: C.tertiary },
  listening: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 8 },
  listenText: { textAlign: 'center', fontFamily: F.medium, fontSize: 13.5, color: C.tertiary },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 3, paddingBottom: 3, paddingLeft: 4, paddingRight: 11, borderRadius: 999 },
  verdictText: { fontFamily: F.bold, fontSize: 13.5 },
  playChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingLeft: 8, paddingRight: 11, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  playText: { fontFamily: F.semibold, fontSize: 13.5, color: C.body, fontVariant: ['tabular-nums'] },
  rowK: { fontFamily: F.bold, fontSize: 13.5, letterSpacing: 0.6, textTransform: 'uppercase', color: C.tertiary },
  rowT: { marginTop: 2, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18.9, color: C.body },
  followCard: { gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255, 181, 71, 0.24)', borderRadius: 18, backgroundColor: 'rgba(255, 181, 71, 0.07)' },
  followText: { fontFamily: F.display, fontSize: 16, lineHeight: 20.8, color: C.text },
  followHint: { fontFamily: F.semibold, fontSize: 13.5, color: C.secondary },
  ansBox: { gap: 6, paddingTop: 10, paddingBottom: 10, paddingRight: 12, paddingLeft: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  ansTime: { width: 44, paddingTop: 2, textAlign: 'center', fontFamily: F.semibold, fontSize: 13.5, color: C.tertiary, fontVariant: ['tabular-nums'] },
  ansText: { flex: 1, fontFamily: F.medium, fontSize: 13.5, lineHeight: 18.9, color: C.body },
  end: { marginTop: 4, textAlign: 'center', fontFamily: F.semibold, fontSize: 13.5, color: C.tertiary },
  status: { position: 'absolute', left: 40, right: 40, top: 300, alignItems: 'center', gap: 14 },
  statusText: { textAlign: 'center', fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.secondary },
  retry: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.14)', backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  retryText: { fontFamily: F.bold, fontSize: 14, color: C.text },
  inlineError: { position: 'absolute', left: 24, right: 24, top: 600, textAlign: 'center', fontFamily: F.medium, fontSize: 13.5, color: C.bad },
  big: { position: 'absolute', left: 0, right: 0, top: 548, textAlign: 'center', fontFamily: F.display, fontSize: 42, lineHeight: 44, letterSpacing: -1.3, color: C.text, fontVariant: ['tabular-nums'] },
  line: { position: 'absolute', left: 0, right: 0, top: 596, textAlign: 'center', fontFamily: F.semibold, fontSize: 14, color: C.secondary },
});
