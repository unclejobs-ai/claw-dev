import assert from "node:assert/strict";
import test from "node:test";

import { createPolicyEngine, getPolicyEffectRank } from "@unclecode/policy-engine";

test("subagents inherit reduced authority by default", () => {
  const engine = createPolicyEngine();

  const primaryDecision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "local",
    actor: "primary",
  });

  const subagentDecision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "local",
    actor: "subagent",
  });

  assert.ok(getPolicyEffectRank(subagentDecision.effect) >= getPolicyEffectRank(primaryDecision.effect));
});

test("explicit delegation can broaden subagent authority for the delegated intent only", () => {
  const engine = createPolicyEngine();

  const delegatedDecision = engine.decide({
    trustZone: "workspace",
    intent: "tool_execution",
    mode: "default",
    runtimeMode: "local",
    actor: "subagent",
    delegation: {
      allowedIntents: ["tool_execution"],
    },
  });

  const undelegatedOtherIntent = engine.decide({
    trustZone: "session",
    intent: "background_task",
    runtimeMode: "local",
    actor: "subagent",
    delegation: {
      allowedIntents: ["tool_execution"],
    },
  });

  assert.equal(delegatedDecision.effect, "allow");
  assert.notEqual(undelegatedOtherIntent.effect, "allow");
});
