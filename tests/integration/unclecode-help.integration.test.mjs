import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDirectory, "../..");
const builtCliEntrypoint = path.join(
  workspaceRoot,
  "apps/unclecode-cli/dist/index.js",
);

test("built unclecode cli prints help for the workspace command surface", () => {
  const result = spawnSync("node", [builtCliEntrypoint, "--help"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: unclecode/);
  assert.match(result.stdout, /\bauth\b/);
  assert.match(result.stdout, /\bconfig\b/);
  assert.match(result.stdout, /\btui\b/);
});

test("built unclecode cli prints a version string", () => {
  const result = spawnSync("node", [builtCliEntrypoint, "--version"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout.trim(), /^0\.1\.0$/);
});

test("built unclecode cli without a TTY still prints command help", () => {
  const result = spawnSync("node", [builtCliEntrypoint], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: unclecode/);
});
