import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/transcript-row-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {LineRow,CorrectionChoices}=await import('../src/screens/TranscriptCorrections.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const line={key:'synthetic',text:'Visit Tahluko.',t:1,words:[{text:'Visit',start_ms:1000,end_ms:1300},{text:'Tahluko',start_ms:1400,end_ms:2000}],
 flags:[{w:'Tahluko',alts:['Taluko'],reason:'Possible proper noun recognition error'}],audio:{attemptId:'synthetic',startMs:1000,endMs:2000}};
test('replacement taps do not play audio; choices, keep, restore, playback and accessible slide moves remain usable',async()=>{
 let tree;const calls=[];const props={line,cur:1,n:3,recording:false,playing:false,positionMs:null,playbackUri:null,accent:'#blue',altFi:0,
 onPlay:()=>calls.push('play'),onAlt:()=>calls.push('choices'),onApplyAlt:(_l,_fi,x)=>calls.push(x),onKeepFlag:()=>calls.push('keep'),onRestore:()=>calls.push('restore'),onMove:(_l,d)=>calls.push(d)};
 try{await act(async()=>{tree=create(React.createElement(React.Fragment,null,React.createElement(LineRow,props),React.createElement(CorrectionChoices,props)));});
  const row=tree.root.findByType('pan');assert.equal(row.props.onStartShould,undefined);
  assert.equal(row.props.onMoveShould({}, {dx:20,dy:2}),true);assert.equal(row.props.onMoveShould({}, {dx:2,dy:20}),false);
  const flag=tree.root.findAllByType('text').find(n=>n.props.accessibilityLabel?.startsWith('Possibly misheard'));
  let stopped=false;await act(async()=>flag.props.onPress({stopPropagation(){stopped=true}}));assert.equal(stopped,true);assert.deepEqual(calls,['choices']);
  const buttons=tree.root.findAllByType('pressable');
  for(const label of ['Show replacements for Tahluko','Replace “Tahluko” with “Taluko”','Keep “Tahluko” as heard','Play audio for this transcription suggestion']){
   const button=buttons.find(n=>n.props.accessibilityLabel===label);assert.ok(button,label);await act(async()=>button.props.onPress());
  }
  const sentence=tree.root.findAllByType('text').find(n=>n.props.accessibilityLabel?.startsWith('Play sentence:'));
  assert.deepEqual(sentence.props.accessibilityActions.map(x=>x.name),['activate','movePrev','moveNext']);
  await act(async()=>sentence.props.onAccessibilityAction({nativeEvent:{actionName:'movePrev'}}));
  assert.deepEqual(calls,['choices','choices','Taluko','keep','play',-1]);
  await act(async()=>tree.update(React.createElement(LineRow,{...props,line:{...line,fixed:true},playing:true,positionMs:1500,playbackUri:'file:///synthetic.m4a'})));
  assert.ok(tree.root.findAllByType('text').some(n=>n.props.children==='Tahluko'&&n.props.style));
  await act(async()=>tree.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel==='Restore original transcript sentence').props.onPress());assert.equal(calls.at(-1),'restore');
 }finally{if(tree)await act(async()=>tree.unmount());}
});

for (const inline of [false,true]) test(`Review correction panel preserves checks, sync conflicts and stale suggestions (${inline?'inline':'sheet'})`, async () => {
 const { TranscriptPanel } = await import('../src/screens/TranscriptCorrections.tsx');
 const calls = [];
 const controls = {
  state: { pending: false, conflict: null }, suggestions: null, busy: false, syncError: '', notice: '',
  generate: () => calls.push('generate'), synchronize: () => calls.push('sync'),
  keepServer: () => calls.push('server'), keepLocal: () => calls.push('mine'), retryContext: () => calls.push('context'),
 };
 const props = { inline, cur: 1, n: 3, lines: [{ ...line, slide: 1, visit: 0 }, { ...line, key: 'return', slide: 1, visit: 1, audio: { ...line.audio, startMs: 5000, endMs: 6000 } }],
  recording: false, claimed: false, stage: 'done', partId: 'synthetic', accent: '#blue', hasRun: true,
  canPlayback: true, slidePlaying: false, onPlaySlide: () => calls.push('play-slide'), positionMs: null, playbackUri: null,
  playbackError: null, playingKey: null, progress: 0, alt: null, fixNote: null,
  onPlay: () => calls.push('play-line'), onAlt: () => {}, onApplyAlt: () => {}, onKeepFlag: () => {}, onRestore: () => {}, onMove: () => {}, corrections: controls };
 let tree;
 const text = () => tree.root.findAllByType('text').map(node => typeof node.props.children === 'string' ? node.props.children : '').join(' ');
 const button = label => tree.root.findAllByType('pressable').find(node => node.props.accessibilityLabel === label);
 try {
  await act(async () => { tree = create(React.createElement(TranscriptPanel, props)); });
  assert.ok(text().includes(inline?'Transcript':'Slide 2 transcript'));
  if(!inline) await act(async () => button('Play slide 2 recording').props.onPress());
  await act(async () => button('Check transcription for AI correction suggestions').props.onPress());
  assert.deepEqual(calls, [...(inline?[]:['play-slide']), 'generate']);
  await act(async () => tree.update(React.createElement(TranscriptPanel, { ...props, corrections: { ...controls, state: { pending: true } } })));
  assert.match(text(), /Saved on phone · sync pending/);
  await act(async () => button('Synchronize transcript corrections').props.onPress());
  await act(async () => tree.update(React.createElement(TranscriptPanel, { ...props, corrections: { ...controls, state: { conflict: {} } } })));
  assert.match(text(), /Correction conflict/);
  await act(async () => button('Use server corrections').props.onPress());
  await act(async () => button('Keep my corrections and synchronize').props.onPress());
  assert.equal(button('Check transcription for AI correction suggestions').props.disabled, true);
  await act(async () => tree.update(React.createElement(TranscriptPanel, { ...props, corrections: { ...controls, suggestions: { stale: true, dependency: { retry_action: 'generate_descriptions' } } } })));
  assert.match(text(), /Transcription suggestions outdated/);
  await act(async () => button('Retry slide context for transcription suggestions').props.onPress());
  await act(async () => tree.update(React.createElement(TranscriptPanel, { ...props, playbackError: 'missing', canPlayback: false })));
  assert.match(text(), /Audio failed · tap Play to retry/);
  if(!inline) assert.equal(button('Play slide 2 recording').props.disabled, true);
  await act(async () => tree.update(React.createElement(TranscriptPanel, { ...props, alt: { key: line.key, fi: 0 } })));
  assert.equal(tree.root.findAllByType('pressable').filter(node => node.props.accessibilityLabel === 'Close transcription choices').length, 1,
    'choices remain inline with the selected sentence in the scrolling playback sheet');
  assert.ok(button('Replace “Tahluko” with “Taluko”'));
  assert.deepEqual(calls, [...(inline?[]:['play-slide']), 'generate', 'sync', 'server', 'mine', 'context']);
 } finally { if (tree) await act(async () => tree.unmount()); }
});

test('clipped boundary sentences keep playback without advertising unsupported slide moves',async()=>{
 let tree;
 const props={line:{...line,edge:1,canMove:false},cur:0,n:2,recording:false,playing:false,positionMs:null,playbackUri:null,accent:'#blue',altFi:-1,
 onPlay:()=>{},onAlt:()=>{},onApplyAlt:()=>{},onKeepFlag:()=>{},onRestore:()=>{},onMove:()=>{throw new Error('Unsupported move must not be submitted');}};
 try{
  await act(async()=>{tree=create(React.createElement(LineRow,props));});
  const row=tree.root.findByType('pan');
  assert.equal(row.props.onMoveShould({}, {dx:30,dy:0}),false,'clipped fragment cannot claim a horizontal move');
  const sentence=tree.root.findAllByType('text').find(node=>node.props.accessibilityLabel?.startsWith('Play sentence:'));
  assert.deepEqual(sentence.props.accessibilityActions.map(action=>action.name),['activate']);
  await act(async()=>sentence.props.onAccessibilityAction({nativeEvent:{actionName:'moveNext'}}));
  const text=tree.root.findAllByType('text').map(node=>typeof node.props.children==='string'?node.props.children:'').join(' ');
  assert.match(text,/Said as the slide changed/);
  assert.doesNotMatch(text,/swipe.*move/);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
