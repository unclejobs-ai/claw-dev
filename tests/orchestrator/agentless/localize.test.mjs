import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  hierarchicalLocalize,
  generateCandidates,
  validateCandidates,
  pickBestCandidate,
} from "@unclecode/orchestrator";

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), "uc-agentless-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(
    join(dir, "src", "auth.ts"),
    [
      "export function validateToken(token: string) {",
      "  if (token.length === 0) return false;",
      "  return checkExpiry(token);",
      "}",
      "",
      "export function checkExpiry(token: string) {",
      "  return false;",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(dir, "src", "session.ts"),
    [
      "export class Session {",
      "  constructor(public id: string) {}",
      "}",
      "",
    ].join("\n"),
  );
  return dir;
}

test("hierarchicalLocalize ranks files by injected scorer", async () => {
  const dir = setupRepo();
  try {
    const scorer = async ({ path, snippet }) => {
      if (path.includes("auth.ts") && snippet.includes("checkExpiry")) {
        return { score: 0.9, reason: "matches checkExpiry symbol" };
      }
      return { score: 0.2, reason: "weak match" };
    };
    const regions = await hierarchicalLocalize(
      { cwd: dir, issue: "fix checkExpiry to actually check token expiry" },
      scorer,
    );
    assert.ok(regions.length > 0);
    assert.equal(regions[0].path, "src/auth.ts");
    assert.match(regions[0].reason, /checkExpiry/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("generateCandidates fans out per region with cap", async () => {
  const client = {
    async propose() {
      return [
        { id: "c1", diff: "--- a/x\n+++ b/x\n@@ -1,1 +1,1 @@\n-a\n+b\n", rationale: "swap" },
        { id: "c2", diff: "--- a/y\n+++ b/y\n@@ -1,1 +1,1 @@\n-c\n+d\n", rationale: "swap2" },
      ];
    },
  };
  const candidates = await generateCandidates(
    {
      issue: "test",
      regions: [
        { path: "a", score: 1, reason: "" },
        { path: "b", score: 0.5, reason: "" },
        { path: "c", score: 0.3, reason: "" },
      ],
      perRegion: 2,
      maxTotal: 4,
    },
    client,
  );
  assert.equal(candidates.length, 4);
});

test("validateCandidates picks the candidate that passes the verifier", async () => {
  const client = {
    async prepareSnapshot() {
      const dir = mkdtempSync(join(tmpdir(), "uc-snap-"));
      writeFileSync(join(dir, "x"), "alpha");
      return {
        cwd: dir,
        async cleanup() {
          rmSync(dir, { recursive: true, force: true });
        },
      };
    },
    async runVerifier({ cwd }) {
      const ok = readFileSync(join(cwd, "x"), "utf8").includes("BETA");
      return ok ? { exitCode: 0, summary: "pass" } : { exitCode: 1, summary: "fail" };
    },
  };
  const results = await validateCandidates(
    [
      {
        id: "good",
        diff: "--- a/x\n+++ b/x\n@@ -1,1 +1,1 @@\n-alpha\n+BETA\n",
        rationale: "fix",
      },
      {
        id: "bad",
        diff: "--- a/x\n+++ b/x\n@@ -1,1 +1,1 @@\n-alpha\n+gamma\n",
        rationale: "wrong",
      },
    ],
    client,
  );
  const best = pickBestCandidate(results);
  assert.equal(best?.candidate.id, "good");
});
