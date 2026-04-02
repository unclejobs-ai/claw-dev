export declare class ProviderCapabilityMismatchError extends Error {
    readonly code = "PROVIDER_CAPABILITY_MISMATCH";
    readonly providerId: string;
    readonly requiredCapability: string;
    readonly modelId: string;
    constructor(options: {
        providerId: string;
        requiredCapability: string;
        modelId: string;
    });
}
//# sourceMappingURL=errors.d.ts.map