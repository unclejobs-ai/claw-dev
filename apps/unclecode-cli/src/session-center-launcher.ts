import { createSessionCenterDashboardRenderOptions } from "@unclecode/tui";
import type {
  SessionCenterLaunchInput,
  SharedBootstrapDependencies,
} from "./interactive-launch-inputs.js";
import {
  createEmbeddedWorkPaneLoadInput,
  createSessionCenterEnvironment,
  loadSessionCenterRenderInput,
  resolveSessionCenterDependencies,
  type TuiHomeState,
} from "./session-center-bootstrap.js";
import {
  launchWorkEntrypoint,
  loadEmbeddedWorkPane,
} from "./work-bootstrap.js";

export async function launchSessionCenter(
  input: SessionCenterLaunchInput = {},
  deps?: SharedBootstrapDependencies,
): Promise<void> {
  const { workspaceRoot, env, userHomeDir } =
    createSessionCenterEnvironment(input);
  const { buildHomeState, renderShell, runAction, runSession } =
    await resolveSessionCenterDependencies(deps);
  const renderInput = await loadSessionCenterRenderInput({
    workspaceRoot,
    env,
    ...(userHomeDir ? { userHomeDir } : {}),
    ...(input.initialSelectedSessionId !== undefined
      ? { initialSelectedSessionId: input.initialSelectedSessionId }
      : {}),
    ...(input.contextLines ? { contextLines: input.contextLines } : {}),
    buildHomeState,
    runAction,
    runSession,
    loadEmbeddedWorkPane: () =>
      loadEmbeddedWorkPane(
        createEmbeddedWorkPaneLoadInput({
          workspaceRoot,
          ...(input.initialSelectedSessionId !== undefined
            ? { initialSelectedSessionId: input.initialSelectedSessionId }
            : {}),
          ...(deps?.loadWorkModule ? { loadWorkModule: deps.loadWorkModule } : {}),
        }),
      ),
    launchWorkSession: (forwardedArgs = []) =>
      launchWorkEntrypoint(forwardedArgs, {
        callerCwd: workspaceRoot,
        ...(deps?.loadWorkModule ? { loadModule: deps.loadWorkModule } : {}),
      }),
  });

  await renderShell(
    createSessionCenterDashboardRenderOptions<TuiHomeState>(renderInput),
  );
}
