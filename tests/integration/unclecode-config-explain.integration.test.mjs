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

test("built unclecode cli explains the effective config and active mode prompt injection", () => {
  const result = spawnSync("node", [builtCliEntrypoint, "config", "explain", "--mode", "search"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      UNCLECODE_MODEL: "integration-env-model",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Source order/i);
  assert.match(result.stdout, /Active mode:\s+search/i);
  assert.match(result.stdout, /model\s*=\s*integration-env-model/i);
  assert.match(result.stdout, /winner:\s*environment/i);
  assert.match(result.stdout, /active-mode/i);
  assert.match(result.stdout, /Search/i);
});
