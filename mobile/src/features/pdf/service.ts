import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

export type LocalPdf = {
  id: string;
  title: string;
  uri: string;
};

// Serialize catalog updates so overlapping imports cannot overwrite one another.
let mutations: Promise<unknown> = Promise.resolve();
function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutations.then(operation);
  mutations = result.catch(() => undefined);
  return result;
}

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
    if (!Array.isArray(value)) throw new Error("Invalid catalog");
    if (!value.every(
      (item): item is LocalPdf =>
        !!item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.uri === "string",
    )) throw new Error("Invalid catalog");
    return value;
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
    const info = await FileSystem.getInfoAsync(asset.uri);
    if (!info.exists || info.isDirectory) throw new Error("That PDF file is unavailable.");
    if (info.size === 0) throw new Error("That PDF file is empty.");
    if (info.size > 20 * 1024 * 1024) throw new Error("Choose a PDF no larger than 20 MiB.");
    const signature = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: 0,
      length: 5,
    });
    if (signature !== "JVBERi0=") {
      throw new Error("This file does not contain a valid PDF document.");
    }

    return mutate(async () => {
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
          `${catalog}.tmp`,
          JSON.stringify([pdf, ...previous]),
        );
        await FileSystem.moveAsync({ from: `${catalog}.tmp`, to: catalog });
      } catch (error) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        throw error;
      }
      return pdf;
    });
  },

  async removePdf(id: string): Promise<void> {
    return mutate(async () => {
      const { catalog } = getPaths();
      const current = await getImportedPdfs();
      const removed = current.find((pdf) => pdf.id === id);
      if (!removed) return;
      await FileSystem.writeAsStringAsync(
        `${catalog}.tmp`,
        JSON.stringify(current.filter((pdf) => pdf.id !== id)),
      );
      await FileSystem.moveAsync({ from: `${catalog}.tmp`, to: catalog });
      await FileSystem.deleteAsync(removed.uri, { idempotent: true });
    });
  },
};
