import { resolveOpenAIAuthStatus } from "@unclecode/providers";
import { createSessionStore, getSessionStoreRoot } from "@unclecode/session-store";

export type WorkRuntimeAuthIssueInput = {
  authStatus?: Pick<Awaited<ReturnType<typeof resolveOpenAIAuthStatus>>, "expiresAt">;
  authIssueMessage?: string | undefined;
};

export function deriveAuthIssueLines(input: WorkRuntimeAuthIssueInput): readonly string[] {
  return input.authStatus?.expiresAt === "insufficient-scope"
    ? ["Auth issue: saved OAuth lacks model.request scope. Use /auth key, OPENAI_API_KEY, or browser OAuth with OPENAI_OAUTH_CLIENT_ID."]
    : input.authStatus?.expiresAt === "refresh-required"
      ? ["Auth issue: saved OAuth needs refresh. Use /auth login or /auth logout before asking the model to work."]
      : input.authIssueMessage
        ? [input.authIssueMessage]
        : [];
}

export async function loadResumedWorkSession(input: {
  cwd: string;
  sessionId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  sessionId: string;
  initialTraceMode?: "minimal" | "verbose";
  contextLine: string;
}> {
  const sessionStore = createSessionStore({ rootDir: getSessionStoreRoot(input.env) });
  const resumed = await sessionStore.resumeSession({
    projectPath: input.cwd,
    sessionId: input.sessionId,
  });
  if (resumed.checkpoint === null && resumed.records.length === 0) {
    throw new Error(`Session not found: ${input.sessionId}`);
  }

  return {
    sessionId: input.sessionId,
    ...(resumed.metadata.traceMode
      ? { initialTraceMode: resumed.metadata.traceMode }
      : {}),
    contextLine: `Resumed session: ${input.sessionId}`,
  };
}
