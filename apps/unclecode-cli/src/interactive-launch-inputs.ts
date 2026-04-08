import type {
  SessionCenterEnvironmentInput,
  SessionCenterBootstrapDependencies,
} from "./session-center-bootstrap.js";
import type { WorkLaunchInput, WorkModule } from "./work-bootstrap.js";

export type SharedBootstrapDependencies = SessionCenterBootstrapDependencies & {
  readonly loadWorkModule?: (() => Promise<WorkModule>) | undefined;
};

export type SessionCenterLaunchInput = SessionCenterEnvironmentInput & {
  readonly initialSelectedSessionId?: string | undefined;
  readonly contextLines?: readonly string[] | undefined;
};

export type WorkInteractiveSurfaceInput = {
  readonly kind: "work";
  readonly forwardedArgs: readonly string[];
  readonly callerCwd?: string | undefined;
};

export type CenterInteractiveSurfaceInput =
  { readonly kind: "center" } & SessionCenterLaunchInput;

export type InteractiveSurfaceInput = WorkInteractiveSurfaceInput |
  CenterInteractiveSurfaceInput;

export function createWorkLaunchInput(
  input: WorkInteractiveSurfaceInput,
  deps?: SharedBootstrapDependencies,
): WorkLaunchInput {
  return {
    ...(input.callerCwd ? { callerCwd: input.callerCwd } : {}),
    ...(deps?.loadWorkModule ? { loadModule: deps.loadWorkModule } : {}),
  };
}

export function createSessionCenterLaunchInput(
  input: CenterInteractiveSurfaceInput,
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
