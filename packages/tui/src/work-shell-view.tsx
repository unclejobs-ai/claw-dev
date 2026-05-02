import { Box, Text } from "ink";
import React from "react";

import { getDisplayWidth, sliceByDisplayWidth } from "./text-width.js";

export type WorkShellEntryRole = "user" | "assistant" | "tool" | "system";

export type WorkShellEntry = {
  readonly role: WorkShellEntryRole;
  readonly text: string;
};

export type WorkShellPanel = {
  readonly title: string;
  readonly lines: readonly string[];
};

export type WorkShellEntryPresentation = {
  readonly label: string;
  readonly badge: string;
  readonly labelColor: string;
  readonly labelTextColor?: string;
  readonly labelBackgroundColor?: string;
  readonly railColor: string;
  readonly borderColor?: string;
  readonly bodyColor: string;
};

const W = {
  text: "#e7e5e4",
  textMuted: "#a8a29e",
  textDim: "#78716c",
  border: "#44403c",
  borderStrong: "#57534e",
  user: "#7dd3fc",
  userBody: "#e0f2fe",
  userBadgeText: "#082f49",
  userBadgeBg: "#38bdf8",
  userSurface: "#2f3342",
  assistant: "#86efac",
  assistantBody: "#dcfce7",
  assistantBadgeText: "#052e16",
  assistantBadgeBg: "#4ade80",
  assistantMuted: "#9ca3af",
  tool: "#fbbf24",
  toolSurface: "#18261d",
  toolAccent: "#bef264",
  toolMuted: "#8b978d",
  warning: "#facc15",
} as const;

function WorkShellSectionDivider(props: {
  readonly label: string;
  readonly accentColor?: string;
  readonly width?: number;
}) {
  const width = props.width ?? 72;
  const labelContent = ` ${props.label} `;
  const leftLength = Math.max(1, Math.floor((width - labelContent.length) / 2));
  const rightLength = Math.max(1, width - labelContent.length - leftLength);
  return (
    <Text color={W.border}>
      {"─".repeat(leftLength)}
      <Text color={props.accentColor ?? W.textMuted}>{labelContent}</Text>
      {"─".repeat(rightLength)}
    </Text>
  );
}

export function formatWorkShellProviderTitle(provider: string): string {
  if (provider === "openai") return "UncleCode · OpenAI";
  if (provider === "gemini") return "UncleCode · Gemini";
  if (provider === "anthropic") return "UncleCode · Anthropic";
  return `UncleCode · ${provider}`;
}

export function getWorkShellEntryPresentation(role: WorkShellEntryRole): WorkShellEntryPresentation {
  if (role === "user") {
    return {
      label: "You",
      badge: "›",
      labelColor: W.user,
      labelTextColor: W.userBadgeText,
      labelBackgroundColor: W.userBadgeBg,
      railColor: W.user,
      borderColor: W.user,
      bodyColor: W.userBody,
    };
  }
  if (role === "assistant") {
    return {
      label: "UncleCode",
      badge: "✦",
      labelColor: W.assistant,
      labelTextColor: W.assistantBadgeText,
      labelBackgroundColor: W.assistantBadgeBg,
      railColor: W.assistant,
      borderColor: W.assistant,
      bodyColor: W.assistantBody,
    };
  }
  if (role === "tool") {
    return { label: "Step", badge: "→", labelColor: W.tool, railColor: W.borderStrong, borderColor: W.borderStrong, bodyColor: W.text };
  }
  return { label: "Status", badge: "·", labelColor: W.textMuted, railColor: W.border, borderColor: W.border, bodyColor: W.textMuted };
}

export function getWorkShellConversationLayout(role: WorkShellEntryRole): {
  readonly marginBottom: number;
  readonly paddingLeft: number;
  readonly hasBorder: boolean;
} {
  if (role === "assistant") {
    return { marginBottom: 1, paddingLeft: 2, hasBorder: false };
  }
  if (role === "tool" || role === "system") {
    return { marginBottom: 0, paddingLeft: 3, hasBorder: false };
  }

  return { marginBottom: 1, paddingLeft: 0, hasBorder: false };
}

export function getWorkShellEntryBorderStyle(role: WorkShellEntryRole): "round" | "single" {
  return role === "tool" || role === "system" ? "single" : "round";
}

export function getWorkShellEmptyConversationHint(): string {
  return "Type a task to start. Use / for commands, @file for context.";
}

export function getWorkShellPanelBorderColor(inputValue: string, panelTitle: string): string {
  if (inputValue.trim().startsWith("/")) {
    return W.user;
  }
  if (panelTitle === "Auth") {
    return W.assistant;
  }
  if (panelTitle === "Commands" || panelTitle === "Models") {
    return W.borderStrong;
  }
  return W.border;
}

export function getWorkShellPanelDisplayMode(input: {
  readonly panelTitle: string;
  readonly inputValue: string;
  readonly terminalColumns?: number;
}): "hidden" | "overlay" | "side" | "bottom" {
  const slashActive = input.inputValue.trim().startsWith("/");
  const interactivePanel = input.panelTitle === "Auth" || input.panelTitle === "Commands" || input.panelTitle === "Models";

  if (input.panelTitle === "Context") {
    return "hidden";
  }
  if (input.panelTitle === "Context expanded") {
    return "overlay";
  }
  if (slashActive && interactivePanel) {
    return "bottom";
  }

  return "bottom";
}

export function getWorkShellPanelPlacement(input: {
  readonly panelTitle: string;
  readonly inputValue: string;
  readonly terminalColumns?: number;
}): "side" | "bottom" {
  return getWorkShellPanelDisplayMode(input) === "side" ? "side" : "bottom";
}

export function getWorkShellPanelAnchor(displayMode: "hidden" | "overlay" | "side" | "bottom"): "with-conversation" | "after-composer" {
  return displayMode === "side" ? "with-conversation" : "after-composer";
}

export function getWorkShellBottomDrawerMinHeight(
  displayMode: "hidden" | "overlay" | "side" | "bottom",
  panelTitle: string,
  inputValue: string,
): number {
  if (displayMode !== "bottom") {
    return 0;
  }
  if (inputValue.trim().startsWith("/")) {
    return 6;
  }
  if (
    panelTitle === "Commands" ||
    panelTitle === "Auth" ||
    panelTitle === "Models" ||
    panelTitle === "Session status" ||
    panelTitle === "Doctor" ||
    panelTitle === "Mode" ||
    panelTitle === "MCP"
  ) {
    return 6;
  }
  return 0;
}

export function getWorkShellComposerHintMinHeight(): 1 {
  return 1;
}

export function getWorkShellAttachmentPlacement(): "after-composer" {
  return "after-composer";
}

export function getWorkShellAttachmentMinHeight(): 4 {
  return 4;
}

export function getWorkShellAttachmentLineColor(index: number): string {
  if (index === 0) {
    return W.user;
  }
  if (index === 1) {
    return W.text;
  }
  return W.textMuted;
}

export function getWorkShellComposerHint(inputValue: string, slashSuggestionCount: number): string | undefined {
  if (inputValue.trim().startsWith("/")) {
    return slashSuggestionCount > 0 ? "↑↓ select · Enter run · Esc cancel" : "No matches";
  }
  if (inputValue.trim().length === 0) {
    return "Enter send · Shift+Enter newline · / commands";
  }
  return "Enter send · Shift+Enter newline";
}

const WORK_SHELL_BUSY_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export function formatWorkShellBusyStatusLine(status?: string, frame = 0): string {
  const spinner = WORK_SHELL_BUSY_SPINNER_FRAMES[((frame % WORK_SHELL_BUSY_SPINNER_FRAMES.length) + WORK_SHELL_BUSY_SPINNER_FRAMES.length) % WORK_SHELL_BUSY_SPINNER_FRAMES.length];
  const normalizedStatus = (status ?? "Thinking…")
    .replace(/^[·→★✓✖↔]\s*/u, "")
    .trim();
  return `${spinner} ${normalizedStatus || "Thinking…"}`;
}

function compactWorkShellReasoningLabel(reasoningLabel: string): string {
  return reasoningLabel.replace(/\s*\([^)]*\)$/, "").trim();
}

function humanizeWorkShellReasoningLabel(reasoningLabel: string): string {
  const compact = compactWorkShellReasoningLabel(reasoningLabel).toLowerCase();
  if (compact === "low") return "Light thinking";
  if (compact === "medium") return "Balanced thinking";
  if (compact === "high") return "Deep thinking";
  if (compact === "unsupported") return "Reasoning fixed";
  return reasoningLabel;
}

export function formatWorkShellThinkingLine(reasoningLabel: string): string {
  return `Thinking · ${humanizeWorkShellReasoningLabel(reasoningLabel)}`;
}

function compactWorkShellAuthLabel(authLabel: string): string {
  if (authLabel === "Browser OAuth · file") return "Saved OAuth";
  if (authLabel === "Browser OAuth · env") return "OAuth env";
  if (authLabel === "API key · file") return "Saved API key";
  if (authLabel === "API key · env") return "API key env";
  if (authLabel === "Not signed in") return "No auth";
  return authLabel;
}

function humanizeWorkShellModeLabel(mode: string): string {
  if (mode === "default") return "Work mode";
  if (mode === "search") return "Search mode";
  if (mode === "analyze") return "Analyze mode";
  if (mode === "ultrawork") return "Parallel mode";
  if (mode === "yolo") return "YOLO mode";
  return `${mode} mode`;
}

export function normalizeMarkdownDisplayText(value: string): string {
  return value
    .replace(/^```[\s\S]*?\n?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*-\s+/gm, "• ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1");
}

export function formatWorkShellStatusLine(input: {
  readonly model: string;
  readonly reasoningLabel: string;
  readonly mode: string;
  readonly authLabel: string;
}): string {
  return `${input.model} · ${humanizeWorkShellModeLabel(input.mode)} · ${compactWorkShellAuthLabel(input.authLabel)}`;
}

export function formatWorkShellUsageLine(input: {
  readonly isBusy: boolean;
  readonly busyStatus?: string;
  readonly currentTurnStartedAt?: number;
  readonly lastTurnDurationMs?: number;
  readonly nowMs?: number;
}): string {
  const activity = input.isBusy
    ? "Working now"
    : "Ready";
  const usage = input.isBusy
    ? input.currentTurnStartedAt !== undefined
      ? `elapsed ${formatCompactDuration(Math.max(0, (input.nowMs ?? Date.now()) - input.currentTurnStartedAt))}`
      : "elapsed now"
    : input.lastTurnDurationMs !== undefined
      ? `last reply ${formatCompactDuration(input.lastTurnDurationMs)}`
      : "no reply yet";
  const detail = input.isBusy && input.busyStatus
    ? input.busyStatus.replace(/^[·→★✓✖↔]\s*/u, "").trim()
    : undefined;
  return [activity, usage, detail].filter((value) => value && value.length > 0).join(" · ");
}

function formatCompactDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.max(0, Math.round(durationMs))}ms`;
  }
  if (durationMs < 10_000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }
  return `${Math.round(durationMs / 1000)}s`;
}

export function parseWorkShellPanelFactLine(line: string): { readonly label: string; readonly value: string } | undefined {
  const match = /^(?!\/)([A-Z][A-Za-z ]+)\s·\s(.+)$/.exec(line.trim());
  if (!match) {
    return undefined;
  }
  return {
    label: match[1] ?? "",
    value: match[2] ?? "",
  };
}

export function isWorkShellWarningLine(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  return normalized.includes("unsupported") ||
    normalized.includes("unavailable") ||
    normalized.includes("needs refresh") ||
    normalized.includes("lacks") ||
    normalized.startsWith("warning ·");
}

function renderWorkShellPanelLine(line: string, index: number): React.ReactNode {
  const trimmed = line.trim();
  const sectionHeaders = new Set(["Workspace", "Guidance", "Bridge", "Memory", "Live steps", "Current", "Available", "Routes", "Next"]);
  if (trimmed.length === 0) {
    return <Text key={`${index}-blank`}> </Text>;
  }
  if (sectionHeaders.has(trimmed)) {
    return (
      <Box key={`${index}-${line}`} marginTop={index === 0 ? 0 : 1}>
        <Text bold color={W.textMuted}>{trimmed}</Text>
      </Box>
    );
  }
  const treeMatch = /^(├|└)\s+([^\s].*?)(\s{2,})(.+)$/.exec(line);
  if (treeMatch) {
    const branch = treeMatch[1] ?? "";
    const label = treeMatch[2] ?? "";
    const spacing = treeMatch[3] ?? " ";
    const value = treeMatch[4] ?? "";
    return (
      <Text key={`${index}-${line}`} color={W.textMuted}>
        {branch} <Text color={W.user}>{label.trim()}</Text>
        {spacing}
        <Text color={W.text}>{value}</Text>
      </Text>
    );
  }
  const suggestionMatch = /^(›| )\s+(\/\S(?:.*?))(\s{2,})(.+)$/.exec(line);
  if (suggestionMatch) {
    const marker = suggestionMatch[1] ?? " ";
    const command = suggestionMatch[2] ?? "";
    const spacing = suggestionMatch[3] ?? "  ";
    const description = suggestionMatch[4] ?? "";
    const isSelected = marker === "›";
    return (
      <Text key={`${index}-${line}`}>
      <Text color={isSelected ? W.user : W.textMuted}>{marker}</Text>
      <Text color={isSelected ? W.user : W.user}> {command}</Text>
      <Text color={isWorkShellWarningLine(description) ? W.warning : isSelected ? W.text : W.textMuted}>{spacing}{description}</Text>
</Text>
    );
  }
  if (trimmed.startsWith("› /")) {
    return <Text key={`${index}-${line}`} color={W.user}>{trimmed}</Text>;
  }
  if (trimmed.startsWith("/")) {
    return <Text key={`${index}-${line}`} color={W.user}>{trimmed}</Text>;
  }
  const factLine = parseWorkShellPanelFactLine(trimmed);
  if (factLine) {
    const labelColor = factLine.label === "Warning" ? W.warning : W.textMuted;
    const valueColor = isWorkShellWarningLine(trimmed) ? W.warning : W.text;
    return (
      <Text key={`${index}-${line}`}>
        <Text color={labelColor}>{factLine.label}</Text>
        <Text color={W.textDim}> · </Text>
        <Text color={valueColor}>{factLine.value}</Text>
      </Text>
    );
  }
  if (trimmed.startsWith("Signed in · ")) {
    return <Text key={`${index}-${line}`} color={W.assistant}>{trimmed}</Text>;
  }
  if (trimmed === "Not signed in yet" || trimmed === "Not signed in") {
    return <Text key={`${index}-${line}`} color={W.warning}>{trimmed}</Text>;
  }
  if (trimmed === "Current" || trimmed === "Routes" || trimmed === "Next") {
    return <Text key={`${index}-${line}`} color={W.textMuted} bold>{trimmed}</Text>;
  }
  if (trimmed.startsWith("Browser OAuth needs refresh") || trimmed.startsWith("Browser OAuth unavailable")) {
    return <Text key={`${index}-${line}`} color={W.warning}>{trimmed}</Text>;
  }
  if (trimmed.startsWith("Tip · ")) {
    return <Text key={`${index}-${line}`} color={W.textDim}>{trimmed}</Text>;
  }
  if (trimmed.startsWith("↑↓") || trimmed.startsWith("No slash")) {
    return <Text key={`${index}-${line}`} color={W.warning}>{trimmed}</Text>;
  }
  if (trimmed.startsWith("Matches for ") || trimmed.endsWith(" matches")) {
    return <Text key={`${index}-${line}`} color={W.textDim}>{trimmed}</Text>;
  }
  if (line.startsWith("  ")) {
    return <Text key={`${index}-${line}`} color={W.textMuted}>{line}</Text>;
  }
  return <Text key={`${index}-${line}`} color={W.text}>{line}</Text>;
}

function getWorkShellConversationWidth(input: {
  readonly panelPlacement: "side" | "bottom";
  readonly terminalColumns?: number;
}): number {
  const terminalColumns = input.terminalColumns ?? process.stdout.columns ?? 96;
  const availableColumns = input.panelPlacement === "side"
    ? Math.floor(terminalColumns * 0.62)
    : terminalColumns - 6;
  return Math.max(32, Math.min(availableColumns, 118));
}

function padDisplayLine(value: string, width: number): string {
  const padding = Math.max(0, width - getDisplayWidth(value));
  return `${value}${" ".repeat(padding)}`;
}

function truncateDisplayLine(value: string, width: number): string {
  if (getDisplayWidth(value) <= width) {
    return value;
  }
  if (width <= 1) {
    return sliceByDisplayWidth(value, width);
  }
  return `${sliceByDisplayWidth(value, width - 1)}…`;
}

function getWorkShellDockWidth(terminalColumns?: number): number {
  const columns = terminalColumns ?? process.stdout.columns ?? 96;
  return Math.max(32, columns - 4);
}

function compactWorkShellPath(cwd?: string): string {
  if (!cwd) {
    return "";
  }
  const home = process.env.HOME;
  const normalized = home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
  const parts = normalized.split("/").filter(Boolean);
  if (normalized.startsWith("~") && parts.length > 3) {
    return `~/${parts.slice(-2).join("/")}`;
  }
  if (!normalized.startsWith("~") && parts.length > 3) {
    return `…/${parts.slice(-2).join("/")}`;
  }
  return normalized;
}

export function formatWorkShellFooterLine(input: {
  readonly cwd?: string;
  readonly model: string;
  readonly reasoningLabel: string;
  readonly mode: string;
  readonly authLabel: string;
  readonly composerHint?: string;
  readonly width?: number;
}): string {
  const statusLine = formatWorkShellStatusLine({
    model: input.model,
    reasoningLabel: input.reasoningLabel,
    mode: input.mode,
    authLabel: input.authLabel,
  });
  const footer = [
    compactWorkShellPath(input.cwd),
    statusLine,
    input.composerHint,
  ].filter((item): item is string => typeof item === "string" && item.length > 0).join("  ·  ");
  return input.width ? truncateDisplayLine(footer, input.width) : footer;
}

function wrapDisplayLine(line: string, width: number): string[] {
  if (width <= 0) {
    return [line];
  }
  if (getDisplayWidth(line) <= width) {
    return [line];
  }

  const output: string[] = [];
  let remaining = line;
  while (remaining.length > 0) {
    const chunk = sliceByDisplayWidth(remaining, width);
    if (chunk.length === 0) {
      break;
    }
    output.push(chunk.trimEnd());
    remaining = remaining.slice(chunk.length).trimStart();
  }
  return output.length > 0 ? output : [line];
}

function wrapDisplayText(value: string, width: number): string[] {
  return value
    .split("\n")
    .flatMap((line) => line.length === 0 ? [""] : wrapDisplayLine(line, width));
}

function renderSurfaceText(input: {
  readonly text: string;
  readonly width: number;
  readonly backgroundColor: string;
  readonly color: string;
  readonly keyPrefix: string;
  readonly paddingX?: number;
}): React.ReactNode {
  const paddingX = input.paddingX ?? 2;
  const innerWidth = Math.max(8, input.width - paddingX * 2);
  const leftPadding = " ".repeat(paddingX);
  const rightPadding = " ".repeat(paddingX);
  const lines = wrapDisplayText(input.text, innerWidth);

  return lines.map((line, index) => (
    <Text
      key={`${input.keyPrefix}-${String(index)}`}
      backgroundColor={input.backgroundColor}
      color={input.color}
    >
      {leftPadding}{padDisplayLine(line, innerWidth)}{rightPadding}
    </Text>
  ));
}

function renderWorkShellEntryBlock(input: {
  readonly entry: WorkShellEntry;
  readonly index: number;
  readonly width: number;
}): React.ReactNode {
  const presentation = getWorkShellEntryPresentation(input.entry.role);
  const bodyText = input.entry.role === "assistant"
    ? normalizeMarkdownDisplayText(input.entry.text)
    : input.entry.text;

  if (input.entry.role === "user") {
    return (
      <Box
        key={`${input.entry.role}-${input.index}`}
        marginBottom={1}
        flexDirection="column"
      >
        {renderSurfaceText({
          text: bodyText,
          width: input.width,
          backgroundColor: W.userSurface,
          color: presentation.bodyColor,
          keyPrefix: `user-${String(input.index)}`,
        })}
      </Box>
    );
  }

  if (input.entry.role === "assistant") {
    return (
      <Box
        key={`${input.entry.role}-${input.index}`}
        marginBottom={1}
        paddingLeft={1}
        flexDirection="column"
      >
        <Text bold color={W.assistantMuted}>{presentation.label}</Text>
        <Box marginTop={1} paddingLeft={1} flexDirection="column">
          {wrapDisplayText(bodyText, Math.max(20, input.width - 4)).map((line, lineIndex) => (
            <Text key={`assistant-${String(input.index)}-${String(lineIndex)}`} color={presentation.bodyColor}>
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

  if (input.entry.role === "tool") {
    return (
      <Box
        key={`${input.entry.role}-${input.index}`}
        marginBottom={1}
        flexDirection="column"
      >
        <Text backgroundColor={W.toolSurface} color={W.toolAccent} bold>
          {padDisplayLine(` ${presentation.label.toLowerCase()} `, input.width)}
        </Text>
        {renderSurfaceText({
          text: bodyText,
          width: input.width,
          backgroundColor: W.toolSurface,
          color: W.text,
          keyPrefix: `tool-${String(input.index)}`,
        })}
      </Box>
    );
  }

  return (
    <Box
      key={`${input.entry.role}-${input.index}`}
      marginBottom={0}
      paddingLeft={3}
      flexDirection="column"
    >
      <Text color={presentation.bodyColor}>{bodyText}</Text>
    </Box>
  );
}

function renderWorkShellThinkingBlock(input: {
  readonly width: number;
  readonly busyStatus?: string;
  readonly reasoningLabel?: string;
  readonly spinnerFrame: number;
}): React.ReactNode {
  const statusLine = formatWorkShellBusyStatusLine(input.busyStatus, input.spinnerFrame);
  const detailLines = [
    input.reasoningLabel
      ? formatWorkShellThinkingLine(input.reasoningLabel).replace(/^Thinking · /, "Reasoning · ")
      : undefined,
    statusLine,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);

  return (
    <Box marginBottom={1} flexDirection="column">
      <Text backgroundColor={W.border} color={W.assistantBody} bold>
        {padDisplayLine(" thinking ", input.width)}
      </Text>
      {renderSurfaceText({
        text: detailLines.join("\n"),
        width: input.width,
        backgroundColor: W.border,
        color: W.assistantMuted,
        keyPrefix: "thinking",
      })}
    </Box>
  );
}

const WorkShellConversationBlock = React.memo(function WorkShellConversationBlock(props: {
  readonly entries: readonly WorkShellEntry[];
  readonly panelPlacement: "side" | "bottom";
  readonly isBusy: boolean;
  readonly busyStatus?: string;
  readonly reasoningLabel?: string;
  readonly terminalColumns?: number;
}) {
  const [spinnerFrame, setSpinnerFrame] = React.useState(0);
  React.useEffect(() => {
    if (!props.isBusy) return;
    const interval = setInterval(() => setSpinnerFrame((f) => f + 1), 100);
    return () => clearInterval(interval);
  }, [props.isBusy]);
  const conversationWidth = getWorkShellConversationWidth({
    panelPlacement: props.panelPlacement,
    ...(props.terminalColumns !== undefined ? { terminalColumns: props.terminalColumns } : {}),
  });

  return (
    <Box flexDirection="column" width={props.panelPlacement === "side" ? "68%" : undefined} paddingRight={props.panelPlacement === "side" ? 1 : 0}>
      <Box flexDirection="column">
        {props.entries.length === 0 ? (
          <Text color={W.textMuted}>{getWorkShellEmptyConversationHint()}</Text>
        ) : props.entries.slice(-12).map((entry, index) => renderWorkShellEntryBlock({
          entry,
          index,
          width: conversationWidth,
        }))}
        {props.isBusy ? renderWorkShellThinkingBlock({
          width: conversationWidth,
          ...(props.busyStatus ? { busyStatus: props.busyStatus } : {}),
          ...(props.reasoningLabel ? { reasoningLabel: props.reasoningLabel } : {}),
          spinnerFrame,
        }) : null}
      </Box>
    </Box>
  );
});

const WorkShellPanelBlock = React.memo(function WorkShellPanelBlock(props: {
  readonly title: string;
  readonly lines: readonly string[];
  readonly panelPlacement: "side" | "bottom";
  readonly panelBorderColor: string;
  readonly panelDisplayMode: "hidden" | "overlay" | "side" | "bottom";
  readonly inputValue: string;
}) {
  return (
    <Box flexDirection="column" width={props.panelPlacement === "side" ? "32%" : undefined} paddingLeft={props.panelPlacement === "side" ? 1 : 0} marginTop={props.panelPlacement === "bottom" ? 1 : 0}>
      <WorkShellSectionDivider label={props.title} accentColor={props.panelBorderColor} />
      <Box
        marginTop={1}
        flexDirection="column"
        paddingLeft={1}
        minHeight={getWorkShellBottomDrawerMinHeight(props.panelDisplayMode, props.title, props.inputValue)}
      >
        {props.lines.map((line, index) => renderWorkShellPanelLine(line, index))}
      </Box>
    </Box>
  );
});

const WorkShellAttachmentBlock = React.memo(function WorkShellAttachmentBlock(props: {
  readonly attachmentLines: readonly string[];
}) {
  if (props.attachmentLines.length === 0 || getWorkShellAttachmentPlacement() !== "after-composer") {
    return null;
  }

  return (
    <Box marginTop={1} flexDirection="column">
      <WorkShellSectionDivider label="attachments" accentColor={W.textMuted} />
      <Box marginTop={1} flexDirection="column" paddingLeft={1} minHeight={getWorkShellAttachmentMinHeight()}>
        {props.attachmentLines.map((line, index) => (
          <Text key={`${index}-${line}`} color={getWorkShellAttachmentLineColor(index)}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
});

const WorkShellHeaderBlock = React.memo(function WorkShellHeaderBlock(props: {
  readonly provider: string;
  readonly headerHint?: string;
}) {
  return (
    <Box justifyContent="space-between">
      <Text bold color={W.text}>{formatWorkShellProviderTitle(props.provider)}</Text>
      <Text color={W.textMuted}>{props.headerHint ?? "Esc sessions · Shift+Tab mode · / commands"}</Text>
    </Box>
  );
});

const WorkShellStatusBlock = React.memo(function WorkShellStatusBlock(props: {
  readonly model: string;
  readonly reasoningLabel: string;
  readonly reasoningSupported: boolean;
  readonly mode: string;
  readonly authLabel: string;
  readonly isBusy: boolean;
  readonly busyStatus?: string;
  readonly currentTurnStartedAt?: number;
  readonly lastTurnDurationMs?: number;
}) {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const thinkingLine = formatWorkShellThinkingLine(props.reasoningLabel);
  const statusLine = formatWorkShellStatusLine({
    model: props.model,
    reasoningLabel: props.reasoningLabel,
    mode: props.mode,
    authLabel: props.authLabel,
  });
  const usageLine = formatWorkShellUsageLine({
    isBusy: props.isBusy,
    ...(props.busyStatus ? { busyStatus: props.busyStatus } : {}),
    ...(props.currentTurnStartedAt !== undefined ? { currentTurnStartedAt: props.currentTurnStartedAt } : {}),
    ...(props.lastTurnDurationMs !== undefined ? { lastTurnDurationMs: props.lastTurnDurationMs } : {}),
    nowMs,
  });

  React.useEffect(() => {
    if (!props.isBusy) {
      setNowMs(Date.now());
      return;
    }

    setNowMs(Date.now());
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [props.isBusy, props.currentTurnStartedAt]);

  return (
    <Box marginTop={1} flexDirection="column">
      <WorkShellSectionDivider label="session" accentColor={W.textMuted} />
      <Box marginTop={1} paddingLeft={1} flexDirection="column">
        <Text bold color={props.reasoningSupported ? W.user : W.warning}>{thinkingLine}</Text>
        <Text color={W.text}>{statusLine}</Text>
        <Text color={props.isBusy ? W.assistant : W.textMuted}>{usageLine}</Text>
      </Box>
    </Box>
  );
});

const WorkShellComposerDock = React.memo(function WorkShellComposerDock(props: {
  readonly composer: React.ReactNode;
  readonly composerHint?: string;
  readonly inputValue: string;
  readonly cwd?: string;
  readonly model: string;
  readonly reasoningLabel: string;
  readonly mode: string;
  readonly authLabel: string;
  readonly terminalColumns?: number;
  readonly attachmentCount?: number;
}) {
  const dockWidth = getWorkShellDockWidth(props.terminalColumns);
  const accent = props.inputValue.trim().startsWith("/") ? W.user : W.borderStrong;
  const footerLine = formatWorkShellFooterLine({
    ...(props.cwd ? { cwd: props.cwd } : {}),
    model: props.model,
    reasoningLabel: props.reasoningLabel,
    mode: props.mode,
    authLabel: props.authLabel,
    ...(props.composerHint ? { composerHint: props.composerHint } : {}),
    width: dockWidth,
  });

  const badgeColor = props.attachmentCount !== undefined && props.attachmentCount >= 5 ? "#e6a817" : W.textDim;

  return (
    <Box marginTop={1} flexDirection="column">
      <Text color={accent}>{padDisplayLine("", dockWidth).replace(/ /g, "─")}</Text>
      <Box minHeight={1} paddingLeft={1}>
        <Text backgroundColor={accent} color={W.text}>{" "}</Text>
        <Text color={W.textMuted}>{" "}</Text>
        {props.composer}
        {props.attachmentCount !== undefined ? (
          <Text color={badgeColor}> [{props.attachmentCount}/5]</Text>
        ) : null}
      </Box>
      <Text color={W.border}>{padDisplayLine("", dockWidth).replace(/ /g, "─")}</Text>
      <Text color={W.textDim}>{padDisplayLine(footerLine, dockWidth)}</Text>
    </Box>
  );
});

export function WorkShellView(props: {
  readonly provider: string;
  readonly model: string;
  readonly reasoningLabel: string;
  readonly reasoningSupported: boolean;
  readonly mode: string;
  readonly authLabel: string;
  readonly entries: readonly WorkShellEntry[];
  readonly isBusy: boolean;
  readonly busyStatus?: string;
  readonly activePanel: WorkShellPanel;
  readonly currentTurnStartedAt?: number;
  readonly lastTurnDurationMs?: number;
  readonly attachmentLines?: readonly string[];
  readonly attachmentCount?: number;
  readonly composer: React.ReactNode;
  readonly inputValue: string;
  readonly slashSuggestionCount: number;
  readonly headerHint?: string;
  readonly composerHintOverride?: string;
  readonly terminalColumns?: number;
  readonly cwd?: string;
}) {
  const composerHint = props.composerHintOverride ?? getWorkShellComposerHint(props.inputValue, props.slashSuggestionCount);
  const panelBorderColor = getWorkShellPanelBorderColor(props.inputValue, props.activePanel.title);
  const panelDisplayMode = getWorkShellPanelDisplayMode({
    panelTitle: props.activePanel.title,
    inputValue: props.inputValue,
    ...(props.terminalColumns !== undefined ? { terminalColumns: props.terminalColumns } : {}),
  });
  const panelPlacement = panelDisplayMode === "side" ? "side" : "bottom";

  const conversation = (
    <WorkShellConversationBlock
      entries={props.entries}
      panelPlacement={panelPlacement}
      isBusy={props.isBusy}
      {...(props.busyStatus ? { busyStatus: props.busyStatus } : {})}
      {...(props.reasoningLabel ? { reasoningLabel: props.reasoningLabel } : {})}
      {...(props.terminalColumns !== undefined ? { terminalColumns: props.terminalColumns } : {})}
    />
  );

  const panel = (
    <WorkShellPanelBlock
      title={props.activePanel.title}
      lines={props.activePanel.lines}
      panelPlacement={panelPlacement}
      panelBorderColor={panelBorderColor}
      panelDisplayMode={panelDisplayMode}
      inputValue={props.inputValue}
    />
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <WorkShellHeaderBlock
        provider={props.provider}
        {...(props.headerHint ? { headerHint: props.headerHint } : {})}
      />
      <WorkShellStatusBlock
        model={props.model}
        reasoningLabel={props.reasoningLabel}
        reasoningSupported={props.reasoningSupported}
        mode={props.mode}
        authLabel={props.authLabel}
        isBusy={props.isBusy}
        {...(props.busyStatus ? { busyStatus: props.busyStatus } : {})}
        {...(props.currentTurnStartedAt !== undefined ? { currentTurnStartedAt: props.currentTurnStartedAt } : {})}
        {...(props.lastTurnDurationMs !== undefined ? { lastTurnDurationMs: props.lastTurnDurationMs } : {})}
      />
      {getWorkShellPanelAnchor(panelDisplayMode) === "with-conversation" ? (
        <Box marginTop={1}>
          {conversation}
          {panel}
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          {conversation}
        </Box>
      )}
      <WorkShellComposerDock
        composer={props.composer}
        {...(composerHint ? { composerHint } : {})}
        inputValue={props.inputValue}
        {...(props.cwd ? { cwd: props.cwd } : {})}
        model={props.model}
        reasoningLabel={props.reasoningLabel}
        mode={props.mode}
        authLabel={props.authLabel}
        {...(props.terminalColumns !== undefined ? { terminalColumns: props.terminalColumns } : {})}
        {...(props.attachmentCount !== undefined ? { attachmentCount: props.attachmentCount } : {})}
      />
      {props.attachmentLines
        ? <WorkShellAttachmentBlock attachmentLines={props.attachmentLines} />
        : null}
      {panelDisplayMode === "overlay" ? (
        <Box marginTop={1} borderStyle="round" borderColor={panelBorderColor} paddingX={1} flexDirection="column">
          <WorkShellSectionDivider label={props.activePanel.title} accentColor={panelBorderColor} />
          <Text color={W.textMuted}>Esc closes · /context refreshes</Text>
          <Box marginTop={1} flexDirection="column">
            {props.activePanel.lines.map((line, index) => renderWorkShellPanelLine(line, index))}
          </Box>
        </Box>
      ) : panelDisplayMode === "bottom" ? (
        panel
      ) : null}
    </Box>
  );
}
