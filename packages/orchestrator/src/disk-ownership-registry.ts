/**
 * Disk-backed file ownership registry — per-path lock file at
 * <RUN_ROOT>/locks/<sha256(path)>.lock writes the workerId and pid.
 *
 * Same claimAll/releaseAll semantics as the in-process registry, but the
 * source of truth lives on disk so cross-process workers (children spawned
 * by team-runner, OMX lanes, Hermes acpx) can coordinate.
 *
 * Lock file is created atomically with `wx` open; conflicts surface as
 * Errors with `code = "EEXIST"` so callers can decide between waiting and
 * aborting. releaseAll is idempotent — safe to call from a finally block.
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export type DiskClaimResult =
  | { readonly ok: true; readonly claimed: ReadonlyArray<string> }
  | { readonly ok: false; readonly conflictPath: string; readonly conflictHolder: string };

function lockPath(runRoot: string, filePath: string): string {
  const hash = createHash("sha256").update(filePath).digest("hex");
  return join(runRoot, "locks", `${hash}.lock`);
}

function ensureLocksDir(runRoot: string): void {
  mkdirSync(join(runRoot, "locks"), { recursive: true });
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM") return true;
    return false;
  }
}

function reclaimIfStale(runRoot: string, workerId: string, filePath: string, rawHolder: string): { ok: boolean; conflictHolder?: string } {
  const parts = rawHolder.split(":");
  const ownerId = parts[0] ?? rawHolder;
  const ownerPid = Number.parseInt(parts[1] ?? "", 10);
  if (Number.isFinite(ownerPid) && ownerPid > 0 && !isPidAlive(ownerPid)) {
    const path = lockPath(runRoot, filePath);
    try {
      unlinkSync(path);
    } catch {
      /* race with another sweeper — fall through to reclaim attempt */
    }
    const fd = openSync(path, "wx");
    writeFileSync(fd, `${workerId}:${process.pid}:${Date.now()}`);
    closeSync(fd);
    return { ok: true };
  }
  return { ok: false, conflictHolder: ownerId };
}

function tryClaimSingle(runRoot: string, workerId: string, filePath: string): { ok: boolean; conflictHolder?: string } {
  const path = lockPath(runRoot, filePath);
  ensureLocksDir(runRoot);
  let fd: number;
  try {
    fd = openSync(path, "wx");
  } catch (error) {
    const rawHolder = existsSync(path) ? readFileSync(path, "utf8").trim() : "(unknown)";
    const conflictHolder = rawHolder.split(":")[0] ?? rawHolder;
    if (conflictHolder === workerId) {
      return { ok: true };
    }
    return reclaimIfStale(runRoot, workerId, filePath, rawHolder);
  }
  writeFileSync(fd, `${workerId}:${process.pid}:${Date.now()}`);
  closeSync(fd);
  return { ok: true };
}

export function sweepStaleLocks(runRoot: string): { swept: number; live: number } {
  const dir = join(runRoot, "locks");
  if (!existsSync(dir)) return { swept: 0, live: 0 };
  let swept = 0;
  let live = 0;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".lock")) continue;
    const path = join(dir, entry);
    try {
      const raw = readFileSync(path, "utf8").trim();
      const pidStr = raw.split(":")[1];
      const pid = pidStr ? Number.parseInt(pidStr, 10) : Number.NaN;
      if (Number.isFinite(pid) && !isPidAlive(pid)) {
        unlinkSync(path);
        swept += 1;
      } else {
        live += 1;
      }
    } catch {
      /* unreadable lock — leave it alone */
    }
  }
  return { swept, live };
}

export function diskClaimAll(input: {
  readonly runRoot: string;
  readonly workerId: string;
  readonly filePaths: ReadonlyArray<string>;
}): DiskClaimResult {
  const ordered = [...new Set(input.filePaths)].sort();
  const acquired: string[] = [];
  for (const filePath of ordered) {
    const attempt = tryClaimSingle(input.runRoot, input.workerId, filePath);
    if (!attempt.ok) {
      for (const claimed of acquired) {
        diskRelease({ runRoot: input.runRoot, workerId: input.workerId, filePath: claimed });
      }
      return {
        ok: false,
        conflictPath: filePath,
        conflictHolder: attempt.conflictHolder ?? "(unknown)",
      };
    }
    acquired.push(filePath);
  }
  return { ok: true, claimed: acquired };
}

export function diskRelease(input: {
  readonly runRoot: string;
  readonly workerId: string;
  readonly filePath: string;
}): void {
  const path = lockPath(input.runRoot, input.filePath);
  if (!existsSync(path)) return;
  const holder = readFileSync(path, "utf8").split(":")[0];
  if (holder !== input.workerId) return;
  try {
    unlinkSync(path);
  } catch {
    // already gone
  }
}

export function diskReleaseAll(input: {
  readonly runRoot: string;
  readonly workerId: string;
  readonly filePaths: ReadonlyArray<string>;
}): void {
  for (const filePath of input.filePaths) {
    diskRelease({ runRoot: input.runRoot, workerId: input.workerId, filePath });
  }
}

export function diskOwnerOf(runRoot: string, filePath: string): string | undefined {
  const path = lockPath(runRoot, filePath);
  if (!existsSync(path)) return undefined;
  return readFileSync(path, "utf8").split(":")[0];
}
