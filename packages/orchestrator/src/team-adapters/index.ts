/**
 * LaneAdapter registry — maps TeamLaneRuntime → LaneAdapter. Each entry is
 * a stub until the matching step in the multi-runtime plan replaces it
 * with a real implementation (steps 4-9).
 */

import { TEAM_LANE_RUNTIMES, type TeamLaneRuntime } from "@unclecode/contracts";

import type { LaneAdapter } from "./lane-adapter.js";
import { createCodexCliAdapter } from "./codex-cli-adapter.js";
import { createCursorAdapter } from "./cursor-adapter.js";
import { createGlmAdapter } from "./glm-adapter.js";
import { createHermesAdapter } from "./hermes-adapter.js";
import { createOpencodeAdapter } from "./opencode-adapter.js";
import { createSdkAdapter, type SdkLaneRuntime } from "./sdk-adapter.js";
import { createStubAdapter } from "./stub-adapter.js";

const SDK_RUNTIMES: ReadonlySet<TeamLaneRuntime> = new Set(["openai", "anthropic", "gemini"]);

function buildInitialAdapter(id: TeamLaneRuntime): LaneAdapter {
  if (SDK_RUNTIMES.has(id)) {
    return createSdkAdapter({ id: id as SdkLaneRuntime });
  }
  if (id === "cursor") {
    return createCursorAdapter();
  }
  if (id === "codex") {
    return createCodexCliAdapter();
  }
  if (id === "opencode") {
    return createOpencodeAdapter();
  }
  if (id === "glm") {
    return createGlmAdapter();
  }
  if (id === "hermes") {
    return createHermesAdapter();
  }
  return createStubAdapter(id);
}

const REGISTRY = new Map<TeamLaneRuntime, LaneAdapter>(
  TEAM_LANE_RUNTIMES.map((id) => [id, buildInitialAdapter(id)]),
);

export function registerLaneAdapter(adapter: LaneAdapter): void {
  REGISTRY.set(adapter.id, adapter);
}

export function getLaneAdapter(id: string): LaneAdapter {
  const adapter = REGISTRY.get(id as TeamLaneRuntime);
  if (!adapter) {
    throw new Error(
      `unknown lane runtime "${id}". valid: ${TEAM_LANE_RUNTIMES.join(", ")}`,
    );
  }
  return adapter;
}

export function listLaneAdapters(): readonly LaneAdapter[] {
  return TEAM_LANE_RUNTIMES.map((id) => {
    const adapter = REGISTRY.get(id);
    if (!adapter) {
      throw new Error(`lane registry corrupted: missing ${id}`);
    }
    return adapter;
  });
}

export type { LaneAdapter, LanePreflight, LaneRunContext, LaneRunResult } from "./lane-adapter.js";
export { createSdkAdapter } from "./sdk-adapter.js";
export type { CreateSdkAdapterArgs, SdkLaneRuntime, SdkProviderFactory, SdkProviderFactoryArgs } from "./sdk-adapter.js";
export { createCursorAdapter } from "./cursor-adapter.js";
export type {
  CreateCursorAdapterArgs,
  CursorPromptFn,
  CursorPromptOptions,
  CursorPromptResult,
} from "./cursor-adapter.js";
export { createCodexCliAdapter } from "./codex-cli-adapter.js";
export type { CreateCodexCliAdapterArgs } from "./codex-cli-adapter.js";
export { createOpencodeAdapter } from "./opencode-adapter.js";
export type { CreateOpencodeAdapterArgs } from "./opencode-adapter.js";
export { createGlmAdapter } from "./glm-adapter.js";
export type {
  CreateGlmAdapterArgs,
  GlmFetchFn,
  GlmFetchInit,
  GlmFetchResponse,
} from "./glm-adapter.js";
export { createHermesAdapter } from "./hermes-adapter.js";
export type { CreateHermesAdapterArgs } from "./hermes-adapter.js";
export { runLaneDoctor } from "./doctor.js";
export type { LaneDoctorInput, LaneDoctorLaneReport, LaneDoctorReport } from "./doctor.js";
export { applySystemPrefix } from "./system-prefix.js";
export {
  defaultCliExecutor,
  defaultWhich,
  type CliExecOptions,
  type CliExecResult,
  type CliExecutor,
  type WhichFn,
} from "./cli-exec.js";
