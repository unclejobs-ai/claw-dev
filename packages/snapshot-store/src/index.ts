/**
 * Snapshot store — captures file content before each tool mutation so the
 * agent (or operator) can /undo and /redo to step boundaries.
 *
 * Storage: .unclecode/snapshots/<sessionId>/<turnIdx>/<sha256(path)>.snap
 * with a manifest that records (path, sha256, capturedAt). Cheap and
 * filesystem-only — no git plumbing dependency, works even on
 * non-git workspaces.
 *
 * The hooks integration (orchestrator → snapshotBeforeWrite) is a follow-up;
 * this package ships the storage primitive + restore.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve } from "node:path";

const SNAP_DIR = "snapshots";
const MANIFEST_NAME = "manifest.json";

export type SnapshotEntry = {
  readonly path: string;
  readonly sha256: string;
  readonly capturedAt: number;
};

export type SnapshotManifest = {
  readonly sessionId: string;
  readonly turnIdx: number;
  readonly capturedAt: number;
  readonly entries: ReadonlyArray<SnapshotEntry>;
};

export type SnapshotInput = {
  readonly workspaceRoot: string;
  readonly sessionId: string;
  readonly turnIdx: number;
  readonly paths: ReadonlyArray<string>;
};

export type RestoreInput = {
  readonly workspaceRoot: string;
  readonly sessionId: string;
  readonly turnIdx: number;
};

function snapshotDir(workspaceRoot: string, sessionId: string, turnIdx: number): string {
  return join(workspaceRoot, ".unclecode", SNAP_DIR, sessionId, String(turnIdx));
}

function blobPath(dir: string, hash: string): string {
  return join(dir, `${hash}.snap`);
}

export function captureSnapshot(input: SnapshotInput): SnapshotManifest {
  const dir = snapshotDir(input.workspaceRoot, input.sessionId, input.turnIdx);
  mkdirSync(dir, { recursive: true });
  const entries: SnapshotEntry[] = [];
  for (const relPath of input.paths) {
    const absPath = resolve(input.workspaceRoot, relPath);
    if (!existsSync(absPath)) continue;
    const content = readFileSync(absPath);
    const sha256 = createHash("sha256").update(content).digest("hex");
    writeFileSync(blobPath(dir, sha256), content);
    entries.push({
      path: relative(input.workspaceRoot, absPath) || relPath,
      sha256,
      capturedAt: Date.now(),
    });
  }
  const manifest: SnapshotManifest = {
    sessionId: input.sessionId,
    turnIdx: input.turnIdx,
    capturedAt: Date.now(),
    entries,
  };
  writeFileSync(join(dir, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function readSnapshotManifest(input: RestoreInput): SnapshotManifest | undefined {
  const dir = snapshotDir(input.workspaceRoot, input.sessionId, input.turnIdx);
  const path = join(dir, MANIFEST_NAME);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as SnapshotManifest;
}

export function restoreSnapshot(input: RestoreInput): {
  readonly restored: ReadonlyArray<string>;
  readonly missing: ReadonlyArray<string>;
} {
  const manifest = readSnapshotManifest(input);
  if (!manifest) {
    return { restored: [], missing: [] };
  }
  const dir = snapshotDir(input.workspaceRoot, input.sessionId, input.turnIdx);
  const restored: string[] = [];
  const missing: string[] = [];
  for (const entry of manifest.entries) {
    const blob = blobPath(dir, entry.sha256);
    if (!existsSync(blob)) {
      missing.push(entry.path);
      continue;
    }
    const target = resolve(input.workspaceRoot, entry.path);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, readFileSync(blob));
    restored.push(entry.path);
  }
  return { restored, missing };
}

export function listSnapshotTurns(input: { workspaceRoot: string; sessionId: string }): ReadonlyArray<number> {
  const dir = join(input.workspaceRoot, ".unclecode", SNAP_DIR, input.sessionId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d+$/.test(name))
    .map((name) => Number.parseInt(name, 10))
    .sort((a, b) => a - b);
}

export function pruneSnapshotsBefore(input: { workspaceRoot: string; sessionId: string; keepFromTurn: number }): number {
  const turns = listSnapshotTurns(input);
  let pruned = 0;
  for (const turn of turns) {
    if (turn < input.keepFromTurn) {
      const dir = snapshotDir(input.workspaceRoot, input.sessionId, turn);
      rmSync(dir, { recursive: true, force: true });
      pruned += 1;
    }
  }
  return pruned;
}
