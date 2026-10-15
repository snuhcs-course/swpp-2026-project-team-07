import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../../services/api';
import { readStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { canonicalUuid } from '../feedback/validation';
import { createProfileClient, readProfiles, type ProfileState } from './slideProfiles';

const active = new Set(['queued', 'preparing', 'submitted', 'normalizing', 'waiting_quota']);
export function useSlideProfiles(localId: string, pages: number) {
  const api = normalizeApi(API_URL);
  const mapped = readStored<string>(`server-deck:${api}:${localId}`);
  const deck = canonicalUuid(mapped) ? mapped : null;
  const [snapshot, setSnapshot] = useState<{ deck: string | null; value: ProfileState | null }>({ deck, value: deck ? readProfiles(api, deck, pages) : null });
  const [refresh, setRefresh] = useState(0);
  const [failure, setFailure] = useState({ deck, message: '' });
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const selected = useRef(deck);
  useEffect(() => { selected.current = deck; }, [deck]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const value = snapshot.deck === deck ? snapshot.value : deck ? readProfiles(api, deck, pages) : null;
  const error = failure.deck === deck ? failure.message : '';
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      if (!deck) return;
      try {
        const next = await createProfileClient(api).read(deck, pages, controller.signal);
        if (controller.signal.aborted) return;
        setFailure({ deck, message: '' });
        setSnapshot({ deck, value: next });
        if (active.has(next.state)) timer = setTimeout(() => { void read(); }, 2500);
      } catch {
        if (!controller.signal.aborted) setFailure({ deck, message: 'Could not refresh AI cues. Saved cues are retained.' });
      }
    };
    void read();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [api, deck, pages, refresh]);
  const recover = useCallback(async (acknowledge = false, expected = value) => {
    if (!deck || locked.current) return;
    if (expected?.description_set_id !== value?.description_set_id || expected?.processing_revision !== value?.processing_revision) {
      setRefresh(r => r + 1); return;
    }
    locked.current = true;
    setBusy(true); setFailure({ deck, message: '' });
    try {
      const client = createProfileClient(api);
      const next = value && !value.stale && value.retry_available ? await client.retry(value, pages, acknowledge) : await client.generate(deck, pages);
      if (mounted.current && selected.current === deck) { setSnapshot({ deck, value: next }); setRefresh(r => r + 1); }
    } catch { if (mounted.current && selected.current === deck) setFailure({ deck, message: 'AI cue request failed. Tap to refresh before retrying.' }); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }, [api, deck, pages, value]);
  return { value, error, busy, recover, refresh: () => setRefresh(r => r + 1) };
}
