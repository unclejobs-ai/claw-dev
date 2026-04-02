import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRuntimeBroker } from "@unclecode/runtime-broker";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "unclecode-cancel-test-"));
}

test("timeout kills long-running process after 300ms", async () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "local",
      captureOutput: true,
      timeoutMs: 300,
    });

    const container = await broker.spawn({
      command: "node",
      args: ["-e", "setTimeout(() => { console.log('late') }, 60_000)"],
      config: { workingDirectory: workdir },
    });

    assert.equal(container.state, "killed");
    assert.ok(
      container.stderr.includes("Timeout after 300ms"),
      "stderr was: " + container.stderr,
    );
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});

test("manual kill keeps final container state as killed", async () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "local",
      captureOutput: true,
      timeoutMs: 60_000,
    });

    const events = [];
    broker.onEvent((event) => events.push(event));

    const spawnPromise = broker.spawn({
      command: "node",
      args: ["-e", "setTimeout(() => {}, 60_000)"],
      config: { workingDirectory: workdir },
    });

    await new Promise((resolve) => {
      const poll = () => {
        if (events.some((event) => event.type === "spawned")) {
          resolve(undefined);
          return;
        }
        setTimeout(poll, 10);
      };
      poll();
    });

    const spawnedEvent = events.find((event) => event.type === "spawned");
    assert.ok(spawnedEvent, "spawned event should exist before kill");

    broker.kill(spawnedEvent.containerId);

    const container = await spawnPromise;
    assert.equal(container.state, "killed");
    assert.equal(
      events.filter((event) => event.type === "killed").length,
      1,
      "should emit exactly one killed event",
    );
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});
