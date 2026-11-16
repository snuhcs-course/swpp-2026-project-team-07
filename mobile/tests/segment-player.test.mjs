import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/segment-player-loader.mjs';
registerHooks({ resolve, load });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { useSegmentPlayer } = await import('../src/features/rehearsal/useSegmentPlayer.ts');
const { players, mode, AppState } = await import('./helpers/segment-player-native.mjs');
const seg = (startMs, endMs, uri = 'file:///synthetic.m4a') => ({ uri, startMs, endMs });
async function mount() {
  let value, renderer;
  function Harness() { value = useSegmentPlayer(); return null; }
  await act(async () => { renderer = create(React.createElement(Harness)); });
  return { get value() { return value; }, player: players.at(-1), unmount: () => act(async () => renderer.unmount()) };
}

test('playback failure gives a retryable message rather than silently looking active', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const h = await mount();
  t.after(() => h.unmount());
  h.player.seekFails = true;
  await act(async () => { await h.value.play('sentence', seg(0, 4000)); });
  assert.equal(h.value.playingKey, null);
  assert.equal(h.value.error, 'Audio playback failed. Tap Play to retry.');
  h.player.seekFails = false;
  await act(async () => { await h.value.play('sentence', seg(0, 4000)); });
  assert.equal(h.value.error, null);
  assert.equal(h.player.playing, true);
});

test('rapid sentence switches serialize native seeks so the newest position wins', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const h = await mount();
  t.after(() => h.unmount());
  let release;
  h.player.seekWait = new Promise(r => { release = r; });
  let old, latest;
  await act(async () => { old = h.value.play('old', seg(6000, 8000)); });
  h.player.seekWait = null;
  await act(async () => { latest = h.value.play('latest', seg(0, 4000)); });
  assert.deepEqual(h.player.seeks, [6], 'new seek waits for the pending native seek');
  await act(async () => { release(); await old; await latest; });
  assert.deepEqual(h.player.seeks, [6, 0]);
  assert.equal(h.player.currentTime, 0);
  assert.equal(h.player.plays, 1);
});

test('tapping an earlier sentence waits for its seek before checking the previous position', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const h = await mount();
  await act(async () => { await h.value.play('later', seg(6000, 8000)); });
  h.player.currentTime = 7;
  let release;
  h.player.seekWait = new Promise(r => { release = r; });
  let pending;
  await act(async () => { pending = h.value.play('earlier', seg(0, 4000)); });
  await act(async () => { t.mock.timers.tick(150); });
  assert.equal(h.value.playingKey, 'earlier');
  assert.equal(h.player.playing, false, 'old audio is paused while seeking');
  await act(async () => { release(); await pending; });
  assert.equal(h.player.playing, true);
  assert.equal(h.player.currentTime, 0);
  h.player.currentTime = 1.25;
  await act(async () => { t.mock.timers.tick(50); });
  assert.equal(h.value.positionMs, 1250);
  assert.equal(h.value.uri, 'file:///synthetic.m4a');
  h.player.currentTime = 4;
  await act(async () => { t.mock.timers.tick(50); });
  assert.equal(h.value.playingKey, null);
  await h.unmount();
});

test('cancel during a pending seek cannot start audio when it resolves', async () => {
  const h = await mount();
  let release;
  h.player.seekWait = new Promise(r => { release = r; });
  let pending;
  await act(async () => { pending = h.value.play('sentence', seg(6000, 8000)); });
  await act(async () => { h.value.stop(); release(); await pending; });
  assert.equal(h.player.plays, 0);
  assert.equal(h.value.playingKey, null);
  await h.unmount();
});

// OpenAI Codex #44: seek within the complete saved-segment queue, independently of Play.
test('exact seeks retain queue offsets and paused intent across repeated visits and source changes',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const h=await mount();t.after(()=>h.unmount());
 const queue=[seg(1000,11000),seg(20000,30000),seg(5000,45000,'file:///retake.m4a')];
 await act(async()=>{await h.value.seekSegments('run',queue,15000,true);});
 assert.deepEqual(h.player.seeks,[25]);assert.equal(h.player.playing,false);assert.equal(h.value.elapsedMs,15000);assert.equal(h.value.paused,true);
 await act(async()=>h.value.setPaused(false));h.player.currentTime=30;
 await act(async()=>t.mock.timers.tick(50));assert.deepEqual(h.player.seeks,[25,5]);
 h.player.currentTime=8;await act(async()=>t.mock.timers.tick(50));assert.equal(h.value.elapsedMs,23000);
 await act(async()=>{await h.value.seekSegments('run',queue,10000,false);});
 assert.equal(h.player.currentTime,20,'an exact boundary selects the next original visit');assert.equal(h.player.playing,true);
 await act(async()=>{await h.value.seekSegments('run',queue,60000,false);});
 assert.equal(h.value.elapsedMs,60000);assert.equal(h.player.playing,false,'the final endpoint settles paused');
 await act(async()=>{await h.value.playSegments('run',[]);});assert.equal(h.player.currentTime,1,'Play after the final endpoint restarts the complete queue');
});

test('newer exact seeks supersede pending targets and retain a pause made while seeking',async()=>{
 const h=await mount();let release;const queue=[seg(1000,11000),seg(20000,30000)];
 try{
  h.player.seekWait=new Promise(resolve=>{release=resolve;});let first,latest;
  await act(async()=>{first=h.value.seekSegments('run',queue,15000,false);});
  h.player.seekWait=null;await act(async()=>{latest=h.value.seekSegments('run',queue,1000,false);h.value.setPaused(true);});
  await act(async()=>{release();await first;await latest;});
  assert.deepEqual(h.player.seeks,[25,2]);assert.equal(h.player.playing,false);assert.equal(h.value.elapsedMs,1000);assert.equal(h.value.paused,true);
 }finally{await h.unmount();}
});

test('backgrounding during an exact seek cancels native resume even after returning',async()=>{
 const h=await mount();let release;
 try{
  h.player.seekWait=new Promise(resolve=>{release=resolve;});let pending;
  await act(async()=>{pending=h.value.seekSegments('run',[seg(1000,11000)],5000,false);});
  await act(async()=>{AppState.emit('background');AppState.emit('active');release();await pending;});
  assert.equal(h.player.plays,0);assert.equal(h.value.playingKey,null);
 }finally{await h.unmount();}
});

test('superseded audio-mode setup cannot replace the newest sentence source', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const h = await mount();
  let release;
  mode.wait = new Promise(r => { release = r; });
  let old;
  await act(async () => { old = h.value.play('old', seg(0, 1000, 'file:///old.m4a')); });
  mode.wait = null;
  await act(async () => { await h.value.play('new', seg(2000, 4000, 'file:///new.m4a')); });
  await act(async () => { release(); await old; });
  assert.deepEqual(h.player.replacements, ['file:///new.m4a']);
  assert.equal(h.value.playingKey, 'new');
  await h.unmount();
});

test('slide playback sequences visits; pause/resume and sentence tap-again still work', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const h = await mount();
  const visits = [seg(0, 2000), seg(6000, 8000)];
  await act(async () => { await h.value.playSegments('slide', visits); });
  await act(async () => { await h.value.playSegments('slide', visits); });
  assert.equal(h.player.playing, false);
  await act(async () => { await h.value.playSegments('slide', visits); });
  assert.equal(h.player.playing, true);
  h.player.currentTime = 2;
  await act(async () => { t.mock.timers.tick(50); });
  assert.deepEqual(h.player.seeks, [0, 6]);
  await act(async () => { await h.value.play('sentence', seg(0, 1000)); });
  await act(async () => { await h.value.play('sentence', seg(0, 1000)); });
  assert.equal(h.player.playing, false);
  assert.equal(h.value.playingKey, null);
  await h.unmount();
});


test('zero-duration evidence never creates a native seek or fabricated playback interval',async()=>{
 const h=await mount();
 try{
  await act(async()=>{await h.value.play('point-evidence',seg(1500,1500));});
  assert.equal(h.value.playingKey,null);assert.equal(h.player.playing,false);
  assert.deepEqual(h.player.seeks,[]);assert.deepEqual(h.player.replacements,[]);
 }finally{await h.unmount();}
});
test('playback skips empty visits while retaining repeated positive-duration visits in order',async t=>{
 t.mock.timers.enable({apis:['setInterval']});const h=await mount();
 try{
  await act(async()=>{await h.value.playSegments('repeated-evidence',[seg(0,0),seg(0,1000),seg(1000,1000),seg(1500,2000)]);});
  assert.deepEqual(h.player.seeks,[0]);
  h.player.currentTime=1;await act(async()=>t.mock.timers.tick(50));
  assert.deepEqual(h.player.seeks,[0,1.5]);
  h.player.currentTime=2;await act(async()=>t.mock.timers.tick(50));
  assert.equal(h.value.playingKey,null);assert.equal(h.player.playing,false);
 }finally{await h.unmount();}
});
