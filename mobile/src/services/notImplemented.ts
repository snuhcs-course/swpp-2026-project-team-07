export class FeatureNotImplementedError extends Error {
  constructor(feature: string) {
    super(
      `${feature} is not connected yet. This build contains screen frames and sample data.`,
    );
    this.name = "FeatureNotImplementedError";
  }
}
