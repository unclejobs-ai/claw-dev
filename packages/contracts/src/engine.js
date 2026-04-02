export const SESSION_STATES = ["idle", "running", "requires_action"];
export const BACKGROUND_TASK_TYPES = [
    "local_bash",
    "local_agent",
    "remote_agent",
    "in_process_teammate",
    "local_workflow",
    "monitor_mcp",
    "dream",
];
export const BACKGROUND_TASK_STATUSES = [
    "pending",
    "running",
    "completed",
    "failed",
    "killed",
];
export const BACKGROUND_TASK_TERMINAL_STATUSES = [
    "completed",
    "failed",
    "killed",
];
export const ENGINE_WORKFLOW_PHASE_STATUSES = [
    "pending",
    "running",
    "completed",
    "failed",
];
export const ENGINE_EVENT_TYPES = [
    "task.started",
    "task.progress",
    "task.terminated",
    "session.state_changed",
];
//# sourceMappingURL=engine.js.map