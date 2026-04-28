import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  encodePeer,
  decodePeer,
  peersEqual,
  writeSop,
  readSop,
  listSops,
  CachingContext7Client,
  consultDocs,
  reflect,
  HeuristicReflectionClient,
  dialectic,
} from "@unclecode/memory-bus";

test("encodePeer / decodePeer round-trips for all kinds", () => {
  const peers = [
    { kind: "user", id: "patreot0312@fronmpt.com" },
    { kind: "agent", persona: "coder" },
    { kind: "team", runId: "tr_xxx" },
    { kind: "run", runId: "tr_xxx" },
  ];
  for (const peer of peers) {
    const encoded = encodePeer(peer);
    const decoded = decodePeer(encoded);
    assert.ok(peersEqual(peer, decoded));
  }
});

test("procedural store writes and reads SOPs per peer", () => {
  const dir = mkdtempSync(join(tmpdir(), "uc-mem-"));
  try {
    const peer = { kind: "agent", persona: "coder" };
    const written = writeSop({
      workspaceRoot: dir,
      peer,
      slug: "fix-cascade",
      content: "When fixing tests in this repo, run npm run test:contracts before broader passes.",
    });
    assert.match(written.path, /\.unclecode\/sop\/agent.coder\/fix-cascade\.md/);
    const read = readSop({ workspaceRoot: dir, peer, slug: "fix-cascade" });
    assert.equal(read.content, written.content);
    const listed = listSops({ workspaceRoot: dir, peer });
    assert.equal(listed.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CachingContext7Client + consultDocs cite with stable hash", async () => {
  let calls = 0;
  const upstream = {
    async resolveLibraryId(library) {
      return `lib_${library}`;
    },
    async queryDocs(libraryId, topic) {
      calls += 1;
      return `Docs for ${libraryId} on ${topic}`;
    },
  };
  const client = new CachingContext7Client(upstream);
  const first = await consultDocs(client, { library: "react", topic: "useEffect" });
  const second = await consultDocs(client, { library: "react", topic: "useEffect" });
  assert.equal(first.citation.versionHash, second.citation.versionHash);
  assert.equal(calls, 1);
  assert.equal(first.citation.category, "external_doc");
});

test("reflect via HeuristicReflectionClient returns success/failure patterns", async () => {
  const client = new HeuristicReflectionClient();
  const result = await reflect(client, {
    runId: "tr_x",
    objective: "fix bug",
    summary: "all green; tests passed",
    transcript: "...",
    artifacts: [{ path: "src/x.ts", sha256: "abc1234" }],
  });
  assert.equal(result.successPatterns.length, 1);
  assert.equal(result.failurePatterns.length, 0);
  assert.equal(result.codebaseInsights.length, 1);
});

test("dialectic reads procedural SOP citations matching the query", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uc-mem-"));
  try {
    const peer = { kind: "agent", persona: "coder" };
    writeSop({
      workspaceRoot: dir,
      peer,
      slug: "auth-fixes",
      content: "When the auth token expiry check fails, prefer adjusting the comparison operator before adding tests.",
    });
    const result = await dialectic(
      { asker: peer, category: "procedural", query: "auth token expiry" },
      { workspaceRoot: dir },
    );
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0].category, "memory_observation");
    assert.match(result.synthesized ?? "", /auth token expiry check/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
