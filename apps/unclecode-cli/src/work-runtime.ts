import { explainUncleCodeConfig } from "@unclecode/config-core";
import {
  clearCachedWorkspaceGuidance,
  loadCachedWorkspaceGuidance,
} from "@unclecode/context-broker";
import {
  clearExtensionRegistryCache,
  describeReasoning,
  loadConfig,
  loadExtensionConfigOverlays,
  loadExtensionManifestSummaries,
  runWorkShellInlineCommand,
  type AppReasoningConfig,
  WorkAgent,
} from "@unclecode/orchestrator";
import {
  resolveOpenAIAuth,
  resolveOpenAIAuthStatus,
  resolveReusableOpenAIOAuthClientId,
} from "@unclecode/providers";
import {
  createManagedWorkShellDashboardProps,
  formatWorkShellError,
  renderManagedWorkShellDashboard,
  type EmbeddedWorkDashboardSnapshot,
  type TuiShellHomeState,
} from "@unclecode/tui";
import {
  buildTuiHomeState,
  runTuiSessionCenterAction,
  runWorkShellInlineAction,
} from "./operational.js";
import {
  parseArgs,
  printHelp,
  printTools,
  resolveRuntimeProvider,
} from "./work-runtime-args.js";
import {
  deriveAuthIssueLines,
  loadResumedWorkSession,
} from "./work-runtime-session.js";
import {
  createManagedDashboardInput,
  type ManagedDashboardSession,
  type StartReplAgent,
  type StartReplOptions,
} from "./work-runtime-dashboard.js";
import { runWorkspaceGuardianChecks } from "./guardian-checks.js";
import { createRuntimeCodingAgent } from "./runtime-coding-agent.js";

async function runInlineCommand(
  args: readonly string[],
  cwd: string,
  onProgress?: ((line: string) => void) | undefined,
): Promise<readonly string[]> {
  return runWorkShellInlineAction({
    args,
    workspaceRoot: cwd,
    env: process.env,
    ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
    ...(onProgress ? { onProgress } : {}),
  });
}

async function buildWorkShellContextSummary(input: {
    cwd: string;
    resumedContextLine?: string | undefined;
    forceRefresh?: boolean | undefined;
  },
): Promise<readonly string[]> {
  if (input.forceRefresh) {
    clearCachedWorkspaceGuidance(input.cwd, process.env.HOME);
    clearExtensionRegistryCache({
      workspaceRoot: input.cwd,
      ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
    });
  }

  const guidance = await loadCachedWorkspaceGuidance({
    cwd: input.cwd,
    ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
  });
  const extensionSummaries = loadExtensionManifestSummaries({
    workspaceRoot: input.cwd,
    ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
  });

  return [
    ...(input.resumedContextLine ? [input.resumedContextLine] : []),
    ...guidance.contextSummaryLines,
    ...extensionSummaries.slice(0, 2).map((extension) => {
      const status = extension.statusLines[0]?.trim();
      return status && status.length > 0
        ? `Loaded extension: ${extension.name} · ${status}`
        : `Loaded extension: ${extension.name}`;
    }),
  ];
}

export { loadResumedWorkSession } from "./work-runtime-session.js";

export const resolveWorkShellInlineCommand = (
  args: readonly string[],
  runInlineCommand: (
    args: readonly string[],
    onProgress?: ((line: string) => void) | undefined,
  ) => Promise<readonly string[]>,
  onProgress?: ((line: string) => void) | undefined,
): Promise<{ readonly lines: readonly string[]; readonly failed: boolean }> =>
  runWorkShellInlineCommand(
    args,
    runInlineCommand,
    formatWorkShellError,
    onProgress,
  );

async function loadWorkCliSession(argv: readonly string[]) {
  const { cwd, provider, model, reasoning, sessionId, prompt } = parseArgs([...argv]);
  const config = await loadConfig({
    cwd,
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(reasoning !== undefined ? { reasoning } : {}),
    allowProblematicOpenAIAuth: true,
  });
  const guidance = await loadCachedWorkspaceGuidance({
    cwd,
    ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
  });
  const pluginOverlays = loadExtensionConfigOverlays({
    workspaceRoot: cwd,
    ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
  });
  const configExplanation = explainUncleCodeConfig({
    workspaceRoot: cwd,
    env: process.env,
    pluginOverlays,
  });
  const systemPromptAppendix = [
    configExplanation.prompt.rendered
      ? `Configured prompt:\n\n${configExplanation.prompt.rendered}`
      : "",
    guidance.systemPromptAppendix,
  ]
    .filter((value) => value.trim().length > 0)
    .join("\n\n");
  const directAgent = await createRuntimeCodingAgent({
    provider: resolveRuntimeProvider(config.provider),
    apiKey: config.apiKey,
    model: config.model,
    cwd,
    reasoning: config.reasoning,
    ...(systemPromptAppendix ? { systemPrompt: systemPromptAppendix } : {}),
    ...(config.openAIRuntime ? { openAIRuntime: config.openAIRuntime } : {}),
    ...(config.openAIAccountId !== undefined ? { openAIAccountId: config.openAIAccountId } : {}),
  });

  const agent = new WorkAgent({
    directAgent,
    mode: config.mode,
    reasoning: config.reasoning,
    model: config.model,
    async runExecutableGuardianChecks(input) {
      const scripts = input.mode === "ultrawork"
        ? ["lint", "check", "test"]
        : ["check", "test"];
      return runWorkspaceGuardianChecks({
        cwd,
        env: process.env,
        scripts,
        changedFiles: input.changedFiles,
      });
    },
  });

  const refreshAuthState = async (): Promise<{ authLabel: string; authIssueLines?: readonly string[] }> => {
    const status = await resolveOpenAIAuthStatus({ env: process.env });
    const resolved = await resolveOpenAIAuth({
      env: process.env,
      ...(process.env.UNCLECODE_OPENAI_CREDENTIALS_PATH?.trim()
        ? { fallbackAuthPath: process.env.UNCLECODE_OPENAI_CREDENTIALS_PATH.trim() }
        : {}),
    });

    directAgent.refreshAuthToken(resolved.status === "ok" ? resolved.bearerToken : "");
    return {
      authLabel: status.activeSource,
      authIssueLines: deriveAuthIssueLines({
        ...(status ? { authStatus: status } : {}),
        ...(config.authIssueMessage ? { authIssueMessage: config.authIssueMessage } : {}),
      }),
    };
  };

  const authStatus = config.provider === "openai"
    ? await resolveOpenAIAuthStatus({ env: process.env })
    : undefined;
  const browserOAuthAvailable = config.provider === "openai"
    ? Boolean(process.env.OPENAI_OAUTH_CLIENT_ID?.trim())
    : false;
  const authIssueLines = deriveAuthIssueLines({
    ...(authStatus ? { authStatus } : {}),
    ...(config.authIssueMessage ? { authIssueMessage: config.authIssueMessage } : {}),
  });

  const resumedSession = sessionId
    ? await loadResumedWorkSession({ cwd, sessionId, env: process.env })
    : undefined;
  const refreshHomeState = () =>
    buildTuiHomeState({
      workspaceRoot: cwd,
      env: process.env,
      ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
    });
  const homeState = await refreshHomeState();

  return {
    agent,
    prompt,
    options: {
      provider: resolveRuntimeProvider(config.provider),
      model: config.model,
      mode: config.mode,
      authLabel: config.authLabel,
      reasoning: config.reasoning,
      cwd,
      contextSummaryLines: [
        ...authIssueLines,
        ...(await buildWorkShellContextSummary({
          cwd,
          ...(resumedSession?.contextLine
            ? { resumedContextLine: resumedSession.contextLine }
            : {}),
        })),
      ],
      homeState,
      ...(resumedSession?.sessionId ? { sessionId: resumedSession.sessionId } : {}),
      ...(resumedSession?.initialTraceMode
        ? { initialTraceMode: resumedSession.initialTraceMode }
        : {}),
      reloadWorkspaceContext: async (workspaceRoot: string) =>
        buildWorkShellContextSummary({
          cwd: workspaceRoot,
          ...(resumedSession?.contextLine
            ? { resumedContextLine: resumedSession.contextLine }
            : {}),
          forceRefresh: true,
        }),
      refreshHomeState,
      refreshAuthState,
      browserOAuthAvailable,
      runInlineCommand: (
        args: readonly string[],
        onProgress?: ((line: string) => void) | undefined,
      ) => runInlineCommand(args, cwd, onProgress),
      saveApiKeyAuth: (raw: string) => runTuiSessionCenterAction({
        actionId: "api-key-login",
        workspaceRoot: cwd,
        env: process.env,
        prompt: raw,
        ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
      }),
    },
  };
}

export function createManagedDashboardProps(
  session: ManagedDashboardSession,
): EmbeddedWorkDashboardSnapshot<TuiShellHomeState> {
  return createManagedWorkShellDashboardProps(
    createManagedDashboardInput(session, {
      resolveWorkShellInlineCommand,
      ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
    }),
  );
}

export function createWorkShellDashboardProps(
  agent: StartReplAgent,
  options: StartReplOptions,
): EmbeddedWorkDashboardSnapshot<TuiShellHomeState> {
  return createManagedDashboardProps({ agent, options });
}

export async function startRepl(
  agent: StartReplAgent,
  options: StartReplOptions,
): Promise<void> {
  await renderManagedWorkShellDashboard(
    createManagedDashboardInput(
      { agent, options },
      {
        resolveWorkShellInlineCommand,
        ...(process.env.HOME ? { userHomeDir: process.env.HOME } : {}),
      },
    ),
  );
}

export async function loadWorkShellDashboardProps(
  argv: readonly string[] = [],
): Promise<EmbeddedWorkDashboardSnapshot<TuiShellHomeState>> {
  const session = await loadWorkCliSession(argv);
  if (session.prompt) {
    throw new Error("Cannot build work-shell dashboard props for prompt mode.");
  }

  return createManagedDashboardProps(session);
}

export async function runWorkCli(
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const { showHelp, showTools } = parseArgs([...argv]);
  if (showHelp) {
    printHelp();
    return;
  }
  if (showTools) {
    printTools();
    return;
  }

  const session = await loadWorkCliSession(argv);
  if (session.prompt) {
    const result = await session.agent.runTurn(session.prompt);
    process.stdout.write(`${result.text}\n`);
    return;
  }

  await startRepl(session.agent, session.options);
}
