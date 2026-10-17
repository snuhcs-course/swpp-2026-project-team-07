import { useState } from 'react';
export const players=[];
export const audioMode={blocks:[]};
export const setAudioModeAsync=async()=>{const blocked=audioMode.blocks.shift();if(blocked)await blocked;};
export function useAudioPlayer(uri) {
 const [player]=useState(()=>{
  const native={uri,playing:false,currentTime:0,duration:10,isLoaded:true,isBuffering:false,error:null,seeks:[],replacements:[],plays:0,
   replace(source){this.uri=source.uri;this.replacements.push(source.uri);},
   play(){this.playing=true;this.plays++;},pause(){this.playing=false;},
   async seekTo(seconds){this.seeks.push(seconds);this.currentTime=seconds;},
   get currentStatus(){return {currentTime:this.currentTime,duration:this.duration,isLoaded:true,isBuffering:false,error:null,playing:this.playing};}};
  players.push(native);return native;
 });
 return player;
}
