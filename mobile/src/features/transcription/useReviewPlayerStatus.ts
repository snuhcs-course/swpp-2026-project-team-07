import { useMemo, useSyncExternalStore } from 'react';
import type { AudioPlayer, AudioStatus } from 'expo-audio';

/** Expo 57 useEvent retains the old emitter's state when useAudioPlayer replaces its player. */
export function useReviewPlayerStatus(player: AudioPlayer) {
  const store = useMemo(() => createPlayerStatusStore(player), [player]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { ...snapshot, refreshStatus: store.refreshStatus };
}

function createPlayerStatusStore(player: AudioPlayer) {
    const initial = player.currentStatus;
    let snapshot = { status: initial, hasLoaded: initial.isLoaded && !initial.error };
    let notify: (() => void) | null = null;
    const accept = (event: AudioStatus) => {
      if (event.id !== player.id) return;
      // Same-player events can be queued before a newer seek settles. Position,
      // playing and buffering must come from native state at delivery time.
      // Expo Android's currentStatus omits event-only errors and EOF signals.
      const current = player.currentStatus;
      const status = { ...event, ...current, error: event.error || current.error,
        didJustFinish: event.didJustFinish || current.didJustFinish };
      // Android reports isLoaded=false again while seeking/buffering. Readiness
      // belongs to this player/source, and must not carry over to a new player.
      snapshot = { status, hasLoaded: !status.error && (snapshot.hasLoaded || status.isLoaded) }; notify?.();
    };
    return {
      getSnapshot: () => snapshot,
      refreshStatus: () => accept(player.currentStatus),
      subscribe(onChange: () => void) {
        let current = true;
        notify = onChange;
        const subscription = player.addListener('playbackStatusUpdate', status => { if (current) accept(status); });
        // Subscribe first, then read: a local source may load before subscription.
        accept(player.currentStatus);
        return () => { current = false; notify = null; subscription.remove(); };
      },
    };
}
