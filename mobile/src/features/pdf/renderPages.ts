// OpenAI Codex, 2026-11-02: extracted existing page renderer; see docs/ai-collaboration-prompts-iteration-2.md.
import * as FileSystem from 'expo-file-system/legacy';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import type { PageImage } from '../presentations/store';

/** Keep Android-rendered page images in documents; Android may clear thumbnail caches. */
export async function renderPages(pdf: { id: string; uri: string }): Promise<PageImage[]> {
  const rendered = await PdfThumbnail.generateAllPages(pdf.uri, { quality: 85, maxWidth: 1280, maxHeight: 1280 });
  if (!FileSystem.documentDirectory) throw new Error('Local storage is unavailable on this device.');
  const dir = `${FileSystem.documentDirectory}outloud-slides/${pdf.id}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const out: PageImage[] = [];
  for (let i = 0; i < rendered.length; i++) {
    const to = `${dir}${i}-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: rendered[i].uri, to });
    FileSystem.deleteAsync(rendered[i].uri, { idempotent: true }).catch(() => undefined);
    out.push({ uri: to, w: rendered[i].width, h: rendered[i].height });
  }
  return out;
}
