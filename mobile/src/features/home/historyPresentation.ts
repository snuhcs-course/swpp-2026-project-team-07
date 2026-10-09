import type { SavedAttempt } from "../recording/storage";
import type {
  HistoryEntry,
  PresentationHistory,
} from "../transcription/reviewHistory";
import {
  existingLocalFile,
  reviewMedia,
  type MediaSpec,
} from "../transcription/reviewMedia";
import { readDeck } from "../transcription/reviewStorage";
export const clock = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
export const entryDate = (entry?: HistoryEntry) =>
  entry?.local?.created_at || entry?.review?.created_at || "";
export const entryStatus = (entry: HistoryEntry) =>
  (entry.review?.processing_state || entry.local?.state || "Saved").replaceAll(
    "_",
    " ",
  );
function presentationActivity(group: PresentationHistory): number {
  // Imported IDs already contain the import timestamp (see pdf/service.ts).
  // Read it without migrating the catalog; unknown legacy IDs retain list order.
  const imported = group.pdfs.map((pdf) =>
    /^\d{13}-/.test(pdf.id) ? Number(pdf.id.split("-")[0]) : 0,
  );
  const rehearsed = Date.parse(entryDate(group.entries[0])) || 0;
  return Math.max(rehearsed, ...imported);
}
export const recentPresentations = (groups: PresentationHistory[]) =>
  [...groups].sort((a, b) => presentationActivity(b) - presentationActivity(a));
export const practicePresentations = (groups: PresentationHistory[]) =>
  groups
    .filter((group) => group.entries.length > 0)
    .sort((a, b) => entryDate(b.entries[0]).localeCompare(entryDate(a.entries[0])));
export function offlineSummary(
  api: string,
  local?: SavedAttempt,
  review?: import("../../contracts").ReviewAttempt,
) {
  try {
    const deck = review?.deck_id ? readDeck(api, review.deck_id) : null;
    const audioSpec: MediaSpec | null =
      review?.audio_url && review.duration_ms
        ? {
            api,
            id: review.attempt_id,
            kind: "audio",
            url: review.audio_url,
            durationMs: review.duration_ms,
          }
        : null;
    const pdfSpec: MediaSpec | null = deck?.pdf_url
      ? {
          api,
          id: deck.id,
          kind: "pdf",
          url: deck.pdf_url,
          pageCount: deck.page_count,
        }
      : null;
    const audio = audioSpec && reviewMedia.cached(audioSpec);
    const pdf = pdfSpec && reviewMedia.cached(pdfSpec);
    return [
      audio
        ? "Audio available offline"
        : existingLocalFile(local?.recording.audio_uri)
          ? "Local audio (checked on open)"
          : "Audio download needed",
      pdf
        ? "PDF available offline"
        : existingLocalFile(local?.pdf_uri)
          ? "Local PDF (checked on open)"
          : "PDF download needed",
      review?.transcript ? "Transcript cached" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  } catch {
    return "Offline media availability could not be checked.";
  }
}
