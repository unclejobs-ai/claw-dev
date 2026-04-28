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

import { readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";

import { findFile, searchDir } from "../aci/search.js";

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
  for (const hint of input.hintFiles ?? []) {
    const normalized = toRelative(hint);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      ordered.push(normalized);
    }
  }
  const tokens = extractTokens(input.issue);
  for (const token of tokens) {
    const filenameMatches = await findFile({ cwd: input.cwd, pattern: token, cap: 25 });
    for (const hit of filenameMatches.hits) {
      const normalized = toRelative(hit.path);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        ordered.push(normalized);
      }
    }
    const textMatches = await searchDir({ cwd: input.cwd, query: token, cap: 25 });
    for (const hit of textMatches.hits) {
      const normalized = toRelative(hit.path);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        ordered.push(normalized);
      }
    }
  }
  return ordered;
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
