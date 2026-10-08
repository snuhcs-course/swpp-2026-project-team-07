import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve } from './helpers/storage-native-loader.mjs';
import { sqliteFaults } from './helpers/sqlite-node.mjs';
registerHooks({ resolve });
const records = await import('../src/services/storage.ts');
const storage = await import('../src/features/recording/storage.ts');
const deck = { id: 'local-test', uri: 'file:///synthetic.pdf', title: 'Synthetic', pageCount: 2 };
const events = [{ slide_index: 1, at_ms: 0 }, { slide_index: 0, at_ms: 900 }];

test('failed schema initialization closes the handle and retries before using SQLite', () => {
  sqliteFaults.before = op => { if (op === 'exec') throw new Error('disk unavailable'); };
  assert.throws(() => records.writeStored('probe', 1), /disk unavailable/);
  sqliteFaults.before = null;
  assert.equal(sqliteFaults.closed, 1);
  records.writeStored('probe', 2);
  assert.equal(records.readStored('probe'), 2);
});

test('startup recovery failure blocks new capture and retry never rewrites a later active capture', () => {
  const id = 'old-attempt';
  storage.saveAttempt({ id, local_deck_id: deck.id, state: 'capturing', created_at: '2026-01-01', recording: { audio_uri: 'file:///old.wav' } });
  sqliteFaults.before = op => { if (op === 'run') throw new Error('disk full'); };
  try { assert.throws(() => storage.beginAttempt(deck, '', 1, 'file:///new.wav'), /disk full/); }
  finally { sqliteFaults.before = null; }
  const active = storage.beginAttempt(deck, '', 1, 'file:///new.wav');
  storage.recoverPendingAttempts();
  assert.equal(storage.getSavedAttempt(id).state, 'interrupted');
  assert.equal(storage.getSavedAttempt(active).state, 'capturing');
  assert.equal(storage.getSavedAttempt(active).recording.audio_uri, 'file:///new.wav');
});

test('checkpoint and finalization failures preserve the last durable URI and timeline', () => {
  const id = storage.beginAttempt(deck, '', 1, 'file:///prepared.wav');
  assert.equal(storage.getSavedAttempt(id).recording.audio_uri, 'file:///prepared.wav');
  storage.checkpointAttempt(id, 'file:///prepared.wav', 1000, events);
  const previous = storage.getSavedAttempt(id);
  sqliteFaults.before = op => { if (op === 'run') throw new Error('disk full'); };
  try {
    assert.throws(() => storage.checkpointAttempt(id, '', 1500, events), /disk full/);
    assert.throws(() => storage.checkpointAttempt(id, 'file:///final.wav', 2000, events, true), /disk full/);
  } finally { sqliteFaults.before = null; }
  assert.deepEqual(storage.getSavedAttempt(id), previous);
});
