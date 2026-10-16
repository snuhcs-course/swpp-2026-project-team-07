import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve,load } from './helpers/take-evidence-loader.mjs';
registerHooks({resolve,load});
const React=await import('react'),{act,create}=await import('react-test-renderer');
const {ReviewRecordingTools}=await import('../src/screens/ReviewRecordingTools.tsx');
const {useSegmentPlayer}=await import('../src/features/rehearsal/useSegmentPlayer.ts');
const {players}=await import('./helpers/take-evidence-native.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const evidence={start_ms:1001,end_ms:1999,speech_quote:'Explain this concept.',observation:'Clarify the example.',slide_quote:'A slide concept'};
function setup(){
 players.length=0;globalThis.correctionSources=[];globalThis.correctionCalls=[];globalThis.recordingToolCalls=[];
 const transcript={text:'Explain this concept.',words:[{text:'Explain',start_ms:1000,end_ms:1200},{text:'this',start_ms:1300,end_ms:1500},{text:'concept.',start_ms:1600,end_ms:2000}]};
 const model={deck:{id:'deck',title:'Synthetic',hue:'blue',pageCount:2},n:2,lines:[],state:{run:{parts:[null,{attemptId:'B',segments:[{startMs:1000,endMs:3000},{startMs:6000,endMs:8000}]}]}},transcripts:new Map([['B',transcript]]),stages:new Map([['B','done']])};
 globalThis.correctionReview={duration_ms:10000,transcript,visits:[{slide_index:1,start_ms:0,end_ms:10000,words:[]}],slide_events:[{slide_index:1,at_ms:0}],deck_id:'server-deck'};
 return {model,id:'B',slide:1,media:{audio:{uri:'file:///validated-B.m4a',busy:false,error:''},audioSpec:null,download:()=>{},audioFailed:()=>{}},evidence,onCloseEvidence:()=>{}};
}
function Host(props){const player=useSegmentPlayer();return React.createElement(ReviewRecordingTools,{...props,player});}
const button=(tree,label)=>tree.root.findAllByType('pressable').find(node=>node.props.accessibilityLabel===label);
const text=tree=>tree.root.findAllByType('text').map(node=>typeof node.props.children==='string'?node.props.children:'').join(' ');
const click=async(tree,label)=>{const hit=button(tree,label);assert.ok(hit,label);await act(async()=>hit.props.onPress());};
test('inline evidence uses the single host player, contextual source range and bounded pause/resume',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const props=setup();let tree,closed=0;
 try{await act(async()=>{tree=create(React.createElement(Host,{...props,onCloseEvidence:()=>closed++}));});
  assert.match(text(tree),/Clarify the example/);assert.match(text(tree),/0:01\.001–0:01\.999/);
  assert.ok(tree.root.findAllByType('view').every(node=>!node.props.accessibilityViewIsModal));
  assert.equal(button(tree,'Close recording details'),undefined);assert.equal(players.length,1);
  await click(tree,'Play evidence');const native=players[0];assert.deepEqual(native.replacements,['file:///validated-B.m4a']);assert.deepEqual(native.seeks,[1.001]);
  native.currentTime=1.5;await act(async()=>t.mock.timers.tick(50));await click(tree,'Pause evidence');assert.equal(native.playing,false);
  await click(tree,'Resume evidence');assert.equal(native.playing,true);assert.deepEqual(native.seeks,[1.001]);
  native.currentTime=1.999;await act(async()=>t.mock.timers.tick(50));assert.equal(native.playing,false);
  await click(tree,'Close evidence');assert.equal(closed,1);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('original word playback remains explicit and uses remaining selected visits on the host player',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const props=setup();let tree;
 try{await act(async()=>{tree=create(React.createElement(Host,props));});
  assert.equal(button(tree,'Generate AI suggestions for this take'),undefined);assert.deepEqual(globalThis.recordingToolCalls,[]);
  await click(tree,'Show recording tools');assert.ok(button(tree,'Generate AI suggestions for this take'));assert.ok(button(tree,'Show slide descriptions'));
  assert.ok(!globalThis.recordingToolCalls.some(call=>call[0]==='generate'));
  await click(tree,'Show original transcript and word playback');
  const word=tree.root.findAllByType('text').find(node=>node.props.children==='this'&&node.props.onPress);assert.ok(word);
  await act(async()=>word.props.onPress());assert.deepEqual(players[0].seeks,[1.3]);assert.equal(players.length,1);
  players[0].currentTime=3;await act(async()=>t.mock.timers.tick(50));assert.deepEqual(players[0].seeks,[1.3,6]);
  players[0].currentTime=8;await act(async()=>t.mock.timers.tick(50));assert.equal(players[0].playing,false);
  await click(tree,'Show PDF offline tools');assert.match(text(tree),/Presentation PDF/);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('untimed source text stays readable inline and unavailable audio retains download and errors',async()=>{
 const props=setup();const transcript={text:'Untimed source remains readable.',words:[]};props.model.transcripts.set('B',transcript);globalThis.correctionReview={...globalThis.correctionReview,transcript};
 let tree,downloads=0;props.media={audio:{uri:null,busy:false,error:'Original file is retained.'},audioSpec:{},download:()=>downloads++,audioFailed:()=>{}};
 try{await act(async()=>{tree=create(React.createElement(Host,props));});
  assert.equal(button(tree,'Play evidence').props.disabled,true);assert.match(text(tree),/Original file is retained/);
  await click(tree,'Download audio for offline playback');assert.equal(downloads,1);
  assert.equal(button(tree,'Show unsplit transcript'),undefined,'host owns the primary untimed text; tools do not duplicate it');
  await click(tree,'Show recording tools');await click(tree,'Show original transcript and word playback');
  assert.ok(button(tree,'Show unsplit transcript'));
  await click(tree,'Show unsplit transcript');assert.match(text(tree),/Untimed source remains readable/);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('invalid evidence is explicit and cannot start playback',async()=>{
 const props=setup();let tree;
 try{await act(async()=>{tree=create(React.createElement(Host,{...props,evidence:{...evidence,end_ms:10001}}));});
  assert.equal(button(tree,'Play evidence').props.disabled,true);assert.match(text(tree),/Evidence interval is unavailable/);assert.equal(players[0].playing,false);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
