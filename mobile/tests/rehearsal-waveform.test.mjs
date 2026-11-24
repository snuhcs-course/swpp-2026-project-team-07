// Real waveform component with deterministic native animation adapters.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { resolve, load } from './helpers/qa-screen-runtime-loader.mjs';

registerHooks({ resolve, load });
const { Waveform } = await import('../src/design/ui.tsx');
const { flattenStyle, runtime } = await import('./helpers/qa-screen-runtime-native.mjs');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('rehearsal waveform keeps bar footprints while applying each new measured height', async () => {
  const first = Object.freeze(Array(28).fill(6));
  const next = Object.freeze([...first.slice(1), 24]);
  const visibleHeight = style => style.height * style.transform[0].scaleY;
  const waveform = bars => React.createElement(Waveform, { bars, live: true, smooth: true });
  let renderer;
  try {
    await act(async () => { renderer = create(waveform(first)); });
    const bars = () => renderer.root.findAllByType('animated').map(node => flattenStyle(node.props.style));
    assert.equal(bars().length, 28);
    assert.equal(visibleHeight(bars().at(-1)), 6);
    await act(async () => renderer.update(waveform(next)));
    assert.ok(bars().every(bar => bar.width === 4 && bar.height === 30));
    assert.equal(visibleHeight(bars().at(-2)), 6);
    assert.equal(visibleHeight(bars().at(-1)), 24);
    assert.equal(bars().at(-1).backgroundColor, '#FF5A4E');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
  }
});

test('idle, other live consumers and reduced motion render their samples directly', async () => {
  for (const [live, smooth, reduced] of [[false, true, false], [true, false, false], [true, true, true]]) {
    runtime.reducedMotion = reduced;
    let renderer;
    try {
      await act(async () => { renderer = create(React.createElement(Waveform, { bars: [6, 18], live, smooth })); });
      assert.equal(renderer.root.findAllByType('animated').length, 0);
      const bars = renderer.root.findAllByType('view').slice(1).map(node => flattenStyle(node.props.style));
      assert.deepEqual(bars.map(bar => bar.height), [6, 18]);
    } finally {
      if (renderer) await act(async () => renderer.unmount());
      runtime.reducedMotion = false;
    }
  }
});
