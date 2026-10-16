import {resolve as workflowResolve} from './presentation-score-workflow-loader.mjs';
export {load} from './domain-loader.mjs';
export function resolve(specifier,context,next){
 if(specifier.endsWith('/presentations/useDeckModel'))return {url:'data:text/javascript,export const useDeckModel=id=>globalThis.runtimeModels?.[id]??null;',shortCircuit:true};
 if(specifier==='react-native'||/\/(frame|theme|ScoreRing)$/.test(specifier))return {url:new URL('./presentation-score-integration-native.mjs',import.meta.url).href,shortCircuit:true};
 if(specifier==='react-native-reanimated')return {url:new URL('./ai-overview-screen-native.mjs',import.meta.url).href,shortCircuit:true};
 return workflowResolve(specifier,context,next);
}
