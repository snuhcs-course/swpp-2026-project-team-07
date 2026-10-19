import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/qa-screen-runtime-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {Enter,Txt}=await import('../src/design/frame.tsx');
const {flattenStyle,runtime}=await import('./helpers/qa-screen-runtime-native.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('a completed entrance keeps opaque React props when its content changes',async()=>{
 let r;
 try{
  await act(async()=>{r=create(React.createElement(Enter,{kind:'fade'},React.createElement(Txt,null,'Question 1 of 3')));});
  // Native animation reached 1. React must not retain the initial opacity 0,
  // which Fabric can reapply when a later question changes the child tree.
  assert.equal(flattenStyle(r.root.findByType('animated').props.style).opacity,1);
  assert.equal(flattenStyle(r.root.findByType('animated').props.style,true).opacity,1);
  await act(async()=>r.update(React.createElement(Enter,{kind:'fade'},React.createElement(Txt,null,'Question 2 of 3'))));
  assert.equal(flattenStyle(r.root.findByType('animated').props.style,true).opacity,1);
  assert.match(JSON.stringify(r.toJSON()),/Question 2 of 3/);
 }finally{if(r)await act(async()=>r.unmount());}
});

const content=label=>React.createElement(Txt,null,label);
const propsOpacity=r=>flattenStyle(r.root.findByType('animated').props.style,true).opacity;
test('a queued completion from a prior entrance cannot settle a changed entrance',async()=>{
 runtime.deferTimings=true;runtime.deferJs=true;let r;
 try{
  await act(async()=>{r=create(React.createElement(Enter,{kind:'fade'},content('First')));});
  assert.equal(runtime.timings.size,1);
  await act(async()=>runtime.finishTimings());
  assert.equal(runtime.js.length,1);
  await act(async()=>r.update(React.createElement(Enter,{kind:'zoom'},content('Changed'))));
  await act(async()=>runtime.flushJs());
  assert.equal(propsOpacity(r),0,'a prior completion must not remove the current fade');
  assert.equal(runtime.timings.size,1);
  await act(async()=>{runtime.finishTimings();runtime.flushJs();});
  assert.equal(propsOpacity(r),1);
 }finally{if(r)await act(async()=>r.unmount());runtime.deferTimings=false;runtime.deferJs=false;runtime.js=[];runtime.timings.clear();}
});
test('reduced motion settles the entrance and keeps it opaque after motion is restored',async()=>{
 runtime.deferTimings=true;let r;
 try{
  await act(async()=>{r=create(React.createElement(Enter,{kind:'fade'},content('First')));});
  runtime.reducedMotion=true;
  await act(async()=>r.update(React.createElement(Enter,{kind:'fade'},content('Reduced'))));
  assert.equal(propsOpacity(r),1,'reduced motion shows the page immediately');
  await act(async()=>runtime.finishTimings());
  runtime.reducedMotion=false;
  await act(async()=>r.update(React.createElement(Enter,{kind:'fade'},content('Restored'))));
  assert.equal(propsOpacity(r),1,'restoring motion must not reapply the initial alpha');
 }finally{if(r)await act(async()=>r.unmount());runtime.reducedMotion=false;runtime.deferTimings=false;runtime.timings.clear();}
});
test('unmount cancels the pending entrance without leaving a live completion',async()=>{
 runtime.deferTimings=true;let r;
 try{
  await act(async()=>{r=create(React.createElement(Enter,{kind:'fade'},content('First')));});
  assert.equal(runtime.timings.size,1);
  await act(async()=>r.unmount());r=null;
  assert.equal(runtime.timings.size,0);
 }finally{if(r)await act(async()=>r.unmount());runtime.deferTimings=false;runtime.timings.clear();}
});
