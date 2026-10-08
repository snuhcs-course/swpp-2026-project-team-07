import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Pdf from 'react-native-pdf';
import { createAudioPlayer, type AudioStatus } from 'expo-audio';
import { checkCancelled, type MediaSpec, type Validator } from './reviewMedia';

export function validateAudio(uri: string, spec: MediaSpec, signal: AbortSignal): Promise<void> {
  checkCancelled(signal);
  return new Promise((resolve, reject) => {
    const player = createAudioPlayer(uri, { updateInterval: 100 });
    let settled = false;
    let listener: { remove(): void } | undefined;
    const finish = (error?: Error) => {
      if (settled) return; settled = true;
      clearTimeout(timer); signal.removeEventListener('abort', abort); listener?.remove();
      try { player.release(); } catch { /* Disposal must not hang validation. */ }
      if (error) reject(error); else resolve();
    };
    const abort = () => finish(new Error('Audio validation cancelled.'));
    const timer = setTimeout(() => finish(new Error('Audio validation timed out.')), 15_000);
    const status = (value: AudioStatus) => {
      if (value.error) finish(new Error('The audio could not be decoded.'));
      else if (value.isLoaded) {
        const duration = value.duration * 1000;
        finish(!Number.isFinite(duration) || duration <= 0 || (spec.durationMs !== undefined && Math.abs(duration - spec.durationMs) > 1000)
          ? new Error('Audio duration does not match this rehearsal.') : undefined);
      }
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
      listener = player.addListener('playbackStatusUpdate', status);
      if (settled) listener.remove(); else status(player.currentStatus);
      if (signal.aborted) abort();
    } catch { finish(new Error('Audio validation could not start.')); }
  });
}
type Request = { key: number; uri: string; pages: number; finish: (error?: Error) => void };
/** Hidden native renderers must finish loading before the media service publishes a PDF. */
export function useMediaValidators() {
  const [requests, setRequests] = useState<Request[]>([]);
  const pending = useRef(new Map<number, Request>());
  const serial = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const current = pending.current;
    return () => { mounted.current = false; for (const item of current.values()) item.finish(new Error('PDF validation cancelled.')); };
  }, []);
  const validate: Validator = useCallback((uri, spec, signal) => {
    if (spec.kind === 'audio') return validateAudio(uri, spec, signal);
    checkCancelled(signal);
    return new Promise<void>((resolve, reject) => {
      const key = ++serial.current;
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return; settled = true;
        clearTimeout(timer); signal.removeEventListener('abort', abort); pending.current.delete(key);
        if (mounted.current) setRequests([...pending.current.values()]);
        if (error) reject(error); else resolve();
      };
      const abort = () => finish(new Error('PDF validation cancelled.'));
      const timer = setTimeout(() => finish(new Error('PDF validation timed out.')), 15_000);
      const request = { key, uri, pages: spec.pageCount!, finish };
      pending.current.set(key, request); signal.addEventListener('abort', abort, { once: true });
      if (!mounted.current || signal.aborted) abort(); else setRequests([...pending.current.values()]);
    });
  }, []);
  const validators = <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
    {requests.map(r => <Pdf key={r.key} source={{ uri: r.uri }} style={{ width: 1, height: 1 }}
      onLoadComplete={pages => r.finish(Number.isInteger(pages) && pages >= 1 && pages <= 10 && pages === r.pages ? undefined : new Error('PDF page count does not match this presentation.'))}
      onError={() => r.finish(new Error('The PDF could not be opened.'))} />)}
  </View>;
  return { validate, validators };
}
