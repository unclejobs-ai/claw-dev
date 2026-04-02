import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prepareResearchBundle } from "@unclecode/context-broker";

const worktreeDir = new URL("../../", import.meta.url).pathname;

describe("prepareResearchBundle", () => {
  it("uses research provenance and search-mode packet assembly", async () => {
    const bundle = await prepareResearchBundle({
      rootDir: worktreeDir,
      sessionId: "session-1",
      relatedMemories: [{ memoryId: "m1", content: "remember this" }],
      hypotheses: ["maybe provider auth drift"],
      artifactsDir: "/tmp/unclecode-research",
    });

    assert.equal(bundle.packet.provenance.mode, "search");
    assert.equal(bundle.packet.provenance.trigger, "research");
    assert.equal(bundle.packet.provenance.sessionId, "session-1");
    assert.equal(bundle.packet.tokenBudget.maxTokens, 100000);
    assert.deepEqual(bundle.relatedMemories, [{ memoryId: "m1", content: "remember this" }]);
    assert.deepEqual(bundle.hypotheses, ["maybe provider auth drift"]);
    assert.equal(bundle.artifactsDir, "/tmp/unclecode-research");
  });
});
