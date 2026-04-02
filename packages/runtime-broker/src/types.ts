import type { RuntimeBrokerConfig } from "@unclecode/contracts";

export type DockerAdapterConfig = RuntimeBrokerConfig & {
  readonly dockerImage: string;
  readonly dockerFlags?: readonly string[] | undefined;
  readonly memoryLimitMb?: number | undefined;
  readonly cpusLimit?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly environment?: Readonly<Record<string, string>> | undefined;
};
