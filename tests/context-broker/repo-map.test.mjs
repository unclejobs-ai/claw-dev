import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { generateRepoMap } from "@unclecode/context-broker";

const worktreeDir = new URL("../../", import.meta.url).pathname;

describe("generateRepoMap", () => {
  it("returns repo map entries for the current worktree", async () => {
    const repoMap = await generateRepoMap(worktreeDir);

    assert.ok(repoMap.entries.length > 0);
    assert.equal(repoMap.totalFiles, repoMap.entries.length);
    assert.match(repoMap.gitHeadSha, /^[a-f0-9]{40}$/);

    let totalLines = 0;

    for (const entry of repoMap.entries) {
      assert.equal(typeof entry.path, "string");
      assert.ok(entry.path.length > 0);
      assert.ok(entry.lineCount >= 0);
      assert.ok(entry.hotspotScore >= 0);
      assert.ok(entry.hotspotScore <= 1);
      assert.ok(!entry.path.includes("node_modules/"));
      assert.ok(!entry.path.includes("dist/"));
      assert.ok(!entry.path.includes(".git/"));

      totalLines += entry.lineCount;
    }

    assert.equal(repoMap.totalLines, totalLines);
  });

  it("returns a valid empty repo map for a git repo with no commits", async () => {
    const emptyRepoDir = mkdtempSync(path.join(os.tmpdir(), "unclecode-empty-repo-"));

    execFileSync("git", ["init"], { cwd: emptyRepoDir, encoding: "utf8" });

    const repoMap = await generateRepoMap(emptyRepoDir);

    assert.equal(repoMap.rootDir, emptyRepoDir);
    assert.equal(repoMap.entries.length, 0);
    assert.equal(repoMap.totalFiles, 0);
    assert.equal(repoMap.totalLines, 0);
    assert.equal(repoMap.gitHeadSha, "0".repeat(40));
  });

  it("handles staged tracked files before the first commit", async () => {
    const stagedRepoDir = mkdtempSync(path.join(os.tmpdir(), "unclecode-staged-repo-"));

    execFileSync("git", ["init"], { cwd: stagedRepoDir, encoding: "utf8" });
    writeFileSync(path.join(stagedRepoDir, "notes.txt"), "hello\nworld\n", "utf8");
    execFileSync("git", ["add", "notes.txt"], { cwd: stagedRepoDir, encoding: "utf8" });

    const repoMap = await generateRepoMap(stagedRepoDir);

    assert.equal(repoMap.gitHeadSha, "0".repeat(40));
    assert.equal(repoMap.totalFiles, 1);
    assert.equal(repoMap.entries[0]?.path, "notes.txt");
    assert.equal(repoMap.entries[0]?.lineCount, 2);
  });

  it("counts logical lines when the file has no trailing newline", async () => {
    const repoDir = mkdtempSync(path.join(os.tmpdir(), "unclecode-linecount-repo-"));

    execFileSync("git", ["init"], { cwd: repoDir, encoding: "utf8" });
    writeFileSync(path.join(repoDir, "single-line.txt"), "hello", "utf8");
    execFileSync("git", ["add", "single-line.txt"], { cwd: repoDir, encoding: "utf8" });

    const repoMap = await generateRepoMap(repoDir);

    assert.equal(repoMap.entries[0]?.path, "single-line.txt");
    assert.equal(repoMap.entries[0]?.lineCount, 1);
    assert.equal(repoMap.totalLines, 1);
  });
});
