import { PROVIDER_IDS, type ProviderId } from "@unclecode/contracts";
import { ProviderCapabilityMismatchError } from "./errors.js";
import { assertProviderCapability, getOpenAIModelRegistry } from "./model-registry.js";
import { resolveOpenAIAuth } from "./openai-auth.js";
import { readOpenAICredentials, writeOpenAICredentials } from "./openai-credential-store.js";
import {
  buildOpenAIAuthorizationUrl,
  completeOpenAIBrowserLogin,
  completeOpenAIDeviceLogin,
  createOpenAIPkcePair,
  exchangeOpenAIAuthorizationCode,
  parseOpenAICallback,
  requestOpenAIDeviceAuthorization,
} from "./openai-oauth.js";
import { formatOpenAIAuthStatus, resolveOpenAIAuthStatus } from "./openai-status.js";
import type { ModelRegistry, OpenAIAuthStatus, ResolveOpenAIAuthInput, ResolvedOpenAIAuth } from "./types.js";
export type { ProviderId };
export type { ModelRegistry, OpenAIAuthStatus, ResolveOpenAIAuthInput, ResolvedOpenAIAuth } from "./types.js";
export { ProviderCapabilityMismatchError };
export const PROVIDERS_SUPPORTED_IDS = PROVIDER_IDS;
export function getProviderAdapter(providerId: ProviderId) {
  if (providerId !== "openai") {
    throw new Error(`Provider ${providerId} is not implemented yet.`);
  }
  return {
    providerId,
    getModelRegistry(env?: NodeJS.ProcessEnv) {
      return getOpenAIModelRegistry(env);
    },
    assertCapability(capability: Parameters<typeof assertProviderCapability>[1], options: { modelId: string }) {
      assertProviderCapability(providerId, capability, options.modelId);
    },
  };
}
export {
  buildOpenAIAuthorizationUrl,
  completeOpenAIBrowserLogin,
  completeOpenAIDeviceLogin,
  createOpenAIPkcePair,
  exchangeOpenAIAuthorizationCode,
  formatOpenAIAuthStatus,
  parseOpenAICallback,
  requestOpenAIDeviceAuthorization,
  resolveOpenAIAuth,
  resolveOpenAIAuthStatus,
  readOpenAICredentials,
  writeOpenAICredentials,
};
