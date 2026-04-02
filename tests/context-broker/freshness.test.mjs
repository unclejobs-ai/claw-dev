import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  FreshnessCheckError,
  assembleContextPacket,
  assertFreshContext,
  checkFreshness,
} from "@unclecode/context-broker";

const worktreeDir = new URL("../../", import.meta.url).pathname;

async function createPacket(gitHeadSha) {
  const packet = await assembleContextPacket({
    rootDir: worktreeDir,
    mode: "default",
    trigger: "manual",
  });

  return {
    ...packet,
    gitHeadSha,
    freshness: {
      ...packet.freshness,
      gitHeadSha,
      packetSha: gitHeadSha,
    },
  };
}

describe("checkFreshness", () => {
  it("reports fresh when the packet sha matches HEAD", async () => {
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: worktreeDir,
      encoding: "utf8",
    }).trim();
    const packet = await createPacket(headSha);
    const freshness = await checkFreshness(packet, worktreeDir);

    assert.equal(freshness.status, "fresh");
    assert.deepEqual(freshness.modifiedPaths, []);
  });

  it("reports stale when the packet sha does not match HEAD", async () => {
    const packet = await createPacket("0".repeat(40));
    const freshness = await checkFreshness(packet, worktreeDir);

    assert.equal(freshness.status, "stale");
    assert.ok(freshness.modifiedPaths.length >= 0);
  });

  it("raises an explicit freshness gate failure for stale packets", async () => {
    const packet = await createPacket("0".repeat(40));
    const freshness = await checkFreshness(packet, worktreeDir);

    assert.throws(() => assertFreshContext(freshness), FreshnessCheckError);
  });

  it("returns unknown freshness outside a git repository", async () => {
    const nonRepoDir = mkdtempSync(path.join(os.tmpdir(), "unclecode-non-repo-"));
    const packet = await createPacket("0".repeat(40));
    const freshness = await checkFreshness(packet, nonRepoDir);

    assert.equal(freshness.status, "unknown");
    assert.deepEqual(freshness.modifiedPaths, []);
    assert.throws(() => assertFreshContext(freshness), FreshnessCheckError);
  });

  it("reports stale when the worktree changes after packet creation without a new commit", async () => {
    const repoDir = mkdtempSync(path.join(os.tmpdir(), "unclecode-dirty-repo-"));

    execFileSync("git", ["init"], { cwd: repoDir, encoding: "utf8" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoDir, encoding: "utf8" });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: repoDir, encoding: "utf8" });
    execFileSync("git", ["branch", "-m", "main"], { cwd: repoDir, encoding: "utf8" });
    execFileSync("sh", ["-c", "printf 'line one\n' > note.txt"], { cwd: repoDir, encoding: "utf8" });
    execFileSync("git", ["add", "note.txt"], { cwd: repoDir, encoding: "utf8" });
    execFileSync("git", ["commit", "-m", "init"], { cwd: repoDir, encoding: "utf8" });

    const packet = await assembleContextPacket({
      rootDir: repoDir,
      mode: "default",
    });

    execFileSync("sh", ["-c", "printf 'line one\nline two' > note.txt"], { cwd: repoDir, encoding: "utf8" });

    const freshness = await checkFreshness(packet, repoDir);

    assert.equal(freshness.status, "stale");
    assert.deepEqual(freshness.modifiedPaths, ["note.txt"]);
  });
});
