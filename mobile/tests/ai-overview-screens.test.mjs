// Synthetic source data; native rendering/player boundaries only are mocked.
import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/ai-overview-screen-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {runtime,AppState}=await import('./helpers/ai-overview-screen-native.mjs');
const {DARK_PALETTE,LIGHT_PALETTE}=await import('../src/design/tokens.ts');runtime.palettes={dark:DARK_PALETTE,light:LIGHT_PALETTE};
const {ReviewScreen}=await import('../src/screens/ReviewScreen.tsx');
const {FullReviewScreen}=await import('../src/screens/FullReviewScreen.tsx');
const {HomeFeedbackStats}=await import('../src/screens/HomeFeedbackStats.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function setup(){
 AppState.currentState='active';
 runtime.scores=null;runtime.scoreSelections=[];runtime.routes=[];runtime.plays=[];runtime.players=[];runtime.scrolls=[];runtime.audio=new Map([['a','file://a.m4a']]);runtime.theme='dark';
 runtime.nav={deckId:'deck',sel:0,slide:0,from:null,nav:null};
 const parts=[{attemptId:'a',segments:[{startMs:0,endMs:1000},{startMs:2000,endMs:3000}]},{attemptId:'b',segments:[{startMs:0,endMs:2000}]},null];
 runtime.model={deck:{id:'deck',title:'Synthetic deck',hue:'blue',pages:[],slides:[{title:'First'},{title:'Second'},{title:'Third'}],targets:[60,60,60],text:'ready',timing:{source:'suggested'},requirementsDefault:false},n:3,state:{run:{id:'run',parts,createdAt:new Date().toISOString(),sel:0,targetSum:180},fixes:0},times:[2,2,0],total:4,targetSum:180,lines:[],points:[[],[],[]],ai:[],transcripts:new Map([['a',{}],['b',{}]]),stages:new Map(),stats:{coverage:100,said:2,total:2,fpm:0,wpm:130,pace:'steady'}};
 runtime.feedback={items:[{slide:0,status:'reviewed',label:'4 findings',findingCount:4,assessed:true,hasFindings:true,tone:'warn'},{slide:1,status:'insufficient',label:'Insufficient evidence',findingCount:0,assessed:false,hasFindings:false,tone:'muted'},{slide:2,status:'not_recorded',label:'Not recorded',findingCount:0,assessed:false,hasFindings:false,tone:'muted'}],aggregate:{recorded:2,assessed:1,findings:4,slidesWithFindings:1,partial:0,pending:0,outdated:0,recoveryNeeded:0,insufficient:1,notAnalyzed:0},refresh:async()=>{},offline:false,notice:''};
}
const text=r=>JSON.stringify(r.toJSON());
const button=(r,label)=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel===label);
async function render(Component,props,f){let r;try{await act(async()=>{r=create(React.createElement(Component,props));});await f(r);}finally{if(r)await act(async()=>r.unmount());}}
test('Review renders compact score, time scrubber, slide playback card and fixed navigation',async()=>{setup();await render(ReviewScreen,{},async r=>{
 const ring=r.root.findByType('score-ring');assert.equal(ring.props.value,'—');assert.equal(ring.props.percent,null);
 assert.match(text(r),/Times per slide/);assert.match(text(r),/Slide 1 of 3/);
 assert.equal(r.root.findAllByType('mini-slide').length,1);
 assert.equal(r.root.findAllByType('view').filter(x=>x.props.style?.minHeight===22).length,4);
 assert.equal(r.root.findAllByType('scroll').filter(x=>!x.props.horizontal).length,0);
 const action=button(r,'Full review');assert.ok(action);assert.ok(action.props.style.some(x=>x?.height===58));
 await act(async()=>button(r,'Audience Q&A').props.onPress());assert.equal(runtime.routes.at(-1)[0],'qa');
 await act(async()=>button(r,'Back to recording').props.onPress());assert.deepEqual(runtime.routes.at(-1),['rehearse',{nav:null,deckId:'deck',slide:0}]);
 assert.ok(button(r,'Play slide 1 recording'));
});});
test('Full Review keeps ungraded score/status tiles and discloses partial audio before playing',async()=>{setup();await render(FullReviewScreen,{},async r=>{
 const ring=r.root.findByType('score-ring');assert.equal(ring.props.value,'—');assert.match(ring.props.label,/Overall score/i);assert.doesNotMatch(text(r),/Strong|Weak|points said/);
 assert.match(text(r),/Insufficient evidence/);assert.match(text(r),/4 findings/);
 await act(async()=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel?.startsWith('Play the whole run')).props.onPress());
 assert.equal(runtime.plays.length,0);assert.match(text(r),/missing|unavailable|on this phone/i);
 await act(async()=>r.root.findByType('dialog').props.onConfirm());assert.equal(runtime.plays.length,1);assert.equal(runtime.plays[0].segments.length,2);
 await act(async()=>button(r,'Pause').props.onPress());assert.equal(r.root.findAllByType('dialog').length,0,'Pause must not prompt about already accepted missing audio');
 await act(async()=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel?.startsWith('Slide 2,')).props.onPress());assert.equal(runtime.routes.at(-1)[1].sel,1);
 });});
test('Home presents the same AI counts in both themes, with measured pace kept separate',async()=>{for(const theme of ['light','dark']){setup();runtime.theme=theme;
 await render(HomeFeedbackStats,{deckId:'deck',active:true,home:{p:{value:0},vy:{value:0}}},async r=>{const ring=r.root.findByType('score-ring');assert.equal(ring.props.value,'—');assert.match(ring.props.label,/Overall score/i);assert.match(text(r),/0:04/);assert.match(text(r),/duration/);assert.doesNotMatch(text(r),/fillers \/ min|slides assessed/);assert.match(text(r),/4/);assert.match(text(r),/findings/);assert.doesNotMatch(text(r),/100%|On point|slide points said/);});
}});

test('Review retains Q&A swipe without a page scroll',async()=>{setup();await render(ReviewScreen,{},async r=>{const pan=r.root.findByType('pan');assert.equal(pan.props.onMoveShould({nativeEvent:{pageY:800}},{dx:0,dy:-150}),true);await act(async()=>{pan.props.onMove({}, {dx:0,dy:-150});pan.props.onRelease();});assert.equal(runtime.routes.at(-1)[0],'qa');});});

test('covered Review stops playback and can be reopened',async()=>{setup();await render(ReviewScreen,{active:true},async r=>{await act(async()=>button(r,'Play slide 1 recording').props.onPress());assert.equal(runtime.plays.length,1);await act(async()=>r.update(React.createElement(ReviewScreen,{active:false})));assert.ok(runtime.stops>0);await act(async()=>r.update(React.createElement(ReviewScreen,{active:true})));assert.ok(button(r,'Play slide 1 recording'));});});

test('Review has no native-invalid bare text outside Text',async()=>{setup();await render(ReviewScreen,{},async r=>{function walk(node,parent){if(typeof node==='string'||typeof node==='number'){assert.ok(['text','hints'].includes(parent),`Bare text under ${parent}: ${JSON.stringify(node)}`);return;}if(node)for(const child of node.children??[])walk(child,node.type);}walk(r.toJSON(),null);});});

test('Review playback uses selected slide segments and navigation changes the selected preview',async()=>{setup();await render(ReviewScreen,{},async r=>{
 await act(async()=>button(r,'Play slide 1 recording').props.onPress());assert.equal(runtime.plays[0].segments.length,2);
 runtime.nav={...runtime.nav,sel:1};await act(async()=>r.update(React.createElement(ReviewScreen)));
 assert.equal(r.root.findByType('mini-slide').props.title,'Second');assert.ok(button(r,'Play slide 2 recording'));
});});

test('unrecorded Review retains its slide preview and disables audio playback',async()=>{setup();runtime.nav.sel=2;await render(ReviewScreen,{},async r=>{assert.equal(r.root.findByType('mini-slide').props.title,'Third');assert.equal(button(r,'Play slide 3 recording').props.disabled,true);assert.equal(runtime.plays.length,0);});});

test('Full Review action remains fixed outside scroll content and opens the all-slides view',async()=>{setup();await render(ReviewScreen,{},async r=>{
 const action=button(r,'Full review');assert.ok(action);let parent=action.parent;while(parent){assert.notEqual(parent.type,'scroll');parent=parent.parent;}
 const flatten=style=>Array.isArray(style)?Object.assign({},...style.map(flatten)):style??{};
 assert.equal(flatten(action.props.style).height,58);
 await act(async()=>action.props.onPress());assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].sel,0);assert.ok(runtime.stops>0);
});});


test('Full Review entered from rehearsal returns to the selected rehearsal slide',async()=>{
 setup();runtime.nav={...runtime.nav,from:'rehearse',slide:0,sel:1};await render(FullReviewScreen,{},async r=>{
  await act(async()=>button(r,'Back to slides').props.onPress());assert.deepEqual(runtime.routes.at(-1),['rehearse',{nav:null,deckId:'deck',slide:1}]);
 });
});


test('comparison confirmation reviews the selected slide; Back keeps old audio and returns to rehearsal',async()=>{
 const {CompareScreen}=await import('../src/screens/CompareScreen.tsx');
 for(const choice of ['old','new','back']){
  setup();runtime.choices=[];runtime.nav.sel=1;runtime.model.state.takes=2;
  const prev=runtime.model.state.run,next={...prev,id:'new',takeNo:2};runtime.model.state.compare={slides:[1],whole:false,prev,next};
  await render(CompareScreen,{},async r=>{
   if(choice==='back')await act(async()=>runtime.back());else{
    if(choice==='new')await act(async()=>r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel?.startsWith('Overwrite with new recording,')).props.onPress());
    await act(async()=>r.root.findByType('record-button').props.onPress());
   }
   assert.deepEqual(runtime.choices,[choice==='new'?'new':'old']);assert.equal(runtime.routes.at(-1)[0],choice==='back'?'rehearse':'review');assert.equal(runtime.routes.at(-1)[1].sel,1);
  });
 }
});


test('returning from slide review retains the Full Review origin and selected slide',async()=>{
 setup();runtime.nav={...runtime.nav,from:'full',sel:1};await render(ReviewScreen,{},async r=>{
  await act(async()=>button(r,'Full review').props.onPress());assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].sel,1);assert.equal(Object.hasOwn(runtime.routes.at(-1)[1],'from'),false);
 });
 setup();runtime.nav={...runtime.nav,from:'review',sel:1};await render(FullReviewScreen,{},async r=>{
  await act(async()=>button(r,'Back to review').props.onPress());assert.equal(runtime.routes.at(-1)[0],'review');assert.equal(runtime.routes.at(-1)[1].sel,1);
 });
});


test('Android Back from slide review returns to the selected rehearsal slide',async()=>{
 setup();runtime.nav={...runtime.nav,from:'full',sel:1};await render(ReviewScreen,{},async()=>{
  await act(async()=>runtime.back());assert.equal(runtime.routes.at(-1)[0],'rehearse');assert.equal(runtime.routes.at(-1)[1].slide,1);
 });
});


test('Keep current reviews retained audio when a mixed retake selects a newly recorded slide',async()=>{
 const {mergeTake}=await import('../src/domain/run.ts'),{CompareScreen}=await import('../src/screens/CompareScreen.tsx');
 const ctx={n:3,targets:[60,60,60],deckTarget:180,lastFullTotal:null,takeNo:1,id:'old'};
 const first=mergeTake(null,{attemptId:'old',visits:[{slide:0,startMs:0,endMs:2000}],spoken:[true,false,false],whole:false,createdAt:'2026-10-16T00:00:00Z'},ctx).run;
 const candidate=mergeTake(first,{attemptId:'new',visits:[{slide:0,startMs:0,endMs:1000},{slide:1,startMs:1000,endMs:10000}],spoken:[true,true,false],whole:false,createdAt:'2026-10-16T00:01:00Z'},{...ctx,takeNo:2,id:'new'});
 assert.equal(candidate.run.sel,1);assert.deepEqual(candidate.compare.slides,[0]);
 for(const which of ['old','new']){
  setup();runtime.model.state={...runtime.model.state,takes:2,run:first,compare:candidate.compare};runtime.nav.sel=1;
  await render(CompareScreen,{},async r=>{
   if(which==='new')await act(async()=>r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel?.startsWith('Overwrite with new recording,')).props.onPress());
   await act(async()=>r.root.findByType('record-button').props.onPress());
   const selected=runtime.routes.at(-1)[1].sel;assert.equal(selected,which==='old'?0:1);assert.ok(runtime.model.state.run.parts[selected]);
  });
 }
});
test('restored comparison ignores an unrelated inherited slide selection',async()=>{
 setup();const {CompareScreen}=await import('../src/screens/CompareScreen.tsx');const prev=runtime.model.state.run;
 runtime.nav.sel=0;runtime.model.state.takes=2;runtime.model.state.compare={slides:[1],whole:false,prev,next:{...prev,sel:1,takeNo:2}};
 await render(CompareScreen,{},async r=>{await act(async()=>r.root.findByType('record-button').props.onPress());assert.equal(runtime.routes.at(-1)[1].sel,1);});
});

test('Home restores the same verified overall score and level as Full Review while retaining findings and duration',async()=>{for(const theme of ['dark','light']){setup();runtime.theme=theme;runtime.scores={overall:{score:67,level:'competent',status:'Graded',state:null,result:null,target:null}};await render(HomeFeedbackStats,{deckId:'deck',active:true,home:{p:{value:0},vy:{value:0}}},async r=>{const ring=r.root.findByType('score-ring');assert.equal(ring.props.value,'67');assert.deepEqual(ring.props.gradient,[runtime.palettes[theme].good,runtime.palettes[theme].good]);assert.match(ring.props.label,/Overall score\nCompetent/);assert.match(text(r),/4/);assert.match(text(r),/total findings/);assert.match(text(r),/0:04/);assert.match(text(r),/130/);});}});
test('Home retains pending and partial findings notices without inventing a composed overall score',async()=>{setup();runtime.feedback.aggregate.pending=1;runtime.feedback.aggregate.partial=1;runtime.feedback.items[0]={...runtime.feedback.items[0],status:'pending',label:'Feedback pending'};await render(HomeFeedbackStats,{deckId:'deck',active:true,home:{p:{value:0},vy:{value:0}}},async r=>{assert.equal(r.root.findByType('score-ring').props.value,'—');assert.match(text(r),/Feedback pending/);assert.match(text(r),/1 partial/);});});

// OpenAI Codex #44: exact seeking retains the existing equal-width slide sections.
test('Full Review dragging within a slide previews and seeks that exact offset without starting idle audio',async()=>{
 setup();runtime.audio.set('b','file://b.m4a');runtime.model.times=[20,40,0];runtime.model.total=60;
 runtime.model.state.run.parts[0].segments=[{startMs:1000,endMs:11000},{startMs:20000,endMs:30000}];
 runtime.model.state.run.parts[1].segments=[{startMs:5000,endMs:45000}];
 await render(FullReviewScreen,{},async r=>{
  const track=()=>r.root.findAllByType('pan').find(n=>n.props.accessibilityLabel==='Whole run audio review');
  await act(async()=>track().props.onLayout({nativeEvent:{layout:{x:0,width:300}}}));
  await act(async()=>track().props.onGrant({nativeEvent:{pageX:91}}));
  assert.match(text(r),/0:15/,'drag preview shows the intra-slide timestamp');
  assert.equal(runtime.plays.length,0,'preview never commits native playback');
  await act(async()=>track().props.onRelease());
  const p=runtime.players[0];assert.equal(p.elapsedMs,15000);assert.equal(p.paused,true);
  assert.deepEqual(runtime.plays.at(-1).segments,[{uri:'file://a.m4a',startMs:1000,endMs:11000},{uri:'file://a.m4a',startMs:20000,endMs:30000},{uri:'file://b.m4a',startMs:5000,endMs:45000}]);
 });
});

const runTrack=r=>r.root.findAllByType('pan').find(n=>n.props.accessibilityLabel==='Whole run audio review');
async function prepareTrack(r){await act(async()=>runTrack(r).props.onLayout({nativeEvent:{layout:{x:0,width:300}}}));}
function longRun(){setup();runtime.audio.set('b','file://b.m4a');runtime.model.times=[20,40,0];runtime.model.total=60;runtime.model.state.run.parts[0].segments=[{startMs:1000,endMs:11000},{startMs:20000,endMs:30000}];runtime.model.state.run.parts[1].segments=[{startMs:5000,endMs:45000}];}
test('Full Review commits playing seeks, keeps paused seeks paused and cancels a gesture without seeking',async()=>{
 longRun();await render(FullReviewScreen,{},async r=>{
  await prepareTrack(r);await act(async()=>r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel?.startsWith('Play the whole run')).props.onPress());
  await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));assert.equal(runtime.players[0].paused,true);
  await act(async()=>runTrack(r).props.onRelease());assert.equal(runtime.plays.at(-1).elapsedMs,15000);assert.equal(runtime.players[0].paused,false);
  await act(async()=>button(r,'Pause').props.onPress());
  await act(async()=>{runTrack(r).props.onGrant({nativeEvent:{pageX:166}});});
  await act(async()=>runTrack(r).props.onRelease());assert.equal(runtime.players[0].elapsedMs,40000);assert.equal(runtime.players[0].paused,true);
  await act(async()=>r.root.findAllByType('pressable').find(n=>n.props.accessibilityLabel?.startsWith('Play the whole run')).props.onPress());const before=runtime.plays.length;
  await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));
  await act(async()=>runTrack(r).props.onTerminate());assert.equal(runtime.plays.length,before);assert.equal(runtime.players[0].paused,false);
 });
});
test('Full Review does not silently jump a missing target and partial confirmation retains its exact offset',async()=>{
 longRun();runtime.audio.delete('b');await render(FullReviewScreen,{},async r=>{
  await prepareTrack(r);await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:166}}));await act(async()=>runTrack(r).props.onRelease());
  assert.equal(runtime.plays.length,0);assert.match(text(r),/Audio for slide 2/);assert.equal(r.root.findAllByType('dialog').length,0);
  await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));await act(async()=>runTrack(r).props.onRelease());
  assert.equal(runtime.plays.length,0);await act(async()=>r.root.findByType('dialog').props.onConfirm());
  assert.equal(runtime.plays.at(-1).elapsedMs,15000);assert.equal(runtime.players[0].paused,true);assert.equal(runtime.plays.at(-1).segments.length,2);
 });
});
test('Full Review discards scrub and missing-audio confirmation after selected recordings change',async()=>{
 longRun();await render(FullReviewScreen,{},async r=>{
  await prepareTrack(r);await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));const release=runTrack(r).props.onRelease;
  runtime.model={...runtime.model,state:{...runtime.model.state,run:{...runtime.model.state.run,parts:[{attemptId:'new',segments:[{startMs:0,endMs:20000}]},...runtime.model.state.run.parts.slice(1)]}}};
  await act(async()=>r.update(React.createElement(FullReviewScreen)));await act(async()=>release());assert.equal(runtime.plays.length,0);
 });
 longRun();runtime.audio.delete('b');await render(FullReviewScreen,{},async r=>{
  await prepareTrack(r);await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));await act(async()=>runTrack(r).props.onRelease());const confirm=r.root.findByType('dialog').props.onConfirm;
  runtime.model={...runtime.model,state:{...runtime.model.state,run:{...runtime.model.state.run,parts:[null,...runtime.model.state.run.parts.slice(1)]}}};
  await act(async()=>r.update(React.createElement(FullReviewScreen)));await act(async()=>confirm());assert.equal(runtime.plays.length,0);
 });
});
test('Full Review cancels scrub on background or navigation and exposes five-second accessible seeks',async()=>{
 for(const leave of ['background','navigation','back']){
  longRun();await render(FullReviewScreen,{},async r=>{
   await prepareTrack(r);await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));const release=runTrack(r).props.onRelease;
   if(leave==='background')await act(async()=>{AppState.emit('background');AppState.emit('active');});
   else if(leave==='back')await act(async()=>runtime.back());
   else await act(async()=>r.update(React.createElement(FullReviewScreen,{active:false})));
   await act(async()=>release());assert.equal(runtime.plays.length,0);
  });
 }
 longRun();await render(FullReviewScreen,{},async r=>{
  await act(async()=>runTrack(r).props.onAccessibilityAction({nativeEvent:{actionName:'increment'}}));
  assert.equal(runtime.players[0].elapsedMs,5000);assert.equal(runtime.players[0].paused,true);assert.equal(runTrack(r).props.accessibilityValue.now,5);assert.match(runTrack(r).props.accessibilityValue.text,/0:05 of 1:00/);
  await act(async()=>runTrack(r).props.onAccessibilityAction({nativeEvent:{actionName:'decrement'}}));assert.equal(runtime.players[0].elapsedMs,0);
 });
});

test('a retained accessibility action cannot seek the previous selected recording after source change',async()=>{
 longRun();await render(FullReviewScreen,{},async r=>{
  const oldAction=runTrack(r).props.onAccessibilityAction;
  runtime.audio.set('new','file://new.m4a');
  runtime.model={...runtime.model,state:{...runtime.model.state,run:{...runtime.model.state.run,parts:[{attemptId:'new',segments:[{startMs:1000,endMs:21000}]},...runtime.model.state.run.parts.slice(1)]}}};
  await act(async()=>r.update(React.createElement(FullReviewScreen)));
  await act(async()=>oldAction({nativeEvent:{actionName:'increment'}}));
  assert.equal(runtime.plays.length,0,'the stale handler must not load or seek the old audio source');
 });
});
