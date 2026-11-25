// Synthetic server-deck boundary for cue reconnection tests.
export const serverSlides = (...args) => globalThis.__cueServerSlides(...args);
export const serverPdfUnconfirmed = (...args) => globalThis.__cueServerPdfUnconfirmed?.(...args) ?? false;
export class ServerPdfRejection extends Error {}
