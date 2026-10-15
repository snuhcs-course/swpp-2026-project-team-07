import {useEffect} from 'react';
import {AppState} from 'react-native';
import {API_URL} from '../../services/api';
import {readStored} from '../../services/storage';
import {normalizeApi} from '../transcription/analysisStorage';
import {bump,useStore,visibleDecks} from './store';
import {defaultRequirementsPending,synchronizePresentationDefaults} from './defaultRequirements';
export function DefaultRequirementsHost(){
 useStore(s=>s.version);
 return <>{visibleDecks().filter(d=>defaultRequirementsPending(d.id,API_URL)).map(d=><Worker key={d.id} id={d.id}/>)}</>;
}
function Worker({id}:{id:string}){
 const deckId=readStored<string>(`server-deck:${normalizeApi(API_URL)}:${id}`);
 useEffect(()=>{
  if(!deckId)return;
  let disposed=false;
  const sync=()=>{if(AppState.currentState==='active')void synchronizePresentationDefaults(id,deckId,API_URL).then(()=>{if(!disposed)bump();}).catch(()=>{/* Durable intent retries after reconnect; no invented synchronized values. */});};
  sync();const timer=setInterval(sync,10000),sub=AppState.addEventListener('change',s=>{if(s==='active')sync();});
  return()=>{disposed=true;clearInterval(timer);sub.remove();};
 },[id,deckId]);
 return null;
}
