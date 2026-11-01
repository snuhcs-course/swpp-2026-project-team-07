import { resolve as domainResolve, load as domainLoad } from './domain-loader.mjs';
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native') return { shortCircuit: true, url: moduleUrl(`
    export const View='View',Pressable='Pressable',Modal='Modal',TextInput='TextInput',ScrollView='ScrollView',
      KeyboardAvoidingView='KeyboardAvoidingView',ActivityIndicator='ActivityIndicator';
    export const StyleSheet={create:value=>value};`) };
  if (specifier === '../design/frame') return { shortCircuit: true, url: moduleUrl(`export const Txt='Text';`) };
  if (specifier === '../design/theme') return { shortCircuit: true, url: moduleUrl(`export const useTheme=()=>({c:{bg:'#fff',strong:'#111',body:'#222',secondary:'#555',track:'#ddd'}});`) };
  if (specifier === '../design/tokens') return { shortCircuit: true, url: moduleUrl(`export const F={display:'display',medium:'medium',semibold:'semibold',bold:'bold'};`) };
  if (specifier === 'expo-secure-store') return { shortCircuit: true, url: moduleUrl(`
    export const getItemAsync=async key=>globalThis.__demoAccessStore.get(key)??null;
    export const setItemAsync=async(key,value)=>{globalThis.__demoAccessStore.set(key,value)};
    export const deleteItemAsync=async key=>{globalThis.__demoAccessStore.delete(key)};`) };
  if (specifier === 'expo/fetch') return { shortCircuit: true, url: moduleUrl(`export const fetch=(input,init)=>globalThis.__demoAccessFetch(input,init);`) };
  return domainResolve(specifier, context, nextResolve);
}
export const load = domainLoad;
