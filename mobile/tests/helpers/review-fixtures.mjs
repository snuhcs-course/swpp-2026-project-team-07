// Synthetic wire fixtures, never provider output or user media.
export const deckId = '11111111-1111-4111-8111-111111111111';
export const attemptId = '22222222-2222-4222-8222-222222222222';
export function wireResult(extra = {}) {
  return { attempt_id: attemptId, deck_id: deckId, duration_ms: 2000, created_at: '2026-10-08T00:00:00Z',
    audio_url: 'http://review.invalid/recordings/synthetic.wav', slide_events: [{ slide_index: 0, at_ms: 0 }, { slide_index: 1, at_ms: 1000 }],
    status: 'completed', processing_state: 'completed', processing_revision: 1,
    failed_stage: null, retry_available: false, retry_at: null, requires_confirmation: false,
    partial_available: { transcript: true, alignment: true }, transcript: { text: 'Hello, 안녕!\n', words: [{ text: 'Hello', start_ms: 0, end_ms: 500 }, { text: '안녕', start_ms: 1000, end_ms: 1500 }] },
    visits: [{ slide_index: 0, start_ms: 0, end_ms: 1000, words: [{ text: 'Hello', start_ms: 0, end_ms: 500 }] }, { slide_index: 1, start_ms: 1000, end_ms: 2000, words: [{ text: '안녕', start_ms: 1000, end_ms: 1500 }] }],
    metrics: { duration_ms: 2000, time_per_slide: [{ slide_index: 0, duration_ms: 1000 }, { slide_index: 1, duration_ms: 1000 }], detected_language: 'en',
      speaking_rates: [{ language: 'en', unit: 'words/min', count: 1, per_minute: 30 }, { language: 'ko', unit: 'Hangul runs/min', count: 1, per_minute: 30 }], rate_note: 'Total rehearsal minutes including silence.' },
    analysis_outcome: 'speech', feedback_state: 'disabled', feedback: [], error: null,
    provenance: { provider: 'openai', model: 'whisper-1', generation: 1, outcome: 'received', speech_gate: 'silero-vad' }, ...extra };
}
export const deckWire = { id: deckId, title: 'Synthetic presentation', page_count: 2, pdf_url: 'http://review.invalid/decks/synthetic.pdf', slides: [] };
