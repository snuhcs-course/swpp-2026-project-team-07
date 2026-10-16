// Synthetic source data; native rendering/player boundaries only are mocked.
import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/ai-overview-screen-loader.mjs';registerHooks({resolve,load});
const React=await import('react');const {act,create}=await import('react-test-renderer');
const {runtime}=await import('./helpers/ai-overview-screen-native.mjs');
const {ReviewScreen}=await import('../src/screens/ReviewScreen.tsx');
const {FullReviewScreen}=await import('../src/screens/FullReviewScreen.tsx');
const {HomeFeedbackStats}=await import('../src/screens/HomeFeedbackStats.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
function setup(){
 runtime.routes=[];runtime.plays=[];runtime.players=[];runtime.scrolls=[];runtime.audio=new Map([['a','file://a.m4a']]);runtime.theme='dark';
 runtime.nav={deckId:'deck',sel:0,slide:0,from:null,nav:null};
 const parts=[{attemptId:'a',segments:[{startMs:0,endMs:1000},{startMs:2000,endMs:3000}]},{attemptId:'b',segments:[{startMs:0,endMs:2000}]},null];
 runtime.model={deck:{id:'deck',title:'Synthetic deck',hue:'blue',pages:[],slides:[{title:'First'},{title:'Second'},{title:'Third'}],targets:[60,60,60],text:'ready',timing:{source:'suggested'},requirementsDefault:false},n:3,state:{run:{id:'run',parts,createdAt:new Date().toISOString(),sel:0,targetSum:180},fixes:0},times:[2,2,0],total:4,targetSum:180,lines:[],points:[[],[],[]],ai:[],transcripts:new Map([['a',{}],['b',{}]]),stages:new Map(),stats:{coverage:100,said:2,total:2,fpm:0,wpm:130,pace:'steady'}};
 runtime.feedback={items:[{slide:0,status:'reviewed',label:'4 findings',findingCount:4,assessed:true,hasFindings:true,tone:'warn'},{slide:1,status:'insufficient',label:'Insufficient evidence',findingCount:0,assessed:false,hasFindings:false,tone:'muted'},{slide:2,status:'not_recorded',label:'Not recorded',findingCount:0,assessed:false,hasFindings:false,tone:'muted'}],aggregate:{recorded:2,assessed:1,findings:4,slidesWithFindings:1,partial:0,pending:0,outdated:0,recoveryNeeded:0,insufficient:1,notAnalyzed:0},refresh:async()=>{},offline:false,notice:''};
}
const text=r=>JSON.stringify(r.toJSON());
const button=(r,label)=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel===label);
async function render(Component,props,f){let r;try{await act(async()=>{r=create(React.createElement(Component,props));});await f(r);}finally{if(r)await act(async()=>r.unmount());}}
test('Review uses AI count, page scroll, selected-source evidence and tappable navigation',async()=>{setup();await render(ReviewScreen,{},async r=>{
 assert.equal(r.root.findByType('score-ring').props.value,4);assert.equal(r.root.findByType('score-ring').props.percent,null);
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
test('Full Review uses assessment completion/status tiles and discloses partial audio before playing',async()=>{setup();await render(FullReviewScreen,{},async r=>{
 const ring=r.root.findByType('score-ring');assert.equal(ring.props.value,'1/2');assert.match(ring.props.label,/assessed/i);assert.doesNotMatch(text(r),/Strong|Weak|points said/);
 assert.match(text(r),/Insufficient evidence/);assert.match(text(r),/4 findings/);
 await act(async()=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel?.startsWith('Play the whole run')).props.onPress());
 assert.equal(runtime.plays.length,0);assert.match(text(r),/missing|unavailable|on this phone/i);
 await act(async()=>r.root.findByType('dialog').props.onConfirm());assert.equal(runtime.plays.length,1);assert.equal(runtime.plays[0].segments.length,2);
 await act(async()=>button(r,'Pause').props.onPress());assert.equal(r.root.findAllByType('dialog').length,0,'Pause must not prompt about already accepted missing audio');
 await act(async()=>r.root.findAllByType('pressable').find(x=>x.props.accessibilityLabel?.startsWith('Slide 2,')).props.onPress());assert.equal(runtime.routes.at(-1)[1].sel,1);
 });});
test('Home presents the same AI counts in both themes, with measured pace kept separate',async()=>{for(const theme of ['light','dark']){setup();runtime.theme=theme;
 await render(HomeFeedbackStats,{deckId:'deck',active:true,home:{p:{value:0},vy:{value:0}}},async r=>{const ring=r.root.findByType('score-ring');assert.equal(ring.props.value,'1/2');assert.match(ring.props.label,/assessed/i);assert.match(text(r),/4/);assert.match(text(r),/findings/);assert.doesNotMatch(text(r),/100%|On point|slide points said/);});
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
