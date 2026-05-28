import { test } from "node:test";
import assert from "node:assert/strict";

import { formatWorkerEnvelope } from "@unclecode/orchestrator";

test("formatWorkerEnvelope emits 4-line legacy contract", () => {
  const out = formatWorkerEnvelope({
    workerId: "w1",
    persona: "coder",
    submission: "hello world",
    submitMarker: "<<<SUBMIT>>>",
  });
  const lines = out.split("\n");
  assert.equal(lines[0], "WORKER_ID=w1");
  assert.equal(lines[1], "PERSONA=coder");
  assert.equal(lines[2], "SUBMISSION:hello world");
  assert.equal(lines[3], "<<<SUBMIT>>>");
});

test("formatWorkerEnvelope truncates submission past cap", () => {
  const huge = "x".repeat(5000);
  const out = formatWorkerEnvelope({
    workerId: "w1",
    persona: "coder",
    submission: huge,
    submitMarker: "<<<S>>>",
    submissionCap: 4096,
  });
  const line = out.split("\n")[2];
  assert.ok(line.startsWith("SUBMISSION:"));
  assert.ok(line.endsWith("…"));
  assert.ok(line.length <= "SUBMISSION:".length + 4097);
});

test("formatWorkerEnvelope preserves empty submission", () => {
  const out = formatWorkerEnvelope({
    workerId: "w1",
    persona: "coder",
    submission: "",
    submitMarker: "<<<S>>>",
  });
  const lines = out.split("\n");
  assert.equal(lines[2], "SUBMISSION:");
  assert.equal(lines[3], "<<<S>>>");
});
