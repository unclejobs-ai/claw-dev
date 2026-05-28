import { test } from "node:test";
import assert from "node:assert/strict";

import { TEAM_LANE_RUNTIMES } from "@unclecode/contracts";
import { runLaneDoctor } from "@unclecode/orchestrator";

test("runLaneDoctor returns one report per registered runtime", () => {
  const report = runLaneDoctor({ env: {}, which: () => null });
  assert.equal(report.lanes.length, TEAM_LANE_RUNTIMES.length);
  for (const lane of report.lanes) {
    assert.ok(TEAM_LANE_RUNTIMES.includes(lane.runtime));
    assert.ok(lane.status === "ok" || lane.status === "missing");
  }
});

test("runLaneDoctor marks SDK lanes ok when env present", () => {
  const report = runLaneDoctor({
    env: {
      OPENAI_API_KEY: "k1",
      ANTHROPIC_API_KEY: "k2",
      GEMINI_API_KEY: "k3",
      CURSOR_API_KEY: "k4",
      GLM_API_KEY: "k5",
    },
    which: () => null,
  });
  const byId = new Map(report.lanes.map((l) => [l.runtime, l]));
  assert.equal(byId.get("openai").status, "ok");
  assert.equal(byId.get("anthropic").status, "ok");
  assert.equal(byId.get("gemini").status, "ok");
  assert.equal(byId.get("cursor").status, "ok");
  assert.equal(byId.get("glm").status, "ok");
});

test("runLaneDoctor marks CLI lanes ok only when binary resolves", () => {
  const which = (b) => (b === "codex" || b === "opencode" ? `/bin/${b}` : null);
  const report = runLaneDoctor({ env: {}, which });
  const byId = new Map(report.lanes.map((l) => [l.runtime, l]));
  assert.equal(byId.get("codex").status, "ok");
  assert.equal(byId.get("opencode").status, "ok");
  assert.equal(byId.get("hermes").status, "missing");
});

test("runLaneDoctor summary counts healthy and missing lanes", () => {
  const which = (b) => (b === "codex" ? "/bin/codex" : null);
  const report = runLaneDoctor({
    env: { OPENAI_API_KEY: "k" },
    which,
  });
  assert.ok(report.summary.ok >= 2);
  assert.ok(report.summary.missing >= 1);
  assert.equal(report.summary.ok + report.summary.missing, TEAM_LANE_RUNTIMES.length);
});
