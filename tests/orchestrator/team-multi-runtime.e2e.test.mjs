/**
 * E2E smoke: drive TeamRunner with heterogeneous lanes using the live worker
 * subprocess but with UNCLECODE_TEAM_WORKER_LIVE=0 so adapters short-circuit
 * to the dry-run envelope path. Validates: spawn args, envelope shape,
 * final status accepted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { startTeamRun } from "@unclecode/orchestrator";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function dryRunWorkerScript() {
  // Same wiring the real team-worker uses for the dry-run path: emit the
  // 4-line envelope contract regardless of which runtime was requested.
  return `#!/usr/bin/env node
import { formatWorkerEnvelope, TeamBinding, readBindingFromEnv, getPersonaConfig } from "@unclecode/orchestrator";

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const workerId = arg("--worker-id");
const persona = arg("--persona");
const task = arg("--task");
const runtime = arg("--runtime");

const bind = readBindingFromEnv();
if (!bind) { process.exit(2); }
const binding = new TeamBinding({ ...bind, role: "worker" });

binding.publish({
  type: "team_step",
  runId: binding.runId,
  workerId,
  stepIndex: 0,
  timestamp: new Date().toISOString(),
});

const config = getPersonaConfig(persona);
process.stdout.write(
  formatWorkerEnvelope({
    workerId,
    persona,
    submission: \`runtime=\${runtime} task=\${task}\`,
    submitMarker: config.submitMarker,
  }) + "\\n",
);
process.exit(0);
`;
}

test("multi-runtime dispatch dry-run: 3 heterogeneous lanes, all complete with envelope", async () => {
  const dataRoot = mkdtempSync(join(PROJECT_ROOT, ".test-tmp-e2e-mr-"));
  try {
    const workerPath = join(dataRoot, "dry-worker.mjs");
    writeFileSync(workerPath, dryRunWorkerScript(), { mode: 0o755 });

    const handle = startTeamRun({
      dataRoot,
      objective: "multi-runtime smoke",
      persona: "coder",
      lanes: 3,
      gate: "warn",
      runtime: "local",
      workspaceRoot: dataRoot,
      createdBy: "tests",
    });
    handle.start();

    let result;
    try {
      result = await handle.dispatch({
        workerCommand: { command: process.execPath, args: ["--import=tsx", workerPath] },
        workers: [
          { workerId: "w1", persona: "coder", task: "summarize", runtime: "cursor", model: "composer-2.5" },
          { workerId: "w2", persona: "coder", task: "summarize", runtime: "codex", model: "gpt-5.5" },
          { workerId: "w3", persona: "coder", task: "summarize", runtime: "opencode", model: "kimi-k2.6" },
        ],
        perWorkerTimeoutMs: 30_000,
        extraEnv: { UNCLECODE_TEAM_WORKER_LIVE: "0" },
      });
    } finally {
      handle.release();
    }

    assert.equal(result.status, "accepted");
    assert.equal(result.outcomes.length, 3);
    for (const outcome of result.outcomes) {
      assert.equal(outcome.status, "completed", `${outcome.workerId} completed`);
      assert.match(outcome.stdout, /WORKER_ID=/);
      assert.match(outcome.stdout, /PERSONA=coder/);
      assert.match(outcome.stdout, /SUBMISSION:runtime=/);
    }
    const w1 = result.outcomes.find((o) => o.workerId === "w1");
    assert.match(w1.stdout, /runtime=cursor/);
    const w3 = result.outcomes.find((o) => o.workerId === "w3");
    assert.match(w3.stdout, /runtime=opencode/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("multi-runtime dispatch dry-run: hermes lane carries extras through env", async () => {
  const dataRoot = mkdtempSync(join(PROJECT_ROOT, ".test-tmp-e2e-mr2-"));
  try {
    const workerPath = join(dataRoot, "dry-worker.mjs");
    writeFileSync(workerPath, dryRunWorkerScript(), { mode: 0o755 });

    const handle = startTeamRun({
      dataRoot,
      objective: "hermes smoke",
      persona: "coder",
      lanes: 1,
      gate: "warn",
      runtime: "local",
      workspaceRoot: dataRoot,
      createdBy: "tests",
    });
    handle.start();

    let result;
    try {
      result = await handle.dispatch({
        workerCommand: { command: process.execPath, args: ["--import=tsx", workerPath] },
        workers: [
          {
            workerId: "w1",
            persona: "coder",
            task: "review",
            runtime: "hermes",
            extras: { channel: "#review", agent: "codex" },
          },
        ],
        perWorkerTimeoutMs: 30_000,
        extraEnv: { UNCLECODE_TEAM_WORKER_LIVE: "0" },
      });
    } finally {
      handle.release();
    }

    assert.equal(result.status, "accepted");
    assert.match(result.outcomes[0].stdout, /runtime=hermes/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
