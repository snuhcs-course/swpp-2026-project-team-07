import {useEffect,useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {API_URL} from '../../services/api';
import {readStored} from '../../services/storage';
import {normalizeApi} from '../transcription/analysisStorage';
import {bump,deckById,useStore,visibleDecks} from './store';
import {defaultRequirementsPending,synchronizePresentationDefaults} from './defaultRequirements';
import {getRequirementsVersion,subscribeRequirements} from './requirementsStore';
import {readRequirementsDraft,requirementsPending,synchronizeRequirements} from './requirementsDraft';
import {serverSlides} from './serverDeck';
export function DefaultRequirementsHost(){
 useStore(s=>s.version);useSyncExternalStore(subscribeRequirements,getRequirementsVersion);
 return <>{visibleDecks().filter(d=>defaultRequirementsPending(d.id,API_URL)||requirementsPending(d.id,API_URL)).map(d=><Worker key={d.id} id={d.id}/>)}</>;
}
function Worker({id}:{id:string}){
 const mapped=readStored<string>(`server-deck:${normalizeApi(API_URL)}:${id}`);
 useEffect(()=>{
  let disposed=false,running=false;
  const sync=async()=>{
   if(running||disposed||AppState.currentState!=='active')return;
   running=true;
   try{
    const draft=readRequirementsDraft(id,API_URL);if(draft?.conflict)return;
    let deckId=readStored<string>(`server-deck:${normalizeApi(API_URL)}:${id}`);
    if(!deckId){const deck=deckById(id);if(!draft||!deck)return;deckId=(await serverSlides(deck)).deckId;}
    if(disposed||AppState.currentState!=='active')return;
    if(draft)await synchronizeRequirements(id,deckId,API_URL);
    else await synchronizePresentationDefaults(id,deckId,API_URL);
    if(!disposed)bump();
   }catch{/* Durable confirmed choices and defaults remain pending through offline failures. */}
   finally{running=false;}
  };
  void sync();const timer=setInterval(()=>void sync(),10000),sub=AppState.addEventListener('change',s=>{if(s==='active')void sync();});
  return()=>{disposed=true;clearInterval(timer);sub.remove();};
 },[id,mapped]);
 return null;
}
