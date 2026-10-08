import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolve } from './helpers/storage-native-loader.mjs';
registerHooks({ resolve });
const storage = await import('../src/features/recording/storage.ts');
const { recoverRecording } = await import('../src/features/recording/recovery.ts');
const deck = { id: 'local-pdf', title: 'Pilot', uri: 'file:///pilot.pdf', pageCount: 6 };

test('each capture owns one UUID, distinct from local deck identity; finalization preserves visits', () => {
  const first = storage.beginAttempt(deck, 'students', 2), second = storage.beginAttempt(deck, '', 1);
  assert.notEqual(first, second);
  assert.equal(storage.getSavedAttempt(first).recording.deck_id, undefined);
  const events = [{ slide_index: 2, at_ms: 0 }, { slide_index: 3, at_ms: 500 }, { slide_index: 2, at_ms: 1000 }];
  storage.checkpointAttempt(first, 'file:///audio.m4a', 2000, events, true);
  events[0].slide_index = 0;
  const saved = storage.getSavedAttempt(first);
  assert.equal(saved.id, first); assert.equal(saved.state, 'saved');
  assert.deepEqual(saved.recording.slide_events.map(e => e.slide_index), [2, 3, 2]);
});

test('recovery uses playable media duration, retains backwards visits and refuses oversize duration', () => {
  const recording = { id: 'a', audio_uri: 'file:///audio.m4a', audience: '', duration_ms: 1000,
    slide_events: [{ slide_index: 2, at_ms: 0 }, { slide_index: 1, at_ms: 800 }, { slide_index: 0, at_ms: 2000 }] };
  assert.deepEqual(recoverRecording(recording, 2000).slide_events.map(e => e.slide_index), [2,1]);
  assert.equal(recording.slide_events.length, 3);
  for (const duration of [NaN, 0, 600001]) assert.throws(() => recoverRecording(recording, duration));
});

test('SQLite persists checkpoint/audio and interrupted uploads through a new process', () => {
  const folder = mkdtempSync(join(tmpdir(), 'onloud-attempt-'));
  const env = { ...process.env, ONLOUD_TEST_DB: join(folder, 'test.db') };
  const setup = `import { registerHooks } from 'node:module'; import { resolve } from './tests/helpers/storage-native-loader.mjs'; registerHooks({resolve}); const s = await import('./src/features/recording/storage.ts');`;
  try {
    const ids = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', setup + `const id=s.beginAttempt(${JSON.stringify(deck)},'',2);s.checkpointAttempt(id,'file:///retained.m4a',1500,[{slide_index:2,at_ms:0}]); const b=s.beginAttempt(${JSON.stringify(deck)},'',0);s.saveAttempt({...s.getSavedAttempt(b),state:'uploading'});console.log(JSON.stringify([id,b]));`], { env, encoding:'utf8' }));
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module','-e',setup + `s.recoverPendingAttempts(); console.log(JSON.stringify(${JSON.stringify(ids)}.map(id=>s.getSavedAttempt(id))));`], {env,encoding:'utf8'}));
    assert.equal(result[0].state,'interrupted'); assert.equal(result[0].recording.audio_uri,'file:///retained.m4a');
    assert.equal(result[0].recording.duration_ms,1500); assert.equal(result[1].state,'upload_failed');
    assert.equal(result[1].id,ids[1]);
  } finally { rmSync(folder,{recursive:true}); }
});

test('restart after server acknowledgement and local save failure retries the same upload identity', () => {
  const folder = mkdtempSync(join(tmpdir(), 'onloud-upload-restart-'));
  const env = { ...process.env, ONLOUD_TEST_DB: join(folder, 'test.db') };
  const setup = `import { registerHooks } from 'node:module'; import { resolve } from './tests/helpers/upload-loader.mjs'; registerHooks({resolve});
    const s=await import('./src/features/recording/storage.ts'); const u=await import('./src/features/recording/upload.ts');
    const { files, network, response }=await import('./tests/helpers/upload-native.mjs');
    const { sqliteFaults }=await import('./tests/helpers/sqlite-node.mjs');
    files.set('file:///synthetic.pdf',{}); files.set('file:///synthetic.wav',{});
    let payload; const deckId='11111111-1111-4111-8111-111111111111';
    network.respond=(url,init)=> {
      if(url.endsWith('/decks/')) return response(201,{deck:{id:deckId,page_count:2}});
      if(url.includes('/decks/')) return response(200,{id:deckId,page_count:2});
      payload=init.body.get('metadata');
      if(process.env.FAIL_AFTER_ACK) sqliteFaults.before=op=>{if(op==='run') throw new Error('synthetic disk full');};
      return response(201,{attempt_id:JSON.parse(payload).id});
    };`;
  try {
    const first = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', setup + `
      const id=s.beginAttempt({id:'local',uri:'file:///synthetic.pdf',title:'Synthetic',pageCount:2},'',1,'file:///synthetic.wav');
      s.checkpointAttempt(id,'file:///synthetic.wav',2000,[{slide_index:1,at_ms:0},{slide_index:0,at_ms:700},{slide_index:1,at_ms:1200}],true);
      try{await u.uploadAttempt(id);}catch{} console.log(JSON.stringify({id,payload,state:s.getSavedAttempt(id).state}));`], { env: { ...env, FAIL_AFTER_ACK: '1' }, encoding: 'utf8' }));
    assert.equal(first.state, 'uploading');
    const next = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', setup + `
      s.recoverPendingAttempts(); await u.uploadAttempt(${JSON.stringify(first.id)});
      console.log(JSON.stringify({payload,requests:network.requests.map(r=>r.url),saved:s.getSavedAttempt(${JSON.stringify(first.id)})}));`], { env, encoding: 'utf8' }));
    assert.equal(next.payload, first.payload);
    assert.equal(next.saved.state, 'submitted');
    assert.equal(next.saved.recording.audio_uri, 'file:///synthetic.wav');
    assert.equal(next.requests.some(url => url.endsWith('/decks/') || url.includes('/process/')), false);
  } finally { rmSync(folder, { recursive: true }); }
});
