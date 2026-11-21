// OpenAI Codex, 2026-11-21: a timed-out PDF upload cannot silently repeat after import or app restart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve as domainResolve, load } from './helpers/domain-loader.mjs';
import { resolve as storageResolve } from './helpers/storage-native-loader.mjs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'expo-file-system') return { url: `data:text/javascript,export class File extends Blob { constructor(uri) { super(['%PDF-1.7']); this.uri = uri; } }`, shortCircuit: true };
    if (specifier.endsWith('/services/backendFetch')) return { url: `data:text/javascript,export const backendExpoFetch=(...args)=>globalThis.__serverDeckFetch(...args);export const backendFetch=backendExpoFetch;`, shortCircuit: true };
    return domainResolve(specifier, context, (value, parent) => storageResolve(value, parent, nextResolve));
  }, load,
});

const { serverSlides, serverPdfUnconfirmed } = await import('../src/features/presentations/serverDeck.ts');
const { readStored, removeStored } = await import('../src/services/storage.ts');
const api = 'https://pdf-uncertainty.invalid/api';
const deckId = '24242424-2424-4242-8242-242424242424';

test('an unconfirmed upload remains blocked across calls until explicit refresh confirms one server deck', async () => {
  const local = { id: 'pdf-uncertain-test', title: 'Uncertain upload', uri: 'file:///local.pdf', pageCount: 1 };
  const key = `server-deck:${api}:${local.id}`;
  removeStored(key);removeStored(`server-deck-unconfirmed:${api}:${local.id}`);
  let posts = 0;
  globalThis.__serverDeckFetch = async (_url, init) => {
    posts++;
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(Error('network lost')), { once: true }));
  };
  try {
    const first = serverSlides(local, api, undefined, 5);
    assert.equal(serverPdfUnconfirmed(local.id, api), true);
    assert.equal(readStored(key), null);
    await assert.rejects(serverSlides(local, api), /Tap Refresh with server/);
    assert.equal(posts, 1, 'a simultaneous preview must not duplicate the in-flight upload');
    await assert.rejects(first, /did not confirm/);
    await assert.rejects(serverSlides(local, api), /Tap Refresh with server/);
    assert.equal(posts, 1, 'focus recovery must not duplicate the timed-out upload');

    globalThis.__serverDeckFetch = async (_url, init) => {
      assert.equal(init.method, 'POST');posts++;
      return new Response(JSON.stringify({ deck: { id: deckId, page_count: 1 }, slides: [{ slide_index: 0, extracted_text: 'Verified slide text' }] }), { status: 201 });
    };
    const result = await serverSlides(local, api, undefined, 1000, true);
    assert.deepEqual(result, { deckId, texts: ['Verified slide text'] });
    assert.equal(posts, 2);
    assert.equal(serverPdfUnconfirmed(local.id, api), false);
    assert.equal(readStored(key), deckId);
  } finally {
    delete globalThis.__serverDeckFetch;
    removeStored(key);removeStored(`server-deck-unconfirmed:${api}:${local.id}`);
  }
});
