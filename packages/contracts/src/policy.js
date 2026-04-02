export const TRUST_ZONES = [
    "workspace",
    "session",
    "local",
    "project",
    "user",
    "enterprise",
    "managed",
    "dynamic",
    "claudeai",
];
export const POLICY_PERMISSION_MODES = [
    "default",
    "plan",
    "acceptEdits",
    "bypassPermissions",
    "dontAsk",
];
export const APPROVAL_INTENT_TYPES = [
    "tool_execution",
    "plan",
    "mcp_server",
    "background_task",
];
export const APPROVAL_INTENTS = {
    tool_execution: {
        type: "tool_execution",
        label: "Tool execution approval",
        trustZone: "workspace",
        requiresRequestId: true,
        supportsMode: true,
    },
    plan: {
        type: "plan",
        label: "Plan approval",
        trustZone: "session",
        requiresRequestId: true,
        supportsMode: true,
    },
    mcp_server: {
        type: "mcp_server",
        label: "MCP server approval",
        trustZone: "project",
        requiresRequestId: true,
        supportsMode: false,
    },
    background_task: {
        type: "background_task",
        label: "Background task approval",
        trustZone: "session",
        requiresRequestId: true,
        supportsMode: false,
    },
};
//# sourceMappingURL=policy.js.map