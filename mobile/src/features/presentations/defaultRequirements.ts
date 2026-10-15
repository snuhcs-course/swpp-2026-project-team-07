// User-authorized defaults for newly imported presentations; legacy absence stays missing.
import {readStored,writeStored,removeStored} from '../../services/storage';
import {normalizeApi} from '../transcription/analysisStorage';
import {createPresentationContextClient} from './contextClient';
import {readRequirements} from './requirementsStore';
export const DEFAULT_AUDIENCE='General audience';
export const DEFAULT_DURATION_SECONDS=300;
type Intent={pending:boolean;appliedRevision:number|null;contextId:string|null};
const key=(id:string,api:string)=>`presentation-defaults:v1:${normalizeApi(api)}:${encodeURIComponent(id)}`;
const locks=new Map<string,Promise<void>>();
export function requestPresentationDefaults(id:string,api:string){
 if(!readStored(key(id,api)))writeStored(key(id,api),{pending:true,appliedRevision:null,contextId:null});
}
export function cancelPresentationDefaults(id:string,api:string){removeStored(key(id,api));}
export function defaultRequirementsPending(id:string,api:string){return readStored<Intent>(key(id,api))?.pending===true;}
export function hasDefaultRequirements(id:string,api:string){
 try{
 const intent=readStored<Intent>(key(id,api));if(!intent)return false;
 const r=readRequirements(id,api);
 return !!intent&&!intent.pending&&intent.contextId===r.contextId&&intent.appliedRevision===r.revision&&
  r.audience===DEFAULT_AUDIENCE&&r.requiredDurationSeconds===DEFAULT_DURATION_SECONDS;
 }catch{return false;}
}
export function synchronizePresentationDefaults(id:string,deckId:string,api:string,transport:typeof globalThis.fetch=globalThis.fetch):Promise<void>{
 const k=key(id,api),existing=locks.get(k);if(existing)return existing;
 if(!defaultRequirementsPending(id,api))return Promise.resolve();
 const client=createPresentationContextClient(api,(url,options)=>transport(url,{...options,signal:AbortSignal.timeout(15000)}));
 const promise=(async()=>{
  let r=await client.ensure(id,deckId);
  // An idempotent ensure can reveal a previously completed save or someone else's preferences.
  if(r.revision===0&&!r.audience.trim()&&r.requiredDurationSeconds===null){
   try{r=await client.update(id,{expectedRevision:0,audience:DEFAULT_AUDIENCE,requiredDurationSeconds:DEFAULT_DURATION_SECONDS});}
   catch(error){
    // Resolve conflicts/lost acknowledgements through a read, never an overwrite.
    const current=await client.refresh(id);
    if(current.revision===0)throw error;
    r=current;
   }
  }
  const applied=r.audience===DEFAULT_AUDIENCE&&r.requiredDurationSeconds===DEFAULT_DURATION_SECONDS;
  writeStored(k,{pending:false,contextId:r.contextId,appliedRevision:applied?r.revision:null});
 })().finally(()=>{if(locks.get(k)===promise)locks.delete(k);});
 locks.set(k,promise);return promise;
}
