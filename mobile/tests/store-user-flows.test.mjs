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
import { AppState, pressBack } from './helpers/library-screen-native.mjs';

registerHooks(library);
const { STORE_API, STORE_PRIVACY_URL, storeRoute } = await import('../src/services/storeEndpoint.ts');
process.env.EXPO_PUBLIC_ACCESS_MODE='store';
process.env.EXPO_PUBLIC_API_URL=STORE_API;
delete process.env.EXPO_PUBLIC_REQUIRE_DEMO_CODE;
const { HomeScreen }=await import('../src/screens/HomeScreen.tsx');
const { HomeContext, TUTORIAL_SEEN }=await import('../src/screens/shared.ts');
const { storePrivacy }=await import('../src/services/storePrivacy.ts');
const { removeStored }=await import('../src/services/storage.ts');
const { setAppLanguage }=await import('../src/design/language.ts');
const { storeWording }=await import('../src/design/storeWording.ts');
const { koreanText }=await import('../src/design/koreanText.ts');
const { analyzePdf }=await import('../src/features/presentations/importer.ts');
const { serverPdfUnconfirmed }=await import('../src/features/presentations/serverDeck.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
after(()=>fs.rm(root,{recursive:true,force:true}));

test('first Home automatically offers upload consent after the tutorial, persists the choice and leaves offline rehearsal available',async()=>{
  removeStored(TUTORIAL_SEEN);
  const box=value=>({value,set(next){this.value=next;},get(){return this.value;}});
  const home=Object.fromEntries(['p','vy','gap','hold','uploadBlur','uploadReturn','analyzing','setup','press','picker'].map(k=>[k,box(0)]));
  const routes=[],links=[];
  globalThis.openPolicy=url=>links.push(url);
  let tree;
  const mount=()=>act(async()=>{tree=create(React.createElement(HomeContext.Provider,{value:{home,go:(...a)=>routes.push(a)}},
    React.createElement(HomeScreen,{mode:'home',uploadLook:null})));});
  const prompts=()=>tree.root.findAllByType('privacy-modal');
  const prompt=()=>tree.root.findByProps({testID:'store-privacy-dialog'});
  const title=()=>prompt().findByProps({accessibilityRole:'header'}).props.children;
  const disclosure=()=>prompt().findByType('scroll').findByType('text').props.children;
  const choice=label=>prompt().findAllByType('pressable').find(button=>button.findByType('text').props.children===label);
  await mount();
  assert.ok(tree.root.findByProps({accessibilityRole:'button',accessibilityLabel:'Close tutorial'}));
  assert.equal(storePrivacy.read(),null);assert.equal(prompts().length,0);assert.equal(network.requests.length,0);
  await act(async()=>assert.equal(pressBack(),true));
  assert.equal(prompts().length,1,'arriving at Home presents the choice automatically');
  assert.equal(storePrivacy.read(),null);assert.equal(network.requests.length,0);assert.deepEqual(routes,[]);
  await act(async()=>{AppState.emit('background');AppState.emit('active');});
  assert.equal(prompts().length,1,'returning while the choice is open does not duplicate it');
  assert.equal(title(),'Allow uploads for online coaching?');
  for(const word of ['recordings','ElevenLabs','OpenRouter','30 days','provider','local recordings','free','touch and hold OutLoud'])assert.ok(disclosure().includes(word), word);
  assert.equal(prompt().findByType('scroll').findAllByType('pressable').length,0,'all choices stay outside the scrolling disclosure');
  assert.ok(choice('Keep on device'));assert.ok(choice('Allow uploads'));
  assert.equal(choice('Privacy policy').props.accessibilityRole,'link');
  await act(async()=>choice('Privacy policy').props.onPress());
  assert.deepEqual(links,[STORE_PRIVACY_URL]);assert.equal(storeRoute(STORE_PRIVACY_URL),null);
  assert.equal(storePrivacy.read(),null);
  const pendingPrompt=prompts()[0];
  await act(async()=>{AppState.emit('background');setAppLanguage('ko');});
  await act(async()=>AppState.emit('active'));
  assert.deepEqual(prompts(),[pendingPrompt],'returning from the policy preserves the same consent prompt');
  assert.equal(title(),'온라인 코칭을 위해 업로드할까요?');assert.match(disclosure(),/30일/);assert.match(disclosure(),/무료/);
  await act(async()=>choice('기기에만 보관').props.onPress());
  assert.equal(storePrivacy.read(),'offline');assert.deepEqual(routes,[]);
  await act(async()=>{AppState.emit('background');AppState.emit('active');});
  assert.equal(prompts().length,0,'declining is remembered after returning to the app');
  await act(async()=>tree.root.findByProps({accessibilityRole:'adjustable'}).props.onAccessibilityAction({nativeEvent:{actionName:'add'}}));
  assert.equal(routes.at(-1)[0],'upload');
  await act(async()=>tree.unmount());
  const uri=new URL('private.pdf',documentDirectory).href;
  await fs.writeFile(new URL(uri),'%PDF synthetic local slide fixture');
  const deck=await analyzePdf({id:'private-deck',title:'Private slides',uri},()=>{},new AbortController().signal);
  assert.equal(deck.pages.length,7);assert.equal(deck.text,'pending');assert.equal(serverPdfUnconfirmed(deck.id),false);
  assert.equal(network.requests.length,0);assert.ok((await fs.stat(new URL(deck.pages[0].uri))).size);
  await act(async()=>setAppLanguage('en'));
  await mount();
  assert.equal(prompts().length,0,'declining is remembered on a fresh Home mount');
  const onlineButton=()=>tree.root.findAllByType('pressable').find(button=>
    button.findAllByType('text').some(text=>text.props.children==='Online coaching settings'));
  const openCredits=()=>tree.root.findByProps({accessibilityRole:'button',accessibilityLabel:'How OutLoud works'}).props.onLongPress();
  assert.equal(onlineButton(),undefined,'Home has no coaching settings control after declining');
  await act(async()=>openCredits());
  await act(async()=>onlineButton().props.onPress());
  await act(async()=>choice('Allow uploads').props.onPress());
  assert.equal(storePrivacy.read(),'enabled');
  await act(async()=>tree.unmount());
  await mount();
  assert.equal(prompts().length,0,'allowing uploads is remembered on a fresh Home mount');
  assert.equal(onlineButton(),undefined,'Home has no coaching settings control after approval');
  await act(async()=>openCredits());
  await act(async()=>onlineButton().props.onPress());
  await act(async()=>choice('Keep on device').props.onPress());
  assert.equal(storePrivacy.read(),'offline');
  await act(async()=>tree.root.findByProps({accessibilityRole:'button',accessibilityLabel:'Close credits'}).props.onPress());
  await act(async()=>storePrivacy.write('expired'));
  const before=routes.length;
  await act(async()=>tree.root.findByProps({accessibilityRole:'adjustable'}).props.onAccessibilityAction({nativeEvent:{actionName:'add'}}));
  assert.match(disclosure(),/previous private workspace/);
  await act(async()=>choice('Privacy policy').props.onPress());
  assert.equal(storePrivacy.read(),'expired');assert.equal(routes.length,before);
  const keep=choice('Keep on device').props.onPress;
  await act(async()=>{keep();keep();});
  assert.equal(storePrivacy.read(),'offline');assert.equal(routes.length,before+1);assert.equal(routes.at(-1)[0],'upload');
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
    assert.equal(await ref.current.checkLiveFeedback(), false, 'offline countdown skips the server capability check');
    // A capability result from before consent was withdrawn cannot enable live capture.
    await act(async()=>{await ref.current.start(()=>0, Promise.resolve(true));});
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
