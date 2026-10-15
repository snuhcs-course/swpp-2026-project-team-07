import {verifiedExcerpt} from '../feedback/evidence';
// Iteration 2 Phase 2: cached profiles; GET/playback never admits provider work.
import type { DescriptionState, SlideDescription, DescriptionGenerateRequest } from '../../contracts';
import { parseDescriptionState, canonicalUuid } from '../feedback/validation';
import { preferDescriptions } from '../feedback/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { readStored, writeStored } from '../../services/storage';

export type SlideCue = { text: string; evidence_refs: string[] };
export type Enrichment = { text: string; kind: 'connection' | 'question'; information_needed: string;
  evidence_refs: { slide_index: number; source_id: string; fact_ref: string; quote: string }[] };
export type CueCategory = 'must_cover' | 'go_deeper';
export type SlideProfile = SlideDescription & { slide_kind: 'title' | 'content' | 'closing' | 'unknown';
  cues: SlideCue[]; must_cover: SlideCue[]; go_deeper: Enrichment[] };
export type ProfileState = Omit<DescriptionState, 'descriptions'> & { descriptions: { slides: SlideProfile[] } | null };
const schemas = { openai: 'slide-profile', gemini: 'slide-profile-gemini' };
// Same explicit Unicode-whitespace union as backend cue_word_count.
const cueWordSeparator = /[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/u;
const canonical = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, '');
const invalid = (): never => { throw new Error('Invalid slide profiles.'); };
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : invalid();
const text = (v: unknown): string => typeof v === 'string' && !!v.trim() && [...v].length <= 400 &&
  !/[\u0000\ud800-\udfff]/u.test(v) ? v : invalid();

export function parseProfileState(value: unknown, deckId: string, pages: number): ProfileState {
  const state = parseDescriptionState(value, deckId);
  for (const p of [state.provenance, state.selection]) {
    if (p && (!['slide-profile-v1', 'slide-profile-v2', 'slide-profile-v3', 'slide-profile-v4', 'slide-profile-v5'].includes(p.prompt_version) ||
      p.schema_version !== `${schemas[p.provider]}-${p.prompt_version.split('-').at(-1)}`)) invalid();
  }
  if (!state.descriptions) return { ...state, descriptions: null };
  if (state.descriptions.slides.length !== pages || state.edited) invalid();
  const raw = obj(obj(value).descriptions);
  if (!Array.isArray(raw.slides)) invalid();
  const rawSlides = raw.slides as unknown[];
  const historical = state.provenance?.prompt_version === 'slide-profile-v1';
  const limit = state.provenance?.prompt_version === 'slide-profile-v5'?25:state.provenance?.prompt_version==='slide-profile-v4'?15:null;
  const cueText = (v: unknown) => { const t = text(v); if (limit!==null && t.split(cueWordSeparator).filter(Boolean).length > limit) invalid(); return t; };
  const factsFor = (s: SlideDescription) => new Map([['summary', s.summary], ...s.key_ideas.map((f, j) => [`key_ideas/${j}`, f] as const),
    ...s.visual_facts.map((f, j) => [`visual_facts/${j}`, f] as const)]);
  const slides = state.descriptions.slides.map((s, i): SlideProfile => {
    const r = obj(rawSlides[i]);
    const collection = historical ? r.cues : r.must_cover;
    if (!['title', 'content', 'closing', 'unknown'].includes(r.slide_kind as string) || !Array.isArray(collection) || collection.length > (historical ? 4 : 3)) invalid();
    const facts = factsFor(s);
    const cues = (collection as unknown[]).map((v): SlideCue => {
      const cue = obj(v), refs = cue.evidence_refs;
      if (!Array.isArray(refs) || !refs.length || refs.length > 5 || new Set(refs).size !== refs.length ||
          refs.some(ref => typeof ref !== 'string' || !facts.has(ref) || facts.get(ref)!.uncertain)) invalid();
      return { text: cueText(cue.text), evidence_refs: refs as string[] };
    });
    const seen = new Set(cues.map(c => historical ? c.text : canonical(c.text)));
    if (seen.size !== cues.length || (!historical && cues.some(c => !canonical(c.text) || [...facts.values()].some(f=>canonical(f.text)===canonical(c.text))))) invalid();
    const go_deeper: Enrichment[] = historical ? [] : (() => {
      if (!Array.isArray(r.go_deeper) || r.go_deeper.length > 3) return invalid();
      return r.go_deeper.map(v => {
        const e = obj(v), t = cueText(e.text), key = canonical(t);
        if (!key || seen.has(key) || !['connection','question'].includes(e.kind as string) || typeof e.information_needed !== 'string' ||
          [...e.information_needed].length > 400 || /[\u0000\ud800-\udfff]/u.test(e.information_needed) ||
          (e.kind === 'question') !== !!e.information_needed.trim() || !Array.isArray(e.evidence_refs) || !e.evidence_refs.length || e.evidence_refs.length > 5) invalid();
        seen.add(key);
        const refs = (e.evidence_refs as unknown[]).map(v => {
          const ref = obj(v), other = state.descriptions!.slides.find(s=>s.slide_index===ref.slide_index);
          const fact = other && factsFor(other).get(ref.fact_ref as string);
          if (!other || other.source_id !== ref.source_id || !fact || fact.uncertain || verifiedExcerpt(ref.quote as string,fact.text)===null || key === canonical(fact.text)) invalid();
          return {slide_index: ref.slide_index as number, source_id: ref.source_id as string, fact_ref: ref.fact_ref as string, quote: ref.quote as string};
        });
        if (new Set(refs.map(r=>`${r.slide_index}:${r.fact_ref}`)).size !== refs.length) invalid();
        return {text:t,kind:e.kind as Enrichment['kind'], information_needed:e.information_needed as string,evidence_refs:refs};
      });
    })();
    return { ...s, slide_kind: r.slide_kind as SlideProfile['slide_kind'], cues: historical ? cues : [], must_cover: historical ? [] : cues, go_deeper };
  });
  return { ...state, descriptions: { slides } };
}

export function cueState(state: ProfileState | null, slide: number, category: CueCategory = 'must_cover'): { cues: (SlideCue | Enrichment)[]; message: string | null; action: 'generate' | 'retry' | 'confirm' | null } {
  if (!state) return { cues: [], message: 'AI cues are unavailable offline', action: null };
  if (state.stale) return { cues: [], message: 'AI cues are out of date', action: 'generate' };
  const ready = state.state === 'completed' && state.descriptions?.slides.find(s => s.slide_index === slide);
  if (ready && state.provenance?.prompt_version === 'slide-profile-v1') return {cues:[],message:'Saved cues use the previous format · Generate updated guidance',action:'generate'};
  if (ready && !['slide-profile-v4','slide-profile-v5'].includes(state.provenance?.prompt_version??'')) return {cues:[],message:'AI cues are out of date',action:'generate'};
  if (ready) return { cues: ready[category], message: ready[category].length ? null :
    ready.summary.uncertain ? 'Not enough readable evidence for cues' : category === 'must_cover' ? 'No essential points needed on this slide' : 'No additional suggestions for this slide', action: null };
  const messages: Partial<Record<ProfileState['state'], string>> = {
    absent: 'AI cues have not been generated', disabled: 'AI cues are disabled on the server',
    configuration_unavailable: 'AI cues are unavailable on the server', source_unavailable: 'Slide evidence is unavailable',
    failed: 'AI cues failed', needs_confirmation: 'AI cue retry needs confirmation',
  };
  return { cues: [], message: messages[state.state] ?? 'Preparing AI cues…', action: state.state === 'absent' ? 'generate' :
    state.retry_available ? state.requires_confirmation ? 'confirm' : 'retry' : null };
}

const key = (api: string, deck: string) => `slide-profiles:v1:${encodeURIComponent(normalizeApi(api))}:${deck}`;
const latest = new Map<string, symbol>();
export function readProfiles(api: string, deck: string, pages: number): ProfileState | null {
  try { return parseProfileState(readStored(key(api, deck)), deck, pages); } catch { return null; }
}
export function createProfileClient(apiUrl: string, fetcher: typeof fetch = fetch) {
  const api = normalizeApi(apiUrl);
  async function request(deck: string, pages: number, payload?: DescriptionGenerateRequest, signal?: AbortSignal) {
    if (!canonicalUuid(deck) || !Number.isSafeInteger(pages) || pages < 1) invalid();
    const cacheKey = key(api, deck), ticket = Symbol();
    latest.set(cacheKey, ticket);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 60_000);
    try {
      const response = await fetcher(`${api}/decks/${deck}/profiles/${payload ? 'generate/' : ''}`, {
        method: payload ? 'POST' : 'GET', signal: controller.signal,
        ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
      });
      if (!response.ok) throw new Error(`AI cues request failed (HTTP ${response.status}).`);
      const next = parseProfileState(await response.json(), deck, pages);
      if (controller.signal.aborted) throw new Error('AI cues request cancelled.');
      const previous = readProfiles(api, deck, pages);
      if (latest.get(cacheKey) !== ticket) return previous ?? next;
      // A temporary server/source configuration outage has no replacement set.
      // Surface its live state, but preserve the last complete offline snapshot.
      if (previous?.descriptions && !next.description_set_id && !next.descriptions) {
        const invalidated = next.state === 'absent' || next.state === 'source_unavailable' ||
          (next.selection && previous.provenance &&
            (['provider','project_id','model','prompt_version','schema_version'] as const)
              .some(k => next.selection![k] !== previous.provenance![k]));
        if (invalidated) writeStored(cacheKey, { ...previous, stale: true });
        return next;
      }
      const chosen = preferDescriptions(previous, next) === previous ? previous! : next;
      writeStored(cacheKey, chosen);
      return chosen;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  return {
    read: (deck: string, pages: number, signal?: AbortSignal) => request(deck, pages, undefined, signal),
    generate: (deck: string, pages: number, signal?: AbortSignal) => request(deck, pages, {}, signal),
    retry: (state: ProfileState, pages: number, acknowledge = false, signal?: AbortSignal) => {
      if (!state.description_set_id || !state.retry_available || (state.requires_confirmation && !acknowledge)) invalid();
      return request(state.deck_id, pages, { description_set_id: state.description_set_id!,
        processing_revision: state.processing_revision, ...(acknowledge ? { acknowledge_uncertain: true } : {}) }, signal);
    },
  };
}
