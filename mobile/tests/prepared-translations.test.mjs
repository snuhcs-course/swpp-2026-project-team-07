import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { load, resolve } from './helpers/domain-loader.mjs';
registerHooks({ load, resolve });
const { createTranslationCache } = await import('../src/features/localization/translationCache.ts');
const { createPreparedTranslations } = await import('../src/features/localization/preparedTranslations.ts');
const { firstWordingPending, markNewWording } = await import('../src/features/localization/firstWording.ts');
const { firstFeedback } = await import('../src/features/localization/firstFeedback.ts');
const api = 'https://prepared.invalid/api', path = 'questions.0.question', follow = 'questions.0.follow_up';
const question = 'Why do the rooms close early?', korean = '열람실이 왜 일찍 문을 닫나요?';
const resource = { kind:'questions',resource_id:'17',fields:{[path]:question} };
const bundle = (r, state, fields = {}, next_cursor = null) => Response.json({
  kind:r.kind,resource_id:r.resource_id,revision:r.revision ?? '',state,fields,next_cursor,
});
function setup(transport, disk = new Map()) {
  let clock = 0, timer = 0;
  const scheduled = new Map(), calls = [];
  const net = async (url, init) => {
    const body = init.body && JSON.parse(init.body);
    calls.push([url,init.method,body]);
    return transport(url,init.method,body);
  };
  const cache = createTranslationCache({ api, read:k=>disk.get(k),write:(k,v)=>disk.set(k,structuredClone(v)),fetch:net });
  const queue = createPreparedTranslations({api,cache,fetch:net,language:()=>'ko',now:()=>clock,
    schedule:(f,ms)=>{const id=++timer;scheduled.set(id,{f,at:clock+ms});return id;},unschedule:id=>scheduled.delete(id)});
  cache.setPreparationOwner(queue.retain);
  const tick = async (ms=0) => {
    clock += ms;
    for(const [id,t] of [...scheduled]) if(t.at<=clock&&scheduled.delete(id))t.f();
    await new Promise(resolve=>setImmediate(resolve));
  };
  return {cache,queue,tick,calls,disk};
}
test('selected receipt prepares both exact variants before entering a screen, even with overlapping readers; offline restart is local',async()=>{
  let release;
  const completed = bundle(resource,'completed',{[path]:{source:question,en:question,ko:korean}});
  const app=setup(()=>new Promise(resolve=>{release=resolve;}));
  app.queue.select([resource]);await app.tick();
  const visible=app.cache.retain([{...resource,language:'ko'}]);
  app.queue.select([resource]);await app.tick();assert.equal(app.calls.length,1);
  release(completed);await app.tick();
  assert.deepEqual(app.calls,[[api+'/localization/prepared/','POST',{kind:'questions',resource_id:'17',revision:'',preferred_language:'ko'}]]);
  visible();app.queue.stop();
  const offline=setup(()=>assert.fail('cached wording caused a request'),app.disk);
  offline.queue.select([resource]);await offline.tick();
  for(const language of ['en','ko','en'])assert.equal(offline.cache.get({...resource,language},path,question),language==='en'?question:korean);
  assert.equal(offline.calls.length,0);offline.queue.stop();
});
test('paginates canonical fields, protects changed originals/revisions and uses completed fields before other work finishes',async()=>{
  const r={...resource,revision:'2',fields:{[path]:question,[follow]:'How can you compare both options?'}};
  let stale=true;
  const app=setup((url,method)=>{
    if(stale){stale=false;return bundle({...r,revision:'1'},'completed',{[path]:{source:question,ko:'오래된 문구'}});}
    if(method==='POST')return bundle(r,'pending',{[path]:{source:question,en:question,ko:korean}},'second');
    assert.match(url,/revision=2&cursor=second/);
    return bundle(r,'completed',{[follow]:{source:r.fields[follow],en:r.fields[follow],ko:'두 가지 선택을 어떻게 비교할 수 있나요?'}});
  });
  app.queue.select([r]);await app.tick();assert.equal(app.cache.get({...r,language:'ko'},path,question),null);
  await app.tick(1999);assert.equal(app.calls.length,1);
  app.queue.wake();await app.tick();
  assert.equal(app.calls.length,3);assert.equal(app.cache.get({...r,language:'ko'},path,question),korean);
  assert.equal(app.cache.get({...r,revision:'3',language:'ko'},path,question),null);
  assert.equal(app.cache.get({...r,language:'ko'},path,'A changed question?'),null);app.queue.stop();
});
test('loss of connectivity resumes automatically without another flag or manual retry; deselection stops further polling',async()=>{
  let attempts=0;
  const app=setup((url,method)=>{
    if(++attempts===1)throw new Error('offline');
    return bundle(resource,attempts===2?'pending':'completed',attempts===3?{[path]:{source:question,en:question,ko:korean}}:{});
  });
  app.queue.select([resource]);await app.tick();await app.tick(2000);
  app.queue.pause();await app.tick(90000);assert.equal(app.calls.length,2);
  app.queue.wake();await app.tick();assert.deepEqual(app.calls.map(c=>c[1]),['POST','POST','GET']);
  app.queue.select([]);await app.tick(90000);assert.equal(app.calls.length,3);app.queue.stop();
});
test('legacy batches contain only selected original prose, coalesce rapid toggles and add newly saved answers',async()=>{
  const r={kind:'legacy_qa',resource_id:'local-run',fields:{[path]:question}};
  const did='You compared both choices.', koDid='두 가지 선택을 모두 비교했어요.';
  const app=setup((_url,method,body)=>{
    assert.equal(method,'POST');
    return bundle(r,'completed',Object.fromEntries(Object.entries(body.fields).map(([p,source])=>[p,{source,en:source,ko:p===path?korean:koDid}])));
  });
  app.queue.select([r]);const a=app.cache.retain([{...r,language:'en'}]),b=app.cache.retain([{...r,language:'ko'}]);await app.tick();a();b();
  app.queue.select([{...r,fields:{...r.fields,'answers.0.1.did':did}}]);await app.tick();
  assert.deepEqual(app.calls.map(c=>c[2].fields),[{[path]:question},{'answers.0.1.did':did}]);
  assert.equal(app.cache.get({...r,language:'ko'},'answers.0.1.did',did),koDid);app.queue.stop();
});
test('first-ready handoff holds freshly generated feedback, cues, question and evaluation until selected wording is ready',async()=>{
  for (const [kind,key,source,ko] of [
    ['questions',path,question,korean],['profiles','slides.0.must_cover.0.text','Explain the difference to your audience.','청중에게 차이를 설명하세요.'],
    ['answer','answers.0.0.did','You introduced both options for comparison.','비교할 두 가지 선택을 소개했어요.'],
    ['feedback','whole.top_priorities.0.headline','Explain the difference to your audience.','청중에게 차이를 설명하세요.'],
  ]){
    const r={kind,resource_id:'fresh-'+kind,revision:'4',fields:{[key]:source}},cache=setup(()=>assert.fail()).cache;
    const project=text=>text(key,source);
    assert.equal(firstWordingPending(api,r,'first','ko',cache,project),false,'old recording remains accessible');
    markNewWording(api,kind,r.resource_id,r.revision);
    assert.equal(firstWordingPending(api,r,'first','ko',cache,project),true);
    cache.install(r,{[key]:{source:'different source',en:source,ko}},'ko');
    assert.equal(firstWordingPending(api,r,'first','ko',cache,project),true);
    cache.install(r,{[key]:{source,en:source,ko}},'ko');
    assert.equal(firstWordingPending(api,r,'first','ko',cache,project),false);
    assert.equal(firstWordingPending(api,r,'first','en',cache,project),false,'no selection reset on flag');
  }
  const source='Explain the difference to your audience.', r={kind:'feedback',resource_id:'fresh-measured',fields:{'slides.0.improvements.0.headline':source}};
  const {cache}=setup(()=>assert.fail()),raw={runId:r.resource_id,status:'completed',whole:null,slides:[{slide_index:0,status:'scored',score:80,
    criteria:[],must_cover:[],strength:null,improvements:[{headline:source,explanation:[],steps:[],example:'Keep this exact.'}]}]};
  markNewWording(api,r.kind,r.resource_id);
  const held=firstFeedback(api,raw,()=>true,true,undefined,'ko',cache);
  assert.equal(held.status,'running');assert.equal(held.slides[0].score,null);assert.equal(held.slides[0].improvements.length,0);
  cache.install(r,{'slides.0.improvements.0.headline':{source,en:source,ko:'차이를 설명하세요.'}},'ko');
  assert.equal(firstFeedback(api,raw,()=>true,true,undefined,'ko',cache),raw);
});
test('a Spanish result opens in preferred Korean while English is still pending, then both cache without a new POST',async()=>{
  const source='¿Cuándo cierran las salas?', r={kind:'questions',resource_id:'preferred-18',fields:{[path]:source}};
  const app=setup((_url,method,body)=>{
    if(method==='POST'){assert.equal(body.preferred_language,'ko');return bundle(r,'pending',{[path]:{source,ko:korean}});}
    return bundle(r,'completed',{[path]:{source,ko:korean,en:question}});
  });
  markNewWording(api,r.kind,r.resource_id);
  const project=text=>text(path,source);
  assert.equal(firstWordingPending(api,r,'initial','ko',app.cache,project),true);
  app.queue.select([r]);await app.tick();
  assert.equal(app.cache.get({...r,language:'en'},path,source),null);
  assert.equal(app.cache.get({...r,language:'ko'},path,source),korean);
  assert.equal(firstWordingPending(api,r,'initial','ko',app.cache,project),false);
  await app.tick(2000);
  assert.equal(app.cache.get({...r,language:'en'},path,source),question);
  assert.deepEqual(app.calls.map(c=>c[1]),['POST','GET']);app.queue.stop();
});
test('terminal Korean keeps the exact available English and releases new result; a later foreground read can recover without resubmission',async()=>{
  const r={...resource,resource_id:'blocked-19'};
  const app=setup((_url,method)=>method==='POST' ? Response.json({
    kind:r.kind,resource_id:r.resource_id,revision:'',state:'failed',terminal:true,terminal_fields:{ko:[path],en:[]},
    fields:{[path]:{source:question,en:question}},next_cursor:null,
  }) : bundle(r,'completed',{[path]:{source:question,en:question,ko:korean}}));
  markNewWording(api,r.kind,r.resource_id);app.queue.select([r]);await app.tick();
  assert.ok(app.cache.unavailable({...r,language:'ko'},path,question));
  assert.equal(app.cache.unavailable({...r,language:'en'},path,question),false);
  assert.equal(firstWordingPending(api,r,'initial','ko',app.cache,text=>text(path,question)),false);
  assert.equal(app.cache.get({...r,language:'en'},path,question),question);
  await app.tick(90000);assert.equal(app.calls.length,1,'unsafe completion was not retried');
  const restart=setup((_url,method)=>{assert.equal(method,'GET');return bundle(r,'completed',{[path]:{source:question,en:question,ko:korean}});},app.disk);
  assert.ok(restart.cache.unavailable({...r,language:'ko'},path,question));restart.queue.select([r]);await restart.tick();
  assert.equal(restart.cache.unavailable({...r,language:'ko'},path,question),false);
  assert.equal(restart.cache.get({...r,language:'ko'},path,question),korean);
  app.queue.stop();restart.queue.stop();
});
