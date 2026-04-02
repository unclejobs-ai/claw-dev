import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  RuntimeContainer,
  RuntimeContainerState,
  RuntimeEvent,
  RuntimeHealth,
} from "@unclecode/contracts";
import { RuntimeBrokerError } from "./errors.js";
import { emitRuntimeEvent } from "./events.js";
import type { DockerAdapterConfig } from "./types.js";

const execFileAsync = promisify(execFile);

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
  runtimeMode: "docker";
}

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

function joinOutput(chunks: ReadonlyArray<Buffer | string>): string {
  return chunks
    .map((chunk) => (typeof chunk === "string" ? chunk : chunk.toString()))
    .join("");
}

export class DockerAdapter {
  private readonly containers = new Map<string, MutableContainer>();
  private readonly eventListeners = new Set<(event: RuntimeEvent) => void>();
  private dockerAvailable: boolean | null = null;
  private lastDockerCheck = 0;
  private static readonly DOCKER_CHECK_INTERVAL_MS = 60_000;

  constructor(private readonly config: DockerAdapterConfig) {}

  onEvent(listener: (event: RuntimeEvent) => void): void {
    this.eventListeners.add(listener);
  }

  removeEventListener(listener: (event: RuntimeEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  async isDockerAvailable(): Promise<boolean> {
    const now = Date.now();
    if (
      this.dockerAvailable !== null &&
      now - this.lastDockerCheck < DockerAdapter.DOCKER_CHECK_INTERVAL_MS
    ) {
      return this.dockerAvailable;
    }
    this.lastDockerCheck = now;
    try {
      await execFileAsync("docker", ["--version"], { timeout: 5000 });
      this.dockerAvailable = true;
    } catch {
      this.dockerAvailable = false;
    }
    return this.dockerAvailable;
  }

  async spawn(command: string, args: readonly string[]): Promise<RuntimeContainer> {
    const available = await this.isDockerAvailable();
    if (!available) {
      throw new RuntimeBrokerError(
        "Docker is not available. Install Docker CLI to use sandbox escalation.",
        "ADAPTER_UNAVAILABLE",
      );
    }

    const containerId = `docker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const image = this.config.dockerImage;

    const dockerArgs: string[] = ["run", "--rm", "-i"];

    if (this.config.memoryLimitMb !== undefined) {
      dockerArgs.push("--memory", `${this.config.memoryLimitMb}m`);
    }
    if (this.config.cpusLimit !== undefined) {
      dockerArgs.push("--cpus", String(this.config.cpusLimit));
    }
    if (this.config.dockerFlags) {
      dockerArgs.push(...this.config.dockerFlags);
    }

    const workdir = this.config.workingDirectory;
    dockerArgs.push("-v", `${workdir}:${workdir}`);
    dockerArgs.push("-w", workdir);
    dockerArgs.push(image);
    dockerArgs.push("sh", "-c", [command, ...args].join(" "));

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
      runtimeMode: "docker",
    };

    this.containers.set(containerId, container);
    emitRuntimeEvent(this.eventListeners, {
      containerId,
      type: "spawned",
      timestamp: Date.now(),
    });

    return new Promise<RuntimeContainer>((resolve, reject) => {
      const stdoutChunks: Array<Buffer | string> = [];
      const stderrChunks: Array<Buffer | string> = [];
      let settled = false;

      const child = execFile("docker", dockerArgs, {
        cwd: workdir,
        env: {
          ...process.env as Record<string, string>,
          ...(this.config.environment ?? {}),
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: this.config.timeoutMs ?? 30_000,
      });

      container.state = "running";
      container.pid = child.pid ?? null;
      this.containers.set(containerId, container);

      child.stdout?.on("data", (chunk: Buffer | string) => {
        stdoutChunks.push(chunk);
        emitRuntimeEvent(this.eventListeners, {
          containerId,
          type: "stdout",
          data: typeof chunk === "string" ? chunk : chunk.toString(),
          timestamp: Date.now(),
        });
      });

      child.stderr?.on("data", (chunk: Buffer | string) => {
        stderrChunks.push(chunk);
        emitRuntimeEvent(this.eventListeners, {
          containerId,
          type: "stderr",
          data: typeof chunk === "string" ? chunk : chunk.toString(),
          timestamp: Date.now(),
        });
      });

      child.on("close", (code: number | null) => {
        if (settled) return;
        settled = true;
        container.exitCode = code;
        container.state = code === 0 ? "exited" : "failed";
        container.finishedAt = Date.now();
        container.stdout = joinOutput(stdoutChunks);
        container.stderr = joinOutput(stderrChunks);
        this.containers.set(containerId, container);
        emitRuntimeEvent(this.eventListeners, {
          containerId,
          type: code === 0 ? "exited" : "error",
          exitCode: code,
          timestamp: Date.now(),
        });
        resolve(toRuntimeContainer(container));
      });

      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        container.state = "failed";
        container.finishedAt = Date.now();
        container.stderr = err.message;
        container.stdout = joinOutput(stdoutChunks);
        this.containers.set(containerId, container);
        emitRuntimeEvent(this.eventListeners, {
          containerId,
          type: "error",
          data: err.message,
          timestamp: Date.now(),
        });
        reject(
          new RuntimeBrokerError(
            `Docker spawn failed: ${err.message}`,
            "SPAWN_FAILED",
            err,
          ),
        );
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
      adapters: [
        { mode: "docker" as const, available: this.dockerAvailable ?? false },
      ],
    };
  }

  getContainerState(containerId: string): RuntimeContainerState {
    const container = this.containers.get(containerId);
    if (container === undefined) {
      return "pending";
    }
    return container.state;
  }
}
