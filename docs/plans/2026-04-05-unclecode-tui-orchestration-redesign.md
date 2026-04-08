# UncleCode TUI + Orchestration Redesign Implementation Plan

> **For agentic workers:** Implement this plan with the repo's standard execution workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the 2026-04-05 TUI/orchestration redesign incrementally without breaking the current `unclecode` surfaces.

**Architecture:** Ship this as a migration, not a rewrite. First remove misleading orchestration shims and inline-process spawning that distort the current UX, then consolidate command/context/runtime responsibilities behind reusable package boundaries, and finally merge the shell surfaces into a single-process Ink application with real orchestration events.

**Tech Stack:** TypeScript, Ink, Commander, Node test runner, UncleCode workspace packages (`contracts`, `config-core`, `context-broker`, `orchestrator`, `tui`, `providers`, `session-store`)

---

## Chunk 1: Phase 0 — honest traces + cutover prep

### Task 1: Lock trace behavior before cleanup
**Files:**
- Modify: `tests/contracts/trace.contract.test.mjs`
- Modify: `tests/work/agent.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `packages/contracts/src/trace.ts`
- Modify: `src/agent.ts`
- Modify: `src/cli.tsx`

- [x] Step 1: Add failing tests that assert fake `orchestrator.step` shims are gone from `CodingAgent.runTurn()`.
- [x] Step 2: Add failing tests that assert an honest `provider.calling` trace exists between `turn.started` and `turn.completed`.
- [x] Step 3: Run only the targeted trace/work tests and confirm the new expectations fail for the right reason.
- [x] Step 4: Add the minimal trace-contract changes needed to make the tests pass.
- [x] Step 5: Re-run the targeted trace/work tests and keep them green.

### Task 2: Prepare cutover evidence
**Files:**
- Modify: `docs/specs/2026-04-05-unclecode-tui-orchestration-redesign.md` (only if migration notes must be clarified)
- Add/Modify: `.sisyphus/evidence/*` (optional evidence notes)

- [x] Step 1: Record the current spawn/call-site boundaries that still block single-process unification.
- [x] Step 2: Keep this as documentation/evidence only; do not widen implementation scope until tests are green.

---

## Chunk 2: Phase 1a — eliminate inline command subprocesses

### Task 3: Lock direct inline-command execution in tests
**Files:**
- Modify: `tests/commands/tui-action-runner.test.mjs`
- Modify: `tests/work/repl.test.mjs` (if slash behavior text changes)
- Modify: `apps/unclecode-cli/src/operational.ts`
- Modify: `src/index.ts`

- [x] Step 1: Add a failing test for a reusable helper that maps work-shell inline commands (`doctor`, `auth status`, `auth login --browser`, `mcp list`, `mode status`) to direct operational actions without `execFile`.
- [x] Step 2: Run the targeted command/work tests and verify failure is due to the missing helper/path.
- [x] Step 3: Implement the smallest direct action runner in `apps/unclecode-cli/src/operational.ts` and switch `src/index.ts` to use it.
- [x] Step 4: Re-run the targeted tests and keep them green.

### Task 4: Verify no inline subprocess dependency remains in the work entrypoint
**Files:**
- Modify: `src/index.ts`

- [x] Step 1: Remove `execFile`/`promisify` usage from the work entrypoint.
- [x] Step 2: Rebuild and run the integration surfaces that cover `unclecode work --help`, `unclecode /doctor`, and slash-command forwarding.

---

## Chunk 3: Phase 1a/2 bridge — extract reusable work-shell engine seams

### Task 5: Isolate submit-loop business logic
**Files:**
- Add: `packages/orchestrator/src/work-shell-engine.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `src/cli.tsx`
- Modify: `src/index.ts`
- Add/Modify tests: `tests/work/*.mjs`, `tests/contracts/*.mjs`

- [x] Step 1: Introduce a small `WorkShellEngine` boundary that owns submit/slash-command side effects, while keeping the current UI intact.
- [x] Step 2: Move slash-command dispatch, trace wiring, session snapshot persistence, bridge publishing, and memory writes behind the engine boundary.
- [x] Step 3: Keep React component logic focused on view state and rendering only.
- [x] Step 4: Re-run targeted work-shell tests before widening to full build.

---

## Chunk 4: Phase 1b/2/3 — composer, command registry, context interop, unified shell

### Task 6: Port paste-capable composer
**Files:**
- Add/Modify: `packages/tui/**` or `src/cli.tsx` migration targets
- Add tests: `tests/tui/*.test.mjs`, `tests/work/*.mjs`

- [x] Step 1: Add failing tests for multiline paste behavior and submit suppression during paste.
- [x] Step 2: Port the minimal `usePasteHandler` behavior needed for text paste first.
- [x] Step 3: Replace `ink-text-input` usage only after the new composer passes targeted tests.

### Task 7: Consolidate command surfaces
**Files:**
- Add: command-registry runtime module under `packages/*`
- Modify: `apps/unclecode-cli/src/command-router.ts`
- Modify: `src/cli.tsx`
- Modify: `packages/contracts/src/commands.ts`
- Add tests: `tests/commands/*.test.mjs`, `tests/integration/*slash*.test.mjs`

- [x] Step 1: Register the existing built-in commands without changing semantics.
- [x] Step 2: Move work-shell slash resolution to the shared registry.
- [x] Step 3: Re-run slash/integration coverage after each command migration.

### Task 8: Move context-file loading into packages
**Files:**
- Modify/Add: `packages/context-broker/**`
- Modify: `src/workspace-guidance.ts`
- Add tests: `tests/work/workspace-guidance.test.mjs`, `tests/context-broker/*.test.mjs`

- [x] Step 1: Add failing tests for `GEMINI.md`, `UNCLECODE.md`, and `.local.md` discovery and precedence.
- [x] Step 2: Move the shared loader into `packages/context-broker`.
- [x] Step 3: Keep `src/workspace-guidance.ts` as a temporary shim until all callers are migrated.

### Task 9: Merge shell surfaces into a single Ink app
**Files:**
- Modify: `apps/unclecode-cli/src/program.ts`
- Modify: `apps/unclecode-cli/src/work-launcher.ts`
- Modify: `packages/tui/**`
- Modify: `src/index.ts`
- Add integration tests: `tests/integration/unclecode-*.test.mjs`

- [x] Step 1: Extract shared bootstrap once.
- [x] Step 2: Route `unclecode`, `unclecode work`, and `unclecode center` into the same process.
- [x] Step 3: Delete `work-launcher.ts` only after the replacement path is fully verified.

---

## Chunk 5: Phase 4/5 — real orchestration + plugin/skill loading

### Task 10: Replace the fake orchestrator with a real one
**Files:**
- Modify/Add: `packages/orchestrator/**`
- Modify: `packages/contracts/**`
- Modify: `packages/tui/**`
- Add tests: `tests/orchestrator/*.test.mjs`, `tests/performance/*.test.mjs`, `tests/contracts/*.test.mjs`

- [x] Step 1: Add failing tests for intent classification and bounded worker execution.
- [x] Step 2: Implement coordinator → planner → executor pool incrementally.
- [x] Step 3: Wire only real events to verbose mode.

### Task 11: Add plugin/skill runtime loading
**Files:**
- Modify/Add: `packages/config-core/**`, `packages/contracts/**`, runtime/plugin package targets
- Add tests: `tests/contracts/*.test.mjs`, `tests/integration/*.test.mjs`

- [x] Step 1: Add failing tests for manifest discovery and metadata loading.
- [x] Step 2: Load frontmatter first, full skill content on match.
- [x] Step 3: Inject plugin-provided commands into the shared registry.

---

## Post-plan structural cleanup lane

### Task 12: Extract composer-input loading out of `src/cli.tsx`
**Files:**
- Add: `packages/orchestrator/src/composer-input.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `resolveComposerInput(...)` behind an orchestrator package seam instead of a local `src/cli.tsx` implementation.
- [x] Step 2: Move image-path parsing and attachment loading into the package seam with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` as an import/re-export compatibility layer only.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 13: Extract slash resolution/suggestion helpers out of `src/cli.tsx`
**Files:**
- Add: `packages/orchestrator/src/work-shell-slash.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock slash resolution/suggestion/blocking helpers behind an orchestrator package seam.
- [x] Step 2: Move registry-backed slash helpers with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` as an import/re-export compatibility layer only.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 14: Extract reasoning helpers out of `src/cli.tsx`
**Files:**
- Add: `packages/orchestrator/src/reasoning.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock reasoning helpers behind an orchestrator package seam.
- [x] Step 2: Move `describeReasoning(...)` and `resolveReasoningCommand(...)` with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` as an import/re-export compatibility layer only.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 15: Extract dashboard home-sync helper out of `src/cli.tsx`
**Files:**
- Add: `packages/tui/src/work-shell-dashboard-sync.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `shouldRefreshDashboardHomeState(...)` behind a shared TUI package seam.
- [x] Step 2: Move the helper with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` as an import/re-export compatibility layer only.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 16: Extract inline-command runner glue out of `src/cli.tsx`
**Files:**
- Add: `packages/orchestrator/src/work-shell-inline-command.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock inline-command execution/error collection behind an orchestrator package seam.
- [x] Step 2: Move the runner logic with no behavior change, leaving only formatting glue in `src/cli.tsx` if needed.
- [x] Step 3: Keep `src/cli.tsx` free of inline stdout/stderr parsing logic.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 17: Extract auth-label parsing helper out of `src/cli.tsx`
**Files:**
- Modify: `packages/tui/src/work-shell-panels.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock auth-label parsing behind the shared TUI package seam.
- [x] Step 2: Export and reuse the shared parser with no behavior change.
- [x] Step 3: Remove the local parser from `src/cli.tsx`.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 18: Extract Dashboard prop assembly out of `src/cli.tsx`
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock shared embedded-dashboard prop assembly behind the TUI package seam.
- [x] Step 2: Move the prop assembly with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` as a thin wrapper around the package helper.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 19: Extract WorkShellEngine assembly out of `src/cli.tsx`
**Files:**
- Add: `packages/orchestrator/src/work-shell-engine-factory.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `packages/orchestrator/src/work-shell-engine.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/orchestrator/work-shell-engine.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `WorkShellEngine` assembly behind an orchestrator package seam.
- [x] Step 2: Move the engine construction with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` using a thin factory call instead of `new WorkShellEngine(...)` directly.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 20: Extract work-shell slash panel selection helpers out of `src/cli.tsx`
**Files:**
- Modify: `packages/tui/src/work-shell-panels.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock slash-selection/panel resolution behind the shared TUI seam.
- [x] Step 2: Move the pure helper logic with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` consuming the shared helpers instead of open-coding slash panel state logic.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 21: Extract work-shell dashboard home-sync payload helpers out of `src/cli.tsx`
**Files:**
- Modify: `packages/tui/src/work-shell-dashboard-sync.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock home-sync patch/snapshot helpers behind the shared TUI seam.
- [x] Step 2: Move the pure helper logic with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` consuming the shared helpers instead of open-coding home-sync payload objects.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 22: Extract work-shell input/submit decision helpers out of `src/cli.tsx`
**Files:**
- Add: `packages/tui/src/work-shell-input.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock work-shell input/submit decision helpers behind the shared TUI seam.
- [x] Step 2: Move the pure helper logic with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` consuming the shared helpers instead of open-coding input/submit branching.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 23: Extract work-shell lifecycle/composer hooks out of `src/cli.tsx`
**Files:**
- Add: `packages/tui/src/work-shell-hooks.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock lifecycle/composer hooks behind the shared TUI seam.
- [x] Step 2: Move the hook logic with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` consuming the shared hooks instead of open-coding lifecycle/composer effects.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 24: Extract Dashboard home-sync hook out of `src/cli.tsx`
**Files:**
- Modify: `packages/tui/src/work-shell-hooks.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock Dashboard home-sync behind the shared TUI seam.
- [x] Step 2: Move the patch/refresh effect logic with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` consuming the shared hook instead of open-coding home-sync effects.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 25: Extract work-shell slash state hook out of `src/cli.tsx`
**Files:**
- Modify: `packages/tui/src/work-shell-hooks.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock slash-state handling behind the shared TUI seam.
- [x] Step 2: Move slash suggestion/selection/active-panel logic with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` consuming the shared hook instead of open-coding slash-state effects.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 26: Extract work-shell input/submit controller hook out of `src/cli.tsx`
**Files:**
- Modify: `packages/tui/src/work-shell-hooks.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock input/submit controller handling behind the shared TUI seam.
- [x] Step 2: Move the `useInput(...)` and submit callback logic with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` consuming the shared hook instead of open-coding controller execution.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 27: Extract composite work-shell pane hook out of `src/cli.tsx`
**Files:**
- Modify: `packages/tui/src/work-shell-hooks.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock a shared composite pane hook behind the TUI seam.
- [x] Step 2: Move hook composition/state wiring with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` consuming the composite hook instead of manually composing the smaller hooks.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 28: Move Composer into `packages/tui` and reduce root shim ownership
**Files:**
- Add: `packages/tui/src/composer.tsx`
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/package.json`
- Modify: `src/composer.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock Composer ownership behind the shared TUI seam.
- [x] Step 2: Move Composer and its paste helpers with no behavior change.
- [x] Step 3: Keep `src/composer.tsx` as a thin compatibility shim and `src/cli.tsx` importing Composer from `@unclecode/tui`.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 29: Move work-shell pane composition into `packages/tui`
**Files:**
- Add: `packages/tui/src/work-shell-pane.tsx`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `WorkShellPane` ownership behind the shared TUI seam.
- [x] Step 2: Move pane-level view/composer/panel-hook composition with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` focused on engine assembly/session wiring while `packages/tui` owns the pane component.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 30: Canonicalize session-store root resolution behind `@unclecode/session-store`
**Files:**
- Add: `packages/session-store/src/root.ts`
- Modify: `packages/session-store/src/index.ts`
- Modify: `src/session-store-paths.ts`
- Modify: `src/cli.tsx`
- Modify: `src/context-memory.ts`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `apps/unclecode-cli/src/operational.ts`
- Modify: `tests/contracts/session-store.persistence.test.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock a canonical `getSessionStoreRoot(...)` export behind the session-store package seam.
- [x] Step 2: Export the helper from `@unclecode/session-store` and convert `src/session-store-paths.ts` into a thin shim.
- [x] Step 3: Migrate root/app work-session callers off the local root helper where safe, including `src/cli.tsx`, `src/context-memory.ts`, `apps/unclecode-cli/src/work-runtime.ts`, and `apps/unclecode-cli/src/operational.ts`.
- [x] Step 4: Re-run targeted contract/resume tests, then lint/check/build.

### Task 31: Move work-shell session snapshot/list helpers behind `@unclecode/orchestrator`
**Files:**
- Add: `packages/orchestrator/src/work-shell-session.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `packages/orchestrator/package.json`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `tests/integration/unclecode-sessions.integration.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `listSessionLines(...)` and `persistWorkShellSessionSnapshot(...)` behind the orchestrator seam instead of local `src/cli.tsx` ownership.
- [x] Step 2: Move the helper implementations with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` as an import/re-export compatibility layer only.
- [x] Step 4: Re-run targeted contract/work/session tests, then lint/check/build.

### Task 32: Move work-shell pane runtime assembly behind `@unclecode/orchestrator`
**Files:**
- Add: `packages/orchestrator/src/work-shell-pane-runtime.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/orchestrator/work-shell-engine.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock pane runtime assembly behind an orchestrator seam instead of direct `src/cli.tsx` `createWorkShellEngine(...)`/slash callback assembly.
- [x] Step 2: Move engine + slash runtime assembly with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` focused on Dashboard/session wiring while consuming the shared pane-runtime helper.
- [x] Step 4: Re-run targeted contract/orchestrator/work tests, then lint/check/build.

### Task 33: Move Dashboard/work-pane composition out of `src/cli.tsx`
**Files:**
- Add: `packages/tui/src/work-shell-dashboard.tsx`
- Modify: `packages/tui/src/work-shell-pane.tsx`
- Modify: `packages/tui/src/index.tsx`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock embedded Dashboard/work-pane composition behind a shared TUI seam instead of a local `src/cli.tsx` `App` component.
- [x] Step 2: Move the composition into `packages/tui` with no behavior change.
- [x] Step 3: Keep `src/cli.tsx` as a thin dependency assembly wrapper around the shared TUI helper.
- [x] Step 4: Re-run targeted contract/work tests, then lint/check/build.

### Task 34: Move context-memory helpers behind `@unclecode/context-broker`
**Files:**
- Add: `packages/context-broker/src/context-memory.ts`
- Modify: `packages/context-broker/src/index.ts`
- Modify: `packages/context-broker/package.json`
- Modify: `packages/context-broker/tsconfig.json`
- Modify: `src/context-memory.ts`
- Modify: `src/cli.tsx`
- Modify: `apps/unclecode-cli/src/operational.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Add/Modify: `tests/context-broker/*.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock project bridge/scoped memory helpers behind a shared context-broker seam instead of root `src/context-memory.ts` ownership.
- [x] Step 2: Move bridge + scoped memory persistence/listing helpers into `packages/context-broker` with no behavior change.
- [x] Step 3: Keep `src/context-memory.ts` as a compatibility shim and reuse the package seam from `src/cli.tsx` and `apps/unclecode-cli/src/operational.ts`.
- [x] Step 4: Re-run targeted contract/context/work/home-state tests, then lint/check/build.

### Task 35: Move workspace-skill discovery/loading behind `@unclecode/context-broker`
**Files:**
- Add: `packages/context-broker/src/workspace-skills.ts`
- Modify: `packages/context-broker/src/index.ts`
- Modify: `src/workspace-skills.ts`
- Modify: `src/workspace-guidance.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Add/Modify: `tests/context-broker/*.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock workspace-skill metadata/list/load helpers behind a shared context-broker seam instead of root `src/workspace-skills.ts` ownership.
- [x] Step 2: Move discovery/cache/loading helpers into `packages/context-broker` with no behavior change.
- [x] Step 3: Keep `src/workspace-skills.ts` as a compatibility shim and reuse the package seam from `src/cli.tsx` and `src/workspace-guidance.ts`.
- [x] Step 4: Re-run targeted contract/context/work tests, then lint/check/build.

### Task 36: Move work-runtime config/tool/guidance dependencies behind package seams
**Files:**
- Add: `packages/orchestrator/src/work-config.ts`
- Add: `packages/orchestrator/src/tools.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `packages/orchestrator/package.json`
- Modify: `packages/orchestrator/tsconfig.json`
- Modify: `packages/context-broker/src/workspace-guidance.ts`
- Modify: `packages/context-broker/src/index.ts`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `src/config.ts`
- Modify: `src/tools.ts`
- Modify: `src/workspace-guidance.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/context-broker/workspace-guidance.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `apps/unclecode-cli/src/work-runtime.ts` away from root `src/config.ts`, `src/tools.ts`, and `src/workspace-guidance.ts` imports.
- [x] Step 2: Move work config + tool ownership into `@unclecode/orchestrator` and make `src/config.ts` / `src/tools.ts` thin shims.
- [x] Step 3: Move cached runtime workspace-guidance loading into `@unclecode/context-broker` and make `src/workspace-guidance.ts` a thin shim.
- [x] Step 4: Reuse the package seams from `apps/unclecode-cli/src/work-runtime.ts`, then re-run targeted contract/context/work tests before full verification.

### Task 37: Move Dashboard/startRepl assembly behind a shared TUI seam and remove `src/cli.js` from `work-runtime`
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `packages/tui/package.json`
- Modify: `packages/tui/tsconfig.json`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `apps/unclecode-cli/src/work-runtime.ts` away from `../../../src/cli.js` and require `src/cli.tsx` to delegate Dashboard/startRepl assembly to a shared TUI helper.
- [x] Step 2: Add a generic shared TUI helper that assembles the embedded work Dashboard props and render path using package seams.
- [x] Step 3: Reuse that helper from both `apps/unclecode-cli/src/work-runtime.ts` and `src/cli.tsx`, leaving `src/cli.tsx` as a thin compatibility wrapper.
- [x] Step 4: Re-run targeted contract/work/orchestrator tests before full verification.

### Task 38: Move concrete agent assembly into app ownership and remove `src/agent.js` from `work-runtime`
**Files:**
- Add: `apps/unclecode-cli/src/runtime-coding-agent.ts`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Add/Modify: `tests/work/*.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `apps/unclecode-cli/src/work-runtime.ts` away from `../../../src/agent.js` and require a local app-owned runtime coding-agent seam.
- [x] Step 2: Add a focused work test that locks refresh-token/provider-wiring behavior on the new runtime coding-agent seam.
- [x] Step 3: Implement the app-owned runtime coding-agent helper and switch `work-runtime.ts` to it, leaving only the root provider runtime as the temporary dynamic import.
- [x] Step 4: Re-run targeted contract/work tests before full verification.

### Task 39: Move runtime provider implementations into `@unclecode/providers` and remove `src/providers.js` from app runtime
**Files:**
- Add: `packages/providers/src/runtime.ts`
- Modify: `packages/providers/src/index.ts`
- Modify: `packages/providers/package.json`
- Modify: `src/providers.ts`
- Modify: `apps/unclecode-cli/src/runtime-coding-agent.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/*.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `apps/unclecode-cli/src/runtime-coding-agent.ts` away from `../../../src/providers.js` and require a package runtime provider seam.
- [x] Step 2: Add failing tests that lock `src/providers.ts` into a compatibility wrapper over the package runtime seam.
- [x] Step 3: Move the concrete runtime provider implementations into `@unclecode/providers` with injected tool-runtime dependencies, then switch app/root consumers over.
- [x] Step 4: Re-run targeted contract/work/provider tests before full verification.

### Task 40: Deduplicate provider wiring behind a shared package helper
**Files:**
- Modify: `packages/providers/src/runtime.ts`
- Modify: `src/agent.ts`
- Modify: `apps/unclecode-cli/src/runtime-coding-agent.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock `src/agent.ts` and `apps/unclecode-cli/src/runtime-coding-agent.ts` to reuse a shared package `createRuntimeProvider(...)` helper instead of open-coding provider selection.
- [x] Step 2: Export the shared provider-construction helper from `@unclecode/providers` without changing runtime behavior.
- [x] Step 3: Switch root/app agent wrappers to the shared helper and remove duplicated provider-selection branches.
- [x] Step 4: Re-run targeted contract/work tests before full verification.

### Task 41: Add prompt-driven `/review` and `/commit` work-shell commands
**Files:**
- Modify: `packages/orchestrator/src/command-registry.ts`
- Modify: `packages/orchestrator/src/work-shell-slash.ts`
- Modify: `packages/orchestrator/src/work-shell-engine.ts`
- Modify: `packages/tui/src/work-shell-panels.ts`
- Modify: `tests/commands/command-registry.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `tests/orchestrator/work-shell-engine.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock builtin prompt-command metadata and slash resolution for `/review` and `/commit`.
- [x] Step 2: Add failing engine tests that lock prompt rewriting/execution behavior for `/review` and `/commit`.
- [x] Step 3: Implement shared prompt-command resolution and engine handling without regressing existing inline/local commands.
- [x] Step 4: Re-run targeted command/work/orchestrator tests before full verification.

### Task 42: Add bounded executable guardian checks for complex work turns
**Files:**
- Add: `apps/unclecode-cli/src/guardian-checks.ts`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `packages/orchestrator/src/work-agent.ts`
- Modify: `tests/work/work-agent.test.mjs`
- Add: `tests/work/guardian-checks.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock WorkAgent to include injected executable-check summaries in guardian review/synthesis flow.
- [x] Step 2: Add failing tests for an app-owned guardian-check runner that discovers bounded scripts and reports pass/fail summaries without throwing away stderr context.
- [x] Step 3: Implement the app-owned runner and wire WorkAgent to consume it conservatively (`check` by default, `lint`+`check` for `ultrawork`).
- [x] Step 4: Re-run targeted work tests before full verification.

### Task 43: Enable explicit-alias and unambiguous-prefix slash resolution
**Files:**
- Modify: `packages/orchestrator/src/command-registry.ts`
- Modify: `packages/orchestrator/src/work-shell-slash.ts`
- Modify: `tests/commands/command-registry.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock explicit alias and 3+-character unambiguous prefix resolution for CLI/work-shell registries.
- [x] Step 2: Implement alias-first, then unique-prefix resolution without regressing exact matches.
- [x] Step 3: Re-run targeted command/work tests before full verification.

### Task 44: Add `/research <topic>` to the work shell and route it to real research execution
**Files:**
- Modify: `packages/orchestrator/src/command-registry.ts`
- Modify: `packages/orchestrator/src/work-shell-slash.ts`
- Modify: `apps/unclecode-cli/src/operational.ts`
- Modify: `packages/tui/src/work-shell-panels.ts`
- Modify: `tests/commands/command-registry.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `tests/orchestrator/work-shell-engine.test.mjs`
- Modify: `tests/commands/tui-action-runner.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock work-shell registry metadata, slash resolution, and inline execution for `/research <topic>` plus `/research status`.
- [x] Step 2: Implement the shared registry/slash resolution and route work-shell inline research commands into the existing research operational path.
- [x] Step 3: Re-run targeted command/work/orchestrator tests before full verification.

### Task 45: Reuse app-owned managed dashboard assembly from the root `src/cli.tsx` shim
**Files:**
- Add: `packages/orchestrator/src/model-command.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract/work tests that lock `src/cli.tsx` to reuse app-owned managed dashboard assembly while preserving existing compatibility exports.
- [x] Step 2: Export the app-owned managed dashboard helpers and switch `src/cli.tsx` to delegate `createWorkShellDashboardProps(...)` / `startRepl(...)` through them.
- [x] Step 3: Restore the missing `resolveModelCommand(...)` compatibility export behind an orchestrator package seam instead of re-growing `src/cli.tsx` local ownership.
- [x] Step 4: Re-run targeted contract/work tests before full verification.

### Task 46: Turn `src/cli.tsx` into a pure compatibility re-export surface
**Files:**
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `src/cli.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract tests that lock `src/cli.tsx` to re-export runtime-owned `resolveWorkShellInlineCommand(...)`, `createWorkShellDashboardProps(...)`, `startRepl(...)`, and `StartReplOptions` instead of locally defining them.
- [x] Step 2: Export the compatibility type/function seams from `apps/unclecode-cli/src/work-runtime.ts` and reuse them inside `runWorkCli(...)`.
- [x] Step 3: Reduce `src/cli.tsx` to package/helper imports plus pure re-exports.
- [x] Step 4: Re-run targeted contract/work tests before full verification.

### Task 47: Collapse direct coding-agent compatibility wrappers behind `@unclecode/orchestrator`
**Files:**
- Add: `packages/orchestrator/src/runtime-coding-agent.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `apps/unclecode-cli/src/runtime-coding-agent.ts`
- Modify: `src/agent.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract tests that lock app/root coding-agent wrappers to reuse an orchestrator package seam instead of duplicating provider wiring.
- [x] Step 2: Add the orchestrator-owned runtime coding-agent seam, preserving the existing root constructor contract and auth-refresh behavior.
- [x] Step 3: Reduce `apps/unclecode-cli/src/runtime-coding-agent.ts` and `src/agent.ts` to thin compatibility shims.
- [x] Step 4: Re-run targeted contract/work tests before full verification.

### Task 48: Collapse root provider compatibility wrappers behind `@unclecode/orchestrator`
**Files:**
- Add: `packages/orchestrator/src/workspace-providers.ts`
- Modify: `packages/orchestrator/src/index.ts`
- Modify: `src/providers.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract tests that lock `src/providers.ts` to become a pure shim instead of locally injecting tool runtime.
- [x] Step 2: Add an orchestrator-owned workspace provider seam that injects shared tool runtime once for root compatibility consumers.
- [x] Step 3: Reduce `src/providers.ts` to type/class re-exports from the orchestrator package seam.
- [x] Step 4: Re-run targeted provider/contract tests before full verification.

### Task 49: Make guardian executable checks changed-files-aware
**Files:**
- Modify: `apps/unclecode-cli/src/guardian-checks.ts`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `packages/orchestrator/src/work-agent.ts`
- Modify: `tests/work/guardian-checks.test.mjs`
- Modify: `tests/work/work-agent.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock docs-only changes to skip executable checks, test-only changes to select a test subset, and WorkAgent to pass changed-file hints into guardian hooks.
- [x] Step 2: Implement changed-files-aware guardian script selection in the app-owned check runner.
- [x] Step 3: Pass changed-file hints from complex planned tasks through WorkAgent into the guardian runner, and expand runtime candidate scripts to include `test`.
- [x] Step 4: Extend source-change handling so generic `test` requests can expand into available targeted subset scripts (for example `test:providers`, `test:context-broker`) when the workspace exposes them.
- [x] Step 5: Add/workspace targeted test scripts (`test:work`, `test:orchestrator`, `test:tui`, `test:commands`) and map additional source surfaces onto them.
- [x] Step 6: Re-run targeted guardian/work tests before full verification.

### Task 50: Migrate repo-internal tests off root compatibility shims
**Files:**
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/agent.test.mjs`
- Modify: `tests/work/openai-provider.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `tests/integration/unclecode-sessions.integration.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that locks repo-internal behavioral tests to package/app-owned seams instead of `src/cli.tsx`, `src/agent.ts`, and `src/providers.ts`.
- [x] Step 2: Migrate internal behavioral/integration tests to import the owning package/app seams directly while leaving compatibility assertions in the dedicated contract suite.
- [x] Step 3: Re-run targeted contract/work/integration coverage before full verification.

### Task 51: Collapse root declaration shims to owner-seam re-exports
**Files:**
- Modify: `src/agent.d.ts`
- Modify: `src/cli.d.ts`
- Modify: `src/providers.d.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that locks root declaration files to thin re-export shims instead of stale handwritten/generated local declarations.
- [x] Step 2: Reduce `src/agent.d.ts`, `src/cli.d.ts`, and `src/providers.d.ts` to owner-seam re-exports matching the current runtime shims.
- [x] Step 3: Re-run targeted contract checks before full verification.

### Task 52: Cut the dist-work packaging gate over to an app-owned work entrypoint
**Files:**
- Add: `apps/unclecode-cli/src/work-entry.ts`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `bin/unclecode.cjs`
- Modify: `tsconfig.work.json`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that locks the dynamic work entrypoint path to an app-owned `dist-work/apps/unclecode-cli/src/work-entry.js` output instead of `dist-work/src/index.js`.
- [x] Step 2: Add the app-owned work entrypoint, retarget runtime/bin loaders to it, and stop `tsconfig.work.json` from building `src/**` as the dist-work packaging root.
- [x] Step 3: Re-run targeted build/contract/integration coverage before full verification.
- [x] Step 4: Lock the built artifact shape so stale `dist-work/src/index.js` and `dist-work/src/work-shell-runtime.js` no longer survive a clean build.

### Task 53: Delete obsolete root runtime wrapper sources
**Files:**
- Delete: `src/index.ts`
- Delete: `src/work-shell-runtime.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/work-cli-resume.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `tests/contracts/tui-work-shell.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing coverage that flips the old thin-shim contract into absence checks for `src/index.ts` and `src/work-shell-runtime.ts`, and move remaining repo-internal runtime imports to app-owned seams.
- [x] Step 2: Delete the obsolete root runtime wrappers now that dist-work packaging and internal tests no longer depend on them.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 54: Remove stale checked-in generated root compat artifacts
**Files:**
- Delete: `src/*.js` stale compat outputs for surviving root shim modules
- Delete: `src/*.js.map` stale compat sourcemaps for surviving root shim modules
- Delete: `src/*.d.ts.map` stale compat declaration sourcemaps for surviving root shim modules
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `src/composer.d.ts`
- Modify: `src/config.d.ts`
- Modify: `src/context-memory.d.ts`
- Modify: `src/session-store-paths.d.ts`
- Modify: `src/tools.d.ts`
- Modify: `src/work-agent.d.ts`
- Modify: `src/workspace-guidance.d.ts`
- Modify: `src/workspace-skills.d.ts`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that locks root compat shims away from stale checked-in generated runtime/map artifacts.
- [x] Step 2: Delete the stale `src/*.js`, `src/*.js.map`, and `src/*.d.ts.map` compat artifacts, and realign remaining declaration shims to owner-seam exports/signatures.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 55: Delete obsolete root agent/provider compatibility surfaces
**Files:**
- Delete: `src/agent.ts`
- Delete: `src/providers.ts`
- Delete: `src/agent.d.ts`
- Delete: `src/providers.d.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that flips root agent/provider shims from thin-wrapper expectations into absence checks.
- [x] Step 2: Delete the obsolete root agent/provider compatibility source/declaration files now that repo-internal code, declarations, and packaging no longer depend on them.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 56: Delete obsolete root cli compatibility surfaces
**Files:**
- Delete: `src/cli.tsx`
- Delete: `src/cli.d.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/repl.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that flips the old root cli compat shim expectations into absence checks while preserving app/package seam verification.
- [x] Step 2: Delete `src/cli.tsx` and `src/cli.d.ts` once contract-only references are replaced by owner-seam checks.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 57: Delete obsolete root utility compatibility shims
**Files:**
- Delete: `src/composer.tsx`
- Delete: `src/composer.d.ts`
- Delete: `src/config.ts`
- Delete: `src/config.d.ts`
- Delete: `src/context-memory.ts`
- Delete: `src/context-memory.d.ts`
- Delete: `src/session-store-paths.ts`
- Delete: `src/session-store-paths.d.ts`
- Delete: `src/tools.ts`
- Delete: `src/tools.d.ts`
- Delete: `src/work-agent.ts`
- Delete: `src/work-agent.d.ts`
- Delete: `src/workspace-skills.ts`
- Delete: `src/workspace-skills.d.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/composer.test.mjs`
- Modify: `tests/work/context-memory.test.mjs`
- Modify: `tests/work/tools.test.mjs`
- Modify: `tests/work/work-agent.test.mjs`
- Modify: `tests/work/workspace-skills.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Move remaining repo-internal behavioral tests from root utility shims to owner package seams.
- [x] Step 2: Flip contract/declaration coverage for those root utility shims into absence checks and delete the obsolete source/declaration files.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 58: Delete the final root workspace-guidance compatibility shim
**Files:**
- Delete: `src/workspace-guidance.ts`
- Delete: `src/workspace-guidance.d.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/workspace-guidance.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Move workspace-guidance behavioral coverage to the shared `@unclecode/context-broker` cached-guidance seam.
- [x] Step 2: Flip the remaining root guidance shim/declaration expectations into absence checks and delete the obsolete wrapper.
- [x] Step 3: Re-run targeted contract/work/integration coverage before full verification.

### Task 59: Prefer same-tree embedded work navigation over session-center handoff
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/tui-dashboard.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing coverage that locks Dashboard navigation to prefer embedded work-pane updates over exit-and-relaunch handoff when an embedded controller is available.
- [x] Step 2: Add a mutable embedded work-pane controller in the interactive bootstrap and route `W Work` / `work-*` session selection through same-tree work view updates before falling back to launch handoff.
- [x] Step 2a: Make interactive `resume work-*` open directly into the embedded work view instead of landing on the sessions tab first.
- [x] Step 2b: When an embedded work session switch selects a different `work-*` session, refresh home state and retarget session-list focus to that session.
- [x] Step 3: Re-run targeted contract coverage before full verification.

### Task 60: Make guardian targeted-test selection contract-aware for public shell boundaries
**Files:**
- Modify: `apps/unclecode-cli/src/guardian-checks.ts`
- Modify: `tests/work/guardian-checks.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing tests that lock guardian narrowing to include `test:contracts` when public shell/bootstrap boundary files change.
- [x] Step 2: Upgrade targeted test-script resolution from single-script mapping to multi-script mapping so package/app boundary files can trigger both their local subset and the contract subset.
- [x] Step 3: Re-run targeted guardian coverage before full verification.

### Task 61: Eliminate the last root `src/` residue entirely
**Files:**
- Move: `src/anthropicCompatProxy.ts` → `scripts/anthropic-compat-proxy.ts`
- Delete: `src/types.ts`
- Remove empty root `src/` directory
- Modify: `README.md`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that flips the last root `src/` residue from tolerated leftovers into removal/relocation expectations.
- [x] Step 2: Move the standalone anthropic compat proxy out of the runtime root, delete the unused `src/types.ts`, and remove the empty root `src/` directory.
- [x] Step 3: Re-run targeted contract coverage before full verification.

### Task 62: Sync embedded work context and contract-aware guardian coverage more tightly
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `apps/unclecode-cli/src/guardian-checks.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/work/guardian-checks.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Make the interactive embedded-work controller return the latest context lines so Dashboard can keep inspector context in sync across embedded work-session switches, and seed initial embedded context lines when the shell opens directly into a work session.
- [x] Step 2: Extend guardian contract-aware narrowing from shell files alone to public package barrel/index seams that materially affect owner-boundary contracts.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 63: Carry embedded work home-state patches through the same-tree controller
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Upgrade the embedded work controller result from context-only updates to richer updates that can carry home-state patches from work dashboard props.
- [x] Step 2: Teach Dashboard to consume those embedded home-state patches directly before falling back to `refreshHomeState()`, reducing the remaining bridge-style refresh dependency.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 64: Let the embedded work controller carry selected-session identity too
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Extend the embedded controller update payload to include `selectedSessionId` so the work-side controller, not the Dashboard, is the primary source of truth for which embedded session just loaded.
- [x] Step 2: Make Dashboard consume the controller-provided selected session id first and only fall back to argv parsing if needed.
- [x] Step 3: Re-run targeted contract coverage before full verification.

### Task 65: Surface device-OAuth progress and user code in the work-shell auth panel
**Files:**
- Modify: `packages/orchestrator/src/work-shell-engine.ts`
- Modify: `packages/orchestrator/src/work-shell-inline-command.ts`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `tests/orchestrator/work-shell-engine.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing engine coverage that locks `/auth login` pending UI to show device-flow progress lines like the user code instead of only saying “Check the browser window.”
- [x] Step 2: Thread inline-command progress callbacks through the orchestrator/runtime seam so operational device/browser auth progress reaches the work-shell panel while the command is still running.
- [x] Step 3: Re-run targeted orchestrator/work coverage before full verification.

### Task 66: Formalize embedded work controller parsing/update helpers in a shared contract seam
**Files:**
- Add: `packages/contracts/src/tui.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `packages/tui/src/index.tsx`
- Modify: `tests/contracts/tui-dashboard.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that locks selected-session parsing and embedded update assembly behind a shared package seam instead of local duplicated helpers.
- [x] Step 2: Move `parseSelectedSessionIdFromArgs(...)`, `buildEmbeddedWorkSessionUpdate(...)`, and the shared update/controller types into `@unclecode/contracts`.
- [x] Step 3: Cut both the app bootstrap and Dashboard shell over to the shared helpers and remove the local interactive-shell parser/update helpers.
- [x] Step 4: Re-run targeted contract/work coverage before full verification.

### Task 67: Extend guardian impact inference for shared TUI controller contracts
**Files:**
- Modify: `apps/unclecode-cli/src/guardian-checks.ts`
- Modify: `tests/work/guardian-checks.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing guardian coverage that locks `packages/contracts/src/tui.ts` to both `test:contracts` and `test:tui` because it is a shared controller contract, not a contracts-only surface.
- [x] Step 2: Extend the changed-file mapping with the narrow shared-TUI-contract special case instead of broadening all contracts changes.
- [x] Step 3: Re-run targeted guardian coverage before full verification.

### Task 68: Export shared generic TUI render options and remove app-local session-center render typing
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/contracts-typecheck.test.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing type/source contracts that require `@unclecode/tui` to export a shared `TuiRenderOptions<...>` seam and require `interactive-shell.ts` to consume it instead of maintaining a local `SessionCenterRenderOptions` object type.
- [x] Step 2: Export the generic `TuiRenderOptions<HomeState>` type from the TUI package, reusing the shared embedded-controller contract while allowing richer app-owned home/session state shapes.
- [x] Step 3: Cut the interactive bootstrap over to the shared TUI render-options seam and keep the build green under `exactOptionalPropertyTypes`.
- [x] Step 4: Re-run targeted contract/type coverage before full verification.

### Task 69: Make embedded dashboard helper returns use the shared `TuiRenderOptions` seam too
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `tests/contracts/tui-dashboard.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that locks embedded dashboard helpers to `TuiRenderOptions<TuiShellHomeState>` instead of `React.ComponentProps<typeof Dashboard>`.
- [x] Step 2: Cut `createEmbeddedWorkShellDashboardProps(...)`, `createEmbeddedWorkShellPaneDashboardProps(...)`, `createManagedWorkShellDashboardProps(...)`, and `renderEmbeddedWorkShellPaneDashboard(...)` over to the shared render seam.
- [x] Step 3: Re-run targeted contract/type coverage before full verification.

### Task 70: Deduplicate Dashboard render entry assembly behind a shared helper
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `tests/contracts/tui-dashboard.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that locks `renderEmbeddedWorkShellPaneDashboard(...)` and `renderTui(...)` onto one shared Dashboard element builder.
- [x] Step 2: Extract the shared Dashboard element builder and cut both render entrypoints over to it without changing behavior.
- [x] Step 3: Re-run targeted contract/type coverage before full verification.

### Task 71: Formalize embedded work dashboard snapshots as a shared TUI seam
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `apps/unclecode-cli/src/work-runtime.ts`
- Modify: `tests/contracts/tui-dashboard.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract coverage that requires a shared `EmbeddedWorkDashboardSnapshot<HomeState>` export in `@unclecode/tui` and requires app-owned interactive/runtime seams to consume it instead of maintaining a local `Pick<TuiRenderOptions<...>, ...>` snapshot type.
- [x] Step 2: Export the shared snapshot alias from the TUI package and cut `interactive-shell.ts` plus `work-runtime.ts` over to it.
- [x] Step 3: Re-run targeted contract/type/work coverage before full verification.

### Task 72: Move embedded-work pane render-option assembly behind shared TUI helpers
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/contracts-typecheck.test.ts`
- Modify: `tests/contracts/tui-dashboard.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract/type coverage that requires shared `EmbeddedWorkPaneRenderOptions<HomeState>`, `extractEmbeddedHomeStatePatch(...)`, and `buildEmbeddedWorkPaneRenderOptions(...)` exports in `@unclecode/tui`, and requires `interactive-shell.ts` to consume them instead of keeping local embedded render-option assembly helpers.
- [x] Step 2: Export the shared helper/type seam from the TUI package and cut `interactive-shell.ts` over to it.
- [x] Step 3: Re-run targeted contract/type/work coverage before full verification.

### Task 73: Move the mutable embedded work-pane controller bridge behind a shared TUI helper
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/tui-dashboard.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract/behavior coverage that requires a shared `createEmbeddedWorkPaneController(...)` helper in `@unclecode/tui` and requires `interactive-shell.ts` to stop owning the mutable embedded-pane controller state directly.
- [x] Step 2: Export the shared helper from the TUI package and cut `interactive-shell.ts` over to it, letting the app bootstrap provide only the snapshot loader.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 74: Move session-center Dashboard option assembly behind a shared TUI helper
**Files:**
- Modify: `packages/tui/src/index.tsx`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/contracts-typecheck.test.ts`
- Modify: `tests/contracts/tui-dashboard.contract.test.mjs`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing contract/type/behavior coverage that requires a shared `createSessionCenterDashboardRenderOptions(...)` helper in `@unclecode/tui` and requires `interactive-shell.ts` to stop inlining the large `renderShell({...})` object.
- [x] Step 2: Export the shared helper from the TUI package and cut `interactive-shell.ts` over to it without changing session-center/work behavior.
- [x] Step 3: Re-run targeted contract/type/work coverage before full verification.

### Task 75: Move session-center runtime callback wiring behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchSessionCenter(...)` to build runtime callbacks through a dedicated helper instead of inlining `runAction`, `runSession`, and `launchWorkSession` closures inside the shared TUI render-option call.
- [x] Step 2: Extract `createSessionCenterRuntimeCallbacks(...)` and cut `launchSessionCenter(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 76: Move session-center dependency resolution behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchSessionCenter(...)` to resolve build/render/operational dependencies through a dedicated helper instead of keeping `operational`, `buildHomeState`, `renderShell`, `runAction`, and `runSession` setup inline.
- [x] Step 2: Extract `resolveSessionCenterDependencies(...)` and cut `launchSessionCenter(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 77: Move launchInteractiveSurface center-input normalization behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchInteractiveSurface(...)` to normalize center-mode input through a dedicated helper instead of inlining the `launchSessionCenter({...}, deps)` object.
- [x] Step 2: Extract `createSessionCenterLaunchInput(...)` and cut `launchInteractiveSurface(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 78: Move launchInteractiveSurface work-branch forwarding behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchInteractiveSurface(...)` to build work-branch forwarding input through a dedicated helper instead of inlining the `launchWorkEntrypoint(...)` options object.
- [x] Step 2: Extract `createWorkLaunchInput(...)` and cut `launchInteractiveSurface(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 79: Move session-center environment normalization behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchSessionCenter(...)` to normalize `workspaceRoot`, `env`, and `userHomeDir` through a dedicated helper instead of keeping the fallback assignments inline.
- [x] Step 2: Extract `createSessionCenterEnvironment(...)` and cut `launchSessionCenter(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 80: Move work-entry module loader fallback behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires work-entry consumers to resolve `loadWorkModule` through a dedicated helper instead of repeating inline `loadWorkEntrypointModule()` fallback lambdas.
- [x] Step 2: Extract `resolveWorkModuleLoader(...)` and cut both `launchWorkEntrypoint(...)` and `loadEmbeddedWorkPane(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 81: Move session-center home-state loader creation behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchSessionCenter(...)` to build its `createHomeState` closure through a dedicated helper instead of inlining the `buildHomeState({...})` callback.
- [x] Step 2: Extract `createSessionCenterHomeStateLoader(...)` and cut `launchSessionCenter(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 82: Move session-center render-input assembly behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchSessionCenter(...)` to build the app-owned `createSessionCenterDashboardRenderOptions(...)` input through a dedicated helper instead of inlining the large render-input object.
- [x] Step 2: Extract `createSessionCenterRenderInput(...)` and cut `launchSessionCenter(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 83: Move session-center runtime-callback input assembly behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchSessionCenter(...)` to build `createSessionCenterRuntimeCallbacks(...)` input through a dedicated helper instead of inlining the callback-input object.
- [x] Step 2: Extract `createSessionCenterRuntimeCallbackInput(...)` and cut `launchSessionCenter(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 84: Move embedded-work load input assembly behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchSessionCenter(...)` to build `loadEmbeddedWorkPane(...)` input through a dedicated helper instead of passing inline arguments.
- [x] Step 2: Extract `createEmbeddedWorkPaneLoadInput(...)` and cut `launchSessionCenter(...)` plus `loadEmbeddedWorkPane(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 85: Move session-center async render-input preparation behind an app helper seam
**Files:**
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `launchSessionCenter(...)` to delegate home-state loading, embedded-pane loading, callback assembly, and render-input assembly to a dedicated async helper instead of orchestrating those steps inline.
- [x] Step 2: Extract `loadSessionCenterRenderInput(...)` and cut `launchSessionCenter(...)` over to it without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 86: Move session-center helper cluster into an app-owned support module
**Files:**
- Add: `apps/unclecode-cli/src/session-center-bootstrap.ts`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `interactive-shell.ts` to import session-center bootstrap helpers from an app-owned support module instead of defining the whole helper cluster inline.
- [x] Step 2: Extract the session-center helper cluster into `session-center-bootstrap.ts` and cut `interactive-shell.ts` over to the imported helpers without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 87: Move work-entry and embedded-pane bridge helpers into an app-owned support module
**Files:**
- Add: `apps/unclecode-cli/src/work-bootstrap.ts`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `interactive-shell.ts` to import work-entry and embedded-pane bridge helpers from an app-owned support module instead of defining them inline.
- [x] Step 2: Extract `withWorkCwd(...)`, work-entry loading/launch helpers, and embedded-work pane loading into `work-bootstrap.ts` and cut `interactive-shell.ts` over to imported ownership without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 88: Cut public work-launch ownership over to `work-bootstrap.ts`
**Files:**
- Modify: `apps/unclecode-cli/src/index.ts`
- Modify: `apps/unclecode-cli/src/program.ts`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `tests/commands/work-forwarding.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source/behavior coverage that requires app startup and repo-internal tests to consume `work-bootstrap.ts` as the owner seam for work launch helpers instead of routing through `interactive-shell.ts`.
- [x] Step 2: Cut `index.ts`, `program.ts`, and internal tests over to `work-bootstrap.ts`, leaving `interactive-shell.ts` focused on session-center and interactive-surface orchestration.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 89: Move interactive-surface input normalization behind an app support seam
**Files:**
- Add: `apps/unclecode-cli/src/interactive-launch-inputs.ts`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [x] Step 1: Add failing source contract coverage that requires `interactive-shell.ts` to import interactive-surface input normalization helpers from an app support module instead of defining them inline.
- [x] Step 2: Extract `SharedBootstrapDependencies`, `createWorkLaunchInput(...)`, and `createSessionCenterLaunchInput(...)` into `interactive-launch-inputs.ts` and cut `interactive-shell.ts` over without behavior changes.
- [x] Step 3: Re-run targeted contract/work coverage before full verification.

### Task 90: Move session-center launch orchestration into an app support seam
**Files:**
- Add: `apps/unclecode-cli/src/session-center-launcher.ts`
- Modify: `apps/unclecode-cli/src/interactive-shell.ts`
- Modify: `apps/unclecode-cli/src/program.ts`
- Modify: `tests/contracts/unclecode-cli.contract.test.mjs`
- Modify: `.sisyphus/evidence/*`

- [ ] Step 1: Add failing source/behavior coverage that requires `launchSessionCenter(...)` ownership to live in `session-center-launcher.ts` instead of `interactive-shell.ts`.
- [ ] Step 2: Extract `launchSessionCenter(...)` into `session-center-launcher.ts` and cut `interactive-shell.ts` / `program.ts` / internal tests over to the owner seam without behavior changes.
- [ ] Step 3: Re-run targeted contract/work coverage before full verification.

## Verification

- [x] Run targeted tests after each task before moving on.
- [x] Run `npm run lint`.
- [x] Run `npm run check`.
- [x] Run `npm run build`.
- [x] Run focused suites for contracts, commands, work, integration.
- [x] Capture any intentionally deferred items as explicit remaining risks.
