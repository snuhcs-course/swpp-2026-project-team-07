import type { Layout } from './contracts';
import { contractTestLayout } from './contract-test';
import { refactorLayout } from './refactor';
import { selectLayout } from './selection';
const development = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'test';
export const selectedLayoutId = selectLayout(process.env.EXPO_PUBLIC_UI_LAYOUT, development);
// Select once per JS launch. Production rejects the test layout; no UI is mounted by registration.
export const activeLayout: Layout = selectedLayoutId === 'contract-test'
  ? contractTestLayout : refactorLayout;
