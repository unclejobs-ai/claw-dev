import { test } from "node:test";
import assert from "node:assert/strict";

import { parseLanesSpec, DEFAULT_LANE_RUNTIME } from "@unclecode/orchestrator";

test("parseLanesSpec accepts numeric form and expands to default runtime", () => {
  const parsed = parseLanesSpec("4");
  assert.equal(parsed.length, 4);
  for (const spec of parsed) {
    assert.equal(spec.runtime, DEFAULT_LANE_RUNTIME);
    assert.equal(spec.model, undefined);
    assert.equal(spec.extras, undefined);
  }
});

test("parseLanesSpec single runtime token", () => {
  const [spec] = parseLanesSpec("cursor");
  assert.equal(spec.runtime, "cursor");
  assert.equal(spec.model, undefined);
});

test("parseLanesSpec runtime + model", () => {
  const [spec] = parseLanesSpec("opencode:kimi-k2.6");
  assert.equal(spec.runtime, "opencode");
  assert.equal(spec.model, "kimi-k2.6");
});

test("parseLanesSpec runtime + omitted model + extras", () => {
  const [spec] = parseLanesSpec("hermes::channel=#review;agent=codex");
  assert.equal(spec.runtime, "hermes");
  assert.equal(spec.model, undefined);
  assert.deepEqual(spec.extras, { channel: "#review", agent: "codex" });
});

test("parseLanesSpec runtime + model + extras", () => {
  const [spec] = parseLanesSpec("glm:glm-5.1:provider=zai;region=cn");
  assert.equal(spec.runtime, "glm");
  assert.equal(spec.model, "glm-5.1");
  assert.deepEqual(spec.extras, { provider: "zai", region: "cn" });
});

test("parseLanesSpec mixed heterogeneous list", () => {
  const specs = parseLanesSpec("cursor,codex,opencode:kimi-k2.6,glm,hermes::channel=#x");
  assert.equal(specs.length, 5);
  assert.equal(specs[0].runtime, "cursor");
  assert.equal(specs[1].runtime, "codex");
  assert.equal(specs[2].runtime, "opencode");
  assert.equal(specs[2].model, "kimi-k2.6");
  assert.equal(specs[3].runtime, "glm");
  assert.equal(specs[4].runtime, "hermes");
  assert.equal(specs[4].extras.channel, "#x");
});

test("parseLanesSpec rejects unknown runtime token", () => {
  assert.throws(() => parseLanesSpec("bogus,codex"), /unknown lane runtime/i);
});

test("parseLanesSpec rejects empty input", () => {
  assert.throws(() => parseLanesSpec(""), /empty/i);
  assert.throws(() => parseLanesSpec("  "), /empty/i);
});

test("parseLanesSpec rejects zero or negative numeric", () => {
  assert.throws(() => parseLanesSpec("0"), /invalid/i);
  assert.throws(() => parseLanesSpec("-1"), /invalid/i);
});

test("parseLanesSpec trims whitespace around tokens", () => {
  const specs = parseLanesSpec(" cursor , codex ");
  assert.equal(specs.length, 2);
  assert.equal(specs[0].runtime, "cursor");
  assert.equal(specs[1].runtime, "codex");
});
