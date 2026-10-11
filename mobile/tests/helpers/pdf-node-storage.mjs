// Native filesystem boundary mapped to a real isolated temporary directory.
import * as fs from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
export const root = mkdtempSync(join(tmpdir(), 'outloud-pdf-test-'));
export const documentDirectory = pathToFileURL(root).href + '/';
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };
export async function getInfoAsync(uri) {
  try { const stat = await fs.stat(new URL(uri)); return { exists: true, isDirectory: stat.isDirectory(), size: stat.size }; }
  catch (error) { if (error.code === 'ENOENT') return { exists: false }; throw error; }
}
export async function readAsStringAsync(uri, options = {}) {
  const bytes = await fs.readFile(new URL(uri));
  if (options.encoding === 'base64') return bytes.subarray(options.position ?? 0, options.length === undefined ? undefined : (options.position ?? 0) + options.length).toString('base64');
  return bytes.toString('utf8');
}
export async function makeDirectoryAsync(uri) { await fs.mkdir(new URL(uri), { recursive: true }); }
export async function copyAsync({ from, to }) { await fs.copyFile(new URL(from), new URL(to)); }
export async function writeAsStringAsync(uri, text) { await fs.writeFile(new URL(uri), text); }
export async function deleteAsync(uri, options) { await fs.rm(new URL(uri), { force: options?.idempotent }); }

export async function moveAsync({ from, to }) { await fs.rename(new URL(from), new URL(to)); }
