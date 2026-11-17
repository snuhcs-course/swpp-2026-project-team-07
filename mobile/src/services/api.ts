// AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
// Attribution/review scope: https://github.com/snuhcs-course/swpp-2026-project-team-07/blob/42c2154a54e209f4c9e931fd4db5777d6816c3d6/docs/history/ai-collaboration-validation-iteration-1-retired-2026-10-09.md#ai-code-markers
import { API_URL } from './apiConfig';
import { backendFetch as fetch } from './backendFetch';
export { API_URL } from './apiConfig';

export async function checkBackend(apiUrl = API_URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/health/`, {
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
