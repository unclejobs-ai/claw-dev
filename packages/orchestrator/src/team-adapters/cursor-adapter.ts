/**
 * Cursor adapter — in-process driver for `@cursor/sdk` Agent.prompt(). The
 * package is an optional peer dep; we lazy-import only when this adapter
 * actually dispatches, so users who never enable a cursor lane don't pay
 * the native-sqlite installation cost.
 *
 * Tests inject `promptFn` to avoid pulling in the real SDK.
 */

import type { WorkerSpec } from "@unclecode/contracts";

import type { LaneAdapter, LanePreflight, LaneRunContext, LaneRunResult } from "./lane-adapter.js";
import { applySystemPrefix } from "./system-prefix.js";

const CURSOR_ENV_NAME = "CURSOR_API_KEY";
const CURSOR_DEFAULT_MODEL = "composer-2.5";
const CURSOR_LANE_ID = "cursor" as const;

export type CursorPromptOptions = {
  readonly apiKey: string;
  readonly model: { readonly id: string };
  readonly local: { readonly cwd: string };
};

export type CursorPromptResult = {
  readonly status?: string;
  readonly result?: string;
};

export type CursorPromptFn = (
  message: string,
  options: CursorPromptOptions,
) => Promise<CursorPromptResult>;

export type CreateCursorAdapterArgs = {
  readonly promptFn?: CursorPromptFn;
};

async function loadCursorPromptFn(): Promise<CursorPromptFn> {
  // Specifier captured in a variable so TypeScript treats the dynamic import
  // as an unresolved runtime lookup — required because @cursor/sdk is an
  // optional peer dep that may not be installed.
  const specifier = "@cursor/sdk";
  try {
    const sdk = (await import(specifier)) as {
      Agent?: { prompt?: CursorPromptFn };
    };
    if (typeof sdk.Agent?.prompt !== "function") {
      throw new Error("@cursor/sdk loaded but Agent.prompt is not callable");
    }
    return sdk.Agent.prompt.bind(sdk.Agent);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `cursor lane requires @cursor/sdk — install it as an optional dep (${reason})`,
    );
  }
}

async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  label: string,
): Promise<T> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return promise;
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function createCursorAdapter(args: CreateCursorAdapterArgs = {}): LaneAdapter {
  return {
    id: CURSOR_LANE_ID,
    preflight(env): LanePreflight {
      const value = env[CURSOR_ENV_NAME];
      if (value === undefined || value.trim().length === 0) {
        return {
          status: "missing",
          reason: `cursor lane requires ${CURSOR_ENV_NAME} (currently unset)`,
        };
      }
      return { status: "ok" };
    },
    async run(spec: WorkerSpec, ctx: LaneRunContext): Promise<LaneRunResult> {
      const apiKey = ctx.env[CURSOR_ENV_NAME]?.trim();
      if (!apiKey) {
        throw new Error(
          `cursor lane requires ${CURSOR_ENV_NAME} — refusing to dispatch worker ${spec.workerId}`,
        );
      }
      const promptFn = args.promptFn ?? (await loadCursorPromptFn());
      const modelId = spec.model?.trim() || CURSOR_DEFAULT_MODEL;
      const prompt = applySystemPrefix(ctx.systemPrompt, spec.task);

      const response = await runWithTimeout(
        promptFn(prompt, {
          apiKey,
          model: { id: modelId },
          local: { cwd: ctx.cwd },
        }),
        ctx.timeoutMs,
        `cursor lane worker ${spec.workerId}`,
      );

      const submission = typeof response.result === "string" ? response.result : "";
      return {
        ok: response.status === "finished",
        submission,
      };
    },
  };
}
