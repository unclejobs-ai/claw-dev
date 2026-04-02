import assert from "node:assert/strict";
import test from "node:test";

import { createPolicyEngine } from "@unclecode/policy-engine";

test("session overrides beat the base decision", () => {
  const engine = createPolicyEngine();

  const decision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "local",
    actor: "primary",
    overrides: {
      session: {
        tool_execution: "deny",
      },
    },
  });

  assert.equal(decision.effect, "deny");
  assert.equal(decision.source, "sessionOverride");
});

test("user overrides apply when no session override is present", () => {
  const engine = createPolicyEngine();

  const decision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "local",
    actor: "primary",
    overrides: {
      user: {
        tool_execution: "prompt",
      },
    },
  });

  assert.equal(decision.effect, "prompt");
  assert.equal(decision.source, "userOverride");
});
