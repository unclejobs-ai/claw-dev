import { createWorkShellBusyStatePatch } from "./work-shell-engine-state.js";
import type { WorkShellChatEntry, WorkShellEngineState } from "./work-shell-engine.js";
import type { WorkShellReasoningConfig } from "./reasoning.js";

export function resolveBusyStatusFromTraceEvent(
  event: { readonly type: string; readonly status?: string },
  line: string,
): string | null | undefined {
  if (event.type === "turn.completed") {
    return undefined;
  }

  if (
    event.type === "turn.started"
    || event.type === "provider.calling"
    || event.type === "tool.started"
    || (event.type === "orchestrator.step" && event.status === "running")
  ) {
    return line || "thinking";
  }

  return null;
}

export function resolveTraceEntryRole(event: { readonly type: string }): "system" | "tool" {
  return event.type === "turn.started" || event.type === "turn.completed"
    ? "system"
    : "tool";
}

export function extractCurrentTurnStartedAt(event: { readonly type: string; readonly startedAt?: unknown }): number | undefined {
  return event.type === "turn.started" && typeof event.startedAt === "number"
    ? event.startedAt
    : undefined;
}

export function createTraceEventBusyPatch<Reasoning extends WorkShellReasoningConfig>(input: {
  state: WorkShellEngineState<Reasoning>;
  event: { readonly type: string; readonly status?: string; readonly startedAt?: unknown };
  line: string;
}): Partial<WorkShellEngineState<Reasoning>> | undefined {
  const busyStatus = resolveBusyStatusFromTraceEvent(input.event, input.line);
  if (busyStatus === null) {
    return undefined;
  }

  const currentTurnStartedAt = extractCurrentTurnStartedAt(input.event);
  return createWorkShellBusyStatePatch({
    state: input.state,
    isBusy: input.state.isBusy,
    ...(busyStatus ? { busyStatus } : {}),
    ...(currentTurnStartedAt !== undefined ? { currentTurnStartedAt } : {}),
    ...(input.event.type === "turn.completed"
      ? { clearCurrentTurnStartedAt: true }
      : {}),
  });
}

export function resolveVerboseTraceEntry(input: {
  traceMode: "minimal" | "verbose";
  event: { readonly type: string };
  line: string;
}): WorkShellChatEntry | undefined {
  if (input.traceMode !== "verbose" || !input.line) {
    return undefined;
  }

  return {
    role: resolveTraceEntryRole(input.event),
    text: input.line,
  };
}

export function applyWorkShellTraceEvent<
  Reasoning extends WorkShellReasoningConfig,
  TraceEvent extends { readonly type: string },
>(input: {
  state: WorkShellEngineState<Reasoning>;
  event: TraceEvent;
  formatAgentTraceLine: (event: TraceEvent) => string;
  setState: (patch: Partial<WorkShellEngineState<Reasoning>>) => void;
  appendEntries: (...entries: readonly WorkShellChatEntry[]) => void;
  pushTraceLine: (line: string) => void;
}): void {
  const line = input.formatAgentTraceLine(input.event);
  const busyPatch = createTraceEventBusyPatch({
    state: input.state,
    event: input.event,
    line,
  });
  if (busyPatch) {
    input.setState(busyPatch);
  }

  const traceEntry = resolveVerboseTraceEntry({
    traceMode: input.state.traceMode,
    event: input.event,
    line,
  });
  if (!traceEntry) {
    return;
  }

  input.appendEntries(traceEntry);
  input.pushTraceLine(line);
}
