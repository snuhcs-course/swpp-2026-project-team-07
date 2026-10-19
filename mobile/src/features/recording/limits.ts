/** Phase 3: audio timeline limit, independent of a presentation's required time. */
export const MAX_RECORDING_MS = 1_800_000;
// Leave one second for the existing asynchronous native pause/finalization path.
export const STOP_RECORDING_MS = MAX_RECORDING_MS - 1000;
/** Voice AAC: about 14.4 MB at 30 minutes, below the unchanged 25 MB upload cap. */
export const VOICE_RECORDING_OPTIONS = {
  extension: '.m4a', sampleRate: 44100, numberOfChannels: 1, bitRate: 64000,
  android: { outputFormat: 'mpeg4' as const, audioEncoder: 'aac' as const },
};
