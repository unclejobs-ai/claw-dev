import {
  createAuthKeyBuiltinResult,
  createContextBuiltinResult,
  createHelpBuiltinResult,
  createLoadedSkillBuiltinResult,
  createSkillLoadErrorEntries,
  createSkillsBuiltinResult,
  createSkillUsageErrorEntries,
  createStatusBuiltinResult,
  createToolsBuiltinResult,
  createTraceModeBuiltinResult,
  resolveModelBuiltinResult,
  resolveReasoningBuiltinResult,
} from "./work-shell-engine-builtins.js";
import {
  createWorkShellStatusPanel,
  createWorkspaceReloadCompleteEntry,
  createWorkspaceReloadEntries,
} from "./work-shell-engine-panels.js";
import type {
  WorkShellChatEntry,
  WorkShellEngineOptions,
  WorkShellEngineState,
  WorkShellLoadedSkill,
  WorkShellPanel,
  WorkShellSkillListItem,
  WorkShellTraceMode,
} from "./work-shell-engine.js";
import type { WorkShellReasoningConfig } from "./reasoning.js";
import type { WorkShellSubmitRoute } from "./work-shell-engine-submit.js";

type WorkShellBuiltinCommand = Extract<
  WorkShellSubmitRoute,
  { readonly kind: "builtin" }
>["command"];

export async function executeWorkShellBuiltinSubmit<Reasoning extends WorkShellReasoningConfig>(input: {
  line: string;
  builtinCommand: WorkShellBuiltinCommand;
  state: WorkShellEngineState<Reasoning>;
  options: WorkShellEngineOptions<Reasoning>;
  currentContextSummaryLines: readonly string[];
  buildHelpPanel: () => WorkShellPanel;
  buildContextPanel: (
    contextSummaryLines: readonly string[],
    bridgeLines: readonly string[],
    memoryLines: readonly string[],
    traceLines: readonly string[],
    expanded?: boolean,
  ) => WorkShellPanel;
  buildStatusPanel: (
    options: WorkShellEngineOptions<Reasoning>,
    reasoning: Reasoning,
    authLabel: string,
  ) => WorkShellPanel;
  resolveReasoningCommand: (
    input: string,
    reasoning: Reasoning,
    modeDefault: Reasoning,
  ) => { nextReasoning: Reasoning; message: string };
  resolveModelCommand?: ((
    input: string,
    currentModel: string,
    currentReasoning: Reasoning,
    modeDefault: Reasoning,
  ) => {
    readonly nextModel: string;
    readonly nextReasoning: Reasoning;
    readonly message: string;
    readonly panel: WorkShellPanel;
  } | undefined) | undefined;
  modeDefaultReasoning: Reasoning;
  listAvailableSkills: (cwd: string) => Promise<readonly WorkShellSkillListItem[]>;
  loadNamedSkill: (name: string, cwd: string) => Promise<WorkShellLoadedSkill>;
  toolLines: readonly string[];
  clearAgent: () => void;
  updateRuntimeSettings: (settings: {
    reasoning?: Reasoning | undefined;
    model?: string | undefined;
  }) => void;
  onExit: () => void;
  openSessionsPanel: () => Promise<void>;
  reloadContextState: () => Promise<void>;
  appendEntries: (...entries: readonly WorkShellChatEntry[]) => void;
  setState: (patch: Partial<WorkShellEngineState<Reasoning>>) => void;
  persistSessionSnapshot: (
    state: "running" | "idle" | "requires_action",
    summary: string,
    traceMode?: WorkShellTraceMode,
  ) => Promise<void>;
  lastSessionSummary: string;
}): Promise<void> {
  switch (input.builtinCommand.kind) {
    case "exit":
      input.onExit();
      return;
    case "clear":
      input.clearAgent();
      input.setState({ entries: [{ role: "system", text: "Conversation cleared." }] });
      return;
    case "help": {
      const result = createHelpBuiltinResult(input.line, input.buildHelpPanel);
      input.appendEntries(...result.entries);
      input.setState({ panel: result.panel });
      return;
    }
    case "context": {
      const result = createContextBuiltinResult({
        line: input.line,
        contextSummaryLines: input.currentContextSummaryLines,
        state: input.state,
        buildContextPanel: input.buildContextPanel,
      });
      input.appendEntries(...result.entries);
      input.setState({ panel: result.panel });
      return;
    }
    case "reload":
      input.appendEntries(...createWorkspaceReloadEntries(input.line));
      await input.reloadContextState();
      input.appendEntries(createWorkspaceReloadCompleteEntry());
      return;
    case "status": {
      const result = createStatusBuiltinResult({
        line: input.line,
        reasoning: input.state.reasoning,
        authLabel: input.state.authLabel,
        buildStatusPanel: (reasoning, authLabel) => createWorkShellStatusPanel({
          options: input.options,
          stateModel: input.state.model,
          reasoning,
          authLabel,
          buildStatusPanel: input.buildStatusPanel,
        }),
      });
      input.appendEntries(...result.entries);
      input.setState({ panel: result.panel });
      return;
    }
    case "trace-mode": {
      const result = createTraceModeBuiltinResult({
        line: input.line,
        traceMode: input.builtinCommand.traceMode,
        state: input.state,
        contextSummaryLines: input.currentContextSummaryLines,
        buildContextPanel: input.buildContextPanel,
      });
      input.appendEntries(...result.entries);
      input.setState(result.patch);
      await input.persistSessionSnapshot("idle", input.lastSessionSummary, input.builtinCommand.traceMode).catch(() => undefined);
      return;
    }
    case "sessions":
      input.appendEntries({ role: "user", text: input.line });
      await input.openSessionsPanel();
      return;
    case "reasoning": {
      const result = resolveReasoningBuiltinResult({
        line: input.line,
        currentReasoning: input.state.reasoning,
        modeDefaultReasoning: input.modeDefaultReasoning,
        authLabel: input.state.authLabel,
        resolveReasoningCommand: input.resolveReasoningCommand,
        buildStatusPanel: (reasoning, authLabel) => createWorkShellStatusPanel({
          options: input.options,
          stateModel: input.state.model,
          reasoning,
          authLabel,
          buildStatusPanel: input.buildStatusPanel,
        }),
      });
      input.updateRuntimeSettings({ reasoning: result.nextReasoning });
      input.appendEntries(...result.entries);
      input.setState({
        reasoning: result.nextReasoning,
        panel: result.panel,
      });
      return;
    }
    case "model": {
      const result = resolveModelBuiltinResult({
        line: input.line,
        currentModel: input.state.model,
        currentReasoning: input.state.reasoning,
        modeDefaultReasoning: input.modeDefaultReasoning,
        resolveModelCommand: input.resolveModelCommand,
      });
      if (!result) {
        return;
      }
      if (result.shouldUpdateRuntime) {
        input.updateRuntimeSettings({ model: result.nextModel, reasoning: result.nextReasoning });
      }
      input.appendEntries(...result.entries);
      input.setState({
        model: result.nextModel,
        reasoning: result.nextReasoning,
        panel: result.panel,
      });
      await input.persistSessionSnapshot("idle", input.lastSessionSummary).catch(() => undefined);
      return;
    }
    case "tools":
      input.appendEntries(...createToolsBuiltinResult(input.line, input.toolLines));
      return;
    case "auth-key": {
      const result = createAuthKeyBuiltinResult(input.line);
      input.appendEntries(...result.entries);
      input.setState({
        composerMode: result.composerMode,
        panel: result.panel,
      });
      return;
    }
    case "skills": {
      const skills = await input.listAvailableSkills(input.options.cwd);
      const result = createSkillsBuiltinResult(input.line, skills);
      input.appendEntries(...result.entries);
      input.setState({ panel: result.panel });
      return;
    }
    case "skill": {
      if (!input.builtinCommand.skillName) {
        input.appendEntries(...createSkillUsageErrorEntries(input.line));
        return;
      }

      try {
        const skill = await input.loadNamedSkill(input.builtinCommand.skillName, input.options.cwd);
        const result = createLoadedSkillBuiltinResult(input.line, skill);
        input.appendEntries(...result.entries);
        input.setState({ panel: result.panel });
      } catch (error) {
        input.appendEntries(...createSkillLoadErrorEntries(input.line, error));
      }
      return;
    }
  }
}
