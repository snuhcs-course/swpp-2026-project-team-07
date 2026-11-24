// Synthetic source data; native rendering/player boundaries only are mocked.
import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/ai-overview-screen-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {runtime,AppState}=await import('./helpers/ai-overview-screen-native.mjs');
const {DARK_PALETTE,LIGHT_PALETTE}=await import('../src/design/tokens.ts');runtime.palettes={dark:DARK_PALETTE,light:LIGHT_PALETTE};
const {ReviewScreen}=await import('../src/screens/ReviewScreen.tsx');
const {ListenBackScreen:LegacyListenBackScreen}=await import('../src/screens/FullReviewScreen.tsx');
const {OverviewScreen}=await import('../src/screens/OverviewScreen.tsx');
const {WaitScreen}=await import('../src/screens/WaitScreen.tsx');
const {ListenBackKaraokeScreen}=await import('../src/screens/ListenBackKaraokeScreen.tsx');
const {FeedbackScreen,regions}=await import('../src/screens/FeedbackScreen.tsx');
const {HomeFeedbackStats}=await import('../src/screens/HomeFeedbackStats.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function setup(){
 AppState.currentState='active';
 runtime.frameHeight=844;runtime.frameCompact=false;
 runtime.scores=null;runtime.scoreSelections=[];runtime.routes=[];runtime.plays=[];runtime.players=[];runtime.scrolls=[];runtime.audio=new Map([['a','file://a.m4a']]);runtime.theme='dark';
 runtime.reducedMotion=true;
 runtime.nav={deckId:'deck',sel:0,slide:0,from:null,nav:null};
 const parts=[{attemptId:'a',segments:[{startMs:0,endMs:1000},{startMs:2000,endMs:3000}]},{attemptId:'b',segments:[{startMs:0,endMs:2000}]},null];
 runtime.model={deck:{id:'deck',title:'Synthetic deck',hue:'blue',pages:[],slides:[{title:'First'},{title:'Second'},{title:'Third'}],targets:[60,60,60],text:'ready',timing:{source:'suggested'},requirementsDefault:false},n:3,state:{run:{id:'run',parts,createdAt:new Date().toISOString(),sel:0,targetSum:180},fixes:0},times:[2,2,0],total:4,targetSum:180,lines:[],points:[[],[],[]],ai:[],transcripts:new Map([['a',{}],['b',{}]]),stages:new Map(),stats:{coverage:100,said:2,total:2,fpm:0,wpm:130,pace:'steady'}};
 runtime.feedback={items:[{slide:0,status:'reviewed',label:'4 findings',findingCount:4,assessed:true,hasFindings:true,tone:'warn'},{slide:1,status:'insufficient',label:'Insufficient evidence',findingCount:0,assessed:false,hasFindings:false,tone:'muted'},{slide:2,status:'not_recorded',label:'Not recorded',findingCount:0,assessed:false,hasFindings:false,tone:'muted'}],aggregate:{recorded:2,assessed:1,findings:4,slidesWithFindings:1,partial:0,pending:0,outdated:0,recoveryNeeded:0,insufficient:1,notAnalyzed:0},refresh:async()=>{},offline:false,notice:''};
}
const text=r=>JSON.stringify(r.toJSON());
const byText=(r,label)=>r.root.findAllByType('pressable').find(n=>n.findAllByType('text').some(t=>t.children.join('')===label));
const badge=r=>r.root.findAllByType('view').find(n=>n.props.style?.[0]?.minWidth===46);
const button=(r,label)=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel===label);
async function render(Component,props,f){let r;try{await act(async()=>{r=create(React.createElement(Component,props));});await f(r);}finally{if(r)await act(async()=>r.unmount());}}
// OpenAI Codex, 2026-11-21: Review fits full text without a nested scroll view so vertical drags can leave the page.
test('Review renders its score badge, three slide facts and selected-slide playback without page scrolling',async()=>{setup();await render(ReviewScreen,{},async r=>{
 assert.equal(badge(r).findByType('text').props.children,'—');assert.match(text(r),/Slide 1 of 3/);
 assert.equal(r.root.findAllByType('mini-slide').length,1);
 assert.match(text(r),/0:02 of 1:00 planned/);assert.match(text(r),/— fillers/);
 assert.equal(r.root.findAllByType('scroll').length,0);
 assert.ok(button(r,'Play slide 1 audio'));
 await act(async()=>runtime.back());assert.deepEqual(runtime.routes.at(-1),['rehearse',{deckId:'deck',slide:0,sel:0}]);
});});

test('Legacy Listen Back keeps ungraded score/status tiles and discloses partial audio before playing',async()=>{setup();await render(LegacyListenBackScreen,{},async r=>{
 const ring=r.root.findByType('score-ring');assert.equal(ring.props.value,'—');assert.match(ring.props.label,/Overall score/i);assert.doesNotMatch(text(r),/Strong|Weak|points said/);
 assert.match(text(r),/Insufficient evidence/);assert.match(text(r),/4 findings/);
 await act(async()=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel?.startsWith('Play the whole run')).props.onPress());
 assert.equal(runtime.plays.length,0);assert.match(text(r),/missing|unavailable|on this phone/i);
 await act(async()=>r.root.findByType('dialog').props.onConfirm());assert.equal(runtime.plays.length,1);assert.equal(runtime.plays[0].segments.length,2);
 await act(async()=>button(r,'Pause').props.onPress());assert.equal(r.root.findAllByType('dialog').length,0,'Pause must not prompt about already accepted missing audio');
 await act(async()=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel?.startsWith('Slide 2,')).props.onPress());assert.equal(runtime.routes.at(-1)[1].sel,1);
 });});
test('Home keeps ungraded metrics neutral and separates measured pace in both themes',async()=>{for(const theme of ['light','dark']){setup();runtime.theme=theme;
 await render(HomeFeedbackStats,{deckId:'deck',active:true,home:{p:{value:0},vy:{value:0}},onOpenReview:()=>{}},async r=>{
 assert.match(text(r),/—/);assert.match(text(r),/0:04/);assert.match(text(r),/of 3:00/);assert.match(text(r),/critical/);assert.match(text(r),/130/);assert.match(text(r),/wpm/);
 assert.equal(r.root.findAllByType('pressable').length,0);assert.doesNotMatch(r.root.findAllByType('text').map(n=>n.children.join('')).join(' '),/100%|On point|slide points said/);
 });
}});

test('Review stays opaque beneath Q&A during an upward swipe',async()=>{setup();await render(ReviewScreen,{active:true},async r=>{const pan=r.root.findByType('pan');assert.equal(pan.props.onMoveShould({nativeEvent:{pageY:800}},{dx:0,dy:-150}),true);await act(async()=>{pan.props.onMove({}, {dx:0,dy:-150});r.update(React.createElement(ReviewScreen,{active:true}));});assert.ok(r.root.findAllByType('animated').some(n=>n.props.style?.[1]?.opacity===1));await act(async()=>r.root.findByType('pan').props.onRelease({}, {dx:0,dy:-150}));assert.equal(runtime.routes.at(-1)[0],'qa');await act(async()=>r.update(React.createElement(ReviewScreen,{active:false})));assert.ok(r.root.findAllByType('animated').some(n=>n.props.style?.[1]?.opacity===1));assert.ok(r.root.findByType('mini-slide'));});});

test('Review swipes down to its opening page and keeps the selected slide',async()=>{
 for(const from of ['rehearse','full']){
  setup();runtime.nav={...runtime.nav,from,sel:1};
  await render(ReviewScreen,{},async r=>{
   assert.equal(r.root.findByType('hints').children.at(-1),'Slide preview');
   const pan=r.root.findByType('pan');
   await act(async()=>{pan.props.onMove({}, {dx:0,dy:130});pan.props.onRelease({}, {dx:0,dy:130});});
   assert.deepEqual(runtime.routes.at(-1),['rehearse',{deckId:'deck',slide:1,sel:1}]);
  });
 }
});

test('Full Review opened from the icon returns to its selected slide preview',async()=>{
 setup();runtime.nav={...runtime.nav,from:'rehearse',sel:1};
 await render(OverviewScreen,{},async r=>{
  assert.equal(r.root.findByType('hints').children.at(-1),'Slide preview');
  const pan=r.root.findByType('pan');
  await act(async()=>{pan.props.onMove({}, {dy:90,dx:0});r.update(React.createElement(OverviewScreen));});
  assert.equal(r.root.findByType('pan').props.style[1].opacity,0.5);
  await act(async()=>r.root.findByType('pan').props.onRelease({}, {dy:100,dx:0}));
  assert.deepEqual(runtime.routes.at(-1),['rehearse',{deckId:'deck',slide:1,sel:1}]);
 });
 setup();runtime.nav.from='home';await render(OverviewScreen,{},async r=>{
  assert.equal(r.root.findByType('hints').children.at(-1),'Home');
  await act(async()=>runtime.back());assert.deepEqual(runtime.routes.at(-1),['home']);
 });
});

test('Review keeps its vertical fade while horizontal issue swipes move the content',async()=>{
 setup();runtime.reducedMotion=false;
 await render(ReviewScreen,{},async r=>{
  await act(async()=>{r.root.findByType('pan').props.onMove({}, {dx:0,dy:90});r.update(React.createElement(ReviewScreen));});
  assert.ok(r.root.findAllByType('animated').some(n=>n.props.style?.[1]?.opacity===0.5));
  await act(async()=>{r.root.findByType('pan').props.onMove({}, {dx:-95,dy:2});r.update(React.createElement(ReviewScreen));});
  const moving=r.root.findAllByType('animated').find(n=>n.props.style?.[2]?.transform?.[0]?.translateX<0&&n.props.style[2].opacity===1);
  assert.ok(moving,'the issue follows the finger without fading the page to its underlay');
  assert.equal(moving.findAllByType('mini-slide').length,0,'the slide thumbnail stays fixed above the moving review');
 });
});

test('covered Review stops playback and can be reopened',async()=>{setup();await render(ReviewScreen,{active:true},async r=>{await act(async()=>button(r,'Play slide 1 audio').props.onPress());assert.equal(runtime.plays.length,1);await act(async()=>r.update(React.createElement(ReviewScreen,{active:false})));assert.ok(runtime.stops>0);await act(async()=>r.update(React.createElement(ReviewScreen,{active:true})));assert.ok(button(r,'Play slide 1 audio'));});});

test('Review has no native-invalid bare text outside Text',async()=>{setup();await render(ReviewScreen,{},async r=>{function walk(node,parent){if(typeof node==='string'||typeof node==='number'){assert.ok(['text','hints'].includes(parent),`Bare text under ${parent}: ${JSON.stringify(node)}`);return;}if(node)for(const child of node.children??[])walk(child,node.type);}walk(r.toJSON(),null);});});

test('Review playback uses selected slide segments and navigation changes the selected preview',async()=>{setup();await render(ReviewScreen,{},async r=>{
 await act(async()=>button(r,'Play slide 1 audio').props.onPress());assert.equal(runtime.plays[0].segments.length,2);
 runtime.nav={...runtime.nav,sel:1};await act(async()=>r.update(React.createElement(ReviewScreen)));
 assert.equal(r.root.findByType('mini-slide').props.title,'Second');assert.ok(button(r,'Play slide 2 audio'));
});});

test('unrecorded Review retains its slide preview and disables audio playback',async()=>{setup();runtime.nav.sel=2;await render(ReviewScreen,{},async r=>{assert.equal(r.root.findByType('mini-slide').props.title,'Third');assert.equal(button(r,'Play slide 3 audio').props.disabled,true);assert.equal(runtime.plays.length,0);});});

test('current Overview opens fixed Feedback and Listen Back controls and selected slide review',async()=>{
 setup();await render(OverviewScreen,{},async r=>{
  assert.match(text(r),/0:04 with transcript/);
  for(const [label,route]of [['Feedback','feedback'],['Listen back','listen']]){
   const action=byText(r,label);assert.ok(action);let parent=action.parent;while(parent){assert.notEqual(parent.type,'scroll');parent=parent.parent;}
   await act(async()=>action.props.onPress());assert.equal(runtime.routes.at(-1)[0],route);assert.equal(runtime.routes.at(-1)[1].sel,0);
  }
  await act(async()=>button(r,'Slide 2, not graded').props.onPress());assert.deepEqual(runtime.routes.at(-1),['review',{deckId:'deck',sel:1,from:'full'}]);
  await act(async()=>button(r,'Slide 3, not graded').props.onPress());assert.deepEqual(runtime.routes.at(-1),['review',{deckId:'deck',sel:2,from:'full'}]);
 });
 runtime.model.pending=true;runtime.nav={...runtime.nav,from:'full',sel:1};await render(ListenBackKaraokeScreen,{},async r=>{assert.match(text(r),/Transcript is still processing/);await act(async()=>runtime.back());assert.deepEqual(runtime.routes.at(-1),['full',{deckId:'deck',sel:1}]);});
});

// OpenAI Codex, 2026-11-21: scored Review tiles expose both the slide number and score in seven-column rows.
test('Overall Review keeps slide numbers visible above scores across a nineteen-slide grid',async()=>{
 setup();runtime.model.n=19;
 runtime.model.deck.slides=Array.from({length:19},(_,i)=>({title:`Slide ${i+1}`}));
 runtime.model.times=Array(19).fill(1);
 runtime.scores={overall:{score:83,status:'Scored',level:'competent'},items:Array.from({length:19},(_,i)=>({score:i===0?null:80+i,level:'competent',status:'Scored'}))};
 await render(OverviewScreen,{},async r=>{
  const tiles=r.root.findAllByType('pressable').filter(n=>n.props.accessibilityLabel?.startsWith('Slide '));
  assert.equal(tiles.length,19);
  assert.deepEqual(tiles[1].findAllByType('text').map(n=>n.props.children),[2,81]);
  assert.deepEqual(tiles[18].findAllByType('text').map(n=>n.props.children),[19,98]);
  assert.deepEqual(tiles[0].findAllByType('text').map(n=>n.props.children),[1]);
  assert.equal(r.root.findAllByType('view').filter(n=>n.props.style?.height===46&&n.props.style?.flexDirection==='row').length,3);
  assert.equal(r.root.findByType('scroll').props.scrollEnabled,false);
 });
});

test('long Overall Review grids scroll within the space above Feedback',async()=>{
 setup();runtime.model.n=30;runtime.model.deck.slides=Array.from({length:30},(_,i)=>({title:`Slide ${i+1}`}));
 runtime.model.times=Array(30).fill(1);
 await render(OverviewScreen,{},async r=>{
  const grid=r.root.findByType('scroll');
  assert.equal(grid.props.scrollEnabled,true);
  assert.equal(grid.props.style.height,208);
  assert.equal(r.root.findAllByType('pressable').filter(n=>n.props.accessibilityLabel?.startsWith('Slide ')).length,30);
 });
});

test('Listen Back from Wait returns to Full Review, and Full Review opens Listen Back with its own origin',async()=>{
 setup();runtime.nav={...runtime.nav,from:'wait',sel:1};
 await render(ListenBackKaraokeScreen,{},async r=>{
  const area=r.root.findByProps({testID:'listenTranscriptTouchArea'});
  await act(async()=>{area.props.onTouchStart({nativeEvent:{pageX:180,pageY:550}});
   area.props.onTouchEnd({nativeEvent:{pageX:180,pageY:660}});});
  assert.deepEqual(runtime.routes.at(-1),['full',{deckId:'deck',sel:1,from:'wait'}]);
 });
 await render(OverviewScreen,{},async r=>{
  await act(async()=>byText(r,'Listen back').props.onPress());
  assert.deepEqual(runtime.routes.at(-1),['listen',{deckId:'deck',sel:1,from:'full'}]);
 });
});

test('Full Review and Listen Back fade halfway with a downward swipe before navigating',async()=>{
 setup();
 await render(OverviewScreen,{},async r=>{
  const pan=r.root.findByType('pan');
  await act(async()=>{pan.props.onMove({}, {dy:90,dx:0});r.update(React.createElement(OverviewScreen));});
  assert.equal(r.root.findByType('pan').props.style[1].opacity,0.5);
  await act(async()=>r.root.findByType('pan').props.onRelease({}, {dy:100,dx:0}));
  assert.equal(runtime.routes.at(-1)[0],'home');
 });
 runtime.nav={...runtime.nav,from:'full'};
 await render(ListenBackKaraokeScreen,{},async r=>{
  const area=r.root.findByProps({testID:'listenTranscriptTouchArea'});
  await act(async()=>{area.props.onTouchStart({nativeEvent:{pageX:180,pageY:550}});
   area.props.onTouchMove({nativeEvent:{pageX:180,pageY:640}});
   r.update(React.createElement(ListenBackKaraokeScreen));});
  assert.equal(r.root.findAllByType('pan')[0].props.style[1].opacity,0.5);
  await act(async()=>area.props.onTouchEnd({nativeEvent:{pageX:180,pageY:660}}));
  assert.equal(runtime.routes.at(-1)[0],'full');
 });
});

test('Full Review stays opaque underneath the Q&A entrance',async()=>{
 setup();
 await render(OverviewScreen,{active:true},async r=>{
  await act(async()=>{r.root.findByType('pan').props.onMove({}, {dx:0,dy:-90});r.update(React.createElement(OverviewScreen,{active:true}));});
  assert.equal(r.root.findByType('pan').props.style[1].opacity,1);
  await act(async()=>r.root.findByType('pan').props.onRelease({}, {dx:0,dy:-100}));
  assert.equal(runtime.routes.at(-1)[0],'qa');
  await act(async()=>r.update(React.createElement(OverviewScreen,{active:false})));
  await act(async()=>r.update(React.createElement(OverviewScreen,{active:false})));
  assert.equal(r.root.findByType('pan').props.style[1].opacity,1);
 });
});

// OpenAI Codex, 2026-11-21: slide navigation in Listen back now uses only its arrows.
test('Listen Back ignores horizontal swipes and changes slides with arrows',async()=>{
 setup();runtime.reducedMotion=false;
 await render(ListenBackKaraokeScreen,{},async r=>{
  const area=r.root.findByProps({testID:'listenTranscriptTouchArea'});
  await act(async()=>{area.props.onTouchStart({nativeEvent:{pageX:180,pageY:550}});
   area.props.onTouchEnd({nativeEvent:{pageX:85,pageY:553}});});
  assert.match(text(r),/Slide 1 · First/);
  await act(async()=>button(r,'Next slide').props.onPress());
  assert.match(text(r),/Slide 2 · Second/);
  assert.equal(runtime.plays.length,0,'arrow navigation stays idle until Play or a word tap');
 });
});

// OpenAI Codex matched Feedback's horizontal motion to the existing Q&A slide-only transition.
test('Feedback points slide without a horizontal fade while downward swipes return to review',async()=>{
 setup();runtime.reducedMotion=false;
 runtime.feedback.items[0].findings=[{category:'timing',suggestion:'Shorten the opening',speech_quote:'',start_ms:0,end_ms:0}];
 runtime.feedback.items[1].findings=[{category:'delivery',suggestion:'Pause before the result',speech_quote:'',start_ms:0,end_ms:0}];
 runtime.feedback.items[2].findings=[];
 await render(FeedbackScreen,{},async r=>{
  await act(async()=>{r.root.findByType('pan').props.onMove({}, {dx:-90,dy:2});r.update(React.createElement(FeedbackScreen));});
  const moving=r.root.findAllByType('animated').find(n=>n.props.style?.[1]?.transform?.[0]?.translateX<0);
  assert.ok(moving);assert.equal(moving.props.style[1].opacity,1);
  await act(async()=>r.root.findByType('pan').props.onRelease({}, {dx:-90,dy:2}));
  assert.match(text(r),/2 of 2/);
  await act(async()=>r.root.findByType('pan').props.onMove({}, {dx:-65,dy:110}));
  await act(async()=>r.root.findByType('pan').props.onRelease({}, {dx:-65,dy:110}));
  assert.equal(runtime.routes.at(-1)[0],'full');
 });
});

test('Wait opens Listen Back above Full Review so a downward fade has the right destination',async()=>{
 setup();await render(WaitScreen,{},async r=>{
  await act(async()=>byText(r,'Listen back while you wait').props.onPress());
  assert.deepEqual(runtime.routes.slice(-2),[
   ['full',{deckId:'deck',sel:0,from:'wait',nav:null}],
   ['listen',{deckId:'deck',sel:0,from:'full'}],
  ]);
 });
});

test('Legacy Listen Back entered from rehearsal returns to the selected rehearsal slide',async()=>{
 setup();runtime.nav={...runtime.nav,from:'rehearse',slide:0,sel:1};await render(LegacyListenBackScreen,{},async r=>{
  await act(async()=>button(r,'Back to slides').props.onPress());assert.deepEqual(runtime.routes.at(-1),['rehearse',{nav:null,deckId:'deck',slide:1}]);
 });
});


test('comparison keeps the selected take and returns to rehearsal; Back preserves the pending choice',async()=>{
 const {CompareScreen}=await import('../src/screens/CompareScreen.tsx');
 for(const choice of ['old','new','back']){
  setup();runtime.choices=[];runtime.nav.sel=1;runtime.model.state.takes=2;
  const prev=runtime.model.state.run,next={...prev,id:'new',takeNo:2};runtime.model.state.compare={slides:[1],whole:false,prev,next};
  await render(CompareScreen,{},async r=>{
   if(choice==='back')await act(async()=>runtime.back());else{
    if(choice==='new')await act(async()=>r.root.findAllByType('pressable').find(n=>n.findAllByType('text').some(t=>t.children.join('')==='New take')).props.onPress());
    await act(async()=>r.root.findByType('record-button').props.onPress());
   }
   assert.deepEqual(runtime.choices,choice==='back'?[]:[choice==='new'?'new':'old']);assert.equal(runtime.routes.at(-1)[0],'rehearse');assert.equal(runtime.routes.at(-1)[1][choice==='back'?'slide':'sel'],1);if(choice==='back')assert.ok(runtime.model.state.compare);
  });
 }
});

test('comparison keep action stays centred between Play and footer hints across window sizes',async()=>{
 const {CompareScreen}=await import('../src/screens/CompareScreen.tsx');
 for(const [frameHeight,compact] of [[844,false],[1200,false],[760,true],[700,true]]){
  setup();runtime.frameHeight=frameHeight;runtime.frameCompact=compact;
  const prev=runtime.model.state.run;runtime.model.state.compare={slides:[0],whole:false,prev,next:{...prev,id:'new',takeNo:2}};
  await render(CompareScreen,{},async r=>{
   const button=r.root.findByType('record-button');
   const top=button.props.style.at(-1).top;
   const label=r.root.findAllByType('text').find(node=>node.props.children==='Keep this take');
   const hintTop=(compact?760:844)-24-22;
   assert.equal(top-526,hintTop-(top+116));
   assert.equal(label.props.style.at(-1).top,top+94);
   assert.ok(label.props.style.at(-1).top+22<hintTop);
  });
 }
});


test('returning from overall slide review opens its selected slide preview',async()=>{
 setup();runtime.nav={...runtime.nav,from:'full',sel:1};await render(ReviewScreen,{},async r=>{
  await act(async()=>runtime.back());assert.deepEqual(runtime.routes.at(-1),['rehearse',{deckId:'deck',slide:1,sel:1}]);
 });
 setup();runtime.nav={...runtime.nav,from:'review',sel:1};await render(LegacyListenBackScreen,{},async r=>{
  await act(async()=>button(r,'Back to review').props.onPress());assert.equal(runtime.routes.at(-1)[0],'review');assert.equal(runtime.routes.at(-1)[1].sel,1);
 });
});


test('Android Back from slide review returns to the selected slide preview',async()=>{
 setup();runtime.nav={...runtime.nav,from:'full',sel:1};await render(ReviewScreen,{},async()=>{
  await act(async()=>runtime.back());assert.deepEqual(runtime.routes.at(-1),['rehearse',{deckId:'deck',slide:1,sel:1}]);
 });
});

test('swiping past the last slide returns to overall feedback without replacing its origin',async()=>{
 for(const [from,expected] of [['full',{deckId:'deck',sel:2}],['rehearse',{deckId:'deck',sel:2,from:'rehearse'}]]){
  setup();runtime.nav={...runtime.nav,from,sel:2};
  await render(ReviewScreen,{},async r=>{
   await act(async()=>r.root.findByType('pan').props.onRelease({}, {dx:-90,dy:0}));
   assert.deepEqual(runtime.routes.at(-1),['full',expected]);
  });
 }
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
   if(which==='new')await act(async()=>r.root.findAllByType('pressable').find(n=>n.findAllByType('text').some(t=>t.children.join('')==='New take')).props.onPress());
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

test('Home restores the verified score color and current critical/duration/pace metrics in both themes',async()=>{for(const theme of ['dark','light']){setup();runtime.theme=theme;
 runtime.scores={items:[{score:30,level:'beginning'},{score:67,level:'competent'}],overall:{score:67,level:'competent',status:'Graded',state:null,result:null,target:null}};
 let opened=0;await render(HomeFeedbackStats,{deckId:'deck',active:true,home:{p:{value:0},vy:{value:0}},onOpenReview:()=>opened++},async r=>{
  const score=button(r,'Open full review, presentation score 67 percent');assert.ok(score);
  assert.equal(score.findAllByType('text')[0].props.style.at(-1).color,runtime.palettes[theme].gold);
  assert.match(text(r),/critical/);assert.match(text(r),/0:04/);assert.match(text(r),/130/);
  await act(async()=>score.props.onPress());assert.equal(opened,1);
 });
}});

test('Home does not invent an overall score for combined recordings',async()=>{setup();
 runtime.scores={items:[{score:67,level:'competent'},{score:null,level:null}],overall:{score:null,level:null,status:'Combined recordings',state:null,result:null,target:null}};
 await render(HomeFeedbackStats,{deckId:'deck',active:true,home:{p:{value:0},vy:{value:0}},onOpenReview:()=>{}},async r=>{
  assert.match(text(r),/—/);assert.match(text(r),/Record a full run for an overall score/);assert.equal(r.root.findAllByType('pressable').length,0);
 });
});

test('Home stats fade continuously at a halfway carousel position',async()=>{
 setup();const home={p:{value:0.5},vy:{value:0}};
 for(const index of [0,1])await render(HomeFeedbackStats,{deckId:'deck',home,index,count:2,active:index===0,onOpenReview:()=>{}},async r=>{
  const panel=r.root.findByType('animated');
  assert.equal(panel.props.style[1].opacity,0.5);
  assert.equal(panel.props.pointerEvents,index===0?'box-none':'none');
 });
});

test('Legacy Listen Back dragging within a slide previews and seeks that exact offset without starting idle audio',async()=>{
 setup();runtime.audio.set('b','file://b.m4a');runtime.model.times=[20,40,0];runtime.model.total=60;
 runtime.model.state.run.parts[0].segments=[{startMs:1000,endMs:11000},{startMs:20000,endMs:30000}];
 runtime.model.state.run.parts[1].segments=[{startMs:5000,endMs:45000}];
 await render(LegacyListenBackScreen,{},async r=>{
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
test('Legacy Listen Back commits playing seeks, keeps paused seeks paused and cancels a gesture without seeking',async()=>{
 longRun();await render(LegacyListenBackScreen,{},async r=>{
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
test('Legacy Listen Back does not silently jump a missing target and partial confirmation retains its exact offset',async()=>{
 longRun();runtime.audio.delete('b');await render(LegacyListenBackScreen,{},async r=>{
  await prepareTrack(r);await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:166}}));await act(async()=>runTrack(r).props.onRelease());
  assert.equal(runtime.plays.length,0);assert.match(text(r),/Audio for slide 2/);assert.equal(r.root.findAllByType('dialog').length,0);
  await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));await act(async()=>runTrack(r).props.onRelease());
  assert.equal(runtime.plays.length,0);await act(async()=>r.root.findByType('dialog').props.onConfirm());
  assert.equal(runtime.plays.at(-1).elapsedMs,15000);assert.equal(runtime.players[0].paused,true);assert.equal(runtime.plays.at(-1).segments.length,2);
 });
});
test('Legacy Listen Back discards scrub and missing-audio confirmation after selected recordings change',async()=>{
 longRun();await render(LegacyListenBackScreen,{},async r=>{
  await prepareTrack(r);await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));const release=runTrack(r).props.onRelease;
  runtime.model={...runtime.model,state:{...runtime.model.state,run:{...runtime.model.state.run,parts:[{attemptId:'new',segments:[{startMs:0,endMs:20000}]},...runtime.model.state.run.parts.slice(1)]}}};
  await act(async()=>r.update(React.createElement(LegacyListenBackScreen)));await act(async()=>release());assert.equal(runtime.plays.length,0);
 });
 longRun();runtime.audio.delete('b');await render(LegacyListenBackScreen,{},async r=>{
  await prepareTrack(r);await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));await act(async()=>runTrack(r).props.onRelease());const confirm=r.root.findByType('dialog').props.onConfirm;
  runtime.model={...runtime.model,state:{...runtime.model.state,run:{...runtime.model.state.run,parts:[null,...runtime.model.state.run.parts.slice(1)]}}};
  await act(async()=>r.update(React.createElement(LegacyListenBackScreen)));await act(async()=>confirm());assert.equal(runtime.plays.length,0);
 });
});
test('Legacy Listen Back cancels scrub on background or navigation and exposes five-second accessible seeks',async()=>{
 for(const leave of ['background','navigation','back']){
  longRun();await render(LegacyListenBackScreen,{},async r=>{
   await prepareTrack(r);await act(async()=>runTrack(r).props.onGrant({nativeEvent:{pageX:91}}));const release=runTrack(r).props.onRelease;
   if(leave==='background')await act(async()=>{AppState.emit('background');AppState.emit('active');});
   else if(leave==='back')await act(async()=>runtime.back());
   else await act(async()=>r.update(React.createElement(LegacyListenBackScreen,{active:false})));
   await act(async()=>release());assert.equal(runtime.plays.length,0);
  });
 }
 longRun();await render(LegacyListenBackScreen,{},async r=>{
  await act(async()=>runTrack(r).props.onAccessibilityAction({nativeEvent:{actionName:'increment'}}));
  assert.equal(runtime.players[0].elapsedMs,5000);assert.equal(runtime.players[0].paused,true);assert.equal(runTrack(r).props.accessibilityValue.now,5);assert.match(runTrack(r).props.accessibilityValue.text,/0:05 of 1:00/);
  await act(async()=>runTrack(r).props.onAccessibilityAction({nativeEvent:{actionName:'decrement'}}));assert.equal(runtime.players[0].elapsedMs,0);
 });
});

test('a retained accessibility action cannot seek the previous selected recording after source change',async()=>{
 longRun();await render(LegacyListenBackScreen,{},async r=>{
  const oldAction=runTrack(r).props.onAccessibilityAction;
  runtime.audio.set('new','file://new.m4a');
  runtime.model={...runtime.model,state:{...runtime.model.state,run:{...runtime.model.state.run,parts:[{attemptId:'new',segments:[{startMs:1000,endMs:21000}]},...runtime.model.state.run.parts.slice(1)]}}};
  await act(async()=>r.update(React.createElement(LegacyListenBackScreen)));
  await act(async()=>oldAction({nativeEvent:{actionName:'increment'}}));
  assert.equal(runtime.plays.length,0,'the stale handler must not load or seek the old audio source');
 });
});

// Supplied Claude patch, OpenAI Codex integration, Iteration 2 (2026-11-20): two regions and full text.
test('Feedback shows two regions and opens the whole point when the server flags text as too long',async()=>{
 setup();
 const improvement={criterion:'explanation_depth',headline:'Mountains left out',problem:'',action:'Link them.',example:'“"The river divides the city."”',
  explanation:['The slide shows the mountains, but you never mention them','You describe only the river'],steps:['Link the river and the mountains'],
  over_limit:[],evidence:[{kind:'speech',id:'s2.1',slide_index:1,start_ms:12000,end_ms:15000,text:'Seoul is shaped by the Han River.'}],gain_slide_points:4,gain_overall_points:1.4};
 runtime.v3={items:[{slide:1,attemptId:'a',v3:{improvements:[improvement],criteria:[]}}],overall:{attemptId:'a',run:{whole:{status:'scored',top_priorities:[]}}},outdated:false};
 try{
  await render(FeedbackScreen,{},async r=>{
   const page=text(r);
   for(const part of ['Mountains left out','You describe only the river','YOU SAID','Seoul is shaped by the Han River.','SAY:','“The river divides the city.”','TRY:','Link the river and the mountains','Explanation','+1.4 pts','1 of 1'])
    assert.ok(page.includes(part),part);
   assert.equal(byText(r,'Read all'),undefined,'nothing is cut, so nothing to open');
   improvement.headline='Connect the river and the surrounding mountains';
   // OpenAI Codex, 2026-11-20: an empty explanation gives the headline the remaining region height.
   const originalExplanation=improvement.explanation;
   const originalEvidence=improvement.evidence;
   improvement.explanation=[];
   await act(async()=>r.update(React.createElement(FeedbackScreen)));
   const headline=()=>r.root.findAllByType('text').find(n=>n.children.join('')===improvement.headline);
   const quotedLines=headline().props.numberOfLines;
   assert.ok(quotedLines>2,'a title without bullets uses the space above the quote');
   const quoteMeasure=r.root.findAllByType('text').find(n=>n.children.join('')==='“Seoul is shaped by the Han River.”'&&n.props.onTextLayout);
   await act(async()=>quoteMeasure.props.onTextLayout({nativeEvent:{lines:[{}]}}));
   const shortQuoteLines=headline().props.numberOfLines;
   assert.ok(shortQuoteLines>quotedLines,'a one-line quote releases its unused height to the title');
   improvement.evidence=[];
   await act(async()=>r.update(React.createElement(FeedbackScreen)));
   assert.ok(headline().props.numberOfLines>shortQuoteLines,'without a quote the title can fill more of the region');
   improvement.evidence=originalEvidence;
   improvement.explanation=[...originalExplanation,'The third explanation is available in full text'];
   improvement.steps.push('Add a second step','Add a third step');
   await act(async()=>r.update(React.createElement(FeedbackScreen)));
   const longHeadline=headline();
   assert.ok(longHeadline.props.numberOfLines>=2,'the title keeps at least two lines alongside explanation bullets');
   assert.ok(!longHeadline.props.adjustsFontSizeToFit,'Android must not shrink the headline unpredictably');
   assert.ok(longHeadline.props.style.flat().some(s=>s?.fontSize===23),'longer card titles use a smaller fixed font');
   assert.ok(text(r).includes('You describe only the river…'),'hidden explanation bullets end with an ellipsis');
   assert.ok(text(r).includes('Add a second step…'),'hidden steps end with an ellipsis');
   // OpenAI Codex, 2026-11-20: compact cards reserve room for the pinned quote and category tag.
   runtime.frameCompact=true;
   improvement.headline='강과 산의 관계를 더 분명하게 설명해 주세요';
   improvement.explanation=originalExplanation;
   improvement.steps=['Link the river and the mountains'];
   await act(async()=>r.update(React.createElement(FeedbackScreen)));
   const koreanTitle=r.root.findAllByType('text').find(n=>n.children.join('')===improvement.headline);
   assert.ok(koreanTitle.props.numberOfLines>=2);
   assert.ok(koreanTitle.props.style.flat().some(s=>s?.fontSize===20),'a 24-character Korean title uses the two-line compact size');
   assert.equal(regions(760).r1[1]-regions(760).r1[0],321);
   assert.ok(text(r).includes('Explanation'),'the category stays visible in the first region');
   const fullLegacyTitle='The explanation of the river and surrounding mountains needs more context to make the relationship clear';
   improvement.headline=fullLegacyTitle;
   improvement.explanation=[];
   await act(async()=>r.update(React.createElement(FeedbackScreen)));
   const fullCardTitle=r.root.findAllByType('text').find(n=>n.children.join('')===fullLegacyTitle);
   assert.ok(fullCardTitle,'the original specific title stays on the card');
   assert.ok(fullCardTitle.props.numberOfLines>=6,'without bullets, the original title uses the space above the quote');
   assert.ok(fullCardTitle.props.style.flat().some(s=>s?.fontSize===18),'legacy titles use a readable smaller size');
   assert.equal(r.root.findAllByType('view').some(n=>n.props.style?.minHeight===0&&n.props.style?.overflow==='hidden'),true,
    'the title area clips independently before the quote, so the sections cannot overlap');
   improvement.over_limit=['example'];
   await act(async()=>r.update(React.createElement(FeedbackScreen)));
   await act(async()=>byText(r,'Read all').props.onPress());
   assert.equal(r.root.findAllByType('scroll').length,1,'the whole point opens full screen');
   assert.ok(text(r).includes(fullLegacyTitle),'Read all preserves the complete original title');
   await act(async()=>runtime.back());
   assert.equal(r.root.findAllByType('scroll').length,0);
   assert.equal(runtime.routes.length,0,'Back closes the full text before leaving the page');
   await act(async()=>runtime.back());
   assert.equal(runtime.routes.at(-1)[0],'full');
  });
 }finally{runtime.v3=null;}
});
