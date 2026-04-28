/**
 * Patch validator — applies each candidate diff to disk in a fresh workspace
 * snapshot, runs the verifier, scores. Highest-scoring candidate wins; ties
 * fall back to fewest applied hunks (smallest patch).
 */

import { applyPatch } from "../aci/apply-patch.js";
import type { PatchCandidate } from "./candidate-generator.js";

export type ValidationResult = {
  readonly candidate: PatchCandidate;
  readonly applied: boolean;
  readonly verifierExitCode: number;
  readonly summary: string;
  readonly score: number;
};

export interface ValidatorClient {
  prepareSnapshot(): Promise<{ readonly cwd: string; readonly cleanup: () => Promise<void> }>;
  runVerifier(input: { readonly cwd: string }): Promise<{ readonly exitCode: number; readonly summary: string }>;
}

export async function validateCandidates(
  candidates: ReadonlyArray<PatchCandidate>,
  client: ValidatorClient,
): Promise<ReadonlyArray<ValidationResult>> {
  const results: ValidationResult[] = [];
  for (const candidate of candidates) {
    const snapshot = await client.prepareSnapshot();
    try {
      const applied = applyPatch({ cwd: snapshot.cwd, patch: candidate.diff });
      if (applied.applied.length === 0) {
        results.push({
          candidate,
          applied: false,
          verifierExitCode: -1,
          summary: applied.rejected[0]?.reason ?? "patch did not apply",
          score: 0,
        });
        continue;
      }
      const verify = await client.runVerifier({ cwd: snapshot.cwd });
      const success = verify.exitCode === 0;
      results.push({
        candidate,
        applied: true,
        verifierExitCode: verify.exitCode,
        summary: verify.summary,
        score: success ? 1 - applied.applied.length * 0.01 : 0,
      });
    } finally {
      await snapshot.cleanup();
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

export function pickBestCandidate(results: ReadonlyArray<ValidationResult>): ValidationResult | undefined {
  return results.find((entry) => entry.score > 0);
}
