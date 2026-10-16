// Persisted default intent/provenance. Independent of context writers and confirmed drafts.
import {readStored,writeStored,removeStored} from '../../services/storage';
import {normalizeApi} from '../transcription/analysisStorage';
import {readRequirements} from './requirementsStore';
export const DEFAULT_AUDIENCE='General audience';
export const DEFAULT_DURATION_SECONDS=300;
type Intent={pending:boolean;appliedRevision:number|null;contextId:string|null};
export const defaultRequirementsKey=(id:string,api:string)=>`presentation-defaults:v1:${normalizeApi(api)}:${encodeURIComponent(id)}`;
export function requestPresentationDefaults(id:string,api:string){
 if(!readStored(defaultRequirementsKey(id,api)))writeStored(defaultRequirementsKey(id,api),{pending:true,appliedRevision:null,contextId:null});
}
export function cancelPresentationDefaults(id:string,api:string){removeStored(defaultRequirementsKey(id,api));}
export function defaultRequirementsPending(id:string,api:string){return readStored<Intent>(defaultRequirementsKey(id,api))?.pending===true;}
export function hasDefaultRequirements(id:string,api:string){
 try{
 const intent=readStored<Intent>(defaultRequirementsKey(id,api));if(!intent)return false;
 const r=readRequirements(id,api);
 return !!intent&&!intent.pending&&intent.contextId===r.contextId&&intent.appliedRevision===r.revision&&
  r.audience===DEFAULT_AUDIENCE&&r.requiredDurationSeconds===DEFAULT_DURATION_SECONDS;
 }catch{return false;}
}
