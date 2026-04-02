export class ProviderCapabilityMismatchError extends Error {
  public readonly code = "PROVIDER_CAPABILITY_MISMATCH";
  public readonly providerId: string;
  public readonly requiredCapability: string;
  public readonly modelId: string;

  public constructor(options: {
    providerId: string;
    requiredCapability: string;
    modelId: string;
  }) {
    super(
      `Provider ${options.providerId} does not support capability ${options.requiredCapability} for model ${options.modelId}`,
    );
    this.name = "ProviderCapabilityMismatchError";
    this.providerId = options.providerId;
    this.requiredCapability = options.requiredCapability;
    this.modelId = options.modelId;
  }
}
