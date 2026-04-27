/**
 * SSOT (Single Source of Truth) primitives for cross-agent claim citation.
 *
 * Every fact category has a canonical owner. Claims must cite (key, versionHash) pairs
 * from those owners; CAS writes use prevTipHash; checkpoint logs are sha256-chained.
 * Anti-silo, anti-hallucination foundation for team-mode multi-agent coordination.
 */

export const SSOT_CATEGORIES = [
  "code",
  "checkpoint",
  "worker_message",
  "context_packet",
  "review",
  "credential",
  "policy_decision",
  "workspace_guidance",
  "session_metadata",
  "mmbridge_session",
  "memory_observation",
  "external_doc",
] as const;

export type SsotCategory = (typeof SSOT_CATEGORIES)[number];

export type VersionedRef = {
  readonly category: SsotCategory;
  readonly key: string;
  readonly versionHash: string;
  readonly retrievedAt: number;
};

export type Citation = VersionedRef & {
  readonly snippet?: string;
};

export type CitedClaim = {
  readonly claim: string;
  readonly citations: ReadonlyArray<Citation>;
};

export type DivergenceReport = {
  readonly category: SsotCategory;
  readonly key: string;
  readonly conflictingHashes: ReadonlyArray<{
    readonly versionHash: string;
    readonly citedBy: string;
    readonly citedAtStep?: number;
  }>;
};

export type ChainVerificationResult = {
  readonly ok: boolean;
  readonly verifiedLines: number;
  readonly brokenAt?: number;
  readonly expectedHash?: string;
  readonly actualHash?: string;
};
