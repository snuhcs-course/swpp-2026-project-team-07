import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/qa-screen-runtime-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {QAScreen,audienceNames,AUDIENCE_NAMES}=await import('../src/screens/QAScreen.tsx');
const {PageSurface}=await import('../src/design/ui.tsx');
const {PanView}=await import('../src/design/PanView.tsx');
const Surface=PageSurface.type??PageSurface;
const {saveQaV2,readQaV2}=await import('../src/features/qa/store.ts');
const {API_URL}=await import('../src/services/api.ts');
const {runtime,flattenStyle}=await import('./helpers/qa-screen-runtime-native.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
// Asset identities only; this test never reads the phone or a user recording.
globalThis.require=asset=>asset;
const question=i=>({id:String(i).padStart(32,'a'),panelist:'P'+i,role:'Student from the audience',slide_index:i-1,topic:'The evidence for proposal '+i,question:'How does proposal '+i+' work?',follow_up:'Which detail supports proposal '+i+'?'});
function setup(questions=[1,2,3].map(question)){
 runtime.routes=[];runtime.mounts=0;runtime.unmounts=0;runtime.speeches=[];runtime.speechStops=0;runtime.onSpeechStop=null;runtime.captureStarts=0;runtime.playerStops=0;runtime.plays=[];
 const cached={jobId:73001,runId:'runtime-run',audience:'Saved audience',questions,answers:{},createdAt:'2026-01-01T00:00:00Z'};
 saveQaV2(API_URL,'runtime-deck',cached.jobId,cached);
 globalThis.qaScreenModel={transcribed:true,transcripts:new Map(),stages:new Map(),deck:{id:'runtime-deck',hue:'blue',pages:[],slides:[]},state:{run:{id:'runtime-run',parts:[]}}};
 globalThis.qaScreenValue={requirements:{audience:'Saved audience',requiredDurationSeconds:300},requirementsDirty:false,state:{state:'completed',stale:false,attempt_id:'runtime-attempt',requirements:{audience:'Saved audience'},result:{job_id:cached.jobId,stale:false,questions}},notice:'',busy:false,generate:()=>{throw new Error('Question navigation must never generate');},refresh:()=>{}};
 return cached;
}
const button=(r,label)=>r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel===label);
function assertPageVisible(r,index){
 const words=r.root.findAllByType('text').map(n=>n.children.join(' '));
 assert.ok(words.includes('Audience Q&A'));
 assert.ok(words.some(text=>text.startsWith('Question '+index+' of 3')));
 assert.ok(button(r,'Back'));
 assert.ok(button(r,'Answer the question'));
 const surface=r.root.findByType(Surface);
 let node=surface.parent;
 while(node){if(node.type==='animated'){const style=flattenStyle(node.props.style),reactStyle=flattenStyle(node.props.style,true);assert.notEqual(style.display,'none');assert.ok((style.opacity??1)>0,'Q&A ancestor remains visible');assert.ok((reactStyle.opacity??1)>0,'a React commit must retain the completed page opacity');}node=node.parent;}
 assert.equal(runtime.unmounts,0,'question navigation must retain the mounted recorder/screen');
 assert.deepEqual(runtime.routes,[],'Next stays on the same Q&A page');
}
test('actual Next buttons advance a cached three-question page while retaining header, surface and answer control',async()=>{
 const cached=setup();let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const surface=r.root.findByType(Surface),pan=r.root.findByType(PanView);
  assertPageVisible(r,1);assert.equal(runtime.mounts,1);
  for(const index of [2,3]){
   const next=button(r,'Next');assert.ok(next);
   await act(async()=>next.props.onPress());
   assertPageVisible(r,index);
   assert.equal(r.root.findByType(Surface),surface,'Next preserves the page surface');
   assert.equal(r.root.findByType(PanView),pan,'Next preserves its responder');
  }
  assert.equal(!!button(r,'Next'),false);
  assert.equal(readQaV2(API_URL,'runtime-deck',cached.jobId).questions.length,3);
  assert.deepEqual(readQaV2(API_URL,'runtime-deck',cached.jobId).answers,{});
 }finally{if(r)await act(async()=>r.unmount());}
 assert.equal(runtime.unmounts,1);
});
test('Q&A question swipe moves horizontally without fading its content',async()=>{
 setup();let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const pan=r.root.findByType(PanView);
  await act(async()=>{pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:0,dy:50});pan.props.onMove({}, {dx:0,dy:50});});
  await act(async()=>{pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:-90,dy:0});pan.props.onMove({}, {dx:-90,dy:0});});
  const moved=r.root.findAllByType('animated').map(node=>flattenStyle(node.props.style)).find(style=>style.transform?.[0]?.translateX<0);
  assert.equal(moved?.transform[0].translateX,-90);
  assert.equal(moved.opacity,1);
  assert.ok(r.root.findAllByType('animated').map(node=>flattenStyle(node.props.style)).every(style=>style.opacity===undefined||style.opacity===1),
   'a horizontal swipe resets the vertical page fade');
  await act(async()=>pan.props.onRelease({}, {dx:-90,dy:0}));
  assertPageVisible(r,2);
 }finally{if(r)await act(async()=>r.unmount());}
});

// OpenAI Codex, Iteration 2 (2026-11-21): the parent catches a short downward start over the chat.
test('Q&A downward pull is captured over the question while long-question scrolling remains available',async()=>{
 setup();let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const pan=r.root.findByType(PanView);
  const down={dx:0,dy:16};const event={nativeEvent:{pageY:300}};
  assert.equal(pan.props.onMoveShouldCapture(event,down),true);
  const chat=r.root.findAllByType('scroll').find(node=>node.props.overScrollMode==='never');
  await act(async()=>chat.props.onScroll({nativeEvent:{contentOffset:{y:50}}}));
  assert.equal(pan.props.onMoveShouldCapture(event,down),false,'a displaced long question can scroll back to its top');
  await act(async()=>chat.props.onScroll({nativeEvent:{contentOffset:{y:0}}}));
  assert.equal(pan.props.onMoveShouldCapture(event,down),true);
  await act(async()=>{
   pan.props.onMoveShouldCapture(event,{dx:0,dy:140});
   pan.props.onMove({}, {dx:0,dy:140});pan.props.onRelease({}, {dx:0,dy:140});
  });
  assert.equal(runtime.routes.at(-1)?.[0],'review','the pull returns to the opening Review page');
 }finally{if(r)await act(async()=>r.unmount());}
});

test('Q&A completes the outgoing swipe before changing the question',async()=>{
 setup();runtime.deferTimings=true;let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const pan=r.root.findByType(PanView);
  await act(async()=>{pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:-90,dy:0});pan.props.onMove({}, {dx:-90,dy:0});pan.props.onRelease({}, {dx:-90,dy:0});});
  assert.ok(r.root.findAllByType('text').some(node=>node.children.join(' ').startsWith('Question 1 of 3')),
   'the current question remains mounted through its exit');
  assert.ok(r.root.findAllByType('animated').map(node=>flattenStyle(node.props.style)).some(style=>style.transform?.[0]?.translateX===-390));
  assert.ok([...runtime.timings].some(timing=>timing.options?.duration<=130),
   'the next question should start entering promptly after release');
  await act(async()=>runtime.finishTimings());
  assertPageVisible(r,2);
 }finally{runtime.deferTimings=false;runtime.finishTimings();if(r)await act(async()=>r.unmount());}
});

test('Q&A returns to Overall Review promptly even as its question batch refreshes',async()=>{
 setup();const previousNav=runtime.nav;
 const model=globalThis.qaScreenModel,deckId='swipe-refresh-deck';
 globalThis.qaScreenModel={...model,deck:{...model.deck,id:deckId}};
 runtime.nav={...previousNav,deckId,from:'full'};runtime.deferTimings=true;let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  await act(async()=>runtime.finishTimings());
  const event={nativeEvent:{pageY:280}},pull={dx:0,dy:75};
  const move=()=>{
   const pan=r.root.findByType(PanView);
   assert.equal(pan.props.onMoveShouldCapture(event,pull),true);pan.props.onGrant();pan.props.onMove(event,pull);
   return pan;
  };
  const refresh=jobId=>{
   const source=globalThis.qaScreenValue;
   globalThis.qaScreenValue={...source,state:{...source.state,result:{...source.state.result,job_id:jobId}}};
   r.update(React.createElement(QAScreen));
  };
  await act(async()=>{move();});
  assert.ok(flattenStyle(r.root.findByType(Surface).parent.props.style).opacity<1);
  await act(async()=>refresh(73002));
  assert.equal(flattenStyle(r.root.findByType(Surface).parent.props.style).opacity,1,'a lost gesture must restore full opacity');
  await act(async()=>move().props.onRelease(event,pull));
  const [exit]=runtime.timings;
  assert.equal(exit?.options.duration,180);
  assert.deepEqual(runtime.routes,[]);
  await act(async()=>refresh(73003));
  assert.deepEqual([...runtime.timings],[exit],'refresh must keep the same exit and never replay the entrance');
  await act(async()=>runtime.finishTimings());
  assert.deepEqual(runtime.routes,[['full',{nav:null,deckId,sel:previousNav.sel}]]);
 }finally{runtime.nav=previousNav;runtime.deferTimings=false;runtime.finishTimings();if(r)await act(async()=>r.unmount());}
});

test('Q&A horizontal gesture still changes questions with Reduce Motion',async()=>{
 setup();runtime.reducedMotion=true;let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const pan=r.root.findByType(PanView);
  await act(async()=>{pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:-90,dy:0});pan.props.onMove({}, {dx:-90,dy:0});pan.props.onRelease({}, {dx:-90,dy:0});});
  assertPageVisible(r,2);
 }finally{runtime.reducedMotion=false;if(r)await act(async()=>r.unmount());}
});

test('translates a saved question on the active language switch, speaks that version and restores the exact English without generating',async()=>{
 const {setAppLanguage}=await import('../src/design/language.ts');
 const {LanguageToggle}=await import('../src/design/LanguageToggle.tsx');
 const english='How does the PDF support your conclusion?', korean='PDF가 결론을 어떻게 뒷받침하나요?';
 const second={...question(2),question:english,follow_up:'Which detail supports this claim?'};
 const saved=setup([question(1),second,question(3)]), requests=[], old=globalThis.fetch;
 let resolveRequest,r;
 globalThis.fetch=(url,init)=>{requests.push([String(url),init]);return new Promise(done=>{resolveRequest=done;});};
 try{
  setAppLanguage('en');
  await act(async()=>{r=create(React.createElement(React.Fragment,null,React.createElement(QAScreen),React.createElement(LanguageToggle,{featureScreen:true})));});
  const surface=r.root.findByType(Surface);
  await act(async()=>button(r,'Next').props.onPress());
  assertPageVisible(r,2);
  assert.deepEqual(runtime.speeches.map(s=>[s.text,s.options.language]),[[question(1).question,'en'],[english,'en']]);
  await act(async()=>button(r,'App language: English').props.onPress());
  assert.equal(requests.length,1);
  const [url,init]=requests[0];assert.ok(url.endsWith('/localization/'));
  assert.equal(init.method,'POST');
  const body=JSON.parse(init.body);assert.equal(body.resource_id,String(saved.jobId));
  assert.equal(body.kind,'questions');assert.equal(body.language,'ko');
  assert.ok(Object.keys(body.fields).every(k=>k.startsWith('questions.1.')),'only the selected second question is translated');
  assert.equal(runtime.speeches.length,2,'loading text is never spoken');
  await act(async()=>button(r,'앱 언어: 한국어').props.onPress());
  assertPageVisible(r,2);assert.equal(runtime.speeches.at(-1).text,english);
  await act(async()=>button(r,'App language: English').props.onPress());
  assert.equal(requests.length,1,'rapid switches share the pending question translation');
  const translations=Object.fromEntries(Object.keys(body.fields).map(k=>[k,k.endsWith('.question')?korean:'후속 질문']));
  await act(async()=>{resolveRequest(Response.json({id:'1'.repeat(64),language:'ko',state:'completed',translations}));});
  assert.equal(runtime.speeches.at(-1).text,korean);assert.equal(runtime.speeches.at(-1).options.language,'ko');
  await act(async()=>button(r,'앱 언어: 한국어').props.onPress());
  assert.equal(r.root.findByType(Surface),surface);
  assert.equal(runtime.speeches.at(-1).text,english);
  assertPageVisible(r,2);
  assert.deepEqual(readQaV2(API_URL,'runtime-deck',saved.jobId).questions,saved.questions);
  await act(async()=>button(r,'App language: English').props.onPress());
  assert.equal(runtime.speeches.at(-1).text,korean);assert.equal(requests.length,1);
 }finally{if(r)await act(async()=>r.unmount());setAppLanguage('en');globalThis.fetch=old;}
});

test('switching languages keeps the compact team panel, initials and original question coordinates',async()=>{
 const {setAppLanguage}=await import('../src/design/language.ts');
 const questions=['City resident','Robin','P3'].map((panelist,i)=>({...question(i+1),panelist}));
 const saved=setup(questions),names=[...audienceNames(questions,saved.jobId).values()];
 const old=globalThis.fetch,calls=[];let r;
 globalThis.fetch=async(url,init)=>{
  assert.ok(url.endsWith('/localization/'));const body=JSON.parse(init.body);calls.push(body);
  const translations=Object.fromEntries(Object.keys(body.fields).map(k=>[k,k.endsWith('.question')?'제안 1은 어떻게 작동하나요?':'제안 1을 뒷받침하는 점은 무엇인가요?']));
  return Response.json({id:'3'.repeat(64),language:'ko',state:'completed',translations});
 };
 try{
  setAppLanguage('en');await act(async()=>{r=create(React.createElement(QAScreen));});
  const first=button(r,'Stop the question: '+questions[0].question);assert.ok(first);
  await act(async()=>setAppLanguage('ko'));
  assert.deepEqual([runtime.speeches.at(-1).text,runtime.speeches.at(-1).options.language],['제안 1은 어떻게 작동하나요?','ko']);
  const text=JSON.stringify(r.toJSON());
  for(const name of names){assert.ok(text.includes(name));assert.ok(text.includes(JSON.stringify(name.slice(0,2))));}
  assert.ok(!text.includes('City resident'));
  assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(calls[0].fields).sort(),['questions.0.follow_up','questions.0.question']);
  assert.deepEqual(readQaV2(API_URL,'runtime-deck',saved.jobId).questions,questions);
 }finally{if(r)await act(async()=>r.unmount());setAppLanguage('en');globalThis.fetch=old;}
});

test('a Korean first view caches the exact original short question for the first English switch offline',async()=>{
 const {setAppLanguage}=await import('../src/design/language.ts');
 const {LanguageToggle}=await import('../src/design/LanguageToggle.tsx');
 const {createTranslationCache}=await import('../src/features/localization/translationCache.ts');
 const {readStored,writeStored}=await import('../src/services/storage.ts');
 const original={...question(1),question:'Carbon cycle?'};
 const saved=setup([original]);const old=globalThis.fetch,calls=[];let r;
 globalThis.fetch=async(url,init)=>{
  const req=JSON.parse(init.body);calls.push(req);
  assert.ok(url.endsWith('/localization/'));assert.equal(req.language,'ko');
  return Response.json({id:'6'.repeat(64),language:'ko',state:'completed',
   translations:Object.fromEntries(Object.keys(req.fields).map(k=>[k,k.endsWith('.question')?'탄소 순환?': '탄소는 어떻게 순환하나요?'])),
   source_languages:Object.fromEntries(Object.keys(req.fields).map(k=>[k,'en']))});
 };
 try{
  setAppLanguage('ko');
  await act(async()=>{r=create(React.createElement(React.Fragment,null,React.createElement(QAScreen),React.createElement(LanguageToggle,{featureScreen:true})));});
  assert.match(JSON.stringify(r.toJSON()),/탄소 순환/);
  let offlineCalls=0;globalThis.fetch=async()=>{offlineCalls++;throw Error('simulated offline phone');};
  await act(async()=>button(r,'앱 언어: 한국어').props.onPress());
  assert.match(JSON.stringify(r.toJSON()),/Carbon cycle/);assert.equal(runtime.speeches.at(-1).text,original.question);
  assert.equal(offlineCalls,0);assert.equal(calls.length,1);
  const restarted=createTranslationCache({api:API_URL,read:readStored,write:writeStored,fetch:globalThis.fetch});
  assert.equal(restarted.get({kind:'questions',resource_id:String(saved.jobId),language:'en'},'questions.0.question',original.question),original.question);
 }finally{if(r)await act(async()=>r.unmount());setAppLanguage('en');globalThis.fetch=old;}
});

test('language changes and Hear taps during countdown stay silent until native speech stops and capture starts',async t=>{
 const {setAppLanguage}=await import('../src/design/language.ts');
 const q={...question(1),question:'How do the groups differ in this sample?'}, korean='표본에서 두 집단은 어떻게 다른가요?';
 setup([q]);const old=globalThis.fetch;let r,finishStop;
 t.mock.timers.enable({apis:['Date','setInterval'],now:1000});
 globalThis.fetch=async(_url,init)=>{const req=JSON.parse(init.body);return Response.json({id:'5'.repeat(64),language:'ko',state:'completed',translations:Object.fromEntries(Object.keys(req.fields).map(k=>[k,korean]))});};
 try{
  setAppLanguage('en');
  await act(async()=>{r=create(React.createElement(QAScreen));});
  assert.equal(runtime.speeches.length,1);
  await act(async()=>button(r,'Answer the question').props.onPress());
  await act(async()=>{setAppLanguage('ko');});
  assert.equal(runtime.speeches.length,1,'newly translated questions are not spoken into the countdown');
  const hear=r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel?.endsWith(korean));assert.ok(hear);assert.equal(hear.props.disabled,true);
  await act(async()=>hear.props.onPress());assert.equal(runtime.speeches.length,1);
  runtime.onSpeechStop=()=>new Promise(done=>{finishStop=done;});
  await act(async()=>{t.mock.timers.tick(3000);});
  assert.equal(typeof finishStop,'function');assert.equal(runtime.captureStarts,0,'the microphone waits for native TTS to stop');
  await act(async()=>{finishStop();});
  assert.equal(runtime.captureStarts,1);assert.equal(runtime.speeches.length,1);
 }finally{runtime.onSpeechStop=null;if(r)await act(async()=>r.unmount());setAppLanguage('en');globalThis.fetch=old;t.mock.timers.reset();}
});

test('long translated questions scroll vertically and still permit horizontal question navigation',async()=>{
 const {setAppLanguage}=await import('../src/design/language.ts');
 const translated='이 결과를 발표의 결론과 연결하는 구체적인 근거를 설명해 주세요. '.repeat(10);
 setup([{...question(1),question:'What additional findings support this result?'},question(2)]);
 const old=globalThis.fetch;let r;
 globalThis.fetch=async(url,init)=>{
  assert.ok(url.endsWith('/localization/'));
  const request=JSON.parse(init.body);
  return Response.json({id:'7'.repeat(64),language:'ko',state:'completed',translations:Object.fromEntries(Object.keys(request.fields).map(key=>[key,key.endsWith('.question')?translated:'보충 설명']))});
 };
 try{
  setAppLanguage('ko');
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const scroll=()=>r.root.findByType('scroll');
  const content=()=>scroll().findAllByType('view').find(n=>typeof n.props.onLayout==='function');
  assert.ok(scroll().findAllByType('text').some(t=>String(t.props.children).includes(translated)&&!t.props.numberOfLines));
  await act(async()=>content().props.onLayout({nativeEvent:{layout:{height:1100}}}));
  await act(async()=>content().props.onLayout({nativeEvent:{layout:{height:800}}}));
  assert.equal(scroll().props.scrollEnabled,true,'long translated chat scrolls when the compact text reaches its minimum scale');
  const gesture=r.root.findByType(PanView).props;
  const e={nativeEvent:{pageX:90,pageY:305}},swipe={dx:-90,dy:5};
  await act(async()=>scroll().props.onScroll({nativeEvent:{contentOffset:{y:100}}}));
  assert.equal(gesture.onMoveShouldCapture(e,{dx:0,dy:20}),false,'the scrolled text can be read without leaving the question');
  assert.equal(gesture.onMoveShould(e,swipe),true);
  await act(async()=>{gesture.onMove(e,swipe);gesture.onRelease(e,swipe);});
  assert.deepEqual(runtime.routes,[]);
  assert.ok(r.root.findAllByType('text').some(t=>String(t.props.children).startsWith('질문 2 / 2')));
 }finally{if(r)await act(async()=>r.unmount());setAppLanguage('en');globalThis.fetch=old;}
});

test('an unprepared question is never displayed or spoken in the wrong language and becomes answerable on sync', async () => {
 const {setAppLanguage}=await import('../src/design/language.ts');
 const {displayTranslations}=await import('../src/features/localization/useDisplayTranslation.ts');
 const saved=setup([{...question(1),question:'What explains the different outcomes?'}]);
 const old=globalThis.fetch,requests=[];let r;
 globalThis.fetch=async(url,init)=>{
  requests.push([String(url),JSON.parse(init.body)]);
  return Response.json({id:'8'.repeat(64),language:'ko',state:'failed',translations:{}});
 };
 try{
  setAppLanguage('ko');
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const tree=JSON.stringify(r.toJSON());
  assert.doesNotMatch(tree,/What explains the different outcomes|번역 다시 시도/);
  assert.match(tree,/한국어 질문 동기화 대기 중/);
  const hear=button(r,'질문 듣기: 한국어 질문 동기화 대기 중');
  assert.equal(hear.props.disabled,true);await act(async()=>hear.props.onPress());
  const record=button(r,'질문 답변');assert.equal(record.props.disabled,true);
  await act(async()=>record.props.onPress());
  assert.equal(runtime.speeches.length,0);assert.equal(runtime.captureStarts,0);
  assert.equal(requests.length,1);
  const [url,request]=requests[0];assert.ok(url.endsWith('/localization/'));
  assert.equal(request.resource_id,String(saved.jobId));assert.equal(request.retry,undefined);
  const localized=Object.fromEntries(Object.entries(request.fields).map(([path,source])=>
   [path,{source,en:source,ko:path.endsWith('.question')?'결과가 왜 달라졌나요?':'근거는 무엇인가요?'}]));
  await act(async()=>displayTranslations.install(request,localized,'ko'));
  assert.equal(runtime.speeches.at(-1).text,'결과가 왜 달라졌나요?');
  assert.equal(runtime.speeches.at(-1).options.language,'ko');
  assert.equal(!!button(r,'질문 답변').props.disabled,false);
  assert.deepEqual(readQaV2(API_URL,'runtime-deck',saved.jobId).questions,saved.questions);
 }finally{if(r)await act(async()=>r.unmount());setAppLanguage('en');globalThis.fetch=old;}
});

test('a Korean source question and English follow-up both speak in selected English while the saved answer stays bound',async()=>{
 const first={...question(1),question:'근거는 무엇인가요?',follow_up:'How would you test that conclusion?'};
 const cached=setup([first]),old=globalThis.fetch,requests=[];
 const answer={audioUri:'file:///unused-synthetic-answer.m4a',durationMs:20000,status:'done',at:'2026-01-01T00:00:00Z',
  result:{verdict:'answered',did:'You answered directly',evidence:'The example was relevant',clarify:'Add one detail',transcript:{text:'',words:[]},duration_ms:20000}};
 saveQaV2(API_URL,'runtime-deck',cached.jobId,{...cached,answers:{'0-0':answer}});let r;
 globalThis.fetch=async(url,init)=>{requests.push(String(url));const request=JSON.parse(init.body);
  return Response.json({id:'2'.repeat(64),language:'en',state:'completed',translations:Object.fromEntries(Object.entries(request.fields).map(([k,v])=>[k,k.endsWith('.question')?'What is the evidence?':v]))});};
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  assert.equal(runtime.speeches.length,0,'an already answered question is not automatically replayed');
  // OpenAI Codex, Iteration 4 (2026-11-21): the follow-up button opens its own question page.
  await act(async()=>button(r,'Open follow-up page').props.onPress());
  assert.ok(r.root.findAllByType('text').some(node=>node.children.join('')==='Follow-up'));
  assert.ok(button(r,'Stop the follow-up: '+first.follow_up));
  assert.equal(runtime.speeches.at(-1).text,first.follow_up);
  assert.equal(runtime.speeches.at(-1).options.language,'en');
  await act(async()=>button(r,'Answer review').props.onPress());
  assert.ok(button(r,'Open follow-up page'));
  assert.deepEqual(runtime.routes,[],'closing the follow-up page returns to its answer result');
  await act(async()=>button(r,'Open follow-up page').props.onPress());
  const pan=r.root.findByType(PanView);
  runtime.deferTimings=true;
  await act(async()=>{
   pan.props.onMoveShouldCapture({nativeEvent:{pageY:200}},{dx:0,dy:60});
   pan.props.onMove({}, {dx:0,dy:60});
   assert.ok(flattenStyle(r.root.findByType(Surface).parent.props.style).opacity<1);
   pan.props.onRelease({}, {dx:0,dy:60});
  });
  await act(async()=>runtime.finishTimings());
  assert.equal(flattenStyle(r.root.findByType(Surface).parent.props.style).opacity,1,'a short pull fades back to Follow-up');
  await act(async()=>{
   assert.equal(pan.props.onMoveShouldCapture({nativeEvent:{pageY:200}},{dx:0,dy:140}),true);
   pan.props.onMove({}, {dx:0,dy:140});
   assert.ok(flattenStyle(r.root.findByType(Surface).parent.props.style).opacity<1,'the follow-up fades with the pull');
   assert.equal(r.root.findAllByProps({testID:'qa-followup-fade-backdrop'}).length,1,'Q&A covers Review throughout the fade');
   pan.props.onRelease({}, {dx:0,dy:140});
  });
  assert.deepEqual([...runtime.timings].map(t=>t.options.duration),[150],'the follow-up fades out before the answer result replaces it');
  await act(async()=>runtime.finishTimings());
  assert.equal(r.root.findAllByProps({testID:'qa-followup-fade-backdrop'}).length,1,'the backdrop remains for the answer-result fade in');
  assert.deepEqual([...runtime.timings].map(t=>t.options.duration),[180],'the answer result fades in after its React commit');
  await act(async()=>runtime.finishTimings());
  assert.equal(r.root.findAllByProps({testID:'qa-followup-fade-backdrop'}).length,0);
  assert.equal(flattenStyle(r.root.findByType(Surface).parent.props.style).opacity,1);
  assert.ok(button(r,'Open follow-up page'),'the swipe returns to the answer result');
  assert.deepEqual(runtime.routes,[]);
  assert.deepEqual(readQaV2(API_URL,'runtime-deck',cached.jobId).answers['0-0'],answer);
  assert.ok(requests.every(url=>url.endsWith('/localization/')));
 }finally{runtime.deferTimings=false;runtime.finishTimings();if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
});

test('switching phone-only Q&A history translates its actual saved question and answer while playback keeps the original media',async()=>{
 const {saveQa,readQa}=await import('../src/features/qa/store.ts');
 const {setAppLanguage}=await import('../src/design/language.ts');
 const qs=[{...question(19),panelist:'도시 주민',question:'AI와 PDF의 차이를 설명해 주세요.',follow_up:'시장 규모는 얼마인가요?'}];
 const answer={audioUri:'file:///private-synthetic-saved-answer.wav',durationMs:15000,at:'2026-01-01T00:00:00Z',status:'done',
  result:{verdict:'answered',did:'기능을 비교했어요.',evidence:'시장 자료를 제시했어요.',clarify:'시장 규모를 더 설명해 주세요.',transcript:{text:'원래 답변',words:[{text:'원래 답변',start_ms:110,end_ms:1200}]},duration_ms:15000}};
 const saved={runId:'local-older-run',audience:'Audience',createdAt:'2025-06-01',questions:qs,answers:{'0-0':answer}};
 setup();saveQa('runtime-deck',saved);
 const old=globalThis.fetch,calls=[];let r;
 globalThis.fetch=async(url,init)=>{const req=JSON.parse(init.body);calls.push([String(url),req]);
  return Response.json({id:'3'.repeat(64),language:'en',state:'completed',source_languages:Object.fromEntries(Object.keys(req.fields).map(k=>[k,'ko'])),translations:Object.fromEntries(Object.entries(req.fields).map(([k,v])=>[k,k.endsWith('.panelist')?'City resident':k.endsWith('.question')?'What distinguishes AI from PDF?':k.endsWith('.clarify')?'Explain the size of the market.':k.endsWith('.did')?'You compared the features.':k.endsWith('.evidence')?'You cited the market figures.':k.endsWith('.follow_up')?'How large is the market?':v]))});};
 try{
  setAppLanguage('en');await act(async()=>{r=create(React.createElement(QAScreen));});
  await act(async()=>button(r,'View saved Q&A').props.onPress());
  assert.ok(calls.length);assert.ok(calls.every(([url,q])=>url.endsWith('/localization/')&&q.kind==='legacy_qa'&&q.resource_id===saved.runId));
  assert.ok(button(r,'Open follow-up page'));
  assert.match(JSON.stringify(r.toJSON()),/Explain the size of the market/);
  await act(async()=>button(r,'Open answer transcript').props.onPress());
  assert.match(JSON.stringify(r.toJSON()),/What distinguishes AI from PDF/);
  assert.match(JSON.stringify(r.toJSON()),/원래 답변/);
  assert.match(JSON.stringify(r.toJSON()),/You compared the features/);
  assert.match(JSON.stringify(r.toJSON()),/You cited the market figures/);
  await act(async()=>button(r,'Play your recorded answer').props.onPress());
  let offlineCalls=0;globalThis.fetch=async()=>{offlineCalls++;throw Error('offline');};
  await act(async()=>setAppLanguage('ko'));
  assert.match(JSON.stringify(r.toJSON()),/AI와 PDF의 차이를 설명해 주세요/);
  assert.match(JSON.stringify(r.toJSON()),/기능을 비교했어요/);
  await act(async()=>button(r,'내 답변 녹음 재생').props.onPress());
  await act(async()=>setAppLanguage('en'));
  assert.match(JSON.stringify(r.toJSON()),/What distinguishes AI from PDF/);
  assert.match(JSON.stringify(r.toJSON()),/You compared the features/);
  const clip=['a0-0',{uri:answer.audioUri,startMs:0,endMs:answer.durationMs}];
  assert.deepEqual(runtime.plays,[clip,clip]);assert.equal(offlineCalls,0);
  assert.deepEqual(readQa('runtime-deck'),saved);
  assert.ok(calls.every(([,q])=>!JSON.stringify(q).includes(answer.audioUri)&&!JSON.stringify(q).includes('원래 답변')));
 }finally{if(r)await act(async()=>r.unmount());setAppLanguage('en');globalThis.fetch=old;}
});

test('Hear toggles off and question navigation, Back and unmount still stop speech',async()=>{
 const cached=setup();let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  assert.ok(button(r,'Stop the question: '+cached.questions[0].question));
  let stops=runtime.speechStops;
  await act(async()=>button(r,'Stop the question: '+cached.questions[0].question).props.onPress());
  assert.equal(runtime.speechStops,stops+1);assert.equal(runtime.speeches.length,1);
  await act(async()=>button(r,'Hear the question: '+cached.questions[0].question).props.onPress());
  stops=runtime.speechStops;
  await act(async()=>button(r,'Next').props.onPress());
  assert.equal(runtime.speechStops,stops+2,'Next stops the old question before starting the new one');
  assert.ok(button(r,'Stop the question: '+cached.questions[1].question));
  stops=runtime.speechStops;
  await act(async()=>button(r,'Back').props.onPress());
  assert.equal(runtime.speechStops,stops+1);assert.equal(runtime.routes.at(-1)[0],'review');
  stops=runtime.speechStops;
  await act(async()=>r.unmount());r=null;
  assert.equal(runtime.speechStops,stops+1);
 }finally{if(r)await act(async()=>r.unmount());}
});

test('Scribe consent Cancel keeps a saved answer and Continue submits that same identity once',async()=>{
 const cached=setup();
 const {writeStored}=await import('../src/services/storage.ts');
 const {files}=await import('./helpers/upload-native.mjs');
 const answer={id:'11111111-1111-4111-8111-111111111111',questionId:cached.questions[0].id,questionJobId:cached.jobId,audioUri:'file:///scribe-answer.m4a',durationMs:20000,status:'error',error:'Retry saved answer',at:'2026-10-17T00:00:00Z'};
 saveQaV2(API_URL,'runtime-deck',cached.jobId,{...cached,answers:{'0-0':answer}});
 writeStored('analysis-consent:elevenlabs:scribe-v2:keyterms:v2',false);
 files.set(answer.audioUri,{data:'Synthetic audio'});
 const {saveReview}=await import('../src/features/transcription/reviewStorage.ts');
 const {wireResult,attemptId}=await import('./helpers/review-fixtures.mjs');
 globalThis.qaScreenValue.state.attempt_id=attemptId;
 saveReview(API_URL,wireResult({audio_url:API_URL.replace(/\/api\/?$/,'')+'/recordings/synthetic.wav'}));
 const old=fetch,requests=[];let bound=false,r;
 const result={verdict:'answered',did:'Direct answer',evidence:'Relevant example',clarify:'One detail',transcript:{text:'Um, original answer',words:[]},duration_ms:20000};
 globalThis.fetch=async(url,init={})=>{
  requests.push({url,method:init.method??'GET'});
  if(url.endsWith('/attempts/')){assert.equal(JSON.parse(init.body.get('metadata')).id,answer.id);return new Response(JSON.stringify({attempt_id:answer.id}),{status:201});}
  if(init.method==='POST')bound=true;
  const state={attempt_id:answer.id,question_job_id:cached.jobId,question_id:answer.questionId,part:0,processing:{status:'completed',processing_revision:1},feedback:{state:'completed'},result};
  return new Response(JSON.stringify(state),{status:bound?200:404});
 };
 const byText=text=>r.root.findAllByType('pressable').find(n=>n.findAllByType('text').some(t=>t.children.join('').includes(text)));
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  await act(async()=>byText('Couldn’t review this answer').props.onPress());
  assert.ok(byText('Continue'),JSON.stringify({requests,saved:readQaV2(API_URL,'runtime-deck',cached.jobId).answers,text:r.root.findAllByType('text').map(n=>n.children.join(''))}));assert.ok(requests.every(q=>q.method==='GET'));
  await act(async()=>byText('Cancel').props.onPress());
  assert.equal(readQaV2(API_URL,'runtime-deck',cached.jobId).answers['0-0'].id,answer.id);
  assert.ok(files.has(answer.audioUri));assert.ok(requests.every(q=>q.method==='GET'));
  await act(async()=>byText('Couldn’t review this answer').props.onPress());
  await act(async()=>byText('Continue').props.onPress());
  assert.equal(requests.filter(q=>q.url.endsWith('/attempts/')&&q.method==='POST').length,1);
  const saved=readQaV2(API_URL,'runtime-deck',cached.jobId).answers['0-0'];
  assert.equal(saved.id,answer.id);assert.equal(saved.status,'done');assert.deepEqual(saved.result,result);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;files.clear();delete globalThis.qaReviews;}
});

// Claude, 2026-11-21: S15 question page — team names only, the question as a chat message, its slide, and a fixed answer space.
test('the panel uses only the four team names and the question page keeps a fixed space for the answer',async()=>{
 const questions=[question(1),question(2),question(3)].map(q=>({...q,panelist:'Audience 1'}));const cached=setup(questions);let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const shown=[...audienceNames(questions,cached.jobId).values()];
  assert.equal(new Set(shown).size,3);for(const name of shown)assert.ok(AUDIENCE_NAMES.includes(name),name);
  const text=JSON.stringify(r.toJSON());
  assert.ok(text.includes(`${shown[0]} · after slide 1`));assert.doesNotMatch(text,/Audience 1/);
  assert.ok(text.includes(`"${shown[0].slice(0,2)}"`),'the panel shows two-letter initials');
  assert.match(text,/Your answer/);assert.match(text,/Tap the mic and answer out loud/);
  assert.match(text,/"Slide 1( · [^"]*)?"/,'the slide the question came from sits under the question');
  // OpenAI Codex, Iteration 2 (2026-11-21): repeated server labels still produce distinct people per question.
  const duplicateLabels=[{panelist:'A'},{panelist:'A'},{panelist:'A'}];
  const assigned=[...audienceNames(duplicateLabels,5).values()];
  assert.equal(new Set(assigned).size,3);
  assert.deepEqual(assigned,[...audienceNames(duplicateLabels,5).values()],'a saved set keeps its assigned names');
 }finally{if(r)await act(async()=>r.unmount());}
});

// OpenAI Codex, 2026-11-21, Iteration 2: long chat text stays within its box before scrolling at the 72% floor.
test('a long question remeasures after shrinking and scrolls only at the 72% minimum',async()=>{
 const long='Why does this evidence support the conclusion? '.repeat(12);setup([{...question(1),question:long}]);let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const content=()=>r.root.findAllByType('view').find(node=>typeof node.props.onLayout==='function');
  const chat=()=>r.root.findAllByType('scroll').find(node=>node.props.overScrollMode==='never');
  assert.ok(content());assert.ok(chat());
  await act(async()=>content().props.onLayout({nativeEvent:{layout:{height:400}}}));
  assert.equal(chat().props.scrollEnabled,false);
  await act(async()=>content().props.onLayout({nativeEvent:{layout:{height:330}}}));
  assert.equal(chat().props.scrollEnabled,false,'an extra shrink takes precedence over scrolling');
  await act(async()=>content().props.onLayout({nativeEvent:{layout:{height:310}}}));
  assert.equal(chat().props.scrollEnabled,false);
  await act(async()=>content().props.onLayout({nativeEvent:{layout:{height:600}}}));
  assert.equal(chat().props.scrollEnabled,false,'the minimum scale is measured before enabling scroll');
  await act(async()=>content().props.onLayout({nativeEvent:{layout:{height:400}}}));
  assert.equal(chat().props.scrollEnabled,true,'overflow scrolls only after reaching the minimum scale');
 }finally{if(r)await act(async()=>r.unmount());}
});

// OpenAI Codex, Iteration 2 (2026-11-21): the result returns to its question without leaving Q&A.
test('swiping down from an answer result quickly reveals its question and truncated transcript preview',async()=>{
 const cached=setup([{...question(1),panelist:'Same speaker'}]);
 const transcript='A detailed answer with many points. '.repeat(12);
 const answer={audioUri:'file:///synthetic-answer.m4a',durationMs:20000,status:'done',at:'2026-01-01T00:00:00Z',
  result:{verdict:'answered',did:'Direct answer',evidence:'Relevant example',clarify:'One detail',transcript:{text:transcript,words:[]},duration_ms:20000}};
 saveQaV2(API_URL,'runtime-deck',cached.jobId,{...cached,answers:{'0-0':answer}});let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  assert.ok(button(r,'Play your recorded answer'));
  const pan=r.root.findByType(PanView);
  const resultScroll=r.root.findAllByType('scroll').find(node=>node.props.contentContainerStyle);
  await act(async()=>resultScroll.props.onScroll({nativeEvent:{contentOffset:{y:90}}}));
  assert.equal(pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:0,dy:120}),false,'downward movement first scrolls a displaced result');
  await act(async()=>resultScroll.props.onScroll({nativeEvent:{contentOffset:{y:0}}}));
  runtime.deferTimings=true;
  await act(async()=>{
   assert.equal(pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:0,dy:180}),true);
   pan.props.onMove({}, {dx:0,dy:180});pan.props.onRelease({}, {dx:0,dy:180});
  });
  assert.deepEqual([...runtime.timings].map(t=>t.options.duration),[180]);
  assert.ok(button(r,'Play your recorded answer'),'the result remains mounted until its exit completes');
  await act(async()=>runtime.finishTimings());
  runtime.deferTimings=false;
  assert.deepEqual(runtime.routes,[],'the swipe stays inside Q&A');
  assert.equal(button(r,'Play your recorded answer'),undefined);
  assert.ok(button(r,'View answer review'));
  const preview=r.root.findAllByType('text').find(node=>node.props.ellipsizeMode==='tail'&&node.props.numberOfLines===3);
  assert.equal(preview.props.children,transcript.trim());
  assert.ok(r.root.findAllByType('text').some(node=>node.children.join('').includes(cached.questions[0].question)));
  await act(async()=>button(r,'View answer review').props.onPress());
  assert.ok(button(r,'Play your recorded answer'),'the saved result remains accessible');
  // OpenAI Codex, Iteration 4 (2026-11-21): transcript opens as a full page and returns to this result.
  assert.ok(button(r,'Open follow-up page'));
  await act(async()=>button(r,'Open answer transcript').props.onPress());
  assert.ok(r.root.findAllByType('text').some(node=>node.children.join('')==='Transcript'));
  const full=r.root.findAllByType('text').find(node=>node.children.join('')===transcript.trim()&&node.props.numberOfLines===undefined);
  assert.ok(full,'the transcript page keeps the whole answer');
  const transcriptScroll=r.root.findAllByType('scroll').find(node=>node.props.contentContainerStyle?.gap===18);
  await act(async()=>transcriptScroll.props.onScroll({nativeEvent:{contentOffset:{y:90}}}));
  assert.equal(pan.props.onMoveShouldCapture({nativeEvent:{pageY:200}},{dx:0,dy:150}),false);
  await act(async()=>transcriptScroll.props.onScroll({nativeEvent:{contentOffset:{y:0}}}));
  runtime.deferTimings=true;
  await act(async()=>{
   assert.equal(pan.props.onMoveShouldCapture({nativeEvent:{pageY:200}},{dx:0,dy:150}),true);
   pan.props.onMove({}, {dx:0,dy:150});pan.props.onRelease({}, {dx:0,dy:150});
  });
  assert.deepEqual([...runtime.timings].map(t=>t.options.duration),[180]);
  await act(async()=>runtime.finishTimings());
  runtime.deferTimings=false;
  assert.equal(button(r,'Answer review'),undefined);
  assert.ok(button(r,'Open answer transcript'));
  assert.deepEqual(runtime.routes,[],'transcript closes back to the same answer result');
  await act(async()=>button(r,'Open answer transcript').props.onPress());
  await act(async()=>{assert.equal(runtime.back(),true);});
  assert.ok(button(r,'Open answer transcript'),'Android Back from the transcript returns to its result');
  await act(async()=>{assert.equal(runtime.back(),true);});
  assert.ok(button(r,'View answer review'),'Android Back from the result returns to its question');
  assert.deepEqual(runtime.routes,[]);
 }finally{runtime.deferTimings=false;runtime.finishTimings();if(r)await act(async()=>r.unmount());}
});
