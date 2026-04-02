export class ProviderCapabilityMismatchError extends Error {
    code = "PROVIDER_CAPABILITY_MISMATCH";
    providerId;
    requiredCapability;
    modelId;
    constructor(options) {
        super(`Provider ${options.providerId} does not support capability ${options.requiredCapability} for model ${options.modelId}`);
        this.name = "ProviderCapabilityMismatchError";
        this.providerId = options.providerId;
        this.requiredCapability = options.requiredCapability;
        this.modelId = options.modelId;
    }
}
//# sourceMappingURL=errors.js.map