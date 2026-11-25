import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/recording-cues-runtime-loader.mjs';registerHooks({resolve,load});
const React=await import('react'),{act,create}=await import('react-test-renderer');
const {ThemeProvider}=await import('../src/design/theme');const {PresentationSetup,PresentationRequirementsEditor}=await import('../src/screens/PresentationSetup');
const {setupNative,emitSetupKeyboard}=await import('./helpers/recording-cues-runtime-native.mjs');
const {writeStored}=await import('../src/services/storage');
const {DARK_PALETTE,LIGHT_PALETTE}=await import('../src/design/tokens');
const {API_URL}=await import('../src/services/api');
const {reserveContext,saveRequirements,readRequirements}=await import('../src/features/presentations/requirementsStore');
const {confirmRequirements,readRequirementsDraft,synchronizeRequirements}=await import('../src/features/presentations/requirementsDraft');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const deck={id:'setup-fixture',title:'Synthetic setup',pageCount:2,target:120};
const button=(r,label)=>r.root.findAllByType('pressable').find(p=>p.props.accessibilityLabel===label);
async function mount(values,extras={}){let r;await act(async()=>{r=create(React.createElement(ThemeProvider,null,React.createElement(PresentationSetup,{deck,initialValues:values,error:'',onConfirm:(...v)=>{r.saved=v;},onBackPan:{},...extras})));});return r;}
const serverDeck='22222222-2222-4222-8222-222222222222';
async function mountEditor(local,initialImport=true){let r;await act(async()=>{r=create(React.createElement(ThemeProvider,null,React.createElement(PresentationRequirementsEditor,{deck:local,initialImport,onSaved:()=>{},onBackPan:{}})));});return r;}
const slider=r=>r.root.findAllByType('pan').find(n=>n.props.accessibilityRole==='adjustable');
const texts=r=>r.root.findAllByType('text').map(n=>n.children.join('')).join('\n');
const customLabel='Not sure. Long press to edit a custom audience.';
const customSave=r=>r.root.findAllByType('pressable').find(n=>n.findAllByType('text').some(t=>t.children.join('')==='Save'));
const openCustom=r=>act(async()=>button(r,customLabel).props.onLongPress());
const clearTime=r=>act(async()=>slider(r).props.onAccessibilityAction({nativeEvent:{actionName:'clear'}}));
const chip=(r,label)=>r.root.findAllByType('pressable').find(n=>n.findAllByType('text').some(t=>t.children.join('')===label));
test('new-import controls save ten minutes and leave audience unselected before and after context reservation',async()=>{
 const old=fetch;globalThis.fetch=async()=>{throw Error('Synthetic offline');};
 try{for(const reserved of [false,true]){
  const local={...deck,id:'default-setup-'+reserved};if(reserved)reserveContext(local.id,API_URL,serverDeck);
  const r=await mountEditor(local);
  try{assert.match(texts(r),/minutes/);assert.equal(slider(r).props.accessibilityValue.now,10);assert.equal(chip(r,'Not sure').props.accessibilityState.selected,false);
   await act(async()=>r.root.findByType('record-button').props.onPress());
   assert.deepEqual(readRequirementsDraft(local.id,API_URL).desired,{requiredDurationSeconds:600,audience:''});
  }finally{await act(async()=>r.unmount());}
 }}finally{globalThis.fetch=old;}
});
test('untouched editor follows asynchronously accepted requirements',async()=>{
 const old=fetch;globalThis.fetch=async()=>{throw Error('Synthetic offline');};
 const local={...deck,id:'delayed-setup'};reserveContext(local.id,API_URL,serverDeck);let r;
 try{r=await mountEditor(local);assert.match(texts(r),/minutes/);
  await act(async()=>saveRequirements(local.id,API_URL,{...readRequirements(local.id,API_URL),revision:1,requiredDurationSeconds:540,audience:'Teachers'}));
  assert.match(texts(r),/minutes/);assert.equal(slider(r).props.accessibilityValue.now,9);assert.equal(chip(r,'Teachers').props.accessibilityState.selected,true);
  await act(async()=>r.root.findByType('record-button').props.onPress());assert.equal(readRequirementsDraft(local.id,API_URL).desired.requiredDurationSeconds,540);
 }finally{if(r)await act(async()=>r.unmount());globalThis.fetch=old;}
});
test('asynchronous accepted defaults do not replace edits or explicit clears in the open editor',async()=>{
 const old=fetch;globalThis.fetch=async()=>{throw Error('Synthetic offline');};
 try{for(const cleared of [false,true]){
  const local={...deck,id:'touched-setup-'+cleared};reserveContext(local.id,API_URL,serverDeck);const r=await mountEditor(local);
  try{if(cleared){await clearTime(r);}
   else{await act(async()=>slider(r).props.onAccessibilityAction({nativeEvent:{actionName:'decrement'}}));await act(async()=>chip(r,'Students').props.onPress());}
   await act(async()=>saveRequirements(local.id,API_URL,{...readRequirements(local.id,API_URL),revision:1,requiredDurationSeconds:600,audience:'General audience'}));
   if(!cleared)assert.equal(slider(r).props.accessibilityValue.now,9);
   await act(async()=>r.root.findByType('record-button').props.onPress());
   assert.deepEqual(readRequirementsDraft(local.id,API_URL).desired,cleared?{requiredDurationSeconds:null,audience:''}:{requiredDurationSeconds:540,audience:'Students'});
  }finally{await act(async()=>r.unmount());}
 }}finally{globalThis.fetch=old;}
});
test('pending drafts, saved five-minute choices, explicit clears and legacy absence keep their values',async()=>{
 const old=fetch;globalThis.fetch=async()=>{throw Error('Synthetic offline');};
 try{for(const [id,values,initialImport,pending]of [
  ['saved-five',{requiredDurationSeconds:300,audience:'General audience'},true,false],
  ['saved-clear',{requiredDurationSeconds:null,audience:''},true,false],
  ['legacy-empty',{requiredDurationSeconds:null,audience:''},false,false],
  ['pending-custom',{requiredDurationSeconds:420,audience:'Researchers'},true,true],
 ]){
  const local={...deck,id};
  if(id!=='legacy-empty'){const base=reserveContext(local.id,API_URL,serverDeck);if(!pending)saveRequirements(local.id,API_URL,{...base,...values,revision:1});}
  if(pending)confirmRequirements(local.id,API_URL,values);
  const r=await mountEditor(local,initialImport);try{await act(async()=>r.root.findByType('record-button').props.onPress());assert.deepEqual(readRequirementsDraft(local.id,API_URL).desired,values);}finally{await act(async()=>r.unmount());}
 }}finally{globalThis.fetch=old;}
});
test('existing arbitrary seconds and custom audience survive opening and Save',async()=>{const r=await mount({requiredDurationSeconds:65,audience:'Middle school beginners'});try{await act(async()=>r.root.findByType('record-button').props.onPress());assert.deepEqual(r.saved,[65,'Middle school beginners']);}finally{await act(async()=>r.unmount());}});
test('duration adjustment reaches 30 minutes; explicit clear preserves missing time/audience',async()=>{const r=await mount({requiredDurationSeconds:1800,audience:'General audience'});try{const slider=r.root.findAllByType('pan').find(n=>n.props.accessibilityRole==='adjustable');assert.equal(slider.props.accessibilityValue.max,30);await act(async()=>slider.props.onAccessibilityAction({nativeEvent:{actionName:'increment'}}));await act(async()=>r.root.findByType('record-button').props.onPress());assert.equal(r.saved[0],1800);await clearTime(r);await act(async()=>chip(r,'Not sure').props.onPress());await act(async()=>r.root.findByType('record-button').props.onPress());assert.deepEqual(r.saved,[null,'']);}finally{await act(async()=>r.unmount());}});
test('custom audience accepts 500 emoji through the native length cap and rejects 501 code points',async()=>{
 const r=await mount({requiredDurationSeconds:300,audience:'General audience'});
 try{
  await openCustom(r);const input=()=>r.root.findByType('input');
  const emoji='😀'.repeat(500);assert.ok(input().props.maxLength>=emoji.length);
  await act(async()=>input().props.onChangeText(emoji.slice(0,input().props.maxLength)));
  await act(async()=>customSave(r).props.onPress());await act(async()=>r.root.findByType('record-button').props.onPress());
  assert.equal([...r.saved[1]].length,500);r.saved=null;
  await openCustom(r);await act(async()=>input().props.onChangeText('a'.repeat(501)));
  await act(async()=>customSave(r).props.onPress());await act(async()=>r.root.findByType('record-button').props.onPress());
  assert.equal(r.saved,null);assert.match(JSON.stringify(r.toJSON()),/500/);
 }finally{await act(async()=>r.unmount());}
});

const flattened=style=>Object.assign({},...[style].flat(Infinity).filter(Boolean));
test('queued presentation choices use a neutral status and a failed sync offers a retry', async () => {
 const local = { ...deck, id: 'setup-sync-feedback' };
 const values = { requiredDurationSeconds: 420, audience: 'Researchers' };
 const offline = async () => { throw new Error('Synthetic network failure'); };
 writeStored('settings.theme', 'dark');
 confirmRequirements(local.id, API_URL, values);
 const previousFetch = globalThis.fetch;
 globalThis.fetch = offline;
 let r;
 try {
  r = await mountEditor(local, false);
  const status = r.root.findByProps({ accessibilityLiveRegion: 'polite' });
  assert.equal(status.children.join(''), 'Saved on phone · sync pending');
  assert.equal(flattened(status.props.style).color, DARK_PALETTE.secondary);
  assert.equal(r.root.findAllByProps({ accessibilityRole: 'alert' }).length, 0);

  await act(async () => synchronizeRequirements(local.id, serverDeck, API_URL, offline));
  const alert = r.root.findByProps({ accessibilityRole: 'alert' });
  assert.equal(alert.children.join(''), 'Saved on this phone. Tap Save to retry syncing.');
  assert.equal(flattened(alert.props.style).color, DARK_PALETTE.bad);
  assert.equal(r.root.findByType('record-button').props.disabled, false);
  assert.deepEqual(readRequirementsDraft(local.id, API_URL).desired, values);
 } finally {
  if (r) await act(async () => r.unmount());
  globalThis.fetch = previousFetch;
 }
});
test('keyboard viewport uses physical frame scale, reveals custom input and resets on hide',async()=>{
 setupNative.frame={top:24,left:0,s:0.8,width:312,height:760};setupNative.keyboard=null;setupNative.scrolls=[];
 const r=await mount({requiredDurationSeconds:300,audience:'Synthetic custom audience'});
 try{
  const scroll=()=>r.root.findByType('scroll');assert.equal(flattened(scroll().props.style).height,844);await openCustom(r);
  await act(async()=>emitSetupKeyboard('keyboardDidShow',384));
  const height=flattened(scroll().props.style).height;assert.equal(height,435);assert.equal(scroll().props.keyboardShouldPersistTaps,'handled');
  assert.ok(setupNative.scrolls.some(v=>v.y>0));assert.ok(r.root.findByType('input'));assert.ok(r.root.findByType('record-button'));
  await act(async()=>r.root.findByType('input').props.onChangeText('Edited while keyboard is open'));
  await act(async()=>emitSetupKeyboard('keyboardDidHide'));
  assert.equal(flattened(scroll().props.style).height,844);assert.equal(r.root.findByType('input').props.value,'Edited while keyboard is open');await act(async()=>customSave(r).props.onPress());
  await act(async()=>r.root.findByType('record-button').props.onPress());assert.equal(r.saved[1],'Edited while keyboard is open');
 }finally{await act(async()=>r.unmount());assert.equal([...setupNative.listeners.values()].reduce((n,v)=>n+v.size,0),0);setupNative.frame={top:0,left:0,s:1,width:390,height:844};}
});
test('Other audience and conflict recovery use explicit colors in dark and light themes',async()=>{
 const {saveRequirements}=await import('../src/features/presentations/requirementsStore');
 const {confirmRequirements,synchronizeRequirements}=await import('../src/features/presentations/requirementsDraft');
 const {API_URL}=await import('../src/services/api');const deckId='22222222-2222-4222-8222-222222222222',contextId='33333333-3333-4333-8333-333333333333';
 const old=fetch;
 for(const [mode,palette]of [['dark',DARK_PALETTE],['light',LIGHT_PALETTE]]){
  writeStored('settings.theme',mode);const local={...deck,id:'conflict-colors-'+mode};saveRequirements(local.id,API_URL,{contextId,deckId,revision:1,audience:'Students',requiredDurationSeconds:300});confirmRequirements(local.id,API_URL,{requiredDurationSeconds:600,audience:'Clients'});
  const wire={id:contextId,deck_id:deckId,revision:2,audience:'Teachers',required_duration_seconds:900};globalThis.fetch=async()=>Response.json(wire);await synchronizeRequirements(local.id,deckId,API_URL);
  let r;try{await act(async()=>{r=create(React.createElement(ThemeProvider,null,React.createElement(PresentationRequirementsEditor,{deck:local,onSaved:()=>{},onBackPan:{}})));});
   assert.equal(flattened(r.root.findByProps({accessibilityRole:'alert'}).props.style).color,palette.bad);
   for(const label of [customLabel,'Use server presentation choices','Keep my presentation choices']){const action=button(r,label);assert.ok(action);const color=flattened(action.findByType('text').props.style).color;assert.equal(color,palette.text);}
  }finally{if(r)await act(async()=>r.unmount());}
 }
 globalThis.fetch=old;writeStored('settings.theme','dark');
});
test('long validation, recovery and Save flow in the scroll content instead of overlapping fixed positions',async()=>{
 const recovery=React.createElement('pressable',{accessibilityLabel:'Synthetic recovery'},React.createElement('text',null,'Use saved server choices'));
 const r=await mount({requiredDurationSeconds:300,audience:'Custom audience'},{error:'A long recoverable synchronization error. '.repeat(12),recovery});
 try{const scroll=r.root.findByType('scroll');assert.ok(scroll.findByProps({accessibilityRole:'alert'}));assert.ok(scroll.findByProps({accessibilityLabel:'Synthetic recovery'}));assert.ok(scroll.findByType('record-button'));
  const alert=scroll.findByProps({accessibilityRole:'alert'});assert.notEqual(flattened(alert.props.style).position,'absolute');
  const wrapper=scroll.findByProps({accessibilityLabel:'Synthetic recovery'}).parent;assert.notEqual(flattened(wrapper.props.style).position,'absolute');
 }finally{await act(async()=>r.unmount());}
});
// OpenAI Codex integrated supplied regression: docs/ai-collaboration-prompts-iteration-2.md#align-presentation-time-dial-arc
test('the filled dial arc ends under the knob for every minute value',async()=>{
 const R=112,C=120,L=2*Math.PI*R;
 for(const minutes of [1,2,3,10,15,29,30]){
  const r=await mount({requiredDurationSeconds:minutes*60,audience:''});
  try{
   const circles=r.root.findAllByType('circle');
   const arc=circles.find(n=>n.props.r===R&&n.props.strokeDashoffset!==undefined);
   const knob=circles.find(n=>n.props.r===15);
   assert.ok(arc&&knob,'dial arc and knob are rendered');
   let svg=knob.parent;
   while(svg&&!svg.props.viewBox)svg=svg.parent;
   assert.ok(svg,'padded dial SVG is rendered');
   assert.deepEqual([svg.props.width,svg.props.height,svg.props.viewBox],[256,256,'-8 -8 256 256']);
   assert.ok(knob.props.cx-knob.props.r>=-8&&knob.props.cx+knob.props.r<=248&&
    knob.props.cy-knob.props.r>=-8&&knob.props.cy+knob.props.r<=248,'entire knob fits the SVG canvas');
   const filled=1-arc.props.strokeDashoffset/L;
   const end=filled*Math.PI*2-Math.PI/2;
   assert.ok(Math.abs(C+Math.cos(end)*R-knob.props.cx)<0.01&&Math.abs(C+Math.sin(end)*R-knob.props.cy)<0.01,
    `${minutes} min: arc ends at ${(filled*360).toFixed(1)}°, knob at ${((Math.atan2(knob.props.cy-C,knob.props.cx-C)+Math.PI/2+2*Math.PI)%(2*Math.PI)*180/Math.PI).toFixed(1)}°`);
  }finally{await act(async()=>r.unmount());}
 }
});
