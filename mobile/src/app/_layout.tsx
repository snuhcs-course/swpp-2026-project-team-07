// AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
// Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../ui/components";

export default function Layout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.paper },
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" options={{ title: "OutLoud" }} />
        <Stack.Screen name="viewer" options={{ title: "Your slides" }} />
        <Stack.Screen name="rehearsal" options={{ title: "Practice" }} />
        <Stack.Screen name="results" options={{ title: "Review" }} />
      </Stack>
    </>
  );
}
