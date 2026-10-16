import { normalizeApi } from '../transcription/analysisStorage';
const writers = new Map<string, Promise<unknown>>();
/** Defaults and confirmed choices share one writer; a rejected operation never blocks the next. */
export function serializeContextWrite<T>(localId: string, api: string, operation: () => Promise<T>): Promise<T> {
  const key = JSON.stringify([normalizeApi(api), localId]);
  const previous = writers.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  writers.set(key, next);
  void next.finally(() => { if (writers.get(key) === next) writers.delete(key); }).catch(() => undefined);
  return next;
}
