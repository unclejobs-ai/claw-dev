/**
 * Hermes adapter — remote-agent dispatch via the `acpx` (Agent Client
 * Protocol exec) CLI. acpx routes the prompt to a target agent subcommand
 * (claude, codex, cursor, gemini, copilot, etc.) and returns the
 * transcript on stdout.
 *
 * Argv order matters: per `acpx --help`, all top-level options (--cwd,
 * --format, --approve-all, --model, --timeout) must precede the agent
 * subcommand. Real shape:
 *
 *   acpx [top-level opts] <agent> exec [-f file] [--] <prompt>
 *
 * Required: `extras.agent` — which ACP agent to invoke. Defaults to "claude".
 * Optional: `extras.format` — "text" (default) or "json".
 *           `extras.approve` — "all" (default), "reads", or "none".
 *
 * acpx `--timeout` is in SECONDS, so we convert from LaneRunContext.timeoutMs.
 */

import type { WorkerSpec } from "@unclecode/contracts";

import type { LaneAdapter, LanePreflight, LaneRunContext, LaneRunResult } from "./lane-adapter.js";
import { defaultCliExecutor, defaultWhich, type CliExecutor, type WhichFn } from "./cli-exec.js";
import { applySystemPrefix } from "./system-prefix.js";

const HERMES_LANE_ID = "hermes" as const;
const HERMES_BINARY = "acpx";
const HERMES_DEFAULT_AGENT = "claude";
const HERMES_DEFAULT_FORMAT = "text";
const HERMES_DEFAULT_APPROVE = "all";

/**
 * Allow-list mirrors `acpx --help` agent subcommands at time of writing.
 * Keep alphabetized for diff hygiene.
 */
const ACPX_AGENTS: ReadonlySet<string> = new Set([
  "claude",
  "codex",
  "copilot",
  "cursor",
  "droid",
  "gemini",
  "iflow",
  "kilocode",
  "kimi",
  "kiro",
  "openclaw",
  "opencode",
  "pi",
  "qoder",
  "qwen",
  "trae",
]);

export type CreateHermesAdapterArgs = {
  readonly executor?: CliExecutor;
  readonly which?: WhichFn;
  readonly binary?: string;
};

export function createHermesAdapter(args: CreateHermesAdapterArgs = {}): LaneAdapter {
  const executor = args.executor ?? defaultCliExecutor;
  const which = args.which ?? defaultWhich;
  const binary = args.binary ?? HERMES_BINARY;

  return {
    id: HERMES_LANE_ID,
    preflight(_env): LanePreflight {
      if (which(binary) === null) {
        return {
          status: "missing",
          reason: `hermes lane requires \`${binary}\` on PATH (Agent Client Protocol CLI)`,
        };
      }
      return { status: "ok" };
    },
    async run(spec: WorkerSpec, ctx: LaneRunContext): Promise<LaneRunResult> {
      if (which(binary) === null) {
        throw new Error(
          `hermes lane requires \`${binary}\` on PATH — refusing to dispatch worker ${spec.workerId}`,
        );
      }
      const agent = (spec.extras?.agent ?? HERMES_DEFAULT_AGENT).trim();
      if (!ACPX_AGENTS.has(agent)) {
        throw new Error(
          `hermes lane: unknown acpx agent "${agent}". Known: ${[...ACPX_AGENTS].sort().join(", ")}`,
        );
      }
      const format = (spec.extras?.format ?? HERMES_DEFAULT_FORMAT).trim();
      const approve = (spec.extras?.approve ?? HERMES_DEFAULT_APPROVE).trim();

      // Top-level acpx options BEFORE the agent subcommand — required by
      // acpx commander.js parser (the agent-subcommand `exec` only accepts
      // `-f` and `-h`).
      const cliArgs: string[] = ["--cwd", ctx.cwd, "--format", format];
      if (approve === "all") cliArgs.push("--approve-all");
      else if (approve === "reads") cliArgs.push("--approve-reads");

      if (spec.model !== undefined && spec.model.trim().length > 0) {
        cliArgs.push("--model", spec.model.trim());
      }
      if (ctx.timeoutMs !== undefined && ctx.timeoutMs > 0) {
        const seconds = Math.max(1, Math.round(ctx.timeoutMs / 1000));
        cliArgs.push("--timeout", String(seconds));
      }

      cliArgs.push(agent, "exec", "--", applySystemPrefix(ctx.systemPrompt, spec.task));

      const execOptions: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number } = {
        cwd: ctx.cwd,
        env: ctx.env as NodeJS.ProcessEnv,
      };
      if (ctx.timeoutMs !== undefined) execOptions.timeoutMs = ctx.timeoutMs;

      const result = await executor(binary, cliArgs, execOptions);

      if (result.timedOut) {
        throw new Error(
          `hermes lane worker ${spec.workerId} timed out after ${ctx.timeoutMs}ms (acpx ${agent} exec)`,
        );
      }

      if (result.exitCode !== 0) {
        const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
        return { ok: false, submission: detail };
      }
      return { ok: true, submission: result.stdout.trim() };
    },
  };
}
