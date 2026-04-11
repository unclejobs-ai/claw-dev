import assert from "node:assert/strict";
import test from "node:test";

import {
  APPROVAL_INTENTS,
  APPROVAL_INTENT_TYPES,
  MODE_PROFILE_IDS,
} from "@unclecode/contracts";
import {
  POLICY_DECISION_EFFECTS,
  POLICY_RUNTIME_MODES,
  createPolicyEngine,
} from "@unclecode/policy-engine";

test("policy engine returns a deterministic decision for every trust-zone/intent/mode/runtime combination", () => {
  const engine = createPolicyEngine();

  for (const intent of APPROVAL_INTENT_TYPES) {
    const metadata = APPROVAL_INTENTS[intent];
    const modes = metadata.supportsMode ? MODE_PROFILE_IDS : [undefined];

    for (const mode of modes) {
      for (const runtimeMode of POLICY_RUNTIME_MODES) {
        const request = {
          trustZone: metadata.trustZone,
          intent,
          ...(mode === undefined ? {} : { mode }),
          runtimeMode,
          actor: "primary",
        };

        const first = engine.decide(request);
        const second = engine.decide(request);

        assert.ok(POLICY_DECISION_EFFECTS.includes(first.effect));
        assert.equal(typeof first.reason, "string");
        assert.ok(first.reason.length > 0);
        assert.deepEqual(second, first);
      }
    }
  }
});

test("policy engine denies impossible trustZone and intent combinations", () => {
  const engine = createPolicyEngine();
  const decision = engine.decide({
    trustZone: "workspace",
    intent: "plan",
    mode: "default",
    runtimeMode: "local",
    actor: "primary",
  });

  assert.equal(decision.effect, "deny");
});

test("yolo mode allows workspace tool execution in sandbox/remote runtime", () => {
  const engine = createPolicyEngine();

  const sandboxDecision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "yolo",
    runtimeMode: "sandbox",
    actor: "primary",
  });
  assert.equal(sandboxDecision.effect, "allow");
  assert.equal(sandboxDecision.source, "mode");

  const remoteDecision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "yolo",
    runtimeMode: "remote",
    actor: "primary",
  });
  assert.equal(remoteDecision.effect, "allow");

  const mcpDecision = engine.decide({
    trustZone: "external",
    intent: "mcp_server",
    runtimeMode: "local",
    actor: "primary",
  });
  assert.ok(
    mcpDecision.effect === "prompt" || mcpDecision.effect === "deny",
    "MCP is not auto-allowed even in yolo",
  );
});
