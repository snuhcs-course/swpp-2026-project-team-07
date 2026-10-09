import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "./components";

export function RootNavigation() {
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="library" options={{ title: "Presentations" }} />
        <Stack.Screen name="utilities" options={{ title: "Help & connection" }} />
        <Stack.Screen name="viewer" options={{ title: "Practice setup" }} />
        <Stack.Screen name="rehearsal" options={{ title: "Practice" }} />
        <Stack.Screen name="results" options={{ title: "Review" }} />
      </Stack>
    </>
  );
}
