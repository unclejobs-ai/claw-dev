import assert from "node:assert/strict";
import test from "node:test";

import { createPolicyEngine } from "../../packages/policy-engine/src/index.ts";

const engine = createPolicyEngine();

test("yolo mode auto-allows workspace tool execution in local runtime", () => {
  const decision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "yolo",
    runtimeMode: "local",
    actor: "primary",
  });
  assert.equal(decision.effect, "allow");
});

test("yolo mode auto-allows workspace tool execution in sandbox runtime", () => {
  const decision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "yolo",
    runtimeMode: "sandbox",
    actor: "primary",
  });
  assert.equal(decision.effect, "allow");
  assert.equal(decision.source, "mode");
});

test("yolo mode auto-allows workspace tool execution in remote runtime", () => {
  const decision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "yolo",
    runtimeMode: "remote",
    actor: "primary",
  });
  assert.equal(decision.effect, "allow");
});

test("yolo mode still requires prompt for MCP server actions", () => {
  const decision = engine.decide({
    trustZone: "external",
    intent: "mcp_server",
    runtimeMode: "local",
    actor: "primary",
  });
  assert.notEqual(decision.effect, "allow");
});

test("background tasks are not auto-allowed", () => {
  const decision = engine.decide({
    trustZone: "workspace",
    intent: "background_task",
    runtimeMode: "local",
    actor: "primary",
  });
  assert.notEqual(decision.effect, "allow");
});

test("planning is allowed in yolo mode", () => {
  const decision = engine.decide({
    trustZone: "session",
    intent: "plan",
    mode: "yolo",
    runtimeMode: "local",
    actor: "primary",
  });
  assert.equal(decision.effect, "allow");
});

test("default mode still requires prompt for sandbox tool execution", () => {
  const decision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "sandbox",
    actor: "primary",
  });
  assert.equal(decision.effect, "prompt");
});
