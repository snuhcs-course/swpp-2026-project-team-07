import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve as domainResolve, load } from './helpers/domain-loader.mjs';
const stub = source => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
globalThis.livePanel = { back: new Set() };
registerHooks({ load, resolve(specifier, context, next) {
  if (specifier === 'react-native') return stub(`export const Modal='modal',View='view',Text='text',Pressable='pressable',ScrollView='scroll';
    export const StyleSheet={create:x=>x,absoluteFill:{position:'absolute',top:0,right:0,bottom:0,left:0}};
    export const Alert={alert(){}};export const BackHandler={addEventListener:(_event,fn)=>{globalThis.livePanel.back.add(fn);return{remove(){globalThis.livePanel.back.delete(fn)}}}};`);
  if (specifier === 'react-native-safe-area-context') return stub('export const useSafeAreaInsets=()=>({top:24,bottom:48,left:0,right:0});');
  if (specifier.endsWith('/design/frame')) return stub('export const useFrame=()=>({s:1,left:0,top:0});');
  if (specifier.endsWith('/design/theme')) return stub('export const useTheme=()=>({c:{bg:"#000",text:"#fff",muted:"#aaa"}});');
  if (specifier.endsWith('/presentations/store')) return stub('export const useStore=f=>f({version:0});');
  if (specifier === './incremental') return stub('export const captureFeedback=()=>null,captureVersion=()=>0,readCapture=()=>null,retryCapture=async()=>{},subscribeCaptures=()=>()=>{};');
  if (specifier.endsWith('/feedbackRunClient')) return stub('export const readSavedRun=()=>null,startFeedbackRun=async()=>{};');
  return domainResolve(specifier, context, next);
} });
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { LiveFeedbackPanel } = await import('../src/features/recording/LiveFeedbackPanel.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test('landscape feedback stays inside the rotated canvas and Back closes it; portrait retains native Modal', async () => {
  let renderer, closes = 0;
  const close = () => { closes++; };
  const sheet = landscape => React.createElement('rotated-canvas', null, React.createElement(LiveFeedbackPanel, { id: 'take', landscape, close }));
  try {
    await act(async () => { renderer = create(sheet(true)); });
    assert.equal(renderer.root.findAllByType('modal').length, 0, 'landscape does not escape to a portrait native window');
    const overlay = renderer.root.findByProps({ accessibilityViewIsModal: true });
    assert.ok(overlay.props.style.some(style => style.zIndex > 0));
    assert.match(JSON.stringify(renderer.toJSON()), /Feedback so far/);
    assert.equal(globalThis.livePanel.back.size, 1);
    assert.equal([...globalThis.livePanel.back][0](), true); assert.equal(closes, 1);
    await act(async () => renderer.update(sheet(false)));
    assert.equal(globalThis.livePanel.back.size, 0);
    renderer.root.findByType('modal').props.onRequestClose(); assert.equal(closes, 2);
  } finally { if (renderer) await act(async () => renderer.unmount()); }
  assert.equal(globalThis.livePanel.back.size, 0);
});
