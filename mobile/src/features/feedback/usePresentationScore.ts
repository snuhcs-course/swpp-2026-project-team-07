// Automatic scoring and explicit recovery over the existing durable score/correction APIs.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { API_URL } from '../../services/api';
import { readStored, writeStored } from '../../services/storage';
import { createCorrectionClient, initializeCorrections, readCorrections } from '../presentations/correctionStore';
import { defaultRequirementsPending } from '../presentations/defaultRequirements';
import { requirementsDirty, requirementsPending } from '../presentations/requirementsDraft';
import { getRequirementsVersion, readRequirements, subscribeRequirements } from '../presentations/requirementsStore';
import { bump, useStore } from '../presentations/store';
import { normalizeApi } from '../transcription/analysisStorage';
import { parsePresentationScore, scoreActive, type PresentationScore, type ScoreTarget } from './presentationScore';
import { automaticScoreInput, readAutomaticScoreAttempt, saveAutomaticScoreAttempt } from './automaticPresentationScore';
import { createPresentationScoreReader, effectivePresentationScore, presentationScoreKey, publishPresentationScore, readPresentationScore, scoreSubmissionLocks } from './presentationScoreStore';

type Pending = { revision:number; dependency?:number };
type Confirmation = { identity:string; snapshot:string };
const snapshot = (s:PresentationScore,correctionRevision:number,localVersion:number) => JSON.stringify([correctionRevision,localVersion,s.feedback_revision,s.selection?.token,s.source_identity,s.transcript_revision,
 s.requirements.revision,s.dependency?.description_set_id,s.dependency?.processing_revision]);

export function usePresentationScore(target:ScoreTarget|null, requirementsRevision:number|null, localDeckId?:string, active=true, automatic=false) {
 const api=normalizeApi(API_URL), key=target?presentationScoreKey(api,target):'';
 // A same-attempt replacement transcript/chronology is also a different control owner.
 const identity=JSON.stringify([key,requirementsRevision,localDeckId,target?.pageCount,target?.review?.deck_id,
  target?.review?.duration_ms,target?.review?.slide_events,target?.review?.transcript]);
 const current=useRef({identity,target,requirementsRevision,active});
 useLayoutEffect(()=>{current.current={identity,target,requirementsRevision,active};});
 const enabled=useRef(false), operation=useRef(0), submitting=useRef(false), refreshing=useRef<number|null>(null);
 const [value,setValue]=useState<{identity:string;state:PresentationScore|null}>({identity,state:null});
 const [message,setMessage]=useState({identity,text:''});
 const [working,setWorking]=useState({identity,busy:false});
 const [failed,setFailed]=useState({identity,value:false});
 const [ask,setAsk]=useState<Confirmation|null>(null);
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 const version=useStore(s=>s.version);
 useSyncExternalStore(subscribeRequirements,getRequirementsVersion);
 const pendingKey=`${key}:uncertain`;
 const valid=useCallback((op:number)=>enabled.current&&current.current.active&&current.current.identity===identity&&operation.current===op,[identity]);
 const publish=useCallback((s:PresentationScore,t:ScoreTarget)=>{
  const next=publishPresentationScore(api,s,t);setValue({identity,state:next});return next;
 },[api,identity]);
 const resolvePending=useCallback((s:PresentationScore)=>{
  const pending=readStored<Pending|boolean>(pendingKey);
  if(pending&&typeof pending==='object'&&!s.requires_confirmation&&!s.dependency?.requires_confirmation&&
   (s.feedback_revision>pending.revision||pending.dependency!==undefined&&!!s.dependency&&s.dependency.processing_revision>pending.dependency))writeStored(pendingKey,false);
 },[pendingKey]);
 const refresh=useCallback(async()=>{
  const t=current.current.target;
  if(!t||!enabled.current||!current.current.active||current.current.identity!==identity||submitting.current||refreshing.current!==null)return;
  const op=++operation.current;refreshing.current=op;
  try{
   const next=await createPresentationScoreReader(api).read(t);
   if(!valid(op))return;
   resolvePending(next);setValue({identity,state:next});setFailed({identity,value:false});setMessage({identity,text:''});
  }catch{
   if(valid(op)){setFailed({identity,value:true});setMessage({identity,text:'Connection interrupted. Saved scores are retained. Reconnecting…'});}
  }finally{if(refreshing.current===op)refreshing.current=null;}
 },[api,identity,resolvePending,valid]);
 useFocusEffect(useCallback(()=>{
  const reset=()=>{operation.current++;refreshing.current=null;submitting.current=false;setWorking({identity,busy:false});setAsk(null);};
  enabled.current=active&&AppState.currentState==='active';setForeground(enabled.current);reset();
  if(enabled.current){
   const t=current.current.target,cached=t?readPresentationScore(api,t):null;
   setValue({identity,state:cached});void refresh();
  }
  const sub=AppState.addEventListener('change',state=>{
   enabled.current=active&&state==='active';setForeground(enabled.current);reset();
   if(enabled.current)void refresh();
  });
  return()=>{enabled.current=false;setForeground(false);operation.current++;sub.remove();};
 },[active,api,identity,refresh]));
 useEffect(()=>{
  const t=current.current.target;
  if(enabled.current&&current.current.identity===identity&&t){const cached=readPresentationScore(api,t);if(cached)setValue({identity,state:cached});}
 },[api,identity,version]);
 const raw=value.identity===identity?value.state:null;
 const correction=target?readCorrections(api,target.id):null;
 const dirty=!!localDeckId&&(requirementsDirty(localDeckId,api)||defaultRequirementsPending(localDeckId,api));
 const state=effectivePresentationScore(raw,{requirementsRevision,correction,dirty,transcriptId:target?.review?.transcript_id});
 const readFailed=failed.identity===identity&&failed.value;
 const reconcilePending=!!readStored(pendingKey)&&!raw?.requires_confirmation;
 useEffect(()=>{
  if(!active||!scoreActive(raw)&&!readFailed&&!reconcilePending&&!(raw?.stale&&raw.requires_confirmation))return;
  const timer=setInterval(()=>void refresh(),readFailed?5000:2000);return()=>clearInterval(timer);
 },[active,raw,readFailed,reconcilePending,refresh]);

 const generate=async(confirmed?:Confirmation,initial=false)=>{
  const t=current.current.target;
  if(!t||!enabled.current||!current.current.active||current.current.identity!==identity||submitting.current||scoreSubmissionLocks.has(key))return;
  const settingsReady=()=>{
   if(localDeckId){
    if(requirementsPending(localDeckId,api)||defaultRequirementsPending(localDeckId,api))throw new Error('Synchronize presentation settings before grading.');
    const settings=readRequirements(localDeckId,api),context=settings.deckId===t.review?.deck_id?settings.contextId:null;
    if(settings.deckId&&settings.deckId!==t.review?.deck_id||context!==t.contextId||(context?settings.revision:null)!==requirementsRevision)throw new Error('Presentation settings changed. Refresh before grading.');
   }
  };
  try{settingsReady();}catch(error){setMessage({identity,text:(error as Error).message});return;}
  const op=++operation.current;submitting.current=true;scoreSubmissionLocks.add(key);bump();setWorking({identity,busy:true});setAsk(null);
  let submitted=false;
  try{
   const original=t.review;
   if(original?.attempt_id!==t.id||!original.transcript_id||!original.transcript)throw new Error('Transcribe this recording first.');
   initializeCorrections(api,t.id,original.transcript_id,original.transcript);
   const client=createCorrectionClient(api);
   await client.refresh(t.id);if(!valid(op))return;
   const synced=await client.synchronize(t.id);if(!valid(op))return;
   const fresh=await createPresentationScoreReader(api).read(t);if(!valid(op))return;
   resolvePending(fresh);publish(fresh,t);
   settingsReady();
   const local=readCorrections(api,t.id);
   if(local?.pending||local?.conflict||local?.server.source_changed||local?.server.base_transcript_id!==original.transcript_id||
    local?.server.revision!==synced.server.revision||fresh.transcript_revision>synced.server.revision||
    !fresh.stale&&fresh.transcript_revision!==synced.server.revision)throw new Error('Synchronize the latest corrections before grading.');
   if(fresh.requirements.revision!==requirementsRevision&&(!fresh.stale||
    requirementsRevision===null||fresh.requirements.revision!==null&&fresh.requirements.revision>requirementsRevision))throw new Error('Presentation settings changed. Refresh before grading.');
   if(confirmed&&(confirmed.identity!==identity||confirmed.snapshot!==snapshot(fresh,synced.server.revision,local.localVersion)))throw new Error('Score status changed. Review it before retrying.');
   const effective=effectivePresentationScore(fresh,{requirementsRevision,correction:local,dirty:false,transcriptId:original.transcript_id});
   if(scoreActive(fresh)||fresh.state==='completed'&&!effective?.stale&&(initial||fresh.assessment_status!=='invalid_evidence'))return;
   if(initial&&(!fresh.stale&&fresh.state!=='absent'||fresh.dependency?.retry_action))return;
   if(fresh.availability.state!=='available'||!fresh.selection?.token)throw new Error('Grading is unavailable on this server.');
   const uncertain=readStored(pendingKey)||fresh.requires_confirmation||fresh.dependency?.requires_confirmation;
   if(uncertain&&!confirmed){setAsk({identity,snapshot:snapshot(fresh,synced.server.revision,local.localVersion)});return;}
   if(fresh.dependency?.retry_action){
    if(!fresh.dependency.retry_available)throw new Error('Slide profile retry is not available yet.');
    if(fresh.dependency.deck_id!==original.deck_id)throw new Error('Slide profile source changed. Refresh before retrying.');
    writeStored(pendingKey,{revision:fresh.feedback_revision,dependency:fresh.dependency.processing_revision});submitted=true;
    const response=await fetch(`${api}/decks/${original.deck_id}/descriptions/generate/`,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({description_set_id:fresh.dependency.description_set_id,processing_revision:fresh.dependency.processing_revision,
      ...(confirmed?{acknowledge_uncertain:true}:{})}),signal:AbortSignal.timeout(15000)});
    if(!response.ok){const e=new Error('Could not retry slide profiles. Refresh before retrying.') as Error&{definite?:boolean};e.definite=response.status>=400&&response.status<500&&response.status!==408;throw e;}
    if(!valid(op))return;
    const next=await createPresentationScoreReader(api).read(t);if(!valid(op))return;publish(next,t);
   }else{
    if(fresh.feedback_revision>0&&!fresh.retry_available)throw new Error('Retry is not available yet.');
    // The marker commits before transport; a timeout/remount cannot silently retry paid work.
    // Durable input marker precedes transport, including manual recovery. Remounts
    // may reconcile with GET but cannot silently re-submit the same inputs.
    saveAutomaticScoreAttempt(api,t,{input:automaticScoreInput(api,t,requirementsRevision,local,fresh),state:'attempted',retryAt:0,notice:''});
    writeStored(pendingKey,{revision:fresh.feedback_revision});submitted=true;
    const response=await fetch(`${api}/attempts/${t.id}/presentation-score/`,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({context_id:t.contextId,expected_selection:fresh.selection.token,transcript_revision:synced.server.revision,
      ...(fresh.feedback_revision?{feedback_revision:fresh.feedback_revision}:{}),...(confirmed?{acknowledge_uncertain:true}:{})}),signal:AbortSignal.timeout(15000)});
    if(!response.ok){const e=new Error('Could not grade presentation. Refresh before retrying.') as Error&{definite?:boolean};e.definite=response.status>=400&&response.status<500&&response.status!==408;throw e;}
    const next=parsePresentationScore(await response.json(),t);if(!valid(op))return;publish(next,t);
   }
   writeStored(pendingKey,false);submitted=false;
   if(valid(op))setMessage({identity,text:''});
  }catch(error){
   if(valid(op)){
    if(initial&&!submitted){
     const currentState=readPresentationScore(api,t);
     if(currentState)saveAutomaticScoreAttempt(api,t,{input:automaticScoreInput(api,t,requirementsRevision,readCorrections(api,t.id),currentState),state:'preflight_failed',retryAt:Date.now()+5000,notice:'Could not start scoring. Reconnecting… You can retry scoring.'});
    }
    if(submitted&&(error as Error&{definite?:boolean}).definite){writeStored(pendingKey,false);submitted=false;}
    const notice=submitted?'Request outcome may be uncertain. Refresh before retrying.':error instanceof Error?error.message:'Scoring unavailable. Retry scoring.';
    const record=readAutomaticScoreAttempt(api,t);
    if(record?.state==='attempted')saveAutomaticScoreAttempt(api,t,{...record,notice});
    setMessage({identity,text:notice});
   }
  }finally{
   scoreSubmissionLocks.delete(key);bump();
   if(valid(op)){submitting.current=false;setWorking({identity,busy:false});}
  }
 };
 const autoStart=useRef<()=>Promise<void>>(async()=>{});
 useLayoutEffect(()=>{autoStart.current=()=>generate(undefined,true);});
 const autoInput=target&&raw?automaticScoreInput(api,target,requirementsRevision,correction,raw):'';
 const autoRecord=target?readAutomaticScoreAttempt(api,target):null;
 // Only stable primitives drive the debounce. GET/cache publications must not
 // restart the timer while the actual synchronized scoring inputs are unchanged.
 const autoReady=automatic&&active&&foreground&&!!target&&!!raw&&!!state&&!dirty&&!correction?.pending&&!correction?.conflict&&!correction?.server.source_changed&&
  raw.availability.state==='available'&&!raw.requires_confirmation&&!raw.dependency?.requires_confirmation&&!raw.dependency?.retry_action&&
  !readStored(pendingKey)&&!scoreSubmissionLocks.has(key)&&!scoreActive(raw)&&
  (state.stale||raw.state==='absent'&&raw.feedback_revision===0);
 const autoAttempted=autoRecord?.input===autoInput&&autoRecord.state==='attempted';
 const autoRetryAt=autoRecord?.input===autoInput?autoRecord.retryAt:0;
 const autoCooldownAt=raw?.retry_at?Date.parse(raw.retry_at):0;
 const autoDebounce=raw&&(raw.feedback_revision>0||(correction?.server.revision??0)>0)?1000:0;
 useEffect(()=>{
  if(!autoReady||autoAttempted)return;
  const delay=Math.max(0,autoRetryAt-Date.now(),autoCooldownAt-Date.now(),autoDebounce);
  if(delay){const timer=setTimeout(()=>void autoStart.current(),delay);return()=>clearTimeout(timer);}
  void autoStart.current();
 },[autoReady,autoInput,autoAttempted,autoRetryAt,autoCooldownAt,autoDebounce]);
 const autoNotice=autoRecord?.input===autoInput?autoRecord.notice:'';
 const uncertainNotice=target&&readStored(pendingKey)&&!scoreSubmissionLocks.has(key)&&!scoreActive(raw)?'Scoring request outcome may be uncertain. Refresh before retrying.':'';
 return {state,busy:active&&foreground&&(working.identity===identity&&working.busy||scoreSubmissionLocks.has(key)),notice:(message.identity===identity?message.text:'')||autoNotice||uncertainNotice,refresh,generate:()=>generate(),
  ask:active&&ask?.identity===identity,confirm:()=>{if(ask?.identity===identity)void generate(ask);},cancel:()=>{if(current.current.identity===identity)setAsk(null);}};
}
export type PresentationScoreController=ReturnType<typeof usePresentationScore>;
