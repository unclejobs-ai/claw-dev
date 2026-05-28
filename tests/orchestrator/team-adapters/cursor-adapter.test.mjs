import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { TeamBinding, createCursorAdapter } from "@unclecode/orchestrator";
import { createTeamRun, generateRunId } from "@unclecode/session-store";

function makeBinding() {
  const dataRoot = mkdtempSync(join(process.cwd(), ".test-tmp-cursor-"));
  const runId = generateRunId();
  const ref = createTeamRun({
    dataRoot,
    runId,
    objective: "cursor adapter test",
    persona: "coder",
    lanes: 1,
    gate: "warn",
    runtime: "local",
    workspaceRoot: dataRoot,
    createdBy: "tests",
  });
  const binding = new TeamBinding({
    runId: ref.runId,
    runRoot: ref.runRoot,
    role: "worker",
    workspaceRoot: dataRoot,
  });
  return { binding, dataRoot };
}

function fakePromptApi(canned) {
  const calls = [];
  return {
    calls,
    promptFn: async (message, options) => {
      calls.push({ message, options });
      return canned;
    },
  };
}

test("cursor adapter id is 'cursor'", () => {
  const adapter = createCursorAdapter({ promptFn: async () => ({ status: "finished", result: "x" }) });
  assert.equal(adapter.id, "cursor");
});

test("cursor adapter preflight requires CURSOR_API_KEY", () => {
  const adapter = createCursorAdapter({ promptFn: async () => ({}) });
  assert.equal(adapter.preflight({}).status, "missing");
  assert.match(adapter.preflight({}).reason, /CURSOR_API_KEY/);
  assert.equal(adapter.preflight({ CURSOR_API_KEY: "x" }).status, "ok");
});

test("cursor adapter run() forwards task + apiKey + model to prompt API", async () => {
  const { binding, dataRoot } = makeBinding();
  const { promptFn, calls } = fakePromptApi({ status: "finished", result: "hello-from-cursor" });
  try {
    const adapter = createCursorAdapter({ promptFn });
    const result = await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "summarize repo",
        runtime: "cursor",
        model: "composer-2.5",
      },
      { binding, cwd: dataRoot, env: { CURSOR_API_KEY: "ck-test" } },
    );
    assert.equal(result.ok, true);
    assert.equal(result.submission, "hello-from-cursor");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].message, "summarize repo");
    assert.equal(calls[0].options.apiKey, "ck-test");
    assert.equal(calls[0].options.model.id, "composer-2.5");
    assert.equal(calls[0].options.local.cwd, dataRoot);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("cursor adapter run() reports ok=false for non-finished status", async () => {
  const { binding, dataRoot } = makeBinding();
  const { promptFn } = fakePromptApi({ status: "error", result: "boom" });
  try {
    const adapter = createCursorAdapter({ promptFn });
    const result = await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "cursor" },
      { binding, cwd: dataRoot, env: { CURSOR_API_KEY: "ck" } },
    );
    assert.equal(result.ok, false);
    assert.equal(result.submission, "boom");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("cursor adapter run() fails fast when CURSOR_API_KEY missing", async () => {
  const { binding, dataRoot } = makeBinding();
  const { promptFn } = fakePromptApi({});
  try {
    const adapter = createCursorAdapter({ promptFn });
    await assert.rejects(
      adapter.run(
        { workerId: "w1", persona: "coder", task: "x", runtime: "cursor" },
        { binding, cwd: dataRoot, env: {} },
      ),
      /CURSOR_API_KEY/,
    );
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("cursor adapter run() honors timeoutMs and aborts long-running prompts", async () => {
  const { binding, dataRoot } = makeBinding();
  try {
    const adapter = createCursorAdapter({
      promptFn: () => new Promise((resolve) => setTimeout(() => resolve({ status: "finished", result: "late" }), 200)),
    });
    await assert.rejects(
      adapter.run(
        { workerId: "w1", persona: "coder", task: "x", runtime: "cursor" },
        { binding, cwd: dataRoot, env: { CURSOR_API_KEY: "ck" }, timeoutMs: 20 },
      ),
      /timed out/i,
    );
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("cursor adapter run() uses default model when spec.model unset", async () => {
  const { binding, dataRoot } = makeBinding();
  const { promptFn, calls } = fakePromptApi({ status: "finished", result: "ok" });
  try {
    const adapter = createCursorAdapter({ promptFn });
    await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "cursor" },
      { binding, cwd: dataRoot, env: { CURSOR_API_KEY: "ck" } },
    );
    assert.equal(typeof calls[0].options.model.id, "string");
    assert.ok(calls[0].options.model.id.length > 0);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
