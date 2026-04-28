/**
 * Plugin host — UncleCode in-process extension point.
 *
 * A plugin is a TS module exporting either a default function or a named
 * `register(ctx)` that returns a partial Hooks record. Plugins live in
 * .unclecode/plugins/<name>.ts and are loaded by name; the host validates
 * each registration with a Zod schema before wiring.
 *
 * Loading plugin code from a workspace is gated by an explicit user-granted
 * trust decision recorded in `~/.unclecode/trust.json`. The trust check is
 * skipped for in-memory `loadEntries` callers, which already have the plugin
 * code in hand — the threat is an attacker-supplied .unclecode/plugins
 * directory in a freshly cloned repo.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

const HookKeysSchema = z.object({
  toolExecuteBefore: z.function().optional(),
  toolExecuteAfter: z.function().optional(),
  fileEdited: z.function().optional(),
  sessionCompacted: z.function().optional(),
  runStarted: z.function().optional(),
  runCompleted: z.function().optional(),
});

export type PluginHooks = {
  toolExecuteBefore?: (event: { toolName: string; input: Record<string, unknown> }) => Promise<void> | void;
  toolExecuteAfter?: (event: { toolName: string; output: string; isError: boolean }) => Promise<void> | void;
  fileEdited?: (event: { path: string; sha256: string }) => Promise<void> | void;
  sessionCompacted?: (event: { sessionId: string; messagesBefore: number; messagesAfter: number }) => Promise<void> | void;
  runStarted?: (event: { runId: string; persona?: string }) => Promise<void> | void;
  runCompleted?: (event: { runId: string; status: string }) => Promise<void> | void;
};

export type PluginContext = {
  readonly workspaceRoot: string;
  readonly env: NodeJS.ProcessEnv;
  log(message: string): void;
};

export type PluginRegistration = {
  readonly name: string;
  readonly hooks: PluginHooks;
};

export type PluginEntry = (ctx: PluginContext) => PluginHooks | Promise<PluginHooks>;

export class PluginHost {
  private readonly registrations: PluginRegistration[] = [];

  register(name: string, hooks: PluginHooks): void {
    HookKeysSchema.parse(hooks);
    this.registrations.push({ name, hooks });
  }

  async loadEntries(workspaceRoot: string, entries: ReadonlyArray<{ name: string; entry: PluginEntry }>, env: NodeJS.ProcessEnv = process.env): Promise<void> {
    for (const { name, entry } of entries) {
      const log = (message: string) => process.stderr.write(`[plugin:${name}] ${message}\n`);
      const hooks = await entry({ workspaceRoot, env, log });
      this.register(name, hooks);
    }
  }

  async loadFromDisk(
    workspaceRoot: string,
    options: {
      readonly env?: NodeJS.ProcessEnv;
      readonly homeDir?: string;
      readonly requireTrust?: boolean;
    } = {},
  ): Promise<ReadonlyArray<string>> {
    const requireTrust = options.requireTrust ?? true;
    const dir = resolve(workspaceRoot, ".unclecode", "plugins");
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter(
      (name) => name.endsWith(".ts") || name.endsWith(".mjs") || name.endsWith(".js"),
    );
    if (files.length === 0) return [];
    if (requireTrust && !isWorkspaceTrusted(workspaceRoot, options.homeDir)) {
      throw new PluginTrustError(resolve(workspaceRoot));
    }
    const env = options.env ?? process.env;
    const loaded: string[] = [];
    for (const file of files) {
      const name = file.replace(/\.(ts|mjs|js)$/, "");
      const moduleUrl = new URL(`file://${join(dir, file)}`);
      const imported = (await import(moduleUrl.href)) as {
        default?: PluginEntry;
        register?: PluginEntry;
      };
      const entry = imported.default ?? imported.register;
      if (typeof entry !== "function") continue;
      const log = (message: string) => process.stderr.write(`[plugin:${name}] ${message}\n`);
      const hooks = await entry({ workspaceRoot, env, log });
      this.register(name, hooks);
      loaded.push(name);
    }
    return loaded;
  }

  list(): ReadonlyArray<PluginRegistration> {
    return this.registrations.slice();
  }

  async dispatchToolExecuteBefore(event: { toolName: string; input: Record<string, unknown> }): Promise<void> {
    for (const reg of this.registrations) {
      await reg.hooks.toolExecuteBefore?.(event);
    }
  }

  async dispatchToolExecuteAfter(event: { toolName: string; output: string; isError: boolean }): Promise<void> {
    for (const reg of this.registrations) {
      await reg.hooks.toolExecuteAfter?.(event);
    }
  }

  async dispatchFileEdited(event: { path: string; sha256: string }): Promise<void> {
    for (const reg of this.registrations) {
      await reg.hooks.fileEdited?.(event);
    }
  }

  async dispatchSessionCompacted(event: { sessionId: string; messagesBefore: number; messagesAfter: number }): Promise<void> {
    for (const reg of this.registrations) {
      await reg.hooks.sessionCompacted?.(event);
    }
  }

  async dispatchRunStarted(event: { runId: string; persona?: string }): Promise<void> {
    for (const reg of this.registrations) {
      await reg.hooks.runStarted?.(event);
    }
  }

  async dispatchRunCompleted(event: { runId: string; status: string }): Promise<void> {
    for (const reg of this.registrations) {
      await reg.hooks.runCompleted?.(event);
    }
  }
}

export function discoverPluginNames(workspaceRoot: string): ReadonlyArray<string> {
  const dir = resolve(workspaceRoot, ".unclecode", "plugins");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".mjs") || name.endsWith(".js"))
    .map((name) => name.replace(/\.(ts|mjs|js)$/, ""));
}

const TRUST_FILE_RELATIVE = join(".unclecode", "trust.json");

export type TrustStore = { readonly trustedRoots: ReadonlyArray<string> };

export class PluginTrustError extends Error {
  readonly workspaceRoot: string;
  constructor(workspaceRoot: string) {
    super(
      `Workspace ${workspaceRoot} contains plugins under .unclecode/plugins but has not been granted trust. Run "unclecode trust grant" to enable plugin loading.`,
    );
    this.workspaceRoot = workspaceRoot;
    this.name = "PluginTrustError";
  }
}

export function getTrustStorePath(home: string = homedir()): string {
  return join(home, TRUST_FILE_RELATIVE);
}

function readTrustStore(home?: string): TrustStore {
  const path = getTrustStorePath(home);
  if (!existsSync(path)) return { trustedRoots: [] };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { trustedRoots?: unknown };
    const roots = Array.isArray(parsed.trustedRoots)
      ? parsed.trustedRoots.filter((entry): entry is string => typeof entry === "string")
      : [];
    return { trustedRoots: roots };
  } catch {
    return { trustedRoots: [] };
  }
}

export function isWorkspaceTrusted(workspaceRoot: string, home?: string): boolean {
  const target = resolve(workspaceRoot);
  return readTrustStore(home).trustedRoots.includes(target);
}

export function listTrustedWorkspaces(home?: string): ReadonlyArray<string> {
  return readTrustStore(home).trustedRoots.slice();
}

export function recordWorkspaceTrust(workspaceRoot: string, home?: string): void {
  const target = resolve(workspaceRoot);
  const path = getTrustStorePath(home);
  mkdirSync(dirname(path), { recursive: true });
  const current = readTrustStore(home);
  if (current.trustedRoots.includes(target)) return;
  const next = { trustedRoots: [...current.trustedRoots, target] };
  writeFileSync(path, JSON.stringify(next, null, 2), { mode: 0o600 });
}

export function revokeWorkspaceTrust(workspaceRoot: string, home?: string): void {
  const target = resolve(workspaceRoot);
  const current = readTrustStore(home);
  if (!current.trustedRoots.includes(target)) return;
  const path = getTrustStorePath(home);
  mkdirSync(dirname(path), { recursive: true });
  const next = { trustedRoots: current.trustedRoots.filter((root) => root !== target) };
  writeFileSync(path, JSON.stringify(next, null, 2), { mode: 0o600 });
}
