import React from 'react';
export const View='view',Pressable='pressable',ScrollView='scroll',TextInput='input',Txt='text',Glyph='glyph',PanView='pan',Rect='rect';
export default 'svg';
export const StyleSheet={create:x=>x,absoluteFill:{}};
export const Easing={bezier:()=>()=>0};
export const useFrame=()=>({s:1,top:0});
export const useSharedValue=initial=>React.useState(()=>({value:initial,get(){return this.value},set(x){this.value=x}}))[0];
export const useAnimatedStyle=()=>({}),withTiming=x=>x;
export const createThemedStyles=x=>x;
export const useTheme=()=>({c:{text:'#fff',body:'#ddd',secondary:'#aaa',surface06:'#222',surface08:'#222',ink14:'#333',goldText:'#ffe',bg:'#111'}});
export const API_URL='https://synthetic.invalid';
export const audioOf=id=>`file:///${id}.m4a`;
export const useWorkers=()=>new Map(),stageOf=()=> 'done';
export const subscribePlaybackId=()=>()=>{};
export const suggestionActive=()=>false;
export const useTranscriptCorrections=id=>{globalThis.correctionSources.push(id);return {...globalThis.correctionState,
 generate:()=>globalThis.correctionCalls.push(['check',id]),
 synchronize:()=>globalThis.correctionCalls.push(['sync',id]),
 clearSyncError:source=>globalThis.correctionCalls.push(['clear',source]),
};};
export const acceptSuggestedCorrection=(api,id,first,last,value,transcript)=>globalThis.correctionCalls.push(['accept',id,first,last,value,transcript]);
export const restoreCorrections=(api,id,first,last,transcript)=>globalThis.correctionCalls.push(['restore',id,first,last,transcript]);
export const createCorrectionClient=()=>({synchronize:async id=>globalThis.correctionCalls.push(['persist',id])});
export const updateDeckState=()=>{},bump=()=>{};
export const useStore=selector=>selector({version:0});
export const useDeckModel=()=>globalThis.correctionModel;
export const useSegmentPlayer=()=>globalThis.correctionPlayer;
export const playbackAppListeners=new Set();
export const AppState={addEventListener:(_event,listener)=>{playbackAppListeners.add(listener);return {remove(){playbackAppListeners.delete(listener);}};}};
export const emitPlaybackAppState=state=>{for(const listener of playbackAppListeners)listener(state);};
const nativePlayer={currentStatus:{currentTime:0,duration:10,isLoaded:true},pause(){},seekTo:async seconds=>globalThis.correctionCalls.push(['seek',seconds]),play(){}};
export const useAudioPlayer=()=>nativePlayer,setAudioModeAsync=async()=>{};
export const useReviewPlayerStatus=()=>({status:{currentTime:0,duration:10,isLoaded:true,isBuffering:false,playing:false},hasLoaded:true});
export const getSavedAttempt=()=>null,saveAttempt=()=>{},recoverRecording=x=>x;
export const readReview=()=>globalThis.correctionReview;
export const useReviewAudio=()=>globalThis.takeReviewAudio??({audio:{uri:'file:///B.m4a',busy:false},audioSpec:null,audioFailed:()=>{}});
export const validEvents=()=>false,validVisits=()=>true,localUri=x=>x;
export const useReviewDeck=()=>({deck:null}),useReviewPdf=()=>null,useReviewPdfMedia=()=>({pdf:{}});
export const readFeedback=()=>null,retainCoaching=id=>{globalThis.recordingToolCalls?.push(['retain',id]);return ()=>{};},useCoaches=()=>new Map(),inspectCoaching=id=>globalThis.recordingToolCalls?.push(['inspect',id]),requestCoaching=id=>globalThis.recordingToolCalls?.push(['generate',id]);
