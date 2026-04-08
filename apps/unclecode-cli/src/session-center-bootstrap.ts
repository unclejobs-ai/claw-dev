import type { EmbeddedWorkPaneRenderOptions, TuiRenderOptions } from "@unclecode/tui";

type OperationalModule = typeof import("./operational.js");

export type TuiHomeState = Awaited<
  ReturnType<OperationalModule["buildTuiHomeState"]>
>;

type SessionCenterRenderOptions = TuiRenderOptions<TuiHomeState>;

export type SessionCenterBootstrapDependencies = {
  readonly buildHomeState?:
    | OperationalModule["buildTuiHomeState"]
    | undefined;
  readonly renderShell?:
    | ((options: TuiRenderOptions<TuiHomeState>) => Promise<void>)
    | undefined;
  readonly runAction?:
    | OperationalModule["runTuiSessionCenterAction"]
    | undefined;
  readonly runSession?:
    | OperationalModule["buildResumeSummary"]
    | undefined;
};

export function createSessionCenterEnvironment(input: {
  workspaceRoot?: string;
  env?: NodeJS.ProcessEnv;
  userHomeDir?: string | undefined;
}): {
  readonly workspaceRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly userHomeDir?: string | undefined;
} {
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const env = input.env ?? process.env;
  const userHomeDir = input.userHomeDir ?? env.HOME;

  return {
    workspaceRoot,
    env,
    ...(userHomeDir ? { userHomeDir } : {}),
  };
}

async function loadOperationalModule(): Promise<OperationalModule> {
  return import("./operational.js");
}

export async function resolveSessionCenterDependencies(
  deps?: SessionCenterBootstrapDependencies,
): Promise<{
  readonly buildHomeState: NonNullable<
    SessionCenterBootstrapDependencies["buildHomeState"]
  >;
  readonly renderShell: NonNullable<
    SessionCenterBootstrapDependencies["renderShell"]
  >;
  readonly runAction: NonNullable<
    SessionCenterBootstrapDependencies["runAction"]
  >;
  readonly runSession: NonNullable<
    SessionCenterBootstrapDependencies["runSession"]
  >;
}> {
  const operational = deps?.buildHomeState && deps?.runAction && deps?.runSession
    ? undefined
    : await loadOperationalModule();
  const buildHomeState = deps?.buildHomeState ?? operational?.buildTuiHomeState;
  const renderShell = deps?.renderShell ?? (await import("@unclecode/tui")).renderTui;
  const runAction = deps?.runAction ?? operational?.runTuiSessionCenterAction;
  const runSession = deps?.runSession ?? operational?.buildResumeSummary;

  if (!buildHomeState || !runAction || !runSession) {
    throw new Error("interactive shell failed to load operational helpers");
  }

  return {
    buildHomeState,
    renderShell,
    runAction,
    runSession,
  };
}

export function createEmbeddedWorkPaneLoadInput<
  WorkModule,
>(input: {
  readonly workspaceRoot: string;
  readonly initialSelectedSessionId?: string | undefined;
  readonly loadWorkModule?: (() => Promise<WorkModule>) | undefined;
}): {
  readonly workspaceRoot: string;
  readonly initialSelectedSessionId?: string | undefined;
  readonly loadWorkModule?: (() => Promise<WorkModule>) | undefined;
} {
  return {
    workspaceRoot: input.workspaceRoot,
    ...(input.initialSelectedSessionId !== undefined
      ? { initialSelectedSessionId: input.initialSelectedSessionId }
      : {}),
    ...(input.loadWorkModule ? { loadWorkModule: input.loadWorkModule } : {}),
  };
}

function createSessionCenterHomeStateLoader(input: {
  readonly workspaceRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly userHomeDir?: string | undefined;
  readonly buildHomeState: NonNullable<
    SessionCenterBootstrapDependencies["buildHomeState"]
  >;
}): () => Promise<TuiHomeState> {
  return () =>
    input.buildHomeState({
      workspaceRoot: input.workspaceRoot,
      env: input.env,
      ...(input.userHomeDir ? { userHomeDir: input.userHomeDir } : {}),
    });
}

function createSessionCenterRuntimeCallbackInput(input: {
  readonly workspaceRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly userHomeDir?: string | undefined;
  readonly runAction: NonNullable<
    SessionCenterBootstrapDependencies["runAction"]
  >;
  readonly runSession: NonNullable<
    SessionCenterBootstrapDependencies["runSession"]
  >;
  readonly refreshHomeState: () => Promise<TuiHomeState>;
  readonly launchWorkSession: NonNullable<
    SessionCenterRenderOptions["launchWorkSession"]
  >;
}): {
  readonly workspaceRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly userHomeDir?: string | undefined;
  readonly runAction: NonNullable<
    SessionCenterBootstrapDependencies["runAction"]
  >;
  readonly runSession: NonNullable<
    SessionCenterBootstrapDependencies["runSession"]
  >;
  readonly refreshHomeState: () => Promise<TuiHomeState>;
  readonly launchWorkSession: NonNullable<
    SessionCenterRenderOptions["launchWorkSession"]
  >;
} {
  return {
    workspaceRoot: input.workspaceRoot,
    env: input.env,
    ...(input.userHomeDir ? { userHomeDir: input.userHomeDir } : {}),
    runAction: input.runAction,
    runSession: input.runSession,
    refreshHomeState: input.refreshHomeState,
    launchWorkSession: input.launchWorkSession,
  };
}

function createSessionCenterRuntimeCallbacks(input: {
  readonly workspaceRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly userHomeDir?: string | undefined;
  readonly runAction: NonNullable<
    SessionCenterBootstrapDependencies["runAction"]
  >;
  readonly runSession: NonNullable<
    SessionCenterBootstrapDependencies["runSession"]
  >;
  readonly refreshHomeState: () => Promise<TuiHomeState>;
  readonly launchWorkSession: NonNullable<
    SessionCenterRenderOptions["launchWorkSession"]
  >;
}): Pick<
  SessionCenterRenderOptions,
  "runAction" | "runSession" | "launchWorkSession" | "refreshHomeState"
> {
  return {
    runAction: ({ actionId, prompt, onProgress }) =>
      input.runAction({
        actionId,
        workspaceRoot: input.workspaceRoot,
        env: input.env,
        ...(prompt ? { prompt } : {}),
        ...(onProgress ? { onProgress } : {}),
        ...(input.userHomeDir ? { userHomeDir: input.userHomeDir } : {}),
      }),
    runSession: (sessionId) =>
      input.runSession({
        workspaceRoot: input.workspaceRoot,
        env: input.env,
        sessionId,
      }),
    launchWorkSession: input.launchWorkSession,
    refreshHomeState: input.refreshHomeState,
  };
}

function createSessionCenterRenderInput(input: {
  readonly workspaceRoot: string;
  readonly homeState: TuiHomeState;
  readonly embeddedWorkPane?: EmbeddedWorkPaneRenderOptions<TuiHomeState> | undefined;
  readonly initialSelectedSessionId?: string | undefined;
  readonly contextLines?: readonly string[] | undefined;
  readonly runtimeCallbacks: Pick<
    SessionCenterRenderOptions,
    "runAction" | "runSession" | "launchWorkSession" | "refreshHomeState"
  >;
}): {
  readonly workspaceRoot: string;
  readonly homeState: TuiHomeState;
  readonly embeddedWorkPane?: EmbeddedWorkPaneRenderOptions<TuiHomeState> | undefined;
  readonly initialSelectedSessionId?: string;
  readonly contextLines?: readonly string[];
  readonly runAction?: SessionCenterRenderOptions["runAction"];
  readonly runSession?: SessionCenterRenderOptions["runSession"];
  readonly launchWorkSession?: SessionCenterRenderOptions["launchWorkSession"];
  readonly refreshHomeState?: SessionCenterRenderOptions["refreshHomeState"];
} {
  return {
    workspaceRoot: input.workspaceRoot,
    homeState: input.homeState,
    ...(input.embeddedWorkPane ? { embeddedWorkPane: input.embeddedWorkPane } : {}),
    ...(input.initialSelectedSessionId
      ? { initialSelectedSessionId: input.initialSelectedSessionId }
      : {}),
    ...(input.contextLines ? { contextLines: input.contextLines } : {}),
    ...input.runtimeCallbacks,
  };
}

export async function loadSessionCenterRenderInput(input: {
  readonly workspaceRoot: string;
  readonly env: NodeJS.ProcessEnv;
  readonly userHomeDir?: string | undefined;
  readonly initialSelectedSessionId?: string | undefined;
  readonly contextLines?: readonly string[] | undefined;
  readonly buildHomeState: NonNullable<
    SessionCenterBootstrapDependencies["buildHomeState"]
  >;
  readonly runAction: NonNullable<
    SessionCenterBootstrapDependencies["runAction"]
  >;
  readonly runSession: NonNullable<
    SessionCenterBootstrapDependencies["runSession"]
  >;
  readonly loadEmbeddedWorkPane: () => Promise<
    EmbeddedWorkPaneRenderOptions<TuiHomeState> | undefined
  >;
  readonly launchWorkSession: NonNullable<
    SessionCenterRenderOptions["launchWorkSession"]
  >;
}): Promise<ReturnType<typeof createSessionCenterRenderInput>> {
  const createHomeState = createSessionCenterHomeStateLoader({
    workspaceRoot: input.workspaceRoot,
    env: input.env,
    ...(input.userHomeDir ? { userHomeDir: input.userHomeDir } : {}),
    buildHomeState: input.buildHomeState,
  });
  const homeState = await createHomeState();
  const embeddedWorkPane = await input.loadEmbeddedWorkPane();
  const runtimeCallbackInput = createSessionCenterRuntimeCallbackInput({
    workspaceRoot: input.workspaceRoot,
    env: input.env,
    ...(input.userHomeDir ? { userHomeDir: input.userHomeDir } : {}),
    runAction: input.runAction,
    runSession: input.runSession,
    refreshHomeState: createHomeState,
    launchWorkSession: input.launchWorkSession,
  });
  const runtimeCallbacks = createSessionCenterRuntimeCallbacks(
    runtimeCallbackInput,
  );

  return createSessionCenterRenderInput({
    workspaceRoot: input.workspaceRoot,
    homeState,
    ...(embeddedWorkPane ? { embeddedWorkPane } : {}),
    ...(input.initialSelectedSessionId
      ? { initialSelectedSessionId: input.initialSelectedSessionId }
      : {}),
    ...(input.contextLines ? { contextLines: input.contextLines } : {}),
    runtimeCallbacks,
  });
}
