import type { WorkShellPanel } from "./work-shell-view.js";

export function formatAuthLabelForDisplay(authLabel: string): string {
  if (authLabel === "oauth-file") return "Browser OAuth · file";
  if (authLabel === "oauth-env") return "Browser OAuth · env";
  if (authLabel === "api-key-file") return "API key · file";
  if (authLabel === "api-key-env") return "API key · env";
  if (authLabel === "none") return "Not signed in";
  return authLabel;
}

function formatAuthRouteLabel(route: string): string {
  if (route === "device-oauth") {
    return "Device OAuth";
  }
  if (route === "browser-oauth") {
    return "Browser OAuth";
  }
  return route;
}

function getPreferredAuthRoute(authLabel: string | undefined, browserOAuthAvailable: boolean): string | undefined {
  if (
    !authLabel ||
    authLabel === "none" ||
    authLabel.startsWith("api-key-") ||
    authLabel.startsWith("oauth-")
  ) {
    return browserOAuthAvailable ? "browser-oauth" : "device-oauth";
  }
  return undefined;
}

function formatAuthStatusBlurb(authLabel?: string, browserOAuthAvailable = true): string {
  if (!authLabel || authLabel === "none") {
    return browserOAuthAvailable
      ? "Use /auth login or /auth key."
      : "Use /auth login (device when available) or /auth key.";
  }
  if (authLabel.startsWith("oauth-")) {
    return browserOAuthAvailable
      ? "Saved browser OAuth found."
      : "Saved browser OAuth found. New browser login needs OPENAI_OAUTH_CLIENT_ID.";
  }
  if (authLabel.startsWith("api-key-")) {
    return browserOAuthAvailable ? "API key ready. Browser OAuth is also available." : "API key ready. /auth login may use device OAuth.";
  }
  return "OpenAI auth loaded.";
}

function buildAuthLauncherNextLines(authLabel?: string, browserOAuthAvailable = true): readonly string[] {
  if (!authLabel || authLabel === "none") {
    return browserOAuthAvailable
      ? ["/auth login starts OAuth.", "/auth key opens secure API key entry."]
      : ["/auth login may use device OAuth.", "/auth key opens secure API key entry."];
  }

  if (authLabel.startsWith("oauth-")) {
    return ["/auth status inspects auth.", "/auth logout switches auth."];
  }

  if (authLabel.startsWith("api-key-")) {
    return browserOAuthAvailable
      ? ["/auth status inspects auth.", "/auth login starts OAuth or /auth logout switches auth."]
      : ["/auth status inspects auth.", "/auth login may use device OAuth."];
  }

  return ["/auth status inspects auth."];
}

export function buildDefaultAuthLauncherLines(
  authLabel?: string,
  browserOAuthAvailable = true,
  oauthRoute?: string,
): readonly string[] {
  const signedIn = authLabel && authLabel !== "none";
  const route = oauthRoute ?? getPreferredAuthRoute(authLabel, browserOAuthAvailable);
  return [
    "Current",
    signedIn ? `Auth · ${formatAuthLabelForDisplay(authLabel)}` : "Auth · Not signed in",
    ...(route ? [`Route · ${formatAuthRouteLabel(route)}`] : []),
    formatAuthStatusBlurb(authLabel, browserOAuthAvailable),
    ...(!browserOAuthAvailable ? ["Browser OAuth unavailable in this shell."] : []),
    "",
    "Next",
    ...buildAuthLauncherNextLines(authLabel, browserOAuthAvailable),
  ];
}

export function extractAuthLabel(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    const match = /^(?:Auth|Source|Auth source):\s*(.+)$/i.exec(line.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function extractAuthRoute(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    const match = /^Route:\s*(.+)$/i.exec(line.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function ensureAuthLauncherRoute(
  lines: readonly string[],
  authLabel: string | undefined,
  browserOAuthAvailable: boolean,
): readonly string[] {
  if (!lines.includes("Current") || lines.some((line) => /^Route\s·\s/i.test(line.trim()))) {
    return lines;
  }
  const route = getPreferredAuthRoute(authLabel, browserOAuthAvailable);
  if (!route) {
    return lines;
  }
  const authIndex = lines.findIndex((line) => /^Auth\s·\s/i.test(line.trim()));
  if (authIndex < 0) {
    return lines;
  }
  return [...lines.slice(0, authIndex + 1), `Route · ${formatAuthRouteLabel(route)}`, ...lines.slice(authIndex + 1)];
}

export function normalizeAuthLauncherLines(input: {
  readonly lines?: readonly string[];
  readonly authLabel?: string;
  readonly browserOAuthAvailable: boolean;
}): readonly string[] | undefined {
  const rawLines = input.lines ?? [];
  if (rawLines.length === 0) {
    return undefined;
  }
  if (rawLines.includes("Current")) {
    return ensureAuthLauncherRoute(rawLines, input.authLabel, input.browserOAuthAvailable);
  }
  const lines = rawLines.filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return undefined;
  }

  const rememberedAuthLabel = extractAuthLabel(lines) ?? input.authLabel;
  const rememberedRoute = extractAuthRoute(lines);
  if (lines.some((line) => /(?:browser|oauth) login complete\./i.test(line))) {
    return buildDefaultAuthLauncherLines(rememberedAuthLabel ?? "oauth-file", input.browserOAuthAvailable, rememberedRoute);
  }
  if (lines.some((line) => /saved auth found\./i.test(line))) {
    return buildDefaultAuthLauncherLines(rememberedAuthLabel ?? "oauth-file", input.browserOAuthAvailable, rememberedRoute);
  }
  if (lines.some((line) => /api key login saved\./i.test(line))) {
    return buildDefaultAuthLauncherLines(rememberedAuthLabel ?? "api-key-file", input.browserOAuthAvailable, rememberedRoute);
  }
  if (lines.some((line) => /signed out\./i.test(line))) {
    return buildDefaultAuthLauncherLines("none", input.browserOAuthAvailable, rememberedRoute);
  }
  if (lines.some((line) => /^auth:\s*/i.test(line)) && rememberedAuthLabel) {
    return buildDefaultAuthLauncherLines(rememberedAuthLabel, input.browserOAuthAvailable, rememberedRoute);
  }
  return undefined;
}

export function isMissingOAuthClientId(message: string): boolean {
  return /OPENAI_OAUTH_CLIENT_ID is required for (?:OAuth|browser) login|Browser OAuth unavailable/i.test(message);
}

export function isBrowserAuthInlineCommand(args: readonly string[]): boolean {
  return args[0] === "auth" && args[1] === "login" && args.includes("--browser");
}

export function isAuthStatusInlineCommand(args: readonly string[]): boolean {
  return args[0] === "auth" && args[1] === "status";
}

function parseAuthStatusLine(lines: readonly string[], key: string): string | undefined {
  const match = lines
    .map((line) => line.trim())
    .map((line) => new RegExp(`^${key}:\\s*(.+)$`, "i").exec(line)?.[1]?.trim())
    .find((value) => typeof value === "string" && value.length > 0);
  return typeof match === "string" ? match : undefined;
}

export function refineAuthStatusPanelLines(input: {
  readonly lines: readonly string[];
  readonly browserOAuthAvailable: boolean;
}): readonly string[] {
  const source = parseAuthStatusLine(input.lines, "source") ?? "none";
  const auth = parseAuthStatusLine(input.lines, "auth") ?? "none";
  const expiresAt = parseAuthStatusLine(input.lines, "expiresAt") ?? "none";
  const expired = (parseAuthStatusLine(input.lines, "expired") ?? "no").toLowerCase() === "yes";
  const authDisplay = formatAuthLabelForDisplay(source);

  if (source === "none") {
    return [
      "Current",
      "Auth · Not signed in",
      ...(input.browserOAuthAvailable ? ["Route · Browser OAuth"] : ["Route · Device OAuth"]),
      input.browserOAuthAvailable
        ? "Use /auth login or /auth key."
        : "Use /auth login (device when available) or /auth key.",
      "",
      "Next",
      ...(input.browserOAuthAvailable
        ? ["/auth login starts OAuth.", "/auth key opens secure API key entry."]
        : ["/auth login may use device OAuth.", "/auth key opens secure API key entry."]),
    ];
  }

  if (auth === "api-key") {
    return [
      "Current",
      `Auth · ${authDisplay}`,
      ...(input.browserOAuthAvailable ? ["Route · Browser OAuth"] : ["Route · Device OAuth"]),
      "API key active.",
      "",
      "Next",
      ...(input.browserOAuthAvailable
        ? ["/auth status inspects auth.", "/auth login starts OAuth or /auth logout switches auth."]
        : ["/auth status inspects auth.", "/auth login may use device OAuth."]),
    ];
  }

  if (expiresAt === "insufficient-scope") {
    return [
      "Current",
      `Auth · ${authDisplay}`,
      ...(input.browserOAuthAvailable ? ["Route · Browser OAuth"] : ["Route · Device OAuth"]),
      "OAuth token lacks model.request scope.",
      "",
      "Next",
      ...(input.browserOAuthAvailable
        ? ["Use /auth login for proper browser OAuth.", "/auth key opens secure API key entry."]
        : [
            "Browser OAuth here needs OPENAI_OAUTH_CLIENT_ID.",
            "/auth key opens secure API key entry.",
          ]),
    ];
  }

  if (expired || expiresAt === "refresh-required") {
    return [
      "Current",
      `Auth · ${authDisplay}`,
      ...(input.browserOAuthAvailable ? ["Route · Browser OAuth"] : ["Route · Device OAuth"]),
      "Browser OAuth needs refresh.",
      "",
      "Next",
      ...(input.browserOAuthAvailable
        ? ["/auth login refreshes this shell.", "/auth logout clears stale auth if needed."]
        : [
            "OAuth refresh needs OPENAI_OAUTH_CLIENT_ID here.",
            "/auth logout clears stale auth if needed.",
          ]),
    ];
  }

  return [
    "Current",
    `Auth · ${authDisplay}`,
    ...(input.browserOAuthAvailable ? ["Route · Browser OAuth"] : ["Route · Device OAuth"]),
    "Saved browser OAuth found.",
    "",
    "Next",
    "/auth status inspects auth or /auth logout switches auth.",
  ];
}

function normalizeVisibleLine(line: string): string {
  const trimmed = line.trim();
  const dedupeCommaList = (prefix: string): string => {
    if (!trimmed.startsWith(prefix)) {
      return trimmed;
    }
    const items = trimmed.slice(prefix.length).split(",").map((value) => value.trim()).filter((value) => value.length > 0);
    const unique = items.filter((value, index) => items.indexOf(value) === index);
    return `${prefix}${unique.join(", ")}`;
  };

  return dedupeCommaList("Loaded guidance: ");
}

export function dedupeVisibleLines(lines: readonly string[]): readonly string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const line of lines.map((value) => normalizeVisibleLine(value)).filter((value) => value.length > 0)) {
    if (seen.has(line)) {
      continue;
    }
    seen.add(line);
    result.push(line);
  }
  return result;
}

export function compactContextValue(label: string, value: string): string {
  const normalized = value
    .replace(/^Auth issue:\s*/i, "")
    .replace(/^Loaded guidance:\s*/i, "")
    .replace(/^Loaded extension:\s*/i, "ext ")
    .replace(/^Loaded skills:\s*/i, "skills ")
    .replace(/^AGENTS\.md:\s*/i, "AGENTS: ")
    .replace(/^CLAUDE\.md:\s*/i, "CLAUDE: ");
  const limit = label === "Issue" ? 35 : 36;
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

