import type { WorkShellTraceMode } from "./work-shell-engine.js";

export type WorkShellSessionSnapshotInput = {
  cwd: string;
  sessionId: string;
  model: string;
  mode: string;
  state: "running" | "idle" | "requires_action";
  summary: string;
  traceMode: WorkShellTraceMode;
};

export function createWorkShellSessionSnapshotInput(
  input: WorkShellSessionSnapshotInput,
): WorkShellSessionSnapshotInput {
  return input;
}

export async function loadWorkShellContextState(input: {
  cwd: string;
  sessionId: string;
  currentContextSummaryLines: readonly string[];
  reloadWorkspaceContext?: ((cwd: string) => Promise<readonly string[]>) | undefined;
  listProjectBridgeLines: (cwd: string) => Promise<readonly string[]>;
  listScopedMemoryLines: (input: {
    scope: "session" | "project" | "user" | "agent";
    cwd: string;
    sessionId?: string;
    agentId?: string;
  }) => Promise<readonly string[]>;
}): Promise<{
  readonly contextSummaryLines: readonly string[];
  readonly bridgeLines: readonly string[];
  readonly memoryLines: readonly string[];
}> {
  const [contextSummaryLines, bridgeLines, memoryLines] = await Promise.all([
    input.reloadWorkspaceContext
      ? input.reloadWorkspaceContext(input.cwd)
      : Promise.resolve(input.currentContextSummaryLines),
    input.listProjectBridgeLines(input.cwd),
    input.listScopedMemoryLines({
      scope: "session",
      cwd: input.cwd,
      sessionId: input.sessionId,
    }),
  ]);

  return {
    contextSummaryLines,
    bridgeLines,
    memoryLines,
  };
}
