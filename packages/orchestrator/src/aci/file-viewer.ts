/**
 * ACI File Viewer (SWE-agent NeurIPS 2024) — open file with a 100-line window,
 * scroll up/down, goto line. Returns text with prepended line numbers and a
 * header that names the file, total lines, and lines elided above/below.
 */

import { readFileSync, statSync } from "node:fs";

import { assertWithinWorkspace } from "./path-containment.js";

export const DEFAULT_VIEWER_WINDOW = 100;

export type ViewerState = {
  readonly path: string;
  readonly absPath: string;
  readonly totalLines: number;
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly window: number;
};

export type ViewerOutput = {
  readonly state: ViewerState;
  readonly content: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readLines(absPath: string): string[] {
  return readFileSync(absPath, "utf8").split(/\r?\n/);
}

function renderWindow(absPath: string, state: ViewerState): string {
  const lines = readLines(absPath);
  const visible = lines.slice(state.windowStart - 1, state.windowEnd);
  const numbered = visible.map((line, index) => `${state.windowStart + index}: ${line}`).join("\n");
  const above = state.windowStart - 1;
  const below = Math.max(0, state.totalLines - state.windowEnd);
  const header = [
    `[File] ${state.path}`,
    `[Total] ${state.totalLines} lines`,
    `[Window] lines ${state.windowStart}-${state.windowEnd} (${above} above, ${below} below)`,
  ].join("\n");
  return `${header}\n${numbered}`;
}

export function openFile(input: { cwd: string; path: string; window?: number }): ViewerOutput {
  const window = input.window ?? DEFAULT_VIEWER_WINDOW;
  const absPath = assertWithinWorkspace(input.cwd, input.path);
  statSync(absPath);
  const lines = readLines(absPath);
  const totalLines = lines.length;
  const windowStart = 1;
  const windowEnd = Math.min(totalLines, windowStart + window - 1);
  const state: ViewerState = { path: input.path, absPath, totalLines, windowStart, windowEnd, window };
  return { state, content: renderWindow(absPath, state) };
}

export function gotoLine(state: ViewerState, line: number): ViewerOutput {
  const target = clamp(line, 1, state.totalLines);
  const half = Math.floor(state.window / 2);
  const windowStart = clamp(target - half, 1, Math.max(1, state.totalLines - state.window + 1));
  const windowEnd = Math.min(state.totalLines, windowStart + state.window - 1);
  const next: ViewerState = { ...state, windowStart, windowEnd };
  return { state: next, content: renderWindow(state.absPath, next) };
}

export function scroll(state: ViewerState, direction: "up" | "down"): ViewerOutput {
  const delta = direction === "down" ? state.window : -state.window;
  const windowStart = clamp(
    state.windowStart + delta,
    1,
    Math.max(1, state.totalLines - state.window + 1),
  );
  const windowEnd = Math.min(state.totalLines, windowStart + state.window - 1);
  const next: ViewerState = { ...state, windowStart, windowEnd };
  return { state: next, content: renderWindow(state.absPath, next) };
}
