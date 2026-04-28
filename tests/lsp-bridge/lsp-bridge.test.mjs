import { test } from "node:test";
import assert from "node:assert/strict";

import { LspBridge } from "@unclecode/lsp-bridge";

function makeStubClient(id, exts, diagnostics = []) {
  return {
    id,
    handlesExtension(ext) {
      return exts.includes(ext.toLowerCase());
    },
    async notifyDidChange() {},
    async pollDiagnostics() {
      return diagnostics;
    },
    async shutdown() {},
  };
}

test("LspBridge.pollAfterEdit dispatches to clients matching extension", async () => {
  const bridge = new LspBridge();
  bridge.register(
    makeStubClient(
      "ts",
      [".ts"],
      [
        {
          path: "src/a.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
          severity: "error",
          message: "missing semicolon",
        },
      ],
    ),
  );
  bridge.register(makeStubClient("py", [".py"], []));
  const diagnostics = await bridge.pollAfterEdit({ path: "src/a.ts", content: "let x = 1\n" });
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].severity, "error");
});

test("LspBridge.pollAfterEdit returns empty when no client matches the extension", async () => {
  const bridge = new LspBridge();
  bridge.register(makeStubClient("ts", [".ts"], []));
  const diagnostics = await bridge.pollAfterEdit({ path: "src/a.go", content: "package main" });
  assert.equal(diagnostics.length, 0);
});

test("LspBridge.pollAfterEdit caps diagnostics by maxDiagnostics", async () => {
  const bridge = new LspBridge();
  const dx = Array.from({ length: 30 }, (_, i) => ({
    path: "src/a.ts",
    range: { start: { line: i, character: 0 }, end: { line: i, character: 1 } },
    severity: "warning",
    message: `warn ${i}`,
  }));
  bridge.register(makeStubClient("ts", [".ts"], dx));
  const diagnostics = await bridge.pollAfterEdit({
    path: "src/a.ts",
    content: "x",
    options: { maxDiagnostics: 5 },
  });
  assert.equal(diagnostics.length, 5);
});

test("LspBridge.shutdownAll empties the registered list", async () => {
  const bridge = new LspBridge();
  bridge.register(makeStubClient("ts", [".ts"]));
  bridge.register(makeStubClient("py", [".py"]));
  await bridge.shutdownAll();
  assert.equal(bridge.list().length, 0);
});
