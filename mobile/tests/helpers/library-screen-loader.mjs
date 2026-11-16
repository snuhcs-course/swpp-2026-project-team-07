import { resolve as bundledResolve, load } from './bundled-demo-loader.mjs';
import { resolve as domainResolve } from './domain-loader.mjs';
export { load };

const fixture = new URL('./library-screen-native.mjs', import.meta.url).href;

export function resolve(specifier, context, next) {
  if (specifier === 'expo-file-system' || specifier === 'expo/fetch') {
    return { url: new URL('./upload-native.mjs', import.meta.url).href, shortCircuit: true };
  }
  if (['react-native', 'react-native-reanimated', 'react-native-gesture-handler',
    'react-native-svg', 'expo-haptics', 'react-native-safe-area-context'].includes(specifier) ||
    (context.parentURL?.includes('/src/screens/') &&
      ['./HomeFeedbackStats', './PresentationSetup', '../design/PanView'].includes(specifier))) {
    return { url: fixture, shortCircuit: true };
  }
  return bundledResolve(specifier, context, (name, ctx) => domainResolve(name, ctx, next));
}
