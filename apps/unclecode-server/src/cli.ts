#!/usr/bin/env node

import { startServer, makeStubHandlers } from "./index.js";

async function main(): Promise<void> {
  const port = Number.parseInt(process.env.UNCLECODE_SERVER_PORT ?? "17677", 10);
  const host = process.env.UNCLECODE_SERVER_HOST ?? "127.0.0.1";
  const { url } = await startServer({ port, host, handlers: makeStubHandlers() });
  process.stdout.write(`unclecode-server listening on ${url}\n`);
  process.stdout.write("Endpoints: GET /health, GET /sessions, GET /sessions/:id/events (SSE), POST /tools/invoke\n");
  process.stdout.write("Phase 1 ships stub handlers; orchestrator delegation arrives in a follow-up.\n");
}

main().catch((error) => {
  process.stderr.write(`unclecode-server failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
