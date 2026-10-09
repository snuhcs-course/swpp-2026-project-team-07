import { Text } from 'react-native';
import { Action, Screen, styles } from './components';
import type { MessageProps } from '../contracts';
export function MessageView({ title, message, actionLabel, onAction }: MessageProps) {
  return <Screen><Text style={styles.heading}>{title}</Text>{!!message && <Text accessibilityRole="alert" style={styles.body}>{message}</Text>}{onAction && <Action label={actionLabel || 'Try again'} onPress={onAction} />}</Screen>;
}
