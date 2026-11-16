import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { resolve, load } from './helpers/saved-screen-loader.mjs';
import { files, network } from './helpers/upload-native.mjs';
import { backgroundApp, setFocused } from './helpers/recording-screen-ui.mjs';
import { validationAudio } from './helpers/recording-screen-audio.mjs';
registerHooks({ resolve, load });

const { useReviewAudio, useReviewMedia, useReviewPdfMedia } = await import('../src/features/transcription/useReviewMedia.ts');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const api = 'https://synthetic.invalid/api';
const attempt = '11111111-1111-4111-8111-111111111111';
const remoteAudio = 'https://synthetic.invalid/recordings/take.wav';
const localAudio = 'file:///saved-take.wav';
const localPdf = 'file:///saved-slides.pdf';
let renderer;
let current;
async function mount(read) {
  function Probe() {
    current = read();
    return current.validators;
  }
  await act(async () => { renderer = create(React.createElement(Probe)); });
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined;
  validationAudio.status = null;
  validationAudio.players.length = 0;
  network.requests.length = 0;
  network.respond = null;
  files.clear();
  backgroundApp('active');
  setFocused(true);
});

test('review uses saved media offline and ignores a renderer error from an expired focus session', async () => {
  files.set(localAudio, { data: 'saved audio' });
  files.set(localPdf, { data: 'saved PDF' });
  const saved = { state: 'saved', recording: { audio_uri: localAudio, duration_ms: 2000 },
    pdf_uri: localPdf, page_count: 4 };
  const knownPdfs = [localPdf];
  await mount(() => useReviewMedia(api, attempt, saved, null, null, knownPdfs));
  assert.equal(current.audio.uri, localAudio);
  assert.equal(current.pdf.busy, true);
  let validator = renderer.root.findByType('pdf');
  await act(async () => validator.props.onLoadComplete(4));
  assert.equal(current.pdf.uri, localPdf);
  const stalePdfError = current.pdfFailed;
  await act(async () => backgroundApp('background'));
  await act(async () => backgroundApp('active'));
  validator = renderer.root.findByType('pdf');
  await act(async () => validator.props.onLoadComplete(4));
  await act(async () => stalePdfError());
  assert.equal(current.pdf.uri, localPdf);
  await act(async () => current.pdfFailed());
  assert.match(current.pdf.error, /could not be opened/);
  assert.equal(current.pdf.uri, null);
  assert.ok(files.has(localAudio) && files.has(localPdf));
  assert.equal(network.requests.length, 0);
});

test('audio review retains a bad original, requires a deliberate download, and reuses the validated cache', async () => {
  files.set(localAudio, { data: 'cannot decode' });
  validationAudio.status = { error: 'fixture could not decode' };
  const saved = { state: 'saved', recording: { audio_uri: localAudio, duration_ms: 2000 } };
  const remote = { audio_url: remoteAudio, duration_ms: 2000 };
  await mount(() => useReviewAudio(api, attempt, saved, remote));
  assert.match(current.audio.error, /original file is retained/);
  assert.equal(network.requests.length, 0);
  network.respond = async () => new Response(null, { status: 503 });
  await act(async () => { await current.download(); });
  assert.match(current.audio.error, /download failed/);
  assert.ok(files.has(localAudio));

  network.respond = async () => new Response(new Uint8Array([1, 2, 3]));
  validationAudio.status = null;
  await act(async () => { await Promise.all([current.download(), current.download()]); });
  const downloaded = current.audio.uri;
  assert.ok(downloaded && downloaded !== localAudio);
  assert.equal(network.requests.length, 2);
  assert.ok(validationAudio.players.every(player => player.released));
  files.delete(localAudio);
  await act(async () => setFocused(false));
  await act(async () => setFocused(true));
  assert.equal(current.audio.uri, downloaded);
  assert.equal(network.requests.length, 2);
});

test('PDF-only review rejects a page mismatch and tries the next local copy', async () => {
  const alternate = 'file:///another-slide-copy.pdf';
  files.set(localPdf, { data: 'wrong deck' });
  files.set(alternate, { data: 'correct deck' });
  const originals = [localPdf, alternate];
  const deck = { id: '22222222-2222-4222-8222-222222222222', page_count: 4, pdf_url: 'https://synthetic.invalid/decks/slides.pdf' };
  await mount(() => useReviewPdfMedia(api, attempt, null, deck, originals));
  let validator = renderer.root.findByType('pdf');
  assert.equal(validator.props.source.uri, localPdf);
  await act(async () => validator.props.onLoadComplete(3));
  validator = renderer.root.findByType('pdf');
  assert.equal(validator.props.source.uri, alternate);
  await act(async () => validator.props.onLoadComplete(4));
  assert.equal(current.pdf.uri, alternate);
  assert.ok(files.has(localPdf));
  assert.equal(validationAudio.players.length, 0);
  assert.equal(network.requests.length, 0);
});
