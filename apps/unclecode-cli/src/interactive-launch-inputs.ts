import type {
  SessionCenterBootstrapDependencies,
} from "./session-center-bootstrap.js";
import type { WorkModule } from "./work-bootstrap.js";

export type SharedBootstrapDependencies = SessionCenterBootstrapDependencies & {
  readonly loadWorkModule?: (() => Promise<WorkModule>) | undefined;
};

export type SessionCenterLaunchInput = {
  readonly workspaceRoot?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly userHomeDir?: string | undefined;
  readonly initialSelectedSessionId?: string | undefined;
  readonly contextLines?: readonly string[] | undefined;
};

export type InteractiveSurfaceInput =
  | {
      readonly kind: "work";
      readonly forwardedArgs: readonly string[];
      readonly callerCwd?: string | undefined;
    }
  | ({ readonly kind: "center" } & SessionCenterLaunchInput);

export function createWorkLaunchInput(
  input: Extract<InteractiveSurfaceInput, { kind: "work" }>,
  deps?: SharedBootstrapDependencies,
): {
  readonly callerCwd?: string;
  readonly loadModule?: (() => Promise<WorkModule>) | undefined;
} {
  return {
    ...(input.callerCwd ? { callerCwd: input.callerCwd } : {}),
    ...(deps?.loadWorkModule ? { loadModule: deps.loadWorkModule } : {}),
  };
}

export function createSessionCenterLaunchInput(
  input: Extract<InteractiveSurfaceInput, { kind: "center" }>,
): SessionCenterLaunchInput {
  return {
    ...(input.workspaceRoot !== undefined
      ? { workspaceRoot: input.workspaceRoot }
      : {}),
    ...(input.env !== undefined ? { env: input.env } : {}),
    ...(input.userHomeDir !== undefined
      ? { userHomeDir: input.userHomeDir }
      : {}),
    ...(input.initialSelectedSessionId !== undefined
      ? { initialSelectedSessionId: input.initialSelectedSessionId }
      : {}),
    ...(input.contextLines !== undefined
      ? { contextLines: input.contextLines }
      : {}),
  };
}
