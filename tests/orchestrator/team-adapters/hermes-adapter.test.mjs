import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { TeamBinding, createHermesAdapter } from "@unclecode/orchestrator";
import { createTeamRun, generateRunId } from "@unclecode/session-store";

function makeBinding() {
  const dataRoot = mkdtempSync(join(process.cwd(), ".test-tmp-hermes-"));
  const runId = generateRunId();
  const ref = createTeamRun({
    dataRoot,
    runId,
    objective: "hermes adapter test",
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

test("hermes adapter id is 'hermes'", () => {
  const adapter = createHermesAdapter({ executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }) });
  assert.equal(adapter.id, "hermes");
});

test("hermes adapter preflight requires acpx on PATH", () => {
  const adapterMissing = createHermesAdapter({
    executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    which: () => null,
  });
  assert.equal(adapterMissing.preflight({}).status, "missing");

  const adapterOk = createHermesAdapter({
    executor: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    which: () => "/usr/local/bin/acpx",
  });
  assert.equal(adapterOk.preflight({}).status, "ok");
});

test("hermes adapter run() passes top-level opts BEFORE agent subcommand", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor, calls } = fakeExec({ stdout: "remote response from claude\n" });
  try {
    const adapter = createHermesAdapter({ executor, which: () => "/bin/acpx" });
    const result = await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "review PR #123",
        runtime: "hermes",
        extras: { agent: "codex" },
      },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(result.ok, true);
    assert.equal(result.submission, "remote response from claude");
    const argv = calls[0].args;
    // acpx top-level options must precede the agent subcommand.
    const agentIdx = argv.indexOf("codex");
    const execIdx = argv.indexOf("exec");
    const cwdIdx = argv.indexOf("--cwd");
    const formatIdx = argv.indexOf("--format");
    const approveIdx = argv.indexOf("--approve-all");
    assert.ok(cwdIdx >= 0 && cwdIdx < agentIdx, "--cwd before agent");
    assert.ok(formatIdx >= 0 && formatIdx < agentIdx, "--format before agent");
    assert.ok(approveIdx >= 0 && approveIdx < agentIdx, "--approve-all before agent");
    assert.equal(argv[cwdIdx + 1], dataRoot);
    assert.equal(argv[formatIdx + 1], "text");
    assert.equal(agentIdx + 1, execIdx, "exec immediately after agent");
    assert.equal(argv[argv.length - 2], "--");
    assert.equal(argv[argv.length - 1], "review PR #123");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("hermes adapter defaults agent to 'claude' when extras.agent omitted", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor, calls } = fakeExec({ stdout: "ok" });
  try {
    const adapter = createHermesAdapter({ executor, which: () => "/bin/acpx" });
    await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "hermes" },
      { binding, cwd: dataRoot, env: {} },
    );
    const agentIdx = calls[0].args.indexOf("claude");
    assert.ok(agentIdx > 0, "claude subcommand present after top-level options");
    assert.equal(calls[0].args[agentIdx + 1], "exec");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("hermes adapter rejects unknown acpx agent", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor } = fakeExec({ stdout: "ok" });
  try {
    const adapter = createHermesAdapter({ executor, which: () => "/bin/acpx" });
    await assert.rejects(
      adapter.run(
        { workerId: "w1", persona: "coder", task: "x", runtime: "hermes", extras: { agent: "bogus" } },
        { binding, cwd: dataRoot, env: {} },
      ),
      /unknown acpx agent "bogus"/,
    );
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("hermes adapter forwards --model and converts timeoutMs to acpx --timeout seconds, before agent", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor, calls } = fakeExec({ stdout: "ok" });
  try {
    const adapter = createHermesAdapter({ executor, which: () => "/bin/acpx" });
    await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "x",
        runtime: "hermes",
        model: "gpt-5.5",
        extras: { agent: "codex" },
      },
      { binding, cwd: dataRoot, env: {}, timeoutMs: 45000 },
    );
    const argv = calls[0].args;
    const modelIdx = argv.indexOf("--model");
    const timeoutIdx = argv.indexOf("--timeout");
    const agentIdx = argv.indexOf("codex");
    assert.equal(argv[modelIdx + 1], "gpt-5.5");
    assert.equal(argv[timeoutIdx + 1], "45");
    assert.ok(modelIdx < agentIdx, "--model before agent subcommand");
    assert.ok(timeoutIdx < agentIdx, "--timeout before agent subcommand");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("hermes adapter respects extras.format and extras.approve overrides", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor, calls } = fakeExec({ stdout: "ok" });
  try {
    const adapter = createHermesAdapter({ executor, which: () => "/bin/acpx" });
    await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "x",
        runtime: "hermes",
        extras: { agent: "cursor", format: "json", approve: "reads" },
      },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(calls[0].args[calls[0].args.indexOf("--format") + 1], "json");
    assert.ok(calls[0].args.includes("--approve-reads"));
    assert.ok(!calls[0].args.includes("--approve-all"));
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("hermes adapter marks failure on non-zero exit", async () => {
  const { binding, dataRoot } = makeBinding();
  const { executor } = fakeExec({ stdout: "", stderr: "agent unreachable", exitCode: 4 });
  try {
    const adapter = createHermesAdapter({ executor, which: () => "/bin/acpx" });
    const result = await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "hermes", extras: { agent: "claude" } },
      { binding, cwd: dataRoot, env: {} },
    );
    assert.equal(result.ok, false);
    assert.match(result.submission, /agent unreachable|exit code 4/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
