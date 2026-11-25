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
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;globalThis.fetch=fetchBefore;setupNative.frame={top:0,left:0,s:1,width:390,height:844};delete setupNative.rotationLayouts;});

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

test('saved cues stay quiet during background reads and spin only during a manual refresh',async t=>{
 const state=profiles();setup({state});const pending=[];
 runtime.reducedMotion=false;runtime.inspectAnimatedStyles=true;
 globalThis.fetch=async(_url,{signal})=>new Promise((resolve,reject)=>{
  pending.push({signal,finish:()=>resolve(new Response(JSON.stringify(state))),fail:()=>reject(new Error('Offline'))});
 });
 const r=await mount();
 const refresh=()=>button(r,'Refresh with server');
 const assertRefresh=busy=>{
  assert.equal(refresh().props.disabled,busy);
  assert.equal(refresh().props.accessibilityState.busy,busy);
  assert.equal(refresh().findByType('animated').props.style.read().transform[0].rotate,busy?'360deg':'0deg');
 };
 assert.equal(pending.length,1);
 assertRefresh(false);
 await tap(button(r,'Open Must cover cues'));
 assert.match(text(r),/Explain how measured growth/);
 assert.doesNotMatch(text(r),/Requesting AI cues/,'a background read is not a new cue request');
 await tap(button(r,'Close cue sheet'));
 await tap(refresh());
 await act(async()=>r.root.findByType('dialog').props.onConfirm());assertRefresh(true);
 assert.equal(pending.length,2);
 assert.equal(pending[0].signal.aborted,true);
 await act(async()=>pending[0].finish());assertRefresh(true);
 await act(async()=>pending[1].finish());assertRefresh(false);
 await tap(refresh());
 await act(async()=>r.root.findByType('dialog').props.onConfirm());assertRefresh(true);
 t.mock.timers.enable({apis:['setTimeout']});
 await act(async()=>pending[2].fail());assertRefresh(false);
 await act(async()=>t.mock.timers.tick(2500));
 assert.equal(pending.length,4);
 assertRefresh(false);
 await act(async()=>pending[3].finish());assertRefresh(false);
});

test('only active rehearsal with a confirmed absent cue job automatically starts generation', async () => {
  const absent = descriptionState({ state: 'absent', descriptions: null, available_data: false,
    description_set_id: null, provenance: null, processing_revision: 0, description_revision: 0 });
  const failed = { ...profiles(), state: 'failed', descriptions: null, available_data: false,
    retry_available: true, error: { code: 'invalid_descriptions', message: 'Synthetic failure' } };
  setup({ state: absent });
  let confirmAbsent;
  globalThis.fetch = async (url, { method = 'GET' } = {}) => {
    requests.push({ url, method });
    if (requests.length === 1) return new Promise(resolve => {
      confirmAbsent = () => resolve(new Response(JSON.stringify(absent)));
    });
    return new Response(JSON.stringify(failed));
  };
  const r = await mount(false);
  const show = active => act(async () => r.update(React.createElement(ThemeProvider, null,
    React.createElement(ThemeToggle), React.createElement(RehearseScreen, { active }))));
  assert.equal(requests.length, 0);
  await show(true);
  assert.deepEqual(requests.map(r => r.method), ['GET'], 'cached absent is not an admission');
  await act(async () => confirmAbsent());
  assert.match(requests.find(r => r.method === 'POST').url, /\/profiles\/generate\/$/);
  assert.equal(button(r, 'Refresh with server').props.accessibilityState.busy, false);
  await show(false);
  await show(true);
  assert.equal(requests.filter(r => r.method === 'POST').length, 1, 'a failed job is not retried automatically');
});

test('a linked presentation shows a cue check in portrait and landscape while its first read is pending', async () => {
  setup({ state: null });
  let finish;
  globalThis.fetch = async () => new Promise(resolve => { finish = resolve; });
  const r = await mount();
  const assertChecking = () => {
    assert.equal(text(r).match(/Checking AI cues…/g)?.length, 2);
    assert.doesNotMatch(text(r), /AI cues are unavailable offline/);
  };
  assertChecking();
  await tap(round(r, 'Open full-screen landscape player'));
  await tap(button(r, 'Open cue panel'));
  assertChecking();
  await act(async () => finish(new Response(JSON.stringify(profiles()))));
  assert.doesNotMatch(text(r), /Checking AI cues…/);
  assert.match(text(r), /Explain how measured growth/);
});

for (const accepted of [true, false]) {
  test(`rehearsal checks the cue job after a lost admission reply (accepted: ${accepted})`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const absent = descriptionState({ state: 'absent', descriptions: null, available_data: false,
      description_set_id: null, provenance: null, processing_revision: 0, description_revision: 0 });
    const completed = profiles();
    setup({ state: absent });
    let writes = 0;
    globalThis.fetch = async (url, { method = 'GET' } = {}) => {
      requests.push({ url, method });
      if (method === 'POST' && ++writes === 1) return new Response(null, { status: 504 });
      const exists = writes > 1 || (writes === 1 && accepted);
      return new Response(JSON.stringify(exists ? completed : absent));
    };
    await mount();
    assert.deepEqual(requests.map(request => request.method), ['GET', 'POST']);
    await act(async () => t.mock.timers.tick(2500));
    assert.deepEqual(requests.map(request => request.method), accepted ? ['GET', 'POST', 'GET'] : ['GET', 'POST', 'GET', 'POST']);
    assertFirst(renderer);
  });
}

for (const loading of [true, false]) {
  test(`an idle downward swipe from the cue cards or footer goes Home with ${loading ? 'loading' : 'ready'} cues`, async () => {
    const state = loading ? { ...profiles(), state: 'submitted', descriptions: null, available_data: false } : profiles();
    setup({ state });
    runtime.reducedMotion = false;
    if (loading) {
      globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
      });
    }
    const r = await mount();
    assert.equal(button(r, 'Refresh with server').props.accessibilityState.busy, false);
    const initialY = loading ? 420 : 780;
    const start = { nativeEvent: { pageY: initialY } };
    const move = { nativeEvent: { pageY: initialY + 25 } };
    const drag = { stateID: 48, numberActiveTouches: 1, dx: 0, dy: 25 };
    const pan = () => r.root.findAllByType('pan')[0];
    await tap(button(r, 'Open Must cover cues'));
    assert.equal(pan().props.onMoveShouldCapture(move, drag), false, 'an open sheet owns the swipe');
    await tap(button(r, 'Close cue sheet'));
    assert.equal(pan().props.onStartShouldCapture(start, drag), false);
    assert.equal(pan().props.onMoveShouldCapture(move, { ...drag, dx: 40 }), false, 'a horizontal drag is left to the slide controls');
    assert.equal(pan().props.onMoveShouldCapture(move, drag), true);
    await act(async () => {
      pan().props.onGrant(move, drag);
      pan().props.onMove(move, { ...drag, dy: 130 });
      pan().props.onRelease();
      runtime.timings.findLast(t => t.duration === 300 && t.complete).complete(true);
    });
    assert.deepEqual(runtime.routes.at(-1), ['home', { nav: null }]);
  });
}

test('slide ticks distinguish a tap and horizontal scrub from a downward Home swipe', async () => {
  setup();
  runtime.reducedMotion = false;
  const r = await mount();
  const [page, strip] = r.root.findAllByType('pan');
  const touch = (pageX, pageY = 340) => ({ nativeEvent: { pageX, pageY } });
  const first = touch(110), second = touch(290);
  const begin = { numberActiveTouches: 1, dx: 0, dy: 0 };
  assert.equal(page.props.onStartShouldCapture(second, begin), false);
  assert.equal(strip.props.onStartShould(second, begin), true);
  strip.props.onGrant(second, begin);
  assert.match(text(r), /Slide 1 of 2/);
  await act(async () => strip.props.onRelease(second, begin));
  assert.match(text(r), /Slide 2 of 2/);

  strip.props.onGrant(second, begin);
  const horizontal = { ...begin, dx: -180, dy: 1 };
  assert.equal(page.props.onMoveShouldCapture(first, horizontal), false);
  await act(async () => strip.props.onMove(first, horizontal));
  assert.match(text(r), /Slide 1 of 2/);
  assert.equal(strip.props.onTerminationRequest(), false, 'the active scrub keeps control');
  strip.props.onRelease(first, horizontal);

  assert.equal(page.props.onStartShouldCapture(second, begin), false);
  strip.props.onGrant(second, begin);
  const early = { ...begin, dy: 6 }, vertical = { ...begin, dy: 25 };
  assert.equal(page.props.onMoveShouldCapture(touch(290, 346), early), false);
  await act(async () => strip.props.onMove(touch(290, 346), early));
  assert.equal(page.props.onMoveShouldCapture(touch(290, 365), vertical), true);
  assert.equal(strip.props.onTerminationRequest(), true, 'the strip yields to the Home swipe');
  assert.match(text(r), /Slide 1 of 2/, 'the downward swipe must not select another slide');
  await act(async () => {
    page.props.onGrant(second, vertical);
    page.props.onMove(touch(290, 470), { ...vertical, dy: 130 });
    page.props.onRelease();
    runtime.timings.findLast(timing => timing.duration === 300 && timing.complete).complete(true);
  });
  assert.deepEqual(runtime.routes.at(-1), ['home', { nav: null }]);
});

test('a downward Home swipe cancels a recorder hold it takes over', async t => {
  setup();
  const r = await mount();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await act(async () => r.root.findByType('record-button').props.onPressIn());
  const pan = r.root.findAllByType('pan')[0];
  const event = { nativeEvent: { pageY: 733 } };
  const drag = { stateID: 49, dx: 0, dy: 25 };
  assert.equal(pan.props.onMoveShouldCapture(event, drag), true);
  await act(async () => {
    pan.props.onGrant(event, drag);
    t.mock.timers.tick(1600);
  });
  assert.equal(r.root.findAllByType('dialog').length, 0);
});

test('ready cues remain visible while the selected language is still being translated', async () => {
  const { setAppLanguage } = await import('../src/design/language.ts');
  const { markNewWording } = await import('../src/features/localization/firstWording.ts');
  const state = profiles();
  const slide = state.descriptions.slides[0];
  slide.must_cover.push({ text: '이 결과의 의미를 정확하게 알려 주세요.', evidence_refs: ['summary'] });
  slide.go_deeper = [];
  setup({ state });
  setAppLanguage('en');
  markNewWording(api, 'profiles', state.description_set_id, String(state.description_revision));
  let finishTranslation;
  globalThis.fetch = async (_url, init) => {
    if (init.method === 'GET') return Response.json(state);
    const request = JSON.parse(init.body);
    return new Promise(resolve => {
      finishTranslation = () => resolve(Response.json({
        id: '7'.repeat(64), state: 'completed', language: 'en',
        translations: Object.fromEntries(Object.keys(request.fields).map(path => [path, 'Explain what the result means.'])),
      }));
    });
  };
  const r = await mount();
  assert.match(text(r), /Explain how measured growth/);
  assert.match(text(r), /No additional suggestions for this slide/);
  await tap(button(r, 'Open Must cover cues'));
  assert.match(text(r), /Translating cues/);
  assert.doesNotMatch(text(r), /Preparing AI cues|Requesting AI cues|Waiting for English cues|이 결과의 의미/);
  await act(async () => finishTranslation());
  assert.match(text(r), /Explain what the result means/);
  assert.doesNotMatch(text(r), /Translating cues/);
});

test('the portrait presentation footer centers redo and Home together', async () => {
  setup();
  const r = await mount();
  const row = r.root.findByType('hints');
  assert.deepEqual(row.props.hints.map(hint => hint.text), ['Hold to redo all', 'Home']);
  assert.equal(row.props.style, undefined, 'the footer uses the standard centered positioning');
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

test('countdown checks live feedback early and holds the starting state until capture starts', async t => {
 t.mock.timers.enable({apis:['Date','setInterval'],now:0});
 setup({saved:false});
 const r=await mount();
 const capture=runtime.captures[0];
 const capability=Promise.resolve(false);
 let probes=0;
 capture.checkLiveFeedback=()=>{probes++;return capability;};
 const start=capture.start.bind(capture);
 capture.start=(slide,checked)=>{assert.equal(checked,capability);return start(slide);};
 let ready;
 runtime.startWait=new Promise(resolve=>{ready=resolve;});
 const record=()=>r.root.findByType('record-button');
 await tap(record());
 assert.equal(probes,1);
 assert.equal(capture.started,0);
 await act(async()=>t.mock.timers.tick(3000));
 assert.equal(record().props.glyph,1);
 assert.equal(record().props.label,'Starting recorder…');
 assert.equal(record().props.disabled,true);
 assert.equal(r.root.findByType('waveform').props.live,false);
 await act(async()=>ready());
 assert.equal(probes,1);
 assert.equal(capture.started,1);
 assert.equal(record().props.label,'Stop recording');
 assert.equal(r.root.findByType('waveform').props.live,true);
});

function animatedRotationFixture() {
 runtime.reducedMotion=false;
 runtime.inspectAnimatedStyles=true;
 const screen={width:390,height:844};
 const portrait={...screen,info:{...screen,left:19.5,top:80,s:0.9,compact:true},designW:390,designH:760,rotatedPortrait:false};
 const landscape={...screen,info:{width:844,height:390,left:0,top:0,s:1,compact:false},designW:844,designH:390,rotatedPortrait:true};
 setupNative.rotationLayouts=[portrait,landscape];setupNative.frame=portrait.info;
 const modes=[];
 runtime.shell.setFullscreenLandscape=value=>{modes.push(value);setupNative.frame=value?landscape.info:portrait.info;};
 return modes;
}

test('rotation moves the selected PDF through both quarter-turns and retains the capture owner',async()=>{
 setup({slide:1});
 runtime.model.deck.pages=[{uri:'file:///first.png',w:1600,h:900},{uri:'file:///selected.png',w:1600,h:900}];
 const modes=animatedRotationFixture();
 const r=await mount();
 const capture=runtime.captures[0],launch=round(r,'Open full-screen landscape player').props.onPress;
 const timings=()=>runtime.timings.filter(t=>t.duration===240&&t.value===1&&t.complete);
 const preview=()=>r.root.findByProps({testID:'rotation-preview'});
 const pose=()=>preview().props.style.at(-1).read().transform;
 const backdrop=()=>r.root.findByProps({testID:'rotation-backdrop'}).props.style.at(-1).read().opacity;
 await act(async()=>{launch();launch();});
 assert.equal(timings().length,1,'rapid taps request a single handoff');
 assert.deepEqual(modes,[]);
 assert.equal(r.root.findByProps({testID:'presentation-page'}).parent.props.pointerEvents,'none');
 assert.deepEqual(preview().findByType('image').props.source,{uri:'file:///selected.png'});
 const staged=r.root.findByType('mini-slide');
 assert.equal(staged.props.page.uri,'file:///selected.png');
 assert.equal(staged.props.keepPdfWhileLoading,true);
 assert.equal(r.root.findAllByType('status-bar').length,0,'staging does not change the source insets');
 assert.equal(pose()[2].rotate,'0deg');
 assert.equal(backdrop(),0);
 timings()[0].sample(0.5);
 assert.equal(pose()[2].rotate,'45deg');
 assert.ok(pose()[3].scaleX>1);
 assert.ok(backdrop()>0&&backdrop()<1);
 await act(async()=>timings()[0].complete(true));
 assert.deepEqual(modes,[],'an unready landscape image does not replace the painted endpoint');
 assert.equal(pose()[2].rotate,'90deg');
 await act(async()=>staged.props.onImageSettled());
 assert.deepEqual(modes,[true]);
 assert.equal(r.root.findAllByProps({testID:'rotation-preview'}).length,0);
 assert.equal(r.root.findByType('mini-slide'),staged,'the staged thumbnail is retained at commit');
 assert.match(text(r),/2\/2/);

 await tap(button(r,'Return to portrait rehearsal'));
 assert.deepEqual(modes,[true]);
 const portrait=r.root.findByProps({testID:'presentation-page'});
 const portraitOpacity=()=>portrait.props.style.at(-1).read().opacity;
 assert.equal(portraitOpacity(),0);
 assert.ok(button(r,'Edit presentation time and audience'),'the portrait controls mount before the frame switches');
 assert.equal(portrait.parent.props.pointerEvents,'none');
 timings()[1].sample(0.5);
 assert.equal(pose()[2].rotate,'-45deg');
 assert.ok(pose()[3].scaleX<1);
 assert.equal(portraitOpacity(),0);
 timings()[1].sample(0.85);
 assert.ok(portraitOpacity()>0&&portraitOpacity()<1);
 assert.equal(portrait.findByProps({testID:'presentation-slide-track'}).props.style.at(-1).read().opacity,0,
   'only the rotating copy is visible while the portrait controls arrive');
 timings()[1].sample(0.97);
 assert.equal(portraitOpacity(),1);
 assert.deepEqual(modes,[true],'the portrait controls are visible before committing the frame');
 await act(async()=>timings()[1].complete(true));
 assert.deepEqual(modes,[true,false]);
 assert.equal(r.root.findByProps({testID:'presentation-page'}),portrait,'the staged portrait subtree is retained at commit');
 assert.equal(r.root.findAllByProps({testID:'rotation-preview'}).length,0);
 assert.match(text(r),/Slide 2 of 2/);
 assert.deepEqual(runtime.captures,[capture]);
 assert.equal(requests.length,1);
});

test('landscape rotation can commit if the thumbnail event is lost',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 setup();
 runtime.model.deck.pages=[{uri:'file:///test.png',w:1600,h:900}];
 const modes=animatedRotationFixture();
 const r=await mount();
 await tap(round(r,'Open full-screen landscape player'));
 const staging=r.root.findByType('mini-slide');
 const turn=runtime.timings.find(timing=>timing.duration===240&&timing.value===1&&timing.complete);
 await act(async()=>turn.complete(true));
 assert.deepEqual(modes,[]);
 await act(async()=>t.mock.timers.tick(200));
 assert.deepEqual(modes,[true]);
 await act(async()=>staging.props.onImageSettled());
 assert.deepEqual(modes,[true],'a late image event cannot commit again');
});

test('a covered rotation hides its artwork and an unmounted rotation cannot commit',async()=>{
 setup();
 const modes=animatedRotationFixture();
 const r=await mount();
 const screen=active=>React.createElement(ThemeProvider,null,React.createElement(ThemeToggle),React.createElement(RehearseScreen,{active}));
 const pending=()=>runtime.timings.filter(t=>t.duration===240&&t.value===1&&t.complete).at(-1);
 await tap(round(r,'Open full-screen landscape player'));
 const enter=pending();
 await act(async()=>r.update(screen(false)));
 assert.equal(r.root.findAllByProps({testID:'rotation-preview'}).length,0);
 await act(async()=>enter.complete(true));
 assert.deepEqual(modes,[true]);
 assert.equal(button(r,'Open cue panel'),undefined);
 await act(async()=>r.update(screen(true)));
 await tap(button(r,'Return to portrait rehearsal'));
 const exit=pending();
 await act(async()=>r.unmount());
 renderer=null;
 assert.deepEqual(modes,[true,false],'unmount restores the shell frame');
 await act(async()=>exit.complete(true));
 assert.deepEqual(modes,[true,false],'the stale animation cannot change a later screen');
});

test('reduced-motion rotation removes portrait Cues and refresh while retaining the selected slide',async()=>{
 setup();runtime.inspectAnimatedStyles=true;setupNative.frame={top:0,left:0,s:1,width:844,height:390};const r=await mount();await tap(round(r,'Open full-screen landscape player'));
 const hidden=r.root.findAllByType('animated').find(n=>n.props.accessibilityElementsHidden);assert.ok(hidden);assert.equal(hidden.props.pointerEvents,'none');assert.equal(hidden.props.importantForAccessibility,'no-hide-descendants');assert.equal(button(r,'Refresh with server'),undefined);assert.ok(r.root.findByType('record-button'));
 assert.equal(r.root.findAllByProps({testID:'rotation-preview'}).length,0);
 assert.ok(r.root.findByType('record-ring'),'countdown and redo retain the landscape ring');
 const record=r.root.findByType('record-button');assert.equal(record.props.style.top,390-12-56-14,'scaled record position follows the landscape dock row');
 const previewWidth=r.root.findByType('mini-slide').props.width;
 const transform=id=>r.root.findByProps({testID:id}).props.style.at(-1).read().transform;
 assert.equal(transform('landscape-slide').at(-1).scale,1);
 assert.ok(button(r,'Open cue panel'));await tap(button(r,'Open cue panel'));
 assert.ok(button(r,'Close cues'));assert.ok(button(r,'Previous slide'));assert.ok(button(r,'Next slide'));
 assert.ok(runtime.timings.some(t=>t.duration===240&&t.value===1));
 assert.ok(transform('landscape-slide').at(-1).scale<1);
 assert.ok(transform('landscape-record-dock')[0].translateX<0);
 assert.equal(r.root.findByType('mini-slide').props.width,previewWidth,'the shared animation resizes the slide visually without laying out the thumbnail again');
 await tap(button(r,'Close cues'));assert.ok(button(r,'Open cue panel'));
 assert.equal(transform('landscape-slide').at(-1).scale,1);
 assert.equal(Math.abs(transform('landscape-record-dock')[0].translateX),0);
 await tap(button(r,'Review overall feedback'));
 assert.deepEqual(runtime.routes.at(-1),['full',{nav:'rise',deckId:runtime.model.deck.id,sel:0,slide:0,from:'rehearse'}]);
 await navigate(r,'Next');assert.match(text(r),/2\/2/);await tap(button(r,'Return to portrait rehearsal'));assert.match(text(r),/Recap how the final result/);assert.match(text(r),/Connect the conclusion/);assert.ok(button(r,'Refresh with server'));await navigate(r,'Previous');assertFirst(r);assert.equal(requests.length,1);
});

test('landscape uses the same red button as portrait for recording and redoing', async () => {
 for (const [saved, glyph, label] of [[false, 'mic', 'Record'], [true, 'redo', 'Redo']]) {
  setup({saved});
  const r = await mount();
  const portrait = r.root.findByType('record-button').props;
  setupNative.frame = {top: 0, left: 0, s: 1, width: 844, height: 390};
  await tap(round(r, 'Open full-screen landscape player'));
  const landscape = r.root.findByType('record-button').props;
  assert.equal(landscape.glyph, glyph);
  assert.match(landscape.label, new RegExp('^' + label + ' slide 1'));
  assert.ok(!portrait.quiet && !portrait.green && !landscape.quiet && !landscape.green);
  await act(async () => r.unmount());
  renderer = null;
  setupNative.frame = {top: 0, left: 0, s: 1, width: 390, height: 844};
 }
});

test('retapping the landscape slide hides the idle controls and leaves cue controls reachable',async()=>{
 setup();
 setupNative.frame={top:0,left:0,s:1,width:844,height:390};
 const r=await mount();
 await tap(round(r,'Open full-screen landscape player'));
 const slide=()=>button(r,'Show or hide rehearsal controls');
 const bar=()=>r.root.findByProps({testID:'landscape-controls'});
 assert.equal(bar().props.pointerEvents,'box-none');
 await tap(slide());
 assert.equal(bar().props.pointerEvents,'none');
 assert.equal(bar().props.accessibilityElementsHidden,true);
 await tap(slide());
 assert.equal(bar().props.pointerEvents,'box-none');
 await tap(slide());
 assert.equal(bar().props.pointerEvents,'none');
 await tap(slide());
 await tap(button(r,'Open cue panel'));
 assert.equal(slide().props.disabled,true);
 await tap(slide());
 assert.equal(bar().props.pointerEvents,'box-none');
 await tap(button(r,'Close cues'));
 assert.equal(slide().props.disabled,false);
 await tap(slide());
 assert.equal(bar().props.pointerEvents,'none');
});

test('fullscreen and portrait share translated cues without changing the slide or starting profile generation', async () => {
  const { setAppLanguage } = await import('../src/design/language.ts');
  const state = profiles();
  setup({slide: 1, state});
  setupNative.frame = {top: 0, left: 0, s: 1, width: 844, height: 390};
  const r = await mount();
  const screenType = RehearseScreen.type;
  const surface = r.root.findByType(screenType);
  await tap(round(r, 'Open full-screen landscape player'));
  await tap(button(r, 'Open cue panel'));
  const original = state.descriptions.slides[1].must_cover[0].text;
  const korean = '마지막 결과가 결론을 어떻게 뒷받침하는지 정리하세요.';
  assert.ok(text(r).includes(original));
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({url, method: options.method, body});
    const translations = Object.fromEntries(Object.keys(body.fields).map(key =>
      [key, key.includes('.must_cover.') ? korean : '결론을 활용할 수 있는 다른 사례를 제시하세요.']));
    return Response.json({id: '4'.repeat(64), state: 'completed', language: 'ko', translations});
  };
  try {
    await act(async () => setAppLanguage('ko'));
    assert.equal(r.root.findByType(screenType), surface);
    assert.ok(button(r, '발표 도움말 닫기'));
    assert.ok(text(r).includes(korean));
    await tap(button(r, '세로 발표 연습으로 돌아가기'));
    assert.ok(text(r).includes(korean));
    assert.ok(button(r, '다음 슬라이드').props.disabled);
    assert.match(button(r, '서버와 동기화').props.accessibilityHint, /발표 도움말/);
    await act(async () => setAppLanguage('en'));
    assert.ok(button(r, 'Refresh with server'));
    assert.ok(text(r).includes(original));
    assert.equal(r.root.findByType(screenType), surface);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith('/localization/'));
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.kind, 'profiles');
    assert.equal(calls[0].body.resource_id, state.description_set_id);
    assert.ok(Object.keys(calls[0].body.fields).every(key => key.startsWith('slides.1.')));
  } finally { await act(async () => setAppLanguage('en')); }
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

test('theme changes and reopening retain selected-slide cues independently of audio and settings sync',async()=>{
 setup({slide:1,audio:false});const r=await mount();assert.match(text(r),/Recap how the final result/);assert.equal(button(r,'Refresh with server').props.disabled,false);assert.doesNotMatch(text(r),/Status · Tap for detail/);
 await tap(button(r,'Open Must cover cues'));assert.doesNotMatch(text(r),/Audio for this slide|Presentation requirements · sync pending/);await tap(button(r,'Close cue sheet'));
 const cue=()=>r.root.findAllByType('text').find(n=>n.props.children==='Recap how the final result supports the main conclusion');const dark=JSON.stringify(cue().props.style);
 await tap(r.root.findByType('theme-toggle'));assert.notEqual(JSON.stringify(cue().props.style),dark);assert.match(text(r),/Recap how the final result/);assert.equal(requests.length,1);
 await act(async()=>r.unmount());renderer=null;const reopened=await mount();assert.match(text(reopened),/Recap how the final result/);assert.ok(button(reopened,'Refresh with server'));assert.equal(requests.length,2);assert.ok(requests.every(r=>r.method==='GET'));
});

test('closing the portrait cue sheet releases slide input immediately and reopens normally',async()=>{
 setup();runtime.reducedMotion=false;runtime.inspectAnimatedStyles=true;
 const r=await mount();
 const layer=()=>button(r,'Close cue sheet')?.parent;
 const pan=()=>layer().findByType('pan');
 await tap(button(r,'Open Must cover cues'));
 assert.equal(layer().props.pointerEvents,'auto');
 const first=pan(),motion=first.props.style.at(-1).read;
 await act(async()=>first.props.onMove({}, {dx:0,dy:55}));
 assert.equal(motion().transform[0].translateY,55);
 await act(async()=>first.props.onRelease({}, {dx:0,dy:55}));
 assert.equal(motion().opacity,1);
 await tap(button(r,'Close cue sheet'));
 const closeTimings=()=>runtime.timings.filter(timing=>timing.value===220&&timing.complete);
 const [close]=closeTimings();
 assert.ok(close);
 assert.equal(close.duration,190);
 assert.equal(layer().props.pointerEvents,'none');
 assert.equal(layer().props.importantForAccessibility,'no-hide-descendants');
 assert.match(text(r),/Home/);
 await tap(button(r,'Close cue sheet'));
 await act(async()=>{
   first.props.onMove({}, {dx:0,dy:40});
   first.props.onTerminate();
   first.props.onRelease({}, {dx:0,dy:100});
 });
 assert.equal(closeTimings().length,1);
 assert.equal(motion().opacity,0);
 await act(async()=>close.complete(true));
 assert.equal(layer(),undefined);
 assert.deepEqual(motion(),{opacity:0,transform:[{translateY:220}]});
 await tap(button(r,'Open Further insight cues'));
 assert.ok(pan().findAllByType('text').some(n=>n.props.children==='Further insight'));
 assert.equal(pan().props.style.at(-1).read().opacity,1);
 await act(async()=>pan().props.onRelease({}, {dx:0,dy:100}));
 assert.equal(layer().props.pointerEvents,'none','a committed downward swipe immediately releases input');
 await tap(button(r,'Open Must cover cues'));
 const swipeClose=closeTimings().at(-1);
 await act(async()=>swipeClose.complete(true));
 assert.equal(layer().props.pointerEvents,'auto','a stale close completion cannot remove a reopened sheet');
});

test('portrait cue heading gets an extra 5pt gap without lowering the cue cards or shifting the scrim',async()=>{
 for(const compact of [false,true]){
   setup();setupNative.frame={top:0,left:0,s:1,width:390,height:compact?760:844,compact};
   const r=await mount();
   const heading=r.root.findAllByType('text').find(n=>n.props.children==='CUES').parent;
   const panelTop=heading.parent.props.style.at(-1).top;
   const card=button(r,'Open Must cover cues');
   assert.equal(heading.props.style.transform[0].translateY,-5);
   const cardBottom=panelTop+heading.props.style.height+card.parent.props.style.marginTop+card.props.style[0].height;
   assert.equal(cardBottom,compact?454:506);
   await tap(card);
   const scrimLayer=button(r,'Close cue sheet').parent.props.style.at(-1);
   assert.equal(panelTop+scrimLayer.top,0);
   assert.equal(cardBottom-scrimLayer.bottom,setupNative.frame.height);
   await act(async()=>r.unmount());renderer=null;
 }
});

test('interrupted recovery stays quiet until opened from settings and preserves the current slide cues',async()=>{
 setup({slide:1});const recovered={id:'interrupted-take',state:'interrupted',recording:{duration_ms:3000,slide_events:[{slide_index:1,at_ms:0}]}};runtime.recoveries.push(recovered);const r=await mount();
 await act(async()=>runtime.captures[0].props.onInterrupted('Recording interrupted. Saved audio and segments are retained.'));
 assert.doesNotMatch(text(r),/Recording interrupted/);assert.equal(button(r,'Review saved recording'),undefined);
 await tap(button(r,'Edit presentation time and audience'));
 await tap(button(r,'Review saved recording'));assert.equal(r.root.findByType('take-playback').props.initialSlide,1);assert.match(text(r),/Recap how the final result/);
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

test('rehearsal drags its title and slide into Home, restores a cancel and commits once',async()=>{
 setup({saved:false});runtime.inspectAnimatedStyles=true;runtime.reducedMotion=false;
 const r=await mount();const title=runtime.shell.home.titleReturn;
 const page=r.root.findByProps({testID:'presentation-page'});
 const surfaceLayer=page.findByProps({testID:'presentation-surface'});
 const surface=page.findByType('page-surface');
 assert.equal(surface.props.fullBleed,true);
 assert.equal(surface.parent,surfaceLayer,'the full-bleed surface is separate from the artwork');
 const surfaceOpacity=()=>surfaceLayer.props.style.at(-1).read().opacity;
 const titleStyle=()=>page.findByProps({testID:'presentation-title'}).props.style.at(-1).read();
 const titleOffset=()=>titleStyle().transform[0].translateY;
 const closeTo=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.000001);
 const track=()=>page.findByProps({testID:'presentation-slide-track'});
 const slidePose=()=>track().props.style.at(-1).read();
 const arrows=()=>page.findByProps({testID:'presentation-slide-arrows'});
 const arrowPose=()=>arrows().props.style.at(-1).read();
 const restingArrows=[{translateY:0},{scale:1}];
 const assertBottomOpacity=expected=>{
  const hints=r.root.findByType('hints');
  const readout=r.root.findAllByType('text').find(node=>node.children.join('').startsWith('Full run · target'));
  const readoutLayer=r.root.findAllByType('animated').filter(layer=>layer.findAllByType('text').includes(readout)).at(-1);
  assert.equal(hints.parent.props.style.at(-1).read().opacity,expected);
  assert.equal(readoutLayer.props.style.at(-1).read().opacity,expected);
 };
 assert.equal(title.value,0);
 assert.equal(surfaceOpacity(),1);
 assert.equal(titleOffset(),0);
 assert.deepEqual(arrowPose().transform,restingArrows);
 assert.equal(arrowPose().opacity,1);
 assertBottomOpacity(1);
 const pan=r.root.findAllByType('pan')[0];
 await act(async()=>{pan.props.onGrant();pan.props.onMove({}, {dx:0,dy:45});});
 assert.equal(surfaceOpacity(),0.75);
 closeTo(titleOffset(),163.4*0.25/0.74);
 assert.equal(slidePose().transform[1].scale,0.8125);
 assert.deepEqual(arrowPose().transform,restingArrows,'only the slide moves toward Home');
 closeTo(arrowPose().opacity,0.375);
 assert.equal(arrows().props.pointerEvents,'none');
 assert.equal(track().props.pointerEvents,'none');
 assert.equal(pan.props.accessibilityElementsHidden,true);
 assertBottomOpacity(0.5);
 await act(async()=>pan.props.onMove({}, {dx:0,dy:90}));
 assert.equal(title.value,0.5);
 assert.equal(arrowPose().opacity,0);
 closeTo(titleOffset(),163.4*0.5/0.74);
 assertBottomOpacity(0);
 const heldTitleOffset=titleOffset();
 await act(async()=>pan.props.onRelease());
 assert.equal(titleOffset(),heldTitleOffset,'the reset starts from the current drag without a jump');
 const reset=runtime.timings.find(t=>t.duration===180&&t.value===0&&t.complete);
 assert.ok(reset);
 reset.sample(0.25);
 closeTo(titleOffset(),163.4*0.25/0.74);
 await act(async()=>reset.complete(true));
 assert.equal(surfaceOpacity(),1);
 assert.equal(titleOffset(),0);
 assert.equal(slidePose().transform[1].scale,1);
 assert.equal(arrowPose().opacity,1);
 assert.deepEqual(arrowPose().transform,restingArrows);
 assert.equal(arrows().props.pointerEvents,'box-none');
 assertBottomOpacity(1);
 assert.equal(track().props.pointerEvents,'box-none');
 assert.deepEqual(runtime.routes,[]);
 await act(async()=>{pan.props.onGrant();pan.props.onMove({}, {dx:0,dy:130});});
 assertBottomOpacity(0);
 await act(async()=>pan.props.onRelease());
 const finish=runtime.timings.find(t=>t.duration===300&&t.value===1&&t.complete);
 assert.ok(finish);
 finish.sample(0.74);
 assert.equal(titleOffset(),163.4);
 assert.equal(titleStyle().opacity,1);
 finish.sample(0.82);
 assert.equal(titleOffset(),163.4,'the title stays aligned while changing owners');
 closeTo(titleStyle().opacity,0.5);
 finish.sample(0.9);
 assert.equal(titleStyle().opacity,0,'Home has fully taken over before route commit');
 finish.sample(1);
 assert.equal(surfaceOpacity(),0);
 assert.equal(titleOffset(),163.4);
 assert.equal(slidePose().opacity,0);
 assert.equal(track().props.pointerEvents,'none');
 assert.deepEqual(runtime.routes,[],'only the completed handoff enables Home');
 await act(async()=>finish.complete(true));
 assert.equal(title.value,1);
 assert.deepEqual(runtime.routes,[['home',{nav:null}]]);
 await act(async()=>pan.props.onRelease());
 assert.equal(runtime.routes.length,1);
});

test('reduced motion keeps rehearsal opaque during the drag and returns Home on release',async()=>{
 setup();runtime.inspectAnimatedStyles=true;
 const r=await mount();const pan=r.root.findAllByType('pan')[0];
 await act(async()=>{pan.props.onGrant();pan.props.onMove({}, {dx:0,dy:130});});
 assert.equal(r.root.findByProps({testID:'presentation-surface'}).props.style.at(-1).read().opacity,1);
 assert.equal(r.root.findByProps({testID:'presentation-title'}).props.style.at(-1).read().transform[0].translateY,0);
 await act(async()=>pan.props.onRelease());
 assert.deepEqual(runtime.routes,[['home',{nav:null}]]);
 assert.equal(runtime.timings.some(t=>t.duration===300&&t.value===1),false);
});

test('a touch begun during the opaque page entrance is ignored until a fresh touch', async () => {
  setup();
  runtime.reducedMotion = false;
  runtime.inspectAnimatedStyles = true;
  runtime.shell.nav = { ...runtime.shell.nav, from: 'home', nav: 'fade' };
  assert.equal(runtime.shell.home.titleReturn.value, 1, 'the shared return value still belongs to Home at mount');
  const r = await mount();
  const preview = () => r.root.findByProps({ testID: 'presentation-slide-track' }).props.style.at(-1).read();
  const titleStyle = () => r.root.findByProps({ testID: 'presentation-title' }).props.style.at(-1);
  const title = () => titleStyle().read().transform;
  const icon = () => r.root.findByProps({ testID: 'presentation-launch-icon' });
  const surface = r.root.findByProps({ testID: 'presentation-surface' });
  assert.equal(surface.findByType('page-surface').props.fullBleed, true);
  assert.equal(surface.props.style.at(-1).initial.opacity, 1, 'the first native frame is opaque');
  assert.equal(titleStyle().initial.opacity, 1, 'the entrance title is visible before the shared reset');
  assert.deepEqual(titleStyle().initial.transform, [{ translateY: 163.4 }, { scale: 22 / 18 }]);
  assert.equal(icon().props.style.at(-1).read().opacity, 1, 'the selected Home icon shows immediately');
  assert.equal(preview().opacity, 0);
  assert.equal(preview().transform[1].scale, 0.25);
  assert.deepEqual(title(), [{ translateY: 163.4 }, { scale: 22 / 18 }]);
  const page = r.root.findAllByType('pan')[0];
  const slide = r.root.findAllByType('pan').find(node => node.props.accessibilityRole === 'adjustable');
  const event = { nativeEvent: { pageY: 200 } };
  // Native PanResponder reuses the same state ID when a new finger lands.
  const down = { stateID: 42, numberActiveTouches: 1, dx: 0, dy: 100 };
  const across = { stateID: 43, numberActiveTouches: 1, dx: -90, dy: 0 };
  assert.equal(page.props.onStartShouldCapture(event, down), false);
  assert.equal(slide.props.onStartShouldCapture(event, across), false);
  assert.equal(page.props.onMoveShouldCapture(event, down), false);
  assert.equal(slide.props.onMoveShould(event, across), false);

  const pageOpen = runtime.timings.find(timing => timing.value === 1 && timing.duration === 260 && timing.complete);
  assert.ok(pageOpen, 'the connected opening runs inside the opaque page');
  pageOpen.sample(0.5);
  assert.equal(title()[0].translateY, 81.7);
  assert.equal(titleStyle().read().opacity, 1, 'the same title stays visible while it moves into the header');
  assert.equal(preview().transform[1].scale, 0.625);
  assert.ok(preview().opacity > 0);
  assert.equal(icon().props.style.at(-1).read().opacity, 0);
  await act(async () => pageOpen.complete(true));
  assert.equal(r.root.findAllByProps({ testID: 'presentation-launch-icon' }).length, 0);
  assert.deepEqual(title(), [{ translateY: 0 }, { scale: 1 }]);
  assert.equal(titleStyle().read().opacity, 1);
  assert.deepEqual(preview().transform, [{ translateY: 0 }, { scale: 1 }]);
  assert.equal(page.props.onStartShouldCapture(event, { ...down, numberActiveTouches: 2 }), false);
  assert.equal(page.props.onMoveShouldCapture(event, down), false, 'the original contact is still down');
  assert.equal(slide.props.onMoveShould(event, across), false);

  assert.equal(page.props.onStartShouldCapture(event, down), false);
  assert.equal(page.props.onMoveShouldCapture(event, down), true, 'a fresh contact can swipe Home even when its child owns the touch');
  assert.equal(slide.props.onStartShouldCapture(event, across), false);
  assert.equal(slide.props.onMoveShould(event, across), true, 'a fresh contact can swipe between slides');
  await act(async () => { page.props.onGrant(); page.props.onMove(event, down); });
  assert.ok(title()[0].translateY > 0, 'a new drag moves the same title back toward its Home slot');
});

for (const [from, reducedMotion] of [['upload', false], ['home', true]]) {
  test(`rehearsal uses the settled geometry on entrance from ${from} with reduced motion ${reducedMotion}`, async () => {
    setup();
    runtime.reducedMotion = reducedMotion;
    runtime.inspectAnimatedStyles = true;
    runtime.shell.nav = { ...runtime.shell.nav, from, nav: 'fade' };
    const r = await mount();
    assert.equal(r.root.findAllByProps({ testID: 'presentation-launch-icon' }).length, 0);
    const title = r.root.findByProps({ testID: 'presentation-title' }).props.style.at(-1).read();
    assert.deepEqual(title.transform, [{ translateY: 0 }, { scale: 1 }]);
    assert.equal(runtime.timings.some(timing => timing.duration === 260), false);
  });
}

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
 await tap(button(r,'Edit presentation time and audience'));
 await tap(button(r,'Review saved recording'));
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
