import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { resolve, load } from './helpers/library-screen-loader.mjs';

registerHooks({ resolve, load });
const React = await import('react');
const { act, create } = await import('react-test-renderer');
const { MiniSlide } = await import('../src/design/SlideCard.tsx');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('landscape keeps the decoded slide while requests change and ignores obsolete image callbacks', async () => {
  let r;
  const settled = [];
  const slide = (id, landscape = true) => React.createElement(MiniSlide, {
    page: id ? { uri: id, w: 16, h: 9 } : undefined, title: id || 'Slide without bitmap', hue: 'violet',
    width: 390, height: 220, radius: 6, keepPdfWhileLoading: landscape,
    onImageSettled: () => settled.push(id),
  });
  const images = () => r.root.findAllByType('image');
  const imageFor = uri => images().find(node => node.props.source.uri === uri);
  const visible = () => images().filter(node => node.props.style[1]?.opacity !== 0).map(node => node.props.source.uri);
  const change = id => act(async () => r.update(slide(id)));
  try {
    await act(async () => { r = create(slide('A')); });
    assert.deepEqual(visible(), []);
    assert.equal(r.root.findAllByType('gradient').length, 0);
    assert.equal(imageFor('A').props.fadeDuration, 0);
    await act(async () => imageFor('A').props.onLoad());
    const shownA = imageFor('A');
    assert.deepEqual(visible(), ['A']);

    await change('B');
    const obsoleteLoad = imageFor('B').props.onLoad;
    const obsoleteError = imageFor('B').props.onError;
    assert.deepEqual(visible(), ['A']);
    await change('A');
    assert.equal(imageFor('A'), shownA);
    await change('B');
    await act(async () => { obsoleteLoad(); obsoleteError(); });
    assert.deepEqual(visible(), ['A']);

    const pendingB = imageFor('B');
    await act(async () => pendingB.props.onLoad());
    assert.equal(imageFor('B'), pendingB);
    assert.deepEqual(visible(), ['B']);
    assert.deepEqual(settled, ['A', 'B']);

    await change('C');
    assert.deepEqual(visible(), ['B']);
    await act(async () => imageFor('C').props.onError());
    assert.deepEqual(visible(), []);
    assert.deepEqual(settled, ['A', 'B', 'C']);
    assert.match(JSON.stringify(r.toJSON()), /"C"/);
    assert.equal(r.root.findAllByType('gradient').length, 0);

    await change(null);
    assert.equal(r.root.findAllByType('gradient').length, 1);
    await act(async () => r.update(slide('Review image', false)));
    assert.equal(r.root.findAllByType('gradient').length, 1);
    assert.equal(imageFor('Review image').props.fadeDuration, undefined);
  } finally {
    if (r) await act(async () => r.unmount());
  }
});
