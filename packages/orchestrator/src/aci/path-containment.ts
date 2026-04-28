/**
 * Path containment guard — refuses absolute paths, .. traversal, and
 * symlink-escape paths. Every ACI / snapshot / SOP write path passes user-
 * (or LLM-) supplied paths through here before opening the fd.
 *
 * Returns the resolved absolute path on success; throws on violation so
 * the caller cannot accidentally proceed.
 */

import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export type ContainmentOptions = {
  readonly allowMissing?: boolean;
};

export class PathContainmentError extends Error {
  readonly path: string;
  readonly workspaceRoot: string;
  constructor(message: string, path: string, workspaceRoot: string) {
    super(message);
    this.name = "PathContainmentError";
    this.path = path;
    this.workspaceRoot = workspaceRoot;
  }
}

function canonical(path: string, allowMissing: boolean): string {
  try {
    return realpathSync(path);
  } catch (error) {
    if (allowMissing) return path;
    throw error;
  }
}

export function assertWithinWorkspace(
  workspaceRoot: string,
  candidatePath: string,
  options: ContainmentOptions = {},
): string {
  if (typeof candidatePath !== "string" || candidatePath.length === 0) {
    throw new PathContainmentError("path is empty", candidatePath, workspaceRoot);
  }
  if (isAbsolute(candidatePath)) {
    throw new PathContainmentError(
      `absolute path rejected (must be workspace-relative): ${candidatePath}`,
      candidatePath,
      workspaceRoot,
    );
  }
  if (candidatePath.includes("\0")) {
    throw new PathContainmentError("path contains NUL byte", candidatePath, workspaceRoot);
  }
  const allowMissing = options.allowMissing ?? false;
  const rootCanonical = canonical(resolve(workspaceRoot), false);
  const resolved = resolve(rootCanonical, candidatePath);
  const resolvedCanonical = canonical(resolved, allowMissing);
  const rel = relative(rootCanonical, resolvedCanonical);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathContainmentError(
      `path escapes workspace: ${candidatePath} → ${resolvedCanonical}`,
      candidatePath,
      workspaceRoot,
    );
  }
  if (rel.length > 0 && rel.split(sep).some((segment) => segment === "..")) {
    throw new PathContainmentError(
      `path contains traversal segment: ${candidatePath}`,
      candidatePath,
      workspaceRoot,
    );
  }
  return resolvedCanonical;
}
