import { createConversationTurnSummary } from "./work-shell-engine-turns.js";

export type WorkShellSyntheticTraceEvent = {
  readonly type: "bridge.published" | "memory.written";
  readonly [key: string]: unknown;
};

export type WorkShellPostTurnSuccessEffectsInput = {
  cwd: string;
  transcriptText: string;
  assistantText: string;
  sessionId: string;
  currentBridgeLines: readonly string[];
  publishContextBridge: (input: {
    cwd: string;
    summary: string;
    source: string;
    target: string;
    kind: "summary" | "decision" | "fact" | "file-change" | "task-state" | "warning";
  }) => Promise<{ bridgeId: string; line: string }>;
  writeScopedMemory: (input: {
    scope: "session" | "project" | "user" | "agent";
    cwd: string;
    summary: string;
    sessionId?: string;
    agentId?: string;
  }) => Promise<{ memoryId: string }>;
  listScopedMemoryLines: (input: {
    scope: "session" | "project" | "user" | "agent";
    cwd: string;
    sessionId?: string;
    agentId?: string;
  }) => Promise<readonly string[]>;
};

export type WorkShellPostTurnSuccessEffectsResult = {
  readonly bridgeLines: readonly string[];
  readonly memoryLines: readonly string[];
  readonly bridgeSummary: string;
  readonly memorySummary: string;
  readonly bridgeTraceEvent: WorkShellSyntheticTraceEvent;
  readonly memoryTraceEvent: WorkShellSyntheticTraceEvent;
};

export function isWorkShellAuthFailure(message: string): boolean {
  return /request failed with status 401/i.test(message);
}

export async function resolveWorkShellFailureAuthLabel(input: {
  message: string;
  currentAuthLabel: string;
  refreshAuthState?: (() => Promise<{ authLabel: string; authIssueLines?: readonly string[] }>) | undefined;
  applyAuthIssueLines?: ((authIssueLines?: readonly string[]) => void) | undefined;
}): Promise<string> {
  if (!isWorkShellAuthFailure(input.message) || !input.refreshAuthState) {
    return input.currentAuthLabel;
  }

  try {
    const refreshed = await input.refreshAuthState();
    input.applyAuthIssueLines?.(refreshed.authIssueLines);
    return refreshed.authLabel;
  } catch {
    return input.currentAuthLabel;
  }
}

export async function runWorkShellPostTurnSuccessEffects(
  input: WorkShellPostTurnSuccessEffectsInput,
): Promise<WorkShellPostTurnSuccessEffectsResult> {
  const summary = createConversationTurnSummary({
    transcriptText: input.transcriptText,
    assistantText: input.assistantText,
  });
  const bridge = await input.publishContextBridge({
    cwd: input.cwd,
    summary,
    source: "work-shell",
    target: "project-context",
    kind: "summary",
  });
  const memory = await input.writeScopedMemory({
    scope: "session",
    cwd: input.cwd,
    summary,
    sessionId: input.sessionId,
    agentId: "work-shell",
  });
  const memoryLines = await input.listScopedMemoryLines({
    scope: "session",
    cwd: input.cwd,
    sessionId: input.sessionId,
  });

  return {
    bridgeLines: [bridge.line, ...input.currentBridgeLines].slice(0, 6),
    memoryLines,
    bridgeSummary: summary,
    memorySummary: summary,
    bridgeTraceEvent: {
      type: "bridge.published",
      level: "high-signal",
      bridgeId: bridge.bridgeId,
      scope: "project",
      kind: "summary",
      summary,
      source: "work-shell",
      target: "project-context",
    },
    memoryTraceEvent: {
      type: "memory.written",
      level: "high-signal",
      memoryId: memory.memoryId,
      scope: "session",
      summary,
    },
  };
}
