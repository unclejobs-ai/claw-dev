/**
 * UncleCode persistent server — HTTP+SSE daemon that survives SSH drops
 * and lets multiple clients (TUI, web, IDE) attach to the same session.
 *
 * Phase 1 (this commit): wire types + a minimal HTTP+SSE server with
 * /health, /sessions, /sessions/:id/events SSE, /tools/invoke. Real
 * orchestrator delegation lives in a follow-up — today the server stubs
 * the action handlers so a client can talk to it end-to-end without
 * needing the full work-shell-engine wired in.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";

export type ServerHealth = {
  readonly ok: true;
  readonly pid: number;
  readonly startedAt: number;
  readonly uptimeMs: number;
};

export type ServerSessionSummary = {
  readonly sessionId: string;
  readonly persona?: string;
  readonly state: "idle" | "running" | "requires_action";
};

export type ServerEvent =
  | { readonly type: "session.state_changed"; readonly sessionId: string; readonly state: ServerSessionSummary["state"] }
  | { readonly type: "tool.completed"; readonly sessionId: string; readonly toolName: string; readonly output: string }
  | { readonly type: "ping"; readonly t: number };

export type ToolInvokeRequest = {
  readonly sessionId: string;
  readonly toolName: string;
  readonly input: Record<string, unknown>;
};

export type ToolInvokeResponse = {
  readonly toolCallId: string;
  readonly output: string;
  readonly isError: boolean;
};

export type ServerHandlers = {
  listSessions(): Promise<ReadonlyArray<ServerSessionSummary>>;
  invokeTool(req: ToolInvokeRequest): Promise<ToolInvokeResponse>;
  subscribe(sessionId: string, write: (event: ServerEvent) => void): () => void;
};

export type ServerOptions = {
  readonly port?: number;
  readonly host?: string;
  readonly handlers: ServerHandlers;
};

export async function startServer(options: ServerOptions): Promise<{
  readonly url: string;
  readonly stop: () => Promise<void>;
}> {
  const port = options.port ?? 17677;
  const host = options.host ?? "127.0.0.1";
  const startedAt = Date.now();

  const server = createServer(async (req, res) => {
    try {
      await routeRequest({ req, res, options, startedAt });
    } catch (error) {
      writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : port;
  const url = `http://${host}:${actualPort}`;
  return {
    url,
    async stop() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function routeRequest(input: {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  readonly options: ServerOptions;
  readonly startedAt: number;
}): Promise<void> {
  const { req, res, options, startedAt } = input;
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (url === "/health" && method === "GET") {
    const body: ServerHealth = {
      ok: true,
      pid: process.pid,
      startedAt,
      uptimeMs: Date.now() - startedAt,
    };
    writeJson(res, 200, body);
    return;
  }

  if (url === "/sessions" && method === "GET") {
    const sessions = await options.handlers.listSessions();
    writeJson(res, 200, { sessions });
    return;
  }

  const sseMatch = url.match(/^\/sessions\/([\w-]+)\/events$/);
  if (sseMatch && method === "GET") {
    const sessionId = sseMatch[1] ?? "";
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders?.();
    const write = (event: ServerEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const unsubscribe = options.handlers.subscribe(sessionId, write);
    const ping = setInterval(() => write({ type: "ping", t: Date.now() }), 15_000);
    req.on("close", () => {
      clearInterval(ping);
      unsubscribe();
    });
    return;
  }

  if (url === "/tools/invoke" && method === "POST") {
    const body = await readJson(req);
    const response = await options.handlers.invokeTool(body as ToolInvokeRequest);
    writeJson(res, 200, response);
    return;
  }

  writeJson(res, 404, { error: `not_found: ${method} ${url}` });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      buf += chunk;
      if (buf.length > 8 * 1024 * 1024) {
        req.destroy(new Error("payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(buf.length === 0 ? {} : JSON.parse(buf));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function makeStubHandlers(): ServerHandlers {
  const subscribers = new Map<string, Set<(event: ServerEvent) => void>>();
  return {
    async listSessions() {
      return [];
    },
    async invokeTool(req) {
      return {
        toolCallId: randomUUID(),
        output: `(stub) tool=${req.toolName} not yet wired`,
        isError: false,
      };
    },
    subscribe(sessionId, write) {
      let set = subscribers.get(sessionId);
      if (!set) {
        set = new Set();
        subscribers.set(sessionId, set);
      }
      set.add(write);
      return () => {
        set?.delete(write);
        if (set && set.size === 0) {
          subscribers.delete(sessionId);
        }
      };
    },
  };
}
