import { resolve as correctionResolve } from './correction-store-loader.mjs';
export { load } from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve) {
 if(['react-native','expo-router'].includes(specifier))return {url:new URL('./recording-screen-ui.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier.endsWith('/presentations/store'))return {url:'data:text/javascript,export const useStore=f=>f({version:0});export const bump=()=>{};',shortCircuit:true};
 return correctionResolve(specifier,context,nextResolve);
}
