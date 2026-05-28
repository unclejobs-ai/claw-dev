/**
 * Lane spec parser — translates the CLI's `--lanes` argument into an array
 * of partial WorkerSpec inputs. Supports two forms:
 *
 *   --lanes 4                              homogeneous: 4× default runtime
 *   --lanes cursor,codex,opencode:kimi-k2.6,glm,hermes::agent=codex;format=json
 *
 * Token grammar (colon-separated):
 *   <runtime>[:<model>][:<k=v>[;<k=v>...]]
 *
 * The third colon-segment is a semicolon-list of `key=value` extras (";"
 * because top-level "," already separates lane tokens). Omit the model
 * with `runtime::extras...`.
 */

import { TEAM_LANE_RUNTIMES, isTeamLaneRuntime, type TeamLaneRuntime } from "@unclecode/contracts";

export const DEFAULT_LANE_RUNTIME: TeamLaneRuntime = "openai";

/**
 * Maximum lanes per run — protects against `--lanes openai,openai,...×50`
 * fork-bomb attacks AND keeps file-descriptor pressure bounded against the
 * shared NDJSON checkpoint log.
 */
export const MAX_LANES_PER_RUN = 16;

export type ParsedLaneSpec = {
  readonly runtime: TeamLaneRuntime;
  readonly model?: string;
  readonly extras?: Record<string, string>;
};

export function parseLanesSpec(input: string): ParsedLaneSpec[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("--lanes is empty; expected a count (e.g. 4) or a comma list (e.g. cursor,codex)");
  }

  if (/^-?\d+$/.test(trimmed)) {
    const count = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(count) || count < 1 || count > MAX_LANES_PER_RUN) {
      throw new Error(`invalid lane count "${trimmed}" (expected 1..${MAX_LANES_PER_RUN})`);
    }
    return Array.from({ length: count }, () => ({ runtime: DEFAULT_LANE_RUNTIME }));
  }

  const specs = trimmed
    .split(",")
    .map((rawToken) => parseSingleLaneToken(rawToken.trim()))
    .filter((spec): spec is ParsedLaneSpec => spec !== null);

  if (specs.length > MAX_LANES_PER_RUN) {
    throw new Error(
      `too many lanes (${specs.length}); cap is ${MAX_LANES_PER_RUN}. Run multiple commands or batch the workload.`,
    );
  }
  if (specs.length === 0) {
    throw new Error(`--lanes "${trimmed}" produced zero lanes; check for trailing commas or empty tokens`);
  }
  return specs;
}

function parseSingleLaneToken(token: string): ParsedLaneSpec | null {
  if (!token) return null;

  // Split into AT MOST 3 colon segments: runtime : model : extras-rest.
  // Models containing colons (e.g. opencode `anthropic/claude-3:beta`,
  // HF `hf/llama:3.1:instruct`) are still corrupted by the third-colon
  // boundary — workaround: use the underlying CLI flag override or pass
  // a provider/model token without colons. opencode uses `provider/model`
  // (slash) and matches the common case.
  const parts = token.split(":");
  const runtime = parts[0]?.trim() ?? "";
  if (!isTeamLaneRuntime(runtime)) {
    throw new Error(
      `unknown lane runtime "${runtime}". valid: ${TEAM_LANE_RUNTIMES.join(", ")}`,
    );
  }

  const spec: { runtime: TeamLaneRuntime; model?: string; extras?: Record<string, string> } = {
    runtime,
  };

  const modelPart = parts[1]?.trim();
  if (modelPart && modelPart.length > 0) {
    spec.model = modelPart;
  }

  if (parts.length >= 3) {
    const extrasPart = parts.slice(2).join(":").trim();
    if (extrasPart.length > 0) {
      const extras: Record<string, string> = {};
      for (const kv of extrasPart.split(";")) {
        const eq = kv.indexOf("=");
        if (eq < 0) continue;
        const key = kv.slice(0, eq).trim();
        const value = kv.slice(eq + 1).trim();
        if (key.length > 0) extras[key] = value;
      }
      if (Object.keys(extras).length > 0) spec.extras = extras;
    }
  }

  return spec;
}
