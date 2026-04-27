import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TEAM_RUN_STATUSES,
  TEAM_GATE_LEVELS,
  TEAM_RUNTIME_MODES,
  SESSION_CHECKPOINT_TYPES,
} from "@unclecode/contracts";

test("team run statuses cover lifecycle transitions", () => {
  assert.deepEqual(TEAM_RUN_STATUSES, [
    "started",
    "running",
    "gated",
    "accepted",
    "corrective",
    "aborted",
    "killed",
    "errored",
  ]);
});

test("team gate levels map to mmbridge severity", () => {
  assert.deepEqual(TEAM_GATE_LEVELS, ["strict", "warn", "off"]);
});

test("team runtime modes mirror runtime-broker contract", () => {
  assert.deepEqual(TEAM_RUNTIME_MODES, ["local", "docker", "e2b"]);
});

test("session checkpoint types now include team_run + team_step", () => {
  assert.ok(SESSION_CHECKPOINT_TYPES.includes("team_run"));
  assert.ok(SESSION_CHECKPOINT_TYPES.includes("team_step"));
});
