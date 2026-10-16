import {useState} from 'react';
export const View='view',Pressable='pressable',ScrollView='scroll',Txt='text',Glyph='glyph',PanView='pan',Rect='rect';
export default 'svg';
export const StyleSheet={create:x=>x,absoluteFill:{}};
export const Easing={bezier:()=>()=>0};
export const cancelAnimation=()=>{};
export const useFrame=()=>({s:1,top:0});
export const useSharedValue=initial=>useState(()=>({value:initial,get(){return this.value},set(x){this.value=x}}))[0];
export const useAnimatedStyle=()=>({});
export const withTiming=x=>x;
export const audioOf=()=> 'file:///synthetic.m4a';
export const useWorkers=()=>new Map();
export const Enter='enter';

export const useTheme=()=>({c:{text:'#fff',body:'#ddd',surface06:'#222',surface08:'#222',ink14:'#333',goldText:'#ffe',bg:'#111'}});

export const suggestionActive = state => !!state && new Set(['queued','preparing','submitted','normalizing','waiting_descriptions']).has(state.state);
