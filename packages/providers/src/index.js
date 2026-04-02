import { PROVIDER_IDS } from "@unclecode/contracts";
import { ProviderCapabilityMismatchError } from "./errors.js";
import { assertProviderCapability, getOpenAIModelRegistry } from "./model-registry.js";
import { resolveOpenAIAuth } from "./openai-auth.js";
import { formatOpenAIAuthStatus, resolveOpenAIAuthStatus } from "./openai-status.js";
export { ProviderCapabilityMismatchError };
export const PROVIDERS_SUPPORTED_IDS = PROVIDER_IDS;
export function getProviderAdapter(providerId) {
    if (providerId !== "openai") {
        throw new Error(`Provider ${providerId} is not implemented yet.`);
    }
    return {
        providerId,
        getModelRegistry(env) {
            return getOpenAIModelRegistry(env);
        },
        assertCapability(capability, options) {
            assertProviderCapability(providerId, capability, options.modelId);
        },
    };
}
export { formatOpenAIAuthStatus, resolveOpenAIAuth, resolveOpenAIAuthStatus };
//# sourceMappingURL=index.js.map