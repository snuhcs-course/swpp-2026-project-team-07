import {useCallback,useEffect,useLayoutEffect,useRef,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {API_URL} from '../../services/api';
import {readStored,writeStored} from '../../services/storage';
import {normalizeApi} from '../transcription/analysisStorage';
import {readReview} from '../transcription/reviewStorage';
import {bump,useStore} from '../presentations/store';
import {readRequirements,getRequirementsVersion,subscribeRequirements} from '../presentations/requirementsStore';
import {createCorrectionClient,initializeCorrections,readCorrections} from '../presentations/correctionStore';
import {initialQaEnabled} from './automatic';
import type {DeckModel} from '../presentations/useDeckModel';
import {qaScope,qaAnchor,qaOutdated,parseQaState,qaActive,type QaState} from './state';
const locks=new Set<string>();
const api=()=>normalizeApi(API_URL);
export function useDurableQa(model:DeckModel,automatic=false){
 useStore(s=>s.version);useSyncExternalStore(subscribeRequirements,getRequirementsVersion);
 const requirements=readRequirements(model.deck.id,API_URL);
 const scope=qaScope(model.state.run??{parts:[]},requirements.contextId),scopeJson=String(JSON.stringify(scope)),id=String(qaAnchor(scope)??'');
 const identity=JSON.stringify([api(),id,scope]),key=`qa-state:v2:${identity}`;
 const initialKey=`qa-initial:v2:${JSON.stringify([api(),model.deck.id,scope.slides])}`;
 const raw=readStored<QaState>(key);
 const sources=Object.fromEntries([...new Set(scope.slides.map(s=>s.attempt_id))].map(sid=>{
  const c=readCorrections(API_URL,sid);return [sid,{revision:c?.server.revision??0,pending:c?.pending,conflict:!!c?.conflict,sourceChanged:c?.server.source_changed}];
 }));
 const outdated=!!raw&&qaOutdated(raw,requirements.revision,sources);
 const state=raw&&outdated?{...raw,stale:true,state:'stale',result:raw.result?{...raw.result,stale:true}:null}:raw;
 const fence=JSON.stringify([identity,requirements.revision]);
 const live=useRef(fence);useLayoutEffect(()=>{live.current=fence;},[fence]);
 const save=useCallback((next:QaState)=>{
  const prior=readStored<QaState>(key);
  if(prior&&(prior.feedback_revision>next.feedback_revision||prior.feedback_revision===next.feedback_revision&&Date.parse(prior.updated_at??'')>Date.parse(next.updated_at??'')))return;
  writeStored(key,next);bump();
 },[key]);
 const request=useCallback(async(body?:object)=>{
  const response=await fetch(`${api()}/attempts/${id}/audience-qa/${body?'':`?scope=${encodeURIComponent(scopeJson)}`}`,{
   method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify({scope:JSON.parse(scopeJson),...body}):undefined,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(response.status===409?'Q&A inputs changed. Refresh before retrying.':'Q&A is unavailable. Your recordings are preserved.');
  const next=parseQaState(await response.json(),id!,JSON.parse(scopeJson));save(next);return next;
 },[id,save,scopeJson]);
 const notice=readStored<string>(`${key}:notice`)??'';
 const message=useCallback((text:string)=>{writeStored(`${key}:notice`,text);bump();},[key]);
 const refresh=useCallback(async()=>{
  if(!id||locks.has(key)||AppState.currentState!=='active')return;
  locks.add(key);
  try{const s=await request();const pending=readStored<number>(`${key}:uncertain`);if(pending!==null&&s.feedback_revision>pending)writeStored(`${key}:uncertain`,null);message('');}
  catch{message('Offline or unavailable. Saved Q&A is retained.');}finally{locks.delete(key);}
 },[id,key,message,request]);
 useEffect(()=>{void refresh();const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});return()=>sub.remove();},[refresh]);
 const eligible=automatic&&!!id&&!!requirements.audience.trim()&&!!requirements.deckId&&model.transcribed&&!model.state.compare&&scope.slides.some(s=>initialQaEnabled(API_URL,s.attempt_id));
 const active=qaActive(raw)||eligible&&!readStored(initialKey)&&readStored<number>(`${key}:uncertain`)===null&&(!raw||raw.state==='absent');
 useEffect(()=>{if(!active)return;const timer=setInterval(()=>void refresh(),4000);return()=>clearInterval(timer);},[active,refresh]);
 const generate=useCallback(async(confirmed=false,initial=false)=>{
  if(!id||locks.has(key))return;
  locks.add(key);bump();
  try{
   if(model.state.compare)throw new Error('Choose Keep or Overwrite before updating Q&A.');
   if(!model.transcribed)throw new Error('Wait for the selected recordings to finish transcription.');
   if(!requirements.audience.trim())throw new Error('Presentation audience is missing. Requirements entry is not available yet.');
   const revisions:Record<string,number>={};
   for(const sid of [...new Set(JSON.parse(scopeJson).slides.map((s:{attempt_id:string})=>s.attempt_id))] as string[]){
    const review=readReview(API_URL,sid);
    if(!review?.transcript||!review.transcript_id||review.deck_id!==requirements.deckId)throw new Error('Selected transcript and presentation context must be synchronized.');
    initializeCorrections(API_URL,sid,review.transcript_id,review.transcript);
    const correctionClient=createCorrectionClient(API_URL);
    await correctionClient.refresh(sid);
    const c=await correctionClient.synchronize(sid);
    if(c.pending||c.conflict||c.server.source_changed)throw new Error('Resolve correction synchronization before updating Q&A.');
    revisions[sid]=c.server.revision;
   }
   if(live.current!==fence)return;
   const fresh=await request();if(live.current!==fence)return;
   if(qaActive(fresh)||fresh.state==='completed'&&!fresh.stale)return;
   if(initial&&(fresh.feedback_revision||fresh.state!=='absent'||Object.values(revisions).some(r=>r>0)||readStored<number>(`${key}:uncertain`)!==null))return;
   if(!fresh.selection||fresh.availability.state!=='available')throw new Error('Q&A is unavailable on this server.');
   const uncertain=readStored<number>(`${key}:uncertain`)!==null||fresh.requires_confirmation||fresh.dependency?.requires_confirmation;
   if(confirmed){const captured=readStored<{revision:number;token:string;dependency:number|null}>(`${key}:confirm`);
    if(!captured||captured.revision!==fresh.feedback_revision||captured.token!==fresh.selection.token||captured.dependency!==(fresh.dependency?.processing_revision??null))throw new Error('Q&A status changed. Review it before confirming another retry.');
   }
   if(uncertain&&!confirmed){writeStored(`${key}:confirm`,{revision:fresh.feedback_revision,token:fresh.selection.token,dependency:fresh.dependency?.processing_revision??null});bump();return;}
   for(const [sid,rev]of Object.entries(revisions)){
    const c=readCorrections(API_URL,sid);if(c?.pending||c?.conflict||c?.server.revision!==rev)throw new Error('Corrections changed. Synchronize before updating Q&A.');
   }
   if(fresh.dependency?.retry_action){
    if(!fresh.dependency.retry_available)throw new Error('Profile retry is not available yet.');
    writeStored(`${key}:uncertain`,fresh.feedback_revision);
    const response=await fetch(`${api()}/decks/${requirements.deckId}/descriptions/generate/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({description_set_id:fresh.dependency.description_set_id,processing_revision:fresh.dependency.processing_revision,...(confirmed?{acknowledge_uncertain:true}:{})}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Profile retry failed. Refresh its status.');
   }else{
    if(fresh.feedback_revision&&!fresh.retry_available)throw new Error('Retry is not available yet.');
    writeStored(`${key}:uncertain`,fresh.feedback_revision);
    if(initial)writeStored(initialKey,true);
    await request({expected_selection:fresh.selection.token,source_revisions:revisions,...(fresh.feedback_revision?{feedback_revision:fresh.feedback_revision}:{}),...(confirmed?{acknowledge_uncertain:true}:{})});
   }
   writeStored(`${key}:uncertain`,null);writeStored(`${key}:confirm`,false);message('');
  }catch(e){if(initial)writeStored(`${initialKey}:retry-at`,Date.now()+5000);message(e instanceof Error?e.message:'Q&A unavailable.');}
  finally{locks.delete(key);bump();}
 },[id,key,model.state.compare,model.transcribed,requirements.audience,requirements.deckId,scopeJson,fence,request,message,initialKey]);
 const autoRef=useRef(generate);useLayoutEffect(()=>{autoRef.current=generate;});
 useEffect(()=>{
  if(!automatic||!id||!raw||raw.state!=='absent'||raw.feedback_revision||outdated||!requirements.audience.trim()||!model.transcribed||model.state.compare||!requirements.deckId||readStored(initialKey)||readStored<number>(`${key}:uncertain`)!==null||(readStored<number>(`${initialKey}:retry-at`)??0)>Date.now())return;
  if(!scope.slides.some(s=>initialQaEnabled(API_URL,s.attempt_id))||Object.values(sources).some(s=>s.pending||s.conflict||s.sourceChanged||s.revision>0))return;
  if(locks.has(key))return;
  void autoRef.current(false,true);
 },[automatic,id,raw,outdated,requirements.audience,requirements.deckId,model.transcribed,model.state.compare,initialKey,key,scope.slides,sources]);
 return {state,identity,notice,busy:locks.has(key),refresh,generate:()=>generate(),ask:!!readStored(`${key}:confirm`),
 confirm:()=>generate(true),cancel:()=>{writeStored(`${key}:confirm`,false);bump();}};
}
