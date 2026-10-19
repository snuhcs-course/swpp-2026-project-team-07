/** A GET-only overview plus one explicit grading owner for the selected original recording. */
import { useCallback,useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { API_URL } from '../../services/api';
import type { DeckModel } from '../presentations/useDeckModel';
import { useStore } from '../presentations/store';
import { getRequirementsVersion,subscribeRequirements } from '../presentations/requirementsStore';
import { normalizeApi } from '../transcription/analysisStorage';
import type { ScoreTarget } from './presentationScore';
import { createPresentationScoreReader,presentationScoreKey } from './presentationScoreStore';
import { selectedPresentationScores } from './selectedPresentationScores';
import { usePresentationScore } from './usePresentationScore';

export function useRunPresentationScores(model:DeckModel|null,active=true,selectedSlide?:number){
 const api=normalizeApi(API_URL),version=useStore(s=>s.version);
 const requirementsVersion=useSyncExternalStore(subscribeRequirements,getRequirementsVersion);
 const [foreground,setForeground]=useState(AppState.currentState==='active');
 const [readVersion,setReadVersion]=useState(0),[connection,setConnection]=useState({identity:'',failed:false});
 void version;void requirementsVersion;void readVersion;
 const derived=selectedPresentationScores(model,api,selectedSlide);
 const controller=usePresentationScore(derived.target,derived.requirementsRevision,model?.deck.id,active&&foreground);
 const owned=derived.target?presentationScoreKey(api,derived.target):null;
 const others=derived.targets.filter(t=>presentationScoreKey(api,t)!==owned);
 const polling=derived.activeTargets.filter(t=>presentationScoreKey(api,t)!==owned);
 const identity=JSON.stringify([model?.deck.id,model?.state.run?.parts,selectedSlide,derived.requirementsRevision,
  derived.targets.map(t=>[presentationScoreKey(api,t),t.review?.duration_ms,t.review?.slide_events])]);
 const pollingIdentity=JSON.stringify(polling.map(t=>presentationScoreKey(api,t)));
 const snapshot=useRef({others,polling}),visible=useRef(active&&foreground),fence=useRef(identity),sequence=useRef(0);
 useLayoutEffect(()=>{snapshot.current={others,polling};visible.current=active&&foreground;fence.current=identity;});
 const read=useCallback(async(targets:ScoreTarget[])=>{
  if(!visible.current||!targets.length)return;
  const captured=fence.current,mine=++sequence.current;
  const reader=createPresentationScoreReader(api);
  const results=await Promise.allSettled(targets.map(t=>reader.read(t)));
  if(!visible.current||captured!==fence.current||mine!==sequence.current)return;
  setConnection({identity:captured,failed:results.some(r=>r.status==='rejected')});setReadVersion(v=>v+1);
 },[api,setConnection,setReadVersion]);
 useEffect(()=>{
  const sub=AppState.addEventListener('change',s=>setForeground(s==='active'));
  return()=>{sub.remove();visible.current=false;};
 },[]);
 useEffect(()=>{if(active&&foreground)void read(snapshot.current.others);},[active,foreground,identity,read]);
 const offline=connection.identity===identity&&connection.failed;
 useEffect(()=>{
  if(!active||!foreground||pollingIdentity==='[]'&&!offline)return;
  const timer=setInterval(()=>void read(offline?snapshot.current.others:snapshot.current.polling),offline?5000:2500);
  return()=>clearInterval(timer);
 },[active,foreground,offline,pollingIdentity,read]);
 const refresh=async()=>{await Promise.allSettled([controller.refresh(),read(snapshot.current.others)]);};
 return {...derived,controller,refresh,notice:controller.notice||(offline?'Connection interrupted. Saved scores are retained. Reconnecting…':'')};
}
