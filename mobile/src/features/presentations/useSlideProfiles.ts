// OpenAI Codex reliability fixes: docs/ai-collaboration/prompt-logs/unattributed/iteration-2.md#record-138
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { API_URL } from '../../services/api';
import { backendFetch, demoAccess } from '../../services/backendFetch';
import { readStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { canonicalUuid } from '../feedback/validation';
import { createProfileClient, readProfiles, type ProfileState } from './slideProfiles';
import { serverPdfUnconfirmed } from './serverDeck';
import { STORE_MODE } from '../../services/apiConfig';
import { StorePreflightError } from '../../services/storeAccess';

const active = new Set(['queued', 'preparing', 'submitted', 'normalizing', 'waiting_quota']);
type LocalSource = { id: string; title: string; uri: string; pageCount: number };
export function useSlideProfiles(localId: string, pages: number, visible = true, source?: LocalSource) {
  const api = normalizeApi(API_URL);
  const sourceMatches = source?.id === localId && source.pageCount === pages && !!source.uri;
  const sourceTitle = sourceMatches ? source.title : null;
  const sourceUri = sourceMatches ? source.uri : null;
  const mapped = readStored<string>(`server-deck:${api}:${localId}`);
  const deck = canonicalUuid(mapped) ? mapped : null;
  const [snapshot, setSnapshot] = useState<{ deck: string | null; value: ProfileState | null }>({ deck, value: deck ? readProfiles(api, deck, pages) : null });
  const [refresh, setRefresh] = useState(0);
  const [failure, setFailure] = useState({ deck, message: '' });
  const [busy, setBusy] = useState(false);
  // OpenAI Codex, 2026-11-21: expose a read/link in flight so the preview refresh cannot interrupt an ambiguous PDF upload.
  const [syncing, setSyncing] = useState(false);
  const locked = useRef(false);
  const manualLinkRetry = useRef(false);
  const requestInFlight = useRef(false);
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
    const stop = () => { controller?.abort(); requestInFlight.current = false; if (timer) clearTimeout(timer); if (mounted.current) setSyncing(false); };
    const start = () => {
      stop();
      if (!visible || AppState.currentState !== 'active' || (!deck && !sourceUri)) return;
      if (!deck && serverPdfUnconfirmed(localId, api) && !manualLinkRetry.current) {
        setFailure({ deck: null, message: 'Server did not confirm this PDF. Tap Refresh with server to try again.' });
        return;
      }
      const current = new AbortController(); controller = current;
      const read = async () => {
        requestInFlight.current = true;
        setSyncing(true);
        try {
          if (!deck) {
            // A locally ready PDF (including the bundled demo) may never have
            // needed text extraction, so link it before reading server cues.
            const readyController = new AbortController();
            const abortReady = () => readyController.abort();
            current.signal.addEventListener('abort', abortReady, { once: true });
            const readyTimer = setTimeout(abortReady, 15_000);
            let readiness: Response;
            try { readiness = await backendFetch(`${api}/ready/`, { method: 'GET', signal: readyController.signal }); }
            catch (cause) {
              if (readyController.signal.aborted && !current.signal.aborted) throw Error('Server readiness timed out.');
              throw cause;
            } finally { clearTimeout(readyTimer); current.signal.removeEventListener('abort', abortReady); }
            if (!readiness.ok) throw new Error(`Server readiness HTTP ${readiness.status}`);
            const { serverSlides } = await import('./serverDeck');
            const retryUnconfirmed = manualLinkRetry.current;
            manualLinkRetry.current = false;
            await serverSlides({ id: localId, title: sourceTitle!, uri: sourceUri!, pageCount: pages }, api, current.signal, 180_000, retryUnconfirmed);
            if (current.signal.aborted) return;
            failures = 0;
            setFailure({ deck: null, message: '' });
            setRefresh(value => value + 1);
            return;
          }
          const next = await createProfileClient(api).read(deck, pages, current.signal);
          if (current.signal.aborted) return;
          failures = 0;
          setFailure({ deck, message: '' });
          setSnapshot({ deck, value: next });
          if (active.has(next.state)) timer = setTimeout(() => { void read(); }, 2500);
        } catch (cause) {
          if (current.signal.aborted) return;
          const detail = cause instanceof Error ? cause.message : String(cause);
          const codeNeeded = /demo code|server access expired|HTTP 401/i.test(detail);
          const httpStatus = detail.match(/HTTP (\d{3})/i)?.[1];
          const unconfirmed = /did not confirm the PDF request/i.test(detail);
          const message = STORE_MODE && cause instanceof StorePreflightError ? detail
            : codeNeeded ? (STORE_MODE ? 'Online access expired. Choose online coaching on Home to start a new private workspace. Your local recordings are saved.' : 'Enter the demo code to reconnect server cues.')
            : unconfirmed ? 'Server did not confirm this PDF. Tap Refresh with server to try again.'
            : httpStatus ? `Server returned HTTP ${httpStatus}. Reconnecting…`
              : /server readiness timed out/i.test(detail) ? 'Server readiness check timed out. Reconnecting…'
              : /different presentation/i.test(detail) ? 'The server returned a different presentation. Check this PDF before retrying.'
                : /network request failed|failed to fetch|timeout|timed out/i.test(detail) ? 'Network upload failed. Reconnecting…'
                  : deck ? 'Connection interrupted. Saved cues are retained. Reconnecting…'
                    : 'Could not link this presentation to the server. Reconnecting…';
          setFailure({ deck, message });
          if (unconfirmed) return; // A timed-out upload may have completed; never replay it automatically.
          const delay = [2500, 5000, 10000, 30000][Math.min(failures++, 3)];
          timer = setTimeout(() => { void read(); }, delay);
        } finally {
          if (controller === current) requestInFlight.current = false;
          if (!current.signal.aborted && mounted.current) setSyncing(false);
        }
      };
      void read();
    };
    start();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') start(); else stop(); });
    const accessSub = demoAccess.subscribe(() => {
      if (failures && demoAccess.getSnapshot().state === 'ready') start();
    });
    return () => { stop(); sub.remove(); accessSub(); };
  // Manual refresh deliberately restarts the focus lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, deck, localId, pages, refresh, sourceTitle, sourceUri, visible]));
  const recover = useCallback(async (acknowledge = false, expected = value) => {
    if (!deck || locked.current) return;
    if (expected?.description_set_id !== value?.description_set_id || expected?.processing_revision !== value?.processing_revision ||
        expected?.selection?.token !== value?.selection?.token) {
      setRefresh(r => r + 1); return;
    }
    if (value?.requires_confirmation && (!acknowledge || !value.retry_available)) return;
    locked.current = true;
    setBusy(true); setFailure({ deck, message: '' });
    try {
      const client = createProfileClient(api);
      const next = value?.description_set_id && value.retry_available ? await client.retry(value, pages, acknowledge) : await client.generate(deck, pages);
      if (mounted.current && selected.current === deck) { setSnapshot({ deck, value: next }); setRefresh(r => r + 1); }
    } catch { if (mounted.current && selected.current === deck) setFailure({ deck, message: 'AI cue request failed. Tap to refresh before retrying.' }); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }, [api, deck, pages, value]);
  return { value, error, busy, syncing, recover, available: !!deck,
    // OpenAI Codex, 2026-11-21: every refresh entry point shares the same in-flight guard, including the cue sheet and landscape.
    refresh: () => { if (locked.current || (!deck && (requestInFlight.current || manualLinkRetry.current))) return;
      if (!deck) manualLinkRetry.current = true;
      setRefresh(r => r + 1); } };
}
