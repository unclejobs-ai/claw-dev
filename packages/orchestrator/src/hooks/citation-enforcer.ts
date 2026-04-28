/**
 * Citation enforcer — onAfterStep hook that detects unsubstantiated factual
 * claims and injects a system reminder requiring SSOT-cited evidence.
 *
 * Anti-hallucination floor (§5.6). Pure heuristic — pattern-matches phrases
 * like "tests pass" / "build succeeds" that the assistant produced without
 * citing an observation step. The cited form is `[step:<n>]` or
 * `[file:<path>@<sha7>]` so the gate / reviewer can replay later.
 */

import type {
  MiniLoopAction,
  MiniLoopHookContext,
  MiniLoopHookDecision,
  MiniLoopObservation,
} from "@unclecode/contracts";

const CLAIM_PATTERNS: ReadonlyArray<RegExp> = [
  /\btests?\s+pass(?:ing|ed)?\b/i,
  /\bbuild\s+succe(?:eds|eded|essful)\b/i,
  /\b(?:no|zero)\s+errors?\b/i,
  /\btype[- ]?check\s+(?:passes|clean|clear)\b/i,
  /\blint(?:er)?\s+(?:passes|clean|clear)\b/i,
  /\b(?:fix|fixed|fixes)\s+(?:the\s+)?(?:bug|issue|regression)\b/i,
];

const CITATION_PATTERN = /\[(?:step:\d+|file:[^@\]]+@[0-9a-f]{6,64}|checkpoint:\d+)]/i;
const REMINDER_TAG = "[citation-enforcer]";

export type CitationEnforcerOptions = {
  readonly minCoverageRatio?: number;
};

export function buildCitationEnforcer(
  options: CitationEnforcerOptions = {},
): (
  ctx: MiniLoopHookContext,
  action: MiniLoopAction,
  observation: MiniLoopObservation,
) => Promise<MiniLoopHookDecision> {
  const minCoverageRatio = options.minCoverageRatio ?? 0.5;

  return async (ctx, _action, _observation) => {
    const lastAssistant = findLastAssistantMessage(ctx.messages);
    if (!lastAssistant) {
      return { kind: "continue" };
    }

    if (lastAssistant.content.includes(REMINDER_TAG)) {
      return { kind: "continue" };
    }

    const claims = collectClaims(lastAssistant.content);
    if (claims.length === 0) {
      return { kind: "continue" };
    }

    const cited = claims.filter((claim) => CITATION_PATTERN.test(claim));
    const coverage = cited.length / claims.length;
    if (coverage >= minCoverageRatio) {
      return { kind: "continue" };
    }

    const uncited = claims.filter((claim) => !CITATION_PATTERN.test(claim));
    const reminder = [
      `${REMINDER_TAG} ${uncited.length} claim(s) lack SSOT citations.`,
      "Re-emit each claim with one of:",
      "  [step:<n>]                 — points at a tool observation step in this run",
      "  [file:<path>@<sha256_7>]   — pins a file's content hash",
      "  [checkpoint:<index>]       — pins a team-run checkpoint line",
      "Uncited:",
      ...uncited.map((claim) => `  - "${claim.trim()}"`),
    ].join("\n");

    return {
      kind: "inject",
      message: {
        role: "system",
        content: reminder,
        stepIndex: ctx.stepIndex,
      },
    };
  };
}

function findLastAssistantMessage(
  messages: MiniLoopHookContext["messages"],
): { content: string } | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return { content: message.content };
    }
  }
  return undefined;
}

function collectClaims(content: string): ReadonlyArray<string> {
  const sentences = content.split(/(?<=[.!?])\s+/);
  const claims: string[] = [];
  for (const sentence of sentences) {
    if (CLAIM_PATTERNS.some((pattern) => pattern.test(sentence))) {
      claims.push(sentence);
    }
  }
  return claims;
}
