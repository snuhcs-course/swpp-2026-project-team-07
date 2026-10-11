import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DeckDetail } from '../../contracts';
import { readDeck, saveDeck } from './reviewStorage';
import { transcriptionClientFor } from './service';
export function useReviewDeck(api: string, id: string | null, pages?: number) {
  const [state, setState] = useState<{ identity: string; deck: DeckDetail | null; notice: string }>({ identity: '', deck: null, notice: '' });
  const identity = `${api}:${id}`;
  const request = useRef<{ identity: string; pages?: number; refresh: () => void } | null>(null);
  const refresh = useCallback(() => {
    if (request.current?.identity === identity && request.current.pages === pages) request.current.refresh();
  }, [identity, pages]);
  useFocusEffect(useCallback(() => {
    let active = true;
    let controller: AbortController | null = null;
    const refresh = () => {
      if (!active || AppState.currentState !== 'active') return;
      controller?.abort(); controller = new AbortController();
      const request = controller;
      if (!id) { setState({ identity, deck: null, notice: '' }); return; }
      let cached: DeckDetail | null = null;
      try { cached = readDeck(api, id); } catch { /* Online refresh can recover a failed cache read. */ }
      if (cached && pages && cached.page_count !== pages) cached = null;
      setState({ identity, deck: cached, notice: '' });
      void transcriptionClientFor(api).getDeck(id, { signal: request.signal }).then(deck => {
        if (!active || request.signal.aborted) return;
        if (pages && deck.page_count !== pages) throw new Error('Presentation page count mismatch.');
        saveDeck(api, deck); setState({ identity, deck, notice: '' });
      }).catch(() => {
        if (active && !request.signal.aborted) setState({ identity, deck: cached, notice: 'Presentation metadata may be stale. Cached slides and audio are retained.' });
      });
    };
    request.current = { identity, pages, refresh };
    if (AppState.currentState === 'active') refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); else controller?.abort(); });
    return () => { active = false; request.current = null; controller?.abort(); listener.remove(); };
  }, [api, id, identity, pages]));
  return { ...(state.identity === identity ? state : { deck: null, notice: '' }), refresh };
}
