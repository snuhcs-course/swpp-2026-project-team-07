// Synthetic native/transport boundary; the actual durable outbox and CaptureEngine remain in use.
export { captureVersion, subscribeCaptures, readCapture, checkpointCapture, registerCapture } from '../../src/features/recording/incrementalState.ts';
export const incrementalAvailable = async () => !!globalThis.continuousCapture;
export async function retryCapture() {}
export function LiveFeedbackPanel() { return null; }
export const continuousRecorder = {
  available: () => !!globalThis.continuousCapture,
  start: (...args) => globalThis.continuousCapture.start(...args),
  transition: (...args) => globalThis.continuousCapture.transition(...args),
  status: () => globalThis.continuousCapture.status(),
  stop: () => globalThis.continuousCapture.stop(),
};
