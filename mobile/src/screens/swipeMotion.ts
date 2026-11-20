import { useEffect, useRef } from 'react';
import { cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { EASE_SCREEN } from '../design/tokens';

export const SWIPE_ENTRY_X = 72;
const SWIPE_EXIT_MS = 120;
const SWIPE_ENTER_MS = 260;

/** Keeps content attached to a horizontal drag, then eases the selected content into place. */
export function useHorizontalSwipeMotion({slideOnly=false,initialX=0,active=true}:{slideOnly?:boolean;initialX?:number;active?:boolean}={}) {
  const reduced = useReducedMotion();
  const x = useSharedValue(reduced?0:initialX);
  const settling = useRef(false);
  const exiting = useRef(false);
  const generation = useRef(0);
  const style = useAnimatedStyle(() => ({
    opacity: reduced || slideOnly ? 1 : Math.max(0.3, 1 - Math.abs(x.value) / 190),
    transform: [{ translateX: reduced ? 0 : x.value * (slideOnly?1:0.38) }],
  }));
  const duration=slideOnly?SWIPE_ENTER_MS:460;
  useEffect(()=>{if(initialX&&!reduced)x.set(withTiming(0,{duration,easing:EASE_SCREEN}));},[duration,initialX,reduced,x]);
  const move = (dx: number) => { if (!reduced&&!exiting.current) {settling.current=false;x.set(Math.max(-150, Math.min(150, dx)));} };
  const settle = () => {if(exiting.current||settling.current||x.get()===0)return;settling.current=true;x.set(withTiming(0, { duration: reduced ? 0 : duration, easing: EASE_SCREEN }));};
  const enterFrom = (offset:number) => {if(reduced)return;settling.current=true;x.set(offset);x.set(withTiming(0,{duration,easing:EASE_SCREEN}));};
  const exitTo = (offset:number,onExited:()=>void) => {
    if(exiting.current)return;
    if(reduced){onExited();return;}
    exiting.current=true;
    settling.current=true;
    const current=++generation.current;
    const finish=()=>{if(current!==generation.current)return;exiting.current=false;onExited();};
    x.set(withTiming(offset,{duration:SWIPE_EXIT_MS,easing:EASE_SCREEN},finished=>{if(finished)runOnJS(finish)();}));
  };
  const cancel=()=>{generation.current++;exiting.current=false;settling.current=false;cancelAnimation(x);x.set(0);};
  useEffect(()=>{if(!active){generation.current++;exiting.current=false;settling.current=false;cancelAnimation(x);x.set(0);}},[active,x]);
  useEffect(()=>()=>{generation.current++;cancelAnimation(x);},[x]);
  return { x, style, move, settle, enterFrom, exitTo, cancel };
}
