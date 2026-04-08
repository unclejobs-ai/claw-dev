import type {
  WorkShellLoadedSkill,
  WorkShellPanel,
  WorkShellSkillListItem,
} from "./work-shell-engine.js";

export type ResolvedWorkShellBuiltinCommand =
  | { readonly kind: "exit" }
  | { readonly kind: "clear" }
  | { readonly kind: "help" }
  | { readonly kind: "context" }
  | { readonly kind: "reload" }
  | { readonly kind: "status" }
  | { readonly kind: "sessions" }
  | { readonly kind: "tools" }
  | { readonly kind: "skills" }
  | { readonly kind: "auth-key" }
  | { readonly kind: "trace-mode"; readonly traceMode: "verbose" | "minimal" }
  | { readonly kind: "reasoning"; readonly line: string }
  | { readonly kind: "model"; readonly line: string }
  | { readonly kind: "skill"; readonly line: string; readonly skillName?: string };

export function resolveWorkShellBuiltinCommand(
  line: string,
): ResolvedWorkShellBuiltinCommand | undefined {
  if (line === "/exit") return { kind: "exit" };
  if (line === "/clear") return { kind: "clear" };
  if (line === "/help") return { kind: "help" };
  if (line === "/context") return { kind: "context" };
  if (line === "/reload") return { kind: "reload" };
  if (line === "/status") return { kind: "status" };
  if (line === "/sessions") return { kind: "sessions" };
  if (line === "/tools") return { kind: "tools" };
  if (line === "/skills") return { kind: "skills" };
  if (line === "/auth key") return { kind: "auth-key" };
  if (line === "/verbose" || line === "/v") {
    return { kind: "trace-mode", traceMode: "verbose" };
  }
  if (line === "/minimal" || line === "/m") {
    return { kind: "trace-mode", traceMode: "minimal" };
  }
  if (line.startsWith("/reasoning")) return { kind: "reasoning", line };
  if (line.startsWith("/model")) return { kind: "model", line };
  if (line.startsWith("/skill ")) {
    const skillName = line.slice(7).trim();
    return skillName.length > 0 ? { kind: "skill", line, skillName } : { kind: "skill", line };
  }
  return undefined;
}

export function createSecureApiKeyEntryPanel(message = "Paste key. Optional: --org <id> --project <id>."): WorkShellPanel {
  return {
    title: "Auth",
    lines: [
      "Current",
      "Secure API key entry.",
      "",
      "Next",
      message,
      "Enter saves · Esc cancels.",
    ],
  };
}

export function createSkillsPanel(skills: readonly WorkShellSkillListItem[]): WorkShellPanel {
  return {
    title: "Skills",
    lines: skills.length > 0
      ? skills.slice(0, 12).flatMap((skill) => [
          `${skill.name} · ${skill.scope}`,
          ...(skill.summary ? [`  ${skill.summary}`] : []),
        ])
      : ["No skills found."],
  };
}

export function createLoadedSkillPanel(skill: WorkShellLoadedSkill): WorkShellPanel {
  return {
    title: `Skill · ${skill.name}`,
    lines: skill.content.split(/\r?\n/).slice(0, 12),
  };
}

export function createAuthLoginPendingPanel(): WorkShellPanel {
  return {
    title: "Auth",
    lines: [
      "Starting OAuth…",
      "Check the browser window.",
    ],
  };
}

export function buildAuthProgressPanelLines(progressLines: readonly string[]): readonly string[] {
  const normalizedLines = progressLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (normalizedLines.length === 0) {
    return createAuthLoginPendingPanel().lines;
  }

  const latestCodeLine = [...normalizedLines]
    .reverse()
    .find((line) => line.startsWith("Enter code:"));
  const latestStatusLine = normalizedLines.at(-1);
  const historyLines = normalizedLines.filter(
    (line) => line !== latestCodeLine && line !== latestStatusLine,
  );

  return [
    ...(latestCodeLine ? [latestCodeLine] : []),
    ...(latestStatusLine && latestStatusLine !== latestCodeLine
      ? [latestStatusLine]
      : []),
    ...historyLines,
    ...(latestCodeLine ? [] : latestStatusLine ? [] : ["Check the browser window."]),
  ];
}

export function resolvePromptSlashCommand(
  slashCommand: readonly string[] | undefined,
): { readonly kind: "review" | "commit"; readonly focus?: string } | undefined {
  if (!slashCommand || slashCommand[0] !== "prompt") {
    return undefined;
  }

  const kind = slashCommand[1];
  if (kind !== "review" && kind !== "commit") {
    return undefined;
  }

  const focus = slashCommand.slice(2).join(" ").trim();
  return focus.length > 0 ? { kind, focus } : { kind };
}

export function buildPromptCommandPrompt(input: {
  readonly kind: "review" | "commit";
  readonly focus?: string;
}): string {
  const focusLine = `Focus request: ${input.focus ?? "current changes in this workspace"}`;

  if (input.kind === "review") {
    return [
      "Review the current repository changes and implementation.",
      focusLine,
      "Report concrete issues, risks, missing verification, and the smallest high-value next fixes.",
      "If no major issue is found, say that explicitly and still list remaining risks and verification gaps.",
      "Respond with sections: Findings, Risks, Recommended tests, Verdict.",
    ].join("\n\n");
  }

  return [
    "Draft a single git commit message using the Lore protocol.",
    focusLine,
    "The first line must explain why, not what changed.",
    "Then provide a short body plus git trailers using this vocabulary when applicable:",
    "Constraint:\nRejected:\nConfidence:\nScope-risk:\nDirective:\nTested:\nNot-tested:",
    "If some details are unknown, keep them honest and concise instead of inventing facts.",
    "Output only the commit message.",
  ].join("\n\n");
}
