/** Eligibility comes from a completed recording workflow, never screen navigation. */
import { readStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
const key=(api:string,id:string)=>`slide-review-auto-eligible:v1:${normalizeApi(api)}:${id}`;
export function enableInitialFeedback(api:string,id:string){writeStored(key(api,id),true);}
export function initialFeedbackEnabled(api:string,id:string){return readStored<boolean>(key(api,id))===true;}
