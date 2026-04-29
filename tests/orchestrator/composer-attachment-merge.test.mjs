import test from "node:test";
import assert from "node:assert/strict";

import { mergeWorkShellComposerAttachments } from "@unclecode/orchestrator";

/**
 * Regression — Hermes review of TUI commit 40ab895 caught that
 * pendingClipboardAttachments lived only in TUI hook state and never
 * crossed the engine boundary. The merge helper at the engine seam is
 * what closes that gap: text-derived attachments from
 * resolveComposerInput plus pending attachments handed in at submit
 * time produce a single deduped list that the turn actually sees.
 */

const A = {
  type: "image",
  mimeType: "image/png",
  dataUrl: "data:image/png;base64,A==",
  path: "(clipboard)",
  displayName: "a.png",
};
const B = {
  type: "image",
  mimeType: "image/png",
  dataUrl: "data:image/png;base64,B==",
  path: "(clipboard)",
  displayName: "b.png",
};

function emptyResolution(extra = {}) {
  return {
    prompt: "",
    transcriptText: "",
    attachments: [],
    ...extra,
  };
}

test("returns the resolution untouched when no pending attachments are supplied", () => {
  const resolved = emptyResolution({ attachments: [A] });
  const merged = mergeWorkShellComposerAttachments(resolved, undefined);
  assert.equal(merged, resolved, "must short-circuit with the same reference");
});

test("returns the resolution untouched when the pending list is empty", () => {
  const resolved = emptyResolution({ attachments: [A] });
  const merged = mergeWorkShellComposerAttachments(resolved, []);
  assert.equal(merged, resolved);
});

test("appends pending attachments when text-resolved list is empty", () => {
  const resolved = emptyResolution();
  const merged = mergeWorkShellComposerAttachments(resolved, [A, B]);
  assert.deepEqual(
    merged.attachments.map((item) => item.dataUrl),
    [A.dataUrl, B.dataUrl],
  );
});

test("dedups by dataUrl when text and pending overlap, preserving text-first order", () => {
  const resolved = emptyResolution({ attachments: [A] });
  const merged = mergeWorkShellComposerAttachments(resolved, [A, B]);
  assert.equal(merged.attachments.length, 2, "duplicate of A must collapse");
  assert.deepEqual(
    merged.attachments.map((item) => item.dataUrl),
    [A.dataUrl, B.dataUrl],
    "text-derived attachments must come before pending",
  );
});

test("attachments without a dataUrl pass through unchanged so non-image kinds are not dropped", () => {
  const fileRef = { type: "file", displayName: "report.pdf" };
  const resolved = emptyResolution({ attachments: [fileRef] });
  const merged = mergeWorkShellComposerAttachments(resolved, [A]);
  assert.equal(merged.attachments.length, 2);
  assert.equal(merged.attachments[0]?.displayName, "report.pdf");
  assert.equal(merged.attachments[1]?.dataUrl, A.dataUrl);
});
