import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve,load } from './helpers/take-evidence-loader.mjs';
registerHooks({resolve,load});
const React=await import('react'),{act,create}=await import('react-test-renderer');
const {TakePlayback}=await import('../src/screens/TakePlayback.tsx');
const {players,audioMode}=await import('./helpers/take-evidence-native.mjs');
const {emitPlaybackAppState}=await import('./helpers/transcript-corrections-controller-native.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const evidence={start_ms:1000,end_ms:2000,speech_quote:'Explain this concept.',observation:'Clarify the example.',slide_quote:'A slide concept'};
function setup(){
 players.length=0;audioMode.blocks.length=0;globalThis.takeReviewAudio=undefined;globalThis.correctionSources=[];globalThis.correctionCalls=[];globalThis.recordingToolCalls=[];
 globalThis.correctionState={state:{pending:false},suggestions:null,busy:false,syncError:'',notice:'',ask:false};
 const transcript={text:'Explain this concept.',words:[{text:'Explain',start_ms:1000,end_ms:1200},{text:'this',start_ms:1300,end_ms:1500},{text:'concept.',start_ms:1600,end_ms:2000}]};
 const line={key:'B#0',slide:1,text:transcript.text,t:1,rel:1,flags:[],edge:0,moved:false,from:null,fixed:false,words:transcript.words,source:{first:0,last:2,text:transcript.text},visit:{slide:1,index:0,startMs:0},audio:{attemptId:'B',startMs:1000,endMs:2000}};
 globalThis.correctionModel={deck:{id:'deck',title:'Synthetic',hue:'blue',pageCount:2},n:2,lines:[line],state:{run:{parts:[null,{attemptId:'B',segments:[{startMs:0,endMs:3000}]}]}},transcripts:new Map([['B',transcript]]),stages:new Map([['B','done']])};
 globalThis.correctionReview={duration_ms:10000,transcript,visits:[{slide_index:1,start_ms:0,end_ms:10000,words:[]}],slide_events:[{slide_index:1,at_ms:0}],deck_id:'server-deck'};
 return {id:'B',deck:globalThis.correctionModel.deck,initialSlide:1,onClose:()=>{},initialEvidence:evidence};
}
const button=(tree,label)=>tree.root.findAllByType('pressable').find(node=>node.props.accessibilityLabel===label);
const text=tree=>tree.root.findAllByType('text').map(node=>typeof node.props.children==='string'?node.props.children:'').join(' ');
const click=async(tree,label)=>{const hit=button(tree,label);assert.ok(hit,label);await act(async()=>hit.props.onPress());};
test('evidence displays its finding and original interval, plays only that validated source range, and pauses/resumes without seeking again',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const props=setup();
 globalThis.takeReviewAudio={audio:{uri:'file:///validated-original-B.m4a',busy:false},audioSpec:null,audioFailed:()=>{}};let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,props));});
  assert.match(text(tree),/Clarify the example/);assert.match(text(tree),/Explain this concept/);assert.match(text(tree),/0:01.*0:02/);
  assert.ok(players.every(player=>!player.playing),'opening evidence is read-only');
  await click(tree,'Play feedback evidence');
  const native=players.find(player=>player.replacements.includes('file:///validated-original-B.m4a'));
  assert.ok(native,'bounded player uses validated Review media');assert.deepEqual(native.seeks,[1]);
  native.currentTime=1.5;await act(async()=>t.mock.timers.tick(50));
  await click(tree,'Pause feedback evidence');assert.equal(native.playing,false);
  await click(tree,'Resume feedback evidence');assert.equal(native.playing,true);assert.deepEqual(native.seeks,[1]);
  native.currentTime=2;await act(async()=>t.mock.timers.tick(50));assert.equal(native.playing,false);
  assert.ok(button(tree,'Play feedback evidence'));
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('evidence, sentence corrections and original word playback stop each other',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const props=setup();let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,props));});
  await click(tree,'Play feedback evidence');const evidenceNative=players.find(player=>player.replacements.length);
  const sentence=tree.root.findAllByType('text').find(node=>node.props.accessibilityLabel==='Play sentence: Explain this concept.');
  await act(async()=>sentence.props.onPress());assert.equal(evidenceNative.playing,false);
  const sentenceNative=players.find(player=>player!==evidenceNative&&player.replacements.length);assert.ok(sentenceNative?.playing);
  await click(tree,'Play feedback evidence');assert.equal(sentenceNative.playing,false);
  await click(tree,'Show original transcript and word playback');
  const word=tree.root.findAllByType('text').find(node=>node.props.children==='this'&&node.props.onPress);
  await act(async()=>word.props.onPress());assert.equal(evidenceNative.playing,false);
  const originalNative=players.find(player=>player.seeks.includes(1.3));assert.ok(originalNative?.playing);
  await click(tree,'Play feedback evidence');assert.equal(originalNative.playing,false);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('unavailable validated audio or invalid evidence ranges stay explicit and retain download tools',async()=>{
 for(const interval of [{start_ms:-1,end_ms:2000},{start_ms:2000,end_ms:2000},{start_ms:1000,end_ms:10001}]){
  const props=setup();let tree;
  try{await act(async()=>{tree=create(React.createElement(TakePlayback,{...props,initialEvidence:interval}));});
   assert.equal(button(tree,'Play feedback evidence').props.disabled,true);assert.match(text(tree),/Evidence interval is unavailable/);
   assert.ok(players.every(player=>!player.playing));
  }finally{if(tree)await act(async()=>tree.unmount());}
 }
 const props=setup();globalThis.takeReviewAudio={audio:{uri:null,busy:false,error:'Original recording is retained.'},audioSpec:{},download:()=>{},audioFailed:()=>{}};let tree;
 try{await act(async()=>{tree=create(React.createElement(TakePlayback,props));});
  assert.equal(button(tree,'Play feedback evidence').props.disabled,true);assert.ok(button(tree,'Download audio for offline playback'));
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('recording-wide suggestions and slide descriptions stay collapsed under Recording tools',async()=>{
 const props=setup();let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,props));});
  assert.equal(button(tree,'Generate AI suggestions for this take'),undefined);assert.equal(button(tree,'Show slide descriptions'),undefined);
  assert.deepEqual(globalThis.recordingToolCalls,[]);
  await click(tree,'Show recording tools');assert.match(text(tree),/Recording-wide suggestions/);
  assert.ok(button(tree,'Generate AI suggestions for this take'));assert.ok(button(tree,'Show slide descriptions'));
  assert.ok(globalThis.recordingToolCalls.some(call=>call[0]==='retain'));
  assert.ok(!globalThis.recordingToolCalls.some(call=>call[0]==='generate'));
  await click(tree,'Hide recording tools');assert.equal(button(tree,'Generate AI suggestions for this take'),undefined);
 }finally{if(tree)await act(async()=>tree.unmount());}
});

test('changing evidence or losing its validated media stops the old interval without autoplay',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const props=setup();let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,props));});
  await click(tree,'Play feedback evidence');const native=players.find(player=>player.replacements.length);assert.ok(native.playing);
  await act(async()=>tree.update(React.createElement(TakePlayback,{...props,initialEvidence:{...evidence,start_ms:3000,end_ms:4000}})));
  assert.equal(native.playing,false);assert.deepEqual(native.seeks,[1]);
  await click(tree,'Play feedback evidence');assert.deepEqual(native.seeks,[1,3]);
  globalThis.takeReviewAudio={audio:{uri:null,busy:false,error:'Validated audio unavailable'},audioSpec:{},download:()=>{},audioFailed:()=>{}};
  await act(async()=>tree.update(React.createElement(TakePlayback,{...props,initialEvidence:{...evidence,start_ms:3000,end_ms:4000}})));
  assert.equal(native.playing,false);assert.equal(button(tree,'Play feedback evidence').props.disabled,true);
 }finally{if(tree)await act(async()=>tree.unmount());}
});

test('evidence source interval preserves subsecond timestamps in its contextual label',async()=>{
 const props=setup();let tree;
 try{await act(async()=>{tree=create(React.createElement(TakePlayback,{...props,initialEvidence:{...evidence,start_ms:1001,end_ms:1999}}));});
  assert.match(text(tree),/0:01\.001–0:01\.999/);
 }finally{if(tree)await act(async()=>tree.unmount());}
});

function deferredMode(){let release;const promise=new Promise(resolve=>{release=resolve;});audioMode.blocks.push(promise);return release;}
const originalWord=(tree,value)=>tree.root.findAllByType('text').find(node=>node.props.children===value&&node.props.onPress);
for(const newer of ['evidence','correction'])test(`pending original-word audio setup cannot restart after newer ${newer} playback`,async t=>{
 t.mock.timers.enable({apis:['setInterval']});const props=setup();let tree,release;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,props));});
  await click(tree,'Show original transcript and word playback');release=deferredMode();
  await act(async()=>originalWord(tree,'this').props.onPress());
  if(newer==='evidence')await click(tree,'Play feedback evidence');
  else await act(async()=>tree.root.findAllByType('text').find(node=>node.props.accessibilityLabel==='Play sentence: Explain this concept.').props.onPress());
  assert.equal(players.filter(player=>player.playing).length,1);
  await act(async()=>release());
  assert.equal(players.filter(player=>player.playing).length,1,'superseded native word intent must not add simultaneous audio');
  assert.deepEqual(players.at(-1).seeks,[],'superseded native word intent must not seek');
 }finally{if(release)release();if(tree)await act(async()=>tree.unmount());}
});
test('only the latest original-word audio-mode intent may seek when promises resolve out of order',async()=>{
 const props=setup();let tree,first,second;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,props));});await click(tree,'Show original transcript and word playback');
  first=deferredMode();await act(async()=>originalWord(tree,'Explain').props.onPress());
  second=deferredMode();await act(async()=>originalWord(tree,'this').props.onPress());
  await act(async()=>second());await act(async()=>first());
  assert.deepEqual(players.at(-1).seeks,[1.3]);
 }finally{first?.();second?.();if(tree)await act(async()=>tree.unmount());}
});
for(const boundary of ['close','source','background'])test(`pending word setup cannot resume after ${boundary}`,async()=>{
 const props=setup();let tree,release,closed=0;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,{...props,onClose:()=>closed++}));});await click(tree,'Show original transcript and word playback');
  release=deferredMode();await act(async()=>originalWord(tree,'this').props.onPress());
  if(boundary==='close'){await click(tree,'Close recording details');assert.equal(closed,1);}
  else if(boundary==='source'){
   globalThis.takeReviewAudio={audio:{uri:'file:///different-original.m4a',busy:false},audioSpec:null,audioFailed:()=>{}};
   await act(async()=>tree.update(React.createElement(TakePlayback,{...props,id:'C'})));
  }else await act(async()=>{emitPlaybackAppState('background');emitPlaybackAppState('active');});
  await act(async()=>release());
  assert.ok(players.every(player=>!player.playing),'pending intent stays cancelled across lifecycle boundaries');
  assert.deepEqual(players.at(-1).seeks,[]);
 }finally{release?.();if(tree)await act(async()=>tree.unmount());}
});

test('scrolling recording details stays inside a clipped viewport below the fixed sheet header',async()=>{
 const props=setup();let tree;
 try{await act(async()=>{tree=create(React.createElement(TakePlayback,props));});
  const body=tree.root.findAllByType('scroll').find(node=>node.props.contentContainerStyle?.paddingHorizontal===24);
  assert.ok(body);
  assert.equal(body.props.style?.top,88,'the header gap belongs to the viewport so it cannot scroll away');
  assert.equal(body.props.style?.bottom,0);
  assert.equal(body.props.style?.overflow,'hidden','offscreen evidence controls cannot draw over the header');
  assert.equal(body.props.contentContainerStyle.paddingTop,0,'initial content position is preserved by viewport placement');
 }finally{if(tree)await act(async()=>tree.unmount());}
});
