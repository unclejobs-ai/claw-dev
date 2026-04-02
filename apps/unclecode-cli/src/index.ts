#!/usr/bin/env node

import { createUncleCodeProgram, shouldLaunchDefaultTui } from "./program.js";

async function main(): Promise<void> {
  const program = createUncleCodeProgram();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    if (
      shouldLaunchDefaultTui({
        args,
        stdinIsTTY: process.stdin.isTTY ?? false,
        stdoutIsTTY: process.stdout.isTTY ?? false,
      })
    ) {
      await program.parseAsync([process.argv[0] ?? "node", process.argv[1] ?? "unclecode", "tui"]);
      return;
    }

    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
