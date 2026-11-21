// Real RehearseScreen/CueGuidancePanel/theme/profile hook and cache, synthetic native/model boundaries.
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/recording-cues-runtime-loader.mjs';
import {descriptionState,deckId} from './helpers/feedback-fixtures.mjs';
registerHooks({resolve,load});
process.env.EXPO_PUBLIC_API_URL='http://recording-runtime.invalid/api';
const React=await import('react');const{act,create}=await import('react-test-renderer');
const{runtime,setupNative}=await import('./helpers/recording-cues-runtime-native.mjs');
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
 runtime.reset({deck,n:2,state:{run,takes:saved?2:0,compare:null,discarded:[]},times:saved?[2.5,1]:[0,0],total:saved?3.5:0,stats:null},slide);if(audio)runtime.audio.set('saved-take','file:///synthetic-saved-take.m4a');
 requests=[];writeStored(`server-deck:${api}:${id}`,deckId);writeStored(`slide-profiles:v1:${encodeURIComponent(api)}:${deckId}`,state);removeStored('settings.theme');
 globalThis.fetch=async(url,options={})=>{requests.push({url,method:options.method??'GET'});assert.equal(options.method??'GET','GET','screen lifecycle must not admit provider work');return new Response(JSON.stringify(state));};}
function ThemeToggle(){const t=useTheme();return React.createElement('theme-toggle',{onPress:t.toggle});}
async function mount(active=true){await act(async()=>{renderer=create(React.createElement(ThemeProvider,null,React.createElement(ThemeToggle),React.createElement(RehearseScreen,{active})));});return renderer;}
async function tap(n){assert.ok(n,'expected accessible control');await act(async()=>n.props.onPress());}
async function navigate(r,direction){await tap(r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel===direction+' slide'||n.props.accessibilityLabel?.startsWith(direction+' slide,')));}
function assertFirst(r){assert.match(text(r),/CUES/);assert.match(text(r),/Must cover/);assert.match(text(r),/Further insight/);assert.match(text(r),/Explain how measured growth/);assert.match(text(r),/Connect the measured change/);assert.equal(r.root.findAllByType('scroll').length,0);assert.equal(r.root.findAllByProps({accessibilityRole:'tab'}).length,0);}
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;globalThis.fetch=fetchBefore;setupNative.frame={top:0,left:0,s:1,width:390,height:844};});

// OpenAI Codex, 2026-11-21: confirm the portrait server refresh before checking cues.
test('portrait refresh checks server cues while forward/backward slide navigation retains both categories',async()=>{
 setup();const r=await mount();assertFirst(r);assert.doesNotMatch(text(r),/Transcript & corrections|Show cues|Hide cues/);
 const refresh=button(r,'Refresh with server');assert.ok(refresh);assert.equal(refresh.findByType('icon').props.name,'i-loop');
 await tap(refresh);assert.equal(r.root.findByType('dialog').props.title,'Refresh with server?');assert.equal(requests.length,1);
 await act(async()=>r.root.findByType('dialog').props.onCancel());assert.equal(requests.length,1);
 await tap(refresh);await act(async()=>r.root.findByType('dialog').props.onConfirm());assert.equal(requests.length,2);assert.ok(requests.every(q=>q.method==='GET'));
 await navigate(r,'Next');assert.match(text(r),/Recap how the final result/);assert.match(text(r),/Connect the conclusion/);assert.doesNotMatch(text(r),/Explain how measured growth/);assert.ok(button(r,'Refresh with server'));
 await navigate(r,'Previous');assertFirst(r);assert.equal(runtime.played.length,0);
});

test('portrait refresh waits for an in-flight server read before allowing another request',async()=>{
 const state=profiles();setup({state});let finish;
 globalThis.fetch=async()=>new Promise(resolve=>{finish=()=>resolve(new Response(JSON.stringify(state)));});
 const r=await mount();assert.equal(button(r,'Refresh with server').props.disabled,true);
 await act(async()=>finish());assert.equal(button(r,'Refresh with server').props.disabled,false);
});

// OpenAI Codex, 2026-11-21: portrait PDF preview uses flat pages and explicit side arrows.
test('portrait PDF preview has unfurled pages and boundary-aware arrows on both sides',async()=>{
 setup();runtime.model.deck.pages=[{uri:'file:///first.png',w:800,h:600},{uri:'file:///second.png',w:600,h:800}];
 const r=await mount();
 assert.ok(button(r,'Previous slide'));
 assert.equal(button(r,'Previous slide').props.disabled,true);
 assert.ok(button(r,'Next slide, 2: Conclusion'));
 assert.equal(button(r,'Next slide, 2: Conclusion').props.disabled,false);
 assert.ok(r.root.findAllByType('slide-card').every(node=>node.props.foldR===false&&node.props.foldL===false&&node.props.shadow===false));
 await tap(button(r,'Next slide, 2: Conclusion'));
 assert.equal(button(r,'Previous slide, 1: Measured change').props.disabled,false);
 assert.equal(button(r,'Next slide').props.disabled,true);
});

test('countdown/capture keep Cues visible, disable server refresh and update both slide directions against capture',async t=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:0});setup();const r=await mount();assertFirst(r);assert.equal(button(r,'Refresh with server').props.disabled,false);
 await tap(r.root.findByType('record-button'));
 await act(async()=>r.root.findByType('dialog').props.onConfirm());
 assert.match(r.root.findByType('record-button').props.label,/Starting in/);assertFirst(r);assert.equal(button(r,'Refresh with server').props.disabled,true);assert.equal(button(r,'Edit presentation time and audience').props.disabled,true);
 await act(async()=>{t.mock.timers.tick(3000);await Promise.resolve();});assert.equal(r.root.findByType('record-button').props.label,'Stop recording');assertFirst(r);assert.equal(runtime.captures[0].started,1);assert.equal(button(r,'Refresh with server').props.disabled,true);assert.equal(button(r,'Edit presentation time and audience').props.disabled,true);
 await navigate(r,'Next');assert.match(text(r),/Recap how the final result/);await navigate(r,'Previous');assertFirst(r);assert.deepEqual(runtime.captures[0].slides,[0,1,0]);assert.equal(requests.length,1);
});

test('rotation removes portrait Cues and refresh from accessibility/interactions, retains PDF navigation and restores the selected slide',async()=>{
 setup();setupNative.frame={top:0,left:0,s:1,width:844,height:390};const r=await mount();await tap(round(r,'Open full-screen landscape player'));
 const hidden=r.root.findAllByType('animated').find(n=>n.props.accessibilityElementsHidden);assert.ok(hidden);assert.equal(hidden.props.pointerEvents,'none');assert.equal(hidden.props.importantForAccessibility,'no-hide-descendants');assert.equal(button(r,'Refresh with server'),undefined);assert.ok(r.root.findByType('record-button'));
 assert.ok(r.root.findByType('record-ring'),'countdown and redo retain the landscape ring');
 const record=r.root.findByType('record-button');assert.equal(record.props.style.top,390-12-56-14,'scaled record position follows the landscape dock row');
 assert.ok(button(r,'Open cue panel'));await tap(button(r,'Open cue panel'));
 assert.ok(button(r,'Close cues'));assert.ok(button(r,'Previous slide'));assert.ok(button(r,'Next slide'));
 await tap(button(r,'Close cues'));assert.ok(button(r,'Open cue panel'));
 await tap(button(r,'Review overall feedback'));
 assert.deepEqual(runtime.routes.at(-1),['full',{nav:'rise',deckId:runtime.model.deck.id,sel:0,slide:0,from:'rehearse'}]);
 await navigate(r,'Next');assert.match(text(r),/2\/2/);await tap(button(r,'Return to portrait rehearsal'));assert.match(text(r),/Recap how the final result/);assert.match(text(r),/Connect the conclusion/);assert.ok(button(r,'Refresh with server'));await navigate(r,'Previous');assertFirst(r);assert.equal(requests.length,1);
});

test('covered full-screen rehearsal renders portrait preview beneath Review and restores landscape on return',async()=>{
 setup();setupNative.frame={top:0,left:0,s:1,width:844,height:390};const r=await mount();
 await tap(round(r,'Open full-screen landscape player'));
 assert.ok(button(r,'Open cue panel'));
 setupNative.frame={top:0,left:0,s:1,width:390,height:844};
 await act(async()=>r.update(React.createElement(ThemeProvider,null,React.createElement(ThemeToggle),React.createElement(RehearseScreen,{active:false}))));
 assert.equal(button(r,'Open cue panel'),undefined);
 assert.ok(round(r,'Open full-screen landscape player'));
 setupNative.frame={top:0,left:0,s:1,width:844,height:390};
 await act(async()=>r.update(React.createElement(ThemeProvider,null,React.createElement(ThemeToggle),React.createElement(RehearseScreen,{active:true}))));
 assert.ok(button(r,'Open cue panel'));
});

test('theme changes and reopening retain selected-slide cues without generating; missing audio stays explicit',async()=>{
 setup({slide:1,audio:false});const r=await mount();assert.match(text(r),/Recap how the final result/);assert.equal(button(r,'Refresh with server').props.disabled,false);assert.match(text(r),/Status · Tap for detail/);
 await tap(button(r,'Open Must cover cues'));assert.match(text(r),/Audio for this slide isn’t on this phone/);await tap(button(r,'Close cue sheet'));
 const cue=()=>r.root.findAllByType('text').find(n=>n.props.children==='Recap how the final result supports the main conclusion');const dark=JSON.stringify(cue().props.style);
 await tap(r.root.findByType('theme-toggle'));assert.notEqual(JSON.stringify(cue().props.style),dark);assert.match(text(r),/Recap how the final result/);assert.equal(requests.length,1);
 await act(async()=>r.unmount());renderer=null;const reopened=await mount();assert.match(text(reopened),/Recap how the final result/);assert.ok(button(reopened,'Refresh with server'));assert.equal(requests.length,2);assert.ok(requests.every(r=>r.method==='GET'));
});

test('interrupted recovery preserves the current slide cues through the existing recovery interface',async()=>{
 setup({slide:1});const recovered={id:'interrupted-take',state:'interrupted',recording:{duration_ms:3000,slide_events:[{slide_index:1,at_ms:0}]}};runtime.recoveries.push(recovered);const r=await mount();
 await tap(r.root.findAllByType('text').find(n=>n.props.accessibilityLabel==='Open interrupted recording for recovery'));assert.equal(r.root.findByType('take-playback').props.initialSlide,1);assert.match(text(r),/Recap how the final result/);
 await act(async()=>r.root.findByType('take-playback').props.onRecovered(recovered));assert.equal(r.root.findAllByType('take-playback').length,0);assert.match(text(r),/Slide 2 of 2/);assert.match(text(r),/Recap how the final result/);assert.deepEqual(runtime.routes[0],['review',{nav:'fade',deckId:runtime.model.deck.id,sel:1,slide:1,from:'rehearse'}]);assert.equal(requests.length,1);
});
test('existing presentation opens the shared setup without changing the selected slide or cue set',async()=>{
 setup({slide:1});const r=await mount();const edit=button(r,'Edit presentation time and audience');assert.ok(edit);assert.equal(edit.findByType('icon').props.name,'i-sliders');await tap(edit);assert.ok(button(r,'Not sure. Long press to edit a custom audience.'));assert.match(text(r),/Slide 2 of 2/);assert.ok(runtime.stops>0);assert.equal(requests.filter(q=>q.method==='POST').length,0);
});

test('Review icon opens overall feedback for the selected slide',async()=>{
 for(const takes of [1,2]){
  setup({slide:1});runtime.model.state.takes=takes;const r=await mount();
  const control=round(r,'Review overall feedback');assert.ok(control);await tap(control);
  assert.deepEqual(runtime.routes.at(-1),['full',{nav:'rise',deckId:runtime.model.deck.id,sel:1,slide:1,from:'rehearse'}]);
  await act(async()=>r.unmount());renderer=null;
 }
 assert.equal(requests.filter(r=>r.method==='POST').length,0);
});

test('slide preview title hands off to Home throughout a downward drag',async()=>{
 setup();const r=await mount();const title=runtime.shell.home.titleReturn;
 assert.equal(title.value,0);
 const pan=r.root.findAllByType('pan')[0];
 await act(async()=>pan.props.onMove({}, {dx:0,dy:90}));
 assert.equal(title.value,0.5);
 await act(async()=>pan.props.onMove({}, {dx:0,dy:130}));
 await act(async()=>pan.props.onRelease());
 assert.equal(title.value,1);
});

test('a touch begun during icon pop-out cannot suddenly close the preview',async()=>{
 setup();runtime.reducedMotion=false;runtime.shell.nav={...runtime.shell.nav,from:'home',nav:'fade'};
 const r=await mount();const pan=r.root.findAllByType('pan')[0];const event={nativeEvent:{pageY:200}};
 await act(async()=>pan.props.onMove(event,{dx:0,dy:90}));
 assert.equal(pan.props.onStartShould(event,{stateID:42}),false);
 assert.equal(pan.props.onMoveShould(event,{stateID:42,dx:0,dy:100}),false);
 await act(async()=>pan.props.onMove(event,{dx:0,dy:0}));
 assert.equal(pan.props.onMoveShould(event,{stateID:42,dx:0,dy:100}),false);
 assert.equal(pan.props.onStartShould(event,{stateID:43}),false);
 assert.equal(pan.props.onMoveShould(event,{stateID:43,dx:0,dy:100}),false,'the page is still fading in');
 const pageFade=runtime.timings.find(t=>t.value===1&&t.duration===600&&t.complete);
 assert.ok(pageFade,'the page fade starts with the PDF and title');
 assert.ok(runtime.timings.some(t=>t.value===0&&t.duration===600),'the PDF and title share the page fade duration');
 assert.equal(pan.props.onMoveShould(event,{stateID:43,dx:0,dy:100}),false);
 await act(async()=>pageFade.complete(true));
 assert.equal(pan.props.onStartShould(event,{stateID:44}),false);
 assert.equal(pan.props.onMoveShould(event,{stateID:44,dx:0,dy:100}),true);
 const slidePan=r.root.findAllByType('pan').find(node=>node.props.accessibilityRole==='adjustable');
 await act(async()=>pan.props.onMove(event,{dx:0,dy:90}));
 assert.equal(slidePan.props.onStartShould(event,{stateID:45}),false);
 assert.equal(slidePan.props.onMoveShould(event,{stateID:45,dx:-90,dy:0}),false);
 await act(async()=>pan.props.onMove(event,{dx:0,dy:0}));
 assert.equal(slidePan.props.onMoveShould(event,{stateID:45,dx:-90,dy:0}),false);
 assert.equal(slidePan.props.onMoveShould(event,{stateID:46,dx:-90,dy:0}),true);
});

test('covered rehearsal keeps edit requirements unavailable',async()=>{setup();const r=await mount(false);assert.equal(button(r,'Edit presentation time and audience').props.disabled,true);});


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


test('Review icon always opens overall feedback across reopened and later takes',async()=>{
 setup({slide:1});runtime.model.state.takes=1;const r=await mount();
 await tap(round(r,'Review overall feedback'));assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].from,'rehearse');
 await tap(round(r,'Review overall feedback'));assert.equal(runtime.routes.at(-1)[0],'full');
 await act(async()=>r.unmount());renderer=null;await mount();await tap(round(renderer,'Review overall feedback'));assert.equal(runtime.routes.at(-1)[0],'full');
 await act(async()=>{runtime.model.state.takes=2;runtime.emit();});await tap(round(renderer,'Review overall feedback'));assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].sel,1);
});
test('stopping a first legacy recording opens processing without a duplicate analysis request',async t=>{
 t.mock.timers.enable({apis:['setInterval','Date']});setup();runtime.model.state={...runtime.model.state,takes:0,run:null};const r=await mount();
 try{
  await tap(r.root.findByType('record-button'));await act(async()=>t.mock.timers.tick(3000));assert.equal(runtime.captures[0].started,1);
  await tap(r.root.findByType('record-button'));assert.equal(runtime.routes.at(-1)[0],'wait');assert.equal(runtime.routes.at(-1)[1].from,'rehearse');
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
test('recovering the first interrupted legacy recording opens processing',async()=>{
 setup({saved:false,slide:1});const a={id:'first-recovery',state:'interrupted',recording:{duration_ms:3000,slide_events:[{slide_index:1,at_ms:0}]}};runtime.recoveries.push(a);const r=await mount();
 await tap(r.root.findAllByType('text').find(n=>n.props.accessibilityLabel==='Open interrupted recording for recovery'));
 await act(async()=>r.root.findByType('take-playback').props.onRecovered(a));assert.equal(runtime.routes.at(-1)[0],'wait');assert.equal(runtime.routes.at(-1)[1].sel,1);
});


test('reopening a saved pending comparison carries the candidate review slide',async()=>{
 setup();runtime.model.state.compare={slides:[1],next:{sel:1}};const r=await mount();assert.equal(runtime.routes[0][0],'compare');assert.equal(runtime.routes[0][1].sel,1);
 await tap(round(r,'Compare takes'));assert.equal(runtime.routes.at(-1)[0],'compare');
});

// A provider switch must not treat an unresolved saved request as fresh admission.
test('stale profile cutover retains its revision and asks before an uncertain replacement',async()=>{
 const old=profiles();
 Object.assign(old,{state:'needs_confirmation',stale:true,retry_available:true,requires_confirmation:true,descriptions:null,available_data:false,processing_revision:3});
 Object.assign(old.provenance,{provider:'openai',model:'gpt-6-luna',schema_version:'slide-profile-v5'});
 old.selection={provider:'openrouter',project_id:'synthetic-router',model:'openai/gpt-6-luna',stage:'descriptions',
  prompt_version:'slide-profile-v5',schema_version:'slide-profile-v5',disclosure_version:'feedback-v1',prompt_digest:'e'.repeat(64),token:'a'.repeat(64)};
 const admitted=profiles();Object.assign(admitted,{description_set_id:'44444444-4444-4444-8444-444444444444',selection:old.selection});
 Object.assign(admitted.provenance,{provider:'openrouter',project_id:'synthetic-router',model:'openai/gpt-6-luna',schema_version:'slide-profile-v5'});
 setup({saved:false,state:old});
 let response=old;
 globalThis.fetch=async(url,options={})=>{
  requests.push({url,method:options.method??'GET',body:options.body?JSON.parse(options.body):null});
  if(options.method==='POST')response=admitted;
  return new Response(JSON.stringify(response));
 };
 const r=await mount();
 const confirm=()=>button(r,'Confirm AI cue retry');
 assert.equal(confirm(),undefined);await tap(button(r,'Open Must cover cues'));
 assert.ok(confirm(),'unresolved provider history must expose confirmation, not fresh Generate');
 assert.equal(requests.filter(q=>q.method==='POST').length,0);
 await tap(confirm());assert.equal(requests.filter(q=>q.method==='POST').length,0);
 assert.match(r.root.findByType('dialog').props.body,/charged|charge/);
 await act(async()=>r.root.findByType('dialog').props.onCancel());
 assert.equal(requests.filter(q=>q.method==='POST').length,0);
 await tap(confirm());
 await act(async()=>r.root.findByType('dialog').props.onConfirm());
 const posts=requests.filter(q=>q.method==='POST');assert.equal(posts.length,1);
 assert.deepEqual(posts[0].body,{description_set_id:old.description_set_id,processing_revision:3,
  expected_selection:'a'.repeat(64),acknowledge_uncertain:true});
 assert.match(text(r),/Explain how measured growth/);
});
