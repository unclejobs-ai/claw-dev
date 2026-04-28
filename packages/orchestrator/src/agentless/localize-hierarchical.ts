/**
 * Hierarchical localization — Agentless paper (FSE 2025) two-phase strategy:
 *  1. Repo-map → top files
 *  2. Per-file content scan → top class/function regions
 *  3. Line-window selection within each region
 *
 * Pure heuristic + injected scorer. The scorer is the only LM-dependent part,
 * which keeps this module testable offline. Scorer is also a single seam if
 * we later swap to a Kimi-Dev-style trained localizer.
 */

import { execFile } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const RG_MAX_BUFFER = 8 * 1024 * 1024;
const RG_EXCLUDE_GLOBS = ["!node_modules", "!dist"];
const FILE_HITS_PER_TOKEN = 25;
const SEARCH_HITS_PER_TOKEN = 25;

export type LocalizationCandidate = {
  readonly path: string;
  readonly score: number;
  readonly reason: string;
  readonly region?: { readonly startLine: number; readonly endLine: number };
};

export type LocalizationScorer = (input: {
  readonly path: string;
  readonly snippet: string;
  readonly issue: string;
}) => Promise<{ readonly score: number; readonly reason: string }>;

export type LocalizeInput = {
  readonly cwd: string;
  readonly issue: string;
  readonly hintFiles?: ReadonlyArray<string>;
  readonly maxFiles?: number;
  readonly maxRegions?: number;
};

const TS_LIKE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PY_LIKE = new Set([".py"]);

const TS_DECLARATION = /^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|interface|type|enum)\s+(\w+)/;
const PY_DECLARATION = /^(?:async\s+def|def|class)\s+(\w+)/;

export async function hierarchicalLocalize(
  input: LocalizeInput,
  scorer: LocalizationScorer,
): Promise<ReadonlyArray<LocalizationCandidate>> {
  const candidatePaths = await collectCandidatePaths(input);
  const fileCap = input.maxFiles ?? 8;
  const regionCap = input.maxRegions ?? 3;

  const fileCandidates: LocalizationCandidate[] = [];
  for (const path of candidatePaths.slice(0, fileCap * 2)) {
    const absPath = resolve(input.cwd, path);
    const headerSnippet = readSnippet(absPath, 0, 200);
    if (headerSnippet === null) continue;
    const score = await scorer({ path, snippet: headerSnippet, issue: input.issue });
    fileCandidates.push({ path, score: score.score, reason: score.reason });
  }
  fileCandidates.sort((a, b) => b.score - a.score);
  const topFiles = fileCandidates.slice(0, fileCap);

  const regions: LocalizationCandidate[] = [];
  for (const file of topFiles) {
    const absPath = resolve(input.cwd, file.path);
    const detected = detectRegions(absPath);
    for (const region of detected.slice(0, regionCap)) {
      const snippet = readSnippet(absPath, region.startLine - 1, region.endLine - region.startLine + 1) ?? "";
      const score = await scorer({ path: file.path, snippet, issue: input.issue });
      regions.push({
        path: file.path,
        score: score.score,
        reason: score.reason,
        region: { startLine: region.startLine, endLine: region.endLine },
      });
    }
  }
  regions.sort((a, b) => b.score - a.score);
  return regions;
}

async function collectCandidatePaths(input: LocalizeInput): Promise<ReadonlyArray<string>> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const absRoot = resolve(input.cwd);
  const toRelative = (path: string): string => {
    if (!isAbsolute(path)) return path;
    const rel = relative(absRoot, path);
    return rel.length > 0 ? rel : path;
  };
  const addPath = (path: string): void => {
    const normalized = toRelative(path);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      ordered.push(normalized);
    }
  };

  for (const hint of input.hintFiles ?? []) {
    addPath(hint);
  }
  const tokens = extractTokens(input.issue);
  if (tokens.length === 0) return ordered;

  const allFiles = await rgListFiles(absRoot);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    let added = 0;
    for (const path of allFiles) {
      if (added >= FILE_HITS_PER_TOKEN) break;
      if (path.toLowerCase().includes(lower)) {
        addPath(path);
        added += 1;
      }
    }
  }

  const contentHits = await rgSearchAnyToken(absRoot, tokens, SEARCH_HITS_PER_TOKEN);
  for (const path of contentHits) {
    addPath(path);
  }

  return ordered;
}

async function rgListFiles(absRoot: string): Promise<ReadonlyArray<string>> {
  const args = ["--files", "--hidden", ...buildGlobArgs(), absRoot];
  const stdout = await runRg(args);
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function rgSearchAnyToken(
  absRoot: string,
  tokens: ReadonlyArray<string>,
  perTokenCap: number,
): Promise<ReadonlyArray<string>> {
  const patternArgs: string[] = [];
  for (const token of tokens) {
    patternArgs.push("-e", token);
  }
  const args = [
    "-l",
    "--hidden",
    "--max-count",
    String(perTokenCap),
    ...buildGlobArgs(),
    ...patternArgs,
    absRoot,
  ];
  const stdout = await runRg(args);
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildGlobArgs(): string[] {
  const args: string[] = [];
  for (const glob of RG_EXCLUDE_GLOBS) {
    args.push("--glob", glob);
  }
  return args;
}

async function runRg(args: string[]): Promise<string> {
  try {
    const result = await execFileAsync("rg", args, { maxBuffer: RG_MAX_BUFFER });
    return result.stdout;
  } catch (error) {
    return (error as { stdout?: string }).stdout ?? "";
  }
}

function extractTokens(text: string): ReadonlyArray<string> {
  const matches = text.match(/[A-Za-z_][A-Za-z_0-9]{3,}/g) ?? [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const token of matches) {
    if (!seen.has(token)) {
      seen.add(token);
      tokens.push(token);
    }
    if (tokens.length >= 6) break;
  }
  return tokens;
}

function readSnippet(absPath: string, startLine: number, count: number): string | null {
  try {
    statSync(absPath);
    const lines = readFileSync(absPath, "utf8").split(/\r?\n/);
    return lines.slice(startLine, startLine + count).join("\n");
  } catch {
    return null;
  }
}

function detectRegions(absPath: string): ReadonlyArray<{ startLine: number; endLine: number }> {
  const ext = extname(absPath).toLowerCase();
  const matcher = TS_LIKE.has(ext) ? TS_DECLARATION : PY_LIKE.has(ext) ? PY_DECLARATION : null;
  if (!matcher) return [];
  let lines: string[];
  try {
    lines = readFileSync(absPath, "utf8").split(/\r?\n/);
  } catch {
    return [];
  }
  const starts: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index] ?? "";
    if (matcher.test(text)) {
      starts.push(index + 1);
    }
  }
  if (starts.length === 0) return [{ startLine: 1, endLine: Math.min(lines.length, 80) }];
  const regions: { startLine: number; endLine: number }[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const startLine = starts[index] ?? 1;
    const endLine = Math.min(lines.length, (starts[index + 1] ?? lines.length + 1) - 1);
    regions.push({ startLine, endLine });
  }
  return regions;
}
