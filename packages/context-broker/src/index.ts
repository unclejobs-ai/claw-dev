import { SESSION_CHECKPOINT_TYPES } from "@unclecode/contracts";

export type {
  AssembleOptions,
  ContextPacket,
  ContextPacketProvenance,
  FreshnessResult,
  FreshnessStatus,
  PolicySignal,
  RepoMap,
  RepoMapEntry,
  ResearchBundle,
  ResearchBundleOptions,
  TokenBudget,
} from "./types.js";
export { ContextBrokerError, FreshnessCheckError, GitCommandError } from "./types.js";
export { generateRepoMap } from "./repo-map.js";
export { detectHotspots, summarizeDiff } from "./hotspot.js";
export { assertFreshContext, checkFreshness } from "./freshness.js";
export { assembleContextPacket, estimateTokens, getTokenBudget } from "./context-packet.js";
export { prepareResearchBundle } from "./research-bundle.js";

export const CONTEXT_BROKER_DEFAULT_CHECKPOINT = SESSION_CHECKPOINT_TYPES[0];
