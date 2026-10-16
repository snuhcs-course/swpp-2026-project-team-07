// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex time/audience setup: docs/ai-collaboration-prompts-iteration-2.md#presentation-time-and-audience-setup-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: Upload → analysis (SPEC §4.3), made real:
//   Rendering slides   → page images on the device (Android PdfRenderer)
//   Reading slide text → the server's extracted text (existing POST /decks/)
//   Setting slide timing → per-slide targets from the amount of text
// Updated PDF and slide limits by OpenAI Codex, Iteration 2 (2026-10-14).
import * as FileSystem from 'expo-file-system/legacy';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import { pdfService, type LocalPdf } from '../pdf/service';
import { serverSlides } from './serverDeck';
import { defaultTarget, parseSlideText, slideTargets } from '../../domain/slides';
import { deckById, forgetPresentation, nextHue, nextOrder, savePresentation, type PageImage, type Presentation } from './store';

export type Progress = { progress: number; status: string; pages: number | null; textOffline?: boolean };

export function pickPdf(): Promise<LocalPdf | null> { return pdfService.importPdf(); }

function pagesDir(id: string) {
  if (!FileSystem.documentDirectory) throw new Error('Local storage is unavailable on this device.');
  return `${FileSystem.documentDirectory}outloud-slides/${id}/`;
}

/** Render every page to a JPEG kept with the app's documents (the thumbnail cache can be cleared by Android). */
export async function renderPages(pdf: { id: string; uri: string }): Promise<PageImage[]> {
  const rendered = await PdfThumbnail.generateAllPages(pdf.uri, { quality: 85, maxWidth: 1280, maxHeight: 1280 });
  const dir = pagesDir(pdf.id);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const out: PageImage[] = [];
  for (let i = 0; i < rendered.length; i++) {
    const to = `${dir}${i}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: rendered[i].uri, to });
    FileSystem.deleteAsync(rendered[i].uri, { idempotent: true }).catch(() => undefined);
    out.push({ uri: to, w: rendered[i].width, h: rendered[i].height });
  }
  return out;
}

const STATUS = ['Rendering slides', 'Reading slide text', 'Setting slide timing', 'Ready'];

/**
 * Analyse a picked PDF and save it as a presentation. Progress is reported in the
 * three stages the design shows. Slide text needs the server; offline it is fetched later.
 */
export async function analyzePdf(pdf: LocalPdf, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<Presentation> {
  const check = () => { if (signal.aborted) throw new Error('cancelled'); };
  onProgress({ progress: 0.02, status: STATUS[0], pages: null });
  let pages: PageImage[];
  try { pages = await renderPages(pdf); }
  catch (error) {
    const code = (error as { code?: string })?.code;
    throw new Error(code === 'PASSWORD_PROTECTED' ? 'This PDF is password-protected. Export an unlocked copy and try again.'
      : 'This PDF could not be opened. It may be damaged.');
  }
  check();
  if (!pages.length) throw new Error('This PDF has no pages.');
  onProgress({ progress: 0.34, status: STATUS[1], pages: pages.length });

  let texts: string[] | null = null;
  try { texts = (await serverSlides({ id: pdf.id, title: pdf.title, uri: pdf.uri, pageCount: pages.length }, undefined, signal)).texts; }
  catch { check(); /* Offline or server error: slide text is fetched later. */ }
  check();
  onProgress({ progress: 0.67, status: STATUS[2], pages: pages.length, textOffline: !texts });

  const slides = Array.from({ length: pages.length }, (_, i) => parseSlideText(texts?.[i] ?? '', i));
  const target = defaultTarget(pages.length);
  const deck: Presentation = {
    id: pdf.id, title: pdf.title, uri: pdf.uri, order: nextOrder(), hue: nextHue(), icon: 'present',
    pageCount: pages.length, pages, slides, text: texts ? (texts.some(t => t.trim()) ? 'ready' : 'none') : 'pending',
    target, targets: slideTargets(slides.map(s => s.text), target), audience: '', createdAt: new Date().toISOString(),
  };
  check();
  savePresentation(deck);
  onProgress({ progress: 1, status: STATUS[3], pages: pages.length, textOffline: !texts });
  return deck;
}

/** Undo an import that was cancelled or rejected: remove the app's PDF copy and its page images. */
export async function discardImport(pdf: LocalPdf) {
  forgetPresentation(pdf.id);
  try { await pdfService.removePdf(pdf.id); } catch { /* A saved rehearsal keeps its PDF. */ }
  try { await FileSystem.deleteAsync(pagesDir(pdf.id), { idempotent: true }); } catch { /* Best effort. */ }
}

/** PDFs imported before the redesign have no page images yet. */
export async function ensurePages(id: string) {
  const deck = deckById(id);
  if (!deck || deck.pages.length) return;
  const pages = await renderPages(deck);
  const latest = deckById(id);
  if (!latest) return;
  const pageCount = pages.length;
  const slides = latest.slides.length === pageCount ? latest.slides : Array.from({ length: pageCount }, (_, i) => parseSlideText('', i));
  const target = latest.pageCount === pageCount ? latest.target : defaultTarget(pageCount);
  savePresentation({ ...latest, pages, pageCount, slides, target, targets: slideTargets(slides.map(s => s.text), target) });
}

/** Fetch slide text that could not be read at import time (e.g. offline). Silent on failure. */
export async function ensureSlideText(id: string) {
  const deck = deckById(id);
  if (!deck || deck.text !== 'pending' || !deck.pageCount) return;
  try {
    const { texts } = await serverSlides({ id: deck.id, title: deck.title, uri: deck.uri, pageCount: deck.pageCount });
    const latest = deckById(id);
    if (!latest) return;
    const slides = texts.map((t, i) => parseSlideText(t, i));
    savePresentation({ ...latest, slides, text: texts.some(t => t.trim()) ? 'ready' : 'none', targets: slideTargets(slides.map(s => s.text), latest.target) });
  } catch { /* Still offline. */ }
}
