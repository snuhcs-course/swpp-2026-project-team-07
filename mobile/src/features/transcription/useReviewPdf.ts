import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getImportedPdfs } from '../pdf/service';
import { savedAttempts } from '../recording/storage';
import { serverDeckId } from '../recording/upload';
import { normalizeApi } from './analysisStorage';
const noPdfs: readonly string[] = [];
/** Collect candidates; useReviewMedia checks existence and native validity in order. */
export function useReviewPdf(api: string, deckId: string | null): readonly string[] {
  const [state, setState] = useState<{ identity: string; uris: readonly string[] }>({ identity: '', uris: noPdfs });
  const identity = `${api}:${deckId}`;
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!deckId) { setState({ identity, uris: noPdfs }); return; }
    void (async () => {
      let local: string[] = [];
      try {
        local = savedAttempts().filter(a => serverDeckId(a.local_deck_id, api) === deckId ||
          (normalizeApi(a.server_url || '') === normalizeApi(api) && a.recording.deck_id === deckId)).map(a => a.pdf_uri);
      } catch { /* An unavailable capture catalog must not hide imported copies. */ }
      let imported: string[] = [];
      try {
        imported = (await getImportedPdfs()).filter(p => serverDeckId(p.id, api) === deckId).map(p => p.uri);
      } catch { /* An unavailable import catalog must not hide capture copies. */ }
      const uris = [...new Set([...imported, ...local])];
      // Keep candidate identity stable on return so validated media stays attached.
      if (active) setState(previous => previous.identity === identity && previous.uris.length === uris.length &&
        previous.uris.every((uri, index) => uri === uris[index]) ? previous : { identity, uris });
    })();
    return () => { active = false; };
  }, [api, deckId, identity]));
  return state.identity === identity ? state.uris : noPdfs;
}
