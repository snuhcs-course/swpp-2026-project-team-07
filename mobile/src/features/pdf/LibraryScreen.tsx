import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { Action, Card, Screen, styles } from "../../ui/components";
import { API_URL, checkBackend } from "../../services/api";
import { getImportedPdfs, pdfService, type LocalPdf } from "./service";

export function LibraryScreen() {
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pdfs, setPdfs] = useState<LocalPdf[]>([]);

  const refreshLibrary = useCallback(async () => {
    try {
      setPdfs(await getImportedPdfs());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load PDFs.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshLibrary();
    }, [refreshLibrary]),
  );

  async function importPdf() {
    setNotice("");
    setImporting(true);
    try {
      const pdf = await pdfService.importPdf();
      if (!pdf) return;
      await refreshLibrary();
      router.push({ pathname: "/viewer", params: { uri: pdf.uri, title: pdf.title } });
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
      setNotice(await checkBackend());
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
      {pdfs.map((pdf) => (
        <Card key={pdf.id}>
          <Text style={styles.label}>ON THIS DEVICE</Text>
          <Text style={styles.heading}>{pdf.title}</Text>
          <View style={styles.between}>
            <Action
              label="Open slides"
              onPress={() =>
                router.push({ pathname: "/viewer", params: { uri: pdf.uri, title: pdf.title } })
              }
            />
            <Action label="Remove" onPress={() => void removePdf(pdf)} secondary />
          </View>
        </Card>
      ))}
      {!pdfs.length && (
        <Card>
          <Text style={styles.body}>Your imported PDFs will appear here.</Text>
        </Card>
      )}
      <Card>
        <Text style={styles.heading}>Sample presentation</Text>
        <Text style={styles.body}>Explore the rehearsal preview with sample slides.</Text>
        <Action label="Open sample slides" onPress={() => router.push("/viewer")} secondary />
      </Card>
      <Card>
        <Text style={styles.heading}>Backend connection</Text>
        <Text style={styles.body}>{API_URL}</Text>
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
