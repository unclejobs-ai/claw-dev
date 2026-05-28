/**
 * Lane doctor — runs preflight() across every TeamLaneRuntime so the CLI
 * can show a "which lanes are usable on this machine" report. Pure
 * function; tests inject `env` (for SDK env checks) and `which` (for CLI
 * binary lookups).
 */

import { TEAM_LANE_RUNTIMES, type TeamLaneRuntime } from "@unclecode/contracts";

import { defaultWhich, type WhichFn } from "./cli-exec.js";
import { createCodexCliAdapter } from "./codex-cli-adapter.js";
import { createCursorAdapter } from "./cursor-adapter.js";
import { createGlmAdapter } from "./glm-adapter.js";
import { createHermesAdapter } from "./hermes-adapter.js";
import { createOpencodeAdapter } from "./opencode-adapter.js";
import { createSdkAdapter, type SdkLaneRuntime } from "./sdk-adapter.js";
import type { LaneAdapter } from "./lane-adapter.js";

export type LaneDoctorInput = {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly which?: WhichFn;
};

export type LaneDoctorLaneReport = {
  readonly runtime: TeamLaneRuntime;
  readonly status: "ok" | "missing";
  readonly reason?: string;
};

export type LaneDoctorReport = {
  readonly lanes: ReadonlyArray<LaneDoctorLaneReport>;
  readonly summary: { readonly ok: number; readonly missing: number };
};

function buildAdapterForDoctor(id: TeamLaneRuntime, which: WhichFn): LaneAdapter {
  if (id === "openai" || id === "anthropic" || id === "gemini") {
    return createSdkAdapter({ id: id as SdkLaneRuntime });
  }
  if (id === "cursor") return createCursorAdapter();
  if (id === "codex") return createCodexCliAdapter({ which });
  if (id === "opencode") return createOpencodeAdapter({ which });
  if (id === "glm") return createGlmAdapter();
  if (id === "hermes") return createHermesAdapter({ which });
  throw new Error(`lane doctor: no factory for runtime "${id}"`);
}

export function runLaneDoctor(input: LaneDoctorInput = {}): LaneDoctorReport {
  const env = input.env ?? (process.env as Readonly<Record<string, string | undefined>>);
  const which = input.which ?? defaultWhich;

  const lanes: LaneDoctorLaneReport[] = [];
  let ok = 0;
  let missing = 0;
  for (const id of TEAM_LANE_RUNTIMES) {
    // Isolate per-lane failures so one adapter throwing in its preflight
    // (e.g. a misconfigured `which`) doesn't abort the rest of the sweep.
    try {
      const adapter = buildAdapterForDoctor(id, which);
      const result = adapter.preflight(env);
      if (result.status === "ok") {
        lanes.push({ runtime: id, status: "ok" });
        ok += 1;
      } else {
        lanes.push({ runtime: id, status: "missing", reason: result.reason });
        missing += 1;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      lanes.push({ runtime: id, status: "missing", reason: `preflight threw: ${reason}` });
      missing += 1;
    }
  }
  return { lanes, summary: { ok, missing } };
}
