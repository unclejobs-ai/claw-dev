import assert from "node:assert/strict";
import test from "node:test";

import { createPolicyEngine, formatApprovalMessage, resolvePolicyDecision } from "@unclecode/policy-engine";

test("downstream callers can use one shared resolvePolicyDecision interface", () => {
  const engine = createPolicyEngine();
  const direct = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "local",
    actor: "primary",
  });
  const resolved = resolvePolicyDecision({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "local",
    actor: "primary",
  });

  assert.deepEqual(resolved, direct);
});

test("approval message generator includes effect and intent context", () => {
  const message = formatApprovalMessage({
    effect: "prompt",
    source: "base",
    reason: "Workspace tool execution requires operator approval.",
    matchedRule: "workspace.tool_execution.default.local",
  });

  assert.match(message, /prompt/i);
  assert.match(message, /workspace\.tool_execution\.default\.local/);
});

test("invalid request shapes stay denied even when overrides try to allow them", () => {
  const decision = resolvePolicyDecision({
    trustZone: "workspace",
    intent: "plan",
    mode: "default",
    runtimeMode: "local",
    actor: "primary",
    overrides: {
      session: {
        plan: "allow",
      },
    },
  });

  assert.equal(decision.effect, "deny");
  assert.equal(decision.source, "base");
});

test("runtime callers cannot omit required mode or inject unsupported mode", () => {
  const missingMode = resolvePolicyDecision({
    trustZone: "workspace",
    intent: "tool_execution",
    runtimeMode: "local",
    actor: "primary",
  });
  const unsupportedMode = resolvePolicyDecision({
    trustZone: "project",
    intent: "mcp_server",
    mode: "search",
    runtimeMode: "local",
    actor: "primary",
  });

  assert.equal(missingMode.effect, "deny");
  assert.equal(unsupportedMode.effect, "deny");
});

test("runtime callers cannot inject unsupported mode, intent, or actor values", () => {
  const bogusMode = resolvePolicyDecision({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "bogus",
    runtimeMode: "local",
    actor: "primary",
  });
  const bogusIntent = resolvePolicyDecision({
    trustZone: "workspace",
    intent: "bogus",
    mode: "default",
    runtimeMode: "local",
    actor: "primary",
  });
  const bogusActor = resolvePolicyDecision({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "local",
    actor: "bogus",
  });

  assert.equal(bogusMode.effect, "deny");
  assert.equal(bogusIntent.effect, "deny");
  assert.equal(bogusActor.effect, "deny");
});
