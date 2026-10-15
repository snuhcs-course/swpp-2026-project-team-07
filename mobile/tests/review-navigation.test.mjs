import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/domain-loader.mjs';
registerHooks({resolve,load});
const {claimReviewDrag}=await import('../src/domain/gestures.ts');
test('Review claims downward body drag only at scroll top, preserving scroll and modal controls',()=>{
 const at=(o={})=>claimReviewDrag({dx:0,dy:20,startY:400,scrollY:0,modal:false,...o});
 assert.equal(at(),true);assert.equal(at({scrollY:30}),false);
 assert.equal(at({modal:true}),false);assert.equal(at({dx:30}),false);
 assert.equal(at({dy:4}),false);assert.equal(at({dy:-20}),false);
 assert.equal(at({startY:80,dy:-20}),true);
 assert.equal(at({startY:100,dy:200}),true);
});
