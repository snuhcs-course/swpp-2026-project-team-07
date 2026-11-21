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
const question=i=>({id:String(i).padStart(32,'a'),panelist:'Audience '+i,role:'Student',slide_index:i-1,topic:'Synthetic topic '+i,question:'Synthetic question '+i,follow_up:'Synthetic follow-up '+i});
function setup(questions=[1,2,3].map(question)){
 runtime.routes=[];runtime.mounts=0;runtime.unmounts=0;runtime.speeches=[];runtime.speechStops=0;runtime.playerStops=0;
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

test('Q&A horizontal gesture still changes questions with Reduce Motion',async()=>{
 setup();runtime.reducedMotion=true;let r;
 try{
  await act(async()=>{r=create(React.createElement(QAScreen));});
  const pan=r.root.findByType(PanView);
  await act(async()=>{pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:-90,dy:0});pan.props.onMove({}, {dx:-90,dy:0});pan.props.onRelease({}, {dx:-90,dy:0});});
  assertPageVisible(r,2);
 }finally{runtime.reducedMotion=false;if(r)await act(async()=>r.unmount());}
});

test('question Hear selects English or Korean from its own text and retains fallback for other scripts',async()=>{
 for(const [text,language]of [
  ['How does the PDF support your conclusion?','en'],
  ['이 결과를 어떻게 설명하나요?','ko'],
  ['AI와 PDF의 차이는 무엇인가요?','ko'],
  ['한글'.normalize('NFD'),'ko'],
  ['123 — ?!',undefined],
  ['結果を説明してください。',undefined],
 ]){
  setup([{...question(1),question:text}]);let r;
  try{
   await act(async()=>{r=create(React.createElement(QAScreen));});
   assert.ok(button(r,'Stop the question: '+text),'automatic speech exposes its Stop control');
   assert.equal(runtime.speeches.length,1);assert.equal(runtime.speeches[0].text,text);
   assert.equal(runtime.speeches[0].options.language,language,text);
   const stops=runtime.speechStops;await act(async()=>button(r,'Stop the question: '+text).props.onPress());
   assert.equal(runtime.speechStops,stops+1);assert.equal(runtime.speeches.length,1);
   await act(async()=>button(r,'Hear the question: '+text).props.onPress());assert.equal(runtime.speeches.length,2);assert.equal(runtime.speeches.at(-1).options.language,language);
  }finally{if(r)await act(async()=>r.unmount());}
 }
});

test('follow-up Hear selects its language independently from the main question',async()=>{
 const first={...question(1),question:'근거는 무엇인가요?',follow_up:'How would you test that conclusion?'};
 const cached=setup([first]);
 const answer={audioUri:'file:///unused-synthetic-answer.m4a',durationMs:20000,status:'done',at:'2026-01-01T00:00:00Z',
  result:{verdict:'answered',did:'Direct answer',evidence:'Relevant example',clarify:'One detail',transcript:{text:'',words:[]},duration_ms:20000}};
 saveQaV2(API_URL,'runtime-deck',cached.jobId,{...cached,answers:{'0-0':answer}});let r;
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
  assert.equal(runtime.timings.size,1,'the follow-up finishes fading out before the answer result replaces it');
  await act(async()=>runtime.finishTimings());
  assert.equal(r.root.findAllByProps({testID:'qa-followup-fade-backdrop'}).length,1,'the backdrop remains for the answer-result fade in');
  assert.equal(runtime.timings.size,1,'the answer result fades in after its React commit');
  await act(async()=>runtime.finishTimings());
  assert.equal(r.root.findAllByProps({testID:'qa-followup-fade-backdrop'}).length,0);
  assert.equal(flattenStyle(r.root.findByType(Surface).parent.props.style).opacity,1);
  assert.ok(button(r,'Open follow-up page'),'the swipe returns to the answer result');
  assert.deepEqual(runtime.routes,[]);
 }finally{runtime.deferTimings=false;runtime.finishTimings();if(r)await act(async()=>r.unmount());}
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
test('swiping down from an answer result reveals its question and a truncated transcript preview',async()=>{
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
  await act(async()=>{
   assert.equal(pan.props.onMoveShould({nativeEvent:{pageY:200}},{dx:0,dy:180}),true);
   pan.props.onMove({}, {dx:0,dy:180});pan.props.onRelease({}, {dx:0,dy:180});
  });
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
  await act(async()=>{
   assert.equal(pan.props.onMoveShouldCapture({nativeEvent:{pageY:200}},{dx:0,dy:150}),true);
   pan.props.onMove({}, {dx:0,dy:150});pan.props.onRelease({}, {dx:0,dy:150});
  });
  assert.equal(button(r,'Answer review'),undefined);
  assert.ok(button(r,'Open answer transcript'));
  assert.deepEqual(runtime.routes,[],'transcript closes back to the same answer result');
 }finally{if(r)await act(async()=>r.unmount());}
});
