import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as Module from 'node:module';
import { resolve } from './helpers/pdf-native-loader.mjs';
import { select } from './helpers/pdf-picker-stub.mjs';
import { root, documentDirectory } from './helpers/pdf-node-storage.mjs';

if (Module.registerHooks) Module.registerHooks({ resolve });
else Module.register('./helpers/pdf-native-loader.mjs', import.meta.url);
const { pdfService, getImportedPdfs } = await import('../src/features/pdf/service.ts');
const folder = new URL('outloud-pdfs/', documentDirectory);
const catalog = new URL('catalog.json', folder);
const original = new URL('original.pdf', documentDirectory);
beforeEach(async () => {
  await fs.rm(folder, { recursive: true, force: true });
  select({ canceled: true, assets: null });
});
after(() => fs.rm(root, { recursive: true, force: true }));
async function pick(text = '%PDF-1.7\nfixture', overrides = {}) {
  await fs.writeFile(original, text);
  select({ canceled: false, assets: [{ uri: original.href, name: 'Talk.pdf', mimeType: 'application/pdf', size: text.length, ...overrides }] });
}

test('cancelled picker does not create a catalog or substitute sample data', async () => {
  assert.equal(await pdfService.importPdf(), null);
  assert.deepEqual(await getImportedPdfs(), []);
  await assert.rejects(fs.stat(folder), { code: 'ENOENT' });
});

test('import copies the source and persists the selected PDF for later reads', async () => {
  await pick();
  const pdf = await pdfService.importPdf();
  assert.equal(pdf.title, 'Talk');
  assert.notEqual(pdf.uri, original.href);
  assert.deepEqual(await getImportedPdfs(), [pdf]);
  assert.equal(await fs.readFile(new URL(pdf.uri), 'utf8'), '%PDF-1.7\nfixture');
  assert.equal(await fs.readFile(original, 'utf8'), '%PDF-1.7\nfixture');
});

test('empty and disguised non-PDF input fail without saving an entry', async () => {
  await pick('');
  await assert.rejects(pdfService.importPdf(), /empty/);
  await pick('plain text', { name: 'fake.pdf' });
  await assert.rejects(pdfService.importPdf(), /valid PDF/);
  assert.deepEqual(await getImportedPdfs(), []);
});

test('catalog failure removes the newly copied file and preserves the source', async () => {
  await fs.mkdir(folder);
  await fs.writeFile(catalog, '{broken');
  await pick();
  await assert.rejects(pdfService.importPdf(), /could not be read/);
  assert.deepEqual(await fs.readdir(folder), ['catalog.json']);
  assert.equal(await fs.readFile(original, 'utf8'), '%PDF-1.7\nfixture');
});

test('removing an imported PDF deletes only its app copy and catalog entry', async () => {
  await pick();
  const pdf = await pdfService.importPdf();
  await pdfService.removePdf(pdf.id);
  assert.deepEqual(await getImportedPdfs(), []);
  await assert.rejects(fs.stat(new URL(pdf.uri)), { code: 'ENOENT' });
  assert.equal(await fs.readFile(original, 'utf8'), '%PDF-1.7\nfixture');
});
