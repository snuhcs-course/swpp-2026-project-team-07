import { Text, View } from 'react-native';
import { colors, Icon } from './components';
import type { ThumbnailProps } from '../contracts';
export function ThumbnailView({ title, stage }: ThumbnailProps) {
  return <View accessible accessibilityLabel={`${title} slide preview`} pointerEvents="none" style={{ width: 80, height: 52, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>{stage || <><Icon name="file-text" color={colors.muted} /><Text style={{ fontSize: 9, color: colors.muted, marginTop: 2 }}>PDF</Text></>}</View>;
}
