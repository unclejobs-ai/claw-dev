/**
 * Stub adapter factory. Steps 4-9 replace each TeamLaneRuntime slot in the
 * registry with the real implementation; until then the stub surfaces a
 * descriptive "not implemented" error so the registry contract is testable
 * end-to-end without crashing on accidental dispatch.
 */

import type { TeamLaneRuntime, WorkerSpec } from "@unclecode/contracts";

import type { LaneAdapter, LaneRunContext, LaneRunResult } from "./lane-adapter.js";

export function createStubAdapter(id: TeamLaneRuntime): LaneAdapter {
  return {
    id,
    preflight() {
      return {
        status: "missing",
        reason: `lane runtime "${id}" not yet wired — stub adapter active`,
      };
    },
    async run(spec: WorkerSpec, _ctx: LaneRunContext): Promise<LaneRunResult> {
      void spec;
      throw new Error(
        `lane runtime "${id}" has no implementation yet (stub) — worker ${spec.workerId} cannot dispatch`,
      );
    },
  };
}
