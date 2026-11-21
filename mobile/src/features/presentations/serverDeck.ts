// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration/prompt-logs/jaewon/iteration-2.md#record-043
// OutLoud redesign: upload the PDF once at import to read its slide text.
// Uses the existing deck API (POST /decks/, GET /decks/{id}/) and the same local
// mapping key as features/recording/upload.ts, so later attempt uploads reuse this deck.
import { File } from 'expo-file-system';
import { backendExpoFetch as fetch } from '../../services/backendFetch';
import { API_URL } from '../../services/api';
import { readStored, removeStored, writeStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ServerSlides = { deckId: string; texts: string[] };
const uncertainKey = (api: string, localId: string) => `server-deck-unconfirmed:${api}:${localId}`;
// OpenAI Codex, 2026-11-21: a lost PDF upload response must survive import → preview and app restarts.
export function serverPdfUnconfirmed(localId: string, apiUrl = API_URL) {
  return readStored<boolean>(uncertainKey(normalizeApi(apiUrl), localId)) === true;
}

function parse(value: unknown, pageCount: number, expectedId?: string): ServerSlides {
  const v = value as { id?: unknown; page_count?: unknown; slides?: unknown } | null;
  if (!v || typeof v.id !== 'string' || !uuid.test(v.id) || v.page_count !== pageCount ||
      (expectedId && v.id.toLowerCase() !== expectedId.toLowerCase()) || !Array.isArray(v.slides)) {
    throw new Error('The server returned a different presentation. Slide text is unavailable.');
  }
  const texts = Array.from({ length: pageCount }, () => '');
  for (const slide of v.slides as { slide_index?: unknown; extracted_text?: unknown }[]) {
    if (slide && Number.isInteger(slide.slide_index) && (slide.slide_index as number) < pageCount && typeof slide.extracted_text === 'string') {
      texts[slide.slide_index as number] = slide.extracted_text.slice(0, 5000);
    }
  }
  return { deckId: v.id.toLowerCase(), texts };
}

/** Find or create the server copy of a local PDF and return its extracted slide text. */
export async function serverSlides(local: { id: string; title: string; uri: string; pageCount: number }, apiUrl = API_URL,
  signal?: AbortSignal, timeoutMs = 300_000, retryUnconfirmed = false): Promise<ServerSlides> {
  const api = normalizeApi(apiUrl);
  const key = `server-deck:${api}:${local.id}`;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  try { return await request(api, key, local, controller.signal, retryUnconfirmed); }
  catch (cause) {
    if (timedOut && !signal?.aborted) throw new Error('The server did not confirm the PDF request before the time limit.');
    throw cause;
  }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

async function request(api: string, key: string, local: { id: string; title: string; uri: string; pageCount: number },
  combined: AbortSignal, retryUnconfirmed: boolean) {
  const uncertain = uncertainKey(api, local.id);
  const cached = readStored<string>(key);
  if (typeof cached === 'string' && uuid.test(cached)) {
    const response = await fetch(`${api}/decks/${cached}/`, { signal: combined });
    if (response.ok) { const parsed = parse(await response.json(), local.pageCount, cached); removeStored(uncertain); return parsed; }
    // Only a confirmed missing deck permits a new upload (same rule as attempt uploads).
    if (response.status !== 404) throw new Error(`Could not check the saved presentation (HTTP ${response.status}).`);
  }
  if (readStored<boolean>(uncertain) === true && !retryUnconfirmed)
    throw new Error('The server did not confirm the PDF request. Tap Refresh with server before another upload.');
  if (combined.aborted) throw new Error('PDF request cancelled.');
  const body = new FormData();
  body.append('file', new File(local.uri), 'slides.pdf');
  body.append('title', local.title.slice(0, 255) || 'Presentation');
  // OpenAI Codex, 2026-11-21: mark before transport starts so a simultaneous preview cannot POST the same uncertain PDF.
  writeStored(uncertain, true);
  const response = await fetch(`${api}/decks/`, { method: 'POST', body, signal: combined });
  if (!response.ok) { removeStored(uncertain); throw new Error(`The server could not read this PDF (HTTP ${response.status}). Check the 50 MiB file limit.`); }
  try {
    const data = (await response.json()) as { deck?: { id?: unknown; page_count?: unknown }; slides?: unknown };
    const parsed = parse({ ...data.deck, slides: data.slides }, local.pageCount);
    writeStored(key, parsed.deckId);
    removeStored(uncertain);
    return parsed;
  } catch (cause) { writeStored(uncertain, true); throw cause; }
}
