import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  FreshnessCheckError,
  GitCommandError,
  type ContextPacket,
  type FreshnessResult,
} from "./types.js";

const execFile = promisify(execFileCallback);
const ZERO_SHA = "0".repeat(40);

function parseStatusPaths(output: string): string[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .filter((line) => line.length >= 4)
    .map((line) => line.slice(3))
    .map((filePath) => {
      const renamedPath = filePath.split(" -> ").at(-1);

      return renamedPath ?? filePath;
    });
}

async function computeFingerprint(rootDir: string, modifiedPaths: readonly string[]): Promise<string> {
  const hash = createHash("sha256");

  for (const filePath of [...modifiedPaths].sort((left, right) => left.localeCompare(right))) {
    hash.update(filePath);

    try {
      hash.update(await readFile(path.join(rootDir, filePath)));
    } catch (error) {
      hash.update("[missing]");
      hash.update(error instanceof Error ? error.name : "unknown-error");
    }
  }

  return hash.digest("hex");
}

export async function getWorktreeFingerprint(rootDir: string): Promise<{
  readonly fingerprint: string;
  readonly modifiedPaths: readonly string[];
}> {
  const output = await runGit(rootDir, ["status", "--porcelain=v1", "--untracked-files=no"]);
  const modifiedPaths = parseStatusPaths(output);

  if (modifiedPaths.length === 0) {
    return {
      fingerprint: "clean",
      modifiedPaths,
    };
  }

  return {
    fingerprint: await computeFingerprint(rootDir, modifiedPaths),
    modifiedPaths,
  };
}

function splitLines(output: string): string[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function runGit(rootDir: string, args: readonly string[]): Promise<string> {
  const command = ["git", ...args];

  try {
    const { stdout } = await execFile("git", [...args], {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });

    return stdout;
  } catch (error) {
    throw new GitCommandError(command, { cause: error });
  }
}

async function isInsideGitWorkTree(rootDir: string): Promise<boolean> {
  try {
    const output = await runGit(rootDir, ["rev-parse", "--is-inside-work-tree"]);

    return output.trim() === "true";
  } catch (error) {
    if (error instanceof GitCommandError) {
      return false;
    }

    throw error;
  }
}

function toUnknownFreshness(packet: ContextPacket, checkedAt: string): FreshnessResult {
  return {
    status: "unknown",
    checkedAt,
    gitHeadSha: packet.gitHeadSha,
    packetSha: packet.gitHeadSha,
    modifiedPaths: [],
  };
}

export async function checkFreshness(packet: ContextPacket, rootDir: string): Promise<FreshnessResult> {
  const checkedAt = new Date().toISOString();

  try {
    const gitHeadSha = (await runGit(rootDir, ["rev-parse", "HEAD"])).trim();
    const worktreeState = await getWorktreeFingerprint(rootDir);

    if (gitHeadSha === packet.gitHeadSha && worktreeState.fingerprint === packet.worktreeFingerprint) {
      return {
        status: "fresh",
        checkedAt,
        gitHeadSha,
        packetSha: packet.gitHeadSha,
        modifiedPaths: [],
      };
    }

    try {
      const modifiedPaths = Array.from(
        new Set([
          ...splitLines(await runGit(rootDir, ["diff", "--name-only", packet.gitHeadSha, "HEAD"])),
          ...worktreeState.modifiedPaths,
        ]),
      );

      return {
        status: "stale",
        checkedAt,
        gitHeadSha,
        packetSha: packet.gitHeadSha,
        modifiedPaths,
      };
    } catch (error) {
      if (error instanceof GitCommandError) {
        return {
          status: "stale",
          checkedAt,
          gitHeadSha,
          packetSha: packet.gitHeadSha,
          modifiedPaths: [],
        };
      }

      throw new FreshnessCheckError("Failed to diff packet freshness state", { cause: error });
    }
  } catch (error) {
    if (error instanceof GitCommandError) {
      if (packet.gitHeadSha === ZERO_SHA && (await isInsideGitWorkTree(rootDir))) {
        const worktreeState = await getWorktreeFingerprint(rootDir);

        return {
          status: worktreeState.fingerprint === packet.worktreeFingerprint ? "fresh" : "stale",
          checkedAt,
          gitHeadSha: ZERO_SHA,
          packetSha: packet.gitHeadSha,
          modifiedPaths: worktreeState.modifiedPaths,
        };
      }

      return toUnknownFreshness(packet, checkedAt);
    }

    if (error instanceof FreshnessCheckError) {
      throw error;
    }

    throw new FreshnessCheckError("Failed to evaluate packet freshness", { cause: error });
  }
}

export function assertFreshContext(freshness: FreshnessResult): void {
  if (freshness.status === "fresh") {
    return;
  }

  throw new FreshnessCheckError(`Context packet freshness gate failed with status: ${freshness.status}`, {
    cause: freshness,
  });
}
