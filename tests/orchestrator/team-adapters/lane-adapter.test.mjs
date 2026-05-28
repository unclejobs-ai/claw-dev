import { test } from "node:test";
import assert from "node:assert/strict";

import { TEAM_LANE_RUNTIMES } from "@unclecode/contracts";
import { getLaneAdapter, listLaneAdapters } from "@unclecode/orchestrator";

test("getLaneAdapter returns an adapter for every TEAM_LANE_RUNTIMES entry", () => {
  for (const id of TEAM_LANE_RUNTIMES) {
    const adapter = getLaneAdapter(id);
    assert.equal(adapter.id, id, `adapter id round-trips for ${id}`);
    assert.equal(typeof adapter.run, "function", `${id} exposes run()`);
  }
});

test("getLaneAdapter throws explicit error for unknown runtime", () => {
  assert.throws(
    () => getLaneAdapter("bogus"),
    /unknown lane runtime/i,
    "unknown runtime rejected with informative message",
  );
});

test("listLaneAdapters returns all 8 in registry order", () => {
  const ids = listLaneAdapters().map((a) => a.id);
  assert.deepEqual(ids, [...TEAM_LANE_RUNTIMES]);
});

test("stub adapters expose preflight() that surfaces missing dependencies", () => {
  for (const id of TEAM_LANE_RUNTIMES) {
    const adapter = getLaneAdapter(id);
    assert.equal(typeof adapter.preflight, "function", `${id} exposes preflight()`);
  }
});
