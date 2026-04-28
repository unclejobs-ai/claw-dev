import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendTeamCheckpoint,
  createTeamRun,
  generateRunId,
  getRunStatusFromCheckpoints,
  lockTeamRun,
  readTeamCheckpoints,
  readTeamRunManifest,
  verifyTeamRunChain,
} from "@unclecode/session-store";

function makeTempRoot() {
  const dir = mkdtempSync(join(tmpdir(), "uc-team-run-"));
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

test("createTeamRun writes manifest + empty checkpoint log", () => {
  const dataRoot = makeTempRoot();
  try {
    const ref = createTeamRun({
      dataRoot,
      objective: "fix auth bug",
      persona: "coder",
      lanes: 1,
      gate: "strict",
      runtime: "local",
      workspaceRoot: "/tmp/ws",
      createdBy: "test",
    });
    assert.match(ref.runId, /^tr_\d+_[0-9a-f]{6}$/);
    const manifest = readTeamRunManifest(ref.runRoot);
    assert.equal(manifest.objective, "fix auth bug");
    assert.equal(manifest.persona, "coder");
    assert.equal(manifest.gate, "strict");
    assert.equal(readTeamCheckpoints(ref.runRoot).length, 0);
  } finally {
    cleanup(dataRoot);
  }
});

test("appendTeamCheckpoint chains hashes from genesis ZERO_HASH", () => {
  const dataRoot = makeTempRoot();
  try {
    const ref = createTeamRun({
      dataRoot,
      objective: "test",
      persona: "coder",
      lanes: 1,
      gate: "strict",
      runtime: "local",
      workspaceRoot: "/tmp/ws",
      createdBy: "test",
    });
    const first = appendTeamCheckpoint(ref.runRoot, {
      type: "team_run",
      runId: ref.runId,
      persona: "coder",
      status: "started",
      objective: "test",
      lanes: 1,
      timestamp: new Date(0).toISOString(),
    });
    assert.equal(first.prevTipHash, "0".repeat(64));
    assert.match(first.lineHash, /^[0-9a-f]{64}$/);

    const second = appendTeamCheckpoint(ref.runRoot, {
      type: "team_step",
      runId: ref.runId,
      workerId: "worker-1",
      stepIndex: 0,
      timestamp: new Date(1).toISOString(),
    });
    assert.equal(second.prevTipHash, first.lineHash);
    assert.notEqual(second.lineHash, first.lineHash);

    const verified = verifyTeamRunChain(ref.runRoot);
    assert.equal(verified.ok, true);
    assert.equal(verified.verifiedLines, 2);
  } finally {
    cleanup(dataRoot);
  }
});

test("appendTeamCheckpoint rejects mismatched prevTipHash (CAS)", () => {
  const dataRoot = makeTempRoot();
  try {
    const ref = createTeamRun({
      dataRoot,
      objective: "test",
      persona: "coder",
      lanes: 1,
      gate: "strict",
      runtime: "local",
      workspaceRoot: "/tmp/ws",
      createdBy: "test",
    });
    appendTeamCheckpoint(ref.runRoot, {
      type: "team_run",
      runId: ref.runId,
      persona: "coder",
      status: "started",
      objective: "test",
      lanes: 1,
      timestamp: new Date(0).toISOString(),
    });
    assert.throws(() => {
      appendTeamCheckpoint(ref.runRoot, {
        type: "team_step",
        runId: ref.runId,
        workerId: "worker-1",
        stepIndex: 0,
        timestamp: new Date(1).toISOString(),
        prevTipHash: "0".repeat(64),
      });
    }, /prevTipHash mismatch/);
  } finally {
    cleanup(dataRoot);
  }
});

test("verifyTeamRunChain detects tampered line", () => {
  const dataRoot = makeTempRoot();
  try {
    const ref = createTeamRun({
      dataRoot,
      objective: "test",
      persona: "coder",
      lanes: 1,
      gate: "strict",
      runtime: "local",
      workspaceRoot: "/tmp/ws",
      createdBy: "test",
    });
    appendTeamCheckpoint(ref.runRoot, {
      type: "team_run",
      runId: ref.runId,
      persona: "coder",
      status: "started",
      objective: "test",
      lanes: 1,
      timestamp: new Date(0).toISOString(),
    });
    appendTeamCheckpoint(ref.runRoot, {
      type: "team_step",
      runId: ref.runId,
      workerId: "worker-1",
      stepIndex: 0,
      timestamp: new Date(1).toISOString(),
    });
    const checkpointsPath = join(ref.runRoot, "checkpoints.ndjson");
    const tampered = readFileSync(checkpointsPath, "utf8").replace(
      /"objective":"test"/,
      '"objective":"hijacked"',
    );
    writeFileSync(checkpointsPath, tampered);
    const verified = verifyTeamRunChain(ref.runRoot);
    assert.equal(verified.ok, false);
    assert.equal(verified.brokenAt, 0);
  } finally {
    cleanup(dataRoot);
  }
});

test("lockTeamRun is exclusive and releasable", () => {
  const dataRoot = makeTempRoot();
  try {
    const ref = createTeamRun({
      dataRoot,
      objective: "test",
      persona: "coder",
      lanes: 1,
      gate: "strict",
      runtime: "local",
      workspaceRoot: "/tmp/ws",
      createdBy: "test",
    });
    const release = lockTeamRun(ref.runRoot, "coordinator-A");
    assert.ok(existsSync(join(ref.runRoot, ".lock")));
    assert.throws(() => lockTeamRun(ref.runRoot, "coordinator-B"), /already locked/);
    release();
    const release2 = lockTeamRun(ref.runRoot, "coordinator-C");
    release2();
  } finally {
    cleanup(dataRoot);
  }
});

test("getRunStatusFromCheckpoints returns latest team_run status", () => {
  const dataRoot = makeTempRoot();
  try {
    const ref = createTeamRun({
      dataRoot,
      objective: "test",
      persona: "coder",
      lanes: 1,
      gate: "strict",
      runtime: "local",
      workspaceRoot: "/tmp/ws",
      createdBy: "test",
    });
    appendTeamCheckpoint(ref.runRoot, {
      type: "team_run",
      runId: ref.runId,
      persona: "coder",
      status: "started",
      objective: "test",
      lanes: 1,
      timestamp: new Date(0).toISOString(),
    });
    appendTeamCheckpoint(ref.runRoot, {
      type: "team_run",
      runId: ref.runId,
      persona: "coder",
      status: "gated",
      objective: "test",
      lanes: 1,
      timestamp: new Date(1).toISOString(),
    });
    const checkpoints = readTeamCheckpoints(ref.runRoot);
    assert.equal(getRunStatusFromCheckpoints(checkpoints), "gated");
  } finally {
    cleanup(dataRoot);
  }
});

test("generateRunId is unique across rapid calls", () => {
  const ids = new Set();
  for (let i = 0; i < 50; i += 1) {
    ids.add(generateRunId());
  }
  assert.equal(ids.size, 50);
});
