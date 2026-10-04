import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

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
  const { catalog } = getPaths();
  const info = await FileSystem.getInfoAsync(catalog);
  if (!info.exists) return [];

  try {
    const value: unknown = JSON.parse(await FileSystem.readAsStringAsync(catalog));
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is LocalPdf =>
        !!item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.uri === "string",
    );
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
    if (asset.size === 0) throw new Error("That PDF file is empty.");
    const signature = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
      position: 0,
      length: 1024,
    });
    if (!signature.includes("%PDF-")) {
      throw new Error("This file does not contain a valid PDF document.");
    }

    const { directory, catalog } = getPaths();
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
      const previous = await getImportedPdfs();
      await FileSystem.writeAsStringAsync(
        catalog,
        JSON.stringify([pdf, ...previous]),
      );
    } catch (error) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      throw error;
    }
    return pdf;
  },

  async removePdf(id: string): Promise<void> {
    const { catalog } = getPaths();
    const current = await getImportedPdfs();
    const removed = current.find((pdf) => pdf.id === id);
    if (!removed) return;
    await FileSystem.deleteAsync(removed.uri, { idempotent: true });
    await FileSystem.writeAsStringAsync(
      catalog,
      JSON.stringify(current.filter((pdf) => pdf.id !== id)),
    );
  },
};
