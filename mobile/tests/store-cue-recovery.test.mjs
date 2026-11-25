import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { resolve as cueResolve, load } from './helpers/cue-panel-loader.mjs';
import { deckId, profileResponse } from './helpers/slide-profile-fixtures.mjs';

const api = 'https://outloud-team07.koreacentral.cloudapp.azure.com/store/api';
process.env.EXPO_PUBLIC_API_URL = api;
process.env.EXPO_PUBLIC_ACCESS_MODE = 'store';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/services/backendFetch')) {
      return { url: 'data:text/javascript,export const backendFetch=(...args)=>globalThis.fetch(...args);export const demoAccess={subscribe:()=>()=>{},getSnapshot:()=>({state:"ready"})};', shortCircuit: true };
    }
    return cueResolve(specifier, context, nextResolve);
  },
  load,
});

const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { useSlideProfiles } = await import('../src/features/presentations/useSlideProfiles.ts');
const { writeStored } = await import('../src/services/storage.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('public presentation replays the same PDF at most once after a lost upload response', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const source = { id: 'uncertain-public-deck', title: 'Public fixture', uri: 'file:///same.pdf', pageCount: 3 };
  const original = globalThis.fetch;
  const calls = [];
  let current, renderer;
  function Presentation() { current = useSlideProfiles(source.id, source.pageCount, true, source); return null; }
  globalThis.fetch = async () => new Response(JSON.stringify(profileResponse()));
  globalThis.__cueServerPdfUnconfirmed = () => calls.length > 0;
  globalThis.__cueServerSlides = async (local, endpoint, _signal, _timeout, retry) => {
    calls.push({ local, endpoint, retry });
    if (calls.length === 1) throw Error('Lost public PDF response.');
    writeStored(`server-deck:${api}:${source.id}`, deckId);
    return { deckId, texts: ['','',''] };
  };
  try {
    await act(async () => { renderer = create(React.createElement(Presentation)); });
    assert.deepEqual(calls, [{ local: source, endpoint: api, retry: false }]);
    await act(async () => t.mock.timers.tick(2500));
    assert.deepEqual(calls, [
      { local: source, endpoint: api, retry: false },
      { local: source, endpoint: api, retry: true },
    ]);
    assert.equal(current.value.state, 'completed');
    await act(async () => t.mock.timers.tick(30000));
    assert.equal(calls.length, 2);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.fetch = original;
    delete globalThis.__cueServerPdfUnconfirmed;
    delete globalThis.__cueServerSlides;
  }
});
