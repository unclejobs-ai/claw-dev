import { createWorkShellAuthStatePatch, createWorkShellBusyStatePatch } from "./work-shell-engine-state.js";
import type { WorkShellEngineState, WorkShellPanel } from "./work-shell-engine.js";
import type { WorkShellReasoningConfig } from "./reasoning.js";

export function createPromptTurnStartPatch<Reasoning extends WorkShellReasoningConfig>(input: {
  state: WorkShellEngineState<Reasoning>;
  turnStartedAt: number;
}): Partial<WorkShellEngineState<Reasoning>> {
  return createWorkShellBusyStatePatch({
    state: input.state,
    isBusy: true,
    busyStatus: "thinking",
    currentTurnStartedAt: input.turnStartedAt,
  });
}

export function createPromptTurnSuccessPatch<Reasoning extends WorkShellReasoningConfig>(input: {
  state: WorkShellEngineState<Reasoning>;
  bridgeLines: readonly string[];
  memoryLines: readonly string[];
  lastTurnDurationMs: number;
}): Partial<WorkShellEngineState<Reasoning>> {
  return {
    bridgeLines: input.bridgeLines,
    memoryLines: input.memoryLines,
    lastTurnDurationMs: input.lastTurnDurationMs,
  };
}

export function createPromptTurnFailurePatch<Reasoning extends WorkShellReasoningConfig>(input: {
  state: WorkShellEngineState<Reasoning>;
  nextAuthLabel: string;
  lastTurnDurationMs: number;
  isAuthFailure: boolean;
  statusPanel?: WorkShellPanel | undefined;
}): Partial<WorkShellEngineState<Reasoning>> {
  return {
    ...createWorkShellAuthStatePatch({
      state: input.state,
      authLabel: input.nextAuthLabel,
    }),
    currentTurnStartedAt: undefined,
    lastTurnDurationMs: input.lastTurnDurationMs,
    ...(input.isAuthFailure && input.statusPanel
      ? { panel: input.statusPanel }
      : {}),
  };
}

export function createPromptTurnFinalizePatch<Reasoning extends WorkShellReasoningConfig>(input: {
  state: WorkShellEngineState<Reasoning>;
}): Partial<WorkShellEngineState<Reasoning>> {
  return createWorkShellBusyStatePatch({
    state: input.state,
    isBusy: false,
    clearCurrentTurnStartedAt: true,
  });
}
