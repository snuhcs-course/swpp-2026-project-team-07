import { useState } from 'react';
import Pdf from 'react-native-pdf';
import { activeLayout } from '../../layouts/registry';
export function PdfThumbnail({ uri, title }: { uri?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  const stage = uri && !failed ? <Pdf source={{ uri }} page={1} singlePage scrollEnabled={false} enableDoubleTapZoom={false} fitPolicy={0} style={{ flex: 1, width: '100%' }} onError={() => setFailed(true)} /> : null;
  return <activeLayout.Thumbnail title={title} stage={stage} />;
}
