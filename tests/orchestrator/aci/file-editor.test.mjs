import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { editFile } from "@unclecode/orchestrator";

function makeTempFile(name, content) {
  const dir = mkdtempSync(join(tmpdir(), "uc-edit-"));
  const path = join(dir, name);
  writeFileSync(path, content);
  return { dir, path };
}

const okRunner = async () => ({ ok: true, findings: [] });
const failRunner = async () => ({
  ok: false,
  findings: [{ code: "E999", line: 2, message: "syntax error" }],
});

test("editFile applies clean line-anchored edit", async () => {
  const { dir } = makeTempFile("a.ts", "alpha\nbeta\ngamma\n");
  try {
    const result = await editFile(
      { cwd: dir, path: "a.ts", startLine: 2, endLine: 2, replacement: "BETA" },
      { lintRunner: okRunner },
    );
    assert.equal(result.status, "applied");
    const after = readFileSync(join(dir, "a.ts"), "utf8");
    assert.match(after, /^alpha\nBETA\ngamma\n$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("editFile reverts on lint failure with 3-part error message", async () => {
  const { dir } = makeTempFile("a.ts", "alpha\nbeta\ngamma\n");
  const original = "alpha\nbeta\ngamma\n";
  try {
    const result = await editFile(
      { cwd: dir, path: "a.ts", startLine: 2, endLine: 2, replacement: "@@@bad" },
      { lintRunner: failRunner },
    );
    assert.equal(result.status, "lint_failed");
    assert.match(result.errorMessage, /Errors:/);
    assert.match(result.errorMessage, /Proposed/);
    assert.match(result.errorMessage, /Original/);
    const after = readFileSync(join(dir, "a.ts"), "utf8");
    assert.equal(after, original);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("editFile rejects out-of-range lines", async () => {
  const { dir } = makeTempFile("a.ts", "alpha\nbeta\n");
  try {
    const result = await editFile(
      { cwd: dir, path: "a.ts", startLine: 5, endLine: 5, replacement: "x" },
      { lintRunner: okRunner },
    );
    assert.equal(result.status, "out_of_range");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
