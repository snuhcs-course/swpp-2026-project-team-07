// AI-generated/modified with OpenAI Codex, Iteration 1 (2026-09-26 to 2026-10-09).
// Attribution/review scope: docs/ai-collaboration-validation-iteration-1.md#ai-code-markers
export class FeatureNotImplementedError extends Error {
  constructor(feature: string) {
    super(
      `${feature} is not connected yet. This build contains screen frames and sample data.`,
    );
    this.name = "FeatureNotImplementedError";
  }
}
