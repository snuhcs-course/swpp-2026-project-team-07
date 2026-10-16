// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex time/audience setup: docs/ai-collaboration-prompts-iteration-2.md#presentation-time-and-audience-setup-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OpenAI Codex follow-up: docs/ai-collaboration-prompts-iteration-2.md#rehearsal-recording-choice-and-transcript-playback-october-14-2026
// OutLoud redesign: presentations shown on Home, and each one's merged run.
// PDFs, recordings, uploads and analysis results stay in the existing stores
// (pdf catalog, saved attempts, analysis/review caches). This store only adds the
// presentation look (order, hue, icon), rendered pages, slide text, targets, the run
// composition and transcript corrections, all in the existing SQLite key/value table.
import { useSyncExternalStore } from 'react';
import { readStored, removeStored, writeStored } from '../../services/storage';
import { getImportedPdfs, type LocalPdf } from '../pdf/service';
import { isHue, isIcon, pickHue, type HueName, type IconId } from '../../domain/hues';
import type { CompareSpec, Run } from '../../domain/run';
import type { LineEdit } from '../../domain/lines';
import { defaultTarget, slideTargets, type SlideText } from '../../domain/slides';

export type PageImage = { uri: string; w: number; h: number };
export type Presentation = {
  id: string; title: string; uri: string; order: number; hue: HueName; icon: IconId;
  pageCount: number; pages: PageImage[]; slides: SlideText[];
  /** ready: slide text from the server; pending: not fetched yet (offline); none: the PDF has no text layer. */
  text: 'ready' | 'pending' | 'none';
  target: number; targets: number[]; audience?: string; createdAt: string;
};
export type DeckState = {
  run: Run | null;
  /** Total of the most recent full run (seconds), for "faster/slower than last full run". */
  lastFullTotal: number | null;
  /** Coverage of the run the current one replaced, for the Home delta chip. */
  baselineCoverage: number | null;
  fixes: number;
  edits: Record<string, LineEdit>;
  takes: number;
  /** A take waiting on Compare (survives leaving the app), with what "Keep old" restores. */
  compare: (CompareSpec & { restore: { lastFullTotal: number | null; baselineCoverage: number | null }; nextBaselineCoverage?: number | null }) | null;
  /** Attempts recorded for this presentation that are not part of the current run. */
  discarded: string[];
};
export const emptyDeckState = (): DeckState => ({ run: null, lastFullTotal: null, baselineCoverage: null, fixes: 0, edits: {}, takes: 0, compare: null, discarded: [] });

const PRES = (id: string) => `pres:v1:${id}`;
const DECK = (id: string) => `deck:v1:${id}`;
const HIDDEN = 'pres-hidden:v1';

type Snapshot = { version: number; loaded: boolean; decks: Presentation[]; hidden: string[]; error: string };
let snapshot: Snapshot = { version: 0, loaded: false, decks: [], hidden: [], error: '' };
const listeners = new Set<() => void>();
const deckStates = new Map<string, DeckState>();

function emit(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch, version: snapshot.version + 1 };
  listeners.forEach(l => l());
}
export function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getSnapshot() { return snapshot; }
/** Re-render readers after analysis results or media changed underneath (no store data changed). */
export function bump() { emit({}); }
export function useStore<T>(select: (s: Snapshot) => T): T {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  return select(snap);
}

function sanitize(value: unknown, pdf: LocalPdf, fallbackOrder: number, usedHues: HueName[]): Presentation {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Presentation>;
  const slides = Array.isArray(v.slides) ? v.slides.filter(x => x && typeof x.title === 'string' && Array.isArray(x.points)) : [];
  const pageCount = Number.isInteger(v.pageCount) && v.pageCount! > 0 ? v.pageCount! : 0;
  const target = Number.isFinite(v.target) && v.target! > 0 ? v.target! : defaultTarget(pageCount || 1);
  const targets = Array.isArray(v.targets) && v.targets.length === pageCount ? v.targets : slideTargets(slides.map(x => x.text), target);
  return {
    id: pdf.id, title: pdf.title, uri: pdf.uri,
    order: Number.isInteger(v.order) ? v.order! : fallbackOrder,
    hue: isHue(v.hue) ? v.hue : pickHue(usedHues),
    icon: isIcon(v.icon) ? v.icon : 'present',
    pageCount, pages: Array.isArray(v.pages) ? v.pages.filter(p => p && typeof p.uri === 'string') : [], slides,
    text: v.text === 'ready' || v.text === 'none' ? v.text : 'pending',
    target, targets, audience: typeof v.audience === 'string' ? v.audience.slice(0, 500) : '',
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date(0).toISOString(),
  };
}

/** Read the PDF catalog and each presentation's look. PDFs imported before the redesign get a look now. */
export async function loadPresentations() {
  try {
    const pdfs = await getImportedPdfs();
    const hidden = readStored<string[]>(HIDDEN) ?? [];
    // The catalog is newest first; upload order is oldest first.
    const oldestFirst = pdfs.slice().reverse();
    const decks: Presentation[] = [];
    oldestFirst.forEach((pdf, i) => {
      const stored = readStored<unknown>(PRES(pdf.id));
      const deck = sanitize(stored, pdf, i + 1, decks.map(d => d.hue));
      if (!stored) writeStored(PRES(pdf.id), deck);
      decks.push(deck);
    });
    decks.sort((a, b) => a.order - b.order);
    emit({ loaded: true, decks, hidden: hidden.filter(id => decks.some(d => d.id === id)), error: '' });
  } catch (error) {
    emit({ loaded: true, error: error instanceof Error ? error.message : 'Could not read your presentations.' });
  }
}

export const visibleDecks = (s: Snapshot = snapshot) => s.decks.filter(d => !s.hidden.includes(d.id));
export function deckById(id: string | null | undefined): Presentation | null { return snapshot.decks.find(d => d.id === id) ?? null; }
export function nextOrder() { return snapshot.decks.reduce((m, d) => Math.max(m, d.order), 0) + 1; }
export function nextHue() { return pickHue(visibleDecks().map(d => d.hue)); }

export function savePresentation(deck: Presentation) {
  writeStored(PRES(deck.id), deck);
  const exists = snapshot.decks.some(d => d.id === deck.id);
  const decks = (exists ? snapshot.decks.map(d => (d.id === deck.id ? deck : d)) : [...snapshot.decks, deck]).sort((a, b) => a.order - b.order);
  emit({ decks });
}
export function setIcon(id: string, icon: IconId) {
  const deck = deckById(id);
  if (deck) savePresentation({ ...deck, icon });
}
export function setHidden(id: string, hidden: boolean) {
  const next = hidden ? [...new Set([...snapshot.hidden, id])] : snapshot.hidden.filter(x => x !== id);
  writeStored(HIDDEN, next);
  emit({ hidden: next });
}
/** Forget a presentation completely (used when an import is cancelled or rejected). */
export function forgetPresentation(id: string) {
  removeStored(PRES(id)); removeStored(DECK(id)); deckStates.delete(id);
  emit({ decks: snapshot.decks.filter(d => d.id !== id), hidden: snapshot.hidden.filter(x => x !== id) });
}

export function getDeckState(id: string): DeckState {
  const cached = deckStates.get(id);
  if (cached) return cached;
  const stored = readStored<Partial<DeckState>>(DECK(id));
  const state = { ...emptyDeckState(), ...(stored && typeof stored === 'object' ? stored : {}) };
  deckStates.set(id, state);
  return state;
}
export function saveDeckState(id: string, state: DeckState) {
  writeStored(DECK(id), state);
  deckStates.set(id, state);
  emit({});
}
export function updateDeckState(id: string, patch: (s: DeckState) => DeckState) {
  saveDeckState(id, patch(getDeckState(id)));
}
