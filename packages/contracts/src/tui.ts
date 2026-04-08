export type EmbeddedWorkSessionUpdate<
  HomeState extends object = Record<string, never>,
> = {
  readonly selectedSessionId?: string;
  readonly contextLines?: readonly string[];
  readonly homeState?: Partial<HomeState>;
};

export type OpenEmbeddedWorkSession<
  HomeState extends object = Record<string, never>,
> = (
  forwardedArgs?: readonly string[],
) => Promise<EmbeddedWorkSessionUpdate<HomeState> | undefined>;

export function parseSelectedSessionIdFromArgs(
  forwardedArgs: readonly string[],
): string | undefined {
  const sessionIdFlagIndex = forwardedArgs.findIndex(
    (arg) => arg === "--session-id",
  );
  return sessionIdFlagIndex >= 0
    ? forwardedArgs[sessionIdFlagIndex + 1]
    : undefined;
}

export function buildEmbeddedWorkSessionUpdate<
  HomeState extends object = Record<string, never>,
>(input: {
  readonly forwardedArgs: readonly string[];
  readonly contextLines?: readonly string[] | undefined;
  readonly homeState?: Partial<HomeState> | undefined;
}): EmbeddedWorkSessionUpdate<HomeState> {
  const selectedSessionId = parseSelectedSessionIdFromArgs(input.forwardedArgs);

  return {
    ...(selectedSessionId ? { selectedSessionId } : {}),
    ...(input.contextLines ? { contextLines: input.contextLines } : {}),
    ...(input.homeState ? { homeState: input.homeState } : {}),
  };
}
