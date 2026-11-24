// Real Home, file import and CaptureEngine against deterministic Android UI and audio adapters.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';
import * as fs from 'node:fs/promises';
import React from 'react';
import { act, create } from 'react-test-renderer';
import * as library from './helpers/library-screen-loader.mjs';
import * as recorder from './helpers/recording-screen-loader.mjs';
import { documentDirectory, root } from './helpers/pdf-node-storage.mjs';
import { network } from './helpers/upload-native.mjs';

registerHooks(library);
const { STORE_API, STORE_PRIVACY_URL, storeRoute } = await import('../src/services/storeEndpoint.ts');
process.env.EXPO_PUBLIC_ACCESS_MODE='store';
process.env.EXPO_PUBLIC_API_URL=STORE_API;
delete process.env.EXPO_PUBLIC_REQUIRE_DEMO_CODE;
const { HomeScreen }=await import('../src/screens/HomeScreen.tsx');
const { HomeContext, TUTORIAL_SEEN }=await import('../src/screens/shared.ts');
const { storePrivacy }=await import('../src/services/storePrivacy.ts');
const { writeStored }=await import('../src/services/storage.ts');
const { setAppLanguage }=await import('../src/design/language.ts');
const { storeWording }=await import('../src/design/storeWording.ts');
const { koreanText }=await import('../src/design/koreanText.ts');
const { analyzePdf }=await import('../src/features/presentations/importer.ts');
const { serverPdfUnconfirmed }=await import('../src/features/presentations/serverDeck.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
after(()=>fs.rm(root,{recursive:true,force:true}));

test('Home opens immediately, offers both languages, and keeps a declined PDF on-device; a later Home choice can enable uploads',async()=>{
  writeStored(TUTORIAL_SEEN,true);
  const box=value=>({value,set(next){this.value=next;}});
  const home=Object.fromEntries(['p','vy','gap','hold','uploadBlur','analyzing','setup','press','picker'].map(k=>[k,box(0)]));
  const routes=[],alerts=[],links=[];
  globalThis.storeAlert=(...a)=>alerts.push(a);
  globalThis.openPolicy=url=>links.push(url);
  let tree;
  await act(async()=>{tree=create(React.createElement(HomeContext.Provider,{value:{home,go:(...a)=>routes.push(a)}},
    React.createElement(HomeScreen,{mode:'home',uploadLook:null})));});
  assert.equal(storePrivacy.read(),null);assert.equal(alerts.length,0);assert.equal(network.requests.length,0);
  const add=()=>act(async()=>tree.root.findByProps({accessibilityRole:'adjustable'}).props.onAccessibilityAction({nativeEvent:{actionName:'add'}}));
  await add(); assert.equal(routes.length,0);
  let [title,description,actions]=alerts.pop();
  assert.equal(title,'Allow uploads for online coaching?');
  for(const word of ['recordings','ElevenLabs','OpenRouter','30 days','provider','local recordings','free'])assert.ok(description.includes(word), word);
  await act(async()=>actions.find(a=>a.text==='Privacy policy').onPress());
  assert.deepEqual(links,[STORE_PRIVACY_URL]);assert.equal(storeRoute(STORE_PRIVACY_URL),null);
  assert.equal(storePrivacy.read(),null);
  await act(async()=>{setAppLanguage('ko');});await add();
  [title,description,actions]=alerts.pop();
  assert.equal(title,'온라인 코칭을 위해 업로드할까요?');assert.match(description,/30일/);assert.match(description,/무료/);
  await act(async()=>actions.find(a=>a.text==='기기에만 보관').onPress());
  assert.equal(storePrivacy.read(),'offline');assert.equal(routes.at(-1)[0],'upload');
  await act(async()=>tree.unmount());
  const uri=new URL('private.pdf',documentDirectory).href;
  await fs.writeFile(new URL(uri),'%PDF synthetic local slide fixture');
  const deck=await analyzePdf({id:'private-deck',title:'Private slides',uri},()=>{},new AbortController().signal);
  assert.equal(deck.pages.length,7);assert.equal(deck.text,'pending');assert.equal(serverPdfUnconfirmed(deck.id),false);
  assert.equal(network.requests.length,0);assert.ok((await fs.stat(new URL(deck.pages[0].uri))).size);
  await act(async()=>{setAppLanguage('en');tree=create(React.createElement(HomeContext.Provider,{value:{home,go:(...a)=>routes.push(a)}},
    React.createElement(HomeScreen,{mode:'home',uploadLook:null})));});
  const onlineButton=tree.root.findAllByType('pressable').find(p=>p.findAllByType('text').some(x=>x.children.join('')==='Online coaching off'));
  await act(async()=>onlineButton.props.onPress());
  await act(async()=>alerts.pop()[2].find(a=>a.text==='Allow uploads').onPress());
  assert.equal(storePrivacy.read(),'enabled');
  assert.ok(tree.root.findAllByType('text').some(x=>x.children.join('')==='Online coaching on'));
  const retry=storeWording('The previous provider request has an uncertain outcome. Retrying may incur another charge.');
  assert.match(retry,/OutLoud covers the cost/);assert.match(koreanText(retry),/OutLoud가 부담/);
  await act(async()=>tree.unmount());
});

test('declining uploads still saves a recorder-clock take and local playback URI, without an upload or provider handoff',async()=>{
  const hook=registerHooks(recorder);
  const { CaptureEngine }=await import('../src/features/rehearsal/CaptureEngine.tsx');
  const { getSavedAttempt }=await import('../src/features/recording/storage.ts');
  const { readCapture }=await import('../src/features/recording/incrementalState.ts');
  const { captures,resetCaptureFixture }=await import('./helpers/recording-screen-audio.mjs');
  const deck={id:'offline-recording',title:'Local rehearsal',uri:'file:///slides.pdf',pageCount:2};
  const ref=React.createRef();let tree;
  try{
    storePrivacy.write('offline');resetCaptureFixture();
    globalThis.continuousCapture={start(){throw Error('Live uploading started without consent');}};
    await act(async()=>{tree=create(React.createElement(CaptureEngine,{ref,deck,preferIncremental:true,onMeter(){},onMustStop(){},onInterrupted(){}}));});
    await act(async()=>{await ref.current.start(()=>0);});
    const audio=captures.at(-1);audio.durationMillis=2000;await act(async()=>ref.current.slideChanged(1));
    audio.durationMillis=5000;let take;await act(async()=>{take=await ref.current.stop();});
    const saved=getSavedAttempt(take.attemptId);
    assert.equal(saved.state,'saved');assert.equal(saved.auto_process_api,undefined);assert.equal(readCapture(take.attemptId),null);
    assert.match(saved.recording.audio_uri,/^file:\/\//);assert.equal(saved.recording.duration_ms,5000);
    assert.deepEqual(saved.recording.slide_events,[{slide_index:0,at_ms:0},{slide_index:1,at_ms:2000}]);assert.equal(network.requests.length,0);
  }finally{if(tree)await act(async()=>tree.unmount());delete globalThis.continuousCapture;hook.deregister();}
});

test('public review shows saved words offline and only reports transcription when the take and consent support it', async () => {
  const hook = registerHooks(await import('./helpers/ai-overview-screen-loader.mjs'));
  let tree;
  try {
    const { OverviewScreen } = await import('../src/screens/OverviewScreen.tsx');
    const { ListenBackKaraokeScreen } = await import('../src/screens/ListenBackKaraokeScreen.tsx');
    const { runtime, HintRow } = await import('./helpers/ai-overview-screen-native.mjs');
    const audio = { attemptId: 'take', startMs: 0, endMs: 4000 };
    runtime.nav = { deckId: 'deck', sel: 0, from: 'full' };
    runtime.feedback = { aggregate: { findings: 0 } };
    runtime.model = {
      deck: { id: 'deck', title: 'Local talk', slides: [{ title: 'Local slide' }] }, n: 1,
      state: { run: { core: 'whole run', createdAt: new Date().toISOString(), parts: [{ attemptId: 'take', segments: [audio] }] } },
      total: 4, times: [4], targetSum: 60, stages: new Map([['take', 'local']]), pending: true, lines: [],
    };
    const screens = () => React.createElement(React.Fragment, null, React.createElement(OverviewScreen), React.createElement(ListenBackKaraokeScreen));
    const labels = () => tree.root.findAllByType('text').map(n => n.props.children);
    const listenRow = () => tree.root.findAllByType('pressable').find(n => n.findAllByType('text').some(t => t.props.children === 'Listen back'));
    const textHint = () => tree.root.findAllByType(HintRow).flatMap(n => n.props.hints).find(h => h.text === 'Tap a word');
    const setStage = async stage => {
      runtime.model.stages = new Map([['take', stage]]);
      await act(async () => tree.update(screens()));
    };
    storePrivacy.write('offline');
    await act(async () => { tree = create(screens()); });
    assert.deepEqual(listenRow().findAllByType('text').map(n => n.props.children), ['Listen back', '0:04']);
    assert.ok(labels().includes('No transcript for this run'));
    assert.equal(textHint().hidden, true);
    await act(async () => storePrivacy.write('enabled'));
    assert.ok(labels().includes('No transcript for this run'), 'a local-only take has not been submitted');
    await setStage('awaiting');
    assert.ok(labels().includes('No transcript for this run'), 'an upload alone does not establish a public transcription job');
    await setStage('processing');
    assert.ok(labels().includes('Transcript is still processing.'));
    await act(async () => storePrivacy.write('expired'));
    assert.ok(labels().includes('No transcript for this run'), 'a stale job status cannot imply that online coaching is active');
    runtime.model.lines = [{ key: 'word', slide: 0, text: 'Saved words', audio,
      words: [{ text: 'Saved', start_ms: 0, end_ms: 300 }, { text: 'words', start_ms: 310, end_ms: 550 }] }];
    await act(async () => tree.update(screens()));
    assert.ok(labels().includes('0:04 with transcript'));
    assert.ok(tree.root.findByProps({ accessibilityLabel: 'Saved words' }));
    assert.equal(textHint().hidden, false);
  } finally { if (tree) await act(async () => tree.unmount()); hook.deregister(); }
});
