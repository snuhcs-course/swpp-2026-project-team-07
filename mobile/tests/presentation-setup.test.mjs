import {test} from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
import {resolve,load} from './helpers/recording-cues-runtime-loader.mjs';registerHooks({resolve,load});
const React=await import('react'),{act,create}=await import('react-test-renderer');
const {ThemeProvider}=await import('../src/design/theme');const {PresentationSetup,PresentationRequirementsEditor}=await import('../src/screens/PresentationSetup');
const {setupNative,emitSetupKeyboard}=await import('./helpers/recording-cues-runtime-native.mjs');
const {writeStored}=await import('../src/services/storage');
const {DARK_PALETTE,LIGHT_PALETTE}=await import('../src/design/tokens');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const deck={id:'setup-fixture',title:'Synthetic setup',pageCount:2,target:120};
const button=(r,label)=>r.root.findAllByType('pressable').find(p=>p.props.accessibilityLabel===label);
async function mount(values,extras={}){let r;await act(async()=>{r=create(React.createElement(ThemeProvider,null,React.createElement(PresentationSetup,{deck,initialValues:values,error:'',onConfirm:(...v)=>{r.saved=v;},onBackPan:{},...extras})));});return r;}
test('existing arbitrary seconds and custom audience survive opening and Save',async()=>{const r=await mount({requiredDurationSeconds:65,audience:'Middle school beginners'});try{await act(async()=>r.root.findByType('record-button').props.onPress());assert.deepEqual(r.saved,[65,'Middle school beginners']);}finally{await act(async()=>r.unmount());}});
test('duration adjustment reaches 30 minutes; explicit clear preserves missing time/audience',async()=>{const r=await mount({requiredDurationSeconds:1800,audience:'General audience'});try{const slider=r.root.findAllByType('pan').find(n=>n.props.accessibilityRole==='adjustable');assert.equal(slider.props.accessibilityValue.max,30);await act(async()=>slider.props.onAccessibilityAction({nativeEvent:{actionName:'increment'}}));await act(async()=>r.root.findByType('record-button').props.onPress());assert.equal(r.saved[0],1800);await act(async()=>button(r,'Clear required presentation time').props.onPress());await act(async()=>button(r,'Clear target audience').props.onPress());await act(async()=>r.root.findByType('record-button').props.onPress());assert.deepEqual(r.saved,[null,'']);}finally{await act(async()=>r.unmount());}});
test('custom audience enforces code-point bound and does not truncate emoji',async()=>{const r=await mount({requiredDurationSeconds:300,audience:'General audience'});try{await act(async()=>button(r,'Other audience').props.onPress());const input=()=>r.root.findByType('input');await act(async()=>input().props.onChangeText('😀'.repeat(500)));await act(async()=>r.root.findByType('record-button').props.onPress());assert.equal([...r.saved[1]].length,500);r.saved=null;await act(async()=>input().props.onChangeText('a'.repeat(501)));await act(async()=>r.root.findByType('record-button').props.onPress());assert.equal(r.saved,null);assert.match(JSON.stringify(r.toJSON()),/500/);}finally{await act(async()=>r.unmount());}});

const flattened=style=>Object.assign({},...[style].flat(Infinity).filter(Boolean));
test('keyboard viewport uses physical frame scale, reveals custom input and resets on hide',async()=>{
 setupNative.frame={top:24,left:0,s:0.8,width:312,height:760};setupNative.keyboard=null;setupNative.scrolls=[];
 const r=await mount({requiredDurationSeconds:300,audience:'Synthetic custom audience'});
 try{
  const scroll=()=>r.root.findByType('scroll');assert.equal(flattened(scroll().props.style).height,844);
  await act(async()=>emitSetupKeyboard('keyboardDidShow',384));
  const height=flattened(scroll().props.style).height;assert.equal(height,435);assert.equal(scroll().props.keyboardShouldPersistTaps,'handled');
  assert.ok(setupNative.scrolls.some(v=>v.y>0));assert.ok(r.root.findByType('input'));assert.ok(r.root.findByType('record-button'));
  await act(async()=>r.root.findByType('input').props.onChangeText('Edited while keyboard is open'));
  await act(async()=>emitSetupKeyboard('keyboardDidHide'));
  assert.equal(flattened(scroll().props.style).height,844);assert.equal(setupNative.scrolls.at(-1).y,0);
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
   for(const label of ['Other audience','Use server presentation choices','Keep my presentation choices']){const action=button(r,label);assert.ok(action);const color=flattened(action.findByType('text').props.style).color;assert.equal(color,palette.text);}
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
