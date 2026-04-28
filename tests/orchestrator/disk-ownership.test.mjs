import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  diskClaimAll,
  diskRelease,
  diskReleaseAll,
  diskOwnerOf,
  sweepStaleLocks,
} from "@unclecode/orchestrator";

function makeRunRoot() {
  return mkdtempSync(join(tmpdir(), "uc-disk-own-"));
}

test("diskClaimAll grants exclusive ownership", () => {
  const runRoot = makeRunRoot();
  try {
    const result = diskClaimAll({ runRoot, workerId: "w1", filePaths: ["src/a.ts", "src/b.ts"] });
    assert.equal(result.ok, true);
    assert.equal(diskOwnerOf(runRoot, "src/a.ts"), "w1");
    assert.equal(diskOwnerOf(runRoot, "src/b.ts"), "w1");
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }
});

test("diskClaimAll rejects conflicting writer and rolls back partial claims", () => {
  const runRoot = makeRunRoot();
  try {
    const first = diskClaimAll({ runRoot, workerId: "w1", filePaths: ["src/a.ts"] });
    assert.equal(first.ok, true);
    const second = diskClaimAll({ runRoot, workerId: "w2", filePaths: ["src/a.ts", "src/c.ts"] });
    assert.equal(second.ok, false);
    assert.equal(second.conflictHolder, "w1");
    assert.equal(diskOwnerOf(runRoot, "src/c.ts"), undefined);
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }
});

test("diskRelease only removes ownership held by the caller", () => {
  const runRoot = makeRunRoot();
  try {
    diskClaimAll({ runRoot, workerId: "w1", filePaths: ["src/a.ts"] });
    diskRelease({ runRoot, workerId: "w2", filePath: "src/a.ts" });
    assert.equal(diskOwnerOf(runRoot, "src/a.ts"), "w1");
    diskRelease({ runRoot, workerId: "w1", filePath: "src/a.ts" });
    assert.equal(diskOwnerOf(runRoot, "src/a.ts"), undefined);
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }
});

test("diskClaimAll is idempotent for the same worker", () => {
  const runRoot = makeRunRoot();
  try {
    const a = diskClaimAll({ runRoot, workerId: "w1", filePaths: ["src/a.ts"] });
    assert.equal(a.ok, true);
    const b = diskClaimAll({ runRoot, workerId: "w1", filePaths: ["src/a.ts"] });
    assert.equal(b.ok, true);
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }
});

test("sweepStaleLocks reclaims locks for dead pids and leaves live ones", () => {
  const runRoot = makeRunRoot();
  try {
    diskClaimAll({ runRoot, workerId: "live", filePaths: ["src/live.ts"] });
    const stalePath = join(runRoot, "locks", `${createHash("sha256").update("src/dead.ts").digest("hex")}.lock`);
    writeFileSync(stalePath, "dead:99999999:1");
    const result = sweepStaleLocks(runRoot);
    assert.equal(result.swept, 1);
    assert.equal(result.live, 1);
    assert.equal(diskOwnerOf(runRoot, "src/live.ts"), "live");
    const reclaimed = diskClaimAll({ runRoot, workerId: "fresh", filePaths: ["src/dead.ts"] });
    assert.equal(reclaimed.ok, true);
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }
});

test("diskReleaseAll bulk-removes worker locks", () => {
  const runRoot = makeRunRoot();
  try {
    diskClaimAll({ runRoot, workerId: "w1", filePaths: ["src/a.ts", "src/b.ts"] });
    diskReleaseAll({ runRoot, workerId: "w1", filePaths: ["src/a.ts", "src/b.ts"] });
    assert.equal(diskOwnerOf(runRoot, "src/a.ts"), undefined);
    assert.equal(diskOwnerOf(runRoot, "src/b.ts"), undefined);
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }
});
