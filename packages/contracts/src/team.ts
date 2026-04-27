/**
 * Team-mode run primitives — RUN_ID-bound persistence, hash-chained checkpoints,
 * disk-backed file ownership for cross-process worker coordination.
 * Layer A (Claude Code conductor) and Layer B (peer worker CLIs) bind via
 * UNCLECODE_TEAM_RUN_ID + UNCLECODE_TEAM_RUN_ROOT env vars.
 */

import type { PersonaId, MiniLoopMessage } from "./mini-loop.js";

export const TEAM_RUN_STATUSES = [
  "started",
  "running",
  "gated",
  "accepted",
  "corrective",
  "aborted",
  "killed",
  "errored",
] as const;

export type TeamRunStatus = (typeof TEAM_RUN_STATUSES)[number];

export const TEAM_GATE_LEVELS = ["strict", "warn", "off"] as const;

export type TeamGateLevel = (typeof TEAM_GATE_LEVELS)[number];

export const TEAM_RUNTIME_MODES = ["local", "docker", "e2b"] as const;

export type TeamRuntimeMode = (typeof TEAM_RUNTIME_MODES)[number];

export type TeamRunManifest = {
  readonly runId: string;
  readonly objective: string;
  readonly persona: PersonaId;
  readonly lanes: number;
  readonly gate: TeamGateLevel;
  readonly runtime: TeamRuntimeMode;
  readonly createdAt: number;
  readonly createdBy: string;
  readonly workspaceRoot: string;
  readonly codeState?: {
    readonly headCommit?: string;
    readonly dirty: boolean;
  };
  readonly env?: Readonly<Record<string, string>>;
};

export type TeamRunCheckpoint = {
  readonly type: "team_run";
  readonly runId: string;
  readonly persona: PersonaId;
  readonly status: TeamRunStatus;
  readonly objective: string;
  readonly lanes: number;
  readonly timestamp: string;
  readonly prevTipHash: string;
  readonly lineHash?: string;
};

export type TeamStepCheckpoint = {
  readonly type: "team_step";
  readonly runId: string;
  readonly workerId: string;
  readonly stepIndex: number;
  readonly action?: {
    readonly tool: string;
    readonly argHash: string;
  };
  readonly observationHash?: string;
  readonly costUsd?: number;
  readonly timestamp: string;
  readonly prevTipHash: string;
  readonly lineHash?: string;
};

export type TeamWorkerSnapshot = {
  readonly workerId: string;
  readonly persona: PersonaId;
  readonly status: "pending" | "running" | "completed" | "failed" | "killed";
  readonly stepIndex: number;
  readonly costUsd: number;
  readonly claimedPaths: ReadonlyArray<string>;
};

export type TeamContextPacket = {
  readonly runId: string;
  readonly persona: PersonaId;
  readonly objective: string;
  readonly messages: ReadonlyArray<MiniLoopMessage>;
  readonly artifacts: ReadonlyArray<{
    readonly path: string;
    readonly sha256: string;
  }>;
  readonly gateResults: ReadonlyArray<{
    readonly gateId: string;
    readonly status: "pass" | "warn" | "fail";
    readonly summary: string;
  }>;
  readonly handoffNotes?: string;
  readonly packetId: string;
};
