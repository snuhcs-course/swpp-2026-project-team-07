// Real RehearseScreen/CueGuidancePanel/theme/profile hook and cache, synthetic native/model boundaries.
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/recording-cues-runtime-loader.mjs';
import {descriptionState,deckId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
process.env.EXPO_PUBLIC_API_URL='http://recording-runtime.invalid/api';
const React=await import('react');const{act,create}=await import('react-test-renderer');
const{runtime}=await import('./helpers/recording-cues-runtime-native.mjs');
const{RehearseScreen}=await import('../src/screens/RehearseScreen.tsx');
const{ThemeProvider,useTheme}=await import('../src/design/theme.tsx');
const{writeStored,removeStored}=await import('../src/services/storage.ts');
const{parseProfileState}=await import('../src/features/presentations/slideProfiles.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame??=f=>setTimeout(f,0);globalThis.cancelAnimationFrame??=id=>clearTimeout(id);
const api='http://recording-runtime.invalid/api',fetchBefore=globalThis.fetch;
let requests=[],renderer=null,serial=0;
const text=r=>JSON.stringify(r.toJSON());
const button=(r,label)=>r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel===label);
const round=(r,label)=>r.root.findAllByType('round-button').find(n=>n.props.label===label);
function profiles(){const v=descriptionState();v.provenance.prompt_version='slide-profile-v5';v.provenance.schema_version='slide-profile-gemini-v5';
 for(const s of v.descriptions.slides)Object.assign(s,{slide_kind:'content',
 must_cover:[{text:s.slide_index?'Recap how the final result supports the main conclusion':'Explain how measured growth changes between the two conditions',evidence_refs:['summary']}],
 go_deeper:[{text:s.slide_index?'Connect the conclusion to another possible practical application':'Connect the measured change to a familiar practical example',kind:'connection',information_needed:'',evidence_refs:[{slide_index:s.slide_index,source_id:s.source_id,fact_ref:'summary',quote:s.summary.text}]}]});
 return parseProfileState(v,deckId,2);}
function setup({saved=true,slide=0,audio=true,state=profiles()}={}){
 const id='synthetic-recording-cues-'+ ++serial;
 const deck={id,title:'Synthetic cue fixture',hue:'blue',target:120,targets:[60,60],pageCount:2,slides:[{title:'Measured change',points:[],text:'Synthetic first slide'},{title:'Conclusion',points:[],text:'Synthetic second slide'}],pages:[]};
 const run=saved?{id:'selected-run',sel:0,parts:[{attemptId:'saved-take',segments:[{startMs:0,endMs:1000},{startMs:2000,endMs:3500}]},{attemptId:'saved-take',segments:[{startMs:1000,endMs:2000}]}]}:null;
 runtime.reset({deck,n:2,state:{run,takes:saved?2:0,compare:null,discarded:[]},stats:null},slide);if(audio)runtime.audio.set('saved-take','file:///synthetic-saved-take.m4a');
 requests=[];writeStored(`server-deck:${api}:${id}`,deckId);writeStored(`slide-profiles:v1:${encodeURIComponent(api)}:${deckId}`,state);removeStored('settings.theme');
 globalThis.fetch=async(url,options={})=>{requests.push({url,method:options.method??'GET'});assert.equal(options.method??'GET','GET','screen lifecycle must not admit provider work');return new Response(JSON.stringify(state));};}
function ThemeToggle(){const t=useTheme();return React.createElement('theme-toggle',{onPress:t.toggle});}
async function mount(active=true){await act(async()=>{renderer=create(React.createElement(ThemeProvider,null,React.createElement(ThemeToggle),React.createElement(RehearseScreen,{active})));});return renderer;}
async function tap(n){assert.ok(n,'expected accessible control');await act(async()=>n.props.onPress());}
async function navigate(r,direction){await tap(r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel?.startsWith(direction+' slide,')));}
function assertFirst(r){assert.match(text(r),/Cues/);assert.match(text(r),/Must Cover/);assert.match(text(r),/Further Insight/);assert.match(text(r),/Explain how measured growth/);assert.match(text(r),/Connect the measured change/);assert.equal(r.root.findAllByType('scroll').length,1);assert.equal(r.root.findAllByProps({accessibilityRole:'tab'}).length,0);}
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;globalThis.fetch=fetchBefore;});

test('normal recording screen preserves both saved cue categories and repeated-visit Play/Pause across forward/backward navigation',async()=>{
 setup();const r=await mount();assertFirst(r);assert.doesNotMatch(text(r),/Transcript & corrections|Show cues|Hide cues/);
 await tap(button(r,'Play slide 1 recording'));
 assert.deepEqual(runtime.played,[{key:`slide:${runtime.model.deck.id}:0`,segments:[{uri:'file:///synthetic-saved-take.m4a',startMs:0,endMs:1000},{uri:'file:///synthetic-saved-take.m4a',startMs:2000,endMs:3500}]}]);
 assert.ok(button(r,'Pause slide 1 recording'));await tap(button(r,'Pause slide 1 recording'));assert.ok(button(r,'Play slide 1 recording'));
 await navigate(r,'Next');assert.match(text(r),/Recap how the final result/);assert.match(text(r),/Connect the conclusion/);assert.doesNotMatch(text(r),/Explain how measured growth/);assert.ok(button(r,'Play slide 2 recording'));
 await navigate(r,'Previous');assertFirst(r);assert.equal(requests.length,1);assert.ok(requests.every(r=>r.method==='GET'));
});

test('countdown/capture keep Cues visible, disable Play and update both slide directions against capture',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:0});setup();const r=await mount();assertFirst(r);assert.equal(button(r,'Play slide 1 recording').props.disabled,false);
 await tap(r.root.findByType('record-button'));
 await act(async()=>r.root.findByType('dialog').props.onConfirm());
 assert.match(r.root.findByType('record-button').props.label,/Starting in/);assertFirst(r);assert.equal(button(r,'Play slide 1 recording').props.disabled,true);assert.equal(!!button(r,'Edit presentation time and audience'),false);assert.doesNotMatch(text(r),/Edit time & audience/);
 await act(async()=>{t.mock.timers.tick(3000);await Promise.resolve();});assert.equal(r.root.findByType('record-button').props.label,'Stop recording');assertFirst(r);assert.equal(runtime.captures[0].started,1);assert.equal(button(r,'Play slide 1 recording').props.disabled,true);assert.equal(!!button(r,'Edit presentation time and audience'),false);assert.doesNotMatch(text(r),/Edit time & audience/);
 await navigate(r,'Next');assert.match(text(r),/Recap how the final result/);await navigate(r,'Previous');assertFirst(r);assert.deepEqual(runtime.captures[0].slides,[0,1,0]);assert.equal(requests.length,1);
});

test('rotation removes Cues and Play from accessibility/interactions, retains PDF navigation and restores the selected slide',async()=>{
 setup();const r=await mount();await tap(round(r,'Rotate only the PDF for a bigger view'));
 assert.equal(r.root.findAllByType('scroll').length,0);assert.equal(r.root.findAllByType('pressable').filter(n=>/^(Play|Pause) slide/.test(n.props.accessibilityLabel??'')).length,0);assert.doesNotMatch(text(r),/Must Cover|Further Insight|Explain how measured growth/);assert.ok(r.root.findByType('record-button'));
 await navigate(r,'Next');assert.match(text(r),/Slide 2 of 2/);await tap(round(r,'Return the PDF to normal view'));assert.match(text(r),/Recap how the final result/);assert.match(text(r),/Connect the conclusion/);assert.ok(button(r,'Play slide 2 recording'));await navigate(r,'Previous');assertFirst(r);assert.equal(requests.length,1);
});

test('theme changes and reopening retain selected-slide cues without generating; missing audio stays explicit',async()=>{
 setup({slide:1,audio:false});const r=await mount();assert.match(text(r),/Recap how the final result/);assert.equal(button(r,'Play slide 2 recording').props.disabled,true);assert.match(text(r),/Audio for this slide isn’t on this phone/);
 const cue=()=>r.root.findAllByType('text').find(n=>n.props.children==='Recap how the final result supports the main conclusion');const dark=JSON.stringify(cue().props.style);
 await tap(r.root.findByType('theme-toggle'));assert.notEqual(JSON.stringify(cue().props.style),dark);assert.match(text(r),/Recap how the final result/);assert.equal(requests.length,1);
 await act(async()=>r.unmount());renderer=null;const reopened=await mount();assert.match(text(reopened),/Recap how the final result/);assert.ok(button(reopened,'Play slide 2 recording'));assert.equal(requests.length,2);assert.ok(requests.every(r=>r.method==='GET'));
});

test('interrupted recovery preserves the current slide cues through the existing recovery interface',async()=>{
 setup({slide:1});const recovered={id:'interrupted-take',state:'interrupted',recording:{duration_ms:3000,slide_events:[{slide_index:1,at_ms:0}]}};runtime.recoveries.push(recovered);const r=await mount();
 await tap(r.root.findAllByType('text').find(n=>n.props.accessibilityLabel==='Open interrupted recording for recovery'));assert.equal(r.root.findByType('take-playback').props.initialSlide,1);assert.match(text(r),/Recap how the final result/);
 await act(async()=>r.root.findByType('take-playback').props.onRecovered(recovered));assert.equal(r.root.findAllByType('take-playback').length,0);assert.match(text(r),/Slide 2 of 2/);assert.match(text(r),/Recap how the final result/);assert.deepEqual(runtime.routes[0],['review',{nav:'fade',deckId:runtime.model.deck.id,sel:1,slide:1,from:null}]);assert.equal(requests.length,1);
});
test('existing presentation opens the shared setup without changing the selected slide or cue set',async()=>{
 setup({slide:1});const r=await mount();const edit=button(r,'Edit presentation time and audience');assert.ok(edit);assert.equal(edit.findByType('text').props.children,'Edit time & audience');assert.ok(edit.findByType('text').props.style.color);await tap(edit);assert.ok(button(r,'Other audience'));assert.match(text(r),/Slide 2 of 2/);assert.ok(runtime.stops>0);assert.equal(requests.filter(q=>q.method==='POST').length,0);
});

test('Review opens the currently selected slide while automatic completion keeps its own initial review',async()=>{setup({slide:1});const r=await mount();const control=round(r,'Review current slide');assert.ok(control);await tap(control);assert.deepEqual(runtime.routes.at(-1),['review',{nav:'rise',deckId:runtime.model.deck.id,sel:1,slide:1,from:null}]);assert.equal(requests.length,1);});

test('covered rehearsal does not expose the edit requirements action',async()=>{setup();const r=await mount(false);assert.equal(!!button(r,'Edit presentation time and audience'),false);assert.doesNotMatch(text(r),/Edit time & audience/);});


test('covered rehearsal stops cue reconnects and reopening reads immediately without generation',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});setup();let reads=0;
 globalThis.fetch=async(_url,init)=>{assert.equal(init.method,'GET');reads++;throw Error('offline');};
 try{
  const r=await mount();assert.equal(reads,1);
  const screen=active=>React.createElement(ThemeProvider,null,React.createElement(ThemeToggle),React.createElement(RehearseScreen,{active}));
  await act(async()=>r.update(screen(false)));await act(async()=>t.mock.timers.tick(10000));assert.equal(reads,1);
  await act(async()=>r.update(screen(true)));assert.equal(reads,2);
 }finally{if(renderer)await act(async()=>renderer.unmount());renderer=null;t.mock.timers.reset();}
});


test('first saved recording Review opens Full Review repeatedly; a later take opens the current slide',async()=>{
 setup({slide:1});runtime.model.state.takes=1;const r=await mount();
 await tap(round(r,'Review full presentation'));assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].from,'rehearse');
 await tap(round(r,'Review full presentation'));assert.equal(runtime.routes.at(-1)[0],'full');
 await act(async()=>r.unmount());renderer=null;await mount();await tap(round(renderer,'Review full presentation'));assert.equal(runtime.routes.at(-1)[0],'full');
 await act(async()=>{runtime.model.state.takes=2;runtime.emit();});await tap(round(renderer,'Review current slide'));assert.equal(runtime.routes.at(-1)[0],'review');assert.equal(runtime.routes.at(-1)[1].sel,1);
});
test('stopping a first partial recording opens Full Review without analysis',async t=>{
 t.mock.timers.enable({apis:['setInterval','Date']});setup();runtime.model.state={...runtime.model.state,takes:0,run:null};const r=await mount();
 try{
  await tap(r.root.findByType('record-button'));await act(async()=>t.mock.timers.tick(3000));assert.equal(runtime.captures[0].started,1);
  await tap(r.root.findByType('record-button'));assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].from,'rehearse');
 }finally{if(renderer)await act(async()=>renderer.unmount());renderer=null;t.mock.timers.reset();}
});


test('a later recording automatically opens its slide review using the post-save count',async t=>{
 t.mock.timers.enable({apis:['setInterval','Date']});setup({slide:1});runtime.model.state.takes=1;const r=await mount();
 try{
  await tap(r.root.findByType('record-button'));await act(async()=>r.root.findByType('dialog').props.onConfirm());
  await act(async()=>t.mock.timers.tick(3000));await tap(r.root.findByType('record-button'));
  assert.equal(runtime.routes.at(-1)[0],'review');assert.equal(runtime.routes.at(-1)[1].sel,1);assert.equal(runtime.model.state.takes,2);
 }finally{if(renderer)await act(async()=>renderer.unmount());renderer=null;t.mock.timers.reset();}
});
test('recovering the first interrupted recording opens Full Review without waiting for analysis',async()=>{
 setup({saved:false,slide:1});const a={id:'first-recovery',state:'interrupted',recording:{duration_ms:3000,slide_events:[{slide_index:1,at_ms:0}]}};runtime.recoveries.push(a);const r=await mount();
 await tap(r.root.findAllByType('text').find(n=>n.props.accessibilityLabel==='Open interrupted recording for recovery'));
 await act(async()=>r.root.findByType('take-playback').props.onRecovered(a));assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].sel,1);
});


test('reopening a saved pending comparison carries the candidate review slide',async()=>{
 setup();runtime.model.state.compare={slides:[1],next:{sel:1}};await mount();assert.equal(runtime.routes[0][0],'compare');assert.equal(runtime.routes[0][1].sel,1);
});
