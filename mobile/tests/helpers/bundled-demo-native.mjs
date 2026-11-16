// OpenAI Codex, 2026-11-02: asset/renderer fixtures; see docs/ai-collaboration-prompts-iteration-2.md.
// Asset and Android renderer boundaries only; catalog/filesystem/SQLite stay real.
import * as fs from 'node:fs/promises';
import { documentDirectory } from './pdf-node-storage.mjs';

export const demoNative = { assetDownloads: 0, renders: 0, failRender: false };
export const Asset = { fromModule() { return { async downloadAsync() {
  demoNative.assetDownloads++;
  return { localUri: new URL('../../assets/demo/Seoul.pdf', import.meta.url).href };
} }; } };
export default { async generateAllPages() {
  demoNative.renders++;
  if (demoNative.failRender) throw Error('Synthetic Android renderer failure');
  const pages = [];
  for (let index = 0; index < 7; index++) {
    const uri = new URL(`synthetic-render-${demoNative.renders}-${index}.jpg`, documentDirectory).href;
    await fs.writeFile(new URL(uri), `Synthetic thumbnail ${index}`);
    pages.push({ uri, width: 1280, height: 720 });
  }
  return pages;
} };
