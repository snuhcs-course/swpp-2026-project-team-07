import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/cue-panel-loader.mjs';
registerHooks({resolve,load});
const React=await import('react');
const {act,create}=await import('react-test-renderer');
const {CueGuidancePanel}=await import('../src/features/presentations/CueGuidancePanel');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('cue tabs change category, reset scroll on slide navigation, and never leak previous slide',async()=>{
  const state={state:'completed',provenance:{prompt_version:'slide-profile-v4'},descriptions:{slides:[
    {slide_index:0,summary:{uncertain:false},must_cover:[{text:'Essential interpretation'}],go_deeper:[{text:'Optional question',information_needed:'Experiment needed'}]},
    {slide_index:1,summary:{uncertain:false},must_cover:[],go_deeper:[]}]}};
  let renderer;const props={state,slide:0,error:null,busy:false,onRecover:()=>assert.fail('Must not admit provider work')};
  try {
    await act(async()=>{renderer=create(React.createElement(CueGuidancePanel,props));});
    assert.match(JSON.stringify(renderer.toJSON()),/Essential interpretation/);
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/Optional question/);
    await act(async()=>{renderer.root.findAllByType('pressable')[1].props.onPress();});
    assert.match(JSON.stringify(renderer.toJSON()),/Optional question/);
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/Experiment needed/);
    await act(async()=>{renderer.root.findAllByType('pressable')[2].props.onPress();});
    assert.match(JSON.stringify(renderer.toJSON()),/Experiment needed/);
    assert.equal(renderer.root.findAllByType('pressable')[1].props.accessibilityState.selected,true);
    await act(async()=>{renderer.update(React.createElement(CueGuidancePanel,{...props,slide:1}));});
    assert.doesNotMatch(JSON.stringify(renderer.toJSON()),/Optional question/);
    assert.match(JSON.stringify(renderer.toJSON()),/No additional suggestions/);
  }finally{if(renderer)await act(async()=>renderer.unmount());}
});
test('cue recovery is explicit, respects busy state, and exposes confirmation separately',async()=>{
  const calls=[];let renderer;
  const props={state:{state:'needs_confirmation',requires_confirmation:true,retry_available:true,descriptions:null},slide:0,error:null,busy:false,onRecover:a=>calls.push(a)};
  try {
    await act(async()=>{renderer=create(React.createElement(CueGuidancePanel,props));});
    const status=()=>renderer.root.findAllByType('pressable').at(-1);
    await act(async()=>status().props.onPress());assert.deepEqual(calls,['confirm']);
    await act(async()=>renderer.update(React.createElement(CueGuidancePanel,{...props,busy:true})));
    assert.equal(status().props.disabled,true);
    await act(async()=>renderer.update(React.createElement(CueGuidancePanel,{...props,error:'Saved cues are retained offline'})));
    await act(async()=>status().props.onPress());assert.deepEqual(calls,['confirm','refresh']);
  }finally{if(renderer)await act(async()=>renderer.unmount());}
});
