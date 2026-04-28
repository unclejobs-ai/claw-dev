import { test } from "node:test";
import assert from "node:assert/strict";

import { startServer, makeStubHandlers } from "@unclecode/server";

test("startServer responds to /health", async () => {
  const handlers = makeStubHandlers();
  const { url, stop } = await startServer({ port: 0, handlers });
  try {
    const response = await fetch(`${url}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(typeof body.pid, "number");
  } finally {
    await stop();
  }
});

test("startServer lists sessions via stub handlers", async () => {
  const handlers = makeStubHandlers();
  const { url, stop } = await startServer({ port: 0, handlers });
  try {
    const response = await fetch(`${url}/sessions`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.sessions, []);
  } finally {
    await stop();
  }
});

test("POST /tools/invoke returns the stub response shape", async () => {
  const handlers = makeStubHandlers();
  const { url, stop } = await startServer({ port: 0, handlers });
  try {
    const response = await fetch(`${url}/tools/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s1", toolName: "list_files", input: {} }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.toolCallId, "string");
    assert.equal(body.isError, false);
    assert.match(body.output, /not yet wired/);
  } finally {
    await stop();
  }
});
