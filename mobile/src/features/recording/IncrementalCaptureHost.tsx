import { useEffect } from 'react';
import { AppState } from 'react-native';
import { captures, refreshCapture, syncCapture } from './incremental';
import { recoverCapture } from './captureRecovery';
import { recoverPendingAttempts } from './storage';

/** Durable outbox survives screen changes, interruptions and app restarts. */
export function IncrementalCaptureHost() {
  useEffect(() => {
    recoverPendingAttempts();
    for (const item of captures()) {
      try { recoverCapture(item.id); }
      catch { /* Recovery stored a visible per-recording error; continue the other outboxes. */ }
    }
    const tick = () => {
      if (AppState.currentState !== 'active') return;
      for (const item of captures()) if (!item.complete) {
        void syncCapture(item.id);
        if (item.declared) void refreshCapture(item.id);
      }
    };
    tick(); const timer = setInterval(tick, 2000);
    const subscription = AppState.addEventListener('change', tick);
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return null;
}
