import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDirectory, "../..");
const builtCliEntrypoint = path.join(workspaceRoot, "apps/unclecode-cli/dist/index.js");

test("built unclecode cli reports auth status without leaking secrets", () => {
  const result = spawnSync("node", [builtCliEntrypoint, "auth", "status"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_API_KEY: "sk-test-123",
      OPENAI_ORG_ID: "org_123",
      OPENAI_PROJECT_ID: "proj_456",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /openai/i);
  assert.match(result.stdout, /api-key-env/i);
  assert.match(result.stdout, /org_123/);
  assert.match(result.stdout, /proj_456/);
  assert.doesNotMatch(result.stdout, /sk-test-123/);
});
