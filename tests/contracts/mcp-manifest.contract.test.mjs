import assert from "node:assert/strict";
import test from "node:test";

import {
  MCP_CONFIG_SCOPES,
  MCP_CONNECTION_STATES,
  MCP_TRANSPORTS,
} from "@unclecode/contracts";

test("mcp-manifest fixtures expose canonical transport, scope, and connection states", () => {
  assert.deepEqual(MCP_TRANSPORTS, [
    "stdio",
    "sse",
    "sse-ide",
    "http",
    "ws",
    "sdk",
    "claudeai-proxy",
  ]);

  assert.deepEqual(MCP_CONFIG_SCOPES, [
    "local",
    "user",
    "project",
    "dynamic",
    "enterprise",
    "claudeai",
    "managed",
  ]);

  assert.deepEqual(MCP_CONNECTION_STATES, [
    "connected",
    "failed",
    "needs-auth",
    "pending",
    "disabled",
  ]);
});
