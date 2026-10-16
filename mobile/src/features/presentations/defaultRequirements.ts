// User-authorized defaults for newly imported presentations; legacy absence stays missing.
import {writeStored} from '../../services/storage';
import {createPresentationContextClient} from './contextClient';
import {requirementsDirty} from './requirementsDraft';
import {serializeContextWrite} from './contextWriter';
import {DEFAULT_AUDIENCE,DEFAULT_DURATION_SECONDS,defaultRequirementsKey as key,defaultRequirementsPending} from './defaultRequirementsState';
export {DEFAULT_AUDIENCE,DEFAULT_DURATION_SECONDS,requestPresentationDefaults,cancelPresentationDefaults,defaultRequirementsPending,hasDefaultRequirements} from './defaultRequirementsState';
const locks=new Map<string,Promise<void>>();
export function synchronizePresentationDefaults(id:string,deckId:string,api:string,transport:typeof globalThis.fetch=globalThis.fetch):Promise<void>{
 const k=key(id,api),existing=locks.get(k);if(existing)return existing;
 if(!defaultRequirementsPending(id,api))return Promise.resolve();
 const client=createPresentationContextClient(api,(url,options)=>transport(url,{...options,signal:AbortSignal.timeout(15000)}));
 const promise=serializeContextWrite(id,api,async()=>{
  if(requirementsDirty(id,api))return;
  let r=await client.ensure(id,deckId);
  // An idempotent ensure can reveal a previously completed save or someone else's preferences.
  if(requirementsDirty(id,api))return;
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
 }).finally(()=>{if(locks.get(k)===promise)locks.delete(k);});
 locks.set(k,promise);return promise;
}
