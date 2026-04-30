import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applyPatch, parseUnifiedDiff } from "@unclecode/orchestrator";

test("parseUnifiedDiff extracts a single hunk", () => {
  const patch =
    "--- a/x.txt\n+++ b/x.txt\n@@ -1,2 +1,2 @@\n alpha\n-beta\n+BETA\n";
  const files = parseUnifiedDiff(patch);
  assert.equal(files.length, 1);
  assert.equal(files[0].newPath, "x.txt");
  assert.equal(files[0].hunks.length, 1);
});

test("applyPatch applies clean hunk and rewrites file", () => {
  const dir = mkdtempSync(join(tmpdir(), "uc-patch-"));
  const path = join(dir, "x.txt");
  writeFileSync(path, "alpha\nbeta\ngamma");
  try {
    const patch =
      "--- a/x.txt\n+++ b/x.txt\n@@ -1,3 +1,3 @@\n alpha\n-beta\n+BETA\n gamma\n";
    const result = applyPatch({ cwd: dir, patch });
    assert.equal(result.applied.length, 1);
    assert.equal(result.rejected.length, 0);
    assert.equal(readFileSync(path, "utf8"), "alpha\nBETA\ngamma");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyPatch rejects mismatched hunk", () => {
  const dir = mkdtempSync(join(tmpdir(), "uc-patch-"));
  const path = join(dir, "x.txt");
  writeFileSync(path, "alpha\nWRONG\ngamma");
  try {
    const patch =
      "--- a/x.txt\n+++ b/x.txt\n@@ -1,3 +1,3 @@\n alpha\n-beta\n+BETA\n gamma\n";
    const result = applyPatch({ cwd: dir, patch });
    assert.equal(result.applied.length, 0);
    assert.equal(result.rejected.length, 1);
    assert.match(result.rejected[0].reason, /did not match/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const SYMLINKS_REQUIRE_ELEVATION = process.platform === "win32";

test(
  "applyPatch rejects writes to a workspace-internal symlink targeting outside",
  { skip: SYMLINKS_REQUIRE_ELEVATION },
  async () => {
    // Q27 / system-level regression for the allowMissing symlink-parent
    // escape patched in commit 5e9e66e. apply-patch.ts:107 shares the
    // `allowMissing:true` sink with team-mini-loop write_file, so this
    // test pins the same invariant for the patch dispatch surface.
    const { symlinkSync, existsSync, realpathSync } = await import("node:fs");
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "uc-patch-symlink-")));
    const target = realpathSync(mkdtempSync(join(tmpdir(), "uc-patch-symlink-target-")));
    symlinkSync(target, join(dir, "escape-link"));
    try {
      const patch =
        "--- a/escape-link/foo.txt\n+++ b/escape-link/foo.txt\n@@ -0,0 +1 @@\n+pwned\n";
      const result = applyPatch({ cwd: dir, patch });
      assert.equal(result.applied.length, 0);
      assert.equal(result.rejected.length, 1);
      assert.match(
        result.rejected[0].reason,
        /escapes workspace|escape-link/,
      );
      assert.equal(
        existsSync(join(target, "foo.txt")),
        false,
        "apply_patch must not have crossed the symlink to the outside target",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(target, { recursive: true, force: true });
    }
  },
);
