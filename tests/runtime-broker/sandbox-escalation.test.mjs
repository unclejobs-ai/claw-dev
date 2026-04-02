import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRuntimeBroker } from "@unclecode/runtime-broker";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "unclecode-sandbox-test-"));
}

test("docker mode either runs successfully or reports adapter unavailable", async () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "docker",
      captureOutput: true,
      timeoutMs: 3000,
    });
    try {
      const container = await broker.spawn({
        command: "echo",
        args: ["hello"],
        config: { workingDirectory: workdir },
      });
      assert.equal(container.runtimeMode, "docker");
      assert.ok(
        container.state === "exited" || container.state === "failed",
        "state was: " + container.state,
      );
    } catch (err) {
      assert.equal(err.code, "ADAPTER_UNAVAILABLE");
      assert.ok(err.message.includes("Docker is not available"));
    }
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});

test("broker health aggregates adapter statuses after docker spawn attempt", async () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "docker",
      captureOutput: true,
      timeoutMs: 3000,
    });
    try {
      await broker.spawn({
        command: "echo",
        args: ["health-check"],
        config: { workingDirectory: workdir },
      });
    } catch {
      // expected when Docker not available
    }
    const health = broker.health();
    assert.ok(health.adapters.some((a) => a.mode === "local" && a.available));
    assert.ok(health.adapters.some((a) => a.mode === "docker"));
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});

test("e2b mode is rejected as not yet supported", async () => {
  const workdir = makeTempDir();
  try {
    const broker = createRuntimeBroker({
      workingDirectory: workdir,
      runtimeMode: "e2b",
    });

    await assert.rejects(
      broker.spawn({
        command: "echo",
        args: ["hello"],
        config: { workingDirectory: workdir, runtimeMode: "e2b" },
      }),
      (error) => {
        assert.equal(error.code, "ADAPTER_UNAVAILABLE");
        assert.ok(error.message.includes("not yet supported"));
        return true;
      },
    );
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
});
