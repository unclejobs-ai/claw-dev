export const UNCLECODE_COMMAND_NAME = "unclecode";

export const UNCLECODE_PACKAGE_BOUNDARIES = [
  "contracts",
  "config-core",
  "context-broker",
  "policy-engine",
  "session-store",
  "runtime-broker",
  "providers",
  "mcp-host",
  "orchestrator",
  "tui",
] as const;

export type UncleCodePackageBoundary = (typeof UNCLECODE_PACKAGE_BOUNDARIES)[number];
