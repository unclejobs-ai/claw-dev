import type { BackgroundTaskType } from "./engine.js";
import type { McpConfigScope, McpTransport } from "./mcp.js";

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
] as const;

export type TrustZone = (typeof TRUST_ZONES)[number];

export const POLICY_PERMISSION_MODES = [
  "default",
  "plan",
  "acceptEdits",
  "bypassPermissions",
  "dontAsk",
] as const;

export type PolicyPermissionMode = (typeof POLICY_PERMISSION_MODES)[number];

export const APPROVAL_INTENT_TYPES = [
  "tool_execution",
  "plan",
  "mcp_server",
  "background_task",
] as const;

export type ApprovalIntentType = (typeof APPROVAL_INTENT_TYPES)[number];

export type ApprovalIntentMetadata = {
  readonly type: ApprovalIntentType;
  readonly label: string;
  readonly trustZone: TrustZone;
  readonly requiresRequestId: boolean;
  readonly supportsMode: boolean;
};

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
} as const satisfies Readonly<Record<ApprovalIntentType, ApprovalIntentMetadata>>;

export type ToolExecutionApprovalIntent = {
  readonly type: "tool_execution";
  readonly requestId: string;
  readonly trustZone: typeof APPROVAL_INTENTS.tool_execution.trustZone;
  readonly permissionMode?: PolicyPermissionMode;
  readonly toolName: string;
  readonly actionDescription?: string;
  readonly toolUseId?: string;
  readonly reason?: string;
};

export type PlanApprovalIntent = {
  readonly type: "plan";
  readonly requestId: string;
  readonly trustZone: "session";
  readonly permissionMode?: Extract<PolicyPermissionMode, "plan" | "default">;
  readonly agentId?: string;
  readonly agentName?: string;
  readonly teamName?: string;
  readonly planModeRequired?: boolean;
};

export type McpServerApprovalIntent = {
  readonly type: "mcp_server";
  readonly requestId: string;
  readonly trustZone: typeof APPROVAL_INTENTS.mcp_server.trustZone;
  readonly serverName: string;
  readonly scope: McpConfigScope;
  readonly transport: McpTransport;
};

export type BackgroundTaskApprovalIntent = {
  readonly type: "background_task";
  readonly requestId: string;
  readonly trustZone: "session";
  readonly taskId: string;
  readonly taskType: BackgroundTaskType;
  readonly action: "kill" | "resume" | "attach";
};

export type ApprovalIntent =
  | ToolExecutionApprovalIntent
  | PlanApprovalIntent
  | McpServerApprovalIntent
  | BackgroundTaskApprovalIntent;

export const POLICY_DECISION_EFFECTS = ["allow", "prompt", "deny"] as const;

export type PolicyDecisionEffect = (typeof POLICY_DECISION_EFFECTS)[number];

export const POLICY_DECISION_SOURCES = [
  "base",
  "mode",
  "runtime",
  "userOverride",
  "sessionOverride",
  "delegation",
] as const;

export type PolicyDecisionSource = (typeof POLICY_DECISION_SOURCES)[number];

export type PolicyDecision = {
  readonly effect: PolicyDecisionEffect;
  readonly source: PolicyDecisionSource;
  readonly reason: string;
  readonly matchedRule: string;
};
