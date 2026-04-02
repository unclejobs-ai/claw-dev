import assert from "node:assert/strict";
import test from "node:test";

import {
  createUncleCodeProgram,
  shouldLaunchDefaultTui,
} from "../../apps/unclecode-cli/src/program.ts";

test("createUncleCodeProgram exposes the unclecode root command and tui boundary", () => {
  const program = createUncleCodeProgram();
  const configCommand = program.commands.find((command) => command.name() === "config");
  const authCommand = program.commands.find((command) => command.name() === "auth");

  assert.equal(program.name(), "unclecode");
  assert.ok(program.commands.some((command) => command.name() === "tui"));
  assert.ok(configCommand);
  assert.ok(configCommand.commands.some((command) => command.name() === "explain"));
  assert.ok(authCommand);
  assert.ok(authCommand.commands.some((command) => command.name() === "login"));
  assert.ok(authCommand.commands.some((command) => command.name() === "status"));
});

test("shouldLaunchDefaultTui enables no-arg interactive startup", () => {
  assert.equal(
    shouldLaunchDefaultTui({
      args: [],
      stdinIsTTY: true,
      stdoutIsTTY: true,
    }),
    true,
  );
  assert.equal(
    shouldLaunchDefaultTui({
      args: [],
      stdinIsTTY: false,
      stdoutIsTTY: true,
    }),
    false,
  );
  assert.equal(
    shouldLaunchDefaultTui({
      args: ["auth", "status"],
      stdinIsTTY: true,
      stdoutIsTTY: true,
    }),
    false,
  );
});
