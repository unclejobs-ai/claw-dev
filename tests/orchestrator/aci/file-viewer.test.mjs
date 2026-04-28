import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openFile, gotoLine, scroll } from "@unclecode/orchestrator";

function makeTempFile(name, lines) {
  const dir = mkdtempSync(join(tmpdir(), "uc-aci-"));
  const path = join(dir, name);
  writeFileSync(path, lines.join("\n"));
  return { dir, path };
}

test("openFile renders 100-line window with header + numbered lines", () => {
  const lines = Array.from({ length: 250 }, (_, i) => `line ${i + 1}`);
  const { dir, path } = makeTempFile("a.ts", lines);
  try {
    const view = openFile({ cwd: dir, path: "a.ts" });
    assert.equal(view.state.totalLines, 250);
    assert.equal(view.state.windowStart, 1);
    assert.equal(view.state.windowEnd, 100);
    assert.match(view.content, /\[Total\] 250 lines/);
    assert.match(view.content, /^1: line 1/m);
    assert.match(view.content, /^100: line 100/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gotoLine centers around target", () => {
  const lines = Array.from({ length: 500 }, (_, i) => `L${i + 1}`);
  const { dir, path } = makeTempFile("b.ts", lines);
  try {
    const view = openFile({ cwd: dir, path: "b.ts" });
    const next = gotoLine(view.state, 250);
    assert.equal(next.state.windowStart, 200);
    assert.equal(next.state.windowEnd, 299);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scroll down moves window forward by full window size", () => {
  const lines = Array.from({ length: 500 }, (_, i) => `L${i + 1}`);
  const { dir, path } = makeTempFile("c.ts", lines);
  try {
    const view = openFile({ cwd: dir, path: "c.ts" });
    const after = scroll(view.state, "down");
    assert.equal(after.state.windowStart, 101);
    assert.equal(after.state.windowEnd, 200);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
