import {
  createSessionCenterLaunchInput,
  createWorkLaunchInput,
  type InteractiveSurfaceInput,
  type SharedBootstrapDependencies,
} from "./interactive-launch-inputs.js";
import { launchSessionCenter } from "./session-center-launcher.js";
import { launchWorkEntrypoint } from "./work-bootstrap.js";

export { shouldLaunchDefaultWorkSession } from "./startup-paths.js";

export async function launchInteractiveSurface(
  input: InteractiveSurfaceInput,
  deps?: SharedBootstrapDependencies,
): Promise<void> {
  if (input.kind === "work") {
    await launchWorkEntrypoint(
      input.forwardedArgs,
      createWorkLaunchInput(input, deps),
    );
    return;
  }

  await launchSessionCenter(createSessionCenterLaunchInput(input), deps);
}
