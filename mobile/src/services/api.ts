export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000/api"
).replace(/\/$/, "");

export async function checkBackend(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API_URL}/health/`, {
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`Backend returned HTTP ${response.status}.`);
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("service" in data) ||
      data.service !== "outloud-api"
    ) {
      throw new Error("The address did not return the OutLoud API.");
    }
    return "Connected to OutLoud backend";
  } finally {
    clearTimeout(timeout);
  }
}
