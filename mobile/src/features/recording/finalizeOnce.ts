/** Coalesce concurrent Stop/native-finish events, then allow the next recording. */
export function finalizeOnce(
  pending: { current: Promise<void> | null },
  finalize: () => void | Promise<void>,
): Promise<void> {
  if (pending.current) return pending.current;
  // Assign before invoking finalize, including when native capture already ended.
  pending.current = Promise.resolve().then(finalize).finally(() => { pending.current = null; });
  return pending.current;
}
