import {useSyncExternalStore} from 'react';
const listeners=new Set();let version=0;
export const bump=()=>{version++;for(const listener of listeners)listener();};
export const useStore=select=>useSyncExternalStore(callback=>{listeners.add(callback);return()=>listeners.delete(callback);},()=>select({version}));
export const visibleDecks=()=>globalThis.runtimeDecks??[];
export const getDeckState=id=>globalThis.runtimeDeckStates?.[id]??({});
