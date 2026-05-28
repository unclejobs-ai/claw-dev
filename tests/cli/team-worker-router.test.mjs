/**
 * Integration test: exercise the real handleTeamWorker router in
 * apps/unclecode-cli/src/team-worker.ts as a spawned subprocess. Uses
 * UNCLECODE_TEAM_WORKER_LIVE=0 so the dry-run branch runs and we don't
 * touch any live provider/CLI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { createTeamRun, generateRunId } from "@unclecode/session-store";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Thin runner that imports the actual router and invokes it with argv-passed
// flags. Avoids dragging in commander; the router itself is what matters.
function workerRunnerScript() {
  return `#!/usr/bin/env node
import { handleTeamWorker } from "${PROJECT_ROOT}/apps/unclecode-cli/src/team-worker.ts";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const extrasRaw = arg("--extras");
const opts = {
  workerId: arg("--worker-id"),
  persona: arg("--persona"),
  task: arg("--task"),
  runtime: arg("--runtime"),
};
const model = arg("--model");
if (model !== undefined) opts.model = model;
if (extrasRaw !== undefined) opts.extras = JSON.parse(extrasRaw);

await handleTeamWorker(opts);
`;
}

async function runWorker(runRoot, runId, args, extraEnv = {}) {
  const runnerPath = join(runRoot, "worker-runner.mjs");
  writeFileSync(runnerPath, workerRunnerScript(), { mode: 0o755 });

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import=tsx", runnerPath, ...args],
      {
        cwd: runRoot,
        env: {
          ...process.env,
          UNCLECODE_TEAM_RUN_ID: runId,
          UNCLECODE_TEAM_RUN_ROOT: runRoot,
          UNCLECODE_TEAM_WORKER_LIVE: "0",
          ...extraEnv,
        },
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (b) => { stdout += b.toString("utf8"); });
    child.stderr?.on("data", (b) => { stderr += b.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? -1 }));
  });
}

function setupRun() {
  const dataRoot = mkdtempSync(join(PROJECT_ROOT, ".test-tmp-router-"));
  const runId = generateRunId();
  const ref = createTeamRun({
    dataRoot,
    runId,
    objective: "router smoke",
    persona: "coder",
    lanes: 1,
    gate: "warn",
    runtime: "local",
    workspaceRoot: dataRoot,
    createdBy: "tests",
  });
  return { dataRoot, runId: ref.runId, runRoot: ref.runRoot };
}

test("handleTeamWorker dry-run emits 4-line envelope for SDK runtime", async () => {
  const { dataRoot, runId, runRoot } = setupRun();
  try {
    const { stdout, exitCode } = await runWorker(runRoot, runId, [
      "--worker-id", "w1",
      "--persona", "coder",
      "--task", "echo task",
      "--runtime", "openai",
    ]);
    assert.equal(exitCode, 0, `worker exited 0 (got ${exitCode})`);
    const lines = stdout.trim().split("\n");
    assert.equal(lines[0], "WORKER_ID=w1");
    assert.equal(lines[1], "PERSONA=coder");
    assert.equal(lines[2], "SUBMISSION:echo task");
    assert.ok(lines[3].length > 0, "submit marker present");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("handleTeamWorker dry-run accepts heterogeneous runtimes", async () => {
  const { dataRoot, runId, runRoot } = setupRun();
  try {
    for (const runtime of ["cursor", "codex", "opencode", "glm", "hermes"]) {
      const { stdout, exitCode } = await runWorker(runRoot, runId, [
        "--worker-id", "w1",
        "--persona", "coder",
        "--task", `task-for-${runtime}`,
        "--runtime", runtime,
      ]);
      assert.equal(exitCode, 0, `worker ${runtime} exited 0`);
      assert.match(stdout, new RegExp(`SUBMISSION:task-for-${runtime}`));
    }
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("handleTeamWorker rejects unknown runtime", async () => {
  const { dataRoot, runId, runRoot } = setupRun();
  try {
    const { stderr, exitCode } = await runWorker(runRoot, runId, [
      "--worker-id", "w1",
      "--persona", "coder",
      "--task", "x",
      "--runtime", "bogus",
    ]);
    assert.notEqual(exitCode, 0, "unknown runtime exits non-zero");
    assert.match(stderr, /unknown runtime/i);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("handleTeamWorker fails fast when bind env missing", async () => {
  const { dataRoot, runRoot } = setupRun();
  try {
    const runnerPath = join(runRoot, "worker-runner.mjs");
    writeFileSync(runnerPath, workerRunnerScript(), { mode: 0o755 });

    const result = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          "--import=tsx",
          runnerPath,
          "--worker-id", "w1",
          "--persona", "coder",
          "--task", "x",
          "--runtime", "openai",
        ],
        {
          cwd: runRoot,
          env: {
            ...process.env,
            UNCLECODE_TEAM_RUN_ID: undefined,
            UNCLECODE_TEAM_RUN_ROOT: undefined,
            UNCLECODE_TEAM_WORKER_LIVE: "0",
          },
        },
      );
      let stderr = "";
      child.stderr?.on("data", (b) => { stderr += b.toString("utf8"); });
      child.on("error", reject);
      child.on("close", (code) => resolve({ stderr, exitCode: code ?? -1 }));
    });
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /UNCLECODE_TEAM_RUN_ID|UNCLECODE_TEAM_RUN_ROOT/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
