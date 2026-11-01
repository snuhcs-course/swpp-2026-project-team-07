// OpenAI Codex, 2026-11-02: offline Seoul seeding; see docs/ai-collaboration-prompts-iteration-2.md.
// User-selected Seoul PDF and its extracted text; no synthetic recordings or provider results.
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import pageTexts from '../../../assets/demo/Seoul-text.json';
import { isHue, pickHue } from '../../domain/hues';
import { parseSlideText, slideTargets } from '../../domain/slides';
import { readStored, writeStored } from '../../services/storage';
import { getImportedPdfs, pdfService } from '../pdf/service';
import { renderPages } from '../pdf/renderPages';
import { DEFAULT_AUDIENCE, DEFAULT_DURATION_SECONDS } from './defaultRequirementsState';
import type { Presentation } from './store';

export const SEOUL_DEMO_ID = 'outloud-bundled-seoul-v1';
export const SEOUL_DEMO_MARKER = 'bundled-demo:seoul:v1';
const presentationKey = `pres:v1:${SEOUL_DEMO_ID}`;

/** Startup is serialized by loadPresentations; the persisted marker respects later hide/delete choices. */
export async function ensureBundledDemo() {
  if (readStored<boolean>(SEOUL_DEMO_MARKER) === true) return;
  let deck = readStored<Presentation>(presentationKey);
  if (deck && (deck.id !== SEOUL_DEMO_ID || typeof deck.title !== 'string' || typeof deck.uri !== 'string')) {
    throw new Error('The saved Seoul presentation could not be read.');
  }
  if (!deck) {
    if (!FileSystem.documentDirectory) throw new Error('Local document storage is unavailable.');
    const asset = await Asset.fromModule(require('../../../assets/demo/Seoul.pdf')).downloadAsync();
    if (!asset.localUri) throw new Error('The bundled Seoul presentation could not be opened.');
    const directory = `${FileSystem.documentDirectory}outloud-demo/`;
    const uri = `${directory}Seoul.pdf`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    await FileSystem.copyAsync({ from: asset.localUri, to: `${uri}.tmp` });
    await FileSystem.moveAsync({ from: `${uri}.tmp`, to: uri });
    const pages = await renderPages({ id: SEOUL_DEMO_ID, uri });
    if (pages.length !== 7 || pageTexts.length !== 7) throw new Error('The bundled Seoul presentation must contain seven slides.');
    const slides = pageTexts.map(parseSlideText);
    const existing = (await getImportedPdfs()).map(pdf => readStored<Partial<Presentation>>(`pres:v1:${pdf.id}`));
    deck = {
      id: SEOUL_DEMO_ID, title: 'Seoul', uri,
      order: Math.max(0, ...existing.map(item => typeof item?.order === 'number' ? item.order : 0)) + 1,
      hue: pickHue(existing.map(item => item?.hue).filter(isHue)), icon: 'present',
      pageCount: pages.length, pages, slides, text: 'ready', target: DEFAULT_DURATION_SECONDS,
      targets: slideTargets(slides.map(slide => slide.text), DEFAULT_DURATION_SECONDS),
      audience: DEFAULT_AUDIENCE, createdAt: new Date().toISOString(),
    };
    writeStored(presentationKey, deck);
  }
  await pdfService.addBundledPdf({ id: deck.id, title: deck.title, uri: deck.uri });
  writeStored(SEOUL_DEMO_MARKER, true);
}
