import { spawn } from "node:child_process";
import type {
  RuntimeContainer,
  RuntimeContainerState,
  RuntimeEvent,
  RuntimeHealth,
} from "@unclecode/contracts";
import { emitRuntimeEvent } from "./events.js";

export interface LocalAdapterConfig {
  readonly workingDirectory: string;
  readonly environment?: Readonly<Record<string, string>> | undefined;
  readonly timeoutMs?: number | undefined;
  readonly captureOutput?: boolean | undefined;
}

/** Mutable internal representation — the public RuntimeContainer type is readonly. */
interface MutableContainer {
  id: string;
  pid: number | null;
  workdir: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  state: RuntimeContainerState;
  startedAt: number;
  finishedAt: number | null;
  runtimeMode: "local";
}

const DEFAULT_TIMEOUT_MS = 30_000;

function toRuntimeContainer(m: MutableContainer): RuntimeContainer {
  return {
    id: m.id,
    pid: m.pid,
    workdir: m.workdir,
    stdout: m.stdout,
    stderr: m.stderr,
    exitCode: m.exitCode,
    state: m.state,
    startedAt: m.startedAt,
    finishedAt: m.finishedAt,
    runtimeMode: m.runtimeMode,
  };
}

export class LocalAdapter {
  private readonly containers = new Map<string, MutableContainer>();
  private readonly eventListeners = new Set<(event: RuntimeEvent) => void>();
  private idCounter = 0;

  constructor(private readonly config: LocalAdapterConfig) {}

  onEvent(listener: (event: RuntimeEvent) => void): void {
    this.eventListeners.add(listener);
  }

  removeEventListener(listener: (event: RuntimeEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  async spawn(command: string, args: readonly string[]): Promise<RuntimeContainer> {
    const containerId = `local-${Date.now()}-${++this.idCounter}`;
    const workdir = this.config.workingDirectory;
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const captureOutput = this.config.captureOutput ?? true;

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...(this.config.environment ?? {}),
    };

    const container: MutableContainer = {
      id: containerId,
      pid: null,
      workdir,
      stdout: "",
      stderr: "",
      exitCode: null,
      state: "pending",
      startedAt: Date.now(),
      finishedAt: null,
      runtimeMode: "local",
    };

    this.containers.set(containerId, container);

    return new Promise<RuntimeContainer>((resolve, reject) => {
      const child = spawn(command, [...args], {
        cwd: workdir,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      container.state = "running";
      container.pid = child.pid ?? null;
      this.containers.set(containerId, container);

      emitRuntimeEvent(this.eventListeners, {
        containerId,
        type: "spawned",
        timestamp: Date.now(),
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
        if (captureOutput) {
          emitRuntimeEvent(this.eventListeners, {
            containerId,
            type: "stdout",
            data: chunk.toString(),
            timestamp: Date.now(),
          });
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
        if (captureOutput) {
          emitRuntimeEvent(this.eventListeners, {
            containerId,
            type: "stderr",
            data: chunk.toString(),
            timestamp: Date.now(),
          });
        }
      });

      let settled = false;

      const timeoutHandle = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGTERM");
        container.state = "killed";
        container.finishedAt = Date.now();
        container.stdout = Buffer.concat(stdoutChunks).toString();
        container.stderr =
          Buffer.concat(stderrChunks).toString() +
          `\nTimeout after ${timeoutMs}ms`;
        this.containers.set(containerId, container);
        emitRuntimeEvent(this.eventListeners, {
          containerId,
          type: "killed",
          exitCode: null,
          timestamp: Date.now(),
        });
        resolve(toRuntimeContainer(container));
      }, timeoutMs);

      child.on("close", (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        const wasKilled = container.state === "killed";
        container.exitCode = code;
        container.state = wasKilled ? "killed" : "exited";
        container.finishedAt = Date.now();
        container.stdout = Buffer.concat(stdoutChunks).toString();
        container.stderr = Buffer.concat(stderrChunks).toString();
        this.containers.set(containerId, container);
        if (!wasKilled) {
          emitRuntimeEvent(this.eventListeners, {
            containerId,
            type: "exited",
            exitCode: code,
            timestamp: Date.now(),
          });
        }
        resolve(toRuntimeContainer(container));
      });

      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutHandle);
        container.state = "failed";
        container.finishedAt = Date.now();
        container.stderr = err.message;
        container.stdout = Buffer.concat(stdoutChunks).toString();
        this.containers.set(containerId, container);
        emitRuntimeEvent(this.eventListeners, {
          containerId,
          type: "error",
          data: err.message,
          timestamp: Date.now(),
        });
        reject(err);
      });
    });
  }

  kill(containerId: string): void {
    const container = this.containers.get(containerId);
    if (container === undefined) {
      return;
    }
    if (container.pid !== null) {
      try {
        process.kill(container.pid, "SIGTERM");
      } catch {
        // 프로세스가 이미 종료된 경우 — 정상 동작
      }
    }
    container.state = "killed";
    container.finishedAt = container.finishedAt ?? Date.now();
    this.containers.set(containerId, container);
    emitRuntimeEvent(this.eventListeners, {
      containerId,
      type: "killed",
      exitCode: container.exitCode,
      timestamp: Date.now(),
    });
  }

  health(): RuntimeHealth {
    return {
      healthy: true,
      activeContainers: this.containers.size,
      adapters: [{ mode: "local" as const, available: true }],
    };
  }

  getContainerState(containerId: string): RuntimeContainerState {
    const container = this.containers.get(containerId);
    if (container === undefined) {
      return "pending";
    }
    return container.state;
  }

  getContainer(containerId: string): RuntimeContainer | undefined {
    const mutable = this.containers.get(containerId);
    return mutable !== undefined ? toRuntimeContainer(mutable) : undefined;
  }
}
