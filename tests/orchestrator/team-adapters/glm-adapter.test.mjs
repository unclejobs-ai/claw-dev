import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { TeamBinding, createGlmAdapter } from "@unclecode/orchestrator";
import { createTeamRun, generateRunId } from "@unclecode/session-store";

function makeBinding() {
  const dataRoot = mkdtempSync(join(process.cwd(), ".test-tmp-glm-"));
  const runId = generateRunId();
  const ref = createTeamRun({
    dataRoot,
    runId,
    objective: "glm adapter test",
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

function mockFetch(canned) {
  const calls = [];
  return {
    calls,
    fetchFn: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: canned.ok ?? true,
        status: canned.status ?? 200,
        async json() {
          return canned.json;
        },
        async text() {
          return canned.text ?? JSON.stringify(canned.json ?? {});
        },
      };
    },
  };
}

test("glm adapter id is 'glm'", () => {
  const adapter = createGlmAdapter({ fetchFn: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal(adapter.id, "glm");
});

test("glm adapter preflight requires GLM_API_KEY", () => {
  const adapter = createGlmAdapter({ fetchFn: async () => ({ ok: true, json: async () => ({}) }) });
  assert.equal(adapter.preflight({}).status, "missing");
  assert.match(adapter.preflight({}).reason, /GLM_API_KEY/);
  assert.equal(adapter.preflight({ GLM_API_KEY: "k" }).status, "ok");
});

test("glm adapter run() posts OpenAI-compat chat/completions and extracts content", async () => {
  const { binding, dataRoot } = makeBinding();
  const { fetchFn, calls } = mockFetch({
    json: {
      choices: [{ message: { content: "glm reply text" } }],
    },
  });
  try {
    const adapter = createGlmAdapter({ fetchFn });
    const result = await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "summarize",
        runtime: "glm",
        model: "glm-5.1",
      },
      { binding, cwd: dataRoot, env: { GLM_API_KEY: "glm-test-key" } },
    );
    assert.equal(result.ok, true);
    assert.equal(result.submission, "glm reply text");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /chat\/completions$/);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers.Authorization, "Bearer glm-test-key");
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, "glm-5.1");
    assert.equal(body.messages[0].role, "user");
    assert.equal(body.messages[0].content, "summarize");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("glm adapter honors GLM_BASE_URL env override", async () => {
  const { binding, dataRoot } = makeBinding();
  const { fetchFn, calls } = mockFetch({
    json: { choices: [{ message: { content: "ok" } }] },
  });
  try {
    const adapter = createGlmAdapter({ fetchFn });
    await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "glm" },
      {
        binding,
        cwd: dataRoot,
        env: {
          GLM_API_KEY: "k",
          GLM_BASE_URL: "https://example.test/v4",
        },
      },
    );
    assert.equal(calls[0].url, "https://example.test/v4/chat/completions");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("glm adapter marks ok=false on non-2xx response", async () => {
  const { binding, dataRoot } = makeBinding();
  const { fetchFn } = mockFetch({
    ok: false,
    status: 500,
    text: "upstream timeout",
  });
  try {
    const adapter = createGlmAdapter({ fetchFn });
    const result = await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "glm" },
      { binding, cwd: dataRoot, env: { GLM_API_KEY: "k" } },
    );
    assert.equal(result.ok, false);
    assert.match(result.submission, /500|upstream timeout/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("glm adapter run() rejects when GLM_API_KEY missing", async () => {
  const { binding, dataRoot } = makeBinding();
  const { fetchFn } = mockFetch({ json: {} });
  try {
    const adapter = createGlmAdapter({ fetchFn });
    await assert.rejects(
      adapter.run(
        { workerId: "w1", persona: "coder", task: "x", runtime: "glm" },
        { binding, cwd: dataRoot, env: {} },
      ),
      /GLM_API_KEY/,
    );
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
