// OpenAI Codex reliability fixes: docs/ai-collaboration/prompt-logs/unattributed/iteration-2.md#record-138
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { API_URL } from '../../services/api';
import { backendFetch, demoAccess } from '../../services/backendFetch';
import { readStored } from '../../services/storage';
import { normalizeApi } from '../transcription/analysisStorage';
import { canonicalUuid } from '../feedback/validation';
import { createProfileClient, readProfiles, type ProfileState } from './slideProfiles';
import { ServerPdfRejection, serverPdfUnconfirmed } from './serverDeck';
import { STORE_MODE } from '../../services/apiConfig';
import { StorePreflightError } from '../../services/storeAccess';
import { STORE_API } from '../../services/storeEndpoint';

const active = new Set(['queued', 'preparing', 'submitted', 'normalizing', 'waiting_quota']);
type LocalSource = { id: string; title: string; uri: string; pageCount: number };
type SyncReason = 'manual' | 'background';
function transientCueRequest(cause: unknown) {
  if (!(cause instanceof Error) || cause instanceof StorePreflightError) return false;
  const status = Number(cause.message.match(/HTTP (\d{3})/i)?.[1]);
  return status >= 500 || [408, 409, 429].includes(status) || cause.name === 'AbortError' ||
    /network|connection|failed to fetch|load failed|offline|timeout|timed out/i.test(cause.message);
}

export function useSlideProfiles(localId: string, pages: number, visible = true, source?: LocalSource) {
  const api = normalizeApi(API_URL);
  const sourceMatches = source?.id === localId && source.pageCount === pages;
  const sourceTitle = sourceMatches ? source.title : null;
  const sourceUri = sourceMatches ? source.uri || null : null;
  const mapped = readStored<string>(`server-deck:${api}:${localId}`);
  const deck = canonicalUuid(mapped) ? mapped : null;
  const [snapshot, setSnapshot] = useState<{ deck: string; pages: number; value: ProfileState } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [failure, setFailure] = useState({ deck, message: '' });
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<SyncReason | null>(null);
  const locked = useRef(false);
  const manualRefresh = useRef(false);
  const reconciledPdf = useRef<string | null>(null);
  const autoAdmission = useRef<{ deck: string; count: number } | null>(null);
  const requestInFlight = useRef<{ controller: AbortController; reason: SyncReason } | null>(null);
  const mounted = useRef(true);
  const selected = useRef(deck);
  useLayoutEffect(() => { selected.current = deck; }, [deck]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const currentSnapshot = snapshot?.deck === deck && snapshot.pages === pages ? snapshot : null;
  // Read and validate the on-disk deck only when its identity changes. Local
  // gestures rerender this screen and should never reparse the cue cache.
  const cached = useMemo(() => !currentSnapshot && deck ? readProfiles(api, deck, pages) : null, [api, currentSnapshot, deck, pages]);
  const value = currentSnapshot?.value ?? cached;
  const error = failure.deck === deck ? failure.message : '';
  useFocusEffect(useCallback(() => {
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    // The public endpoint deduplicates these immutable PDF bytes within this installation.
    const canReconcilePdf = () => api === STORE_API && reconciledPdf.current !== localId;
    const stop = () => {
      controller?.abort();
      if (requestInFlight.current?.controller === controller) requestInFlight.current = null;
      if (timer) clearTimeout(timer);
      if (mounted.current) setSync(null);
    };
    const start = () => {
      stop();
      const manual = manualRefresh.current;
      manualRefresh.current = false;
      if (!visible || AppState.currentState !== 'active' || (!deck && !sourceUri)) return;
      if (!deck && serverPdfUnconfirmed(localId, api) && !manual && !canReconcilePdf()) {
        setFailure({ deck: null, message: 'Server did not confirm this PDF. Tap Refresh with server to try again.' });
        return;
      }
      const current = new AbortController(); controller = current;
      let retryUnconfirmed = manual;
      const read = async (reason: SyncReason = 'background') => {
        requestInFlight.current = { controller: current, reason };
        setSync(reason);
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
            const reconcile = !retryUnconfirmed && serverPdfUnconfirmed(localId, api) && canReconcilePdf();
            if (reconcile) reconciledPdf.current = localId;
            const allowUnconfirmedRetry = retryUnconfirmed || reconcile;
            retryUnconfirmed = false;
            await serverSlides({ id: localId, title: sourceTitle!, uri: sourceUri!, pageCount: pages }, api, current.signal, undefined, allowUnconfirmedRetry);
            if (current.signal.aborted) return;
            failures = 0;
            setFailure({ deck: null, message: '' });
            setRefresh(value => value + 1);
            return;
          }
          const client = createProfileClient(api);
          let next = await client.read(deck, pages, current.signal);
          if (current.signal.aborted) return;
          failures = 0;
          const attempts = autoAdmission.current?.deck === deck ? autoAdmission.current.count : 0;
          if (sourceMatches && next.state === 'absent' && attempts < 2) {
            if (locked.current) {
              timer = setTimeout(() => { void read(); }, 2500);
              return;
            }
            autoAdmission.current = { deck, count: attempts + 1 };
            locked.current = true;
            setBusy(true);
            setFailure({ deck, message: '' });
            setSnapshot({ deck, pages, value: next });
            try {
              next = await client.generate(deck, pages, current.signal);
            } catch (cause) {
              if (current.signal.aborted) return;
              const transient = transientCueRequest(cause);
              if (!transient) autoAdmission.current = { deck, count: 2 };
              const retry = transient && attempts === 0;
              const detail = cause instanceof StorePreflightError ? cause.message : 'Could not start AI cues. Refresh to check again.';
              setFailure({ deck, message: retry ? 'Connection interrupted. Checking AI cues again…' : detail });
              // Re-read before retrying. If admission already succeeded, poll that job.
              if (retry) timer = setTimeout(() => { void read(); }, 2500);
              return;
            } finally {
              locked.current = false;
              if (mounted.current) setBusy(false);
            }
            if (current.signal.aborted) return;
          }
          setFailure({ deck, message: '' });
          setSnapshot({ deck, pages, value: next });
          if (active.has(next.state)) timer = setTimeout(() => { void read(); }, 2500);
        } catch (cause) {
          if (current.signal.aborted) return;
          const detail = cause instanceof Error ? cause.message : String(cause);
          const codeNeeded = /demo code|server access expired|HTTP 401/i.test(detail);
          const httpStatus = detail.match(/HTTP (\d{3})/i)?.[1];
          const unconfirmed = !deck && serverPdfUnconfirmed(localId, api);
          const rejected = cause instanceof ServerPdfRejection;
          const reconcile = unconfirmed && canReconcilePdf() && !rejected;
          const message = rejected || (STORE_MODE && cause instanceof StorePreflightError) ? detail
            : codeNeeded ? (STORE_MODE ? 'Online access expired. To reconnect, touch and hold OutLoud on Home, then choose Online coaching settings. Your local recordings are saved.' : 'Enter the demo code to reconnect server cues.')
            : /different presentation/i.test(detail) ? 'The server returned a different presentation. Check this PDF before retrying.'
            : unconfirmed ? reconcile ? 'Connection interrupted. Checking this PDF again…' : 'Server did not confirm this PDF. Tap Refresh with server to try again.'
            : httpStatus ? `Server returned HTTP ${httpStatus}. Reconnecting…`
              : /server readiness timed out/i.test(detail) ? 'Server readiness check timed out. Reconnecting…'
                : /network request failed|failed to fetch|timeout|timed out/i.test(detail) ? 'Network upload failed. Reconnecting…'
                  : deck ? 'Connection interrupted. Saved cues are retained. Reconnecting…'
                    : 'Could not link this presentation to the server. Reconnecting…';
          setFailure({ deck, message });
          if ((unconfirmed && !reconcile) || rejected) return;
          const delay = [2500, 5000, 10000, 30000][Math.min(failures++, 3)];
          timer = setTimeout(() => { void read(); }, delay);
        } finally {
          if (requestInFlight.current?.controller === current) requestInFlight.current = null;
          if (!current.signal.aborted && mounted.current) setSync(null);
        }
      };
      void read(manual ? 'manual' : 'background');
    };
    start();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') start(); else stop(); });
    const accessSub = demoAccess.subscribe(() => {
      if (failures && demoAccess.getSnapshot().state === 'ready') start();
    });
    return () => { stop(); sub.remove(); accessSub(); };
  // Manual refresh deliberately restarts the focus lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, deck, localId, pages, refresh, sourceMatches, sourceTitle, sourceUri, visible]));
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
      if (mounted.current && selected.current === deck) { setSnapshot({ deck, pages, value: next }); setRefresh(r => r + 1); }
    } catch { if (mounted.current && selected.current === deck) setFailure({ deck, message: 'AI cue request failed. Tap to refresh before retrying.' }); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  }, [api, deck, pages, value]);
  return { value, error, busy, syncing: sync !== null, refreshing: sync === 'manual', recover, available: !!deck,
    // OpenAI Codex, 2026-11-21: every refresh entry point shares the same in-flight guard, including the cue sheet and landscape.
    refresh: () => { if (locked.current || manualRefresh.current || requestInFlight.current?.reason === 'manual' || (!deck && requestInFlight.current)) return;
      manualRefresh.current = true;
      setFailure({ deck, message: '' });
      setRefresh(r => r + 1); } };
}
