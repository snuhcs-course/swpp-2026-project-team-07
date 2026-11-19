/** Eligibility comes from a completed recording workflow, never screen navigation. */
import { readStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
const key=(api:string,id:string)=>`slide-review-auto-eligible:v1:${normalizeApi(api)}:${id}`;
export function enableInitialFeedback(api:string,id:string){writeStored(key(api,id),true);}
export function initialFeedbackEnabled(api:string,id:string){return readStored<boolean>(key(api,id))===true;}
// Claude Code, prompted by Seoyeon (2026-11-15): feedback v3 eligibility is set only when a NEW recording is
// handed off (rehearsal/analysis.tsx), never for recordings made before this version.
const v3Key=(api:string,id:string)=>`feedback-v3-auto-eligible:v1:${normalizeApi(api)}:${id}`;
export function enableAutomaticFeedbackV3(api:string,id:string){writeStored(v3Key(api,id),true);}
export function automaticFeedbackV3Enabled(api:string,id:string){return readStored<boolean>(v3Key(api,id))===true;}
