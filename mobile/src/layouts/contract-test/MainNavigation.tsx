import { Stack, router } from 'expo-router';
import { View } from 'react-native';
import { Action } from '../refactor/components';
export function MainNavigation() {
  return <Stack screenOptions={{
    headerTitle: '',
    headerLeft: () => <Action compact secondary label="Home" onPress={() => router.navigate('/')} />,
    headerRight: () => <View style={{ flexDirection: 'row', gap: 8 }}>
      <Action compact secondary label="Practice" onPress={() => router.navigate('/practice')} />
      <Action compact secondary label="Help and connection" displayLabel="Help" onPress={() => router.push('/utilities')} />
    </View>,
  }}><Stack.Screen name="index" /><Stack.Screen name="practice" /></Stack>;
}
