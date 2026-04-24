# UncleCode × mmbridge MCP Integration and Hardening Plan

> For Hermes: use this as the execution and verification reference for the current integration pass.

Goal: Make mmbridge attach to UncleCode through MCP the right way, while using the integration work to improve mmbridge control-plane surface design and UncleCode runtime stability.

Architecture:
- UncleCode should consume mmbridge as a project-local MCP server, not as ad-hoc shell subprocess glue.
- mmbridge should expose the core control-plane surfaces UncleCode actually needs (`context_packet`, `review`, `gate`, `handoff`, `doctor`) with consistent `projectDir` handling.
- UncleCode should first gain reliable registration/discovery and stable local startup, then later grow full work-shell MCP tool invocation/discoverability.

Tech stack: TypeScript, Node 22+, stdio MCP, Commander CLI, local JSON config, project-local wrapper scripts.

---

## Current baseline

What already exists:
- mmbridge has a real MCP server in `packages/mcp`
- mmbridge already exposes MCP tools for review/research/security/debate/embrace/context packet
- UncleCode already loads MCP registry from `~/.unclecode/mcp.json` and `<workspace>/.mcp.json`
- UncleCode already has `mcp list` and research-mode MCP profile startup

What is still partial:
- mmbridge MCP surface is missing `gate`, `handoff`, `doctor`
- several mmbridge MCP handlers still default to `process.cwd()` rather than explicit `projectDir`
- UncleCode can register/list MCP servers, but work-shell runtime does not yet treat MCP-origin tools as first-class slash/tool surfaces
- UncleCode repo currently has no committed project-local mmbridge MCP server entry

## Objectives for this pass

1. Add a robust project-local mmbridge MCP launcher inside UncleCode.
2. Register mmbridge as a project MCP server in UncleCode.
3. Expand mmbridge MCP surface to the minimum useful integration set.
4. Make mmbridge MCP handlers consistent about `projectDir`.
5. Add regression tests for new mmbridge MCP surface.
6. Verify both repos end-to-end locally.
7. Write down remaining design/stability follow-up work rather than overbuilding in one pass.

## Scope

### In scope
- UncleCode project-local `.mcp.json`
- UncleCode launcher script for sibling/local/global mmbridge resolution
- mmbridge MCP tool additions: `gate`, `handoff`, `doctor`
- `projectDir` argument support where currently missing in mmbridge MCP handlers
- focused tests + smoke verification
- roadmap note for next stability/design phases

### Out of scope for this pass
- full MCP-origin slash command registry in UncleCode
- arbitrary MCP tool invocation from every work-shell turn
- major TUI redesign unrelated to MCP integration
- remote/hosted mmbridge deployment

## File-by-file impact

### UncleCode
- Create: `scripts/run-mmbridge-mcp.mjs`
- Create: `.mcp.json`
- Create: `docs/plans/2026-04-23-unclecode-mmbridge-mcp-integration-and-hardening.md`
- Optional update: `README.md` if we want one short note about project-local MCP wiring

### mmbridge
- Modify: `packages/mcp/src/tools.ts`
- Modify: `packages/mcp/test/tools.test.ts`
- Optional docs update: `README.md` if we want to mention agent-host MCP integration

## Task breakdown

### Task 1: Add UncleCode mmbridge MCP launcher
Objective: create one stable local entrypoint that can find mmbridge without hardcoding a single brittle path.

Behavior:
- prefer `MMBRIDGE_MCP_BIN` env override
- else use sibling repo build path `../mmbridge/packages/mcp/dist/index.js` when present
- else fall back to `mmbridge-mcp` on PATH
- fail with clear stderr message if nothing is available

Verification:
- `node scripts/run-mmbridge-mcp.mjs --help` is not required to succeed, but running the command should either launch stdio MCP or fail with the explicit diagnostic

### Task 2: Register mmbridge in UncleCode project MCP config
Objective: make `unclecode mcp list` show mmbridge from project config.

Config shape:
- `.mcp.json`
- server name: `mmbridge`
- transport: `stdio`
- command: `node`
- args: `scripts/run-mmbridge-mcp.mjs`

Verification:
- `cd ~/project/unclecode && node bin/unclecode.cjs mcp list`
- expected: output includes `mmbridge | stdio | project | project config`

### Task 3: Expand mmbridge MCP surface
Objective: expose the minimum control-plane tools UncleCode will actually need.

Add MCP tools:
- `mmbridge_gate`
- `mmbridge_handoff`
- `mmbridge_doctor`

Behavior:
- each tool should accept optional `projectDir`
- JSON output should be returned as text content, consistent with existing MCP handlers

Verification:
- package-level tests for tool definition presence
- local invocation through MCP server not required in test harness if definition/handler unit coverage is sufficient

### Task 4: Normalize `projectDir` handling in mmbridge MCP handlers
Objective: stop relying on implicit `process.cwd()` for the main MCP operations.

Targets:
- review
- research
- debate
- security
- embrace
- any new tools added in Task 3

Pattern:
- read `projectDir` from MCP args when provided
- otherwise fall back to `process.cwd()`

Verification:
- typecheck/build/tests green
- source audit shows no remaining hidden cwd-only behavior in core MCP handlers we touched

### Task 5: Add regression tests for mmbridge MCP surface
Objective: lock the new surface and avoid future drift.

Suggested minimum:
- export `TOOL_DEFINITIONS` from `packages/mcp/src/tools.ts`
- assert new tool names exist
- assert `projectDir` appears in the input schema for the handlers that should support it

Verification:
- `pnpm -C packages/mcp run test`

### Task 6: End-to-end verification
Objective: confirm both repos work together locally.

Commands:
- mmbridge:
  - `cd ~/project/mmbridge && pnpm -C packages/mcp run test`
  - `cd ~/project/mmbridge && pnpm run build`
- UncleCode:
  - `cd ~/project/unclecode && node bin/unclecode.cjs mcp list`
  - `cd ~/project/unclecode && node bin/unclecode.cjs doctor`

Expected:
- UncleCode lists mmbridge as project MCP server
- doctor shows non-zero MCP server count
- mmbridge mcp package builds/tests pass

## Design improvements to keep in view

### mmbridge design
- Make MCP the canonical agent-host integration surface, not a sidecar afterthought.
- Keep tool naming consistent and task-oriented.
- Keep all MCP tools `projectDir`-explicit so external hosts remain deterministic.
- Consider adding one future “workflow” abstraction for hosts that do not want to orchestrate many fine-grained tool calls themselves.

### UncleCode stability
- Registration first, invocation second.
- Avoid pretending MCP tools are native slash commands until runtime loading/invocation is truly implemented.
- Keep project-local MCP wiring via wrapper script so local dev environments do not break on PATH differences.
- Preserve clear diagnostics when sibling mmbridge build is missing.

## Remaining follow-up after this pass

1. UncleCode runtime MCP invocation layer
- capability discovery
- tool call execution
- tool/resource/prompt surfacing inside work shell

2. UncleCode design polish
- make MCP-origin capabilities discoverable from help/palette/slash suggestions
- show host/tool provenance in a cleaner operator-facing way

3. mmbridge host-product polish
- add host-facing docs/examples for UncleCode/OpenCode/Claude Code MCP registration
- possibly add `gate` / `handoff` resources as well as tools if hosts benefit from read-only access

## Acceptance criteria

- UncleCode project config registers mmbridge over stdio
- `unclecode mcp list` shows mmbridge
- `unclecode doctor` reflects the configured MCP server count
- mmbridge MCP exposes `gate`, `handoff`, and `doctor`
- main touched mmbridge MCP tools accept optional `projectDir`
- relevant tests/builds pass in both repos

## Risks

- UncleCode repo is currently dirty; avoid touching unrelated files.
- A sibling-repo path assumption is local-dev friendly but not globally portable; the wrapper must support env override and PATH fallback.
- Adding too much “native MCP command” UX in UncleCode without real runtime invocation would create misleading product surface.

## Rollback

- remove UncleCode `.mcp.json`
- remove `scripts/run-mmbridge-mcp.mjs`
- revert mmbridge MCP tool additions
- rerun repo tests/builds to confirm baseline restored
