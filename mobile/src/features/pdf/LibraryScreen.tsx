// AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
// Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
import { useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Action, Card, DemoNotice, Screen, styles } from "../../ui/components";
import { API_URL, checkBackend } from "../../services/api";
import { pdfService } from "./service";

export function LibraryScreen() {
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(false);
  async function importPdf() {
    try {
      await pdfService.importPdf();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Import failed.");
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
        <Text style={[styles.title, { marginTop: 8 }]}>
          A clearer presentation{"\n"}starts here.
        </Text>
      </View>
      <Text style={styles.body}>
        Bring your slides, rehearse at your pace, and review what you said.
      </Text>
      <DemoNotice />
      <Action label="Import a PDF" onPress={importPdf} />
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {notice}
        </Text>
      )}
      <View style={styles.between}>
        <Text style={styles.heading}>Presentations</Text>
        <Text style={styles.label}>1 SAMPLE</Text>
      </View>
      <Card>
        <Text style={styles.label}>SAMPLE PRESENTATION</Text>
        <Text style={styles.heading}>A clearer story</Text>
        <Text style={styles.body}>
          3 sample slides · Explore the rehearsal flow
        </Text>
        <Action
          label="Open sample slides"
          onPress={() => router.push("/viewer")}
          secondary
        />
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
