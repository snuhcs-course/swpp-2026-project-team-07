import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { selectLayout } from '../src/layouts/selection.ts';
import { checkLayoutSource } from '../scripts/check-layout-boundaries.mjs';
test('startup layout selection defaults safely and rejects unknown or production test layouts', () => {
  assert.equal(selectLayout(undefined, false), 'refactor');
  assert.equal(selectLayout('refactor', false), 'refactor');
  assert.equal(selectLayout('contract-test', true), 'contract-test');
  for (const value of ['', 'Refactor', 'unknown', 'contract-test']) assert.throws(() => selectLayout(value, false), /EXPO_PUBLIC_UI_LAYOUT/);
});
test('layout import enforcement blocks integrations, native handles, dynamic loading and direct requests', () => {
  const file = fileURLToPath(new URL('../src/layouts/refactor/ExampleView.tsx', import.meta.url));
  for (const source of ["import { api } from '../../services/api'", "import { useAttemptAnalysis } from '../../features/transcription/useAttemptAnalysis'", "import { player } from 'expo-audio'", "import { NativeModules } from 'react-native'", "fetch('/process/')", "globalThis.fetch('/process/')", "require('../../services/storage')", "import('../../services/api')", "export { api } from '../../services/api'", "import { router } from 'expo-router'"]) assert.ok(checkLayoutSource(file, source).length, source);
  assert.deepEqual(checkLayoutSource(file, "import type { ReviewModel } from '../contracts'; import { Text } from 'react-native';"), []);
});
