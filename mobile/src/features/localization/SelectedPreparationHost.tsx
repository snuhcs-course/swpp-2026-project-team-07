import { useEffect, useLayoutEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { getAppLanguage } from '../../design/language';
import { API_URL } from '../../services/apiConfig';
import { backendFetch } from '../../services/backendFetch';
import { readStored, subscribeStored } from '../../services/storage';
import { runAttemptIds } from '../../domain/run';
import { deckById, getDeckState } from '../presentations/store';
import { deckModel } from '../presentations/useDeckModel';
import { normalizeApi } from '../transcription/analysisStorage';
import { createPreparedTranslations } from './preparedTranslations';
import { selectedProse } from './selectedProse';
import { displayTranslations } from './useDisplayTranslation';

const sourceRecord = /^(?:deck|pres|qa|qa-index|qa-state|feedback|feedback-run|slide-profiles|server-deck|capture-outbox|review|transcript-corrections|presentation-requirements|slide-review|score):/;
export function SelectedPreparationHost({ deckId }: { deckId: string | null }) {
  const api = normalizeApi(API_URL);
  const queue = useMemo(() => createPreparedTranslations({ api, cache: displayTranslations, fetch: backendFetch, language: getAppLanguage }), [api]);
  useLayoutEffect(() => {
    displayTranslations.setPreparationOwner(queue.retain);
    return () => { displayTranslations.setPreparationOwner(undefined); queue.stop(); };
  }, [queue]);
  useEffect(() => {
    let foreground = AppState.currentState === 'active', timer: ReturnType<typeof setTimeout> | undefined;
    const keys = new Set<string>(deckId ? [deckId, encodeURIComponent(deckId)] : []);
    function scan() {
      timer = undefined;
      const deck = deckById(deckId);
      if (!deck || !foreground) return;
      try {
        const state = getDeckState(deck.id), mapped = readStored<string>('server-deck:' + api + ':' + deck.id);
        keys.clear(); keys.add(deck.id); keys.add(encodeURIComponent(deck.id));
        if (mapped) keys.add(mapped);
        for (const id of runAttemptIds(state.run)) keys.add(id);
        queue.select(selectedProse(deckModel(deck, state), api));
      } catch { /* Keep the last verified snapshot until a complete record is saved. */ }
    }
    function refresh() {
      // Debounce carousel spin and a burst of related writes from a single result.
      if (timer !== undefined) clearTimeout(timer);
      if (deckId && foreground) timer = setTimeout(scan, 150);
    }
    queue.select([]);
    if (foreground) { queue.wake(); refresh(); } else queue.pause();
    const stored = subscribeStored(key => {
      if (sourceRecord.test(key) && [...keys].some(id => key.includes(id))) refresh();
    });
    const listener = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (foreground) { queue.wake(); refresh(); } else queue.pause();
    });
    return () => { if (timer !== undefined) clearTimeout(timer); stored(); listener.remove(); };
  }, [deckId, queue, api]);
  return null;
}
