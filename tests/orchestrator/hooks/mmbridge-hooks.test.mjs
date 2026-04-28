import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NoOpMmBridgeClient,
  buildMmBridgeHooks,
  buildCitationEnforcer,
} from "@unclecode/orchestrator";

function ctx(messages = [], stepIndex = 1) {
  return { persona: "coder", stepIndex, messages };
}

test("NoOpMmBridgeClient gates pass and security findings empty", async () => {
  const client = new NoOpMmBridgeClient();
  const review = await client.review({ task: "x", messages: [] });
  assert.equal(review.issues.length, 0);
  const gate = await client.gate({ runId: "tr_x", submission: "done", messages: [] });
  assert.equal(gate.status, "pass");
});

test("buildMmBridgeHooks halts on risky shell command flagged by security", async () => {
  let securityCallCount = 0;
  const client = new NoOpMmBridgeClient();
  client.security = async () => {
    securityCallCount += 1;
    return [{ severity: "error", category: "destructive", message: "rm -rf / blocked" }];
  };
  const { onAfterStep } = buildMmBridgeHooks({ client, runId: "tr_x" });
  const decision = await onAfterStep(
    ctx(),
    { tool: "run_shell", input: { command: "rm -rf /" } },
    { stdout: "", stderr: "", exitCode: -1, truncated: false },
  );
  assert.equal(securityCallCount, 1);
  assert.equal(decision.kind, "halt");
  assert.match(decision.reason ?? "", /rm -rf/);
});

test("buildMmBridgeHooks ignores write_file when no review issues", async () => {
  const client = new NoOpMmBridgeClient();
  const { onAfterStep } = buildMmBridgeHooks({ client, runId: "tr_x" });
  const decision = await onAfterStep(
    ctx(),
    { tool: "write_file", input: { path: "src/a.ts", content: "x" } },
    { stdout: "", stderr: "", exitCode: 0, truncated: false },
  );
  assert.equal(decision.kind, "continue");
});

test("buildMmBridgeHooks injects review notes when reviewer surfaces issues", async () => {
  const client = new NoOpMmBridgeClient();
  client.review = async () => ({
    reviewerId: "qwen",
    summary: "missing test",
    issues: ["no regression test added"],
  });
  const { onAfterStep } = buildMmBridgeHooks({ client, runId: "tr_x" });
  const decision = await onAfterStep(
    ctx(),
    { tool: "write_file", input: { path: "src/a.ts", content: "x" } },
    { stdout: "", stderr: "", exitCode: 0, truncated: false },
  );
  assert.equal(decision.kind, "inject");
  assert.match(decision.message?.content ?? "", /no regression test/);
});

test("buildMmBridgeHooks halts on submit when gate fails", async () => {
  const client = new NoOpMmBridgeClient();
  client.gate = async () => ({ gateId: "qwen-gate", status: "fail", summary: "tests broken" });
  const { onSubmit } = buildMmBridgeHooks({ client, runId: "tr_x" });
  const decision = await onSubmit(ctx(), "patch text");
  assert.equal(decision.kind, "halt");
  assert.match(decision.reason ?? "", /tests broken/);
});

test("buildCitationEnforcer skips when assistant has no factual claims", async () => {
  const enforcer = buildCitationEnforcer();
  const decision = await enforcer(
    ctx([
      { role: "system", content: "sys" },
      { role: "user", content: "task" },
      { role: "assistant", content: "I will inspect the repo first." },
    ]),
    { tool: "list_files", input: {} },
    { stdout: "", stderr: "", exitCode: 0, truncated: false },
  );
  assert.equal(decision.kind, "continue");
});

test("buildCitationEnforcer injects reminder when claims lack citations", async () => {
  const enforcer = buildCitationEnforcer();
  const decision = await enforcer(
    ctx([
      { role: "assistant", content: "tests pass and the build succeeds." },
    ]),
    { tool: "run_shell", input: { command: "echo" } },
    { stdout: "", stderr: "", exitCode: 0, truncated: false },
  );
  assert.equal(decision.kind, "inject");
  assert.match(decision.message?.content ?? "", /lack SSOT citations/);
});

test("buildCitationEnforcer accepts citations and continues", async () => {
  const enforcer = buildCitationEnforcer();
  const decision = await enforcer(
    ctx([
      {
        role: "assistant",
        content: "tests pass [step:5] and the build succeeds [step:6].",
      },
    ]),
    { tool: "run_shell", input: { command: "echo" } },
    { stdout: "", stderr: "", exitCode: 0, truncated: false },
  );
  assert.equal(decision.kind, "continue");
});
