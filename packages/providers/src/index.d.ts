import { type ProviderId } from "@unclecode/contracts";
import { ProviderCapabilityMismatchError } from "./errors.js";
import { assertProviderCapability } from "./model-registry.js";
import { resolveOpenAIAuth } from "./openai-auth.js";
import { formatOpenAIAuthStatus, resolveOpenAIAuthStatus } from "./openai-status.js";
export type { ModelRegistry, OpenAIAuthStatus, ResolveOpenAIAuthInput, ResolvedOpenAIAuth } from "./types.js";
export { ProviderCapabilityMismatchError };
export declare const PROVIDERS_SUPPORTED_IDS: readonly ["anthropic", "gemini", "openai", "groq", "ollama", "copilot", "zai"];
export declare function getProviderAdapter(providerId: ProviderId): {
    providerId: "openai";
    getModelRegistry(env?: NodeJS.ProcessEnv): import("./types.js").ModelRegistry;
    assertCapability(capability: Parameters<typeof assertProviderCapability>[1], options: {
        modelId: string;
    }): void;
};
export { formatOpenAIAuthStatus, resolveOpenAIAuth, resolveOpenAIAuthStatus };
//# sourceMappingURL=index.d.ts.map