import type {
  RuntimeBrokerConfig,
  RuntimeContainer,
  RuntimeEvent,
  RuntimeHealth,
  RuntimeMode,
  RuntimeSpawnRequest,
} from "@unclecode/contracts";
import { RUNTIME_MODES } from "@unclecode/contracts";
import { RuntimeBrokerError } from "./errors.js";
import { DockerAdapter } from "./docker-adapter.js";
import { LocalAdapter } from "./local-adapter.js";
import type { LocalAdapterConfig } from "./local-adapter.js";
import type { DockerAdapterConfig } from "./types.js";

export type { LocalAdapterConfig } from "./local-adapter.js";
export type { DockerAdapterConfig } from "./types.js";
export { RuntimeBrokerError } from "./errors.js";
export type { RuntimeBrokerErrorCode } from "./errors.js";
export const RUNTIME_BROKER_SUPPORTED_MODES = RUNTIME_MODES;

export interface RuntimeBroker {
  onEvent(listener: (event: RuntimeEvent) => void): void;
  removeEventListener(listener: (event: RuntimeEvent) => void): void;
  spawn(request: RuntimeSpawnRequest): Promise<RuntimeContainer>;
  kill(containerId: string): void;
  health(): RuntimeHealth;
}

export function createRuntimeBroker(
  config: RuntimeBrokerConfig,
): RuntimeBroker {
  const activeMode: RuntimeMode = config.runtimeMode ?? "local";

  const localAdapter = new LocalAdapter({
    workingDirectory: config.workingDirectory,
    environment: config.environment,
    timeoutMs: config.timeoutMs,
    captureOutput: config.captureOutput,
  });

  let dockerAdapter: DockerAdapter | null = null;

  function getOrCreateDockerAdapter(): DockerAdapter {
    if (dockerAdapter === null) {
      dockerAdapter = new DockerAdapter({
        dockerImage: "ubuntu:22.04",
        workingDirectory: config.workingDirectory,
        environment: config.environment,
        timeoutMs: config.timeoutMs,
        captureOutput: config.captureOutput,
        dockerFlags: [],
      });
    }
    return dockerAdapter;
  }

  return {
    onEvent(listener: (event: RuntimeEvent) => void): void {
      localAdapter.onEvent(listener);
      if (dockerAdapter !== null) {
        dockerAdapter.onEvent(listener);
      }
    },

    removeEventListener(listener: (event: RuntimeEvent) => void): void {
      localAdapter.removeEventListener(listener);
      if (dockerAdapter !== null) {
        dockerAdapter.removeEventListener(listener);
      }
    },

    async spawn(request: RuntimeSpawnRequest): Promise<RuntimeContainer> {
      const mode = request.config.runtimeMode ?? activeMode;

      if (mode === "local") {
        return localAdapter.spawn(request.command, request.args);
      }

      if (mode === "docker") {
        const adapter = getOrCreateDockerAdapter();
        return adapter.spawn(request.command, request.args);
      }

      throw new RuntimeBrokerError(
        `Runtime mode "${mode}" is not yet supported`,
        "ADAPTER_UNAVAILABLE",
      );
    },

    kill(containerId: string): void {
      localAdapter.kill(containerId);
      if (dockerAdapter !== null) {
        dockerAdapter.kill(containerId);
      }
    },

    health(): RuntimeHealth {
      const localHealth = localAdapter.health();
      if (dockerAdapter !== null) {
        const dockerHealth = dockerAdapter.health();
        return {
          healthy: localHealth.healthy && dockerHealth.healthy,
          activeContainers:
            localHealth.activeContainers + dockerHealth.activeContainers,
          adapters: [...localHealth.adapters, ...dockerHealth.adapters],
        };
      }
      return localHealth;
    },
  };
}
