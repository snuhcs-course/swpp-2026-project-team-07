import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import {
  recoverPendingAttempts,
  savedAttempts,
  type SavedAttempt,
} from "../recording/storage";
import { getImportedPdfs, type LocalPdf } from "../pdf/service";
import {
  knownHistory,
  refreshHistory,
  type PresentationHistory,
} from "../transcription/reviewHistory";

export function usePracticeLibrary(apiUrl: string) {
  const [groups, setGroups] = useState<PresentationHistory[]>([]);
  const focused = useRef(false);
  const session = useRef<AbortController | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [notice, setNotice] = useState("");
  const [pdfs, setPdfs] = useState<LocalPdf[]>([]);

  const refreshLibrary = useCallback(async () => {
    session.current?.abort();
    const controller = new AbortController();
    session.current = controller;
    const current = () =>
      focused.current &&
      session.current === controller &&
      !controller.signal.aborted;
    let local: SavedAttempt[] = [];
    try {
      recoverPendingAttempts();
      local = savedAttempts();
      // Captures restore immediately, including presentations removed from the import catalog.
      if (current()) setGroups(knownHistory(apiUrl, [], local));
      let catalog: LocalPdf[] = [];
      try {
        catalog = await getImportedPdfs();
      } catch {
        if (current())
          setNotice(
            "Could not read the PDF catalog. Retained rehearsals are still available.",
          );
      }
      if (!current()) return;
      setPdfs(catalog);
      const cached = knownHistory(apiUrl, catalog, local);
      setGroups(cached);
      setRefreshing(true);
      const outcomes = await Promise.allSettled(
        cached.map((group) => refreshHistory(apiUrl, group, controller.signal)),
      );
      if (!current()) return;
      setGroups(knownHistory(apiUrl, catalog, local));
      setNotice(
        outcomes.some((outcome) => outcome.status === "rejected")
          ? "History may be stale. Could not refresh every presentation; cached rehearsals are retained."
          : "",
      );
    } catch (error) {
      if (current())
        setNotice(
          error instanceof Error
            ? error.message
            : "Could not load rehearsal history.",
        );
    } finally {
      if (current()) setRefreshing(false);
    }
  }, [apiUrl]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (AppState.currentState === "active") void refreshLibrary();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void refreshLibrary();
        else {
          session.current?.abort();
          setRefreshing(false);
        }
      });
      return () => {
        focused.current = false;
        session.current?.abort();
        subscription.remove();
      };
    }, [refreshLibrary]),
  );

  return {
    groups,
    pdfs,
    notice,
    setNotice,
    refreshing,
    refreshLibrary,
    focused,
  };
}
