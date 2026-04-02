import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { GitCommandError, type RepoMap, type RepoMapEntry } from "./types.js";

const execFile = promisify(execFileCallback);

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

export function detectHotspots(repoMap: RepoMap, topN = 10): RepoMapEntry[] {
  if (topN <= 0) {
    return [];
  }

  return [...repoMap.entries]
    .sort(
      (left, right) =>
        right.hotspotScore - left.hotspotScore ||
        right.changeFrequency - left.changeFrequency ||
        left.path.localeCompare(right.path),
    )
    .slice(0, topN);
}

export async function summarizeDiff(rootDir: string, sinceSha: string): Promise<readonly string[]> {
  const output = await runGit(rootDir, ["diff", "--name-only", sinceSha, "HEAD"]);

  return splitLines(output);
}
