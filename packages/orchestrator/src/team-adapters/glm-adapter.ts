/**
 * GLM (Z.ai / BigModel) adapter — OpenAI-compatible HTTP chat/completions.
 * One-shot prompt → response.content; no tool dispatch loop. Override the
 * endpoint via `GLM_BASE_URL` env (default Z.ai coding plan).
 *
 * Tests inject `fetchFn`.
 */

import type { WorkerSpec } from "@unclecode/contracts";

import type { LaneAdapter, LanePreflight, LaneRunContext, LaneRunResult } from "./lane-adapter.js";

const GLM_LANE_ID = "glm" as const;
const GLM_ENV_NAME = "GLM_API_KEY";
const GLM_BASE_URL_ENV = "GLM_BASE_URL";
const GLM_DEFAULT_BASE_URL = "https://api.z.ai/api/coding/paas/v4";
const GLM_DEFAULT_MODEL = "glm-5.1";

export type GlmFetchResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

export type GlmFetchInit = {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly signal?: AbortSignal;
};

export type GlmFetchFn = (url: string, init: GlmFetchInit) => Promise<GlmFetchResponse>;

export type CreateGlmAdapterArgs = {
  readonly fetchFn?: GlmFetchFn;
};

type GlmChatChoice = { readonly message?: { readonly content?: string } };
type GlmChatResponse = { readonly choices?: ReadonlyArray<GlmChatChoice> };

function defaultFetch(): GlmFetchFn {
  return async (url, init) => {
    const response = await fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      ...(init.signal !== undefined ? { signal: init.signal } : {}),
    });
    return {
      ok: response.ok,
      status: response.status,
      async json() {
        return response.json();
      },
      async text() {
        return response.text();
      },
    };
  };
}

export function createGlmAdapter(args: CreateGlmAdapterArgs = {}): LaneAdapter {
  const fetchFn = args.fetchFn ?? defaultFetch();

  return {
    id: GLM_LANE_ID,
    preflight(env): LanePreflight {
      const value = env[GLM_ENV_NAME];
      if (value === undefined || value.trim().length === 0) {
        return {
          status: "missing",
          reason: `glm lane requires ${GLM_ENV_NAME} (currently unset)`,
        };
      }
      return { status: "ok" };
    },
    async run(spec: WorkerSpec, ctx: LaneRunContext): Promise<LaneRunResult> {
      const apiKey = ctx.env[GLM_ENV_NAME]?.trim();
      if (!apiKey) {
        throw new Error(
          `glm lane requires ${GLM_ENV_NAME} — refusing to dispatch worker ${spec.workerId}`,
        );
      }
      const baseUrl = (ctx.env[GLM_BASE_URL_ENV] ?? GLM_DEFAULT_BASE_URL).replace(/\/$/, "");
      const url = `${baseUrl}/chat/completions`;
      const model = spec.model?.trim() || GLM_DEFAULT_MODEL;

      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      const systemPrompt = ctx.systemPrompt?.trim();
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: spec.task });
      const body = JSON.stringify({ model, messages });

      // Enforce ctx.timeoutMs via AbortController so a stuck GLM endpoint
      // doesn't hang the worker indefinitely.
      const controller = new AbortController();
      let timer: NodeJS.Timeout | null = null;
      if (ctx.timeoutMs !== undefined && ctx.timeoutMs > 0) {
        timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
        if (typeof timer.unref === "function") timer.unref();
      }

      try {
        const response = await fetchFn(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          return {
            ok: false,
            submission: `glm http ${response.status}${detail ? `: ${detail}` : ""}`,
          };
        }

        const data = (await response.json()) as GlmChatResponse;
        const content = data.choices?.[0]?.message?.content ?? "";
        return { ok: content.length > 0, submission: content };
      } catch (err) {
        if (controller.signal.aborted) {
          throw new Error(`glm lane worker ${spec.workerId} timed out after ${ctx.timeoutMs}ms`);
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
