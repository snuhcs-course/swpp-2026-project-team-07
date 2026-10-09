import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { registerHooks } from 'node:module';
import { resolve, load } from './helpers/saved-screen-loader.mjs';
import { routes } from './helpers/recording-screen-ui.mjs';
import { network } from './helpers/upload-native.mjs';
registerHooks({ resolve, load });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { activeLayout } = await import('../src/layouts/registry.ts');
test('layout registration and navigation expose utilities without requesting generation', async () => {
  assert.equal(activeLayout.id, process.env.EXPO_PUBLIC_UI_LAYOUT || 'refactor');
  assert.equal(network.requests.length, 0, 'Importing the registry performs no integration work.');
  let shell, controls;
  try {
    await act(() => { shell = create(React.createElement(activeLayout.MainNavigation)); });
    const headers = shell.root.findAll(n => n.props.screenOptions?.headerRight || n.props.options?.headerRight);
    const unique = [...new Set(headers.map(n => n.props.screenOptions?.headerRight || n.props.options.headerRight))];
    await act(() => { controls = create(React.createElement(React.Fragment, null, ...unique.map(render => render()))); });
    const help = controls.root.findAllByType('action').find(n => n.props.label === 'Help and connection');
    assert.ok(help, 'Every navigation shell must retain the utility route, including sample previews.');
    await act(() => help.props.onPress());
    assert.equal(routes.at(-1), '/utilities');
    assert.equal(network.requests.length, 0);
  } finally { await act(() => { shell?.unmount(); controls?.unmount(); }); }
});
