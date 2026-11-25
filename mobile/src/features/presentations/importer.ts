// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex time/audience setup: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-107
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OutLoud redesign: Upload → analysis (SPEC §4.3), made real:
//   Rendering slides   → page images on the device (Android PdfRenderer)
//   Reading slide text → the server's extracted text (existing POST /decks/)
//   Setting slide timing → per-slide targets from the amount of text
// Updated PDF and slide limits by OpenAI Codex, Iteration 2 (2026-10-14).
import * as FileSystem from 'expo-file-system/legacy';
import { pdfService, type LocalPdf } from '../pdf/service';
import { renderPages } from '../pdf/renderPages';
import { API_URL } from '../../services/api';
import { requestPresentationDefaults,cancelPresentationDefaults } from './defaultRequirements';
import { serverSlides } from './serverDeck';
import { defaultTarget, parseSlideText, slideTargets } from '../../domain/slides';
import { deckById, forgetPresentation, nextHue, nextOrder, savePresentation, type PageImage, type Presentation } from './store';

export type Progress = {
  stage: 'finding' | 'reading' | 'planning' | 'ready';
  pages: number | null;
  textOffline?: boolean;
  imageOnlySlides?: boolean;
};

export function pickPdf(): Promise<LocalPdf | null> { return pdfService.importPdf(); }
// OpenAI Codex, 2026-11-02: shared renderer extraction; see docs/ai-collaboration/README.md#prompt-logs.
export { renderPages } from '../pdf/renderPages';

function pagesDir(id: string) {
  if (!FileSystem.documentDirectory) throw new Error('Local storage is unavailable on this device.');
  return `${FileSystem.documentDirectory}outloud-slides/${id}/`;
}

export const SLIDE_TEXT_WAIT_MS = 20_000;

/**
 * Analyse a picked PDF and save it as a presentation. Progress is reported in the
 * three stages the design shows. Slide text needs the server; offline it is fetched later.
 */
export async function analyzePdf(pdf: LocalPdf, onProgress: (p: Progress) => void, signal: AbortSignal): Promise<Presentation> {
  const check = () => { if (signal.aborted) throw new Error('cancelled'); };
  onProgress({ stage: 'finding', pages: null });
  let pages: PageImage[];
  try { pages = await renderPages(pdf); }
  catch (error) {
    const code = (error as { code?: string })?.code;
    throw new Error(code === 'PASSWORD_PROTECTED' ? 'This PDF is password-protected. Export an unlocked copy and try again.'
      : 'This PDF could not be opened. It may be damaged.');
  }
  check();
  if (!pages.length) throw new Error('This PDF has no pages.');
  onProgress({ stage: 'reading', pages: pages.length });

  // Bound the wait on the setup screen while the upload continues for slow decks.
  const extraction = serverSlides({ ...pdf, pageCount: pages.length }, undefined, signal).then(value => value.texts, () => null);
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  const localSetupDeadline = new Promise<null>(resolve => { waitTimer = setTimeout(() => resolve(null), SLIDE_TEXT_WAIT_MS); });
  const texts = await Promise.race([extraction, localSetupDeadline]).finally(() => clearTimeout(waitTimer));
  check();
  onProgress({ stage: 'planning', pages: pages.length, textOffline: !texts });

  const slides = Array.from({ length: pages.length }, (_, i) => parseSlideText(texts?.[i] ?? '', i));
  const target = defaultTarget(pages.length);
  const deck: Presentation = {
    id: pdf.id, title: pdf.title, uri: pdf.uri, order: nextOrder(), hue: nextHue(), icon: 'present',
    pageCount: pages.length, pages, slides, text: texts ? (texts.some(t => t.trim()) ? 'ready' : 'none') : 'pending',
    target, targets: slideTargets(slides.map(s => s.text), target), audience: '', createdAt: new Date().toISOString(),
  };
  check();
  if(!deckById(deck.id))requestPresentationDefaults(deck.id,API_URL);
  savePresentation(deck);
  if (!texts) {
    void extraction.then(result => { if (result && !signal.aborted) saveSlideText(deck.id, result); }).catch(() => {});
  }
  onProgress({ stage: 'ready', pages: pages.length, textOffline: !texts,
    imageOnlySlides: !!texts && slides.some(slide => !slide.text.trim()) });
  return deck;
}

/** Undo an import that was cancelled or rejected: remove the app's PDF copy and its page images. */
export async function discardImport(pdf: LocalPdf) {
  cancelPresentationDefaults(pdf.id,API_URL);
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
    saveSlideText(id, texts);
  } catch { /* Still offline. */ }
}

function saveSlideText(id: string, texts: string[]) {
  const latest = deckById(id);
  if (!latest || latest.text !== 'pending' || latest.pageCount !== texts.length) return;
  const slides = texts.map((t, i) => parseSlideText(t, i));
  savePresentation({ ...latest, slides, text: texts.some(t => t.trim()) ? 'ready' : 'none', targets: slideTargets(slides.map(s => s.text), latest.target) });
}
