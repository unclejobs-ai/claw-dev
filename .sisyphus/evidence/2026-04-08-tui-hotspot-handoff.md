# 2026-04-08 TUI hotspot handoff

## Current objective
Continue the post-plan follow-up roadmap, with the immediate focus on shrinking `packages/tui/src/index.tsx` without changing operator-visible behavior.

Primary roadmap file:
- `docs/plans/2026-04-05-unclecode-post-plan-followup-refactor-roadmap.md`

Ground-truth migration evidence:
- `.sisyphus/evidence/2026-04-05-single-process-cutover.md`

## User intent to preserve
- keep going without waiting for permission
- keep implementing, not discussing
- do self-review continuously
- preserve behavior while thinning hotspots
- verify every pass before claiming progress

## What completed in this handoff window
This pass pushed the first real split of the remaining TUI hotspot.

### New owner seams added
- `packages/tui/src/dashboard-actions.ts`
  - owns action catalogs and pure session-center/dashboard model helpers
  - includes:
    - `DASHBOARD_ACTIONS`
    - `SESSION_CENTER_ACTIONS`
    - `createSessionCenterModel(...)`
    - `formatSessionHeadline(...)`
    - `formatSessionCenterDraftValue(...)`
    - `appendActivityEntry(...)`
    - `createApprovalRequestForAction(...)`
    - `getWorkspaceDisplayName(...)`
    - related session/dashboard types
- `packages/tui/src/dashboard-navigation.ts`
  - owns pure navigation/input logic
  - includes:
    - `handleDashboardInput(...)`
    - `handleSessionCenterInput(...)`
    - `handleResearchDraftInput(...)`
    - `getSessionCenterActionShortcut(...)`
    - `getImmediateActionShortcut(...)`
    - `getSessionCenterViewShortcut(...)`
    - `shouldRenderEmbeddedWorkPaneFullscreen(...)`
    - `resolveWorkPaneNavigationMode(...)`
    - `shouldCaptureDashboardInput(...)`
    - `handleApprovalInput(...)`
- `packages/tui/src/dashboard-render.tsx`
  - owns embedded/managed Dashboard prop assembly
  - includes:
    - `createEmbeddedWorkShellDashboardProps(...)`
    - `createEmbeddedWorkShellPaneDashboardProps(...)`
    - `createManagedWorkShellDashboardProps(...)`
    - `ManagedWorkShellDashboardInput`

### Existing hotspot reduced
- `packages/tui/src/index.tsx`
  - now re-exports:
    - `./dashboard-actions.js`
    - `./dashboard-navigation.js`
    - `./dashboard-render.js`
  - no longer owns the extracted pure dashboard/session-center helper families inline
  - still owns:
    - `Dashboard(...)`
    - `createDashboardElement(...)`
    - `renderEmbeddedWorkShellPaneDashboard(...)`
    - `renderManagedWorkShellDashboard(...)`
    - `renderTui(...)`
    - some remaining Dashboard-local helper/render concerns

## Progress 2026-04-11 — render-entry split locked down
- Created `packages/tui/src/dashboard-shell.tsx` to host the Dashboard component, render helpers, controller seams, and shared `TuiRenderOptions`/snapshot types.
- Added `packages/tui/src/tui-entry.tsx` so all render-entry helpers (`createDashboardElement`, `renderEmbeddedWorkShellPaneDashboard`, `renderManagedWorkShellDashboard`, `renderTui`) live outside `index.tsx` while preserving the public API surface via barrel exports.
- Converted `packages/tui/src/index.tsx` into a true barrel/assembly layer exporting all new owner seams plus `TuiShellHomeState`.
- Updated `tests/contracts/tui-dashboard.contract.test.mjs` so ownership assertions target the new modules instead of the old inline definitions; all 51 targeted tests now pass.
- Verification commands for this pass:
  - `npm run lint`
  - `npm run check`
  - `node --conditions=source --import tsx --test tests/contracts/tui-dashboard.contract.test.mjs tests/contracts/tui-session-center.contract.test.mjs`
- With render-entry ownership moved, Task 12 Step 3/4 from the roadmap are now complete; next pass can focus on shared store work (Task 13) without reopening this hotspot.

## Docs updated
- `docs/plans/2026-04-05-unclecode-post-plan-followup-refactor-roadmap.md`
  - Task 12:
    - Step 1 complete
    - Step 2 complete
    - Step 5 complete
    - Step 3 and Step 4 still open
- `.sisyphus/evidence/2026-04-05-single-process-cutover.md`
  - now records the new TUI owner seams and verification for this pass

## Fresh verification in this handoff
### Quality gates
- `npm run lint` ✅
- `npm run check` ✅

### Targeted/source verification
- `node --conditions=source --import tsx --test tests/contracts/tui-dashboard.contract.test.mjs tests/contracts/tui-session-center.contract.test.mjs` ✅
- `node --conditions=source --import tsx --test tests/contracts/tui-dashboard.contract.test.mjs tests/contracts/tui-work-shell.contract.test.mjs tests/contracts/tui-session-center.contract.test.mjs tests/work/repl.test.mjs tests/work/work-runtime.test.mjs tests/contracts/unclecode-cli.contract.test.mjs tests/commands/work-forwarding.test.mjs` ✅

Latest observed broad targeted result in this pass:
- `150 / 150 pass`

## Important touched files
- `packages/tui/src/dashboard-actions.ts`
- `packages/tui/src/dashboard-navigation.ts`
- `packages/tui/src/dashboard-render.tsx`
- `packages/tui/src/index.tsx`
- `tests/contracts/tui-dashboard.contract.test.mjs`
- `docs/plans/2026-04-05-unclecode-post-plan-followup-refactor-roadmap.md`
- `.sisyphus/evidence/2026-04-05-single-process-cutover.md`
- this handoff doc

## Next recommended pass
Continue Task 12 Step 3.

### Highest-value next extraction
Move render-entry and Dashboard assembly out of `packages/tui/src/index.tsx`, likely into:
- `packages/tui/src/tui-entry.tsx`
- and/or `packages/tui/src/dashboard-shell.tsx` / `packages/tui/src/dashboard-component.tsx`

### Best next slice
1. add failing contracts requiring owner seams for render-entry / Dashboard shell
2. move:
   - `createDashboardElement(...)`
   - `renderEmbeddedWorkShellPaneDashboard(...)`
   - `renderManagedWorkShellDashboard(...)`
   - `renderTui(...)`
   into a render-entry owner file
3. if stable, then split `Dashboard(...)` itself from `index.tsx`
4. rerun the same TUI/work/CLI verification matrix

## Watchouts / known sensitivities
- contract regexes are architecture-sensitive; prefer moving ownership and updating narrow source contracts, not weakening behavior coverage
- `tests/work/repl.test.mjs` is still the behavior source of truth when shared TUI extraction changes wording/layout expectations
- `exactOptionalPropertyTypes` remains active; keep conditional spreads for optional props
- when moving JSX into a new `.tsx` owner file, do not forget any required `React` import for the current toolchain/test path
- public exports from `@unclecode/tui` must stay stable because:
  - `apps/unclecode-cli/src/work-runtime.ts`
  - contract suites
  - REPL/runtime tests
  all consume them directly
- working tree is already broad/dirty; do not assume isolation to only this pass

## Structural status after this handoff
### Completed recent hotspot thinning
- `packages/orchestrator/src/work-shell-engine.ts`
  - builtin runtime extracted
  - command runtime extracted
  - helper seams locked by contract tests
- `packages/tui/src/index.tsx`
  - action/model/navigation owner seams extracted
  - managed/embedded Dashboard prop assembly extracted

### Still open
- `packages/tui/src/index.tsx` still remains a major hotspot because `Dashboard(...)` and render-entry ownership are still concentrated there
- shared shell store convergence has not started yet
- `/research` clipboard temp-path leakage remains open roadmap debt
- `/model` is only statically refreshed, not truly runtime-aware yet

## Suggested restart context for next agent
If resuming cold, re-read:
- `docs/plans/2026-04-05-unclecode-post-plan-followup-refactor-roadmap.md`
- `.sisyphus/evidence/2026-04-05-single-process-cutover.md`
- `packages/tui/src/index.tsx`
- `packages/tui/src/dashboard-actions.ts`
- `packages/tui/src/dashboard-navigation.ts`
- `packages/tui/src/dashboard-render.tsx`
- `tests/contracts/tui-dashboard.contract.test.mjs`
- `tests/contracts/tui-session-center.contract.test.mjs`
- `tests/contracts/tui-work-shell.contract.test.mjs`
- `tests/work/repl.test.mjs`
- `tests/work/work-runtime.test.mjs`

## Recommended first command on resume
```bash
node --conditions=source --import tsx --test \
  tests/contracts/tui-dashboard.contract.test.mjs \
  tests/contracts/tui-session-center.contract.test.mjs
```
Then continue with the broader targeted matrix after the next extraction.
