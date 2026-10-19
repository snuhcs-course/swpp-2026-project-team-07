import {useSyncExternalStore} from 'react';
let version=0;const listeners=new Set();
export function bump(){version++;listeners.forEach(l=>l());}
export function useStore(select){return select({version:useSyncExternalStore(l=>{listeners.add(l);return()=>listeners.delete(l);},()=>version)});}
