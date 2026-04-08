import { createEmbeddedWorkPaneController } from "@unclecode/tui";
import type {
  EmbeddedWorkDashboardSnapshot,
  EmbeddedWorkPaneRenderOptions,
} from "@unclecode/tui";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { TuiHomeState } from "./session-center-bootstrap.js";

const CLI_SOURCE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CLI_SOURCE_DIR, "../../..");
const WORK_ENTRYPOINT = path.join(
  REPO_ROOT,
  "dist-work",
  "apps",
  "unclecode-cli",
  "src",
  "work-entry.js",
);

type WorkShellDashboardSnapshot =
  EmbeddedWorkDashboardSnapshot<TuiHomeState>;

export type WorkModule = {
  runWorkCli?: (args: readonly string[]) => Promise<void>;
  loadWorkShellDashboardProps?: (
    args: readonly string[],
  ) => Promise<WorkShellDashboardSnapshot>;
};

export function withWorkCwd(
  forwardedArgs: readonly string[],
  callerCwd: string,
): readonly string[] {
  if (forwardedArgs.includes("--cwd")) {
    return forwardedArgs;
  }

  return ["--cwd", callerCwd, ...forwardedArgs];
}

export async function loadWorkEntrypointModule(
  moduleUrl = pathToFileURL(WORK_ENTRYPOINT).href,
): Promise<WorkModule> {
  return import(moduleUrl) as Promise<WorkModule>;
}

function resolveWorkModuleLoader(
  loadModule?: (() => Promise<WorkModule>) | undefined,
): () => Promise<WorkModule> {
  return loadModule ?? (() => loadWorkEntrypointModule());
}

export async function launchWorkEntrypoint(
  forwardedArgs: readonly string[],
  input?: {
    callerCwd?: string;
    loadModule?: (() => Promise<WorkModule>) | undefined;
  },
): Promise<void> {
  const argsWithCwd = withWorkCwd(
    [...forwardedArgs],
    input?.callerCwd ?? process.cwd(),
  );
  const loadModule = resolveWorkModuleLoader(input?.loadModule);
  const module = await loadModule();

  if (typeof module.runWorkCli !== "function") {
    throw new Error("work entrypoint does not export runWorkCli()");
  }

  await module.runWorkCli(argsWithCwd);
}

export async function loadEmbeddedWorkPane(input: {
  workspaceRoot: string;
  initialSelectedSessionId?: string | undefined;
  loadWorkModule?: (() => Promise<WorkModule>) | undefined;
}): Promise<EmbeddedWorkPaneRenderOptions<TuiHomeState> | undefined> {
  const loadModule = resolveWorkModuleLoader(input.loadWorkModule);
  const module = await loadModule().catch(() => undefined);
  if (typeof module?.loadWorkShellDashboardProps !== "function") {
    return undefined;
  }

  return createEmbeddedWorkPaneController<TuiHomeState>({
    ...(input.initialSelectedSessionId !== undefined
      ? { initialSelectedSessionId: input.initialSelectedSessionId }
      : {}),
    loadSnapshot: async (forwardedArgs = []) =>
      module.loadWorkShellDashboardProps?.(
        withWorkCwd(forwardedArgs, input.workspaceRoot),
      ),
  });
}
