/**
 * TeamRunner — coordinator-side flow that creates a team run, marks it
 * started/running/accepted/aborted, and exposes a typed lifecycle for the CLI.
 *
 * This file does NOT spawn workers yet — that lives in Phase C.3 / D once the
 * agent pool + MMBridge hooks land. Today it owns just the lifecycle and the
 * RUN_ROOT directory shape so the CLI can already record and inspect runs.
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type {
  PersonaId,
  TeamGateLevel,
  TeamRunManifest,
  TeamRunStatus,
  TeamRuntimeMode,
} from "@unclecode/contracts";
import {
  createTeamRun,
  generateRunId,
  getTeamRunRoot,
  getTeamRunsRoot,
  lockTeamRun,
} from "@unclecode/session-store";

import { TeamBinding } from "./team-binding.js";

export type TeamRunnerOptions = {
  readonly dataRoot: string;
  readonly objective: string;
  readonly persona: PersonaId;
  readonly lanes?: number;
  readonly gate?: TeamGateLevel;
  readonly runtime?: TeamRuntimeMode;
  readonly workspaceRoot: string;
  readonly createdBy: string;
  readonly runId?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly codeState?: TeamRunManifest["codeState"];
};

export type TeamRunnerHandle = {
  readonly runId: string;
  readonly runRoot: string;
  readonly binding: TeamBinding;
  readonly release: () => void;
  start(): void;
  setStatus(status: TeamRunStatus): void;
};

export function startTeamRun(options: TeamRunnerOptions): TeamRunnerHandle {
  ensureDataRoot(options.dataRoot);
  const ref = createTeamRun({
    dataRoot: options.dataRoot,
    objective: options.objective,
    persona: options.persona,
    lanes: options.lanes ?? 1,
    gate: options.gate ?? "strict",
    runtime: options.runtime ?? "local",
    workspaceRoot: options.workspaceRoot,
    createdBy: options.createdBy,
    ...(options.runId !== undefined ? { runId: options.runId } : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
    ...(options.codeState !== undefined ? { codeState: options.codeState } : {}),
  });

  const binding = new TeamBinding({
    runId: ref.runId,
    runRoot: ref.runRoot,
    role: "coordinator",
    workspaceRoot: options.workspaceRoot,
  });

  const release = lockTeamRun(ref.runRoot, options.createdBy);

  const handle: TeamRunnerHandle = {
    runId: ref.runId,
    runRoot: ref.runRoot,
    binding,
    release,
    start() {
      binding.publish({
        type: "team_run",
        runId: ref.runId,
        persona: options.persona,
        status: "started",
        objective: options.objective,
        lanes: options.lanes ?? 1,
        timestamp: new Date().toISOString(),
      });
    },
    setStatus(status: TeamRunStatus) {
      binding.publish({
        type: "team_run",
        runId: ref.runId,
        persona: options.persona,
        status,
        objective: options.objective,
        lanes: options.lanes ?? 1,
        timestamp: new Date().toISOString(),
      });
    },
  };

  return handle;
}

function ensureDataRoot(dataRoot: string): void {
  const teamRunsRoot = join(dataRoot, "team-runs");
  if (!existsSync(teamRunsRoot)) {
    mkdirSync(teamRunsRoot, { recursive: true });
  }
}

export function listTeamRuns(dataRoot: string): ReadonlyArray<{
  readonly runId: string;
  readonly runRoot: string;
}> {
  const teamRunsRoot = getTeamRunsRoot(dataRoot);
  if (!existsSync(teamRunsRoot)) {
    return [];
  }
  return readdirSync(teamRunsRoot)
    .filter((name) => name.startsWith("tr_"))
    .filter((name) => {
      try {
        return statSync(join(teamRunsRoot, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((runId) => ({ runId, runRoot: getTeamRunRoot(dataRoot, runId) }));
}

export function generateRunIdForCli(): string {
  return generateRunId();
}
