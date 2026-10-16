import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve as base,load} from './helpers/slide-review-panel-loader.mjs';
registerHooks({load,resolve(specifier,context,next){if(specifier.endsWith('/design/ScoreRing'))return {url:'data:text/javascript,export const ScoreRing="status-ring";',shortCircuit:true};return base(specifier,context,next);}});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const ring=await import('../src/features/feedback/FeedbackStatusRing.tsx').catch(()=>({}));globalThis.IS_REACT_ACT_ENVIRONMENT=true;
test('selected-slide ring shows verified finding count or analysis status without a quality percentage',async()=>{
 assert.equal(typeof ring.FeedbackStatusRing,'function','selected status ring must exist');let tree;
 const item={slide:0,status:'reviewed',label:'2 findings',findingCount:2,assessed:true,hasFindings:true,tone:'warn'};
 try{await act(async()=>{tree=create(React.createElement(ring.FeedbackStatusRing,{id:'synthetic',item}));});
  assert.equal(tree.root.findByType('status-ring').props.value,'2');assert.doesNotMatch(tree.root.findByType('status-ring').props.label,/%/);
  await act(async()=>tree.update(React.createElement(ring.FeedbackStatusRing,{id:'synthetic',item:{...item,status:'outdated',label:'Feedback outdated',findingCount:0,assessed:false}})));
  assert.equal(tree.root.findByType('status-ring').props.value,'—');assert.equal(tree.root.findByType('status-ring').props.percent,null);
 }finally{if(tree)await act(async()=>tree.unmount());}
});
