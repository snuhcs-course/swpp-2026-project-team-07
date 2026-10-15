import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/transcript-row-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {LineRow,CorrectionChoices}=await import('../src/screens/RehearseScreen.tsx');
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
