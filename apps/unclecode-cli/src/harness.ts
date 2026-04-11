import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type HarnessStatus = {
  readonly configPath: string;
  readonly exists: boolean;
  readonly model: string | null;
  readonly reasoningEffort: string | null;
  readonly approvals: string | null;
  readonly trustLevel: string | null;
  readonly multiAgent: boolean;
  readonly statusLine: readonly string[];
  readonly mcpServers: readonly string[];
};

function resolveCodexConfigPath(cwd: string): string {
  return path.join(cwd, ".codex", "config.toml");
}

function parseTomlValue(content: string, key: string): string | null {
  const pattern = new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m");
  const match = content.match(pattern);
  return match?.[1] ?? null;
}

function parseTomlBool(content: string, key: string): boolean {
  const pattern = new RegExp(`^${key}\\s*=\\s*(true|false)`, "m");
  const match = content.match(pattern);
  return match?.[1] === "true";
}

function parseTomlArray(content: string, key: string): readonly string[] {
  const pattern = new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)]`, "m");
  const match = content.match(pattern);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((v) => v.trim().replace(/^"|"$/g, ""))
    .filter((v) => v.length > 0);
}

function parseMcpServerNames(content: string): readonly string[] {
  const names: string[] = [];
  const pattern = /^\[mcp_servers\.(\w+)]/gm;
  let match = pattern.exec(content);
  while (match) {
    names.push(match[1] ?? "");
    match = pattern.exec(content);
  }
  return names.filter((n) => n.length > 0);
}

export function inspectHarnessStatus(cwd: string): HarnessStatus {
  const configPath = resolveCodexConfigPath(cwd);
  if (!existsSync(configPath)) {
    return {
      configPath,
      exists: false,
      model: null,
      reasoningEffort: null,
      approvals: null,
      trustLevel: null,
      multiAgent: false,
      statusLine: [],
      mcpServers: [],
    };
  }

  const content = readFileSync(configPath, "utf8");
  return {
    configPath,
    exists: true,
    model: parseTomlValue(content, "model"),
    reasoningEffort: parseTomlValue(content, "model_reasoning_effort"),
    approvals: parseTomlValue(content, "approvals_reviewer"),
    trustLevel: parseTomlValue(content, "trust_level"),
    multiAgent: parseTomlBool(content, "multi_agent"),
    statusLine: parseTomlArray(content, "status_line"),
    mcpServers: parseMcpServerNames(content),
  };
}

export function formatHarnessStatusLines(status: HarnessStatus): readonly string[] {
  if (!status.exists) {
    return [
      `Config: ${status.configPath} (not found)`,
      "",
      "No .codex/config.toml found.",
      "Run 'unclecode harness apply yolo' to create one, or install oh-my-codex.",
    ];
  }

  return [
    `Config: ${status.configPath}`,
    "",
    `Model: ${status.model ?? "default"}`,
    `Reasoning: ${status.reasoningEffort ?? "default"}`,
    `Approvals: ${status.approvals ?? "user"}`,
    `Trust: ${status.trustLevel ?? "default"}`,
    `Multi-agent: ${status.multiAgent ? "enabled" : "disabled"}`,
    `MCP servers: ${status.mcpServers.length > 0 ? status.mcpServers.join(", ") : "none"}`,
    `Status line: ${status.statusLine.length > 0 ? status.statusLine.join(", ") : "default"}`,
  ];
}

export function formatHarnessExplainLines(): readonly string[] {
  return [
    "UncleCode harness controls how the agent runtime behaves.",
    "",
    "Profiles:",
    "  yolo    — Low friction. Medium reasoning, auto-approve local workspace tools.",
    "            Remote/MCP/background tasks still require approval.",
    "  default — Balanced. User approval for all tool execution.",
    "",
    "The harness reads from .codex/config.toml and applies overlays",
    "for model, reasoning effort, approval policy, and TUI status line.",
    "",
    "Commands:",
    "  unclecode harness status  — Show current harness configuration",
    "  unclecode harness apply yolo — Apply the YOLO low-friction preset",
    "  unclecode harness explain — Show this help",
  ];
}

export type HarnessPresetId = "yolo";

export function getHarnessPresetPatch(preset: HarnessPresetId): Record<string, string> {
  if (preset === "yolo") {
    return {
      model_reasoning_effort: "medium",
      approvals_reviewer: "auto-edit",
    };
  }
  return {};
}
