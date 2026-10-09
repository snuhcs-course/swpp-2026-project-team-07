import { useState } from 'react';
import { router } from 'expo-router';
import { API_URL } from '../../services/api';
import { pdfService, type LocalPdf } from './service';
import { PdfThumbnail } from './PdfThumbnail';
import { normalizeApi } from '../transcription/analysisStorage';
import type { HistoryEntry, PresentationHistory } from '../transcription/reviewHistory';
import { usePracticeLibrary } from '../home/usePracticeLibrary';
import { clock, entryDate, entryStatus, offlineSummary, practicePresentations, recentPresentations } from '../home/historyPresentation';
import { activeLayout } from '../../layouts/registry';
type Mode = 'home' | 'practice' | 'all';
export function LibraryScreen({ apiUrl = API_URL, mode = 'all' }: { apiUrl?: string; mode?: Mode }) {
  return <LibraryContent key={`${normalizeApi(apiUrl)}:${mode}`} apiUrl={normalizeApi(apiUrl)} mode={mode} />;
}
function LibraryContent({ apiUrl, mode }: { apiUrl: string; mode: Mode }) { return <activeLayout.Library model={useLibraryController(apiUrl, mode)} />; }
export function useLibraryController(apiUrl: string, mode: Mode) {
  const { groups, notice, setNotice, refreshing, refreshLibrary, focused } =
    usePracticeLibrary(apiUrl);
  const [importing, setImporting] = useState(false);
  async function importPdf() {
    if (importing) return;
    setNotice("");
    setImporting(true);
    try {
      const pdf = await pdfService.importPdf();
      if (!pdf || !focused.current) return;
      void refreshLibrary();
      openPdf(pdf);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PDF import failed.");
    } finally {
      setImporting(false);
    }
  }
  async function removePdf(pdf: LocalPdf) {
    try {
      await pdfService.removePdf(pdf.id);
      await refreshLibrary();
      setNotice(`Removed ${pdf.title} from this device.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not remove PDF.",
      );
    }
  }
  const sorted = recentPresentations(groups),
    recent = mode === "home" ? sorted.slice(0, 3) : sorted;
  const practiced = practicePresentations(groups);
  function entryView(entry: HistoryEntry) {
    return { id: entry.id, date: entryDate(entry), status: entryStatus(entry),
      duration: clock(entry.local?.recording.duration_ms || entry.review?.duration_ms || 0),
      local: !!entry.local, offline: offlineSummary(apiUrl, entry.local, entry.review),
      open: () => router.push({ pathname: '/results', params: { attemptId: entry.id } }) };
  }
  function groupView(group: PresentationHistory) {
    const pdf = group.pdfs[0], entries = group.entries.map(entryView);
    return { key: group.key, title: group.title, hasPdf: !!pdf, entries,
      thumbnail: <PdfThumbnail key={pdf?.uri ?? group.key} uri={pdf?.uri} title={group.title} />,
      open: () => pdf ? openPdf(pdf) : entries[0]?.open(),
      removals: group.pdfs.map(pdf => ({ id: pdf.id, title: pdf.title, remove: () => removePdf(pdf) })) };
  }
  return { mode, importing, notice, refreshing, importPdf, refreshLibrary,
    recent: recent.map(groupView), practiced: practiced.map(groupView), hasGroups: groups.length > 0,
    openLibrary: () => router.push('/library'), openHome: () => router.navigate('/') };
}
function openPdf(pdf: LocalPdf) {
  router.push({ pathname: '/viewer', params: { uri: pdf.uri, title: pdf.title, localDeckId: pdf.id } });
}
