/**
 * Collapse old tool observations down to a 1-line summary so context stays
 * informative-but-concise (SWE-agent ACI principle, NeurIPS 2024).
 *
 * - Last `keepFull` tool observations remain verbatim.
 * - Earlier tool observations get collapsed to a single line that records
 *   the tool name, exit code, and stdout/stderr length so cite chains hold.
 * - Already-collapsed messages pass through unchanged.
 * - Non-tool messages (system/user/assistant/exit) are never modified.
 */

import type { MiniLoopMessage } from "@unclecode/contracts";

const COLLAPSE_PREFIX = "Output collapsed for brevity";

export function collapseOlderObservations(
  messages: ReadonlyArray<MiniLoopMessage>,
  keepFull = 5,
): MiniLoopMessage[] {
  let totalTools = 0;
  for (const message of messages) {
    if (message.role === "tool") totalTools += 1;
  }
  if (totalTools <= keepFull) {
    return messages.slice();
  }
  const collapseLimit = totalTools - keepFull;
  let seenTools = 0;
  return messages.map((message) => {
    if (message.role !== "tool" || message.collapsed) return message;
    seenTools += 1;
    if (seenTools <= collapseLimit) return collapseMessage(message);
    return message;
  });
}

function collapseMessage(message: MiniLoopMessage): MiniLoopMessage {
  const stdoutLength = message.observation?.stdout.length ?? 0;
  const stderrLength = message.observation?.stderr.length ?? 0;
  const exitCode = message.observation?.exitCode ?? 0;
  const tool = message.action?.tool ?? "tool";
  const summary = `${COLLAPSE_PREFIX} (tool=${tool} exit=${exitCode} stdout=${stdoutLength}B stderr=${stderrLength}B)`;
  return {
    ...message,
    content: summary,
    collapsed: true,
  };
}
