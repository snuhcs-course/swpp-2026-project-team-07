// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode root: docs/ai-collaboration/iteration-2/prompt-log.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: one full-screen route; screens and transitions live in AppShell.
// OpenAI Codex landscape follow-up: docs/ai-collaboration/iteration-2/prompt-log.md#landscape-rehearsal-implementation-october-15-2026
// OpenAI Codex native carousel gesture: docs/ai-collaboration/iteration-2/prompt-log.md#home-carousel-and-return-transition-performance-october-15-2026
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Per-weight imports: the package index would bundle every weight.
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../design/theme';

export default function Layout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold,
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold,
  });
  return <GestureHandlerRootView style={{ flex: 1 }}><ThemeProvider><AppLayout ready={loaded || !!error} /></ThemeProvider></GestureHandlerRootView>;
}

function AppLayout({ ready }: { ready: boolean }) {
  const { mode, c } = useTheme();
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}
