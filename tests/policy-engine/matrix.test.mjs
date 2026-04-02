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
