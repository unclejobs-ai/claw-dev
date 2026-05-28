/**
 * Verifies that ctx.systemPrompt is propagated by every adapter — either
 * via the provider's native systemPrompt slot (SDK / Cursor / GLM) or by
 * prefixing the task text (Cursor / Codex / opencode / Hermes).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import {
  TeamBinding,
  applySystemPrefix,
  createCodexCliAdapter,
  createCursorAdapter,
  createGlmAdapter,
  createHermesAdapter,
  createOpencodeAdapter,
  createSdkAdapter,
} from "@unclecode/orchestrator";
import { createTeamRun, generateRunId } from "@unclecode/session-store";

function makeBinding(tag) {
  const dataRoot = mkdtempSync(join(process.cwd(), `.test-tmp-sysprompt-${tag}-`));
  const runId = generateRunId();
  const ref = createTeamRun({
    dataRoot,
    runId,
    objective: "sysprompt test",
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

test("applySystemPrefix wraps prompt in <persona> block", () => {
  assert.equal(applySystemPrefix(undefined, "task"), "task");
  assert.equal(applySystemPrefix("", "task"), "task");
  assert.equal(applySystemPrefix("you are a coder", "task"), "<persona>\nyou are a coder\n</persona>\n\ntask");
});

test("SDK adapter forwards ctx.systemPrompt to provider factory", async () => {
  const { binding, dataRoot } = makeBinding("sdk");
  let observed;
  try {
    const adapter = createSdkAdapter({
      id: "openai",
      providerFactory: ({ systemPrompt }) => {
        observed = systemPrompt;
        return { query: async () => ({ content: "", actions: [], costUsd: 0 }) };
      },
      miniLoopRunner: async () => ({ status: "submitted", submission: "x", steps: 0, costUsd: 0 }),
    });
    await adapter.run(
      { workerId: "w1", persona: "coder", task: "x", runtime: "openai" },
      { binding, cwd: dataRoot, env: { OPENAI_API_KEY: "k" }, systemPrompt: "system text" },
    );
    assert.equal(observed, "system text");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("Cursor adapter prefixes prompt with persona block", async () => {
  const { binding, dataRoot } = makeBinding("cursor");
  let observed;
  try {
    const adapter = createCursorAdapter({
      promptFn: async (msg) => {
        observed = msg;
        return { status: "finished", result: "" };
      },
    });
    await adapter.run(
      { workerId: "w1", persona: "coder", task: "do thing", runtime: "cursor" },
      { binding, cwd: dataRoot, env: { CURSOR_API_KEY: "k" }, systemPrompt: "persona X" },
    );
    assert.match(observed, /<persona>\npersona X\n<\/persona>/);
    assert.match(observed, /do thing/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("Codex CLI adapter prepends persona block to prompt arg", async () => {
  const { binding, dataRoot } = makeBinding("codex");
  let calledArgs;
  try {
    const adapter = createCodexCliAdapter({
      executor: async (_cmd, args) => {
        calledArgs = args;
        return { stdout: "", stderr: "", exitCode: 0 };
      },
      which: () => "/bin/codex",
    });
    await adapter.run(
      { workerId: "w1", persona: "coder", task: "do thing", runtime: "codex" },
      { binding, cwd: dataRoot, env: {}, systemPrompt: "persona Y" },
    );
    const prompt = calledArgs[calledArgs.length - 1];
    assert.match(prompt, /<persona>\npersona Y\n<\/persona>/);
    assert.match(prompt, /do thing/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("opencode adapter prepends persona block to message arg", async () => {
  const { binding, dataRoot } = makeBinding("opencode");
  let calledArgs;
  try {
    const adapter = createOpencodeAdapter({
      executor: async (_cmd, args) => {
        calledArgs = args;
        return { stdout: "", stderr: "", exitCode: 0 };
      },
      which: () => "/bin/opencode",
    });
    await adapter.run(
      { workerId: "w1", persona: "coder", task: "task body", runtime: "opencode" },
      { binding, cwd: dataRoot, env: {}, systemPrompt: "persona Z" },
    );
    const msg = calledArgs[calledArgs.length - 1];
    assert.match(msg, /<persona>\npersona Z\n<\/persona>/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("GLM adapter injects system role message in chat/completions body", async () => {
  const { binding, dataRoot } = makeBinding("glm");
  let body;
  try {
    const adapter = createGlmAdapter({
      fetchFn: async (_url, init) => {
        body = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "ok" } }] }),
          text: async () => "",
        };
      },
    });
    await adapter.run(
      { workerId: "w1", persona: "coder", task: "do thing", runtime: "glm" },
      { binding, cwd: dataRoot, env: { GLM_API_KEY: "k" }, systemPrompt: "you are GLM" },
    );
    assert.equal(body.messages.length, 2);
    assert.equal(body.messages[0].role, "system");
    assert.equal(body.messages[0].content, "you are GLM");
    assert.equal(body.messages[1].role, "user");
    assert.equal(body.messages[1].content, "do thing");
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test("Hermes adapter prepends persona block to acpx -- prompt arg", async () => {
  const { binding, dataRoot } = makeBinding("hermes");
  let calledArgs;
  try {
    const adapter = createHermesAdapter({
      executor: async (_cmd, args) => {
        calledArgs = args;
        return { stdout: "", stderr: "", exitCode: 0 };
      },
      which: () => "/bin/acpx",
    });
    await adapter.run(
      {
        workerId: "w1",
        persona: "coder",
        task: "do thing",
        runtime: "hermes",
        extras: { agent: "claude" },
      },
      { binding, cwd: dataRoot, env: {}, systemPrompt: "persona H" },
    );
    const prompt = calledArgs[calledArgs.length - 1];
    assert.match(prompt, /<persona>\npersona H\n<\/persona>/);
    assert.match(prompt, /do thing/);
  } finally {
    rmSync(dataRoot, { recursive: true, force: true });
  }
});
