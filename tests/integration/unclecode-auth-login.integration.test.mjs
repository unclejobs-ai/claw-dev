import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDirectory, "../..");
const builtCliEntrypoint = path.join(workspaceRoot, "apps/unclecode-cli/dist/index.js");

test("built unclecode cli prints a browser oauth URL in print mode", () => {
  const result = spawnSync("node", [builtCliEntrypoint, "auth", "login", "--browser", "--print"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_OAUTH_CLIENT_ID: "client_123",
      OPENAI_OAUTH_REDIRECT_URI: "http://localhost:7777/callback",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /https:\/\/auth\.openai\.com\/oauth\/authorize/);
  assert.match(result.stdout, /client_id=client_123/);
});
