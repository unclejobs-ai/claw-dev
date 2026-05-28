import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { startTeamRun } from "@unclecode/orchestrator";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Echo-args worker: prints every spawn arg as one JSON line so tests can
// assert exactly what TeamRunner forwarded for --runtime, --model, --extras.
function echoArgsWorkerScript() {
  return `#!/usr/bin/env node
process.stdout.write(JSON.stringify(process.argv.slice(2)) + "\\n");
process.exit(0);
`;
}

test("dispatch forwards --runtime / --model / --extras per worker", async () => {
  const dataRoot = mkdtempSync(join(PROJECT_ROOT, ".test-tmp-args-"));
  try {
    const workerPath = join(dataRoot, "echo-worker.mjs");
    writeFileSync(workerPath, echoArgsWorkerScript(), { mode: 0o755 });

    const handle = startTeamRun({
      dataRoot,
      objective: "arg forward test",
      persona: "coder",
      lanes: 3,
      gate: "warn",
      runtime: "local",
      workspaceRoot: dataRoot,
      createdBy: "tests",
    });
    handle.start();

    const result = await handle.dispatch({
      workerCommand: { command: process.execPath, args: [workerPath] },
      workers: [
        {
          workerId: "w1",
          persona: "coder",
          task: "task-1",
          runtime: "cursor",
          model: "composer-2.5",
        },
        {
          workerId: "w2",
          persona: "coder",
          task: "task-2",
          runtime: "opencode",
          model: "kimi-k2.6",
          extras: { provider: "moonshot" },
        },
        {
          workerId: "w3",
          persona: "coder",
          task: "task-3",
          runtime: "hermes",
          extras: { channel: "#review", agent: "codex" },
        },
      ],
      perWorkerTimeoutMs: 30_000,
    });
    handle.release();

    assert.equal(result.status, "accepted", "all workers exit 0");

    const argsByWorker = new Map();
    for (const outcome of result.outcomes) {
      const firstLine = outcome.stdout.split("\n").find((l) => l.trim().length > 0);
      assert.ok(firstLine, `worker ${outcome.workerId} produced stdout`);
      argsByWorker.set(outcome.workerId, JSON.parse(firstLine));
    }

    const w1 = argsByWorker.get("w1");
    assert.ok(w1.includes("--runtime"), "w1 has --runtime flag");
    assert.equal(w1[w1.indexOf("--runtime") + 1], "cursor");
    assert.ok(w1.includes("--model"));
    assert.equal(w1[w1.indexOf("--model") + 1], "composer-2.5");

    const w2 = argsByWorker.get("w2");
    assert.equal(w2[w2.indexOf("--runtime") + 1], "opencode");
    assert.equal(w2[w2.indexOf("--model") + 1], "kimi-k2.6");
    const w2ExtrasIdx = w2.indexOf("--extras");
    assert.ok(w2ExtrasIdx >= 0, "w2 has --extras flag");
    const w2Extras = JSON.parse(w2[w2ExtrasIdx + 1]);
    assert.deepEqual(w2Extras, { provider: "moonshot" });

    const w3 = argsByWorker.get("w3");
    assert.equal(w3[w3.indexOf("--runtime") + 1], "hermes");
    assert.equal(w3.indexOf("--model"), -1, "w3 omits --model when none");
    const w3Extras = JSON.parse(w3[w3.indexOf("--extras") + 1]);
    assert.deepEqual(w3Extras, { channel: "#review", agent: "codex" });
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
