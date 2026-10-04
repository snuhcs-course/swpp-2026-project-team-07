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
        <Stack.Screen name="descriptions" options={{ title: "Slide understanding" }} />
        <Stack.Screen name="results" options={{ title: "Review" }} />
      </Stack>
    </>
  );
}
