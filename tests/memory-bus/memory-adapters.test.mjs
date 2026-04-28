import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createClaudeMemAdapter,
  createMem0Adapter,
  dialectic,
} from "@unclecode/memory-bus";

function asker() {
  return { kind: "user", id: "tester" };
}

test("claude-mem adapter exposes episodic citations + observations", async () => {
  const adapter = createClaudeMemAdapter({
    async search({ query }) {
      assert.equal(query, "auth bug");
      return [
        {
          id: "obs_1",
          content: "fixed JWT expiry boundary in login flow",
          recordedAt: 1730_000_000_000,
          score: 0.91,
          tags: ["auth", "bugfix"],
          source: "session_2025_06_03",
        },
        {
          id: "obs_2",
          content: "rotated client secret after audit finding",
          recordedAt: 1730_100_000_000,
          score: 0.42,
        },
      ];
    },
  }, { minScore: 0.5 });

  assert.equal(adapter.category, "episodic");
  const result = await adapter.query({
    asker: asker(),
    category: "episodic",
    query: "auth bug",
  });
  assert.equal(result.citations.length, 1, "minScore filters low-score hit");
  assert.equal(result.rawObservations.length, 1);
  assert.equal(result.citations[0].category, "memory_observation");
  assert.equal(result.citations[0].key, "claude-mem:obs_1");
  assert.match(result.citations[0].versionHash, /^[0-9a-f]{64}$/);
  assert.equal(result.rawObservations[0].category, "episodic");
  assert.equal(result.rawObservations[0].recordedAt, 1730_000_000_000);
  assert.deepEqual(result.rawObservations[0].tags, ["auth", "bugfix"]);
  assert.match(result.snippet, /JWT expiry/);
});

test("mem0 adapter parses ISO timestamps and dedupes via id", async () => {
  const adapter = createMem0Adapter({
    async search({ query, limit }) {
      assert.equal(query, "user prefers terse responses");
      assert.equal(limit, 8);
      return [
        {
          id: "mem0_a",
          memory: "user prefers terse one-line answers",
          score: 0.97,
          createdAt: "2026-01-15T10:00:00.000Z",
          updatedAt: "2026-04-10T08:30:00.000Z",
          metadata: { source: "session_summary" },
        },
        {
          id: "mem0_b",
          memory: "user works on TypeScript orchestration projects",
          score: 0.81,
        },
      ];
    },
  });

  assert.equal(adapter.category, "semantic");
  const result = await adapter.query({
    asker: asker(),
    category: "semantic",
    query: "user prefers terse responses",
  });
  assert.equal(result.citations.length, 2);
  assert.equal(result.citations[0].key, "mem0:mem0_a");
  assert.equal(result.rawObservations[0].recordedAt, Date.parse("2026-04-10T08:30:00.000Z"));
  assert.ok(Number.isFinite(result.rawObservations[1].recordedAt));
  assert.equal(result.rawObservations[0].category, "semantic");
});

test("dialectic dispatches to episodic adapter when category matches", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "uc-mem-bus-"));
  try {
    const adapter = createClaudeMemAdapter({
      async search() {
        return [
          { id: "ep_1", content: "agent fixed timeout in dispatch loop" },
        ];
      },
    });
    const result = await dialectic(
      { asker: asker(), category: "episodic", query: "timeout" },
      { workspaceRoot: workspace, adapters: [adapter] },
    );
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0].key, "claude-mem:ep_1");
    assert.match(result.synthesized, /agent fixed timeout/);
    assert.match(result.retrievalHash, /^[0-9a-f]{64}$/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("dialectic ignores adapters whose category does not match", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "uc-mem-bus-"));
  try {
    let calls = 0;
    const semantic = createMem0Adapter({
      async search() {
        calls += 1;
        return [{ id: "x", memory: "should not be queried", score: 1 }];
      },
    });
    const result = await dialectic(
      { asker: asker(), category: "episodic", query: "anything" },
      { workspaceRoot: workspace, adapters: [semantic] },
    );
    assert.equal(calls, 0, "semantic adapter not invoked for episodic query");
    assert.equal(result.citations.length, 0);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("multiple adapters of different categories coexist", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "uc-mem-bus-"));
  try {
    const episodic = createClaudeMemAdapter({
      async search() {
        return [{ id: "e1", content: "episodic-hit" }];
      },
    });
    const semantic = createMem0Adapter({
      async search() {
        return [{ id: "s1", memory: "semantic-hit", score: 0.9 }];
      },
    });
    const epResult = await dialectic(
      { asker: asker(), category: "episodic", query: "x" },
      { workspaceRoot: workspace, adapters: [episodic, semantic] },
    );
    const semResult = await dialectic(
      { asker: asker(), category: "semantic", query: "x" },
      { workspaceRoot: workspace, adapters: [episodic, semantic] },
    );
    assert.equal(epResult.citations.length, 1);
    assert.equal(epResult.citations[0].key, "claude-mem:e1");
    assert.equal(semResult.citations.length, 1);
    assert.equal(semResult.citations[0].key, "mem0:s1");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
