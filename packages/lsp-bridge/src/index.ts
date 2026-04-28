/**
 * LSP bridge — opt-in language-server-in-loop diagnostics.
 *
 * The orchestrator emits a fileEdited event after a write_file or
 * apply_patch tool returns; the bridge forwards a textDocument/didChange
 * to the matching LSP, waits up to a configurable timeout for diagnostics,
 * and returns a flat list the loop can append to the next observation.
 *
 * Implementation here is the wire shape + an injectable LspClient
 * interface. The actual JSON-RPC speaker for typescript-language-server /
 * gopls / pyright / etc. is wired in apps/unclecode-cli where the spawn +
 * MCP host coordination already lives, so this package stays
 * dependency-light.
 */

import { spawn } from "node:child_process";
import { extname } from "node:path";

export type LspDiagnosticSeverity = "error" | "warning" | "info" | "hint";

export type LspDiagnostic = {
  readonly path: string;
  readonly range: { readonly start: { line: number; character: number }; readonly end: { line: number; character: number } };
  readonly severity: LspDiagnosticSeverity;
  readonly source?: string;
  readonly code?: string | number;
  readonly message: string;
};

export type LspBridgeOptions = {
  readonly timeoutMs?: number;
  readonly maxDiagnostics?: number;
};

export interface LspClient {
  readonly id: string;
  readonly handlesExtension: (ext: string) => boolean;
  notifyDidChange(input: { path: string; content: string }): Promise<void>;
  pollDiagnostics(input: { path: string; timeoutMs: number }): Promise<ReadonlyArray<LspDiagnostic>>;
  shutdown(): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 500;
const DEFAULT_MAX_DIAGNOSTICS = 20;

export class LspBridge {
  private readonly clients: LspClient[] = [];

  register(client: LspClient): void {
    this.clients.push(client);
  }

  list(): ReadonlyArray<LspClient> {
    return this.clients.slice();
  }

  async pollAfterEdit(input: {
    readonly path: string;
    readonly content: string;
    readonly options?: LspBridgeOptions;
  }): Promise<ReadonlyArray<LspDiagnostic>> {
    const ext = extname(input.path).toLowerCase();
    const matched = this.clients.filter((client) => client.handlesExtension(ext));
    if (matched.length === 0) {
      return [];
    }
    const timeoutMs = input.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxDiagnostics = input.options?.maxDiagnostics ?? DEFAULT_MAX_DIAGNOSTICS;
    const collected: LspDiagnostic[] = [];
    for (const client of matched) {
      await client.notifyDidChange({ path: input.path, content: input.content });
      const diagnostics = await client.pollDiagnostics({ path: input.path, timeoutMs });
      collected.push(...diagnostics);
      if (collected.length >= maxDiagnostics) break;
    }
    return collected.slice(0, maxDiagnostics);
  }

  async shutdownAll(): Promise<void> {
    for (const client of this.clients) {
      await client.shutdown().catch(() => {
        /* swallow shutdown errors so one bad LSP doesn't pin the loop */
      });
    }
    this.clients.length = 0;
  }
}

export type LspSpawnConfig = {
  readonly id: string;
  readonly command: string;
  readonly args?: ReadonlyArray<string>;
  readonly extensions: ReadonlyArray<string>;
};

/**
 * Spawn helper — light wrapper for Phase 2 wiring; today it returns a
 * client that proxies all calls to a stub. The real JSON-RPC speaker
 * arrives when apps/unclecode-cli grows the LspBridge consumer.
 */
export function spawnLspClientStub(config: LspSpawnConfig): LspClient {
  const exts = new Set(config.extensions.map((ext) => ext.toLowerCase()));
  let alive = true;
  let child: ReturnType<typeof spawn> | undefined;
  return {
    id: config.id,
    handlesExtension(ext: string) {
      return exts.has(ext.toLowerCase());
    },
    async notifyDidChange() {
      if (!alive) return;
      if (!child) {
        child = spawn(config.command, [...(config.args ?? [])], { stdio: ["pipe", "pipe", "pipe"] });
      }
    },
    async pollDiagnostics() {
      // Phase 2 will wire real JSON-RPC; stub returns empty so the loop
      // does not block on a not-yet-connected language server.
      return [];
    },
    async shutdown() {
      alive = false;
      child?.kill();
    },
  };
}
