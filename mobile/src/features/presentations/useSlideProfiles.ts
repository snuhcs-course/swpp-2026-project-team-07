// OpenAI Codex reliability fixes: docs/ai-collaboration-prompts-iteration-2.md#cue-and-feedback-reliability-october-16-2026
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { API_URL } from '../../services/api';
import { readStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { canonicalUuid } from '../feedback/validation';
import { createProfileClient, readProfiles, type ProfileState } from './slideProfiles';

const active = new Set(['queued', 'preparing', 'submitted', 'normalizing', 'waiting_quota']);
export function useSlideProfiles(localId: string, pages: number, visible = true) {
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
  useLayoutEffect(() => { selected.current = deck; }, [deck]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const value = snapshot.deck === deck ? snapshot.value : deck ? readProfiles(api, deck, pages) : null;
  const error = failure.deck === deck ? failure.message : '';
  useFocusEffect(useCallback(() => {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const stop = () => { controller?.abort(); if (timer) clearTimeout(timer); };
    const start = () => {
      stop();
      if (!visible || !deck || AppState.currentState !== 'active') return;
      const current = new AbortController(); controller = current;
      const read = async () => {
        try {
          const next = await createProfileClient(api).read(deck, pages, current.signal);
          if (current.signal.aborted) return;
          failures = 0;
          setFailure({ deck, message: '' });
          setSnapshot({ deck, value: next });
          if (active.has(next.state)) timer = setTimeout(() => { void read(); }, 2500);
        } catch {
          if (current.signal.aborted) return;
          setFailure({ deck, message: 'Connection interrupted. Saved cues are retained. Reconnecting…' });
          const delay = [2500, 5000, 10000, 30000][Math.min(failures++, 3)];
          timer = setTimeout(() => { void read(); }, delay);
        }
      };
      void read();
    };
    start();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') start(); else stop(); });
    return () => { stop(); sub.remove(); };
  // Manual refresh deliberately restarts the focus lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, deck, pages, refresh, visible]));
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
