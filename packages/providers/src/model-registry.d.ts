import { type ProviderId } from "@unclecode/contracts";
import type { ModelRegistry, ProviderCapabilityName } from "./types.js";
export declare function getOpenAIModelRegistry(env?: NodeJS.ProcessEnv): ModelRegistry;
export declare function assertProviderCapability(providerId: ProviderId, capability: ProviderCapabilityName, modelId: string): void;
//# sourceMappingURL=model-registry.d.ts.map