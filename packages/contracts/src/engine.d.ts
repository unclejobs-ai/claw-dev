import type { JsonObject } from "./json.js";
export declare const SESSION_STATES: readonly ["idle", "running", "requires_action"];
export type SessionState = (typeof SESSION_STATES)[number];
export declare const BACKGROUND_TASK_TYPES: readonly ["local_bash", "local_agent", "remote_agent", "in_process_teammate", "local_workflow", "monitor_mcp", "dream"];
export type BackgroundTaskType = (typeof BACKGROUND_TASK_TYPES)[number];
export declare const BACKGROUND_TASK_STATUSES: readonly ["pending", "running", "completed", "failed", "killed"];
export type BackgroundTaskStatus = (typeof BACKGROUND_TASK_STATUSES)[number];
export declare const BACKGROUND_TASK_TERMINAL_STATUSES: readonly ["completed", "failed", "killed"];
export type BackgroundTaskTerminalStatus = (typeof BACKGROUND_TASK_TERMINAL_STATUSES)[number];
export declare const ENGINE_WORKFLOW_PHASE_STATUSES: readonly ["pending", "running", "completed", "failed"];
export type EngineWorkflowPhaseStatus = (typeof ENGINE_WORKFLOW_PHASE_STATUSES)[number];
export declare const ENGINE_EVENT_TYPES: readonly ["task.started", "task.progress", "task.terminated", "session.state_changed"];
export type EngineEventType = (typeof ENGINE_EVENT_TYPES)[number];
export type EngineUsage = {
    readonly totalTokens: number;
    readonly toolUses: number;
    readonly durationMs: number;
};
export type SessionPendingAction = {
    readonly toolName: string;
    readonly actionDescription: string;
    readonly toolUseId: string;
    readonly requestId: string;
    readonly input?: JsonObject;
};
export type EngineWorkflowProgress = {
    readonly kind: string;
    readonly index: number;
    readonly phaseIndex?: number;
    readonly status: EngineWorkflowPhaseStatus;
    readonly label?: string;
    readonly detail?: string;
};
export type BackgroundTaskSnapshot = {
    readonly id: string;
    readonly type: BackgroundTaskType;
    readonly status: BackgroundTaskStatus;
    readonly description: string;
    readonly toolUseId?: string;
    readonly startTime: number;
    readonly endTime?: number;
    readonly totalPausedMs?: number;
    readonly outputFile: string;
    readonly outputOffset: number;
    readonly notified: boolean;
};
export type TaskStartedEngineEvent = {
    readonly type: "task.started";
    readonly taskId: string;
    readonly description: string;
    readonly taskType?: BackgroundTaskType;
    readonly toolUseId?: string;
    readonly workflowName?: string;
    readonly prompt?: string;
};
export type TaskProgressEngineEvent = {
    readonly type: "task.progress";
    readonly taskId: string;
    readonly description: string;
    readonly toolUseId?: string;
    readonly usage: EngineUsage;
    readonly lastToolName?: string;
    readonly summary?: string;
    readonly workflowProgress?: readonly EngineWorkflowProgress[];
};
export type TaskTerminatedEngineEvent = {
    readonly type: "task.terminated";
    readonly taskId: string;
    readonly status: BackgroundTaskTerminalStatus;
    readonly outputFile: string;
    readonly summary: string;
    readonly toolUseId?: string;
    readonly usage?: EngineUsage;
};
export type SessionStateChangedEngineEvent = {
    readonly type: "session.state_changed";
    readonly state: SessionState;
    readonly details?: SessionPendingAction;
};
export type EngineEvent = TaskStartedEngineEvent | TaskProgressEngineEvent | TaskTerminatedEngineEvent | SessionStateChangedEngineEvent;
//# sourceMappingURL=engine.d.ts.map