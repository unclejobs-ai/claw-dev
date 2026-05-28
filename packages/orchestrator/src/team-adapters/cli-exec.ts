/**
 * Shared CLI exec primitive for spawn-based lane adapters (codex, opencode,
 * hermes/acpx). Wraps node:child_process with a small abortable promise so
 * adapters get the same timeout + stdout/stderr capture behavior. Tests
 * inject their own `CliExecutor` to avoid touching real binaries.
 */

import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";

export type CliExecOptions = {
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly stdin?: string;
};

export type CliExecResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly timedOut: boolean;
};

export type CliExecutor = (
  command: string,
  args: readonly string[],
  options: CliExecOptions,
) => Promise<CliExecResult>;

export const defaultCliExecutor: CliExecutor = async (command, args, options) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args as string[], {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;

    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, options.timeoutMs);
      if (typeof timer.unref === "function") timer.unref();
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: typeof code === "number" ? code : -1,
        timedOut,
      });
    });

    if (options.stdin !== undefined) {
      child.stdin?.write(options.stdin);
      child.stdin?.end();
    }
  });
};

export type WhichFn = (binary: string) => string | null;

export const defaultWhich: WhichFn = (binary) => {
  const pathEnv = process.env.PATH ?? "";
  const exts = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const dir of pathEnv.split(process.platform === "win32" ? ";" : ":")) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = `${dir}/${binary}${ext}`;
      try {
        // Require executable bit on Unix; on Windows F_OK is enough because
        // PATHEXT entries are themselves executables-by-convention.
        const mode = process.platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK;
        accessSync(candidate, mode);
        return candidate;
      } catch {
        // not present or not executable — try next
      }
    }
  }
  return null;
};
