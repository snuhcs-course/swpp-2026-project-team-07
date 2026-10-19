// Synthetic source data; native rendering/player boundaries only are mocked.
import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/ai-overview-screen-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {runtime}=await import('./helpers/ai-overview-screen-native.mjs');
const {DARK_PALETTE,LIGHT_PALETTE}=await import('../src/design/tokens.ts');runtime.palettes={dark:DARK_PALETTE,light:LIGHT_PALETTE};
const {ReviewScreen}=await import('../src/screens/ReviewScreen.tsx');
const {FullReviewScreen}=await import('../src/screens/FullReviewScreen.tsx');
const {HomeFeedbackStats}=await import('../src/screens/HomeFeedbackStats.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function setup(){
 runtime.scores=null;runtime.scoreSelections=[];runtime.routes=[];runtime.plays=[];runtime.players=[];runtime.scrolls=[];runtime.audio=new Map([['a','file://a.m4a']]);runtime.theme='dark';
 runtime.nav={deckId:'deck',sel:0,slide:0,from:null,nav:null};
 const parts=[{attemptId:'a',segments:[{startMs:0,endMs:1000},{startMs:2000,endMs:3000}]},{attemptId:'b',segments:[{startMs:0,endMs:2000}]},null];
 runtime.model={deck:{id:'deck',title:'Synthetic deck',hue:'blue',pages:[],slides:[{title:'First'},{title:'Second'},{title:'Third'}],targets:[60,60,60],text:'ready',timing:{source:'suggested'},requirementsDefault:false},n:3,state:{run:{id:'run',parts,createdAt:new Date().toISOString(),sel:0,targetSum:180},fixes:0},times:[2,2,0],total:4,targetSum:180,lines:[],points:[[],[],[]],ai:[],transcripts:new Map([['a',{}],['b',{}]]),stages:new Map(),stats:{coverage:100,said:2,total:2,fpm:0,wpm:130,pace:'steady'}};
 runtime.feedback={items:[{slide:0,status:'reviewed',label:'4 findings',findingCount:4,assessed:true,hasFindings:true,tone:'warn'},{slide:1,status:'insufficient',label:'Insufficient evidence',findingCount:0,assessed:false,hasFindings:false,tone:'muted'},{slide:2,status:'not_recorded',label:'Not recorded',findingCount:0,assessed:false,hasFindings:false,tone:'muted'}],aggregate:{recorded:2,assessed:1,findings:4,slidesWithFindings:1,partial:0,pending:0,outdated:0,recoveryNeeded:0,insufficient:1,notAnalyzed:0},refresh:async()=>{},offline:false,notice:''};
}
const text=r=>JSON.stringify(r.toJSON());
const button=(r,label)=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel===label);
async function render(Component,props,f){let r;try{await act(async()=>{r=create(React.createElement(Component,props));});await f(r);}finally{if(r)await act(async()=>r.unmount());}}
test('Review keeps findings separate from ungraded performance, page scroll, selected-source evidence and tappable navigation',async()=>{setup();await render(ReviewScreen,{},async r=>{
 assert.equal(r.root.findByType('score-ring').props.value,'—');assert.equal(r.root.findByType('score-ring').props.percent,null);
 assert.doesNotMatch(text(r),/Strong|Spot On!|100%/);
 assert.equal(r.root.findAllByType('scroll').filter(x=>!x.props.horizontal).length,1);
 await act(async()=>button(r,'Audience Q&A').props.onPress());assert.equal(runtime.routes.at(-1)[0],'qa');
 await act(async()=>button(r,'Back to slides').props.onPress());assert.deepEqual(runtime.routes.at(-1),['rehearse',{nav:null,deckId:'deck',slide:0}]);
 const finding={start_ms:2000,end_ms:2400,speech_quote:'Actual source words',observation:'Explain the result',slide_quote:'Slide evidence'};
 await act(async()=>r.root.findByType('slide-feedback').props.onEvidence(finding));
 assert.equal(r.root.findAllByType('take-playback').length,0);
 assert.equal(r.root.findByType('recording-tools').props.evidence.speech_quote,finding.speech_quote);
 assert.equal(r.root.findByType('inline-transcript').props.player,r.root.findByType('recording-tools').props.player);
 assert.equal(r.root.findByType('inline-transcript').props.inline,true);
 assert.equal(runtime.players.length,1,'Review has one playback owner');
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

test('Review retains Q&A swipe outside its page scroll',async()=>{setup();await render(ReviewScreen,{},async r=>{const pan=r.root.findByType('pan');assert.equal(pan.props.onMoveShould({nativeEvent:{pageY:800}},{dx:0,dy:-150}),true);await act(async()=>{pan.props.onMove({}, {dx:0,dy:-150});pan.props.onRelease();});assert.equal(runtime.routes.at(-1)[0],'qa');});});

test('covered Review unmounts its detail feedback controller',async()=>{setup();await render(ReviewScreen,{active:true},async r=>{assert.equal(r.root.findAllByType('slide-feedback').length,1);await act(async()=>r.update(React.createElement(ReviewScreen,{active:false})));assert.equal(r.root.findAllByType('slide-feedback').length,0);await act(async()=>r.update(React.createElement(ReviewScreen,{active:true})));assert.equal(r.root.findAllByType('slide-feedback').length,1);});});

test('Review has no native-invalid bare text outside Text',async()=>{setup();await render(ReviewScreen,{},async r=>{function walk(node,parent){if(typeof node==='string'||typeof node==='number'){assert.ok(['text','hints'].includes(parent),`Bare text under ${parent}: ${JSON.stringify(node)}`);return;}if(node)for(const child of node.children??[])walk(child,node.type);}walk(r.toJSON(),null);});});

test('Review places selected transcript below Play and above feedback; selection, reopening and themes keep one player',async()=>{for(const theme of ['dark','light']){setup();runtime.theme=theme;await render(ReviewScreen,{},async r=>{
 const transcript=r.root.findByType('inline-transcript');assert.equal(transcript.props.id,'a');assert.equal(transcript.props.slide,0);
 const flat=text(r);assert.ok(flat.indexOf('Play slide 1,')<flat.indexOf('inline-transcript'));assert.ok(flat.indexOf('inline-transcript')<flat.indexOf('slide-feedback'));
 await act(async()=>button(r,'Play slide 1, 0:02').props.onPress());assert.equal(runtime.plays[0].segments.length,2);assert.equal(transcript.props.player.uri,'file://a.m4a');
 await act(async()=>button(r,'Pause slide 1').props.onPress());assert.equal(transcript.props.player.paused,true);
 runtime.nav={...runtime.nav,sel:1};await act(async()=>r.update(React.createElement(ReviewScreen)));assert.equal(r.root.findByType('inline-transcript').props.id,'b');assert.equal(r.root.findByType('inline-transcript').props.slide,1);
 runtime.nav={...runtime.nav,sel:0};await act(async()=>r.update(React.createElement(ReviewScreen)));assert.equal(r.root.findByType('inline-transcript').props.id,'a');assert.equal(runtime.plays.length,2,'navigation does not autoplay');
 await act(async()=>r.update(React.createElement(ReviewScreen,{active:false})));assert.equal(r.root.findAllByType('inline-transcript').length,0);assert.equal(r.root.findAllByType('recording-tools').length,0);
 await act(async()=>r.update(React.createElement(ReviewScreen,{active:true})));assert.equal(r.root.findByType('inline-transcript').props.id,'a');assert.equal(runtime.plays.length,2);
 });}});

test('unrecorded Review retains its slide preview and explicit missing-audio state',async()=>{setup();runtime.nav.sel=2;await render(ReviewScreen,{},async r=>{assert.equal(r.root.findByType('mini-slide').props.title,'Third');assert.match(text(r),/No saved audio/);assert.equal(r.root.findAllByType('inline-transcript').length,0);assert.equal(runtime.plays.length,0);});});

test('each evidence selection scrolls to inline controls, including the same finding; playback does not resnap scroll',async()=>{setup();await render(ReviewScreen,{},async r=>{
 const tools=r.root.findByType('recording-tools');await act(async()=>tools.parent.props.onLayout({nativeEvent:{layout:{y:420}}}));
 const finding={start_ms:2000,end_ms:2400,speech_quote:'Source quote'};const select=()=>r.root.findByType('slide-feedback').props.onEvidence(finding);
 await act(async()=>select());assert.deepEqual(runtime.scrolls.at(-1),{y:420,animated:true});assert.equal(runtime.scrolls.length,1);
 await act(async()=>select());assert.equal(runtime.scrolls.length,2,'same finding opens evidence again without a layout change');
 await act(async()=>runtime.players[0].playSegments('evidence:a:2000:2400',[{uri:'file://a.m4a',startMs:2000,endMs:2400}]));assert.equal(runtime.scrolls.length,2,'player updates leave page scrolling alone');
 });});


test('Full Review action stays outside the scrolling transcript and reserves measured header space',async()=>{
 setup();await render(ReviewScreen,{},async r=>{
  const action=button(r,'Full review');assert.ok(action);let parent=action.parent;while(parent){assert.notEqual(parent.type,'scroll');parent=parent.parent;}
  const flatten=style=>Array.isArray(style)?Object.assign({},...style.map(flatten)):style??{};
  assert.ok(flatten(action.props.style).minHeight>=48);
  const header=r.root.findAllByType('view').find(n=>n.props.onLayout);assert.ok(header,'header must measure its height for large text');
  await act(async()=>header.props.onLayout({nativeEvent:{layout:{y:46,height:170}}}));
  const body=r.root.findAllByType('scroll').find(n=>!n.props.horizontal);assert.ok(flatten(body.props.style).top>=216);
  await act(async()=>body.props.onScroll({nativeEvent:{contentOffset:{y:1000}}}));assert.ok(button(r,'Full review'));
  await act(async()=>action.props.onPress());assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].sel,0);assert.ok(runtime.stops>0);
 });
});
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


test('Android Back from slide review carries the selected slide back through Full Review',async()=>{
 setup();runtime.nav={...runtime.nav,from:'full',sel:1};await render(ReviewScreen,{},async()=>{
  await act(async()=>runtime.back());assert.equal(runtime.routes.at(-1)[0],'full');assert.equal(runtime.routes.at(-1)[1].sel,1);
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
