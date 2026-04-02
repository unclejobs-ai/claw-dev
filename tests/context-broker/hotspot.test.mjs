import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";

import { detectHotspots, generateRepoMap, summarizeDiff } from "@unclecode/context-broker";

const worktreeDir = new URL("../../", import.meta.url).pathname;

describe("hotspot utilities", () => {
  it("returns the top hotspots in descending score order", async () => {
    const repoMap = await generateRepoMap(worktreeDir);
    const hotspots = detectHotspots(repoMap, 5);

    assert.ok(hotspots.length <= 5);

    for (let index = 1; index < hotspots.length; index += 1) {
      assert.ok(hotspots[index - 1].hotspotScore >= hotspots[index].hotspotScore);
    }
  });

  it("returns an empty array when topN is zero", async () => {
    const repoMap = await generateRepoMap(worktreeDir);

    assert.deepEqual(detectHotspots(repoMap, 0), []);
  });

  it("summarizes changed paths between an older sha and HEAD", async () => {
    const commits = execFileSync("git", ["log", "--format=%H", "-n", "2"], {
      cwd: worktreeDir,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    assert.ok(commits.length >= 2);

    const paths = await summarizeDiff(worktreeDir, commits[1]);

    assert.ok(Array.isArray(paths));
    for (const filePath of paths) {
      assert.equal(typeof filePath, "string");
    }
  });
});
