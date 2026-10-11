import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DeckDetail, ReviewAttempt } from '../../contracts';
import type { SavedAttempt } from '../recording/storage';
import { existingLocalFile, reviewMedia, type MediaSpec, type Validator } from './reviewMedia';
import { useMediaValidators } from './nativeMediaValidation';

type MediaState = { uri: string | null; busy: boolean; error: string; session: AbortController | null };
const noPdfs: readonly string[] = [];
function useMediaPart(originals: readonly (string | undefined)[], spec: MediaSpec | null, localSpec: MediaSpec, validate: Validator) {
  const [state, setState] = useState<MediaState>({ uri: null, busy: false, error: '', session: null });
  const session = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const resolved = useRef<{ originals: readonly (string | undefined)[]; spec: MediaSpec | null; localSpec: MediaSpec; uri: string } | null>(null);
  const kind = localSpec.kind;
  useFocusEffect(useCallback(() => {
    let focused = true;
    const start = () => {
      session.current?.abort(); locked.current = false;
      const controller = new AbortController(); session.current = controller;
      const current = () => focused && session.current === controller && !controller.signal.aborted;
      async function resolve() {
        const previous = resolved.current;
        // Recheck files on return without replacing an unchanged, already validated player/PDF.
        const retained = previous?.originals === originals && previous?.spec === spec && previous?.localSpec === localSpec
          ? existingLocalFile(previous.uri) : null;
        setState({ uri: retained, busy: true, error: '', session: controller });
        let error = '';
        const candidates = new Map<string, MediaSpec>();
        for (const original of originals) {
          const uri = existingLocalFile(original);
          if (uri && !candidates.has(uri)) candidates.set(uri, localSpec);
        }
        try { const cached = spec && reviewMedia.cached(spec); if (cached && !candidates.has(cached.uri)) candidates.set(cached.uri, spec!); }
        catch { error = 'Could not read the offline media cache.'; }
        for (const [uri, candidateSpec] of candidates) {
          try {
            await validate(uri, candidateSpec, controller.signal);
            if (current()) {
              resolved.current = { originals, spec, localSpec, uri };
              setState({ uri, busy: false, error: '', session: controller });
            }
            return;
          } catch { error = `The saved ${kind === 'audio' ? 'audio' : 'PDF'} could not be opened. Its original file is retained.`; }
          if (!current()) return;
        }
        if (current()) {
          resolved.current = null;
          setState({ uri: null, busy: false, error: error || `No usable ${kind === 'audio' ? 'audio' : 'PDF'} on this device.`, session: controller });
        }
      }
      void resolve();
    };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', app => {
      if (app === 'active' && focused) start();
      else { session.current?.abort(); locked.current = false; setState(s => ({ ...s, busy: false })); }
    });
    return () => { focused = false; session.current?.abort(); locked.current = false; subscription.remove(); };
  }, [spec, originals, localSpec, kind, validate]));
  async function download() {
    const controller = session.current;
    if (!spec || !controller || controller.signal.aborted || locked.current) return;
    locked.current = true; setState(s => ({ ...s, busy: true, error: '' }));
    const current = () => session.current === controller && !controller.signal.aborted;
    try {
      const record = await reviewMedia.download(spec, validate, controller.signal, true);
      if (current()) {
        resolved.current = { originals, spec, localSpec, uri: record.uri };
        setState({ uri: record.uri, busy: false, error: '', session: controller });
      }
    } catch (cause) {
      if (current()) setState(s => ({ ...s, busy: false, error: cause instanceof Error ? cause.message : 'Download failed. Existing files are retained.' }));
    } finally { if (current()) locked.current = false; }
  }
  const failed = useCallback(() => {
    // Native renderers can report errors after detachment or backgrounding.
    // A callback only owns the source and focus session that rendered it.
    if (!state.uri || !state.session || state.session !== session.current || state.session.signal.aborted ||
      resolved.current?.uri !== state.uri) return;
    resolved.current = null;
    setState(s => s.uri === state.uri && s.session === state.session
      ? { ...s, uri: null, error: `The ${kind === 'audio' ? 'audio' : 'PDF'} could not be opened. Refresh and download it again.` } : s);
  }, [kind, state.uri, state.session]);
  return { ...state, download, failed };
}

export function useReviewMedia(api: string, id: string, saved: SavedAttempt | null, review: ReviewAttempt | null, deck: DeckDetail | null, knownPdfs: readonly string[] = noPdfs) {
  const { validate, validators } = useMediaValidators();
  const audioUrl = review?.audio_url, audioDuration = review?.duration_ms;
  const pdfUrl = deck?.pdf_url, deckId = deck?.id, pageCount = deck?.page_count;
  const audioSpec = useMemo<MediaSpec | null>(() => audioUrl && audioDuration ?
    { api, id, kind: 'audio', url: audioUrl, durationMs: audioDuration } : null, [api, id, audioUrl, audioDuration]);
  const pdfSpec = useMemo<MediaSpec | null>(() => pdfUrl && deckId ?
    { api, id: deckId, kind: 'pdf', url: pdfUrl, pageCount } : null, [api, deckId, pdfUrl, pageCount]);
  const duration = saved && !['capturing', 'interrupted'].includes(saved.state) ? saved.recording.duration_ms || undefined : undefined;
  const pages = saved?.page_count || deck?.page_count;
  const localAudioSpec = useMemo<MediaSpec>(() => ({ api, id, kind: 'audio', url: '', durationMs: duration }), [api, id, duration]);
  const localPdfSpec = useMemo<MediaSpec>(() => ({ api, id, kind: 'pdf', url: '', pageCount: pages }), [api, id, pages]);
  // Independent lifetimes: learning PDF metadata must never cancel an audio download/seek.
  const audioOriginals = useMemo(() => [saved?.recording.audio_uri], [saved?.recording.audio_uri]);
  const pdfOriginals = useMemo(() => [saved?.pdf_uri, ...knownPdfs], [saved?.pdf_uri, knownPdfs]);
  const audio = useMediaPart(audioOriginals, audioSpec, localAudioSpec, validate);
  const pdf = useMediaPart(pdfOriginals, pdfSpec, localPdfSpec, validate);
  return { audio, pdf, audioSpec, pdfSpec, validators, download: (kind: 'audio' | 'pdf') => kind === 'audio' ? audio.download() : pdf.download(),
    audioFailed: audio.failed, pdfFailed: pdf.failed };
}
