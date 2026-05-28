/**
 * opencode (Go) CLI adapter — spawns `opencode run --model <m> <task>`.
 * Plain-text stdout becomes the submission. Tests inject `executor` + `which`.
 */

import type { WorkerSpec } from "@unclecode/contracts";

import type { LaneAdapter, LanePreflight, LaneRunContext, LaneRunResult } from "./lane-adapter.js";
import { defaultCliExecutor, defaultWhich, type CliExecutor, type WhichFn } from "./cli-exec.js";
import { applySystemPrefix } from "./system-prefix.js";

const OPENCODE_LANE_ID = "opencode" as const;
const OPENCODE_BINARY = "opencode";
// opencode requires `provider/model` format per `opencode run --help`.
// "anthropic/claude-sonnet-4-6" is a safe default since most opencode
// installations have anthropic provider preconfigured. Override per-lane
// with `--lanes opencode:deepseek/deepseek-chat` etc.
const OPENCODE_DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

export type CreateOpencodeAdapterArgs = {
  readonly executor?: CliExecutor;
  readonly which?: WhichFn;
  readonly binary?: string;
};

export function createOpencodeAdapter(args: CreateOpencodeAdapterArgs = {}): LaneAdapter {
  const executor = args.executor ?? defaultCliExecutor;
  const which = args.which ?? defaultWhich;
  const binary = args.binary ?? OPENCODE_BINARY;

  return {
    id: OPENCODE_LANE_ID,
    preflight(_env): LanePreflight {
      if (which(binary) === null) {
        return {
          status: "missing",
          reason: `opencode lane requires \`${binary}\` on PATH (see https://opencode.ai)`,
        };
      }
      return { status: "ok" };
    },
    async run(spec: WorkerSpec, ctx: LaneRunContext): Promise<LaneRunResult> {
      if (which(binary) === null) {
        throw new Error(
          `opencode lane requires \`${binary}\` on PATH — refusing to dispatch worker ${spec.workerId}`,
        );
      }
      const model = spec.model?.trim() || OPENCODE_DEFAULT_MODEL;
      const prompt = applySystemPrefix(ctx.systemPrompt, spec.task);
      const cliArgs: string[] = ["run", "--model", model, prompt];

      const execOptions: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs?: number } = {
        cwd: ctx.cwd,
        env: ctx.env as NodeJS.ProcessEnv,
      };
      if (ctx.timeoutMs !== undefined) execOptions.timeoutMs = ctx.timeoutMs;

      const result = await executor(binary, cliArgs, execOptions);

      if (result.timedOut) {
        throw new Error(`opencode lane worker ${spec.workerId} timed out after ${ctx.timeoutMs}ms`);
      }

      if (result.exitCode !== 0) {
        const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
        return { ok: false, submission: detail };
      }
      const submission = result.stdout.trim();
      if (submission.length === 0) {
        return {
          ok: false,
          submission: `opencode run exited 0 but produced no output${result.stderr.trim() ? `: ${result.stderr.trim()}` : ""}`,
        };
      }
      return { ok: true, submission };
    },
  };
}
