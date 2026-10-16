import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/transcript-corrections-controller-loader.mjs';
registerHooks({resolve,load});
const React=await import('react');
const {act,create}=await import('react-test-renderer');
const {TranscriptCorrections}=await import('../src/screens/TranscriptCorrections.tsx');
const {TakePlayback}=await import('../src/screens/TakePlayback.tsx');
const {HUES}=await import('../src/design/tokens.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const makeLine=(id,slide,text)=>({key:`${id}#0`,slide,text,t:0,rel:0,flags:[],edge:0,moved:id==='A',from:id==='A'?0:null,fixed:false,
 words:[{text,start_ms:1000,end_ms:2000}],source:{first:0,last:0,text},visit:{slide:0,index:0,startMs:0},audio:{attemptId:id,startMs:1000,endMs:2000}});
function fixture(){
 globalThis.correctionSources=[];globalThis.correctionCalls=[];
 globalThis.correctionState={state:{pending:false},suggestions:null,busy:false,syncError:'',notice:'',ask:false};
 const a={text:'Source A sentence.',words:[{text:'Source A sentence.',start_ms:1000,end_ms:2000}]};
 const b={text:'Selected B sentence.',words:[{text:'Selected B sentence.',start_ms:1000,end_ms:2000}]};
 const lines=[makeLine('A',1,a.text),makeLine('B',1,b.text)];
 globalThis.correctionModel={deck:{id:'deck',title:'Synthetic',hue:'blue',pageCount:2},n:2,lines,state:{run:{parts:[{attemptId:'A',segments:[{startMs:0,endMs:3000}]},{attemptId:'B',segments:[{startMs:0,endMs:3000}]}]}},transcripts:new Map([['A',a],['B',b]]),stages:new Map([['A','done'],['B','done']])};
 globalThis.correctionPlayer={playingKey:null,positionMs:null,uri:null,paused:false,progress:0,error:null,stop:()=>{},
  play:async(key,segment)=>globalThis.correctionCalls.push(['audio',key,segment]),
  playSegments:async(key,segments)=>globalThis.correctionCalls.push(['segments',key,segments])};
 globalThis.correctionReview={duration_ms:10000,transcript:b,visits:[{slide_index:1,start_ms:0,end_ms:10000,words:[]}],slide_events:[{slide_index:1,at_ms:0}]};
 return {a,b,lines,props:{id:'B',slide:1,model:globalThis.correctionModel,player:globalThis.correctionPlayer,onBeforePlay:()=>{}}};
}
const button=(tree,label)=>tree.root.findAllByType('pressable').find(node=>node.props.accessibilityLabel===label);
const allText=tree=>tree.root.findAllByType('text').map(node=>typeof node.props.children==='string'?node.props.children:'').join(' ');
test('moved sentence remains visible with source A audio, correction and synchronization when target slide selects B',async()=>{
 const {a,lines,props}=fixture();
 lines[0].flags=[{w:a.text,alts:['Source A corrected.'],range:{first:0,last:0}}];
 let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TranscriptCorrections,props));});
  const source=tree.root.findAllByType('text').find(node=>node.props.accessibilityLabel===`Play sentence: ${a.text}`);
  assert.ok(source,'moved A sentence is visible in the target B sheet');
  await act(async()=>source.props.onPress());
  assert.deepEqual(globalThis.correctionCalls.at(-1),['audio','A#0',{uri:'file:///A.m4a',startMs:1000,endMs:2000}]);
  await act(async()=>button(tree,`Show replacements for ${a.text}`).props.onPress());
  await act(async()=>button(tree,`Replace “${a.text}” with “Source A corrected.”`).props.onPress());
  assert.ok(globalThis.correctionCalls.some(call=>call[0]==='accept'&&call[1]==='A'&&call[5]===a));
  assert.ok(globalThis.correctionCalls.some(call=>call[0]==='persist'&&call[1]==='A'));
  assert.ok(globalThis.correctionSources.includes('A'),'source A owns its own correction state');
  assert.ok(globalThis.correctionSources.includes('B'),'selected B retains its correction state');
  const sourceGroup=tree.root.find(node=>typeof node.type==='function' && node.type.name==='SourceTranscriptCorrections' && node.props.id==='A');
  await act(async()=>sourceGroup.findAllByType('pressable').find(node=>node.props.accessibilityLabel==='Check transcription for AI correction suggestions').props.onPress());
  assert.deepEqual(globalThis.correctionCalls.at(-1),['check','A']);
  lines[0].fixed=true;
  await act(async()=>tree.update(React.createElement(TranscriptCorrections,{...props})));
  await act(async()=>button(tree,'Restore original transcript sentence').props.onPress());
  assert.ok(globalThis.correctionCalls.some(call=>call[0]==='restore'&&call[1]==='A'&&call[4]===a));
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('selected saved text without word timing retains the existing unsplit transcript action',async()=>{
 const {props}=fixture();
 globalThis.correctionModel.lines=[];
 const transcript={text:'Untimed original text is still readable.',words:[]};
 globalThis.correctionModel.transcripts.set('B',transcript);
 globalThis.correctionReview.transcript=transcript;
 let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,{id:'B',deck:props.model.deck,initialSlide:1,onClose:()=>{}}));});
  const open=button(tree,'Show unsplit transcript');
  assert.ok(open,'the validated untimed text fallback is accessible from the selected take');
  await act(async()=>open.props.onPress());
  assert.match(allText(tree),/Untimed original text is still readable/);
 }finally{if(tree)await act(async()=>tree.unmount());}
});

test('selected timed words that do not match saved text retain the original unsplit text',async()=>{
 const {props}=fixture();
 const transcript={text:'Original unmatched words remain readable.',words:[{text:'Different',start_ms:1000,end_ms:2000}]};
 globalThis.correctionModel.transcripts.set('B',transcript);
 globalThis.correctionReview.transcript=transcript;
 let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,{id:'B',deck:props.model.deck,initialSlide:1,onClose:()=>{}}));});
  const open=button(tree,'Show unsplit transcript');
  assert.ok(open,'mismatched text is preserved alongside timestamped correction lines');
  await act(async()=>open.props.onPress());
  assert.match(allText(tree),/Original unmatched words remain readable/);
 }finally{if(tree)await act(async()=>tree.unmount());}
});

test('removing another source does not stop current playback; closing the shared panel does',async()=>{
 const {props}=fixture();
 let stops=0;props.player.stop=()=>stops++;
 let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TranscriptCorrections,props));});
  props.model.lines=props.model.lines.filter(line=>line.audio.attemptId==='B');
  await act(async()=>tree.update(React.createElement(TranscriptCorrections,{...props})));
  assert.equal(stops,0,'source-specific correction state cleanup must not stop the shared player');
 }finally{if(tree)await act(async()=>tree.unmount());}
 assert.equal(stops,1,'the shared panel releases playback once when closed');
});

test('Pause header pauses same-source evidence without restarting selected slide playback',async()=>{
 const {props}=fixture();
 props.nativePlayback={playing:true,uri:'file:///B.m4a',positionMs:1500};
 props.onBeforePlay=()=>globalThis.correctionCalls.push(['pause-native']);
 let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TranscriptCorrections,props));});
  const pause=button(tree,'Pause slide 2 recording');
  assert.ok(pause);
  await act(async()=>pause.props.onPress());
  assert.deepEqual(globalThis.correctionCalls,[['pause-native']]);
 }finally{if(tree)await act(async()=>tree.unmount());}
});

test('selected corrected transcript keeps exact-word playback reachable through the original transcript control',async()=>{
 const {props}=fixture();
 const transcript={text:'Selected B sentence.',words:[{text:'Selected',start_ms:1000,end_ms:1200},{text:'B',start_ms:1300,end_ms:1500},{text:'sentence.',start_ms:1600,end_ms:2000}]};
 globalThis.correctionReview.transcript=transcript;
 globalThis.correctionModel.transcripts.set('B',transcript);
 let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TakePlayback,{id:'B',deck:props.model.deck,initialSlide:1,onClose:()=>{}}));});
  const open=button(tree,'Show original transcript and word playback');
  assert.ok(open,'exact-word seeking remains reachable beside corrected transcript controls');
  await act(async()=>open.props.onPress());
  const word=tree.root.findAllByType('text').find(node=>node.props.children==='B'&&node.props.onPress);
  assert.ok(word);
  await act(async()=>word.props.onPress());
  assert.ok(globalThis.correctionCalls.some(call=>call[0]==='seek'&&call[1]===1.3));
 }finally{if(tree)await act(async()=>tree.unmount());}
});

const highlightedWords=tree=>tree.root.findAllByType('text').filter(node=>node.props.style?.backgroundColor===HUES.blue.accent).map(node=>node.props.children);
function inlineFixture(){
 const result=fixture();
 const first={...makeLine('B',1,'First visit.'),words:[{text:'First',start_ms:1000,end_ms:1200},{text:'visit.',start_ms:1300,end_ms:1600}],visit:{slide:1,index:0,startMs:0}};
 const returned={...makeLine('B',1,'Return visit.'),key:'B#2',words:[{text:'Return',start_ms:5000,end_ms:5200},{text:'visit.',start_ms:5300,end_ms:5600}],visit:{slide:1,index:1,startMs:4000},audio:{attemptId:'B',startMs:5000,endMs:6000}};
 result.props.model.lines=[result.lines[0],first,returned];
 result.props.inline=true;result.props.audioUri=id=>`file:///validated-${id}.m4a`;
 return {...result,first,returned};
}
test('inline transcript flows without its own scroll or duplicate slide Play while preserving moved-source sentence controls',async()=>{
 const {props,a}=inlineFixture();let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TranscriptCorrections,props));});
  assert.equal(tree.root.findAllByType('scroll').length,0,'the Review page owns vertical scrolling');
  assert.match(allText(tree),/Transcript/);assert.match(allText(tree),/Return visit 1/);
  assert.equal(tree.root.findAllByType('pressable').filter(node=>/^(Play|Pause).*slide.*(recording|transcript audio)$/.test(node.props.accessibilityLabel??'')).length,0);
  assert.ok(button(tree,'Check transcription for AI correction suggestions'));
  assert.deepEqual(globalThis.correctionCalls,[],'mounting inline transcript does not generate or play');
  const sentence=tree.root.findAllByType('text').find(node=>node.props.accessibilityLabel===`Play sentence: ${a.text}`);
  await act(async()=>sentence.props.onPress());
  assert.deepEqual(globalThis.correctionCalls,[['audio','A#0',{uri:'file:///validated-A.m4a',startMs:1000,endMs:2000}]]);
  props.audioUri=()=>null;
  await act(async()=>tree.update(React.createElement(TranscriptCorrections,{...props})));
  await act(async()=>tree.root.findAllByType('text').find(node=>node.props.accessibilityLabel===`Play sentence: ${a.text}`).props.onPress());
  assert.equal(globalThis.correctionCalls.length,1,'a missing resolved source never falls back to another file');
  assert.match(allText(tree),/Audio for this take isn’t on this phone/);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('inline native source time highlights evidence and return visits with half-open word bounds and existing pause behavior',async()=>{
 const {props}=inlineFixture();let tree;
 Object.assign(props.player,{playingKey:'evidence:B:1000:6000',uri:'file:///validated-B.m4a',positionMs:1000});
 const observe=async(positionMs,uri=props.player.uri,extra={})=>{Object.assign(props.player,{positionMs,uri,...extra});await act(async()=>tree.update(React.createElement(TranscriptCorrections,{...props})));return highlightedWords(tree);};
 try{
  await act(async()=>{tree=create(React.createElement(TranscriptCorrections,props));});
  assert.deepEqual(highlightedWords(tree),['First']);
  assert.deepEqual(await observe(1200),[],'exact word end is excluded');
  assert.deepEqual(await observe(1250),[],'silent gaps do not highlight');
  assert.deepEqual(await observe(1300),['visit.']);
  assert.deepEqual(await observe(2000),[],'exact sentence end is excluded');
  assert.deepEqual(await observe(5100),['Return'],'return visits use source time rather than concatenated elapsed time');
  assert.deepEqual(await observe(5100,'file:///wrong-source.m4a'),[]);
  assert.deepEqual(await observe(5100,'file:///validated-B.m4a',{paused:true}),[],'paused whole-slide/evidence playback clears the active word');
  assert.deepEqual(await observe(5100,'file:///validated-B.m4a',{playingKey:'B#2'}),['Return'],'sentence pause retains the existing selected-sentence highlight');
  assert.deepEqual(await observe(null,'file:///validated-B.m4a',{playingKey:null,paused:false}),[]);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
test('inline untimed source text remains readable without invented slide timing or playback',async()=>{
 const {props}=fixture();props.inline=true;props.model.lines=[];
 const transcript={text:'Untimed original text stays readable inline.',words:[]};props.model.transcripts.set('B',transcript);
 const original=JSON.stringify(transcript);let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TranscriptCorrections,props));});
  assert.match(allText(tree),/Untimed original text stays readable inline/);
  const originalText=tree.root.findAllByType('text').find(node=>node.props.children===transcript.text);
  assert.equal(Object.assign({},...originalText.props.style).color,'#ddd','untimed text uses the current theme body color');
  assert.match(allText(tree),/timing|alignment|timestamps/i);
  assert.equal(tree.root.findAllByType('scroll').length,0);
  assert.equal(tree.root.findAllByType('text').filter(node=>node.props.accessibilityLabel?.startsWith('Play sentence')).length,0);
  assert.deepEqual(globalThis.correctionCalls,[]);assert.equal(JSON.stringify(transcript),original);
 }finally{if(tree)await act(async()=>tree.unmount());}
});

for(const [stage,message] of [['processing',/Transcribing/],['no_speech',/No speech was detected/],['missing',/isn’t on this phone/]])test(`inline missing transcript preserves ${stage} state without inventing words`,async()=>{
 const {props}=fixture();props.inline=true;props.model.lines=[];props.model.transcripts.delete('B');props.model.stages.set('B',stage);globalThis.correctionState.state=null;let tree;
 try{
  await act(async()=>{tree=create(React.createElement(TranscriptCorrections,props));});
  assert.match(allText(tree),message);assert.equal(tree.root.findAllByType('scroll').length,0);
  assert.equal(tree.root.findAllByType('text').filter(node=>node.props.accessibilityLabel?.startsWith('Play sentence')).length,0);
  assert.deepEqual(globalThis.correctionCalls,[]);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
