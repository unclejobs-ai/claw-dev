import assert from "node:assert/strict";
import test from "node:test";
import { createRuntimeBroker } from "@unclecode/runtime-broker";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "unclecode-runtime-test-"));
}

test("local adapter spawns echo and captures stdout", async () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "local",
      captureOutput: true,
    });

    const container = await broker.spawn({
      command: "echo",
      args: ["hello unclecode"],
      config: { workingDirectory: workdir },
    });

    assert.equal(container.state, "exited");
    assert.equal(container.exitCode, 0);
    assert.ok(container.stdout.includes("hello unclecode"), "stdout was: " + container.stdout);
    assert.equal(container.runtimeMode, "local");
    assert.ok(container.pid !== null);
    assert.ok(container.finishedAt !== null);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});

test("local adapter captures stderr from failing command", async () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "local",
      captureOutput: true,
    });

    const container = await broker.spawn({
      command: "node",
      args: ["-e", "process.stderr.write('err-output'); process.exit(1)"],
      config: { workingDirectory: workdir },
    });

    assert.equal(container.exitCode, 1);
    assert.ok(container.stderr.includes("err-output"), "stderr was: " + container.stderr);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});

test("broker emits spawned and exited events during local spawn", async () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "local",
      captureOutput: true,
    });

    const events = [];
    broker.onEvent((event) => events.push(event));

    await broker.spawn({
      command: "echo",
      args: ["event-test"],
      config: { workingDirectory: workdir },
    });

    assert.ok(events.some((e) => e.type === "spawned"));
    assert.ok(events.some((e) => e.type === "exited"));
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});

test("broker health reports local adapter as available", () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "local",
    });

    const health = broker.health();
    assert.equal(health.healthy, true);
    assert.ok(health.adapters.some((a) => a.mode === "local" && a.available));
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});
