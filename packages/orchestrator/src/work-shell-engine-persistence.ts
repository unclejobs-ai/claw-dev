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
