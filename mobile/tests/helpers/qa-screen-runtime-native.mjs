// Observable deterministic native boundary. Animated styles remain readable so a
// page alpha/transform regression is not discarded by a no-op style mock.
import React from 'react';
export const View='view',Pressable='pressable',ScrollView='scroll',Text='text',Image='image';
export const StyleSheet={create:x=>x,absoluteFill:{position:'absolute',left:0,top:0,right:0,bottom:0}};
export const PanResponder={create:handlers=>({panHandlers:handlers})};
export const useWindowDimensions=()=>({width:390,height:844});
export const useSafeAreaInsets=()=>({left:0,right:0,top:0,bottom:0});
export const Easing={linear:v=>v,cubic:v=>v,bezier:()=>v=>v,out:f=>f,inOut:f=>f};
export const cancelAnimation=value=>value.cancel?.(),withTiming=(value,options,done)=>done?{timing:true,value,options,done}:value,withRepeat=v=>v;
export const runOnJS=f=>(...args)=>{if(runtime.deferJs)runtime.js.push(()=>f(...args));else f(...args);};
export const useReducedMotion=()=>runtime.reducedMotion;
export const useSharedValue=initial=>React.useState(()=>{let value=initial,animation=null;const cancel=()=>{animation?.finish(false);};return{get value(){return value;},set value(v){value=v;},get:()=>value,cancel,set:next=>{cancel();if(!next?.timing){value=next;return;}value=next.value;const current={done:next.done,finish:finished=>{if(animation!==current)return;animation=null;runtime.timings.delete(current);next.done(finished);}};animation=current;runtime.timings.add(current);if(!runtime.deferTimings)current.finish(true);}};})[0];
// Reanimated PropsFilter retains the first React style even after a shared-value
// animation updates the native view. Keep both observations for entrance tests.
export const useAnimatedStyle=updater=>{const [initial]=React.useState(()=>updater());return{__initialStyle:initial,get __animatedStyle(){return updater();}};};
export const useAnimatedProps=updater=>({get __animatedProps(){return updater();}});
export function flattenStyle(value,reactProps=false){return Object.assign({},...(Array.isArray(value)?value:[value]).flatMap(item=>item?(Array.isArray(item)?[flattenStyle(item,reactProps)]:[reactProps?(item.__initialStyle??item):(item.__animatedStyle??item)]):[]));}
const Animated=Object.assign(({children,...props})=>React.createElement('svg',props,children),{View:'animated',createAnimatedComponent:component=>component});export default Animated;
export const Defs='defs',LinearGradient='gradient',RadialGradient='radial-gradient',Rect='rect',Stop='stop',Circle='circle',Path='path',ClipPath='clip-path',G='g';
export const Glyph='glyph',UIIcon='icon';
export const createThemedStyles=x=>x;
export const useTheme=()=>({mode:'light',c:{bg:'#F7F7FA',text:'#14161D',body:'#303442',secondary:'#596173',tertiary:'#737B8D',track:'#D8DBE4'}});
export const runtime={reducedMotion:false,deferTimings:false,deferJs:false,timings:new Set(),js:[],finishTimings(){for(const timing of [...this.timings])timing.finish(true);},flushJs(){for(const call of this.js.splice(0))call();},routes:[],mounts:0,unmounts:0,speechStops:0,playerStops:0,nav:{deckId:'runtime-deck',nav:'fade',sel:3,visit:4}};
export const useShell=()=>({nav:runtime.nav,go:(...args)=>runtime.routes.push(args)}),useBack=()=>{};
export const useDeckModel=()=>globalThis.qaScreenModel;
export const useDurableQa=()=>globalThis.qaScreenValue;
export const AnswerRecorder=React.forwardRef(function AnswerRecorder(_props,ref){
 React.useEffect(()=>{runtime.mounts++;return()=>{runtime.unmounts++;};},[]);
 React.useImperativeHandle(ref,()=>({recording:()=>false}));return null;
});
const player={stop:()=>{runtime.playerStops++;},playingKey:null,play:async()=>{}};
export const useSegmentPlayer=()=>player;
export const stop=()=>{runtime.speechStops++;},speak=()=>{},selectionAsync=async()=>{};
