import type { ModeReasoningEffort } from "@unclecode/contracts";
import { toolDefinitions } from "@unclecode/orchestrator";
import * as path from "node:path";

export type ParsedArgs = {
  cwd: string;
  provider?: "anthropic" | "gemini" | "openai";
  model?: string;
  reasoning?: ModeReasoningEffort;
  sessionId?: string;
  prompt?: string;
  showHelp: boolean;
  showTools: boolean;
};

export function printHelp(): void {
  process.stdout.write(`UncleCode Work (repo-local)\n\n`);
  process.stdout.write(`Usage:\n`);
  process.stdout.write(`  unclecode work\n`);
  process.stdout.write(`  unclecode work "summarize this project"\n`);
  process.stdout.write(`  unclecode work --provider gemini --cwd E:\\\\repo --model gemini-2.5-flash\n\n`);
  process.stdout.write(`Flags:\n`);
  process.stdout.write(`  --help   Show this help text\n`);
  process.stdout.write(`  --tools  List available local tools\n`);
  process.stdout.write(`  --cwd    Set the workspace root\n`);
  process.stdout.write(`  --provider  Choose openai, anthropic, or gemini\n`);
  process.stdout.write(`  --model  Override the model for the chosen provider\n`);
  process.stdout.write(`  --reasoning  Override reasoning effort: low, medium, high\n`);
  process.stdout.write(`  --session-id  Resume a persisted work session id\n`);
}

export function printTools(): void {
  process.stdout.write(`Available tools:\n`);
  for (const tool of toolDefinitions) {
    process.stdout.write(`- ${tool.name}: ${tool.description}\n`);
  }
}

export function resolveRuntimeProvider(provider: string): "anthropic" | "gemini" | "openai" {
  if (provider === "anthropic" || provider === "gemini" || provider === "openai") {
    return provider;
  }

  throw new Error(`Unsupported runtime provider: ${provider}`);
}

export function parseArgs(argv: string[]): ParsedArgs {
  let cwd = process.cwd();
  let provider: "anthropic" | "gemini" | "openai" | undefined;
  let model: string | undefined;
  let reasoning: ModeReasoningEffort | undefined;
  let sessionId: string | undefined;
  const promptParts: string[] = [];
  let showHelp = false;
  let showTools = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--help") {
      showHelp = true;
      continue;
    }
    if (arg === "--tools") {
      showTools = true;
      continue;
    }
    if (arg === "--cwd") {
      cwd = path.resolve(argv[i + 1] ?? cwd);
      i += 1;
      continue;
    }
    if (arg === "--provider") {
      const next = argv[i + 1];
      if (next === "anthropic" || next === "gemini" || next === "openai") {
        provider = next;
      }
      i += 1;
      continue;
    }
    if (arg === "--model") {
      model = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--reasoning") {
      const next = argv[i + 1];
      if (next === "low" || next === "medium" || next === "high") {
        reasoning = next;
      }
      i += 1;
      continue;
    }
    if (arg === "--session-id") {
      sessionId = argv[i + 1];
      i += 1;
      continue;
    }
    promptParts.push(arg);
  }

  const parsed: ParsedArgs = { cwd, showHelp, showTools };
  if (provider !== undefined) {
    parsed.provider = provider;
  }
  if (model !== undefined) {
    parsed.model = model;
  }
  if (reasoning !== undefined) {
    parsed.reasoning = reasoning;
  }
  if (sessionId !== undefined) {
    parsed.sessionId = sessionId;
  }
  if (promptParts.length > 0) {
    parsed.prompt = promptParts.join(" ");
  }
  return parsed;
}
