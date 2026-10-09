// AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
// Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
import type { Deck, Slide } from "../../contracts";
import { FeatureNotImplementedError } from "../../services/notImplemented";

export interface PdfService {
  importPdf(): Promise<{ deck: Deck; slides: Slide[] } | null>;
}

// PDF owner: expo-document-picker → persist local file → POST /decks/ → rendered slides.
// Return null on picker cancellation. Never replace a real document with the demo deck.
export const pdfService: PdfService = {
  async importPdf() {
    throw new FeatureNotImplementedError("PDF import");
  },
};
