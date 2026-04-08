export type DefaultWorkSessionStartupInput = {
  readonly args: readonly string[];
  readonly stdinIsTTY: boolean;
  readonly stdoutIsTTY: boolean;
};

export function shouldLaunchDefaultWorkSession(input: DefaultWorkSessionStartupInput): boolean {
  return input.args.length === 0 && input.stdinIsTTY && input.stdoutIsTTY;
}
