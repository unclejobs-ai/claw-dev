import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { TeamBinding, createCodexCliAdapter } from "@unclecode/orchestrator";
import { createTeamRun, generateRunId } from "@unclecode/session-store";

function makeBinding() {
  const dataRoot = mkdtempSync(join(process.cwd(), ".test-tmp-codex-"));
  const runId = generateRunId();
  const ref = createTeamRun({
    dataRoot,
    runId,
    objective: "codex adapter test",
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

function ndjson(events) {
  return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
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

test("codex CLI adapter id is 'codex'", () => {
  const adapter = createCodexCliAdapter({ executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }) });
  assert.equal(adapter.id, "codex");
});

test("codex CLI adapter preflight rejects when 'codex' binary missing", () => {
  const adapter = createCodexCliAdapter({
    executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    which: () => null,
  });
  const result = adapter.preflight({});
  assert.equal(result.status, "missing");
  assert.match(result.reason, /codex/i);
});

test("codex CLI adapter preflight ok when binary resolves", () => {
  const adapter = createCodexCliAdapter({
    executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    which: () => "/usr/local/bin/codex",
  });
  assert.equal(adapter.preflight({}).status, "ok");
});

test("codex CLI adapter parses last agent_message from JSON event stream", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor, calls } = fakeExec({
    stdout: ndjson([
      { type: "task_started", id: "t1" },
      { type: "agent_message", content: "first chunk" },
      { type: "tool_call", name: "shell" },
      { type: "agent_message", content: "final answer here" },
      { type: "task_complete" },
    ]),
  });
  try {
    const adapter = createCodexCliAdapter({ executor, which: () => "/bin/codex" });
    const result = await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "summarize repo",
        runtime: "codex",
        model: "gpt-5.5",
      },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(result.ok, true);
    assert.equal(result.submission, "final answer here");
    assert.equal(calls[0].args[0], "exec");
    assert.ok(calls[0].args.includes("--json"));
    assert.ok(calls[0].args.includes("--model"));
    assert.equal(calls[0].args[calls[0].args.indexOf("--model") + 1], "gpt-5.5");
    assert.ok(calls[0].args.includes("summarize repo"));
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("codex CLI adapter falls back to raw stdout when no JSON events parse", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor } = fakeExec({ stdout: "plain text answer\n" });
  try {
    const adapter = createCodexCliAdapter({ executor, which: () => "/bin/codex" });
    const result = await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "codex" },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(result.ok, true);
    assert.equal(result.submission, "plain text answer");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("codex CLI adapter marks failure on non-zero exit code", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor } = fakeExec({ stdout: "", stderr: "boom", exitCode: 7 });
  try {
    const adapter = createCodexCliAdapter({ executor, which: () => "/bin/codex" });
    const result = await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "codex" },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(result.ok, false);
    assert.match(result.submission, /exit code 7|boom/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("codex CLI adapter run() refuses to dispatch when binary missing", async () => {
  const { binding, dataRoot } = makeBinding();
  try {
    const adapter = createCodexCliAdapter({
      executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
      which: () => null,
    });
    await assert.rejects(
      adapter.run(
        { workerId: "w1", persona: "coder", task: "x", runtime: "codex" },
        { binding, cwd: dataRoot, env: {} },
      ),
      /codex/i,
    );
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
