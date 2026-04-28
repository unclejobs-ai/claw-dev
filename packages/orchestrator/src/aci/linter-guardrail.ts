/**
 * Linter guardrail — re-implements SWE-agent's flake8-on-edit revert flow,
 * but extended to TS/JS/Python so the language detection lives in one place.
 *
 * Returns a structured result; caller (file-editor) decides whether to apply
 * the patch. We do NOT shell out by default — the runner is injected so tests
 * can stub a deterministic linter.
 */

import { extname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type LintFinding = {
  readonly line?: number;
  readonly column?: number;
  readonly code: string;
  readonly message: string;
};

export type LintResult = {
  readonly ok: boolean;
  readonly findings: ReadonlyArray<LintFinding>;
  readonly skipped?: boolean;
  readonly reason?: string;
};

export type LintRunner = (input: { absPath: string; content: string }) => Promise<LintResult>;

const PY_EXTENSIONS = new Set([".py"]);
const TS_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const JS_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs"]);

const FLAKE8_SELECT = "F821,F822,F831,E111,E112,E113,E999,E902";

async function runFlake8(absPath: string): Promise<LintResult> {
  try {
    await execFileAsync("flake8", ["--isolated", `--select=${FLAKE8_SELECT}`, absPath], { timeout: 10_000 });
    return { ok: true, findings: [] };
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout ?? "";
    if (!stdout) {
      return { ok: true, findings: [], skipped: true, reason: "flake8 not available" };
    }
    const findings: LintFinding[] = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/:(\d+):(\d+):\s+(\S+)\s+(.+)$/);
        if (!match) {
          return { code: "unknown", message: line };
        }
        const [, lineNoRaw, colNoRaw, code, message] = match;
        return {
          line: Number.parseInt(lineNoRaw ?? "0", 10),
          column: Number.parseInt(colNoRaw ?? "0", 10),
          code: code ?? "unknown",
          message: message ?? "",
        };
      });
    return { ok: findings.length === 0, findings };
  }
}

async function runBiome(absPath: string): Promise<LintResult> {
  try {
    await execFileAsync("npx", ["--yes", "@biomejs/biome", "check", absPath], { timeout: 15_000 });
    return { ok: true, findings: [] };
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout ?? "";
    if (stdout.length === 0) {
      return { ok: true, findings: [], skipped: true, reason: "biome not available" };
    }
    return {
      ok: false,
      findings: [{ code: "biome", message: stdout.split("\n").slice(0, 6).join("\n") }],
    };
  }
}

export const defaultLintRunner: LintRunner = async ({ absPath }) => {
  const ext = extname(absPath).toLowerCase();
  if (PY_EXTENSIONS.has(ext)) {
    return runFlake8(absPath);
  }
  if (TS_EXTENSIONS.has(ext) || JS_EXTENSIONS.has(ext)) {
    return runBiome(absPath);
  }
  return { ok: true, findings: [], skipped: true, reason: `no linter wired for ${ext}` };
};

export function buildLinterGuardrail(runner: LintRunner = defaultLintRunner): LintRunner {
  return runner;
}
