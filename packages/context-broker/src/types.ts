import type { ModeProfileId } from "@unclecode/contracts";

/** A single file entry in the repo map */
export type RepoMapEntry = {
  readonly path: string;
  readonly lastModified: string;
  readonly lineCount: number;
  readonly changeFrequency: number;
  readonly hotspotScore: number;
};

/** Complete repo map */
export type RepoMap = {
  readonly rootDir: string;
  readonly generatedAt: string;
  readonly gitHeadSha: string;
  readonly entries: readonly RepoMapEntry[];
  readonly totalFiles: number;
  readonly totalLines: number;
};

/** Freshness check result */
export type FreshnessStatus = "fresh" | "stale" | "unknown";

export type FreshnessResult = {
  readonly status: FreshnessStatus;
  readonly checkedAt: string;
  readonly gitHeadSha: string;
  readonly packetSha: string;
  readonly modifiedPaths: readonly string[];
};

/** Token budget configuration per mode */
export type TokenBudget = {
  readonly maxTokens: number;
  readonly reservedForTools: number;
  readonly reservedForSystem: number;
};

export type PolicySignal =
  | "dependency-manifest-change"
  | "provider-auth-surface"
  | "runtime-surface"
  | "mcp-surface"
  | "policy-surface"
  | "secret-surface";

/** Provenance metadata for a context packet */
export type ContextPacketProvenance = {
  readonly mode: ModeProfileId;
  readonly sessionId?: string;
  readonly trigger: "auto" | "manual" | "research";
};

/** A context packet assembled for the orchestrator */
export type ContextPacket = {
  readonly id: string;
  readonly generatedAt: string;
  readonly gitHeadSha: string;
  readonly worktreeFingerprint: string;
  readonly repoMap: RepoMap;
  readonly hotspots: readonly RepoMapEntry[];
  readonly changedFiles: readonly string[];
  readonly policySignals: readonly PolicySignal[];
  readonly includedContents: ReadonlyMap<string, string>;
  readonly tokenEstimate: number;
  readonly tokenBudget: TokenBudget;
  readonly freshness: FreshnessResult;
  readonly provenance: ContextPacketProvenance;
};

/** Options for assembling a context packet */
export type AssembleOptions = {
  readonly rootDir: string;
  readonly mode: ModeProfileId;
  readonly sinceSha?: string;
  readonly sessionId?: string;
  readonly trigger?: "auto" | "manual" | "research";
};

/** Research bundle for research mode */
export type ResearchBundle = {
  readonly packet: ContextPacket;
  readonly relatedMemories: readonly {
    readonly memoryId: string;
    readonly content: string;
  }[];
  readonly hypotheses: readonly string[];
  readonly artifactsDir: string;
};

/** Options for preparing a research bundle */
export type ResearchBundleOptions = {
  readonly rootDir: string;
  readonly sessionId?: string;
  readonly relatedMemories?: readonly {
    readonly memoryId: string;
    readonly content: string;
  }[];
  readonly hypotheses?: readonly string[];
  readonly artifactsDir: string;
};

export class ContextBrokerError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ContextBrokerError";
  }
}

export class GitCommandError extends ContextBrokerError {
  public readonly command: readonly string[];

  public constructor(command: readonly string[], options?: ErrorOptions) {
    super(`Git command failed: ${command.join(" ")}`, options);
    this.name = "GitCommandError";
    this.command = command;
  }
}

export class FreshnessCheckError extends ContextBrokerError {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FreshnessCheckError";
  }
}
