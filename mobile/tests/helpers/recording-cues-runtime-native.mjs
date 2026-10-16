// Synthetic capture/player adapters; no microphone, providers or user data.
import React from 'react';
export const Text='text', View='view', Pressable='pressable', TextInput='input';
export const setupNative={frame:{top:0,left:0,s:1,width:390,height:844},scrolls:[],keyboard:null,listeners:new Map()};
export const ScrollView=React.forwardRef(function NativeScroll(props,ref){React.useImperativeHandle(ref,()=>({scrollTo:options=>setupNative.scrolls.push(options)}));return React.createElement('scroll',props);});
export const Keyboard={metrics:()=>setupNative.keyboard,addListener:(name,listener)=>{const listeners=setupNative.listeners.get(name)??new Set();listeners.add(listener);setupNative.listeners.set(name,listeners);return{remove:()=>listeners.delete(listener)};},dismiss:()=>{setupNative.keyboard=null;for(const fn of setupNative.listeners.get('keyboardDidHide')??[])fn({});}};
export function emitSetupKeyboard(name,screenY){setupNative.keyboard=name==='keyboardDidHide'?null:{screenY};for(const fn of setupNative.listeners.get(name)??[])fn({endCoordinates:{screenY}});}
export const StyleSheet={create:v=>v,absoluteFill:{}};
export const Enter=({children})=>React.createElement('enter',null,children), Txt='text';
export const useFrame=()=>setupNative.frame;
export const Glyph='glyph',PanView='pan',SlideCard='slide-card',CARD_H=196,CARD_W=358;
export const Chip='chip',Confetti='confetti',Dialog='dialog',HintRow='hints',OrbitalCaption='orbital-caption',PageSurface='page-surface',RecordButton='record-button',RecordRing='record-ring',RoundButton='round-button',Waveform='waveform',IDLE_WAVE=[];
export const Easing={linear:v=>v,cubic:v=>v,bezier:()=>v=>v,inOut:f=>f};
export const cancelAnimation=()=>{},runOnJS=f=>f,withTiming=v=>v;
export const useSharedValue=value=>{const r=React.useRef({value,get(){return this.value;},set(v){this.value=v;}});return r.current;};
export const useAnimatedStyle=()=>({}),useReducedMotion=()=>true;
const Animated=Object.assign(({children})=>React.createElement('svg',null,children),{View:'animated'});export default Animated;
export const Rect='rect',selectionAsync=async()=>{},impactAsync=async()=>{},ImpactFeedbackStyle={Medium:'medium'};
export const runtime={model:null,version:0,listeners:new Set(),shell:null,captures:[],played:[],stops:0,routes:[],recoveries:[],audio:new Map(),startWait:null,
 reset(model,slide=0){this.model=model;this.version++;this.captures=[];this.played=[];this.stops=0;this.routes=[];this.recoveries=[];this.audio=new Map();this.startWait=null;
 this.shell={nav:{deckId:model.deck.id,slide,nav:null},go:(...a)=>this.routes.push(a),home:{p:{get:()=>0,set(){}}}};},
 emit(){this.version++;for(const l of this.listeners)l();}};
const subscribe=l=>{runtime.listeners.add(l);return()=>runtime.listeners.delete(l);};
export function useDeckModel(){React.useSyncExternalStore(subscribe,()=>runtime.version);return runtime.model;}
export const useShell=()=>runtime.shell,useBack=()=>{},ensurePages=async()=>{},ensureSlideText=async()=>{};
export const useStore=select=>select({version:React.useSyncExternalStore(subscribe,()=>runtime.version)});
export const getDeckState=()=>runtime.model.state,visibleDecks=()=>[runtime.model.deck],bump=()=>runtime.emit();
export function updateDeckState(_id,f){runtime.model.state=f(runtime.model.state);runtime.emit();}
export const savedAttempts=()=>runtime.recoveries,audioOf=id=>runtime.audio.get(id)??null;
export function commitTake(_deck,take){const run={id:'recovered-run',sel:0,parts:[{attemptId:take.attemptId,segments:[{startMs:0,endMs:take.durationMs}]},null]};runtime.model.state={...runtime.model.state,run};runtime.emit();return{run,compare:null};}
export const CaptureEngine=React.forwardRef(function SyntheticCapture(props,ref){
 const[capture]=React.useState(()=>{const c={started:0,slides:[],props,async start(current){this.started++;this.slides.push(current());if(runtime.startWait)await runtime.startWait;},slideChanged(i){this.slides.push(i);},async stop(){return{attemptId:'synthetic-capture',durationMs:5000,events:[{slide_index:this.slides[0],at_ms:0}]};}};runtime.captures.push(c);return c;});
 capture.props=props;React.useImperativeHandle(ref,()=>capture,[capture]);return null;});
export function useSegmentPlayer(){const[,render]=React.useState(0);const[p]=React.useState(()=>({playingKey:null,paused:false,error:null,
 stop(){runtime.stops++;this.playingKey=null;this.paused=false;render(n=>n+1);},async playSegments(key,segments){runtime.played.push({key,segments});if(this.playingKey===key)this.paused=!this.paused;else{this.playingKey=key;this.paused=false;}render(n=>n+1);}}));
 const[bound]=React.useState(()=>{p.stop=p.stop.bind(p);return p;});return bound;}
export function TakePlayback(props){return React.createElement('take-playback',props);}
