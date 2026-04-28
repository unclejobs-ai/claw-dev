/**
 * Reflection — Walnut-style end-of-run synthesis.
 *
 * After a run terminates, the conductor calls reflect() with the run trace.
 * The reflector pulls success/failure patterns + user insights + codebase
 * insights into a ReflectionResult. The actual LLM call lives behind the
 * injected ReflectionClient so this module stays pure + testable.
 */

import type { ReflectionResult } from "@unclecode/contracts";

export type ReflectionInput = {
  readonly runId: string;
  readonly objective: string;
  readonly summary: string;
  readonly transcript: string;
  readonly artifacts?: ReadonlyArray<{ readonly path: string; readonly sha256: string }>;
};

export interface ReflectionClient {
  synthesize(input: ReflectionInput): Promise<{
    readonly successPatterns: ReadonlyArray<string>;
    readonly failurePatterns: ReadonlyArray<string>;
    readonly userInsights: ReadonlyArray<string>;
    readonly codebaseInsights: ReadonlyArray<string>;
  }>;
}

export async function reflect(
  client: ReflectionClient,
  input: ReflectionInput,
): Promise<ReflectionResult> {
  const synthesis = await client.synthesize(input);
  return {
    runId: input.runId,
    successPatterns: synthesis.successPatterns,
    failurePatterns: synthesis.failurePatterns,
    userInsights: synthesis.userInsights,
    codebaseInsights: synthesis.codebaseInsights,
    generatedAt: Date.now(),
  };
}

export class HeuristicReflectionClient implements ReflectionClient {
  async synthesize(input: ReflectionInput) {
    const success: string[] = [];
    const failure: string[] = [];
    if (/passed|all green|✅/i.test(input.summary)) {
      success.push(`Run "${input.runId}" finished with passing summary.`);
    }
    if (/failed|broken|❌|error/i.test(input.summary)) {
      failure.push(`Run "${input.runId}" surfaced failures in the summary.`);
    }
    return {
      successPatterns: success,
      failurePatterns: failure,
      userInsights: [],
      codebaseInsights: input.artifacts?.map((entry) => `Artifact ${entry.path}@${entry.sha256.slice(0, 7)}`) ?? [],
    };
  }
}
