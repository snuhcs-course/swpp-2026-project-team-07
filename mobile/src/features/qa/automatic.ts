import {readStored,writeStored} from '../../services/storage';
import {normalizeApi} from '../transcription/analysisStorage';
const key=(api:string,id:string)=>`qa-auto-eligible:v2:${normalizeApi(api)}:${id}`;
export function enableInitialQa(api:string,id:string){writeStored(key(api,id),true);}
export function initialQaEnabled(api:string,id:string){return readStored<boolean>(key(api,id))===true;}
