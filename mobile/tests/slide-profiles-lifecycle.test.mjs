import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/cue-panel-loader.mjs';
import {profileResponse,deckId} from './helpers/slide-profile-fixtures.mjs';
import {sqliteFaults} from './helpers/sqlite-node.mjs';
registerHooks({resolve,load});
const React=await import('react');
const {act,create}=await import('react-test-renderer');
const {useSlideProfiles}=await import('../src/features/presentations/useSlideProfiles');
const {CueGuidancePanel}=await import('../src/features/presentations/CueGuidancePanel');
const {ThemeProvider,useTheme}=await import('../src/design/theme');
const {writeStored,removeStored}=await import('../src/services/storage');
const {readProfiles}=await import('../src/features/presentations/slideProfiles');
const {API_URL}=await import('../src/services/api');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let current;
function Harness({localId,slide=0,rotated=false,source,pages=3}) {
  current=useSlideProfiles(localId,pages,true,source);
  const theme=useTheme();
  return React.createElement(React.Fragment,null,
    React.createElement('theme-toggle',{onPress:theme.toggle}),
    rotated?React.createElement('pdf'):React.createElement(CueGuidancePanel,{state:current.value,slide,error:current.error,busy:current.busy,
      connectionMessage:current.available?undefined:current.error||'Connecting for cues…',
      onRecover:action=>action==='refresh'?current.refresh():current.recover()}));
}
const tree=props=>React.createElement(ThemeProvider,null,React.createElement(Harness,props));
const json=r=>JSON.stringify(r.toJSON());
function setup(localId){removeStored(`slide-profiles:v1:${encodeURIComponent(API_URL)}:${deckId}`);writeStored(`server-deck:${API_URL}:${localId}`,deckId);}

test('a locally ready PDF links to the server before loading its cues',async()=>{
 const localId='local-only-cues';removeStored(`server-deck:${API_URL}:${localId}`);
 removeStored(`slide-profiles:v1:${encodeURIComponent(API_URL)}:${deckId}`);
 const original=globalThis.fetch,calls=[];let renderer;
 globalThis.__cueServerSlides=async(local,api)=>{
  calls.push(['link',local.id,api]);writeStored(`server-deck:${api}:${local.id}`,deckId);
  return {deckId,texts:['','','']};
 };
 globalThis.fetch=async(url,init)=>{calls.push([init.method,url]);return new Response(JSON.stringify(profileResponse()));};
 try{
  const source={id:localId,title:'Local PDF',uri:'file://local.pdf',pageCount:3};
  await act(async()=>{renderer=create(tree({localId,source}));});
  assert.deepEqual(calls,[['GET',`${API_URL}/ready/`],['link',localId,API_URL],['GET',`${API_URL}/decks/${deckId}/profiles/`]]);
  assert.equal(current.available,true);assert.match(json(renderer),/Explain the change in measured growth/);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;delete globalThis.__cueServerSlides;}
});

test('a local PDF retries its server link after a connection failure',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const localId='local-reconnect-cues';removeStored(`server-deck:${API_URL}:${localId}`);
 removeStored(`slide-profiles:v1:${encodeURIComponent(API_URL)}:${deckId}`);
 const original=globalThis.fetch;let renderer,links=0;
 globalThis.__cueServerSlides=async(local,api)=>{
  links++;if(links===1)throw Error('offline');
  writeStored(`server-deck:${api}:${local.id}`,deckId);return {deckId,texts:['','','']};
 };
 globalThis.fetch=async()=>new Response(JSON.stringify(profileResponse()));
 try{
  const source={id:localId,title:'Reconnect PDF',uri:'file://local.pdf',pageCount:3};
  await act(async()=>{renderer=create(tree({localId,source}));});
  assert.equal(links,1);assert.match(current.error,/Reconnecting/);
  assert.doesNotMatch(json(renderer),/AI cues are unavailable offline/);
  await act(async()=>t.mock.timers.tick(2500));
  assert.equal(links,2);assert.equal(current.error,'');assert.match(json(renderer),/Explain the change in measured growth/);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;delete globalThis.__cueServerSlides;t.mock.timers.reset();}
});

test('an unconfirmed PDF upload waits for an explicit refresh before another POST',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const localId='local-unconfirmed-cues';removeStored(`server-deck:${API_URL}:${localId}`);
 const original=globalThis.fetch;let renderer,links=0,unconfirmed=false,finishRetry,ready=true;
 globalThis.fetch=async()=>new Response('{}',{status:ready?200:503});
 globalThis.__cueServerPdfUnconfirmed=()=>unconfirmed;
 globalThis.__cueServerSlides=async(_local,_api,_signal,_timeout,retryUnconfirmed)=>{
  links++;if(links===1){unconfirmed=true;throw Error('The server did not confirm the PDF request before the time limit.');}
  assert.equal(retryUnconfirmed,true,'only explicit refresh may repeat an unconfirmed PDF upload');
  return new Promise(resolve=>{finishRetry=()=>{unconfirmed=false;writeStored(`server-deck:${API_URL}:${localId}`,deckId);
    resolve({deckId,texts:['','','']});};});
 };
 try{
  const source={id:localId,title:'Unconfirmed PDF',uri:'file://local.pdf',pageCount:3};
  await act(async()=>{renderer=create(tree({localId,source}));});
  assert.equal(links,1);assert.match(current.error,/Tap Refresh with server/);
  await act(async()=>t.mock.timers.tick(60000));assert.equal(links,1);
  const {backgroundApp,setFocused}=await import('./helpers/recording-screen-ui.mjs');
  await act(async()=>backgroundApp('background'));await act(async()=>backgroundApp('active'));
  await act(async()=>setFocused(false));await act(async()=>setFocused(true));
  assert.equal(links,1,'foreground and focus do not repeat an unconfirmed POST');
  ready=false;
  await act(async()=>current.refresh());assert.equal(links,1);
  assert.match(current.error,/Tap Refresh with server/);
  ready=true;
  await act(async()=>current.refresh());assert.equal(links,2,'a failed readiness check leaves refresh available');
  await act(async()=>{current.refresh();current.refresh();});
  assert.equal(links,2,'cue sheet and landscape double taps cannot interrupt/repost an in-flight PDF');
  await act(async()=>finishRetry());
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;delete globalThis.__cueServerSlides;delete globalThis.__cueServerPdfUnconfirmed;t.mock.timers.reset();}
});

test('unready server does not start a PDF upload',async()=>{
 const localId='local-unready-cues';removeStored(`server-deck:${API_URL}:${localId}`);
 const original=globalThis.fetch;let renderer,links=0;
 globalThis.fetch=async()=>new Response('{}',{status:503});
 globalThis.__cueServerSlides=async()=>{links++;throw Error('Unexpected upload');};
 try{
  await act(async()=>{renderer=create(tree({localId,source:{id:localId,title:'Unready',uri:'file://local.pdf',pageCount:3}}));});
  assert.equal(links,0);assert.match(current.error,/HTTP 503/);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;delete globalThis.__cueServerSlides;}
});

test('a stalled readiness check times out without uploading the PDF',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const localId='local-stalled-readiness';removeStored(`server-deck:${API_URL}:${localId}`);
 const original=globalThis.fetch;let renderer,links=0;
 globalThis.fetch=async(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));
 globalThis.__cueServerSlides=async()=>{links++;throw Error('Unexpected upload');};
 try{
  await act(async()=>{renderer=create(tree({localId,source:{id:localId,title:'Stalled',uri:'file://local.pdf',pageCount:3}}));});
  await act(async()=>t.mock.timers.tick(15000));
  assert.equal(links,0);assert.match(current.error,/readiness check timed out/i);
 }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;delete globalThis.__cueServerSlides;t.mock.timers.reset();}
});

test('navigation, layout and theme changes reuse the v5 set; offline reopening restores the actual cache with GET only',async()=>{
  setup('profile-lifecycle');const original=globalThis.fetch,calls=[];let renderer;
  globalThis.fetch=async(url,init)=>{calls.push({url,method:init.method});return new Response(JSON.stringify(profileResponse()));};
  try{
    await act(async()=>{renderer=create(tree({localId:'profile-lifecycle'}));});
    assert.match(json(renderer),/Explain the change in measured growth/);assert.match(json(renderer),/Connect the result to a practical example/);
    for(const [slide,rotated] of [[1,false],[0,false],[2,true],[1,true],[1,false]]){
      await act(async()=>renderer.update(tree({localId:'profile-lifecycle',slide,rotated})));
      if(!rotated&&slide===1){assert.match(json(renderer),/Recap the final result/);assert.doesNotMatch(json(renderer),/Explain the change/);}
    }
    await act(async()=>renderer.root.findByType('theme-toggle').props.onPress());
    assert.match(json(renderer),/Recap the final result/);
    assert.deepEqual(calls.map(c=>c.method),['GET']);
    assert.ok(calls.every(c=>c.url===`${API_URL}/decks/${deckId}/profiles/`));
    await act(async()=>renderer.unmount());renderer=null;
    globalThis.fetch=async(url,init)=>{calls.push({url,method:init.method});throw Error('offline');};
    await act(async()=>{renderer=create(tree({localId:'profile-lifecycle',slide:0}));});
    assert.match(json(renderer),/Explain the change in measured growth/);assert.match(json(renderer),/Connect the result to a practical example/);
    assert.match(current.error,/Saved cues are retained/);
    assert.equal(readProfiles(API_URL,deckId,3).provenance.prompt_version,'slide-profile-v5');
    assert.deepEqual(calls.map(c=>c.method),['GET','GET']);
  }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;}
});

test('moving through a 91-slide deck does not revalidate the saved profiles on each render',async()=>{
  const localId='long-profile-cache';
  const cacheKey=`slide-profiles:v1:${encodeURIComponent(API_URL)}:${deckId}`;
  const wire=profileResponse();
  const example=wire.descriptions.slides[1];
  wire.descriptions.slides=Array.from({length:91},(_,slide_index)=>({...example,slide_index,source_id:slide_index.toString(16).padStart(64,'0')}));
  wire.provenance.sources=wire.descriptions.slides.map(({slide_index,source_id})=>({slide_index,source_id}));
  writeStored(`server-deck:${API_URL}:${localId}`,deckId);
  writeStored(cacheKey,wire);
  const originalFetch=globalThis.fetch,originalFault=sqliteFaults.before;
  let renderer,reads=0;
  globalThis.fetch=async()=>new Response(JSON.stringify(wire));
  sqliteFaults.before=(operation,sql,args)=>{
    originalFault?.(operation,sql,args);
    if(operation==='get'&&args[0]===cacheKey)reads++;
  };
  try{
    await act(async()=>{renderer=create(tree({localId,pages:91}));});
    const initialReads=reads;
    assert.ok(initialReads>0);
    for(let slide=1;slide<91;slide++)await act(async()=>renderer.update(tree({localId,pages:91,slide})));
    assert.match(json(renderer),/Recap the final result/);
    assert.equal(reads,initialReads,'local slide navigation must not read or parse the full persisted profile');
  }finally{
    if(renderer)await act(async()=>renderer.unmount());
    globalThis.fetch=originalFetch;
    sqliteFaults.before=originalFault;
  }
});

test('active polling is read-only and stops when the recording screen closes',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});setup('profile-poll-cleanup');
  const original=globalThis.fetch,calls=[];let renderer;
  globalThis.fetch=async(_url,init)=>{calls.push(init);return new Response(JSON.stringify(profileResponse({state:'queued',descriptions:null,available_data:false})));};
  try{
    await act(async()=>{renderer=create(tree({localId:'profile-poll-cleanup'}));});
    assert.equal(current.value.state,'queued');assert.deepEqual(calls.map(c=>c.method),['GET']);
    await act(async()=>t.mock.timers.tick(2500));assert.deepEqual(calls.map(c=>c.method),['GET','GET']);
    await act(async()=>renderer.unmount());renderer=null;
    await act(async()=>t.mock.timers.tick(10000));assert.equal(calls.length,2);
  }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;t.mock.timers.reset();}
});

test('unmount aborts an in-flight profile read and prevents follow-up polling',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});setup('profile-inflight-cleanup');
  const original=globalThis.fetch,calls=[];let renderer,aborted=0;
  globalThis.fetch=async(_url,init)=>{calls.push(init);return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>{aborted++;reject(Error('cancelled'));},{once:true}));};
  try{
    await act(async()=>{renderer=create(tree({localId:'profile-inflight-cleanup'}));});
    await act(async()=>renderer.unmount());renderer=null;
    assert.equal(aborted,1);assert.equal(calls[0].signal.aborted,true);
    await act(async()=>t.mock.timers.tick(65000));assert.deepEqual(calls.map(c=>c.method),['GET']);
  }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;t.mock.timers.reset();}
});

test('stale saved content is hidden and generation occurs only after an explicit recovery action',async()=>{
  setup('profile-stale-recovery');const original=globalThis.fetch,calls=[];let renderer,generated=false;
  globalThis.fetch=async(url,init)=>{
    calls.push({url,method:init.method,body:init.body});
    if(init.method==='POST')generated=true;
    return new Response(JSON.stringify(profileResponse({stale:!generated})));
  };
  try{
    await act(async()=>{renderer=create(tree({localId:'profile-stale-recovery'}));});
    assert.match(json(renderer),/out of date/);assert.doesNotMatch(json(renderer),/Explain the change/);
    await act(async()=>renderer.update(tree({localId:'profile-stale-recovery',slide:1})));
    await act(async()=>renderer.root.findByType('theme-toggle').props.onPress());
    assert.deepEqual(calls.map(c=>c.method),['GET']);
    assert.equal(renderer.root.findAllByType('pressable').find(p=>p.props.accessibilityLabel==='Generate AI cues'),undefined);
    await act(async()=>renderer.root.findAllByType('pressable').find(p=>p.props.accessibilityLabel==='Open Must cover cues').props.onPress());
    assert.deepEqual(calls.map(c=>c.method),['GET']);
    const generate=renderer.root.findAllByType('pressable').find(p=>p.props.accessibilityLabel==='Generate AI cues');
    await act(async()=>{generate.props.onPress();});
    assert.equal(calls.filter(c=>c.method==='POST').length,1);
    const request=calls.find(c=>c.method==='POST');assert.equal(request.url,`${API_URL}/decks/${deckId}/profiles/generate/`);assert.deepEqual(JSON.parse(request.body),{});
    assert.match(json(renderer),/Recap the final result/);
  }finally{if(renderer)await act(async()=>renderer.unmount());globalThis.fetch=original;}
});


test('transient cue reads retry with bounded backoff and clear the notice on recovery',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});setup('cue-backoff');
 const old=globalThis.fetch;let r,calls=0;
 globalThis.fetch=async()=>{calls++;if(calls<5)throw Error('offline');return new Response(JSON.stringify(profileResponse()));};
 try{
  await act(async()=>{r=create(tree({localId:'cue-backoff'}));});
  for(const delay of [2500,5000,10000,30000])await act(async()=>t.mock.timers.tick(delay));
  assert.equal(calls,5);assert.match(json(r),/Explain the change/);assert.equal(current.error,'');
  await act(async()=>t.mock.timers.tick(30000));assert.equal(calls,5);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;t.mock.timers.reset();}
});


test('foreground and screen focus resume cue reads; a superseded read cannot replace another deck',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});setup('cue-focus');
 const {backgroundApp,setFocused}=await import('./helpers/recording-screen-ui.mjs');
 const old=globalThis.fetch;let r,calls=0,late;
 globalThis.fetch=async()=>{calls++;if(calls===1)return new Promise(resolve=>{late=()=>resolve(new Response(JSON.stringify(profileResponse())));});return new Response(JSON.stringify(profileResponse()));};
 try{
  await act(async()=>{r=create(tree({localId:'cue-focus'}));});
  await act(async()=>backgroundApp('background'));
  await act(async()=>t.mock.timers.tick(30000));assert.equal(calls,1);
  await act(async()=>backgroundApp('active'));assert.equal(calls,2);
  await act(async()=>setFocused(false));await act(async()=>setFocused(true));assert.equal(calls,3);
  await act(async()=>r.update(tree({localId:'unmapped-deck'})));
  await act(async()=>late());assert.equal(current.value,null);assert.doesNotMatch(json(r),/Explain the change/);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;backgroundApp('active');setFocused(true);t.mock.timers.reset();}
});


test('current cached cues remain visible through a failed read and successful same-screen reconnect',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});setup('cue-cache-reconnect');
 const {createProfileClient}=await import('../src/features/presentations/slideProfiles');
 const old=globalThis.fetch;let r,reads=0;
 await createProfileClient(API_URL,async()=>new Response(JSON.stringify(profileResponse()))).read(deckId,3);
 globalThis.fetch=async()=>{if(++reads===1)throw Error('offline');return new Response(JSON.stringify(profileResponse()));};
 try{
  await act(async()=>{r=create(tree({localId:'cue-cache-reconnect'}));});assert.match(json(r),/Explain the change/);assert.doesNotMatch(json(r),/Status · Tap for detail/);
  await act(async()=>r.root.findAllByType('pressable').find(p=>p.props.accessibilityLabel==='Open Must cover cues').props.onPress());assert.doesNotMatch(json(r),/Saved cues are retained/);
  await act(async()=>t.mock.timers.tick(2500));assert.match(json(r),/Explain the change/);assert.equal(current.error,'');
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;t.mock.timers.reset();}
});
