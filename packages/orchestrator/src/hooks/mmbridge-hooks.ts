/**
 * MMBridge hooks for MiniLoopAgent boundary points.
 *
 * Hooks attach via injected MmBridgeClient interface; the actual MCP wiring
 * lives in apps/unclecode-cli (mmbridge-mcp.ts) so this package stays
 * dependency-light and unit-testable. Phase D (this file) ships the hook
 * shapes + a NoOp client so tests and offline usage remain ergonomic.
 */

import type {
  Citation,
  MiniLoopAction,
  MiniLoopHookContext,
  MiniLoopHookDecision,
  MiniLoopObservation,
} from "@unclecode/contracts";

export type MmGateStatus = "pass" | "warn" | "fail";

export type MmGateResult = {
  readonly gateId: string;
  readonly status: MmGateStatus;
  readonly summary: string;
  readonly findings?: ReadonlyArray<{
    readonly severity: "info" | "warn" | "error";
    readonly message: string;
    readonly path?: string;
    readonly line?: number;
  }>;
};

export type MmReviewResult = {
  readonly reviewerId: string;
  readonly summary: string;
  readonly issues: ReadonlyArray<string>;
  readonly suggestions?: ReadonlyArray<string>;
};

export type MmSecurityFinding = {
  readonly severity: "info" | "warn" | "error";
  readonly category: string;
  readonly message: string;
  readonly path?: string;
};

export type MmHandoffPayload = {
  readonly toRunId?: string;
  readonly summary: string;
  readonly artifacts?: ReadonlyArray<{ readonly path: string; readonly sha256: string }>;
};

export type MmContextPacket = {
  readonly packetId: string;
  readonly summary: string;
  readonly citations: ReadonlyArray<Citation>;
};

export interface MmBridgeClient {
  review(input: { task: string; messages: ReadonlyArray<unknown> }): Promise<MmReviewResult>;
  gate(input: { runId: string; submission: string; messages: ReadonlyArray<unknown> }): Promise<MmGateResult>;
  security(input: { action: MiniLoopAction; observation: MiniLoopObservation }): Promise<ReadonlyArray<MmSecurityFinding>>;
  handoff(input: MmHandoffPayload): Promise<{ accepted: boolean; reason?: string }>;
  contextPacket(input: { runId: string; messages: ReadonlyArray<unknown> }): Promise<MmContextPacket>;
}

export class NoOpMmBridgeClient implements MmBridgeClient {
  async review(): Promise<MmReviewResult> {
    return { reviewerId: "noop", summary: "(noop)", issues: [] };
  }
  async gate(): Promise<MmGateResult> {
    return { gateId: "noop", status: "pass", summary: "(noop)" };
  }
  async security(): Promise<ReadonlyArray<MmSecurityFinding>> {
    return [];
  }
  async handoff(): Promise<{ accepted: boolean }> {
    return { accepted: true };
  }
  async contextPacket(): Promise<MmContextPacket> {
    return { packetId: "noop", summary: "(noop)", citations: [] };
  }
}

const RISKY_SHELL_PATTERNS = [
  /\brm\s+-rf\s+\//,
  /\bdd\s+if=.*of=\/dev\//,
  /\bcurl\s+.*\|\s*(?:sh|bash|zsh)\b/,
  /\bgit\s+push\s+--force(-with-lease)?\b/,
];

function isRiskyShell(action: MiniLoopAction): boolean {
  if (action.tool !== "run_shell") {
    return false;
  }
  const command = typeof action.input.command === "string" ? action.input.command : "";
  return RISKY_SHELL_PATTERNS.some((pattern) => pattern.test(command));
}

export type MmBridgeHookOptions = {
  readonly client: MmBridgeClient;
  readonly runId: string;
  readonly attachReview?: boolean;
  readonly attachSecurity?: boolean;
  readonly attachGate?: boolean;
};

export function buildMmBridgeHooks(options: MmBridgeHookOptions): {
  readonly onAfterStep: (
    ctx: MiniLoopHookContext,
    action: MiniLoopAction,
    observation: MiniLoopObservation,
  ) => Promise<MiniLoopHookDecision>;
  readonly onSubmit: (
    ctx: MiniLoopHookContext,
    submission: string,
  ) => Promise<MiniLoopHookDecision>;
} {
  const attachReview = options.attachReview ?? true;
  const attachSecurity = options.attachSecurity ?? true;
  const attachGate = options.attachGate ?? true;

  return {
    async onAfterStep(ctx, action, observation): Promise<MiniLoopHookDecision> {
      if (attachSecurity && isRiskyShell(action)) {
        const findings = await options.client.security({ action, observation });
        const errorFinding = findings.find((finding) => finding.severity === "error");
        if (errorFinding) {
          return { kind: "halt", reason: `mmbridge.security: ${errorFinding.message}` };
        }
      }

      if (attachReview && action.tool === "write_file") {
        const review = await options.client.review({
          task: `step ${ctx.stepIndex} write_file review`,
          messages: ctx.messages,
        });
        if (review.issues.length > 0) {
          return {
            kind: "inject",
            message: {
              role: "system",
              content: `mmbridge.review: ${review.summary}\n${review.issues.map((issue) => `- ${issue}`).join("\n")}`,
              stepIndex: ctx.stepIndex,
            },
          };
        }
      }

      return { kind: "continue" };
    },

    async onSubmit(ctx, submission): Promise<MiniLoopHookDecision> {
      if (!attachGate) {
        return { kind: "continue" };
      }
      const gate = await options.client.gate({
        runId: options.runId,
        submission,
        messages: ctx.messages,
      });
      if (gate.status === "fail") {
        return { kind: "halt", reason: `mmbridge.gate: ${gate.summary}` };
      }
      if (gate.status === "warn") {
        return {
          kind: "inject",
          message: {
            role: "system",
            content: `mmbridge.gate warn: ${gate.summary}`,
            stepIndex: ctx.stepIndex,
          },
        };
      }
      return { kind: "continue" };
    },
  };
}
