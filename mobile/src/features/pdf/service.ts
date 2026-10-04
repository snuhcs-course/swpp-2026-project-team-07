import { File } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { readStored, writeStored } from "../../services/storage";
import { savedAttempts } from "../recording/storage";

export type LocalPdf = {
  id: string;
  title: string;
  uri: string;
};

const folderName = "outloud-pdfs";
const catalogName = "catalog.json";

function getPaths() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Local document storage is unavailable on this device.");
  }
  const directory = `${FileSystem.documentDirectory}${folderName}/`;
  return { directory, catalog: `${directory}${catalogName}` };
}

export async function getImportedPdfs(): Promise<LocalPdf[]> {
  const stored = readStored<LocalPdf[]>("pdfs");
  if (stored) return stored;
  const { catalog } = getPaths();
  const info = await FileSystem.getInfoAsync(catalog);
  if (!info.exists) return [];

  try {
    const value: unknown = JSON.parse(await FileSystem.readAsStringAsync(catalog));
    if (!Array.isArray(value)) return [];
    const migrated = value.filter(
      (item): item is LocalPdf =>
        !!item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.uri === "string",
    );
    writeStored("pdfs", migrated);
    return migrated;
  } catch {
    throw new Error("The saved PDF list could not be read. Try importing again.");
  }
}

export const pdfService = {
  async importPdf(): Promise<LocalPdf | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return null;

    const asset = result.assets[0];
    if (!asset) throw new Error("No PDF was selected.");
    if (
      asset.mimeType !== "application/pdf" &&
      !asset.name.toLowerCase().endsWith(".pdf")
    ) {
      throw new Error("Choose a PDF file to import.");
    }
    if (asset.size && asset.size > 20 * 1024 * 1024) throw new Error("PDFs must be at most 20 MB.");
    if (asset.size === 0) throw new Error("That PDF file is empty.");
    const input = new File(asset.uri);
    if (input.size > 20 * 1024 * 1024) throw new Error("PDFs must be at most 20 MB.");
    const handle = input.open();
    let signature: string;
    try { signature = new TextDecoder().decode(handle.readBytes(Math.min(input.size, 1024))); }
    finally { handle.close(); }
    if (!signature.includes("%PDF-")) {
      throw new Error("This file does not contain a valid PDF document.");
    }

    const { directory } = getPaths();
    const directoryInfo = await FileSystem.getInfoAsync(directory);
    if (!directoryInfo.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const uri = `${directory}${id}.pdf`;
    const pdf: LocalPdf = {
      id,
      title: asset.name.replace(/\.pdf$/i, "") || "Untitled presentation",
      uri,
    };

    await FileSystem.copyAsync({ from: asset.uri, to: uri });
    try {
      await getImportedPdfs();
      const previous = readStored<LocalPdf[]>("pdfs") ?? [];
      writeStored("pdfs", [pdf, ...previous]);
    } catch (error) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      throw error;
    }
    return pdf;
  },

  async removePdf(id: string): Promise<void> {
    if (savedAttempts(id).length) throw new Error("This PDF has saved rehearsals and is kept for recovery.");
    await getImportedPdfs();
    const current = readStored<LocalPdf[]>("pdfs") ?? [];
    const removed = current.find((pdf) => pdf.id === id);
    if (!removed) return;
    writeStored("pdfs", current.filter((pdf) => pdf.id !== id));
    await FileSystem.deleteAsync(removed.uri, { idempotent: true });
  },
};
