import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { readStored, writeStored } from '../../services/storage';
import { API_URL } from '../../services/api';
import type { ReviewAttempt } from '../../contracts';
import { createCorrectionClient, initializeCorrections, readCorrections } from '../presentations/correctionStore';
import { bump, useStore } from '../presentations/store';
import { normalizeApi } from '../transcription/analysisStorage';
import { requirementsDirty } from '../presentations/requirementsDraft';
import { getRequirementsVersion, subscribeRequirements } from '../presentations/requirementsStore';
import { createSlideReviewReader, effectiveSlideReview, publishSlideReview, readSlideReview, slideReviewIdentity, slideReviewInitialKey, slideReviewKey } from './slideReviewStore';
import { parseSlideReview, reviewActive, type ReviewScope, type SlideReview } from './slideReview';

const initialClaims=new Set<string>();

export function useSlideReview(id:string,scope:ReviewScope,review:ReviewAttempt|null,requirementsRevision:number|null, automatic=false, localDeckId?:string) {
 const api=String(normalizeApi(API_URL)), identity=String(slideReviewIdentity(api,id,scope)), scopeKey=JSON.stringify(scope);
 const key=String(slideReviewKey(api,id,scope));
 const live=useRef(identity);
 useLayoutEffect(()=>{live.current=identity;},[identity]);
 const enabled=useRef(false), operation=useRef(0), lock=useRef(false), refreshing=useRef<number|null>(null);
 const version=useStore(s=>s.version);
 useSyncExternalStore(subscribeRequirements,getRequirementsVersion);
 const dirty=!!localDeckId&&requirementsDirty(localDeckId,api);
 const [value,setValue]=useState<{identity:string;state:SlideReview|null}>({identity,state:null});
 const [message,setMessage]=useState({identity,text:''}), [busy,setBusy]=useState(false);
 const [ask,setAsk]=useState<{identity:string;revision:number;token:string}|null>(null);
 const reviewRef=useRef(review);
 useLayoutEffect(()=>{reviewRef.current=review;},[review]);
 const initialKey=String(slideReviewInitialKey(api,id,scope));
 const initial=readStored<string>(initialKey);
 const pendingKey=`${key}:uncertain`;
 const valid=useCallback((op:number)=>enabled.current&&live.current===identity&&operation.current===op,[identity]);
 const publish=useCallback((next:SlideReview)=>{
  const nextState=publishSlideReview(api,next,reviewRef.current);setValue({identity,state:nextState});return nextState;
 },[api,identity,setValue]);
 const request=useCallback(async(body?:object)=>{
  let parsed:SlideReview;
  if(!body) parsed=await createSlideReviewReader(api).read({id,scope:JSON.parse(scopeKey),review:reviewRef.current});
  else {
   const response=await fetch(`${api}/attempts/${id}/slide-review/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope:JSON.parse(scopeKey),...body}),signal:AbortSignal.timeout(15000)});
   if(!response.ok){const e=new Error('Could not update feedback. Refresh before retrying.') as Error & {definite?:boolean};e.definite=response.status>=400&&response.status<500&&response.status!==408;throw e;}
   parsed=parseSlideReview(await response.json(),id,JSON.parse(scopeKey),reviewRef.current);
  }
  if(!body && readStored<string>(initialKey)==='starting'&&!initialClaims.has(initialKey)){
   writeStored(initialKey,parsed.feedback_revision?'started':'failed');
  }
  const pending=readStored<{revision:number;dependency?:number}|boolean>(pendingKey);
  if(pending&&typeof pending==='object'&&(parsed.feedback_revision>pending.revision ||
      pending.dependency!==undefined&&parsed.dependency&&parsed.dependency.processing_revision>pending.dependency))writeStored(pendingKey,false);
  return parsed;
 },[api,id,initialKey,pendingKey,scopeKey]);
 const refresh=useCallback(async()=>{
  if(!enabled.current||lock.current||refreshing.current!==null)return;
  const op=++operation.current;refreshing.current=op;
  try {const s=await request();if(valid(op)){publish(s);setMessage({identity,text:''});}}
  catch {if(valid(op))setMessage({identity,text:'Offline or unavailable. Saved feedback is retained; refresh when connected.'});}
  finally{if(refreshing.current===op)refreshing.current=null;}
 },[identity,publish,request,valid,setMessage]);
 useFocusEffect(useCallback(()=>{
  enabled.current=AppState.currentState==='active';
  operation.current++;refreshing.current=null;lock.current=false;setBusy(false);setAsk(null);
  try{const cached=readSlideReview(api,id,JSON.parse(scopeKey),reviewRef.current);if(cached)setValue({identity,state:cached});}catch{/* Cache cannot authorize generation. */}
  void refresh();
  const sub=AppState.addEventListener('change',s=>{enabled.current=s==='active';operation.current++;refreshing.current=null;lock.current=false;setBusy(false);setAsk(null);if(enabled.current)void refresh();});
  return()=>{enabled.current=false;operation.current++;sub.remove();};
 },[api,id,identity,refresh,scopeKey,setBusy,setAsk,setValue]));
 useEffect(()=>{
  try{const cached=readSlideReview(api,id,JSON.parse(scopeKey),reviewRef.current);if(cached)setValue({identity,state:cached});}catch{/* Retain validated in-memory feedback. */}
 },[api,identity,id,key,scopeKey,version]);
 const raw=value.identity===identity?value.state:null;
 const correction=readCorrections(api,id);
 const state=effectiveSlideReview(raw,{requirementsRevision,correction,initial,dirty,transcriptId:review?.transcript_id??undefined});
 const stale=!!state?.stale;
 useEffect(()=>{if(!reviewActive(raw))return;const timer=setInterval(()=>void refresh(),2000);return()=>clearInterval(timer);},[raw,refresh]);
 // Subscribe to correction changes without admitting any analysis.
 void version;
 const generate=async(confirmed?:{revision:number;token:string})=>{
  if(!enabled.current||lock.current||live.current!==identity)return;
  if(localDeckId&&requirementsDirty(localDeckId,api)){setMessage({identity,text:'Synchronize presentation settings before updating feedback.'});return;}
  const op=++operation.current;lock.current=true;setBusy(true);setAsk(null);
  let submitted=false;
  try{
   const original=reviewRef.current;
   if(!original?.transcript||!original.transcript_id)throw new Error('Transcribe this recording first.');
   initializeCorrections(api,id,original.transcript_id,original.transcript);
   const synced=await createCorrectionClient(api).synchronize(id);
   if(!valid(op))return;
   if(automatic && !confirmed && synced.server.revision>0)throw new Error('Corrections changed. Request Update feedback explicitly.');
   const fresh=await request();if(!valid(op))return;publish(fresh);
   if(localDeckId&&requirementsDirty(localDeckId,api))throw new Error('Synchronize presentation settings before updating feedback.');
   if(automatic && (fresh.feedback_revision>0||fresh.state!=='absent'||fresh.stale))return;
   if(confirmed&&(fresh.feedback_revision!==confirmed.revision||fresh.selection?.token!==confirmed.token))throw new Error('Feedback status changed. Review it before retrying.');
   if(reviewActive(fresh)||(fresh.state==='completed'&&!fresh.stale))return;
   if(fresh.availability.state!=='available'||!fresh.selection)throw new Error('Feedback is unavailable on this server.');
   const uncertain=readStored<{revision:number;dependency?:number}|boolean>(pendingKey)||fresh.requires_confirmation||fresh.dependency?.requires_confirmation;
   if(uncertain&&!confirmed){setAsk({identity,revision:fresh.feedback_revision,token:fresh.selection.token});return;}
   if(fresh.dependency?.retry_action){
    if(!fresh.dependency.retry_available)throw new Error('Slide profile retry is not available yet.');
    // Explicit dependency recovery uses its own generation and receipt protocol.
    submitted=true;writeStored(pendingKey,{revision:fresh.feedback_revision,dependency:fresh.dependency.processing_revision});
    const response=await fetch(`${api}/decks/${original.deck_id}/descriptions/generate/`,{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({description_set_id:fresh.dependency.description_set_id,processing_revision:fresh.dependency.processing_revision,
       ...(confirmed?{acknowledge_uncertain:true}:{})}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Could not retry slide profiles. Refresh their status.');
    const updated=await request();if(!valid(op))return;publish(updated);
   }else{
    if(fresh.feedback_revision>0&&!fresh.retry_available)throw new Error('Retry is not available yet.');
    const local=readCorrections(api,id);
    if(local?.pending||local?.conflict||local?.server.revision!==synced.server.revision)throw new Error('Synchronize the latest corrections first.');
    submitted=true;writeStored(pendingKey,{revision:fresh.feedback_revision});
    const next=await request({expected_selection:fresh.selection.token,transcript_revision:synced.server.revision,
      ...(fresh.feedback_revision?{feedback_revision:fresh.feedback_revision}:{}),...(confirmed?{acknowledge_uncertain:true}:{})});
    if(!valid(op))return;publish(next);
   }
   writeStored(pendingKey,false);submitted=false;
   if(valid(op))setMessage({identity,text:''});
  }catch(error){
   if(submitted&&(error as Error & {definite?:boolean}).definite)writeStored(pendingKey,false);
   if(valid(op))setMessage({identity,text:submitted?'Request outcome may be uncertain. Refresh before retrying.':error instanceof Error?error.message:'Feedback unavailable.'});
  }finally{if(valid(op)){lock.current=false;setBusy(false);}}
 };
 const startInitial=useRef<()=>Promise<void>>(async()=>{});
 useLayoutEffect(()=>{startInitial.current=async()=>{await generate();};});
 useEffect(()=>{
  if(!automatic||!raw||raw.state!=='absent'||stale||raw.stale||raw.feedback_revision||raw.availability.state!=='available'||
     !review?.transcript?.words.length||dirty||initial||correction?.pending||correction?.conflict||correction?.server.source_changed||
     (correction?.server.revision??0)>0||!enabled.current)return;
  // Durable BEFORE preflight: failed/offline/uncertain submissions never loop.
  if(readStored<string>(initialKey))return; // Another mounted worker already claimed this initial set.
  initialClaims.add(initialKey);writeStored(initialKey,'starting');bump();
  void startInitial.current().finally(()=>{
   initialClaims.delete(initialKey);
   const saved=readStored<SlideReview>(key);
   writeStored(initialKey,saved?.feedback_revision?'started':'failed');bump();
  });
 },[automatic,raw,stale,review,initial,initialKey,correction,key,dirty]);
 return {state,busy,initial,notice:message.identity===identity?message.text:'',refresh,generate:()=>generate(),
  ask:ask?.identity===identity,confirm:()=>{if(ask?.identity===identity)void generate(ask);},cancel:()=>setAsk(null)};
}
