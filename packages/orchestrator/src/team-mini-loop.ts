/**
 * Team-worker glue between the stateless `LlmProvider.query` shape (in
 * `@unclecode/providers`) and the caller-managed MiniLoopAgent loop.
 *
 * - `teamMiniLoopExecutor` resolves a `MiniLoopAction` to its ACI
 *   helper (currently: run_shell only; file/patch/search tools land in
 *   later slices).
 * - `miniLoopMessagesToProviderQuery` translates the agent's message
 *   log into the provider's wire-bound shape, generating synthetic
 *   tool-call IDs so OpenAI accepts the assistant + tool message pair.
 */

import type {
  MiniLoopAction,
  MiniLoopMessage,
  MiniLoopObservation,
} from "@unclecode/contracts";
import type { ProviderQueryMessage } from "@unclecode/providers";

import { runShell } from "./aci/run-shell.js";

export type TeamMiniLoopExecutor = {
  execute(
    action: MiniLoopAction,
    cwd: string,
  ): Promise<MiniLoopObservation>;
};

export function createTeamMiniLoopExecutor(): TeamMiniLoopExecutor {
  return {
    async execute(action, cwd) {
      if (action.tool === "run_shell") {
        const command = typeof action.input.command === "string"
          ? action.input.command
          : "";
        const result = await runShell({ command, cwd });
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          truncated: result.truncated,
        };
      }
      return {
        stdout: "",
        stderr: `Unknown tool: ${action.tool}`,
        exitCode: -1,
        truncated: false,
      };
    },
  };
}

/**
 * Convert MiniLoopAgent's message log into provider-wire messages.
 * - "exit" role messages (internal sentinels) are dropped.
 * - assistant messages followed by consecutive tool messages with the
 *   same `stepIndex` are paired into one `toolCalls[]`. Synthetic
 *   callIds derive from position so the same log always produces the
 *   same wire shape.
 */
export function miniLoopMessagesToProviderQuery(
  messages: ReadonlyArray<MiniLoopMessage>,
): ProviderQueryMessage[] {
  const out: ProviderQueryMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    const message = messages[i];
    if (!message) {
      i += 1;
      continue;
    }
    if (message.role === "exit") {
      i += 1;
      continue;
    }
    if (message.role === "system" || message.role === "user") {
      out.push({ role: message.role, content: message.content });
      i += 1;
      continue;
    }
    if (message.role === "assistant") {
      const toolMessages: Array<{ message: MiniLoopMessage; index: number }> = [];
      let scan = i + 1;
      while (scan < messages.length) {
        const next = messages[scan];
        if (!next) {
          break;
        }
        if (next.role !== "tool") {
          break;
        }
        if (
          message.stepIndex !== undefined
          && next.stepIndex !== undefined
          && next.stepIndex !== message.stepIndex
        ) {
          break;
        }
        toolMessages.push({ message: next, index: toolMessages.length });
        scan += 1;
      }
      const stepIdx = message.stepIndex ?? out.length;
      const toolCalls = toolMessages
        .filter((entry) => entry.message.action !== undefined)
        .map((entry) => {
          const action = entry.message.action!;
          return {
            callId: `step_${stepIdx}_${entry.index}`,
            name: action.tool,
            argumentsJson: JSON.stringify(action.input ?? {}),
          };
        });
      if (toolCalls.length > 0) {
        out.push({
          role: "assistant",
          content: message.content,
          toolCalls,
        });
        for (const entry of toolMessages) {
          out.push({
            role: "tool",
            content: entry.message.content,
            callId: `step_${stepIdx}_${entry.index}`,
          });
        }
        i = scan;
      } else {
        out.push({ role: "assistant", content: message.content });
        i += 1;
      }
      continue;
    }
    if (message.role === "tool") {
      // Orphan tool message (no preceding assistant). Render as user
      // observation so the model sees the data.
      out.push({
        role: "user",
        content: message.content,
      });
      i += 1;
      continue;
    }
    i += 1;
  }
  return out;
}
