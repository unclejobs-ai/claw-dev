import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { TeamBinding, createOpencodeAdapter } from "@unclecode/orchestrator";
import { createTeamRun, generateRunId } from "@unclecode/session-store";

function makeBinding() {
  const dataRoot = mkdtempSync(join(process.cwd(), ".test-tmp-opencode-"));
  const runId = generateRunId();
  const ref = createTeamRun({
    dataRoot,
    runId,
    objective: "opencode adapter test",
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

function fakeExec({ stdout = "", stderr = "", exitCode = 0 } = {}) {
  const calls = [];
  return {
    calls,
    executor: async (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
      return { stdout, stderr, exitCode };
    },
  };
}

test("opencode adapter id is 'opencode'", () => {
  const adapter = createOpencodeAdapter({ executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }) });
  assert.equal(adapter.id, "opencode");
});

test("opencode adapter preflight reports missing binary", () => {
  const adapter = createOpencodeAdapter({
    executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    which: () => null,
  });
  assert.equal(adapter.preflight({}).status, "missing");
});

test("opencode adapter run() forwards --model and captures stdout", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor, calls } = fakeExec({ stdout: "kimi response text\n" });
  try {
    const adapter = createOpencodeAdapter({ executor, which: () => "/usr/local/bin/opencode" });
    const result = await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "summarize",
        runtime: "opencode",
        model: "kimi-k2.6",
      },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(result.ok, true);
    assert.equal(result.submission, "kimi response text");
    assert.equal(calls[0].args[0], "run");
    assert.ok(calls[0].args.includes("--model"));
    assert.equal(calls[0].args[calls[0].args.indexOf("--model") + 1], "kimi-k2.6");
    assert.ok(calls[0].args.includes("summarize"));
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("opencode adapter run() supports deepseek-v4 model", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor, calls } = fakeExec({ stdout: "deepseek output\n" });
  try {
    const adapter = createOpencodeAdapter({ executor, which: () => "/bin/opencode" });
    await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "x",
        runtime: "opencode",
        model: "deepseek-v4",
      },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(calls[0].args[calls[0].args.indexOf("--model") + 1], "deepseek-v4");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("opencode adapter marks failure on non-zero exit code", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor } = fakeExec({ stdout: "", stderr: "oops", exitCode: 3 });
  try {
    const adapter = createOpencodeAdapter({ executor, which: () => "/bin/opencode" });
    const result = await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "opencode" },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(result.ok, false);
    assert.match(result.submission, /oops|exit code 3/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("opencode adapter refuses dispatch when binary missing", async () => {
  const { binding, dataRoot } = makeBinding();
  try {
    const adapter = createOpencodeAdapter({
      executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      which: () => null,
    });
    await assert.rejects(
      adapter.run(
        { workerId: "w1", persona: "coder", task: "x", runtime: "opencode" },
        { binding, cwd: dataRoot, env: {} },
      ),
      /opencode/i,
    );
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
