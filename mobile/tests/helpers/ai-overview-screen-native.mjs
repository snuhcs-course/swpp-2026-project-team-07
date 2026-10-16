import React from 'react';
export const View='view',Pressable='pressable',Txt='text';
export const ScrollView=React.forwardRef(function ScrollView(props,ref){React.useImperativeHandle(ref,()=>({scrollTo:options=>runtime.scrolls.push(options)}));return React.createElement('scroll',props,props.children);});
export const StyleSheet={create:x=>x,absoluteFill:{}};
export const Enter=({children})=>React.createElement('enter',null,children),PanView='pan',Glyph='glyph',UIIcon='icon',MiniSlide='mini-slide',GradeGrid='grade-grid',ScoreRing='score-ring',PageSurface='page-surface',Pill='pill',IconRow='icon-row',Dialog='dialog';
export const runtime={model:null,feedback:null,nav:null,routes:[],audio:new Map(),plays:[],stops:0,players:[],scrolls:[]};
export function useDeckModel(){return runtime.model;}
export function useRunFeedbackStatus(_model,active){return {...runtime.feedback,active};}
export function useRunPresentationScores(model,active,slide){runtime.scoreSelections??=[];runtime.scoreSelections.push(slide);if(runtime.scores)return runtime.scores;const empty={score:null,level:null,status:'Not graded',state:null,result:null,target:null};return {items:Array.from({length:model?.n??0},(_,slide)=>({...empty,slide})),overall:empty,target:null,controller:{state:null,busy:false,notice:'',ask:false,refresh:async()=>{},generate:async()=>{},confirm:()=>{},cancel:()=>{}},notice:'',refresh:async()=>{}};}
export function FeedbackStatusRing({id,item}){return React.createElement('score-ring',{id,value:item?.findingCount??'—',label:item?.label??'Not analyzed',percent:null});}
export const SlideReviewSummary='slide-feedback',TakePlayback='take-playback',TranscriptCorrections='inline-transcript',ReviewRecordingTools='recording-tools';
export const subscribePlaybackId=()=>()=>{};
export const useStore=select=>select({version:0});
export const API_URL='https://synthetic.invalid';
export const getSavedAttempt=()=>null,readReview=()=>null;
export function useReviewAudio(_api,id){return {audio:{uri:runtime.audio.get(id)??null,busy:false,error:''},audioSpec:null,validators:null,download:async()=>{}};}
export const useShell=()=>({nav:runtime.nav,go:(...args)=>runtime.routes.push(args)}),useBack=(_active,callback)=>{runtime.back=callback;},useNow=()=>Date.now(),useFrame=()=>({top:0,left:0,s:1});
export const audioOf=id=>runtime.audio.get(id)??null,useWorkers=()=>new Map();
export function useSegmentPlayer(){const[,render]=React.useState(0);const[p]=React.useState(()=>{const x={playingKey:null,paused:false,error:null,progress:0,elapsedMs:0,positionMs:null,uri:null};
 x.stop=()=>{runtime.stops++;x.playingKey=null;x.positionMs=null;x.uri=null;};
 x.playSegments=async(key,segments)=>{runtime.plays.push({key,segments});if(x.playingKey===key)x.paused=!x.paused;else{x.playingKey=key;x.paused=false;x.uri=segments[0]?.uri;x.positionMs=segments[0]?.startMs;}render(n=>n+1);};
 x.play=(key,segment)=>x.playSegments(key,[segment]);return x;});if(!runtime.players.includes(p))runtime.players.push(p);return p;}
export const Easing={bezier:()=>v=>v},withTiming=v=>v,runOnJS=f=>f;
export const useSharedValue=value=>{const r=React.useRef({value,get(){return this.value},set(v){this.value=v}});return r.current;};
export const useAnimatedStyle=()=>({}),useAnimatedProps=()=>({}),useReducedMotion=()=>true;
export const createThemedStyles=x=>x;
export const useTheme=()=>({mode:runtime.theme??'dark',c:runtime.palettes?.[runtime.theme??'dark']??{text:'#fff',body:'#ddd',secondary:'#aaa',tertiary:'#888',good:'#0a0',warn:'#fa0',bad:'#f44',info:'#88f',strong:'#fff'}});
export const Defs='defs',LinearGradient='gradient',Path='path',Rect='rect',Stop='stop',Circle='circle';
export function HintRow({hints}){return React.createElement('hints',null,hints.map(h=>h.onPress?React.createElement('pressable',{key:h.text,accessibilityRole:'button',accessibilityLabel:h.text,onPress:h.onPress},React.createElement('text',null,h.text)):h.text));}
const Animated=Object.assign(({children})=>React.createElement('svg',null,children),{View:'animated'});export default Animated;

export const RecordButton='record-button',Chip='chip',Pop='pop';
export function transcriptsFor(){return {transcripts:new Map(),stages:new Map()};}
export function resolveCompare(_id,which){runtime.choices??=[];runtime.choices.push(which);const c=runtime.model.state.compare;runtime.model.state.run=which==='new'?c.next:c.prev;runtime.model.state.compare=null;return runtime.model.state.run;}
