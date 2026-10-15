import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/domain-loader.mjs';registerHooks({resolve,load});
const {quotesEqual,verifiedExcerpt,structurallyEqual}=await import('../src/features/feedback/evidence.ts');
const cases=JSON.parse(readFileSync(new URL('../../backend/rehearsals/testdata/evidence_quotes.json',import.meta.url),'utf8'));
test('shared quote corpus accepts formatting and rejects changed meaning',()=>{
 for(const [group,expected]of [['accept',true],['reject',false]])for(const [source,model]of cases[group]){
  assert.equal(quotesEqual(model,source),expected,JSON.stringify([source,model]));
  assert.equal(quotesEqual(source,model),expected,JSON.stringify([source,model]));
 }
});
test('only contiguous whole-word slide excerpts are accepted',()=>{
 const source='Overview: Coffee\n grows at 1.5 km above sea level.';
 assert.equal(verifiedExcerpt('Grows at 1.5 km',source),'grows at 1.5 km');
 for(const fake of ['grows at 15 km','Coffee at 1.5','above sea below level','1','C'])assert.equal(verifiedExcerpt(fake,source),null);
 assert.equal(verifiedExcerpt('C','C++'),null);
});
test('structural equality ignores property order but preserves array order and values',()=>{
 assert.equal(structurallyEqual({a:1,b:[{start:0,end:1}]},{b:[{end:1,start:0}],a:1}),true);
 assert.equal(structurallyEqual({a:[1,2]},{a:[2,1]}),false);
 assert.equal(structurallyEqual({a:1},{a:'1'}),false);
 assert.equal(structurallyEqual({a:null},{}),false);
});
