import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { AppState, Text, View } from "react-native";
import { Action, Card, Screen, styles } from "../../ui/components";
import { API_URL, checkBackend } from "../../services/api";
import { recoverPendingAttempts, savedAttempts, type SavedAttempt } from "../recording/storage";
import { getImportedPdfs, pdfService, type LocalPdf } from "./service";

import { knownHistory, refreshHistory, type PresentationHistory } from '../transcription/reviewHistory';
import { existingLocalFile, reviewMedia, type MediaSpec } from '../transcription/reviewMedia';
import { readDeck } from '../transcription/reviewStorage';
import { normalizeApi } from '../transcription/analysisStorage';

export function LibraryScreen({ apiUrl = API_URL }: { apiUrl?: string }) {
  return <LibraryContent key={normalizeApi(apiUrl)} apiUrl={normalizeApi(apiUrl)} />;
}
function LibraryContent({ apiUrl }: { apiUrl: string }) {
  const [groups, setGroups] = useState<PresentationHistory[]>([]);
  const focused = useRef(false);
  const session = useRef<AbortController | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pdfs, setPdfs] = useState<LocalPdf[]>([]);

  const refreshLibrary = useCallback(async () => {
    session.current?.abort();
    const controller = new AbortController(); session.current = controller;
    const current = () => focused.current && session.current === controller && !controller.signal.aborted;
    let local: SavedAttempt[] = [];
    try {
      recoverPendingAttempts(); local = savedAttempts();
      // Captures restore immediately, including presentations removed from the import catalog.
      if (current()) setGroups(knownHistory(apiUrl, [], local));
      let catalog: LocalPdf[] = [];
      try { catalog = await getImportedPdfs(); }
      catch { if (current()) setNotice('Could not read the PDF catalog. Retained rehearsals are still available.'); }
      if (!current()) return;
      setPdfs(catalog);
      const cached = knownHistory(apiUrl, catalog, local); setGroups(cached); setRefreshing(true);
      const outcomes = await Promise.allSettled(cached.map(group => refreshHistory(apiUrl, group, controller.signal)));
      if (!current()) return;
      setGroups(knownHistory(apiUrl, catalog, local));
      setNotice(outcomes.some(outcome => outcome.status === 'rejected') ? 'History may be stale. Could not refresh every presentation; cached rehearsals are retained.' : '');
    } catch (error) {
      if (current()) setNotice(error instanceof Error ? error.message : 'Could not load rehearsal history.');
    } finally { if (current()) setRefreshing(false); }
  }, [apiUrl]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (AppState.currentState === 'active') void refreshLibrary();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshLibrary(); else { session.current?.abort(); setRefreshing(false); }
    });
    return () => { focused.current = false; session.current?.abort(); subscription.remove(); };
  }, [refreshLibrary]));

  async function importPdf() {
    setNotice("");
    setImporting(true);
    try {
      const pdf = await pdfService.importPdf();
      if (!pdf) return;
      void refreshLibrary();
      if (!focused.current) return;
      router.push({ pathname: "/viewer", params: { uri: pdf.uri, title: pdf.title, localDeckId: pdf.id } });
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
      setNotice(error instanceof Error ? error.message : "Could not remove PDF.");
    }
  }

  async function connect() {
    setChecking(true);
    try {
      const message = await checkBackend(apiUrl);
      if (focused.current) setNotice(message);
    } catch {
      setNotice(
        "Could not reach the backend. Start Django and check the API address in mobile/.env.",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen>
      <View>
        <Text style={styles.label}>YOUR PRACTICE SPACE</Text>
        <Text style={[styles.title, { marginTop: 8 }]}>A clearer presentation{"\n"}starts here.</Text>
      </View>
      <Text style={styles.body}>
        Import a PDF stored on this device, then move through its pages one at a time.
      </Text>
      <Action
        label={importing ? "Importing PDF…" : "Import a PDF"}
        disabled={importing}
        onPress={importPdf}
      />
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {notice}
        </Text>
      )}
      <View style={styles.between}>
        <Text style={styles.heading}>Presentations</Text>
        <Text style={styles.label}>{pdfs.length} SAVED HERE</Text>
      </View>
      <Action label={refreshing ? 'Refreshing history…' : 'Refresh history'} disabled={refreshing} onPress={() => void refreshLibrary()} secondary />
      {groups.map(group => <Card key={group.key}>
        <Text style={styles.heading}>{group.title}</Text>
        {group.pdfs.map(pdf => <View key={pdf.id} style={styles.between}>
          <Action label="Open slides" onPress={() => router.push({ pathname: '/viewer', params: { uri: pdf.uri, title: pdf.title, localDeckId: pdf.id } })} />
          <Action label="Remove" onPress={() => void removePdf(pdf)} secondary />
        </View>)}
        {!group.pdfs.length && <Text style={styles.body}>Original PDF is not in the import catalog. Review can recover missing media.</Text>}
        <Text style={styles.heading}>Rehearsal history</Text>
        {group.entries.map(entry => <View key={entry.id} style={{ gap: 8, marginTop: 12 }}>
          <Text style={styles.body}>{entry.local ? 'Local capture' : 'Server rehearsal'} · {entry.local?.created_at || entry.review?.created_at ? new Date(entry.local?.created_at || entry.review!.created_at!).toLocaleString() : 'Date unavailable'}</Text>
          <Text style={styles.body}>{Math.floor((entry.local?.recording.duration_ms || entry.review?.duration_ms || 0) / 1000)} seconds · {entry.local?.state || 'on server'}{entry.review ? ` · ${entry.review.processing_state.replaceAll('_', ' ')}` : ''}</Text>
          <Text style={styles.body}>{offlineSummary(apiUrl, entry.local, entry.review)}</Text>
          <Action label="Open saved rehearsal" onPress={() => router.push({ pathname: '/results', params: { attemptId: entry.id } })} />
        </View>)}
        {!group.entries.length && <Text style={styles.body}>No cached rehearsals for this presentation.</Text>}
      </Card>)}
      {!groups.length && <Text style={styles.body}>Your imported presentations and retained rehearsals will appear here.</Text>}
      <Card>
        <Text style={styles.heading}>Sample presentation</Text>
        <Text style={styles.body}>Explore the rehearsal preview with sample slides.</Text>
        <Action label="Open sample slides" onPress={() => router.push("/viewer")} secondary />
      </Card>
      <Card>
        <Text style={styles.heading}>Backend connection</Text>
        <Text style={styles.body}>{apiUrl}</Text>
        <Action
          label={checking ? "Checking…" : "Check connection"}
          disabled={checking}
          onPress={connect}
          secondary
        />
      </Card>
    </Screen>
  );
}

function offlineSummary(api: string, local?: SavedAttempt, review?: import('../../contracts').ReviewAttempt) {
  try {
    const deck = review?.deck_id ? readDeck(api, review.deck_id) : null;
    const audioSpec: MediaSpec | null = review?.audio_url && review.duration_ms ? { api, id: review.attempt_id, kind: 'audio', url: review.audio_url, durationMs: review.duration_ms } : null;
    const pdfSpec: MediaSpec | null = deck?.pdf_url ? { api, id: deck.id, kind: 'pdf', url: deck.pdf_url, pageCount: deck.page_count } : null;
    const audio = audioSpec && reviewMedia.cached(audioSpec);
    const pdf = pdfSpec && reviewMedia.cached(pdfSpec);
    return [audio ? 'Audio available offline' : existingLocalFile(local?.recording.audio_uri) ? 'Local audio (checked on open)' : 'Audio download needed',
      pdf ? 'PDF available offline' : existingLocalFile(local?.pdf_uri) ? 'Local PDF (checked on open)' : 'PDF download needed',
      review?.transcript ? 'Transcript cached' : null].filter(Boolean).join(' · ');
  } catch { return 'Offline media availability could not be checked.'; }
}
