/**
 * Memory bus contracts — Honcho peer model + mem0 vector/graph + Walnut reflections
 * + claude-mem episodic + context7 external docs. Multi-agent shared substrate
 * (LinkedIn CMA pattern). Every memory result is SSOT-cited via VersionedRef.
 */

import type { PersonaId } from "./mini-loop.js";
import type { Citation, VersionedRef } from "./ssot.js";

export const PEER_KINDS = ["user", "agent", "team", "run"] as const;

export type PeerKind = (typeof PEER_KINDS)[number];

export type Peer =
  | { readonly kind: "user"; readonly id: string }
  | { readonly kind: "agent"; readonly persona: PersonaId }
  | { readonly kind: "team"; readonly runId: string }
  | { readonly kind: "run"; readonly runId: string };

export const MEMORY_CATEGORIES = [
  "episodic",
  "semantic",
  "procedural",
  "external_doc",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type MemoryQuery = {
  readonly asker: Peer;
  readonly about?: Peer;
  readonly category: MemoryCategory;
  readonly query: string;
  readonly budget?: {
    readonly tokens: number;
    readonly latencyMs: number;
  };
};

export type Observation = {
  readonly id: string;
  readonly peer: Peer;
  readonly category: MemoryCategory;
  readonly content: string;
  readonly recordedAt: number;
  readonly sourceStepRef?: VersionedRef;
  readonly tags?: ReadonlyArray<string>;
};

export type MemoryResult = {
  readonly citations: ReadonlyArray<Citation>;
  readonly synthesized?: string;
  readonly rawObservations?: ReadonlyArray<Observation>;
  readonly retrievalHash: string;
};

export type DeriverInput = {
  readonly peer: Peer;
  readonly stepIndex: number;
  readonly action?: {
    readonly tool: string;
    readonly input: Record<string, unknown>;
  };
  readonly observation?: {
    readonly stdout: string;
    readonly exitCode: number;
  };
  readonly sourceStepRef: VersionedRef;
};

export type ReflectionResult = {
  readonly runId: string;
  readonly successPatterns: ReadonlyArray<string>;
  readonly failurePatterns: ReadonlyArray<string>;
  readonly userInsights: ReadonlyArray<string>;
  readonly codebaseInsights: ReadonlyArray<string>;
  readonly generatedAt: number;
};
