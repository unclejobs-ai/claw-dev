import { test } from "node:test";
import assert from "node:assert/strict";

import { PERSONA_IDS, MINI_LOOP_EXIT_STATUSES } from "@unclecode/contracts";

test("mini-loop persona ids are stable", () => {
  assert.deepEqual(PERSONA_IDS, [
    "coder",
    "builder",
    "hardener",
    "auditor",
    "agentless-fix",
    "agentless-then-agent",
    "mini",
  ]);
});

test("mini-loop exit statuses cover linear-loop terminations", () => {
  assert.deepEqual(MINI_LOOP_EXIT_STATUSES, [
    "submitted",
    "limits_exceeded",
    "halted",
    "errored",
  ]);
});
