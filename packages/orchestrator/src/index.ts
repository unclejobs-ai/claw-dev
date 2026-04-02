import { BACKGROUND_TASK_TYPES } from "@unclecode/contracts";

export interface OrchestratorBoundary {
  readonly boundaryId: "workspace-scaffold";
}

export const ORCHESTRATOR_TASK_TYPES = BACKGROUND_TASK_TYPES;
