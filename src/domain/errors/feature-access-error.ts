export class FeatureAccessError extends Error {
  constructor(
    public readonly featureName: string,
    public readonly upgradeUrl?: string
  ) {
    super(`Feature "${featureName}" requires premium`);
    this.name = "FeatureAccessError";
  }
}

